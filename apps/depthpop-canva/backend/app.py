from __future__ import annotations

import asyncio
import base64
import hashlib
import io
import ipaddress
import os
import socket
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import urljoin, urlparse

import fal_client
import httpx
import jwt
import numpy as np
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from jwt import PyJWKClient
from PIL import Image, ImageFilter
from pydantic import BaseModel, Field, HttpUrl

MAX_IMAGE_BYTES = 50 * 1024 * 1024
CACHE_TTL_SECONDS = 15 * 60
CACHE_LIMIT = 32

CANVA_APP_ID = os.getenv("CANVA_APP_ID", "").strip()
CANVA_APP_ORIGIN = os.getenv("CANVA_APP_ORIGIN", "").strip().rstrip("/")
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "").strip().rstrip("/")

app = FastAPI(title="DepthPop Canva Backend", version="1.0.0")
if CANVA_APP_ORIGIN:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[CANVA_APP_ORIGIN],
        allow_credentials=False,
        allow_methods=["POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

_jwks_client: PyJWKClient | None = None
_image_cache: dict[str, tuple[float, bytes, str]] = {}
_render_slots = asyncio.Semaphore(max(1, int(os.getenv("DEPTHPOP_MAX_CONCURRENCY", "3"))))


class DepthPopRequest(BaseModel):
    sourceUrl: HttpUrl
    strength: float = Field(0.32, ge=0.05, le=0.75)
    bokeh: int = Field(35, ge=0, le=100)
    depthFidelity: float = Field(0.95, ge=0.05, le=1.0)
    numInferenceSteps: int = Field(28, ge=8, le=50)


class DepthPopResponse(BaseModel):
    ok: bool = True
    url: str
    thumbnailUrl: str
    mimeType: str = "image/png"
    depthMapUrl: str | None = None
    model: str = "depthpop-depth-anything-v2-local-dof"


@dataclass(frozen=True)
class VerifiedCanvaUser:
    user_id: str
    brand_id: str


def _require_config() -> None:
    if not CANVA_APP_ID:
        raise HTTPException(status_code=503, detail="CANVA_APP_ID is not configured")
    if not os.getenv("FAL_KEY", "").strip():
        raise HTTPException(status_code=503, detail="FAL_KEY is not configured")


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    _require_config()
    if _jwks_client is None:
        _jwks_client = PyJWKClient(
            "https://api.canva.com/rest/v1/apps/" + CANVA_APP_ID + "/jwks",
            cache_keys=True,
            max_cached_keys=16,
            lifespan=3600,
        )
    return _jwks_client


def _extract_bearer(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Canva authorization token")
    scheme, _, token = authorization.strip().partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="Invalid Canva authorization header")
    return token.strip()


async def verify_canva_user(authorization: str | None = Header(default=None)) -> VerifiedCanvaUser:
    token = _extract_bearer(authorization)
    try:
        signing_key = await asyncio.to_thread(_get_jwks_client().get_signing_key_from_jwt, token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            audience=CANVA_APP_ID,
            options={"require": ["aud", "exp"]},
        )
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid Canva authorization token") from exc

    user_id = str(claims.get("userId") or "").strip()
    brand_id = str(claims.get("brandId") or "").strip()
    if not user_id or not brand_id:
        raise HTTPException(status_code=401, detail="Canva user identity is incomplete")
    return VerifiedCanvaUser(user_id=user_id, brand_id=brand_id)


def _is_public_ip(address: str) -> bool:
    ip = ipaddress.ip_address(address)
    return not (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


async def _assert_public_https_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme.lower() != "https" or not parsed.hostname:
        raise HTTPException(status_code=400, detail="sourceUrl must be a public HTTPS URL")
    try:
        infos = await asyncio.to_thread(
            socket.getaddrinfo,
            parsed.hostname,
            443,
            type=socket.SOCK_STREAM,
        )
    except socket.gaierror as exc:
        raise HTTPException(status_code=400, detail="sourceUrl hostname could not be resolved") from exc
    addresses = {info[4][0] for info in infos}
    if not addresses or any(not _is_public_ip(address) for address in addresses):
        raise HTTPException(status_code=400, detail="sourceUrl must resolve only to public addresses")


async def _fetch_image(url: str) -> tuple[bytes, str]:
    current = url
    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0), follow_redirects=False) as client:
        for _ in range(4):
            await _assert_public_https_url(current)
            response = await client.get(current, headers={"User-Agent": "depthpop-canva/1.0"})
            if response.status_code in {301, 302, 303, 307, 308}:
                location = response.headers.get("location")
                if not location:
                    raise HTTPException(status_code=502, detail="Image redirect was missing a location")
                current = urljoin(current, location)
                continue
            if response.status_code >= 400:
                raise HTTPException(
                    status_code=502,
                    detail="Could not fetch selected Canva image (" + str(response.status_code) + ")",
                )
            raw = response.content
            if not raw or len(raw) > MAX_IMAGE_BYTES:
                raise HTTPException(status_code=413, detail="Selected image is empty or exceeds 50 MB")
            mime = (
                response.headers.get("content-type") or "image/png"
            ).split(";", 1)[0].strip().lower()
            if mime not in {"image/png", "image/jpeg", "image/webp"}:
                mime = "image/png"
            return raw, mime
    raise HTTPException(status_code=502, detail="Too many image redirects")


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
        raise HTTPException(status_code=502, detail="Depth-map provider failed: " + str(exc)) from exc
    depth_url = (_extract_image_url(result) or "").strip()
    if not depth_url:
        raise HTTPException(status_code=502, detail="Depth-map provider returned no image")
    depth_raw, _ = await _fetch_image(depth_url)
    return depth_raw, depth_url


def _auto_invert_and_focus(depth01: np.ndarray) -> tuple[bool, float]:
    h, w = depth01.shape
    if h < 4 or w < 4:
        return False, 0.35
    cy0, cy1 = int(h * 0.35), int(h * 0.65)
    cx0, cx1 = int(w * 0.35), int(w * 0.65)
    center = float(depth01[cy0:cy1, cx0:cx1].mean())
    top = float(depth01[: max(1, int(h * 0.12)), :].mean())
    bottom = float(depth01[int(h * 0.88) :, :].mean())
    left = float(
        depth01[
            int(h * 0.12) : int(h * 0.88),
            : max(1, int(w * 0.12)),
        ].mean()
    )
    right = float(
        depth01[
            int(h * 0.12) : int(h * 0.88),
            int(w * 0.88) :,
        ].mean()
    )
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
    max_radius = (bokeh / 100.0) * (
        22.0 if steps >= 30 else 18.0 if steps >= 20 else 14.0
    )
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
        blurred = (
            base
            if radius <= 0.05
            else np.asarray(image.filter(ImageFilter.GaussianBlur(radius))).astype(np.float32)
        )
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


def _render_depthpop(raw: bytes, depth_raw: bytes, req: DepthPopRequest) -> bytes:
    image = Image.open(io.BytesIO(raw)).convert("RGB")
    depth = (
        Image.open(io.BytesIO(depth_raw))
        .convert("L")
        .resize(image.size, Image.Resampling.BILINEAR)
    )
    depth01 = np.asarray(depth).astype(np.float32) / 255.0
    output = _apply_depth_lens_blur(
        image,
        depth01,
        depth_fidelity=req.depthFidelity,
        strength=req.strength,
        bokeh=req.bokeh,
        quality_steps=req.numInferenceSteps,
    )
    buffer = io.BytesIO()
    output.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def _cache_put(data: bytes, mime: str) -> str:
    now = time.time()
    expired = [
        key
        for key, (created, _, _) in _image_cache.items()
        if now - created > CACHE_TTL_SECONDS
    ]
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
async def health() -> dict[str, str]:
    return {"service": "depthpop-canva", "status": "ok"}


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


@app.post("/api/depthpop", response_model=DepthPopResponse)
async def execute_depthpop(
    payload: DepthPopRequest,
    request: Request,
    _user: VerifiedCanvaUser = Depends(verify_canva_user),
) -> DepthPopResponse:
    _require_config()
    async with _render_slots:
        raw, mime = await _fetch_image(str(payload.sourceUrl))
        depth_raw, depth_provider_url = await _depth_map(raw, mime)
        output = await asyncio.to_thread(_render_depthpop, raw, depth_raw, payload)
        image_id = _cache_put(output, "image/png")
        output_url = _public_url(request, "/cache/image/" + image_id)
        return DepthPopResponse(
            url=output_url,
            thumbnailUrl=output_url,
            mimeType="image/png",
            depthMapUrl=depth_provider_url,
        )
