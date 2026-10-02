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


def _alpha_composite_clipped(
    canvas: Image.Image,
    overlay: Image.Image,
    *,
    left: int,
    top: int,
) -> None:
    """Composite an RGBA overlay even when it extends beyond the viewport."""

    source_left = max(0, -left)
    source_top = max(0, -top)
    destination_left = max(0, left)
    destination_top = max(0, top)

    width = min(
        overlay.width - source_left,
        canvas.width - destination_left,
    )
    height = min(
        overlay.height - source_top,
        canvas.height - destination_top,
    )
    if width <= 0 or height <= 0:
        return

    clipped = overlay.crop(
        (
            source_left,
            source_top,
            source_left + width,
            source_top + height,
        )
    )
    canvas.alpha_composite(
        clipped,
        dest=(destination_left, destination_top),
    )


def _apply_camera_view(canvas: Image.Image, scene: DepthScene) -> Image.Image:
    """Apply authored camera X/Y and FOV to the final raster viewport."""

    fov = max(1.0, min(179.0, float(scene.camera.fov)))
    scale = max(0.55, min(2.2, 50.0 / fov))
    offset_x = float(scene.camera.position.x)
    offset_y = float(scene.camera.position.y)

    if (
        abs(scale - 1.0) < 1e-9
        and abs(offset_x) < 1e-9
        and abs(offset_y) < 1e-9
    ):
        return canvas

    scaled_width = max(1, int(round(canvas.width * scale)))
    scaled_height = max(1, int(round(canvas.height * scale)))
    scaled = canvas.resize(
        (scaled_width, scaled_height),
        Image.Resampling.LANCZOS,
    )

    viewport = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    left = int(round((canvas.width - scaled_width) / 2.0 + offset_x))
    top = int(round((canvas.height - scaled_height) / 2.0 + offset_y))
    _alpha_composite_clipped(
        viewport,
        scaled,
        left=left,
        top=top,
    )
    return viewport


async def composite_scene(
    scene: DepthScene,
    asset_fetcher: Callable[[str], Awaitable[bytes]],
) -> bytes:
    """Flatten an authored DepthScene into one deterministic PNG.

    Static v1 compositing uses object X/Y, scale, Z rotation, opacity, feather,
    visibility and explicit layer order, then applies authored camera X/Y and
    field of view to the finished frame. Object Z remains scene/parallax
    metadata; the raster export does not invent an unsupported perspective
    projection.
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

        _alpha_composite_clipped(
            canvas,
            rendered,
            left=left,
            top=top,
        )

    canvas = _apply_camera_view(canvas, scene)

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
