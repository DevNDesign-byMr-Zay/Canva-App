from __future__ import annotations

import asyncio
import base64
import hashlib
import io
import os
import time
from typing import Any
from urllib.parse import urlparse

import fal_client
import httpx
import numpy as np
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image, ImageFilter

from api.assets import router as assets_router
from api.jobs import router as jobs_router
from api.scenes import router as scenes_router
from auth import verify_canva_user, VerifiedCanvaUser
from services.upload import validate_and_read_upload, MAX_IMAGE_BYTES, SUPPORTED_IMAGE_MIME

CACHE_TTL_SECONDS = 15 * 60
CACHE_LIMIT = 32

CANVA_APP_ID = os.getenv("CANVA_APP_ID", "").strip()
CANVA_APP_ORIGIN = os.getenv("CANVA_APP_ORIGIN", "").strip().rstrip("/")
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "").strip().rstrip("/")

app = FastAPI(title="DepthPop Canva Backend", version="1.0.1")
if CANVA_APP_ORIGIN:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[CANVA_APP_ORIGIN],
        allow_credentials=False,
        allow_methods=["POST", "GET", "PATCH", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

app.include_router(assets_router)
app.include_router(scenes_router)
app.include_router(jobs_router)

_image_cache: dict[str, tuple[float, bytes, str]] = {}
_progress_cache: dict[str, dict[str, Any]] = {}
_render_slots = asyncio.Semaphore(max(1, int(os.getenv("DEPTHPOP_MAX_CONCURRENCY", "3"))))


FAL_MEDIA_BASES = {
    "fal.media": "https://fal.media",
    "v2.fal.media": "https://v2.fal.media",
    "v3.fal.media": "https://v3.fal.media",
}


def _fal_media_request_target(url: str) -> tuple[str, str]:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    base = FAL_MEDIA_BASES.get(host)
    if parsed.scheme.lower() != "https" or not base:
        raise HTTPException(status_code=502, detail="Depth-map provider returned an unexpected file host")
    if not parsed.path.startswith("/") or parsed.path.startswith("//"):
        raise HTTPException(status_code=502, detail="Depth-map provider returned an invalid file path")

    target = parsed.path
    if parsed.query:
        target += "?" + parsed.query
    return base, target


async def _fetch_provider_image(url: str) -> bytes:
    base, target = _fal_media_request_target(url)
    async with httpx.AsyncClient(
        base_url=base,
        timeout=httpx.Timeout(30.0),
        follow_redirects=False,
        headers={"User-Agent": "depthpop-canva/1.0"},
    ) as client:
        response = await client.get(target)

    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="Depth-map provider image download failed")
    if response.status_code in {301, 302, 303, 307, 308}:
        raise HTTPException(status_code=502, detail="Depth-map provider image redirected unexpectedly")

    raw = response.content
    if not raw or len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=502, detail="Depth-map provider image was empty or too large")
    return raw


async def _read_source_image(image: UploadFile) -> tuple[bytes, str]:
    return await validate_and_read_upload(image)


def _to_data_url(raw: bytes, mime: str) -> str:
    return "data:" + mime + ";base64," + base64.b64encode(raw).decode("ascii")


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
                found = _extract_image_url(value)
                if found:
                    return found
    if isinstance(payload, list) and payload:
        return _extract_image_url(payload[0])
    return None


async def _depth_map(raw: bytes, mime: str) -> tuple[bytes, str]:
    data_url = _to_data_url(raw, mime)
    try:
        result = await asyncio.to_thread(
            fal_client.run,
            "fal-ai/image-preprocessors/depth-anything/v2",
            arguments={"image_url": data_url},
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Depth-map provider failed") from exc

    depth_url = (_extract_image_url(result) or "").strip()
    if not depth_url:
        raise HTTPException(status_code=502, detail="Depth-map provider returned no image")

    depth_raw = await _fetch_provider_image(depth_url)
    return depth_raw, depth_url


def _auto_invert_and_focus(depth01: np.ndarray) -> tuple[bool, float]:
    height, width = depth01.shape
    if height < 4 or width < 4:
        return False, 0.35

    cy0, cy1 = int(height * 0.35), int(height * 0.65)
    cx0, cx1 = int(width * 0.35), int(width * 0.65)
    center = float(depth01[cy0:cy1, cx0:cx1].mean())
    top = float(depth01[: max(1, int(height * 0.12)), :].mean())
    bottom = float(depth01[int(height * 0.88) :, :].mean())
    left = float(depth01[int(height * 0.12) : int(height * 0.88), : max(1, int(width * 0.12))].mean())
    right = float(depth01[int(height * 0.12) : int(height * 0.88), int(width * 0.88) :].mean())
    edges = 0.25 * (top + bottom + left + right)

    invert = center > edges
    oriented = 1.0 - depth01 if invert else depth01
    focus = float(np.quantile(oriented, 0.35))
    return invert, max(0.05, min(focus, 0.95))


def _apply_depth_lens_blur(
    image: Image.Image,
    depth01: np.ndarray,
    *,
    depth_fidelity: float,
    strength: float,
    bokeh: int,
    quality_steps: int,
) -> Image.Image:
    fidelity = max(0.05, min(float(depth_fidelity), 1.0))
    strength = max(0.05, min(float(strength), 0.75))
    bokeh = max(0, min(int(bokeh), 100))
    steps = max(8, min(int(quality_steps), 50))

    feather_px = max(1.0, (1.0 - fidelity) * 14.0 + 2.0)
    depth_image = Image.fromarray((depth01 * 255.0).astype(np.uint8), mode="L")
    depth_image = depth_image.filter(ImageFilter.GaussianBlur(radius=feather_px))
    depth01 = np.asarray(depth_image).astype(np.float32) / 255.0

    invert, focus = _auto_invert_and_focus(depth01)
    oriented = 1.0 - depth01 if invert else depth01
    curve = max(0.75, min(1.15 + (fidelity - 0.5) * 1.25, 2.25))
    max_radius = (bokeh / 100.0) * (22.0 if steps >= 30 else 18.0 if steps >= 20 else 14.0)
    max_radius *= 0.70 + 0.60 * strength
    max_radius = max(0.0, min(float(max_radius), 26.0))
    levels = 10 if steps >= 30 else 8 if steps >= 20 else 6

    image = image.convert("RGB")
    width, height = image.size
    if width * height > 3_600_000:
        levels = max(5, levels - 2)
        max_radius = min(max_radius, 18.0)
    if max_radius <= 0.15:
        return image

    base = np.asarray(image).astype(np.float32)
    blurred_levels = []
    for index in range(levels):
        radius = max_radius * (index / (levels - 1))
        blurred = base if radius <= 0.05 else np.asarray(
            image.filter(ImageFilter.GaussianBlur(radius))
        ).astype(np.float32)
        blurred_levels.append(blurred)
    stack = np.stack(blurred_levels, axis=0)

    distance = np.abs(oriented - focus)
    blur_map = np.power(np.clip(distance / 0.85, 0.0, 1.0), curve)
    blur_map = np.clip(blur_map * (0.55 + 0.90 * strength), 0.0, 1.0)
    level_f = blur_map * (levels - 1)
    idx0 = np.floor(level_f).astype(np.int32)
    idx1 = np.clip(idx0 + 1, 0, levels - 1)
    fraction = (level_f - idx0).astype(np.float32)[..., None]

    yy, xx = np.indices((height, width))
    first = stack[idx0, yy, xx]
    second = stack[idx1, yy, xx]
    output = first * (1.0 - fraction) + second * fraction
    return Image.fromarray(np.clip(output, 0, 255).astype(np.uint8), mode="RGB")


def _render_depthpop(
    raw: bytes,
    depth_raw: bytes,
    *,
    depth_fidelity: float,
    strength: float,
    bokeh: int,
    num_inference_steps: int,
) -> bytes:
    image = Image.open(io.BytesIO(raw)).convert("RGB")
    depth = Image.open(io.BytesIO(depth_raw)).convert("L").resize(image.size, Image.Resampling.BILINEAR)
    depth01 = np.asarray(depth).astype(np.float32) / 255.0
    output = _apply_depth_lens_blur(
        image,
        depth01,
        depth_fidelity=depth_fidelity,
        strength=strength,
        bokeh=bokeh,
        quality_steps=num_inference_steps,
    )
    buffer = io.BytesIO()
    output.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def _progress_cleanup() -> None:
    now = time.time()
    expired = [
        key
        for key, record in _progress_cache.items()
        if now - float(record.get("ts", 0.0)) > CACHE_TTL_SECONDS
    ]
    for key in expired:
        _progress_cache.pop(key, None)


def _progress_set(progress_id: str | None, percent: int, status: str, message: str) -> None:
    if not progress_id:
        return
    _progress_cleanup()
    _progress_cache[str(progress_id)] = {
        "percent": max(0, min(100, int(percent))),
        "status": str(status),
        "msg": str(message),
        "ts": time.time(),
    }


def _cache_put(data: bytes, mime: str) -> str:
    now = time.time()
    expired = [key for key, (created, _, _) in _image_cache.items() if now - created > CACHE_TTL_SECONDS]
    for key in expired:
        _image_cache.pop(key, None)

    if len(_image_cache) >= CACHE_LIMIT:
        oldest = min(_image_cache, key=lambda key: _image_cache[key][0])
        _image_cache.pop(oldest, None)

    key = hashlib.sha256(data).hexdigest()[:32]
    _image_cache[key] = (now, data, mime)
    return key


def _public_url(request: Request, path: str) -> str:
    base = PUBLIC_BASE_URL or str(request.base_url).rstrip("/")
    return base + path


@app.get("/health")
async def health() -> dict[str, Any]:
    inpaint_mode = os.getenv("INPAINT_PROVIDER", "auto").lower().strip()
    has_fal = bool(os.getenv("FAL_KEY", "").strip())
    return {
        "service": "depthpop-canva",
        "status": "ok",
        "capabilities": {
            "objectScene": True,
            "backgroundReconstruction": (
                has_fal and inpaint_mode not in {"off", "none", "disabled"}
            ),
        },
    }


@app.get("/tool/progress/{progress_id}")
async def tool_progress(progress_id: str) -> dict[str, Any]:
    _progress_cleanup()
    record = _progress_cache.get(str(progress_id))
    if not record:
        return {"ok": False, "error": "not_found"}
    return {"ok": True, **record}


@app.get("/cache/image/{image_id}")
async def cached_image(image_id: str) -> Response:
    record = _image_cache.get(image_id)
    if not record:
        raise HTTPException(status_code=404, detail="Image expired or unavailable")

    created, data, mime = record
    if time.time() - created > CACHE_TTL_SECONDS:
        _image_cache.pop(image_id, None)
        raise HTTPException(status_code=404, detail="Image expired or unavailable")

    return Response(
        content=data,
        media_type=mime,
        headers={"Cache-Control": "public, max-age=900"},
    )


@app.post("/api/depthpop")
@app.post("/tool/depth_pop")
@app.post("/tool/depthpop")
@app.post("/tool/enhance")
async def execute_depthpop(
    request: Request,
    image: UploadFile = File(...),
    strength: float = Form(0.32, ge=0.05, le=0.75),
    bokeh: int = Form(35, ge=0, le=100),
    depth_fidelity: float = Form(0.95, ge=0.05, le=1.0),
    num_inference_steps: int = Form(28, ge=8, le=50),
    preview: int = Form(0, ge=0, le=1),
    output_format: str = Form("png"),
    progress_id: str | None = Form(None),
    _user: VerifiedCanvaUser = Depends(verify_canva_user),
) -> dict[str, Any]:
    if not os.getenv("FAL_KEY", "").strip():
        raise HTTPException(status_code=503, detail="FAL_KEY is not configured")
    _progress_set(progress_id, 1, "running", "start")

    async with _render_slots:
        raw, mime = await _read_source_image(image)
        _progress_set(progress_id, 10, "running", "image_loaded")
        depth_raw, depth_provider_url = await _depth_map(raw, mime)
        _progress_set(progress_id, 55, "running", "depth_fetched")
        output = await asyncio.to_thread(
            _render_depthpop,
            raw,
            depth_raw,
            depth_fidelity=depth_fidelity,
            strength=strength,
            bokeh=bokeh,
            num_inference_steps=num_inference_steps,
        )
        _progress_set(progress_id, 95, "running", "encode")
        image_id = _cache_put(output, "image/png")
        output_url = _public_url(request, "/cache/image/" + image_id)
        _progress_set(progress_id, 100, "done", "complete")
        controls = {
            "preview": int(preview),
            "strength": float(strength),
            "bokeh": int(bokeh),
            "depth_fidelity": float(depth_fidelity),
            "num_inference_steps": int(num_inference_steps),
            "output_format": str(output_format),
        }
        return {
            "ok": True,
            "url": output_url,
            "thumbnailUrl": output_url,
            "mimeType": "image/png",
            "depthMapUrl": depth_provider_url,
            "depth_map_url": depth_provider_url,
            "image": {"url": output_url},
            "images": [{"url": output_url}],
            "controls": controls,
            "model": "depthpop-depth-anything-v2-local-dof",
        }
