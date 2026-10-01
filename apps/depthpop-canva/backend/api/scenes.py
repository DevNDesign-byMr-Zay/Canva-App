from __future__ import annotations

import asyncio
import uuid
from typing import Callable
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile
from models.job import DepthJob
from services.persistence import job_repo, scene_repo
from services.scene_builder import SceneBuilderService

router = APIRouter(prefix="/api/v1/scenes", tags=["scenes"])


async def run_scene_decomposition_job(
    job_id: str,
    raw_image_bytes: bytes,
    source_asset_id: str,
    url_builder: Callable[[bytes, str], str],
    max_objects: int,
    segmentation_mode: str,
    depth_quality: str,
    inpaint: bool,
    builder_service: SceneBuilderService | None = None,
) -> None:
    builder = builder_service or SceneBuilderService()
    try:
        await job_repo.update_job_stage(job_id, stage="decoding", status="processing", progress=0.1)

        await job_repo.update_job_stage(job_id, stage="segmenting_objects", progress=0.25)

        await job_repo.update_job_stage(job_id, stage="estimating_depth", progress=0.50)

        await job_repo.update_job_stage(job_id, stage="extracting_objects", progress=0.70)

        await job_repo.update_job_stage(job_id, stage="reconstructing_plate", progress=0.85)

        await job_repo.update_job_stage(job_id, stage="building_scene", progress=0.95)

        scene = await builder.build_scene(
            image_bytes=raw_image_bytes,
            source_asset_id=source_asset_id,
            url_builder=url_builder,
            max_objects=max_objects,
            segmentation_mode=segmentation_mode,
            depth_quality=depth_quality,
            inpaint=inpaint,
        )

        await scene_repo.save_scene(scene)

        await job_repo.update_job_stage(
            job_id,
            stage="complete",
            status="complete",
            scene_id=scene.id,
            progress=1.0,
        )
    except Exception as exc:
        await job_repo.update_job_stage(
            job_id,
            stage="error",
            status="error",
            error=str(exc),
            progress=1.0,
        )


@router.post("")
async def create_scene(
    request: Request,
    background_tasks: BackgroundTasks,
    image: UploadFile = File(...),
    max_objects: int = Form(24, ge=1, le=100),
    segmentation_mode: str = Form("auto"),
    depth_quality: str = Form("high"),
    inpaint: bool = Form(True),
) -> dict:
    # Read and validate image
    raw_bytes = await image.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Uploaded image is empty")

    job_id = f"job_{uuid.uuid4().hex[:12]}"
    asset_id = f"asset_{uuid.uuid4().hex[:8]}"

    # URL Builder for caching generated cutouts, masks, thumbnails, plates
    from app import _cache_put, _public_url

    def build_url(data: bytes, mime: str) -> str:
        key = _cache_put(data, mime)
        return _public_url(request, f"/cache/image/{key}")

    # Initialize job in queued state
    await job_repo.update_job_stage(job_id, stage="queued", status="queued", progress=0.0)

    # Schedule background task
    background_tasks.add_task(
        run_scene_decomposition_job,
        job_id=job_id,
        raw_image_bytes=raw_bytes,
        source_asset_id=asset_id,
        url_builder=build_url,
        max_objects=max_objects,
        segmentation_mode=segmentation_mode,
        depth_quality=depth_quality,
        inpaint=inpaint,
    )

    return {"jobId": job_id, "status": "queued"}


@router.get("/{scene_id}")
async def get_scene(scene_id: str) -> dict:
    scene = await scene_repo.get_scene(scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Scene not found")

    return scene.model_dump(mode="json", by_alias=True)
