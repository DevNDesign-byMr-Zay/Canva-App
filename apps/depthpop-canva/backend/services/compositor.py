from __future__ import annotations

import io
from typing import Awaitable, Callable

import numpy as np
from fastapi import HTTPException
from PIL import Image, ImageFilter

from models.scene import DepthScene

MAX_COMPOSITE_PIXELS = 16_777_216
MAX_COMPOSITE_BYTES = 50 * 1024 * 1024


def _bounded_bbox(
    scene_width: int,
    scene_height: int,
    *,
    x: float,
    y: float,
    width: float,
    height: float,
) -> tuple[int, int, int, int]:
    left = max(0, min(scene_width - 1, int(round(x))))
    top = max(0, min(scene_height - 1, int(round(y))))
    right = max(left + 1, min(scene_width, int(round(x + width))))
    bottom = max(top + 1, min(scene_height, int(round(y + height))))
    return left, top, right, bottom


def _object_crop(
    cutout: Image.Image,
    scene: DepthScene,
    obj,
) -> Image.Image:
    rgba = cutout.convert("RGBA")
    bbox = _bounded_bbox(
        scene.width,
        scene.height,
        x=obj.bbox.x,
        y=obj.bbox.y,
        width=obj.bbox.width,
        height=obj.bbox.height,
    )
    bbox_width = bbox[2] - bbox[0]
    bbox_height = bbox[3] - bbox[1]

    if rgba.size == (scene.width, scene.height):
        return rgba.crop(bbox)

    # Some future provider adapters may emit already-cropped cutouts.
    if rgba.size == (bbox_width, bbox_height):
        return rgba

    return rgba.resize(
        (bbox_width, bbox_height),
        Image.Resampling.LANCZOS,
    )


def _apply_object_style(image: Image.Image, obj) -> Image.Image:
    styled = image

    if obj.feather > 0:
        alpha = styled.getchannel("A")
        alpha = alpha.filter(
            ImageFilter.GaussianBlur(radius=min(float(obj.feather), 100.0))
        )
        styled = styled.copy()
        styled.putalpha(alpha)

    if obj.opacity < 1.0:
        alpha = np.asarray(styled.getchannel("A"), dtype=np.float32)
        alpha = np.clip(alpha * float(obj.opacity), 0, 255).astype(np.uint8)
        styled = styled.copy()
        styled.putalpha(Image.fromarray(alpha, mode="L"))

    scale_x = max(0.01, min(10.0, float(obj.transform.scale.x)))
    scale_y = max(0.01, min(10.0, float(obj.transform.scale.y)))
    target_width = max(1, int(round(styled.width * scale_x)))
    target_height = max(1, int(round(styled.height * scale_y)))
    if target_width * target_height > MAX_COMPOSITE_PIXELS:
        raise HTTPException(
            status_code=422,
            detail=f"Object '{obj.id}' scale exceeds the compositor pixel budget.",
        )

    if (target_width, target_height) != styled.size:
        styled = styled.resize(
            (target_width, target_height),
            Image.Resampling.LANCZOS,
        )

    rotation_z = float(obj.transform.rotation.z)
    if rotation_z:
        # CSS positive rotation is clockwise in screen coordinates, while PIL
        # positive rotation is counter-clockwise.
        styled = styled.rotate(
            -rotation_z,
            expand=True,
            resample=Image.Resampling.BICUBIC,
        )

    return styled


async def composite_scene(
    scene: DepthScene,
    asset_fetcher: Callable[[str], Awaitable[bytes]],
) -> bytes:
    """Flatten an authored DepthScene into one deterministic PNG.

    Static v1 compositing uses X/Y, scale, Z rotation, opacity, feather,
    visibility and explicit layer order. Z remains scene/parallax metadata; it
    does not invent a perspective projection for the flattened export.
    """

    if scene.width * scene.height > MAX_COMPOSITE_PIXELS:
        raise HTTPException(
            status_code=422,
            detail="DepthScene exceeds the compositor pixel budget.",
        )

    plate_bytes = await asset_fetcher(scene.reconstructedPlate.imageUrl)
    try:
        with Image.open(io.BytesIO(plate_bytes)) as plate:
            canvas = plate.convert("RGBA").resize(
                (scene.width, scene.height),
                Image.Resampling.LANCZOS,
            )
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail="DepthScene background plate is not a valid raster image.",
        ) from exc

    for obj in sorted(scene.objects, key=lambda item: item.order):
        if not obj.visible:
            continue

        cutout_bytes = await asset_fetcher(obj.assets.cutoutUrl)
        try:
            with Image.open(io.BytesIO(cutout_bytes)) as source:
                crop = _object_crop(source, scene, obj)
                rendered = _apply_object_style(crop, obj)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=422,
                detail=f"DepthScene object '{obj.id}' has an invalid cutout.",
            ) from exc

        center_x = float(obj.transform.position.x) * scene.width
        center_y = float(obj.transform.position.y) * scene.height
        left = int(round(center_x - rendered.width / 2.0))
        top = int(round(center_y - rendered.height / 2.0))

        canvas.alpha_composite(rendered, dest=(left, top))

    output = io.BytesIO()
    canvas.save(output, format="PNG", optimize=True)
    payload = output.getvalue()
    if not payload.startswith(b"\x89PNG\r\n\x1a\n"):
        raise HTTPException(status_code=500, detail="Compositor did not emit PNG data.")
    if len(payload) > MAX_COMPOSITE_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Rendered DepthScene exceeds the 50 MB output limit.",
        )
    return payload
