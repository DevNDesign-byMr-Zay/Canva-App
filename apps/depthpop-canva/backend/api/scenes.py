from __future__ import annotations

import asyncio
import hashlib
import uuid
from typing import Awaitable, Callable
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, Response, UploadFile
from auth import verify_canva_user, VerifiedCanvaUser
from models.job import DepthJob
from services.persistence import job_repo, scene_asset_repo, scene_repo
from services.scene_builder import SceneBuilderService
from services.upload import validate_and_read_upload

router = APIRouter(prefix="/api/v1", tags=["scenes"])

SUPPORTED_SEGMENTATION_MODES = {"auto", "florence_sam3", "mock"}
SUPPORTED_DEPTH_QUALITIES = {"high", "standard"}


async def run_scene_decomposition_job(
    job_id: str,
    raw_image_bytes: bytes,
    source_asset_id: str,
    url_builder: Callable[[bytes, str], Awaitable[str]],
    max_objects: int,
    segmentation_mode: str,
    depth_quality: str,
    inpaint: bool,
    user_id: str,
    brand_id: str,
    builder_service: SceneBuilderService | None = None,
) -> None:
    builder = builder_service or SceneBuilderService()
    current_stage = "queued"

    async def report_stage(stage_name: str, progress_val: float) -> None:
        nonlocal current_stage
        current_stage = stage_name
        await job_repo.update_job_stage(
            job_id,
            stage=stage_name,
            status="processing",
            progress=progress_val,
            user_id=user_id,
            brand_id=brand_id,
        )

    try:
        scene = await builder.build_scene(
            image_bytes=raw_image_bytes,
            source_asset_id=source_asset_id,
            url_builder=url_builder,
            max_objects=max_objects,
            segmentation_mode=segmentation_mode,
            depth_quality=depth_quality,
            inpaint=inpaint,
            stage_reporter=report_stage,
        )

        scene = scene.model_copy(update={"userId": user_id, "brandId": brand_id})
        await scene_repo.save_scene(scene)

        await job_repo.update_job_stage(
            job_id,
            stage="complete",
            status="complete",
            scene_id=scene.id,
            progress=1.0,
            user_id=user_id,
            brand_id=brand_id,
        )
    except Exception as exc:
        await job_repo.update_job_stage(
            job_id,
            stage=current_stage if current_stage != "queued" else "error",
            status="error",
            error=str(exc),
            progress=1.0,
            user_id=user_id,
            brand_id=brand_id,
        )


@router.post("/scenes")
async def create_scene(
    request: Request,
    background_tasks: BackgroundTasks,
    image: UploadFile = File(...),
    max_objects: int = Form(24, ge=1, le=100),
    segmentation_mode: str = Form("auto"),
    depth_quality: str = Form("high"),
    inpaint: bool = Form(False),
    user: VerifiedCanvaUser = Depends(verify_canva_user),
) -> dict:
    if segmentation_mode not in SUPPORTED_SEGMENTATION_MODES:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported segmentation_mode '{segmentation_mode}'. Supported: {sorted(SUPPORTED_SEGMENTATION_MODES)}",
        )
    if depth_quality not in SUPPORTED_DEPTH_QUALITIES:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported depth_quality '{depth_quality}'. Supported: {sorted(SUPPORTED_DEPTH_QUALITIES)}",
        )

    raw_bytes, detected_mime = await validate_and_read_upload(image)

    job_id = f"job_{uuid.uuid4().hex[:12]}"
    asset_id = f"asset_{uuid.uuid4().hex[:8]}"

    from app import _public_url

    async def build_url(data: bytes, mime: str) -> str:
        key = hashlib.sha256(data).hexdigest()[:32]
        await scene_asset_repo.save_asset(
            asset_id=key,
            scene_id="",
            user_id=user.user_id,
            brand_id=user.brand_id,
            data=data,
            mime_type=mime,
        )
        return _public_url(request, f"/api/v1/assets/{key}")

    await job_repo.update_job_stage(
        job_id, stage="queued", status="queued", progress=0.0, user_id=user.user_id, brand_id=user.brand_id
    )

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
        user_id=user.user_id,
        brand_id=user.brand_id,
    )

    return {"jobId": job_id, "status": "queued"}


@router.get("/scenes/{scene_id}")
async def get_scene(
    scene_id: str,
    user: VerifiedCanvaUser = Depends(verify_canva_user),
) -> dict:
    scene = await scene_repo.get_scene(scene_id)
    if not scene or (scene.userId and scene.userId != user.user_id) or (scene.brandId and scene.brandId != user.brand_id):
        raise HTTPException(status_code=404, detail="Scene not found")

    return scene.model_dump(mode="json", by_alias=True)


@router.get("/assets/{asset_id}")
async def get_scene_asset(
    asset_id: str,
    user: VerifiedCanvaUser = Depends(verify_canva_user),
) -> Response:
    asset = await scene_asset_repo.get_asset(asset_id, user_id=user.user_id, brand_id=user.brand_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset expired or unavailable")

    return Response(
        content=asset.data,
        media_type=asset.mime_type,
        headers={"Cache-Control": "private, max-age=3600"},
    )
