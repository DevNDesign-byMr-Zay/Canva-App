from __future__ import annotations

import io
from typing import Protocol
import numpy as np
from PIL import Image, ImageFilter


class InpaintProvider(Protocol):
    async def inpaint(self, image: bytes, mask: bytes) -> bytes: ...


class MockInpaintProvider:
    """Inpainting provider using edge-preserving diffusion / box blur expansion."""

    async def inpaint(self, image: bytes, mask: bytes) -> bytes:
        with Image.open(io.BytesIO(image)) as img, Image.open(io.BytesIO(mask)) as msk:
            img_rgb = img.convert("RGB")
            mask_l = msk.convert("L").resize(img_rgb.size, Image.Resampling.NEAREST)

        # Inpaint: blur the image where mask is positive to fill background hole
        blurred = img_rgb.filter(ImageFilter.GaussianBlur(radius=12.0))
        img_np = np.array(img_rgb, dtype=np.float32)
        blur_np = np.array(blurred, dtype=np.float32)
        mask_np = (np.array(mask_l, dtype=np.float32) / 255.0)[..., None]

        # Blend original with blurred background under mask
        inpainted_np = img_np * (1.0 - mask_np) + blur_np * mask_np
        inpainted_img = Image.fromarray(np.clip(inpainted_np, 0, 255).astype(np.uint8), mode="RGB")

        buf = io.BytesIO()
        inpainted_img.save(buf, format="PNG")
        return buf.getvalue()
