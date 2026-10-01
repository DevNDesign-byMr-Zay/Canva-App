from __future__ import annotations

import asyncio
import hashlib
import time
import uuid
from typing import Awaitable, Callable
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, Response, UploadFile
from auth import verify_canva_user, VerifiedCanvaUser
from models.job import DepthJob
from models.object import DepthObject
from models.scene import CameraConfig, DepthScene, TimelineConfig
from services.compositor import composite_scene
from services.persistence import job_repo, scene_asset_repo, scene_repo
from services.scene_builder import SceneBuilderService
from services.upload import validate_and_read_upload

router = APIRouter(prefix="/api/v1", tags=["scenes"])

SUPPORTED_SEGMENTATION_MODES = {"auto", "florence_sam3", "mock"}
SUPPORTED_DEPTH_QUALITIES = {"high", "standard"}


async def run_scene_decomposition_job(
    job_id: str,
    scene_id: str,
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

        scene = scene.model_copy(update={"id": scene_id, "userId": user_id, "brandId": brand_id})
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
    scene_id = f"scene_{uuid.uuid4().hex[:12]}"
    asset_id = f"asset_{uuid.uuid4().hex[:8]}"

    from app import _public_url

    async def build_url(data: bytes, mime: str) -> str:
        key = hashlib.sha256(data).hexdigest()[:32]
        await scene_asset_repo.save_asset(
            asset_id=key,
            scene_id=scene_id,
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
        scene_id=scene_id,
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


@router.patch("/scenes/{scene_id}")
async def patch_scene(
    scene_id: str,
    payload: dict,
    user: VerifiedCanvaUser = Depends(verify_canva_user),
) -> dict:
    scene = await scene_repo.get_scene(scene_id)
    if not scene or (scene.userId and scene.userId != user.user_id) or (scene.brandId and scene.brandId != user.brand_id):
        raise HTTPException(status_code=404, detail="Scene not found")

    for forbidden in ("userId", "brandId", "sourceAssetId", "schemaVersion", "reconstructedPlate"):
        if forbidden in payload:
            raise HTTPException(status_code=422, detail=f"Cannot modify immutable field '{forbidden}'")

    updated_scene = scene.model_copy(deep=True)

    if "objects" in payload and isinstance(payload["objects"], list):
        obj_map = {o["id"]: o for o in payload["objects"] if isinstance(o, dict) and "id" in o}
        new_objects = []
        for orig_obj in updated_scene.objects:
            if orig_obj.id in obj_map:
                patch = obj_map[orig_obj.id]
                merged = orig_obj.model_dump(by_alias=True)
                merged.update(patch)
                merged["assets"] = orig_obj.assets.model_dump(by_alias=True)
                merged["depth"] = orig_obj.depth.model_dump(by_alias=True)
                merged["confidence"] = orig_obj.confidence
                merged["semanticType"] = orig_obj.semanticType
                new_objects.append(DepthObject.model_validate(merged))
            else:
                new_objects.append(orig_obj)
        updated_scene.objects = new_objects

    if "camera" in payload and isinstance(payload["camera"], dict):
        updated_scene.camera = CameraConfig.model_validate(payload["camera"])

    if "timeline" in payload and isinstance(payload["timeline"], dict):
        updated_scene.timeline = TimelineConfig.model_validate(payload["timeline"])

    updated_scene.updatedAt = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    await scene_repo.save_scene(updated_scene)

    return updated_scene.model_dump(mode="json", by_alias=True)


@router.post("/scenes/{scene_id}/composite")
async def create_scene_composite(
    scene_id: str,
    request: Request,
    user: VerifiedCanvaUser = Depends(verify_canva_user),
) -> dict:
    scene = await scene_repo.get_scene(scene_id)
    if not scene or (scene.userId and scene.userId != user.user_id) or (scene.brandId and scene.brandId != user.brand_id):
        raise HTTPException(status_code=404, detail="Scene not found")

    async def asset_fetcher(url: str) -> bytes:
        asset_id = url.rstrip("/").rsplit("/", 1)[-1]
        asset = await scene_asset_repo.get_asset(asset_id, user_id=user.user_id, brand_id=user.brand_id)
        if not asset:
            raise HTTPException(status_code=404, detail=f"Scene asset '{asset_id}' expired or unavailable")
        return asset.data

    composite_png = await composite_scene(scene, asset_fetcher)
    comp_key = hashlib.sha256(composite_png).hexdigest()[:32]
    await scene_asset_repo.save_asset(
        asset_id=comp_key,
        scene_id=scene_id,
        user_id=user.user_id,
        brand_id=user.brand_id,
        data=composite_png,
        mime_type="image/png",
    )

    from app import _public_url
    comp_url = _public_url(request, f"/api/v1/assets/{comp_key}")

    return {
        "ok": True,
        "url": comp_url,
        "mimeType": "image/png",
        "sceneId": scene_id,
    }


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
