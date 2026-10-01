from __future__ import annotations

import io
from typing import Awaitable, Callable
import numpy as np
from PIL import Image
from models.object import (
    BBox,
    DepthObject,
    ObjectAssets,
    ObjectDepthStats,
    ObjectTransform,
    SemanticType,
    Vector3,
)
from providers.segmentation_provider import SegmentedObject

AsyncUrlBuilder = Callable[[bytes, str], Awaitable[str]]


async def build_depth_object(
    seg_obj: SegmentedObject,
    source_image: bytes,
    canonical_depth_array: np.ndarray,
    url_builder: AsyncUrlBuilder,
    index: int = 1,
) -> DepthObject:
    """Build a DepthObject with cutout, mask, thumbnail, canonical depth stats, and Z transform.

    Canonical DepthPop depth convention:
      0.0 = far (background)
      1.0 = near (foreground)
    """
    with Image.open(io.BytesIO(source_image)) as img:
        img_rgba = img.convert("RGBA")
        width, height = img_rgba.size

    if seg_obj.mask_array is not None:
        mask_arr = seg_obj.mask_array
    else:
        with Image.open(io.BytesIO(seg_obj.mask_bytes)) as m_img:
            mask_arr = np.array(m_img.convert("L")) > 128

    if mask_arr.shape != (height, width):
        m_pil = Image.fromarray((mask_arr * 255).astype(np.uint8), mode="L").resize(
            (width, height), Image.Resampling.NEAREST
        )
        mask_arr = np.array(m_pil) > 128

    # 1. Cutout PNG
    src_np = np.array(img_rgba)
    cutout_np = src_np.copy()
    cutout_np[:, :, 3] = np.where(mask_arr, src_np[:, :, 3], 0)
    cutout_img = Image.fromarray(cutout_np, mode="RGBA")

    cutout_buf = io.BytesIO()
    cutout_img.save(cutout_buf, format="PNG")
    cutout_bytes = cutout_buf.getvalue()
    cutout_url = await url_builder(cutout_bytes, "image/png")

    # 2. Mask Image PNG
    mask_img = Image.fromarray((mask_arr * 255).astype(np.uint8), mode="L")
    mask_buf = io.BytesIO()
    mask_img.save(mask_buf, format="PNG")
    mask_bytes = mask_buf.getvalue()
    mask_url = await url_builder(mask_bytes, "image/png")

    # 3. Thumbnail Image PNG
    bx = max(0, min(int(seg_obj.bbox.x), width - 1))
    by = max(0, min(int(seg_obj.bbox.y), height - 1))
    bw = max(1, min(int(seg_obj.bbox.width), width - bx))
    bh = max(1, min(int(seg_obj.bbox.height), height - by))

    crop_box = (bx, by, bx + bw, by + bh)
    thumb_crop = cutout_img.crop(crop_box)
    thumb_crop.thumbnail((128, 128))
    thumb_buf = io.BytesIO()
    thumb_crop.save(thumb_buf, format="PNG")
    thumb_bytes = thumb_buf.getvalue()
    thumb_url = await url_builder(thumb_bytes, "image/png")

    # 4. Canonical Depth Statistics (0.0 far, 1.0 near)
    object_depth_vals = np.clip(canonical_depth_array[mask_arr], 0.0, 1.0)
    if len(object_depth_vals) > 0:
        d_mean = float(np.mean(object_depth_vals))
        d_median = float(np.median(object_depth_vals))
        d_min = float(np.min(object_depth_vals))
        d_max = float(np.max(object_depth_vals))
    else:
        d_mean = d_median = d_min = d_max = 0.5

    slug = seg_obj.label.lower().replace(" ", "_").strip() or "object"
    obj_id = f"{slug}_{index:02d}"

    cx_norm = (seg_obj.bbox.x + seg_obj.bbox.width / 2.0) / width
    cy_norm = (seg_obj.bbox.y + seg_obj.bbox.height / 2.0) / height
    z_pos = (d_median - 0.5) * 4.0

    return DepthObject(
        id=obj_id,
        label=seg_obj.label,
        semanticType=seg_obj.semantic_type,
        confidence=seg_obj.confidence,
        bbox=seg_obj.bbox,
        assets=ObjectAssets(
            cutoutUrl=cutout_url,
            maskUrl=mask_url,
            thumbnailUrl=thumb_url,
        ),
        depth=ObjectDepthStats(
            mean=round(d_mean, 4),
            median=round(d_median, 4),
            min=round(d_min, 4),
            max=round(d_max, 4),
        ),
        transform=ObjectTransform(
            position=Vector3(x=round(cx_norm, 4), y=round(cy_norm, 4), z=round(z_pos, 4)),
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
