from __future__ import annotations

import asyncio
import base64
import io
import os
from typing import Any, Literal, Protocol

import fal_client
import numpy as np
from fastapi import HTTPException
from PIL import Image
from pydantic import BaseModel, ConfigDict

from providers.media import fetch_fal_media

DEPTH_MODEL = "fal-ai/image-preprocessors/depth-anything/v2"
DepthQuality = Literal["standard", "high"]

# FAL exposes the Depth Anything V2 grayscale preprocessor output. The
# upstream Depth Anything V2 demo describes the raw model output as disparity
# and normalizes it directly into the grayscale image: larger/brighter values
# therefore represent larger disparity / nearer content.
CANONICAL_POLARITY = "disparity_high_is_near"
QUALITY_MAX_EDGE: dict[DepthQuality, int] = {
    "standard": 768,
    "high": 1536,
}


class DepthMap(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    raw_depth: bytes
    canonical_depth: bytes
    raw_depth_array: np.ndarray
    depth_array: np.ndarray
    provider_url: str = ""
    polarity: str = CANONICAL_POLARITY
    quality: DepthQuality = "high"


class DepthProvider(Protocol):
    async def estimate(
        self,
        image: bytes,
        quality: DepthQuality = "high",
    ) -> DepthMap: ...


def _detect_image_mime(image_bytes: bytes) -> str:
    """Return the actual supported raster MIME for compatibility/tests."""

    try:
        with Image.open(io.BytesIO(image_bytes)) as image:
            fmt = (image.format or "").upper()
    except Exception:
        return "image/png"

    if fmt == "PNG":
        return "image/png"
    if fmt in {"JPEG", "JPG"}:
        return "image/jpeg"
    if fmt == "WEBP":
        return "image/webp"
    return "image/png"


def _resize_within(image: Image.Image, max_edge: int) -> Image.Image:
    result = image.copy()
    if max(result.size) > max_edge:
        result.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
    return result


def prepare_depth_input(
    image_bytes: bytes,
    quality: DepthQuality,
) -> tuple[bytes, tuple[int, int], tuple[int, int]]:
    if quality not in QUALITY_MAX_EDGE:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported depth quality '{quality}'.",
        )

    try:
        with Image.open(io.BytesIO(image_bytes)) as source:
            source_rgb = source.convert("RGB")
            source_size = source_rgb.size
            prepared = _resize_within(
                source_rgb,
                QUALITY_MAX_EDGE[quality],
            )
            prepared_size = prepared.size
            buffer = io.BytesIO()
            prepared.save(buffer, format="PNG", optimize=True)
            return buffer.getvalue(), source_size, prepared_size
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=415,
            detail="Depth provider could not decode the source raster.",
        ) from exc


def _extract_image_url(payload: Any) -> str | None:
    if isinstance(payload, dict):
        image = payload.get("image")
        if isinstance(image, dict) and isinstance(image.get("url"), str):
            return image["url"]
        data = payload.get("data")
        if isinstance(data, dict):
            found = _extract_image_url(data)
            if found:
                return found
    return None


def canonicalize_fal_depth(
    provider_image_bytes: bytes,
    *,
    source_size: tuple[int, int],
) -> tuple[np.ndarray, np.ndarray, bytes]:
    """Convert FAL's normalized disparity image to DepthPop 0-far / 1-near.

    No content-based polarity heuristic is used. The FAL Depth Anything V2
    adapter treats the documented grayscale output as normalized disparity,
    matching the upstream Depth Anything V2 visualization path.
    """

    try:
        with Image.open(io.BytesIO(provider_image_bytes)) as provider_image:
            grayscale = provider_image.convert("L")
            raw_array = (
                np.asarray(grayscale, dtype=np.float32) / 255.0
            )
            source_sized = grayscale.resize(
                source_size,
                Image.Resampling.BILINEAR,
            )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Depth provider returned an invalid raster.",
        ) from exc

    canonical = np.asarray(source_sized, dtype=np.float32) / 255.0
    canonical = np.clip(canonical, 0.0, 1.0).astype(np.float32)

    canonical_image = Image.fromarray(
        np.round(canonical * 255.0).astype(np.uint8),
        mode="L",
    )
    output = io.BytesIO()
    canonical_image.save(output, format="PNG", optimize=True)
    return raw_array, canonical, output.getvalue()


class FalDepthProvider:
    """FAL Depth Anything V2 adapter with deterministic canonical semantics."""

    def __init__(self, fal_key: str | None = None):
        self.fal_key = fal_key or os.getenv("FAL_KEY", "").strip()

    async def estimate(
        self,
        image: bytes,
        quality: DepthQuality = "high",
    ) -> DepthMap:
        if not self.fal_key:
            raise HTTPException(
                status_code=503,
                detail="Production depth estimation requires FAL_KEY.",
            )

        prepared, source_size, _prepared_size = prepare_depth_input(
            image,
            quality,
        )
        data_url = (
            "data:image/png;base64,"
            + base64.b64encode(prepared).decode("ascii")
        )

        try:
            result = await asyncio.to_thread(
                fal_client.run,
                DEPTH_MODEL,
                arguments={"image_url": data_url},
            )
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail="Depth Anything V2 provider failed.",
            ) from exc

        provider_url = (_extract_image_url(result) or "").strip()
        if not provider_url:
            raise HTTPException(
                status_code=502,
                detail="Depth Anything V2 returned no image URL.",
            )

        provider_bytes = await fetch_fal_media(provider_url)
        raw_array, canonical, canonical_bytes = canonicalize_fal_depth(
            provider_bytes,
            source_size=source_size,
        )

        return DepthMap(
            raw_depth=provider_bytes,
            canonical_depth=canonical_bytes,
            raw_depth_array=raw_array,
            depth_array=canonical,
            provider_url=provider_url,
            polarity=CANONICAL_POLARITY,
            quality=quality,
        )


class MockDepthProvider:
    """Deterministic canonical 0-far / 1-near depth for tests/local dev."""

    async def estimate(
        self,
        image: bytes,
        quality: DepthQuality = "high",
    ) -> DepthMap:
        environment = os.getenv("ENVIRONMENT", "").lower()
        mode = os.getenv("DEPTH_PROVIDER", "").lower()
        is_test = environment == "test" or "PYTEST_CURRENT_TEST" in os.environ
        if environment == "production":
            raise HTTPException(
                status_code=503,
                detail="Mock depth estimation is disabled in production.",
            )
        if not is_test and mode != "mock":
            raise HTTPException(
                status_code=503,
                detail="Mock depth estimation requires DEPTH_PROVIDER=mock.",
            )

        with Image.open(io.BytesIO(image)) as source:
            width, height = source.size

        # Near center, far edges. This is already DepthPop canonical.
        yy, xx = np.indices((height, width))
        cy, cx = height / 2.0, width / 2.0
        distance = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
        max_distance = np.sqrt(cx**2 + cy**2) or 1.0
        canonical = np.clip(
            1.0 - 0.8 * (distance / max_distance),
            0.0,
            1.0,
        ).astype(np.float32)

        image_l = Image.fromarray(
            np.round(canonical * 255.0).astype(np.uint8),
            mode="L",
        )
        buffer = io.BytesIO()
        image_l.save(buffer, format="PNG")
        depth_bytes = buffer.getvalue()

        return DepthMap(
            raw_depth=depth_bytes,
            canonical_depth=depth_bytes,
            raw_depth_array=canonical.copy(),
            depth_array=canonical,
            provider_url="",
            polarity=CANONICAL_POLARITY,
            quality=quality,
        )
