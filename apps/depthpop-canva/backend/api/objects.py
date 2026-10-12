from __future__ import annotations

import io
import time
import uuid

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Request
from PIL import Image
from pydantic import BaseModel, ConfigDict, Field

from api.scenes import _scene_asset_bytes
from auth import VerifiedCanvaUser, verify_canva_user
from models.object import (
    BBox,
    DepthObject,
    ObjectAssets,
    ObjectDepthStats,
    ObjectTransform,
    Vector3,
)
from providers.segmentation_provider import SegmentedObject
from services.object_builder import build_depth_object
from services.persistence import scene_asset_repo, scene_repo
from services.segmentation import SegmentationService

router = APIRouter(prefix="/api/v1/scenes", tags=["scene-objects"])


class ObjectEditRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str | None = Field(None, min_length=1, max_length=160)


class MergeObjectsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    objectIds: list[str] = Field(..., min_length=2, max_length=8, alias="objectIds")
    label: str | None = Field(None, min_length=1, max_length=160)


class SplitObjectRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    maxObjects: int = Field(4, ge=2, le=8, alias="maxObjects")
    segmentationMode: str = Field("auto", alias="segmentationMode")


def _updated_at() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _normalize_orders(objects: list[DepthObject]) -> list[DepthObject]:
    ordered = sorted(objects, key=lambda item: (item.order, item.id))
    return [
        item.model_copy(update={"order": index}, deep=True)
        for index, item in enumerate(ordered)
    ]


async def _owned_scene(
    scene_id: str,
    user: VerifiedCanvaUser,
):
    scene = await scene_repo.get_scene(
        scene_id,
        user_id=user.user_id,
        brand_id=user.brand_id,
    )
    if scene is None:
        raise HTTPException(status_code=404, detail="Scene not found")
    return scene


def _asset_url(request: Request, asset_id: str) -> str:
    base = str(request.base_url).rstrip("/")
    return f"{base}/api/v1/assets/{asset_id}"


def _save_scene_asset(
    request: Request,
    *,
    scene_id: str,
    user: VerifiedCanvaUser,
    data: bytes,
    mime_type: str = "image/png",
) -> str:
    stored = scene_asset_repo.save_asset_sync(
        scene_id=scene_id,
        user_id=user.user_id,
        brand_id=user.brand_id,
        data=data,
        mime_type=mime_type,
    )
    return _asset_url(request, stored.asset_id)


def _full_scene_rgba(
    payload: bytes,
    *,
    scene_width: int,
    scene_height: int,
    bbox: BBox,
) -> Image.Image:
    with Image.open(io.BytesIO(payload)) as source:
        rgba = source.convert("RGBA")
    if rgba.size == (scene_width, scene_height):
        return rgba

    width = max(1, min(scene_width, int(round(bbox.width))))
    height = max(1, min(scene_height, int(round(bbox.height))))
    if rgba.size != (width, height):
        rgba = rgba.resize((width, height), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (scene_width, scene_height), (0, 0, 0, 0))
    left = max(0, min(scene_width - 1, int(round(bbox.x))))
    top = max(0, min(scene_height - 1, int(round(bbox.y))))
    canvas.alpha_composite(rgba, dest=(left, top))
    return canvas


@router.patch("/{scene_id}/objects/{object_id}")
async def edit_object(
    scene_id: str,
    object_id: str,
    patch: ObjectEditRequest,
    user: VerifiedCanvaUser = Depends(verify_canva_user),
) -> dict:
    scene = await _owned_scene(scene_id, user)
    target = next((item for item in scene.objects if item.id == object_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail="Scene object not found")

    changes = patch.model_dump(exclude_none=True)
    if not changes:
        return scene.model_dump(mode="json", by_alias=True)

    objects = [
        item.model_copy(update=changes, deep=True) if item.id == object_id else item
        for item in scene.objects
    ]
    updated = scene.model_copy(
        update={"objects": objects, "updatedAt": _updated_at()},
        deep=True,
    )
    await scene_repo.save_scene(updated)
    return updated.model_dump(mode="json", by_alias=True)


@router.post("/{scene_id}/objects/{object_id}/duplicate")
async def duplicate_object(
    scene_id: str,
    object_id: str,
    user: VerifiedCanvaUser = Depends(verify_canva_user),
) -> dict:
    scene = await _owned_scene(scene_id, user)
    source = next((item for item in scene.objects if item.id == object_id), None)
    if source is None:
        raise HTTPException(status_code=404, detail="Scene object not found")

    new_id = f"{source.id}_copy_{uuid.uuid4().hex[:8]}"
    transform = source.transform.model_copy(
        update={
            "position": source.transform.position.model_copy(
                update={
                    "x": max(0.0, min(1.0, source.transform.position.x + 0.025)),
                    "y": max(0.0, min(1.0, source.transform.position.y + 0.025)),
                }
            )
        },
        deep=True,
    )
    tracks = [
        track.model_copy(update={"id": f"{new_id}-{index:02d}"}, deep=True)
        for index, track in enumerate(source.animationTracks, start=1)
    ]
    duplicate = source.model_copy(
        update={
            "id": new_id,
            "label": f"{source.label} Copy",
            "transform": transform,
            "animationTracks": tracks,
            "order": source.order + 1,
        },
        deep=True,
    )

    objects: list[DepthObject] = []
    for item in scene.objects:
        if item.id == source.id:
            objects.extend([item, duplicate])
        else:
            shifted = item
            if item.order > source.order:
                shifted = item.model_copy(update={"order": item.order + 1}, deep=True)
            objects.append(shifted)

    updated = scene.model_copy(
        update={"objects": _normalize_orders(objects), "updatedAt": _updated_at()},
        deep=True,
    )
    await scene_repo.save_scene(updated)
    return updated.model_dump(mode="json", by_alias=True)


@router.delete("/{scene_id}/objects/{object_id}")
async def delete_object(
    scene_id: str,
    object_id: str,
    user: VerifiedCanvaUser = Depends(verify_canva_user),
) -> dict:
    scene = await _owned_scene(scene_id, user)
    target = next((item for item in scene.objects if item.id == object_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail="Scene object not found")
    if target.locked:
        raise HTTPException(status_code=409, detail="Locked objects cannot be deleted")

    objects = [item for item in scene.objects if item.id != object_id]
    updated = scene.model_copy(
        update={"objects": _normalize_orders(objects), "updatedAt": _updated_at()},
        deep=True,
    )
    await scene_repo.save_scene(updated)
    return updated.model_dump(mode="json", by_alias=True)


@router.post("/{scene_id}/objects/merge")
async def merge_objects(
    request: Request,
    scene_id: str,
    body: MergeObjectsRequest,
    user: VerifiedCanvaUser = Depends(verify_canva_user),
) -> dict:
    scene = await _owned_scene(scene_id, user)
    requested = list(dict.fromkeys(body.objectIds))
    if len(requested) < 2:
        raise HTTPException(status_code=422, detail="Merge requires at least two unique objects")

    by_id = {item.id: item for item in scene.objects}
    missing = [item_id for item_id in requested if item_id not in by_id]
    if missing:
        raise HTTPException(status_code=404, detail="One or more scene objects were not found")

    selected = [by_id[item_id] for item_id in requested]
    if any(item.locked for item in selected):
        raise HTTPException(status_code=409, detail="Locked objects cannot be merged")

    combined = Image.new("RGBA", (scene.width, scene.height), (0, 0, 0, 0))
    for item in sorted(selected, key=lambda entry: entry.order):
        raw = await _scene_asset_bytes(
            item.assets.cutoutUrl,
            user_id=user.user_id,
            brand_id=user.brand_id,
        )
        combined.alpha_composite(
            _full_scene_rgba(
                raw,
                scene_width=scene.width,
                scene_height=scene.height,
                bbox=item.bbox,
            )
        )

    alpha = combined.getchannel("A")
    alpha_box = alpha.getbbox()
    if alpha_box is None:
        raise HTTPException(status_code=422, detail="Merged objects contain no visible pixels")
    left, top, right, bottom = alpha_box
    bbox = BBox(
        x=float(left),
        y=float(top),
        width=float(max(1, right - left)),
        height=float(max(1, bottom - top)),
    )

    cutout_io = io.BytesIO()
    combined.save(cutout_io, format="PNG", optimize=True)
    cutout_url = _save_scene_asset(
        request,
        scene_id=scene.id,
        user=user,
        data=cutout_io.getvalue(),
    )

    mask_image = alpha.point(lambda value: 255 if value > 0 else 0)
    mask_io = io.BytesIO()
    mask_image.save(mask_io, format="PNG", optimize=True)
    mask_url = _save_scene_asset(
        request,
        scene_id=scene.id,
        user=user,
        data=mask_io.getvalue(),
    )

    thumb = combined.crop(alpha_box)
    thumb.thumbnail((128, 128), Image.Resampling.LANCZOS)
    thumb_io = io.BytesIO()
    thumb.save(thumb_io, format="PNG", optimize=True)
    thumbnail_url = _save_scene_asset(
        request,
        scene_id=scene.id,
        user=user,
        data=thumb_io.getvalue(),
    )

    weights = [max(1.0, item.bbox.width * item.bbox.height) for item in selected]
    total_weight = sum(weights)
    weighted = lambda attr: sum(
        float(getattr(item.depth, attr)) * weight
        for item, weight in zip(selected, weights)
    ) / total_weight
    confidence = sum(
        float(item.confidence) * weight
        for item, weight in zip(selected, weights)
    ) / total_weight
    z_value = sum(
        float(item.transform.position.z) * weight
        for item, weight in zip(selected, weights)
    ) / total_weight

    semantic_types = {item.semanticType for item in selected}
    extraction = (
        "mask"
        if all(item.extractionQuality == "mask" for item in selected)
        else "bbox_fallback"
    )
    merged_id = f"merged_{uuid.uuid4().hex[:10]}"
    merged = DepthObject(
        id=merged_id,
        label=body.label or "Merged Object",
        semanticType=selected[0].semanticType if len(semantic_types) == 1 else "unknown",
        extractionQuality=extraction,
        confidence=max(0.0, min(1.0, confidence)),
        bbox=bbox,
        assets=ObjectAssets(
            cutoutUrl=cutout_url,
            maskUrl=mask_url,
            thumbnailUrl=thumbnail_url,
        ),
        depth=ObjectDepthStats(
            mean=max(0.0, min(1.0, weighted("mean"))),
            median=max(0.0, min(1.0, weighted("median"))),
            min=min(item.depth.min for item in selected),
            max=max(item.depth.max for item in selected),
        ),
        transform=ObjectTransform(
            position=Vector3(
                x=((bbox.x + bbox.width / 2.0) / scene.width),
                y=((bbox.y + bbox.height / 2.0) / scene.height),
                z=z_value,
            ),
            rotation=Vector3(x=0.0, y=0.0, z=0.0),
            scale=Vector3(x=1.0, y=1.0, z=1.0),
        ),
        opacity=1.0,
        feather=0.0,
        visible=True,
        locked=False,
        order=min(item.order for item in selected),
        animationTracks=[],
    )

    selected_ids = set(requested)
    remaining = [item for item in scene.objects if item.id not in selected_ids]
    remaining.append(merged)
    updated = scene.model_copy(
        update={"objects": _normalize_orders(remaining), "updatedAt": _updated_at()},
        deep=True,
    )
    await scene_repo.save_scene(updated)
    return updated.model_dump(mode="json", by_alias=True)


@router.post("/{scene_id}/objects/{object_id}/split")
async def split_object(
    request: Request,
    scene_id: str,
    object_id: str,
    body: SplitObjectRequest,
    user: VerifiedCanvaUser = Depends(verify_canva_user),
) -> dict:
    scene = await _owned_scene(scene_id, user)
    target = next((item for item in scene.objects if item.id == object_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail="Scene object not found")
    if target.locked:
        raise HTTPException(status_code=409, detail="Locked objects cannot be split")

    source = await scene_asset_repo.get_asset(
        scene.sourceAssetId,
        user_id=user.user_id,
        brand_id=user.brand_id,
    )
    if source is None:
        raise HTTPException(status_code=410, detail="Original scene source asset is unavailable")

    with Image.open(io.BytesIO(source.data)) as image:
        rgba = image.convert("RGBA")
        left = max(0, min(scene.width - 1, int(round(target.bbox.x))))
        top = max(0, min(scene.height - 1, int(round(target.bbox.y))))
        right = max(left + 1, min(scene.width, int(round(target.bbox.x + target.bbox.width))))
        bottom = max(top + 1, min(scene.height, int(round(target.bbox.y + target.bbox.height))))
        crop = rgba.crop((left, top, right, bottom))
        crop_io = io.BytesIO()
        crop.save(crop_io, format="PNG", optimize=True)

    segments = await SegmentationService().segment_objects(
        crop_io.getvalue(),
        max_objects=body.maxObjects,
        mode=body.segmentationMode,
    )
    if len(segments) < 2:
        raise HTTPException(
            status_code=422,
            detail="Segmentation did not produce multiple objects for this region",
        )

    depth_bytes = await _scene_asset_bytes(
        scene.reconstructedPlate.depthMapUrl,
        user_id=user.user_id,
        brand_id=user.brand_id,
    )
    try:
        with Image.open(io.BytesIO(depth_bytes)) as depth_image:
            depth_array = np.asarray(
                depth_image.convert("L").resize(
                    (scene.width, scene.height),
                    Image.Resampling.BILINEAR,
                ),
                dtype=np.float32,
            ) / 255.0
    except Exception as exc:
        raise HTTPException(status_code=422, detail="Scene depth map is unavailable") from exc

    def build_url(data: bytes, mime_type: str) -> str:
        return _save_scene_asset(
            request,
            scene_id=scene.id,
            user=user,
            data=data,
            mime_type=mime_type,
        )

    existing_ids = {item.id for item in scene.objects if item.id != object_id}
    split_objects: list[DepthObject] = []
    for index, segment in enumerate(segments, start=1):
        local_mask = np.asarray(segment.mask_array, dtype=bool)
        full_mask = np.zeros((scene.height, scene.width), dtype=bool)
        crop_height = bottom - top
        crop_width = right - left
        if local_mask.shape != (crop_height, crop_width):
            local_mask = np.asarray(
                Image.fromarray((local_mask * 255).astype(np.uint8), mode="L").resize(
                    (crop_width, crop_height),
                    Image.Resampling.NEAREST,
                )
            ) > 127
        full_mask[top:bottom, left:right] = local_mask
        adjusted = SegmentedObject(
            id=f"{target.id}_split_{index:02d}",
            label=segment.label,
            semantic_type=segment.semantic_type,
            extraction_quality=segment.extraction_quality,
            confidence=segment.confidence,
            bbox=BBox(
                x=float(left + segment.bbox.x),
                y=float(top + segment.bbox.y),
                width=segment.bbox.width,
                height=segment.bbox.height,
            ),
            mask_bytes=segment.mask_bytes,
            mask_array=full_mask,
        )
        built = build_depth_object(
            adjusted,
            source.data,
            depth_array,
            build_url,
            index=index,
            depth_strength=scene.settings.depthStrength,
            depth_fidelity=scene.settings.depthFidelity,
        )
        candidate = built.id
        while candidate in existing_ids:
            candidate = f"{built.id}_{uuid.uuid4().hex[:6]}"
        existing_ids.add(candidate)
        split_objects.append(built.model_copy(update={"id": candidate}, deep=True))

    ordered = sorted(scene.objects, key=lambda item: item.order)
    replacement: list[DepthObject] = []
    for item in ordered:
        if item.id == object_id:
            replacement.extend(split_objects)
        else:
            replacement.append(item)

    updated = scene.model_copy(
        update={"objects": _normalize_orders(replacement), "updatedAt": _updated_at()},
        deep=True,
    )
    await scene_repo.save_scene(updated)
    return updated.model_dump(mode="json", by_alias=True)
