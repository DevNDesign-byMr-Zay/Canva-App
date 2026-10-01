from __future__ import annotations

import asyncio
import base64
import io
import os
from typing import Any, Protocol
import fal_client
import httpx
import numpy as np
from fastapi import HTTPException
from PIL import Image
from pydantic import BaseModel, ConfigDict


class DepthMap(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    raw_depth: bytes
    depth_array: np.ndarray
    provider_url: str = ""


class DepthProvider(Protocol):
    async def estimate(self, image: bytes) -> DepthMap: ...


def _detect_image_mime(image_bytes: bytes) -> str:
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            fmt = (img.format or "").upper()
            if fmt == "PNG":
                return "image/png"
            if fmt in ("JPEG", "JPG"):
                return "image/jpeg"
            if fmt == "WEBP":
                return "image/webp"
    except Exception:
        pass
    return "image/png"


class FalDepthProvider:
    """Wrapped FAL Depth Anything v2 provider."""

    def __init__(self, fal_key: str | None = None):
        self.fal_key = fal_key or os.getenv("FAL_KEY", "").strip()

    async def estimate(self, image: bytes) -> DepthMap:
        if not self.fal_key:
            raise HTTPException(
                status_code=503,
                detail="Production depth provider is not configured. Set FAL_KEY or DEPTH_PROVIDER=mock for test environment.",
            )

        mime = _detect_image_mime(image)
        data_url = f"data:{mime};base64," + base64.b64encode(image).decode("ascii")

        try:
            result = await asyncio.to_thread(
                fal_client.run,
                "fal-ai/image-preprocessors/depth-anything/v2",
                arguments={"image_url": data_url},
            )
        except Exception as exc:
            raise HTTPException(status_code=502, detail="Depth-map provider failed") from exc

        depth_url = (self._extract_image_url(result) or "").strip()
        if not depth_url:
            raise HTTPException(status_code=502, detail="Depth-map provider returned no image")

        depth_bytes = await self._fetch_provider_image(depth_url)
        with Image.open(io.BytesIO(depth_bytes)) as d_img:
            d_img_l = d_img.convert("L")
            depth_arr = np.asarray(d_img_l).astype(np.float32) / 255.0

        return DepthMap(raw_depth=depth_bytes, depth_array=depth_arr, provider_url=depth_url)

    @staticmethod
    def _extract_image_url(payload: Any) -> str | None:
        if isinstance(payload, str) and payload:
            return payload
        if isinstance(payload, dict):
            for key in ("depth_map_url", "image_url", "url", "href"):
                value = payload.get(key)
                if isinstance(value, str) and value:
                    return value
            image = payload.get("image")
            if isinstance(image, dict):
                value = image.get("url") or image.get("href") or image.get("image_url")
                if isinstance(value, str) and value:
                    return value
            if isinstance(image, str) and image:
                return image
            for key in ("data", "result", "output", "images"):
                value = payload.get(key)
                if isinstance(value, (dict, list, str)):
                    found = FalDepthProvider._extract_image_url(value)
                    if found:
                        return found
        if isinstance(payload, list) and payload:
            return FalDepthProvider._extract_image_url(payload[0])
        return None

    @staticmethod
    async def _fetch_provider_image(url: str) -> bytes:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        host = (parsed.hostname or "").lower()
        allowed_bases = {
            "fal.media": "https://fal.media",
            "v2.fal.media": "https://v2.fal.media",
            "v3.fal.media": "https://v3.fal.media",
        }
        base = allowed_bases.get(host)
        if parsed.scheme.lower() != "https" or not base:
            raise HTTPException(status_code=502, detail="Depth-map provider returned an unexpected file host")

        target = parsed.path
        if parsed.query:
            target += "?" + parsed.query

        async with httpx.AsyncClient(
            base_url=base,
            timeout=httpx.Timeout(30.0),
            follow_redirects=False,
            headers={"User-Agent": "depthpop-canva/1.0"},
        ) as client:
            response = await client.get(target)

        if response.status_code >= 400 or response.status_code in {301, 302, 303, 307, 308}:
            raise HTTPException(status_code=502, detail="Depth-map provider image download failed")

        raw = response.content
        if not raw or len(raw) > 50 * 1024 * 1024:
            raise HTTPException(status_code=502, detail="Depth-map provider image was empty or too large")
        return raw


class MockDepthProvider:
    """Deterministic depth provider for testing / local execution."""

    async def estimate(self, image: bytes) -> DepthMap:
        env = os.getenv("ENVIRONMENT", "").lower()
        mode = os.getenv("DEPTH_PROVIDER", "").lower()
        if env == "production" or (env != "test" and mode != "mock" and "PYTEST_CURRENT_TEST" not in os.environ):
            raise HTTPException(
                status_code=503,
                detail="Mock depth provider is allowed only when ENVIRONMENT=test or DEPTH_PROVIDER=mock",
            )

        with Image.open(io.BytesIO(image)) as img:
            width, height = img.size

        yy, xx = np.indices((height, width))
        cy, cx = height / 2.0, width / 2.0
        dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
        max_dist = np.sqrt(cx**2 + cy**2) or 1.0
        norm_dist = np.clip(dist / max_dist, 0.0, 1.0)

        depth_array = (0.2 + 0.6 * norm_dist).astype(np.float32)
        depth_img = Image.fromarray((depth_array * 255).astype(np.uint8), mode="L")

        buf = io.BytesIO()
        depth_img.save(buf, format="PNG")
        depth_bytes = buf.getvalue()

        return DepthMap(
            raw_depth=depth_bytes,
            depth_array=depth_array,
            provider_url="https://v2.fal.media/files/mock/depth.png",
        )
