from __future__ import annotations

import base64
import math
import os
import time
import uuid
from typing import Callable
from urllib.parse import urlparse

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Request,
    Response,
    UploadFile,
)
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from auth import VerifiedCanvaUser, verify_canva_user
from models.object import DepthObject, ObjectTransform, Vector3
from models.scene import CameraConfig, DepthPopSceneSettings, TimelineConfig
from services.compositor import composite_scene
import services.persistence as persistence
from services.persistence import job_repo, scene_asset_repo, scene_repo
from services.scene_builder import SceneBuilderService
from services.upload import validate_and_read_upload

router = APIRouter(prefix="/api/v1/scenes", tags=["scenes"])

SUPPORTED_SEGMENTATION_MODES = {"auto", "florence_sam3", "mock"}
SUPPORTED_DEPTH_QUALITIES = {"high", "standard"}
SUPPORTED_RENDER_QUALITIES = {"fast", "balanced", "cinematic"}
QUALITY_STEPS = {"fast": 14, "balanced": 22, "cinematic": 34}


class PartialVector3(BaseModel):
    model_config = ConfigDict(extra="forbid")

    x: float | None = None
    y: float | None = None
    z: float | None = None

    @field_validator("x", "y", "z")
    @classmethod
    def finite(cls, value: float | None) -> float | None:
        if value is not None and not math.isfinite(value):
            raise ValueError("vector values must be finite")
        return value


class PositiveScalePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    x: float | None = Field(None, gt=0.0, le=10.0)
    y: float | None = Field(None, gt=0.0, le=10.0)
    z: float | None = Field(None, gt=0.0, le=10.0)


class TransformPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    position: PartialVector3 | None = None
    rotation: PartialVector3 | None = None
    scale: PositiveScalePatch | None = None


class ObjectPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., min_length=1, max_length=160)
    transform: TransformPatch | None = None
    opacity: float | None = Field(None, ge=0.0, le=1.0)
    feather: float | None = Field(None, ge=0.0, le=100.0)
    visible: bool | None = None
    locked: bool | None = None
    order: int | None = Field(None, ge=0, le=127)


class CameraPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    position: PartialVector3 | None = None
    target: PartialVector3 | None = None
    fov: float | None = Field(None, ge=1.0, lt=180.0)


class TimelinePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    durationMs: int | None = Field(None, ge=0, le=60 * 60 * 1000)
    fps: int | None = Field(None, ge=1, le=120)
    currentTimeMs: int | None = Field(None, ge=0)


class ScenePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    objects: list[ObjectPatch] | None = None
    camera: CameraPatch | None = None
    timeline: TimelinePatch | None = None

    @model_validator(mode="after")
    def unique_patch_ids(self) -> "ScenePatch":
        if self.objects is not None:
            ids = [item.id for item in self.objects]
            if len(ids) != len(set(ids)):
                raise ValueError("scene patch contains duplicate object ids")
        return self


def _merge_vector(base: Vector3, patch: PartialVector3 | PositiveScalePatch | None) -> Vector3:
    if patch is None:
        return base
    data = base.model_dump()
    data.update(patch.model_dump(exclude_none=True))
    return Vector3.model_validate(data)


async def run_scene_decomposition_job(
    job_id: str,
    scene_id: str,
    raw_image_bytes: bytes,
    source_asset_id: str,
    url_builder: Callable[[bytes, str], str],
    max_objects: int,
    segmentation_mode: str,
    depth_quality: str,
    inpaint: bool,
    scene_settings: DepthPopSceneSettings,
    inpaint_steps: int,
    user_id: str,
    brand_id: str,
    builder_service: SceneBuilderService | None = None,
) -> None:
    builder = builder_service or SceneBuilderService()
    current_stage = "queued"

    async def report_stage(stage_name: str, progress_value: float) -> None:
        nonlocal current_stage
        current_stage = stage_name
        await job_repo.update_job_stage(
            job_id,
            stage=stage_name,
            status="processing",
            progress=progress_value,
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
            settings=scene_settings,
            inpaint_steps=inpaint_steps,
            stage_reporter=report_stage,
            scene_id=scene_id,
        )

        scene = scene.model_copy(
            update={
                "userId": user_id,
                "brandId": brand_id,
            }
        )
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
        scene_asset_repo.cleanup_scene_assets_sync(scene_id)
        await job_repo.update_job_stage(
            job_id,
            stage=current_stage if current_stage != "queued" else "error",
            status="error",
            error=str(exc),
            progress=1.0,
            user_id=user_id,
            brand_id=brand_id,
        )


@router.post("")
async def create_scene(
    request: Request,
    background_tasks: BackgroundTasks,
    image: UploadFile = File(...),
    max_objects: int = Form(24, ge=1, le=100),
    segmentation_mode: str = Form("auto"),
    depth_quality: str = Form("high"),
    inpaint: bool = Form(False),
    depth_strength: float = Form(0.32, ge=0.05, le=0.75),
    depth_blur: int = Form(35, ge=0, le=100),
    depth_fidelity: float = Form(0.95, ge=0.05, le=1.0),
    render_quality: str = Form("cinematic"),
    user: VerifiedCanvaUser = Depends(verify_canva_user),
) -> dict:
    if segmentation_mode not in SUPPORTED_SEGMENTATION_MODES:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Unsupported segmentation_mode '{segmentation_mode}'. "
                f"Supported: {sorted(SUPPORTED_SEGMENTATION_MODES)}"
            ),
        )
    if depth_quality not in SUPPORTED_DEPTH_QUALITIES:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Unsupported depth_quality '{depth_quality}'. "
                f"Supported: {sorted(SUPPORTED_DEPTH_QUALITIES)}"
            ),
        )

    if render_quality not in SUPPORTED_RENDER_QUALITIES:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Unsupported render_quality '{render_quality}'. "
                f"Supported: {sorted(SUPPORTED_RENDER_QUALITIES)}"
            ),
        )

    resolved_depth_quality = "standard" if render_quality == "fast" else "high"
    scene_settings = DepthPopSceneSettings(
        depthStrength=depth_strength,
        depthBlur=depth_blur,
        depthFidelity=depth_fidelity,
        renderQuality=render_quality,
        numInferenceSteps=QUALITY_STEPS[render_quality],
    )

    raw_bytes, detected_mime = await validate_and_read_upload(image)

    job_id = f"job_{uuid.uuid4().hex[:12]}"
    scene_id = f"scene_{uuid.uuid4().hex[:12]}"
    public_base = (
        os.getenv("PUBLIC_BASE_URL", "").strip().rstrip("/")
        or str(request.base_url).rstrip("/")
    )

    source_asset = scene_asset_repo.save_asset_sync(
        scene_id=scene_id,
        user_id=user.user_id,
        brand_id=user.brand_id,
        data=raw_bytes,
        mime_type=detected_mime,
    )
    source_asset_id = source_asset.asset_id

    def build_url(data: bytes, mime: str) -> str:
        asset = scene_asset_repo.save_asset_sync(
            scene_id=scene_id,
            user_id=user.user_id,
            brand_id=user.brand_id,
            data=data,
            mime_type=mime,
        )
        return f"{public_base}/api/v1/assets/{asset.asset_id}"

    await job_repo.update_job_stage(
        job_id,
        stage="queued",
        status="queued",
        progress=0.0,
        user_id=user.user_id,
        brand_id=user.brand_id,
    )

    background_tasks.add_task(
        run_scene_decomposition_job,
        job_id=job_id,
        scene_id=scene_id,
        raw_image_bytes=raw_bytes,
        source_asset_id=source_asset_id,
        url_builder=build_url,
        max_objects=max_objects,
        segmentation_mode=segmentation_mode,
        depth_quality=resolved_depth_quality,
        inpaint=inpaint,
        scene_settings=scene_settings,
        inpaint_steps=scene_settings.numInferenceSteps,
        user_id=user.user_id,
        brand_id=user.brand_id,
    )

    return {"jobId": job_id, "status": "queued"}


@router.get("/{scene_id}")
async def get_scene(
    scene_id: str,
    user: VerifiedCanvaUser = Depends(verify_canva_user),
) -> dict:
    scene = await scene_repo.get_scene(scene_id)
    if (
        not scene
        or scene.userId != user.user_id
        or scene.brandId != user.brand_id
    ):
        raise HTTPException(status_code=404, detail="Scene not found")

    return scene.model_dump(mode="json", by_alias=True)


@router.patch("/{scene_id}")
async def patch_scene(
    scene_id: str,
    patch: ScenePatch,
    user: VerifiedCanvaUser = Depends(verify_canva_user),
) -> dict:
    scene = await scene_repo.get_scene(scene_id)
    if (
        not scene
        or scene.userId != user.user_id
        or scene.brandId != user.brand_id
    ):
        raise HTTPException(status_code=404, detail="Scene not found")

    updated = scene.model_copy(deep=True)

    if patch.objects is not None:
        originals = {obj.id: obj for obj in updated.objects}
        requested_ids = {item.id for item in patch.objects}
        unknown = sorted(requested_ids - originals.keys())
        if unknown:
            raise HTTPException(
                status_code=422,
                detail=f"Unknown DepthScene object id(s): {', '.join(unknown)}",
            )

        patch_by_id = {item.id: item for item in patch.objects}
        next_objects: list[DepthObject] = []
        for original in updated.objects:
            item = patch_by_id.get(original.id)
            if item is None:
                next_objects.append(original)
                continue

            transform = original.transform
            if item.transform is not None:
                transform = ObjectTransform(
                    position=_merge_vector(
                        original.transform.position,
                        item.transform.position,
                    ),
                    rotation=_merge_vector(
                        original.transform.rotation,
                        item.transform.rotation,
                    ),
                    scale=_merge_vector(
                        original.transform.scale,
                        item.transform.scale,
                    ),
                )

            changes = item.model_dump(
                exclude={"id", "transform"},
                exclude_none=True,
            )
            changes["transform"] = transform
            next_objects.append(original.model_copy(update=changes))

        orders = [obj.order for obj in next_objects]
        if len(orders) != len(set(orders)):
            raise HTTPException(
                status_code=422,
                detail="DepthScene object order values must remain unique.",
            )
        updated.objects = next_objects

    if patch.camera is not None:
        camera = updated.camera
        camera_patch = patch.camera
        updated.camera = CameraConfig(
            position=_merge_vector(camera.position, camera_patch.position),
            target=_merge_vector(camera.target, camera_patch.target),
            fov=camera_patch.fov if camera_patch.fov is not None else camera.fov,
        )

    if patch.timeline is not None:
        timeline_data = updated.timeline.model_dump(by_alias=True)
        timeline_data.update(
            patch.timeline.model_dump(
                exclude_none=True,
                by_alias=True,
            )
        )
        next_timeline = TimelineConfig.model_validate(timeline_data)
        if next_timeline.currentTimeMs > next_timeline.durationMs:
            raise HTTPException(
                status_code=422,
                detail="timeline currentTimeMs cannot exceed durationMs",
            )
        updated.timeline = next_timeline

    updated.updatedAt = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    await scene_repo.save_scene(updated)
    return updated.model_dump(mode="json", by_alias=True)


async def _scene_asset_bytes(
    url: str,
    *,
    user_id: str,
    brand_id: str,
) -> bytes:
    parsed = urlparse(url)
    path = parsed.path

    if path.startswith("/api/v1/assets/"):
        asset_repo = getattr(persistence, "scene_asset_repo", None)
        if asset_repo is None:
            raise HTTPException(
                status_code=404,
                detail="Authenticated scene asset repository is unavailable.",
            )
        asset_id = path.rsplit("/", 1)[-1]
        asset = await asset_repo.get_asset(
            asset_id,
            user_id=user_id,
            brand_id=brand_id,
        )
        if not asset:
            raise HTTPException(
                status_code=404,
                detail=f"Scene asset '{asset_id}' expired or is unavailable.",
            )
        return asset.data

    if path.startswith("/cache/image/"):
        image_id = path.rsplit("/", 1)[-1]
        from app import CACHE_TTL_SECONDS, _image_cache

        record = _image_cache.get(image_id)
        if not record:
            raise HTTPException(status_code=404, detail="Scene image expired.")
        created, data, _mime = record
        if time.time() - created > CACHE_TTL_SECONDS:
            _image_cache.pop(image_id, None)
            raise HTTPException(status_code=404, detail="Scene image expired.")
        return data

    if url.startswith("data:image/") and ";base64," in url:
        try:
            return base64.b64decode(url.split(",", 1)[1], validate=True)
        except Exception as exc:
            raise HTTPException(
                status_code=422,
                detail="Scene contains malformed embedded image data.",
            ) from exc

    raise HTTPException(
        status_code=422,
        detail="Scene contains an unsupported asset URL.",
    )


@router.post("/{scene_id}/composite")
async def create_scene_composite(
    scene_id: str,
    user: VerifiedCanvaUser = Depends(verify_canva_user),
) -> Response:
    scene = await scene_repo.get_scene(scene_id)
    if (
        not scene
        or scene.userId != user.user_id
        or scene.brandId != user.brand_id
    ):
        raise HTTPException(status_code=404, detail="Scene not found")

    async def fetch_asset(url: str) -> bytes:
        return await _scene_asset_bytes(
            url,
            user_id=user.user_id,
            brand_id=user.brand_id,
        )

    png = await composite_scene(scene, fetch_asset)
    return Response(
        content=png,
        media_type="image/png",
        headers={"Cache-Control": "private, no-store"},
    )
