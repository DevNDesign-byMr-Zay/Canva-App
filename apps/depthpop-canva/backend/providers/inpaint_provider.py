from __future__ import annotations

import asyncio
import base64
import io
import os
from typing import Any, Protocol

import fal_client
import numpy as np
from fastapi import HTTPException
from PIL import Image, ImageFilter

from providers.media import fetch_fal_media

INPAINT_MODEL = "fal-ai/inpaint"
DEFAULT_BASE_MODEL = "diffusers/stable-diffusion-xl-1.0-inpainting-0.1"
DEFAULT_PROMPT = (
    "clean natural background continuation matching the surrounding image; "
    "remove the masked foreground object; preserve scene lighting, texture, "
    "perspective, and style; no new text, logos, people, or products"
)


class InpaintProvider(Protocol):
    async def inpaint(self, image: bytes, mask: bytes) -> bytes: ...


def _png_data_url(raw: bytes) -> str:
    return "data:image/png;base64," + base64.b64encode(raw).decode("ascii")


def _validated_png(raw: bytes, *, target_size: tuple[int, int]) -> bytes:
    try:
        with Image.open(io.BytesIO(raw)) as image:
            rgba = image.convert("RGBA")
            if rgba.size != target_size:
                rgba = rgba.resize(target_size, Image.Resampling.LANCZOS)
            buffer = io.BytesIO()
            rgba.save(buffer, format="PNG", optimize=True)
            return buffer.getvalue()
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Inpainting provider returned an invalid raster.",
        ) from exc


def _extract_output_url(payload: Any) -> str | None:
    if isinstance(payload, dict):
        image = payload.get("image")
        if isinstance(image, dict) and isinstance(image.get("url"), str):
            return image["url"]
        data = payload.get("data")
        if isinstance(data, dict):
            found = _extract_output_url(data)
            if found:
                return found
    return None


class FalInpaintProvider:
    """Production FAL inpainting adapter.

    FAL's current inpaint contract uses white mask pixels for areas to
    regenerate and black pixels for areas to preserve.
    """

    def __init__(
        self,
        fal_key: str | None = None,
        *,
        base_model: str | None = None,
        prompt: str | None = None,
    ):
        self.fal_key = fal_key or os.getenv("FAL_KEY", "").strip()
        self.base_model = (
            base_model
            or os.getenv("DEPTHPOP_INPAINT_MODEL", "").strip()
            or DEFAULT_BASE_MODEL
        )
        self.prompt = (
            prompt
            or os.getenv("DEPTHPOP_INPAINT_PROMPT", "").strip()
            or DEFAULT_PROMPT
        )

    async def inpaint(self, image: bytes, mask: bytes) -> bytes:
        if not self.fal_key:
            raise HTTPException(
                status_code=503,
                detail="Production background reconstruction requires FAL_KEY.",
            )

        try:
            with Image.open(io.BytesIO(image)) as source:
                source_rgb = source.convert("RGB")
                target_size = source_rgb.size
                source_buffer = io.BytesIO()
                source_rgb.save(source_buffer, format="PNG", optimize=True)

            with Image.open(io.BytesIO(mask)) as mask_image:
                mask_l = mask_image.convert("L").resize(
                    target_size,
                    Image.Resampling.NEAREST,
                )
                mask_buffer = io.BytesIO()
                mask_l.save(mask_buffer, format="PNG", optimize=True)
        except Exception as exc:
            raise HTTPException(
                status_code=422,
                detail="Background reconstruction received an invalid image or mask.",
            ) from exc

        try:
            result = await asyncio.to_thread(
                fal_client.run,
                INPAINT_MODEL,
                arguments={
                    "model_name": self.base_model,
                    "prompt": self.prompt,
                    "negative_prompt": (
                        "new foreground objects, text, logos, duplicate people, "
                        "watermarks, artifacts, distortion"
                    ),
                    "image_url": _png_data_url(source_buffer.getvalue()),
                    "mask_url": _png_data_url(mask_buffer.getvalue()),
                    "num_inference_steps": 30,
                    "guidance_scale": 7.5,
                },
            )
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail="Background reconstruction provider failed.",
            ) from exc

        output_url = (_extract_output_url(result) or "").strip()
        if not output_url:
            raise HTTPException(
                status_code=502,
                detail="Background reconstruction returned no image URL.",
            )

        output = await fetch_fal_media(output_url)
        return _validated_png(output, target_size=target_size)


class MockInpaintProvider:
    """Deterministic blur-based inpainting for tests/explicit local dev only."""

    async def inpaint(self, image: bytes, mask: bytes) -> bytes:
        environment = os.getenv("ENVIRONMENT", "").lower()
        mode = os.getenv("INPAINT_PROVIDER", "").lower()
        is_test = environment == "test" or "PYTEST_CURRENT_TEST" in os.environ
        if environment == "production":
            raise HTTPException(
                status_code=503,
                detail="Mock inpainting is disabled in production.",
            )
        if not is_test and mode != "mock":
            raise HTTPException(
                status_code=503,
                detail="Mock inpainting requires INPAINT_PROVIDER=mock.",
            )

        with Image.open(io.BytesIO(image)) as source, Image.open(
            io.BytesIO(mask)
        ) as mask_image:
            source_rgb = source.convert("RGB")
            mask_l = mask_image.convert("L").resize(
                source_rgb.size,
                Image.Resampling.NEAREST,
            )

        blurred = source_rgb.filter(ImageFilter.GaussianBlur(radius=12.0))
        source_array = np.asarray(source_rgb, dtype=np.float32)
        blurred_array = np.asarray(blurred, dtype=np.float32)
        mask_array = (
            np.asarray(mask_l, dtype=np.float32) / 255.0
        )[..., None]

        result = (
            source_array * (1.0 - mask_array)
            + blurred_array * mask_array
        )
        output = Image.fromarray(
            np.clip(result, 0, 255).astype(np.uint8),
            mode="RGB",
        )
        buffer = io.BytesIO()
        output.save(buffer, format="PNG")
        return buffer.getvalue()
