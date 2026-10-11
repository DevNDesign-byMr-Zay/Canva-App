from __future__ import annotations

import io
from typing import Callable

import numpy as np
from fastapi import HTTPException
from PIL import Image

from models.object import (
    DepthObject,
    ObjectAssets,
    ObjectDepthStats,
    ObjectTransform,
    Vector3,
)
from providers.segmentation_provider import SegmentedObject


def build_depth_object(
    seg_obj: SegmentedObject,
    source_image: bytes,
    depth_array: np.ndarray,
    url_builder: Callable[[bytes, str], str],
    index: int = 1,
    depth_strength: float = 0.32,
    depth_fidelity: float = 0.95,
) -> DepthObject:
    """Build one editable object using canonical DepthPop depth.

    Canonical depth is always 0.0=far and 1.0=near.
    """

    with Image.open(io.BytesIO(source_image)) as image:
        source_rgba = image.convert("RGBA")
        width, height = source_rgba.size

    if depth_array.shape != (height, width):
        raise HTTPException(
            status_code=502,
            detail=(
                "Depth provider returned a canonical map whose dimensions "
                "do not match the source image."
            ),
        )

    if seg_obj.mask_array is not None:
        mask_array = np.asarray(seg_obj.mask_array, dtype=bool)
    else:
        with Image.open(io.BytesIO(seg_obj.mask_bytes)) as mask_image:
            mask_array = (
                np.asarray(
                    mask_image.convert("L").resize(
                        (width, height),
                        Image.Resampling.NEAREST,
                    )
                )
                > 127
            )

    if mask_array.shape != (height, width):
        mask_image = Image.fromarray(
            (mask_array * 255).astype(np.uint8),
            mode="L",
        ).resize((width, height), Image.Resampling.NEAREST)
        mask_array = np.asarray(mask_image) > 127

    source_array = np.asarray(source_rgba)
    cutout_array = source_array.copy()
    cutout_array[:, :, 3] = np.where(
        mask_array,
        source_array[:, :, 3],
        0,
    )
    cutout_image = Image.fromarray(cutout_array, mode="RGBA")
    cutout_buffer = io.BytesIO()
    cutout_image.save(cutout_buffer, format="PNG")
    cutout_url = url_builder(cutout_buffer.getvalue(), "image/png")

    mask_image = Image.fromarray(
        (mask_array * 255).astype(np.uint8),
        mode="L",
    )
    mask_buffer = io.BytesIO()
    mask_image.save(mask_buffer, format="PNG")
    mask_url = url_builder(mask_buffer.getvalue(), "image/png")

    box_x = max(0, min(int(seg_obj.bbox.x), width - 1))
    box_y = max(0, min(int(seg_obj.bbox.y), height - 1))
    box_width = max(
        1,
        min(int(round(seg_obj.bbox.width)), width - box_x),
    )
    box_height = max(
        1,
        min(int(round(seg_obj.bbox.height)), height - box_y),
    )
    thumbnail = cutout_image.crop(
        (
            box_x,
            box_y,
            box_x + box_width,
            box_y + box_height,
        )
    )
    thumbnail.thumbnail((128, 128), Image.Resampling.LANCZOS)
    thumbnail_buffer = io.BytesIO()
    thumbnail.save(thumbnail_buffer, format="PNG")
    thumbnail_url = url_builder(
        thumbnail_buffer.getvalue(),
        "image/png",
    )

    canonical_values = np.clip(
        depth_array[mask_array],
        0.0,
        1.0,
    )
    if canonical_values.size:
        depth_mean = float(np.mean(canonical_values))
        depth_median = float(np.median(canonical_values))
        depth_min = float(np.min(canonical_values))
        depth_max = float(np.max(canonical_values))
    else:
        depth_mean = depth_median = depth_min = depth_max = 0.5

    slug = (
        "".join(
            char if char.isalnum() else "_"
            for char in seg_obj.label.lower()
        ).strip("_")
        or "object"
    )
    object_id = f"{slug}_{index:02d}"

    center_x = (
        seg_obj.bbox.x + seg_obj.bbox.width / 2.0
    ) / width
    center_y = (
        seg_obj.bbox.y + seg_obj.bbox.height / 2.0
    ) / height
    # Measured provider depth stays immutable; controls author only transform Z.
    strength_scale = max(0.05, min(0.75, depth_strength)) / 0.32
    fidelity_scale = max(0.05, min(1.0, depth_fidelity)) / 0.95
    z_position = (depth_median - 0.5) * 4.0 * strength_scale * fidelity_scale

    return DepthObject(
        id=object_id,
        label=seg_obj.label,
        semanticType=seg_obj.semantic_type,
        extractionQuality=seg_obj.extraction_quality,
        confidence=seg_obj.confidence,
        bbox=seg_obj.bbox,
        assets=ObjectAssets(
            cutoutUrl=cutout_url,
            maskUrl=mask_url,
            thumbnailUrl=thumbnail_url,
        ),
        depth=ObjectDepthStats(
            mean=round(depth_mean, 4),
            median=round(depth_median, 4),
            min=round(depth_min, 4),
            max=round(depth_max, 4),
        ),
        transform=ObjectTransform(
            position=Vector3(
                x=round(center_x, 4),
                y=round(center_y, 4),
                z=round(z_position, 4),
            ),
            rotation=Vector3(x=0.0, y=0.0, z=0.0),
            scale=Vector3(x=1.0, y=1.0, z=1.0),
        ),
        opacity=1.0,
        feather=0.0,
        visible=True,
        locked=False,
        order=0,
        animationTracks=[],
    )
