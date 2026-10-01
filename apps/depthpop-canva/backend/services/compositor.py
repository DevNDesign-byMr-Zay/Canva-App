from __future__ import annotations

import io
from typing import Awaitable, Callable
import numpy as np
from PIL import Image, ImageFilter
from models.scene import DepthScene


async def composite_scene(
    scene: DepthScene,
    asset_fetcher: Callable[[str], Awaitable[bytes]],
) -> bytes:
    """Render a flattened PNG composition of an edited DepthScene for Canva export.

    Composites:
      reconstructedPlate (background)
      + visible DepthObjects (in layer order)
      + transform position X/Y/Z
      + scale, rotation, opacity, feather
    """
    width, height = scene.width, scene.height

    # 1. Base Plate
    plate_bytes = await asset_fetcher(scene.reconstructedPlate.imageUrl)
    with Image.open(io.BytesIO(plate_bytes)) as plate_img:
        canvas = plate_img.convert("RGBA").resize((width, height), Image.Resampling.BILINEAR)

    # 2. Sort Objects by Layer Order
    sorted_objects = sorted(scene.objects, key=lambda o: o.order)

    for obj in sorted_objects:
        if not obj.visible:
            continue

        try:
            cutout_bytes = await asset_fetcher(obj.assets.cutoutUrl)
            with Image.open(io.BytesIO(cutout_bytes)) as cutout_img:
                cutout_rgba = cutout_img.convert("RGBA")

                # Apply Feather
                if obj.feather > 0:
                    alpha = cutout_rgba.split()[3]
                    blurred_alpha = alpha.filter(ImageFilter.GaussianBlur(radius=obj.feather))
                    cutout_rgba.putalpha(blurred_alpha)

                # Apply Opacity
                if obj.opacity < 1.0:
                    r, g, b, a = cutout_rgba.split()
                    a_np = (np.array(a, dtype=np.float32) * obj.opacity).astype(np.uint8)
                    cutout_rgba.putalpha(Image.fromarray(a_np))

                # Apply Scale and Rotation
                scale_x = max(0.05, float(obj.transform.scale.x))
                scale_y = max(0.05, float(obj.transform.scale.y))
                rot_z = float(obj.transform.rotation.z)

                target_w = max(1, int(obj.bbox.width * scale_x))
                target_h = max(1, int(obj.bbox.height * scale_y))

                scaled = cutout_rgba.resize((target_w, target_h), Image.Resampling.BILINEAR)

                if rot_z != 0:
                    scaled = scaled.rotate(-rot_z, expand=True, resample=Image.Resampling.BILINEAR)

                # Position X/Y Placement (source center + offset)
                obj_cx = obj.transform.position.x * width
                obj_cy = obj.transform.position.y * height

                pos_x = int(obj_cx - scaled.width / 2.0)
                pos_y = int(obj_cy - scaled.height / 2.0)

                canvas.alpha_composite(scaled, (pos_x, pos_y))
        except Exception:
            pass

    out_buf = io.BytesIO()
    canvas.save(out_buf, format="PNG", optimize=True)
    return out_buf.getvalue()
