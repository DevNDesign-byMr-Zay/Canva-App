from __future__ import annotations

import asyncio
import hashlib
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path

from models import (
    ExportArtifact,
    ExportJob,
    ExportSubmission,
    new_id,
    utc_now,
)
from renderers import RendererRegistry
from repositories import (
    ARTIFACT_TTL_SECONDS,
    ArtifactRepository,
    JobRepository,
)


class ExportService:
    def __init__(
        self,
        *,
        jobs: JobRepository,
        artifacts: ArtifactRepository,
        renderers: RendererRegistry,
    ) -> None:
        self.jobs = jobs
        self.artifacts = artifacts
        self.renderers = renderers
        self._tasks: set[asyncio.Task[None]] = set()

    def create(
        self,
        submission: ExportSubmission,
        *,
        user_id: str,
        brand_id: str,
    ) -> tuple[ExportJob, str]:
        export_id = new_id("hfexp")
        job_id = new_id("hfjob")
        now = utc_now()
        job = ExportJob(
            id=job_id,
            exportId=export_id,
            userId=user_id,
            brandId=brand_id,
            status="queued",
            stage="queued",
            percent=0,
            message="HoloForge export queued",
            createdAt=now,
            updatedAt=now,
        )
        self.jobs.put(job)

        task = asyncio.create_task(
            self._run(
                submission,
                job_id=job_id,
                export_id=export_id,
                user_id=user_id,
                brand_id=brand_id,
            )
        )
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
        return job, export_id

    def _update(
        self,
        job: ExportJob,
        *,
        status: str,
        stage: str,
        percent: int,
        message: str,
        error: str | None = None,
    ) -> ExportJob:
        next_job = job.model_copy(
            update={
                "status": status,
                "stage": stage,
                "percent": percent,
                "message": message,
                "error": error,
                "updatedAt": utc_now(),
            }
        )
        self.jobs.put(next_job)
        return next_job

    async def _run(
        self,
        submission: ExportSubmission,
        *,
        job_id: str,
        export_id: str,
        user_id: str,
        brand_id: str,
    ) -> None:
        from repositories import OwnedKey

        key = OwnedKey(user_id=user_id, brand_id=brand_id, resource_id=job_id)
        job = self.jobs.get(key)
        if not job:
            return

        output_dir: Path | None = None
        try:
            job = self._update(
                job,
                status="validating",
                stage="validating",
                percent=10,
                message="Validating HoloScene and export profile",
            )
            renderer = self.renderers.resolve(submission.request.format)

            job = self._update(
                job,
                status="rendering",
                stage="rendering",
                percent=30,
                message="Rendering " + submission.request.format,
            )
            output_dir = self.artifacts.allocate_dir(export_id)
            artifact_path, mime_type = await renderer.render(
                submission.scene,
                submission.request,
                output_dir,
            )

            job = self._update(
                job,
                status="packaging",
                stage="packaging",
                percent=88,
                message="Finalizing export artifact",
            )
            raw = artifact_path.read_bytes()
            digest = hashlib.sha256(raw).hexdigest()[:12]
            extension = "".join(artifact_path.suffixes) or ".bin"
            final_name = f"{export_id}-{digest}{extension}"
            final_path = output_dir / final_name
            if final_path != artifact_path:
                artifact_path.replace(final_path)

            expires = datetime.now(timezone.utc) + timedelta(seconds=ARTIFACT_TTL_SECONDS)
            artifact = ExportArtifact(
                id=export_id,
                userId=user_id,
                brandId=brand_id,
                format=submission.request.format,
                profile=submission.request.profile,
                fileName=final_name,
                mimeType=mime_type,
                path=str(final_path),
                sizeBytes=final_path.stat().st_size,
                createdAt=utc_now(),
                expiresAt=expires.isoformat(),
            )
            self.artifacts.put(artifact)

            self._update(
                job,
                status="complete",
                stage="complete",
                percent=100,
                message="Export complete",
            )
        except Exception as exc:
            if output_dir is not None:
                shutil.rmtree(output_dir, ignore_errors=True)
            self._update(
                job,
                status="error",
                stage="error",
                percent=min(job.percent, 99),
                message="Export failed",
                error=str(exc)[:1000],
            )
