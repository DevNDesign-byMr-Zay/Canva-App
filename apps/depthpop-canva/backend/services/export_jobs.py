from __future__ import annotations

import asyncio
import os
import time
import uuid
from diagnostics import log_failure, SAFE_JOB_ERROR
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Awaitable, Callable

from models.export import (
    DepthExportArtifact,
    DepthExportJob,
    ExportRequest,
)
from services.export_formats import (
    AssetFetcher,
    export_gltf_or_glb,
    export_png_layers,
    export_portable_scene_json,
    export_video,
)
from services.export_persistence import (
    EXPORT_ARTIFACT_TTL_SECONDS,
    export_repo,
    export_storage,
)
from services.persistence import scene_repo

MAX_EXPORT_CONCURRENCY = max(
    1,
    min(4, int(os.getenv("DEPTHPOP_MAX_EXPORT_CONCURRENCY", "2"))),
)
MAX_EXPORT_ARTIFACT_BYTES = max(
    1024 * 1024,
    int(os.getenv("DEPTHPOP_MAX_EXPORT_ARTIFACT_BYTES", str(512 * 1024 * 1024))),
)
_EXPORT_SLOTS = asyncio.Semaphore(MAX_EXPORT_CONCURRENCY)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def create_export_job(
    *,
    scene_id: str,
    user_id: str,
    brand_id: str,
    request: ExportRequest,
) -> DepthExportJob:
    now = _now()
    job = DepthExportJob(
        jobId=f"export_{uuid.uuid4().hex[:16]}",
        userId=user_id,
        brandId=brand_id,
        sceneId=scene_id,
        format=request.format,
        status="queued",
        stage="queued",
        progress=0.0,
        artifactId=None,
        error=None,
        cancelRequested=False,
        createdAt=now,
        updatedAt=now,
    )
    export_repo.save_job(job)
    return job


def _update(
    job: DepthExportJob,
    *,
    status: str | None = None,
    stage: str | None = None,
    progress: float | None = None,
    artifact_id: str | None = None,
    error: str | None = None,
    cancel_requested: bool | None = None,
) -> DepthExportJob:
    changes: dict = {"updatedAt": _now()}
    if status is not None:
        changes["status"] = status
    if stage is not None:
        changes["stage"] = stage
    if progress is not None:
        changes["progress"] = max(0.0, min(1.0, progress))
    if artifact_id is not None:
        changes["artifactId"] = artifact_id
    if error is not None:
        changes["error"] = error
    if cancel_requested is not None:
        changes["cancelRequested"] = cancel_requested
    updated = job.model_copy(update=changes)
    export_repo.save_job(updated)
    return updated


async def run_export_job(
    job_id: str,
    request: ExportRequest,
    *,
    fetch_asset: AssetFetcher,
) -> None:
    # The authenticated owner information is already fixed in the queued job.
    seed = None
    if hasattr(export_repo, "_jobs"):
        # Memory repository still requires ownership-scoped lookup; discover the
        # queued record only through its internal store inside this service.
        record = export_repo._jobs.get(job_id)  # type: ignore[attr-defined]
        seed = record[1] if record else None
    if seed is None:
        # Durable repository lookup needs the owner. Read the SQLite payload
        # through the public job record passed by the API in normal execution.
        # The runner stores a private owner snapshot below when queued.
        seed = _RUNNER_OWNERS.get(job_id)
    if seed is None:
        return

    user_id = seed.userId
    brand_id = seed.brandId

    async def current() -> DepthExportJob | None:
        return export_repo.get_job(
            job_id,
            user_id=user_id,
            brand_id=brand_id,
        )

    async def cancelled() -> bool:
        found = await current()
        return bool(found and found.cancelRequested)

    last_stage = "queued"

    async def report(stage: str, progress: float) -> None:
        nonlocal last_stage
        found = await current()
        if found is None:
            raise RuntimeError("export job metadata disappeared")
        if found.cancelRequested:
            raise asyncio.CancelledError()
        _update(
            found,
            status="processing",
            stage=stage,
            progress=progress,
            error="",
        )
        last_stage = stage

    workspace: Path | None = None
    try:
        async with _EXPORT_SLOTS:
            found = await current()
            if found is None:
                return
            if found.cancelRequested:
                raise asyncio.CancelledError()

            await report("loading_scene", 0.05)
            scene = await scene_repo.get_scene(
                found.sceneId,
                user_id=user_id,
                brand_id=brand_id,
            )
            if scene is None:
                raise RuntimeError("DepthScene is unavailable or no longer owned by this user")

            workspace = export_storage.allocate_workspace(job_id)
            stem = "".join(
                char if char.isalnum() or char in "-_" else "-"
                for char in scene.id
            ).strip("-_")[:96] or "depthscene"

            if request.format == "scene-json":
                await report("loading_assets", 0.20)
                target = workspace / f"{stem}.depthscene.json"
                artifact_path, mime = await export_portable_scene_json(
                    scene,
                    fetch_asset,
                    target,
                )
            elif request.format == "png-layers":
                await report("packaging_layers", 0.20)
                target = workspace / f"{stem}-layers.zip"
                artifact_path, mime = await export_png_layers(
                    scene,
                    fetch_asset,
                    target,
                )
            elif request.format in {"gltf", "glb"}:
                await report("building_gltf", 0.20)
                target = workspace / f"{stem}.{request.format}"
                artifact_path, mime = await export_gltf_or_glb(
                    scene,
                    fetch_asset,
                    target,
                    glb=request.format == "glb",
                    include_animation=request.includeAnimation,
                )
            else:
                extension = "mp4" if request.format == "mp4" else "webm"
                target = workspace / f"{stem}.{extension}"
                artifact_path, mime = await export_video(
                    scene,
                    fetch_asset,
                    target,
                    request,
                    workspace,
                    report,
                    cancelled,
                )

            if await cancelled():
                raise asyncio.CancelledError()
            size = artifact_path.stat().st_size
            if size <= 0:
                raise RuntimeError("export renderer produced an empty artifact")
            if size > MAX_EXPORT_ARTIFACT_BYTES:
                raise RuntimeError("export artifact exceeds DEPTHPOP_MAX_EXPORT_ARTIFACT_BYTES")

            digest = export_storage.sha256_file(artifact_path)
            artifact_id = f"artifact_{uuid.uuid4().hex[:16]}"
            now = datetime.now(timezone.utc)
            artifact = DepthExportArtifact(
                artifactId=artifact_id,
                userId=user_id,
                brandId=brand_id,
                sceneId=scene.id,
                format=request.format,
                path=str(artifact_path.resolve()),
                mimeType=mime,
                size=size,
                sha256=digest,
                createdAt=now.isoformat().replace("+00:00", "Z"),
                expiresAt=(
                    now + timedelta(seconds=EXPORT_ARTIFACT_TTL_SECONDS)
                ).isoformat().replace("+00:00", "Z"),
            )
            export_repo.save_artifact(artifact)
            found = await current()
            if found is not None:
                _update(
                    found,
                    status="complete",
                    stage="complete",
                    progress=1.0,
                    artifact_id=artifact_id,
                    error="",
                )
    except asyncio.CancelledError:
        if workspace is not None:
            export_storage.cleanup_workspace(workspace)
        found = await current()
        if found is not None:
            _update(
                found,
                status="cancelled",
                stage="cancelled",
                progress=1.0,
                error="Export cancelled.",
                cancel_requested=True,
            )
    except Exception as exc:
        log_failure("export_failed", exc, job_id=job_id, stage=last_stage, service="depthpop-canva-backend")
        if workspace is not None:
            export_storage.cleanup_workspace(workspace)
        found = await current()
        if found is not None:
            _update(
                found,
                status="failed",
                stage="failed",
                progress=1.0,
                error=SAFE_JOB_ERROR,
            )
    finally:
        _RUNNER_OWNERS.pop(job_id, None)


_RUNNER_OWNERS: dict[str, DepthExportJob] = {}


def remember_runner_owner(job: DepthExportJob) -> None:
    _RUNNER_OWNERS[job.jobId] = job
