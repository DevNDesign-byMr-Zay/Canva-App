"""ROARY Router (5055) — v244

Drop-in FastAPI backend for ROARY Studio.

Key changes (requested):
- Remove/Eraser tool no longer uses NanoBanana; it uses FAL object removal w/ mask.
- Added DepthPop (replaces Enhance) using Depth Anything v2 + FLUX depth control LoRA.
- Keeps NanoBanana Pro endpoints ONLY for the mini chat (proxy routes).

Run:
  $ setx FAL_KEY "YOUR_FAL_KEY"   # PowerShell (persist)
  $ python -m uvicorn roary_router_5055_SEARCH_FIXED_v243_proxy_images_fixed:app --host 127.0.0.1 --port 5055

Notes:
- Frontend can send either image_url OR an uploaded image file.
- For eraser/remove, send mask_data_url (data:image/png;base64,...) or upload mask file.
"""

from __future__ import annotations

import asyncio
import base64
import io
import mimetypes
from PIL import Image, ImageFilter
import numpy as np
import os
import re
import hashlib
import time
from typing import Any, Dict, List, Optional

import urllib.request
from urllib.parse import quote

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response


def _require_fal_client():
    try:
        import fal_client  # type: ignore
    except Exception as e:  # pragma: no cover
        raise RuntimeError(
            "fal_client is not installed. Install it with: pip install fal-client"
        ) from e
    return fal_client


def _maybe_set_fal_key(x_fal_key: Optional[str] = None):
    """Prefer server-side env var, but allow optional header for local dev."""
    if os.environ.get("FAL_KEY"):
        return
    if x_fal_key and x_fal_key.strip():
        os.environ["FAL_KEY"] = x_fal_key.strip()


def _is_data_url(s: str) -> bool:
    return bool(s) and s.startswith("data:")


def _data_url_to_bytes(data_url: str) -> tuple[bytes, str]:
    """Return (bytes, mime)."""
    m = re.match(r"^data:([^;]+);base64,(.*)$", data_url, flags=re.I | re.S)
    if not m:
        raise ValueError("Invalid data URL")
    mime = m.group(1).strip() or "application/octet-stream"
    b64 = m.group(2).strip()
    return base64.b64decode(b64), mime


def _bytes_to_data_url(data: bytes, mime: str) -> str:
    b64 = base64.b64encode(data).decode("ascii")
    return f"data:{mime};base64,{b64}"


async def _uploadfile_to_data_url(f: UploadFile) -> str:
    data = await f.read()
    mime = f.content_type or "application/octet-stream"
    # Common case: png masks with missing mime
    if mime == "application/octet-stream":
        if (f.filename or "").lower().endswith(".png"):
            mime = "image/png"
        elif (f.filename or "").lower().endswith(".jpg") or (f.filename or "").lower().endswith(".jpeg"):
            mime = "image/jpeg"
        elif (f.filename or "").lower().endswith(".webp"):
            mime = "image/webp"
    return _bytes_to_data_url(data, mime)



async def _resolve_image_input(
    image: Optional[UploadFile],
    image_url: Optional[str],
    fetch_and_upload: bool = False,
) -> str:
    """Return a FAL-compatible input string (URL or data URI)."""
    if image is not None:
        return await _uploadfile_to_data_url(image)

    if image_url and image_url.strip():
        s = image_url.strip()

        # If requested by the frontend, fetch the URL server-side and convert to a data URL.
        # This bypasses browser CORS (especially from file://).
        if fetch_and_upload and (s.startswith("http://") or s.startswith("https://")):
            def _fetch_url_bytes(url: str) -> tuple[bytes, str]:
                req = urllib.request.Request(url, headers={"User-Agent": "roary-router/5055"})
                with urllib.request.urlopen(req, timeout=25) as r:  # nosec - local/dev
                    raw = r.read()
                    ctype = (r.headers.get("content-type") or "application/octet-stream").split(";")[0].strip()
                    return raw, ctype or "application/octet-stream"

            raw, mime = await asyncio.to_thread(_fetch_url_bytes, s)
            return _bytes_to_data_url(raw, mime)

        # Block blob:/file: URLs because FAL can't fetch them.
        if s.startswith("blob:") or s.startswith("file:"):
            raise HTTPException(
                status_code=400,
                detail="image_url was a blob:/file: URL. Send image bytes (multipart) instead.",
            )

        return s

    raise HTTPException(status_code=400, detail="Missing image or image_url")


async def _resolve_mask_input(
    mask: Optional[UploadFile],
    mask_url: Optional[str],
    mask_data_url: Optional[str],
) -> Optional[str]:
    if mask_data_url and mask_data_url.strip() and _is_data_url(mask_data_url.strip()):
        return mask_data_url.strip()
    if mask_url and mask_url.strip() and _is_data_url(mask_url.strip()):
        return mask_url.strip()
    if mask is not None:
        return await _uploadfile_to_data_url(mask)
    if mask_url and mask_url.strip():
        s = mask_url.strip()
        if s.startswith("blob:") or s.startswith("file:"):
            return None
        return s
    return None


async def _fal_run(model_id: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    fal_client = _require_fal_client()
    # fal_client.run is sync; run in a thread so we don't block the event loop.
    try:
        return await asyncio.to_thread(fal_client.run, model_id, arguments=arguments)
    except HTTPException:
        raise
    except Exception as e:
        # Normalize upstream errors into a useful API response for the frontend.
        msg = str(e) or e.__class__.__name__
        raise HTTPException(status_code=502, detail=f"FAL error for {model_id}: {msg}")


def _extract_image_url(payload: Any) -> Optional[str]:
    """Best-effort extractor for a single image URL from varied FAL-style responses."""
    if not payload:
        return None
    if isinstance(payload, str):
        return payload

    if isinstance(payload, dict):
        # direct keys
        for k in ("depth_map_url", "image_url", "url", "href"):
            v = payload.get(k)
            if isinstance(v, str) and v:
                return v

        img = payload.get("image")
        if isinstance(img, str) and img:
            return img
        if isinstance(img, dict):
            v = img.get("url") or img.get("href") or img.get("image_url")
            if isinstance(v, str) and v:
                return v

        ims = payload.get("images")
        if isinstance(ims, list) and ims:
            first = ims[0]
            if isinstance(first, str) and first:
                return first
            if isinstance(first, dict):
                v = first.get("url") or first.get("image_url") or first.get("href")
                if isinstance(v, str) and v:
                    return v

        # common wrappers
        for k in ("data", "result", "output"):
            v = payload.get(k)
            if isinstance(v, (dict, str, list)):
                u = _extract_image_url(v)  # type: ignore[arg-type]
                if u:
                    return u

    if isinstance(payload, list) and payload:
        # sometimes it's a list of images/urls
        return _extract_image_url(payload[0])  # type: ignore[arg-type]

    return None

def _normalize_image_result(data: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure both `image` and `images[]` exist for the frontend."""
    if not isinstance(data, dict):
        return {"images": []}

    if "images" in data and isinstance(data["images"], list) and data["images"]:
        if "image" not in data:
            data["image"] = data["images"][0]
        return data

    if "image" in data and isinstance(data["image"], dict) and data["image"].get("url"):
        data["images"] = [data["image"]]
        return data

    # Some models return nested data
    img = None
    try:
        if isinstance(data.get("data"), dict):
            d = data["data"]
            if isinstance(d.get("images"), list) and d["images"]:
                img = d["images"][0]
            elif isinstance(d.get("image"), dict):
                img = d.get("image")
    except Exception:
        img = None
    if isinstance(img, dict) and img.get("url"):
        data["image"] = img
        data["images"] = [img]
    else:
        data.setdefault("images", [])
    return data
def _proxyify_url(base_url: str, url: str) -> str:
    """Rewrite external image URLs through the local router to avoid HTTP/3/QUIC fetch issues in the browser."""
    if not url:
        return url
    if url.startswith("data:"):
        return url
    # If it's already local, keep it.
    if url.startswith(base_url):
        return url
    return f"{base_url.rstrip('/')}/proxy/image?url=" + quote(url, safe="")

def _proxyify_images_payload(base_url: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    try:
        imgs = payload.get("images")
        if isinstance(imgs, list):
            for it in imgs:
                if isinstance(it, dict) and it.get("url"):
                    it["url"] = _proxyify_url(base_url, str(it["url"]))
        img = payload.get("image")
        if isinstance(img, dict) and img.get("url"):
            img["url"] = _proxyify_url(base_url, str(img["url"]))
    except Exception:
        pass
    return payload

def _fetch_url_bytes(url: str) -> tuple[bytes, str]:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "ROARY/1.0",
            "Accept": "*/*",
        },
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        ct = resp.headers.get("Content-Type") or "application/octet-stream"
        data = resp.read()
    return data, ct



app = FastAPI(title="ROARY Router 5055", version="v243")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*", "null"],
    allow_credentials=False,
    allow_methods=["*"] ,
    allow_headers=["*"] ,
    allow_origin_regex=".*",
)


# --- Dev CORS fallback for file:// (Origin: null) ---
# CORSMiddleware should cover this, but some browsers treat file:// as Origin "null".
# This middleware force-adds CORS headers to every response so local HTML can call the router.
from starlette.requests import Request
from starlette.responses import Response as StarletteResponse

@app.middleware("http")
async def force_cors_headers(request: Request, call_next):
    """Guarantee CORS headers even when downstream throws.

    This matters for file:// (Origin: null) where the browser will hide the real error
    if Access-Control-Allow-Origin is missing.
    """
    try:
        # Handle preflight quickly
        if request.method == "OPTIONS":
            resp = StarletteResponse(status_code=204)
        else:
            resp = await call_next(request)
    except HTTPException as e:
        resp = JSONResponse({"ok": False, "detail": e.detail}, status_code=e.status_code)
    except Exception as e:
        # Don't leak huge tracebacks to the browser; keep it compact but useful.
        resp = JSONResponse({"ok": False, "detail": "Internal Server Error", "error": str(e)}, status_code=500)

    origin = request.headers.get("origin")
    # For file:// pages, Chrome sends Origin: null. Echo it back.
    if origin:
        resp.headers["Access-Control-Allow-Origin"] = origin
        resp.headers["Vary"] = "Origin"
    else:
        resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,DELETE,OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = request.headers.get("access-control-request-headers", "*")
    resp.headers["Access-Control-Max-Age"] = "86400"
    return resp

@app.options("/{path:path}")
async def options_any(path: str):
    # Preflight handled by middleware above; this just ensures route exists.
    return StarletteResponse(status_code=204)


@app.get("/health")
async def health():
    return {"ok": True, "service": "roary-router", "version": app.version}

@app.get("/healthz")
async def healthz():
    # Back-compat: some ROARY UI + scripts call /healthz
    return await health()

def _decode_data_url(data_url: str):
    head, b64 = data_url.split(",", 1)
    mime = "application/octet-stream"
    if head.startswith("data:"):
        mime = head[5:].split(";", 1)[0] or mime
    raw = base64.b64decode(b64)
    return raw, mime

def _guess_ext_from_mime(mime: str):
    ext = mimetypes.guess_extension(mime or "") or ""
    if ext == ".jpe":
        ext = ".jpg"
    return ext.lstrip(".") or "bin"

def _encode_image_bytes(raw: bytes, out_format: str, quality: int = 95, scale: int = 100, transparent: bool = True):
    """Encode raw image bytes to a target format with optional resize.

    - out_format: png | jpg | webp
    - quality: 40..100 (used for jpg/webp)
    - scale: percent 10..100
    - transparent: for PNG only; if False, alpha is flattened to white
    """
    im = Image.open(io.BytesIO(raw))
    try:
        im.load()
    except Exception:
        pass

    out_format = (out_format or "png").lower().strip()
    scale = int(scale or 100)
    if scale < 10:
        scale = 10
    if scale > 400:
        scale = 400

    if scale != 100:
        w, h = im.size
        nw = max(1, int(round(w * (scale / 100.0))))
        nh = max(1, int(round(h * (scale / 100.0))))
        resample = getattr(getattr(Image, 'Resampling', Image), 'LANCZOS', Image.BICUBIC)
        im = im.resize((nw, nh), resample)

    # JPG / JPEG
    if out_format in ("jpg", "jpeg"):
        if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
            rgba = im.convert("RGBA")
            bg = Image.new("RGB", rgba.size, (255, 255, 255))
            bg.paste(rgba, mask=rgba.split()[-1])
            im = bg
        else:
            im = im.convert("RGB")
        buf = io.BytesIO()
        im.save(buf, format="JPEG", quality=int(quality), optimize=True, progressive=True)
        return buf.getvalue(), "image/jpeg", "jpg"

    # WEBP
    if out_format == "webp":
        buf = io.BytesIO()
        # WEBP supports alpha, but keep behavior consistent: if transparency is disabled, flatten first
        if not transparent and (im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)):
            rgba = im.convert("RGBA")
            bg = Image.new("RGB", rgba.size, (255, 255, 255))
            bg.paste(rgba, mask=rgba.split()[-1])
            im = bg
        im.save(buf, format="WEBP", quality=int(quality), method=6)
        return buf.getvalue(), "image/webp", "webp"

    # PNG (default)
    buf = io.BytesIO()
    if not transparent:
        # Flatten alpha to white for PNG if transparency disabled
        if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
            rgba = im.convert("RGBA")
            bg = Image.new("RGB", rgba.size, (255, 255, 255))
            bg.paste(rgba, mask=rgba.split()[-1])
            im = bg
        else:
            im = im.convert("RGB") if im.mode not in ("RGB",) else im
    else:
        if im.mode == "P":
            im = im.convert("RGBA")
    im.save(buf, format="PNG", optimize=True)
    return buf.getvalue(), "image/png", "png"


@app.get("/proxy/image")
async def proxy_image(url: str):
    """Fetch an external image URL and return it from localhost.

    Helps when the browser can't reliably load fal.media (HTTP/3/QUIC) from a file:// origin.
    """
    try:
        data, ct = await asyncio.to_thread(_fetch_url_bytes, url)
        return Response(content=data, media_type=ct)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Proxy fetch failed: {e}")


# -----------------------------
# Mini Chat (NanoBanana ONLY)
# -----------------------------



@app.post("/tool/download_convert")
async def download_convert(request: Request):
    """Download helper that can optionally convert/resize images before returning as an attachment.

    Accepts (back-compat):
      - src or url: image URL (http/https), data: URL, etc.
      - preset: original | q95 | only (legacy)
    New options:
      - format: png | jpg | webp | original
      - scale: percent 10..100
      - quality: 40..100 (jpg/webp)
      - transparent: bool (png/webp only; if False, alpha flattened to white)
      - compress: bool (caps quality for smaller size)
      - filename: base filename (no extension)
    """
    payload = await request.json()

    src = (payload.get("src") or payload.get("url") or "").strip()
    preset = (payload.get("preset") or "").strip().lower()
    out_format = (payload.get("format") or payload.get("out_format") or "").strip().lower()
    scale = int(payload.get("scale") or payload.get("size") or 100)
    quality = int(payload.get("quality") or 95)

    # default transparency True unless explicitly false
    transparent_val = payload.get("transparent")
    transparent = True if transparent_val is None else bool(transparent_val)

    compress = bool(payload.get("compress") or False)

    filename = (payload.get("filename") or "roary_download").strip()
    filename = re.sub(r"[^\w.\-]+", "_", filename)[:80] or "roary_download"

    if not src:
        raise HTTPException(status_code=400, detail="Missing src")

    try:
        if src.startswith("data:"):
            raw, mime = _decode_data_url(src)
        else:
            raw, mime = await asyncio.to_thread(_fetch_url_bytes, src)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Fetch failed: {e}")

    # Back-compat: if format not supplied, infer from legacy preset
    if not out_format:
        if preset in ("original", "orig"):
            out_format = "original"
        elif preset in ("q95", "only", "hq", "high", "high_quality"):
            out_format = "jpg"
            quality = 95
        else:
            out_format = "png"

    if out_format == "jpeg":
        out_format = "jpg"

    # clamp inputs
    if scale < 10:
        scale = 10
    if scale > 400:
        scale = 400
    if quality < 40:
        quality = 40
    if quality > 100:
        quality = 100
    if compress:
        quality = min(quality, 85)

    if out_format in ("original", "orig"):
        if scale == 100:
            ext = _guess_ext_from_mime(mime)
            out = raw
            out_mime = mime or "application/octet-stream"
            out_name = f"{filename}.{ext}"
        else:
            # If user asks for resize but wants "original", export a resized PNG
            out, out_mime, ext = _encode_image_bytes(raw, "png", quality=quality, scale=scale, transparent=transparent)
            out_name = f"{filename}.{ext}"
    else:
        if out_format not in ("png", "jpg", "webp"):
            out_format = "png"
        out, out_mime, ext = _encode_image_bytes(raw, out_format, quality=quality, scale=scale, transparent=transparent)
        out_name = f"{filename}.{ext}"

    headers = {
        "Content-Disposition": f'attachment; filename="{out_name}"',
        "Cache-Control": "no-store",
    }
    return Response(content=out, media_type=out_mime, headers=headers)


@app.post("/tool/nano_banana_pro_edit")
async def nanobanana_pro_edit(
    request: Request,
    prompt: str = Form(...),
    image: Optional[UploadFile] = File(None),
    image_url: Optional[str] = Form(None),
    fetch_and_upload: int = Form(0),
    resolution: str = Form("1K"),
    num_images: int = Form(1),
    output_format: str = Form("png"),
    x_fal_key: Optional[str] = Header(None),
):
    """Proxy to fal-ai/nano-banana-pro/edit (used by mini chat)."""
    _maybe_set_fal_key(x_fal_key)
    _progress_set(progress_id, 1, "running", "start")
    img_in, img_key = await _resolve_image_input_with_key(image, image_url, fetch_and_upload=fetch_and_upload)
    args = {
        "prompt": prompt,
        "image_urls": [img_in],
        "resolution": resolution,
        "num_images": max(1, min(int(num_images), 4)),
        "output_format": output_format,
    }
    out = await _fal_run("fal-ai/nano-banana-pro/edit", args)
    out = _normalize_image_result(out)
    out = _proxyify_images_payload(str(request.base_url).rstrip('/'), out)
    out.update({"ok": True, "model": "fal-ai/nano-banana-pro/edit"})
    _progress_set(progress_id, 100, "done", "complete")
    return JSONResponse(out)


# ---------------------------------
# Remove / Erase (mask-based) tools
# ---------------------------------


@app.post("/tool/erase")
@app.post("/tool/remove")
@app.post("/tool/inpaint_remove")
async def erase_with_mask(
    request: Request,
    # Image input
    image: Optional[UploadFile] = File(None),
    image_url: Optional[str] = Form(None),
    fetch_and_upload: int = Form(0),
    # Mask input
    mask: Optional[UploadFile] = File(None),
    mask_url: Optional[str] = Form(None),
    mask_data_url: Optional[str] = Form(None),
    # Prompt is accepted for prompt-only fallback
    prompt: Optional[str] = Form(None),
    # Mask expansion (px)
    mask_expansion: int = Form(12),
    # Quality enum for object-removal/mask
    model: str = Form("best_quality"),
    output_format: str = Form("png"),
    x_fal_key: Optional[str] = Header(None),
):
    """Mask-driven removal. If no mask is supplied, fall back to FLUX edit."""
    _maybe_set_fal_key(x_fal_key)
    img_in, img_key = await _resolve_image_input_with_key(image, image_url, fetch_and_upload=fetch_and_upload)
    mask_in = await _resolve_mask_input(mask, mask_url, mask_data_url)

    if mask_in:
        args = {
            "image_url": img_in,
            "mask_url": mask_in,
            "mask_expansion": max(0, min(int(mask_expansion), 64)),
            "model": model,
            "output_format": output_format,
        }
        out = await _fal_run("fal-ai/object-removal/mask", args)
        out = _normalize_image_result(out)
        out = _proxyify_images_payload(str(request.base_url).rstrip('/'), out)
        out.update({"ok": True, "model": "fal-ai/object-removal/mask"})
        return JSONResponse(out)

    # No mask: prompt-based edit (NOT NanoBanana)
    p = (prompt or "").strip()
    if not p:
        raise HTTPException(status_code=400, detail="No mask provided. Paint a selection or add a prompt.")
    args2 = {
        "prompt": p,
        "image_urls": [img_in],
        "output_format": output_format,
    }
    out2 = await _fal_run("fal-ai/flux-2/turbo/edit", args2)
    out2 = _normalize_image_result(out2)
    out2 = _proxyify_images_payload(str(request.base_url).rstrip('/'), out2)
    out2.update({"ok": True, "model": "fal-ai/flux-2/turbo/edit"})
    return JSONResponse(out2)


# -----------------------------
# Expand (outpaint)
# -----------------------------


@app.post("/tool/expand")
@app.post("/tool/outpaint")
async def expand_outpaint(
    request: Request,
    image: Optional[UploadFile] = File(None),
    image_url: Optional[str] = Form(None),
    fetch_and_upload: int = Form(0),
    prompt: Optional[str] = Form(None),
    expand_left: int = Form(0),
    expand_right: int = Form(0),
    expand_top: int = Form(0),
    expand_bottom: int = Form(0),
    zoom_out_percentage: int = Form(0),
    output_format: str = Form("png"),
    x_fal_key: Optional[str] = Header(None),
):
    _maybe_set_fal_key(x_fal_key)
    img_in, img_key = await _resolve_image_input_with_key(image, image_url, fetch_and_upload=fetch_and_upload)
    args = {
        "image_url": img_in,
        "prompt": (prompt or "").strip(),
        "expand_left": max(0, min(int(expand_left), 2048)),
        "expand_right": max(0, min(int(expand_right), 2048)),
        "expand_top": max(0, min(int(expand_top), 2048)),
        "expand_bottom": max(0, min(int(expand_bottom), 2048)),
        "zoom_out_percentage": max(0, min(int(zoom_out_percentage), 90)),
        "output_format": output_format,
    }
    out = await _fal_run("fal-ai/image-apps-v2/outpaint", args)
    out = _normalize_image_result(out)
    out = _proxyify_images_payload(str(request.base_url).rstrip('/'), out)
    out.update({"ok": True, "model": "fal-ai/image-apps-v2/outpaint"})
    return JSONResponse(out)


# -----------------------------
# DepthPop (replaces Enhance)
# -----------------------------



# -----------------------------
# DepthPop depth-map cache (speeds up live slider previews)
# -----------------------------
# Key: sha256(image_bytes or image_url/data_uri string)
# Value: {"url": <depth_map_url>, "ts": <epoch_seconds>}
_DEPTH_CACHE: Dict[str, Dict[str, Any]] = {}
_DEPTH_CACHE_MAX = 16  # small LRU-ish cache; enough for current session

def _depth_cache_get(key: str) -> Optional[str]:
    try:
        item = _DEPTH_CACHE.get(key)
        if not item:
            return None
        # refresh timestamp for LRU-ish behavior
        item["ts"] = time.time()
        return item.get("url")
    except Exception:
        return None

def _depth_cache_set(key: str, url: str) -> None:
    if not key or not url:
        return
    try:
        _DEPTH_CACHE[key] = {"url": url, "ts": time.time()}
        # evict oldest
        if len(_DEPTH_CACHE) > _DEPTH_CACHE_MAX:
            oldest_key = min(_DEPTH_CACHE.keys(), key=lambda k: _DEPTH_CACHE[k].get("ts", 0))
            _DEPTH_CACHE.pop(oldest_key, None)
    except Exception:
        pass


# -----------------------------
# Tool progress tracker (DepthPop)
# -----------------------------
_PROGRESS: Dict[str, Dict[str, Any]] = {}
_PROGRESS_TTL = 60 * 15  # 15 minutes

def _progress_cleanup() -> None:
    try:
        now = time.time()
        dead = [k for k,v in _PROGRESS.items() if (now - float(v.get("ts",0))) > _PROGRESS_TTL]
        for k in dead:
            _PROGRESS.pop(k, None)
    except Exception:
        pass

def _progress_set(pid: Optional[str], percent: int, status: str = "running", msg: str = "") -> None:
    if not pid:
        return
    try:
        _progress_cleanup()
        _PROGRESS[str(pid)] = {
            "percent": int(max(0, min(100, int(percent)))),
            "status": str(status),
            "msg": str(msg or ""),
            "ts": time.time(),
        }
    except Exception:
        pass

@app.get("/tool/progress/{progress_id}")
async def tool_progress(progress_id: str):
    _progress_cleanup()
    rec = _PROGRESS.get(str(progress_id))
    if not rec:
        return JSONResponse({"ok": False, "error": "not_found"}, status_code=200)
    out = {"ok": True}
    out.update(rec)
    return JSONResponse(out, status_code=200)

# -----------------------------
# In-memory image cache (for fast local renders)
# -----------------------------
_IMG_CACHE: Dict[str, Dict[str, Any]] = {}
_IMG_CACHE_MAX = 32

def _img_cache_put(raw: bytes, mime: str) -> str:
    try:
        h = hashlib.sha256(raw).hexdigest()[:24]
        _IMG_CACHE[h] = {"raw": raw, "mime": mime or "image/png", "ts": time.time()}
        if len(_IMG_CACHE) > _IMG_CACHE_MAX:
            oldest_key = min(_IMG_CACHE.keys(), key=lambda k: _IMG_CACHE[k].get("ts", 0))
            _IMG_CACHE.pop(oldest_key, None)
        return h
    except Exception:
        # fallback: time-based id
        h = str(int(time.time()*1000))
        _IMG_CACHE[h] = {"raw": raw, "mime": mime or "image/png", "ts": time.time()}
        return h

@app.get("/cache/image/{img_id}")
async def cache_image(img_id: str):
    item = _IMG_CACHE.get(img_id)
    if not item:
        raise HTTPException(status_code=404, detail="Image not found")
    # refresh LRU
    try:
        item["ts"] = time.time()
    except Exception:
        pass
    return Response(content=item.get("raw", b""), media_type=item.get("mime", "image/png"), headers={"Cache-Control": "no-store"})


def _data_url_to_bytes(data_url: str) -> tuple[bytes, str]:
    s = (data_url or "").strip()
    if not s.startswith("data:"):
        return b"", ""
    try:
        head, b64 = s.split(",", 1)
        mime = head[5:].split(";", 1)[0] or "application/octet-stream"
        raw = base64.b64decode(b64)
        return raw, mime
    except Exception:
        return b"", ""


def _resize_max_width(raw: bytes, max_w: int) -> bytes:
    if not raw or not max_w or max_w <= 0:
        return raw
    try:
        im = Image.open(io.BytesIO(raw))
        im.load()
        w, h = im.size
        if w <= max_w:
            return raw
        scale = max_w / float(w)
        new_h = max(1, int(round(h * scale)))
        im = im.convert("RGB").resize((max_w, new_h), Image.LANCZOS)
        out = io.BytesIO()
        im.save(out, format="PNG", optimize=True)
        return out.getvalue()
    except Exception:
        return raw


def _depth_infer_width(depth_fidelity: float, quality_steps: int, preview: bool) -> int:
    # depth_fidelity: 0.05-1.0. Higher = more accurate edges.
    df = max(0.05, min(float(depth_fidelity), 1.0))
    steps = int(max(8, min(int(quality_steps), 50)))
    if preview:
        return 512 if df < 0.75 else 768
    # quality steps roughly map to presets
    if steps >= 30:
        return 1280 if df >= 0.75 else 1024
    if steps >= 20:
        return 1024 if df >= 0.65 else 768
    return 768 if df >= 0.75 else 512


def _auto_invert_and_focus(depth01: np.ndarray) -> tuple[bool, float]:
    # Heuristic: compare center vs edges (same as client preview)
    h, w = depth01.shape
    if h < 4 or w < 4:
        return False, 0.35
    cy0, cy1 = int(h * 0.35), int(h * 0.65)
    cx0, cx1 = int(w * 0.35), int(w * 0.65)
    center = float(depth01[cy0:cy1, cx0:cx1].mean())
    top = float(depth01[0:int(h*0.12), :].mean())
    bot = float(depth01[int(h*0.88):, :].mean())
    left = float(depth01[int(h*0.12):int(h*0.88), 0:int(w*0.12)].mean())
    right = float(depth01[int(h*0.12):int(h*0.88), int(w*0.88):].mean())
    edges = 0.25*(top+bot+left+right)
    invert = center > edges
    oriented = (1.0 - depth01) if invert else depth01
    # sample for focus
    flat = oriented.reshape(-1)
    n = flat.size
    if n <= 0:
        return invert, 0.35
    # random sample up to 6000
    k = min(6000, n)
    idx = np.random.choice(n, size=k, replace=False) if n > k else np.arange(n)
    sample = np.take(flat, idx)
    focus = float(np.quantile(sample, 0.35))
    focus = max(0.05, min(focus, 0.95))
    return invert, focus


def _apply_depth_lens_blur(
    img_rgb: Image.Image,
    depth01: np.ndarray,
    depth_fidelity: float,
    strength: float,
    bokeh: int,
    quality_steps: int,
) -> Image.Image:
    """Fast depth-of-field using cached depth. Preserves pixels (no hallucinations)."""
    # clamp inputs
    df = max(0.05, min(float(depth_fidelity), 1.0))
    s = max(0.05, min(float(strength), 0.95))
    b = max(0, min(int(bokeh), 100))
    steps = int(max(8, min(int(quality_steps), 50)))

    # Feather (edge softness) inversely follows fidelity
    feather_px = max(1.0, (1.0 - df) * 14.0 + 2.0)

    # Smooth depth to avoid crunchy edges
    try:
        dimg = Image.fromarray((depth01 * 255.0).astype(np.uint8), mode="L")
        dimg = dimg.filter(ImageFilter.GaussianBlur(radius=float(feather_px)))
        depth01 = (np.asarray(dimg).astype(np.float32) / 255.0)
    except Exception:
        pass

    invert, focus = _auto_invert_and_focus(depth01)
    oriented = (1.0 - depth01) if invert else depth01

    # Blur curve: higher fidelity -> steeper curve (cleaner separation)
    curve = 1.15 + (df - 0.5) * 1.25
    curve = max(0.75, min(curve, 2.25))

    # Max blur radius: bokeh percent with sensible caps
    max_radius = (b / 100.0) * (22.0 if steps >= 30 else 18.0 if steps >= 20 else 14.0)
    max_radius *= (0.70 + 0.60 * s)
    max_radius = float(max(0.0, min(max_radius, 26.0)))

    # Number of blur levels: steps proxy
    levels = 10 if steps >= 30 else 8 if steps >= 20 else 6

    # Safety for huge images
    w, h = img_rgb.size
    if w * h > 3_600_000:  # ~2560x1440
        levels = max(5, levels - 2)
        max_radius = min(max_radius, 18.0)

    if max_radius <= 0.15 or levels <= 1:
        return img_rgb

    # Create blurred pyramid
    img_rgb = img_rgb.convert("RGB")
    base = np.asarray(img_rgb).astype(np.float32)
    blurs = []
    radii = [max_radius * (i / (levels - 1)) for i in range(levels)]
    for r in radii:
        if r <= 0.05:
            blurs.append(base)
        else:
            bim = img_rgb.filter(ImageFilter.GaussianBlur(radius=float(r)))
            blurs.append(np.asarray(bim).astype(np.float32))

    stack = np.stack(blurs, axis=0)  # (L,H,W,3)

    # Blur map (0..1)
    dist = np.abs(oriented - focus)
    blur_map = np.power(np.clip(dist / 0.85, 0.0, 1.0), curve)  # normalize a bit
    blur_map = np.clip(blur_map * (0.55 + 0.90 * s), 0.0, 1.0)

    # pick two nearest levels
    level_f = blur_map * (levels - 1)
    idx0 = np.floor(level_f).astype(np.int32)
    idx1 = np.clip(idx0 + 1, 0, levels - 1)
    t = (level_f - idx0).astype(np.float32)

    rows = np.arange(h, dtype=np.int32)[:, None]
    cols = np.arange(w, dtype=np.int32)[None, :]
    out0 = stack[idx0, rows, cols]
    out1 = stack[idx1, rows, cols]
    out = out0 * (1.0 - t[..., None]) + out1 * (t[..., None])
    out = np.clip(out, 0, 255).astype(np.uint8)
    return Image.fromarray(out, mode="RGB")


async def _resolve_image_input_with_key(
    image: UploadFile | None,
    image_url: str | None,
    fetch_and_upload: int = 0,
) -> tuple[str, str]:
    """Return (fal_input, cache_key). If fetch_and_upload=1 and a http(s) URL is provided,
    the router fetches bytes and converts to a data URL so FAL doesn't need network access to the URL."""
    if image is not None:
        raw = await image.read()
        if not raw:
            raise HTTPException(400, "Empty image upload")
        mime = image.content_type or "image/png"
        fal_in = _bytes_to_data_url(raw, mime)
        key = hashlib.sha256(raw).hexdigest()
        return fal_in, key

    s = (image_url or "").strip()
    if not s:
        raise HTTPException(400, "Provide image or image_url")

    if s.startswith("blob:") or s.startswith("file:"):
        raise HTTPException(400, "Invalid image_url scheme (blob/file). Upload bytes instead.")

    if fetch_and_upload and (s.startswith("http://") or s.startswith("https://")):
        raw, mime = await asyncio.to_thread(_fetch_url_bytes, s)
        fal_in = _bytes_to_data_url(raw, mime or "image/png")
        key = hashlib.sha256(raw).hexdigest()
        return fal_in, key

    key = hashlib.sha256(s.encode("utf-8")).hexdigest()
    return s, key

    raise HTTPException(status_code=400, detail="Missing image or image_url")

_DEPTHPOP_DEFAULT_PROMPT = (
    "Preserve the image exactly and keep the same subjects, faces, text, and composition. "
    "Add a subtle cinematic depth pop: crisp foreground subject, gentle background bokeh/DOF, "
    "enhanced separation, realistic lighting continuity, no new objects, no style drift."
)


@app.post("/tool/depthmap")
async def depthmap(
    request: Request,
    image: UploadFile = File(None),
    image_url: str = Form(""),
    fetch_and_upload: int = Form(0),
    x_fal_key: str = Header(None),
):
    """Returns a depth map URL for the given image. Cached by image key."""
    _maybe_set_fal_key(x_fal_key)
    try:
        fal_in, img_key = await _resolve_image_input_with_key(image, image_url, fetch_and_upload=fetch_and_upload)
        cached = _depth_cache_get(img_key)
        if not cached:
            depth_res = await _fal_run("fal-ai/image-preprocessors/depth-anything/v2", {"image_url": fal_in})
            cached = (_extract_image_url(depth_res) or "").strip()
            if cached:
                _depth_cache_set(img_key, cached)

        if not cached:
            return JSONResponse({"ok": False, "error": "Depth map generation failed", "image_key": img_key}, status_code=200)

        return JSONResponse({
            "ok": True,
            "depth_map_url": _proxyify_url(str(request.base_url).rstrip("/"), cached),
            "image_key": img_key,
        }, status_code=200)
    except HTTPException as e:
        return JSONResponse({"ok": False, "error": getattr(e, "detail", str(e)), "status": e.status_code}, status_code=200)
    except Exception as e:
        # Never 500 here — the frontend falls back gracefully if ok=false.
        return JSONResponse({"ok": False, "error": str(e)}, status_code=200)

@app.post("/tool/depth_pop")
@app.post("/tool/depthpop")
@app.post("/tool/enhance")
async def depth_pop(
    request: Request,
    image: Optional[UploadFile] = File(None),
    image_url: Optional[str] = Form(None),
    prompt: Optional[str] = Form(None),
    strength: float = Form(0.30),
    bokeh: int = Form(35),
    # Depth Fidelity: how strongly the depth map constrains the effect (higher = more depth-accurate)
    depth_fidelity: Optional[float] = Form(None),
    # Legacy (deprecated): previously UI used guidance_scale; we ignore it (DepthPop has no prompt).
    guidance_scale_legacy: Optional[float] = Form(None, alias="guidance_scale"),
    control_lora_strength: float = Form(0.95),
    num_inference_steps: int = Form(22),
    preview: int = Form(0),
    fetch_and_upload: int = Form(0),
    output_format: str = Form("png"),
    x_fal_key: Optional[str] = Header(None),
):
    """DepthPop pipeline:
    1) depth-anything v2 -> depth map
    2) flux-control-lora-depth img2img using that depth map
    """

    guidance_scale = 3.5  # fixed (no extra prompt)

    # Live preview (frontend slider drag): clamp compute for speed.
    if preview:
        num_inference_steps = max(6, min(int(num_inference_steps), 50))
        guidance_scale = 3.5  # fixed; DepthPop has no prompt, so guidance is not user-facing
        strength = max(0.05, min(float(strength), 0.65))
        # Keep the depth-control influence stable while the user is scrubbing sliders.
        try:
            control_lora_strength = float(depth_fidelity) if depth_fidelity is not None else float(control_lora_strength)
        except Exception:
            control_lora_strength = 0.95
        control_lora_strength = max(0.25, min(control_lora_strength, 1.0))
        output_format = "jpg"  # always faster for previews
    else:
        # Final renders can tolerate slightly wider ranges.
        try:
            control_lora_strength = float(depth_fidelity) if depth_fidelity is not None else float(control_lora_strength)
        except Exception:
            control_lora_strength = 0.95
        control_lora_strength = max(0.05, min(control_lora_strength, 1.0))

    _maybe_set_fal_key(x_fal_key)
    img_in, img_key = await _resolve_image_input_with_key(image, image_url, fetch_and_upload=fetch_and_upload)
    _progress_set(progress_id, 10, "running", "image_loaded")

    # 1) Depth map (cached)
    depth_img = _depth_cache_get(img_key)

    if not depth_img:
        depth_res = await _fal_run(
            "fal-ai/image-preprocessors/depth-anything/v2",
            {"image_url": img_in},
        )

        depth_img = None
        if isinstance(depth_res, dict):
            img_obj = depth_res.get("image")
            if isinstance(img_obj, dict):
                depth_img = img_obj.get("url")

            if not depth_img and isinstance(depth_res.get("data"), dict):
                img_obj = (depth_res["data"].get("image") or None)
                if isinstance(img_obj, dict):
                    depth_img = img_obj.get("url")

        if depth_img:
            _depth_cache_set(img_key, depth_img)

    if not depth_img:
        _progress_set(progress_id, 100, "error", "depth_failed")
        raise HTTPException(status_code=502, detail="Depth map generation failed (no depth output).")

    # 2) Fast depth-of-field render (preserve pixels; no hallucinations)
    # Treat the old "steps" as a quality proxy (more levels / sharper edges)
    steps_q = int(max(8, min(int(num_inference_steps), 50)))

    # Resolve original image bytes
    raw_img = b""
    mime = ""
    if img_in.startswith("data:"):
        raw_img, mime = _data_url_to_bytes(img_in)
    elif img_in.startswith("http://") or img_in.startswith("https://"):
        raw_img, mime = await asyncio.to_thread(_fetch_url_bytes, img_in)
    if not raw_img:
        _progress_set(progress_id, 100, "error", "input_bytes_failed")
        raise HTTPException(status_code=400, detail="Could not read input image bytes")

    # Optionally downscale for preview mode
    if preview:
        try:
            max_w = 768 if steps_q >= 20 else 640
            raw_img = _resize_max_width(raw_img, max_w)
        except Exception:
            pass

    # Depth fidelity now also controls depth inference resolution
    infer_w = _depth_infer_width(control_lora_strength, steps_q, bool(preview))
    depth_cache_key = f"{img_key}:{infer_w}"

    depth_img = _depth_cache_get(depth_cache_key)
    if not depth_img:
        try:
            depth_input = img_in
            # compute depth on resized input for speed/accuracy balance
            if img_in.startswith("data:") and infer_w:
                depth_bytes = _resize_max_width(raw_img, infer_w)
                depth_input = _bytes_to_data_url(depth_bytes, "image/png")
            depth_res = await _fal_run(
                "fal-ai/image-preprocessors/depth-anything/v2",
                {"image_url": depth_input},
            )
            depth_img = (_extract_image_url(depth_res) or "").strip()
            if depth_img:
                _depth_cache_set(depth_cache_key, depth_img)
        except Exception as e:
            depth_img = None

    if not depth_img:
        _progress_set(progress_id, 100, "error", "depth_failed")
        raise HTTPException(status_code=502, detail="Depth map generation failed (no depth output).")

    # Fetch depth bytes and align to image size
    depth_raw, depth_mime = await asyncio.to_thread(_fetch_url_bytes, depth_img)
    _progress_set(progress_id, 55, "running", "depth_fetched")
    if not depth_raw:
        raise HTTPException(status_code=502, detail="Depth map fetch failed")

    def _render():
        im = Image.open(io.BytesIO(raw_img))
        im.load()
        im = im.convert("RGB")
        dm = Image.open(io.BytesIO(depth_raw))
        dm.load()
        dm = dm.convert("L").resize(im.size, Image.BILINEAR)
        depth01 = (np.asarray(dm).astype(np.float32) / 255.0)
        out_im = _apply_depth_lens_blur(
            im,
            depth01,
            depth_fidelity=control_lora_strength,
            strength=float(strength),
            bokeh=int(bokeh),
            quality_steps=steps_q,
        )
        buf = io.BytesIO()
        fmt = (output_format or "png").lower()
        if fmt in ("jpg", "jpeg"):
            out_im.save(buf, format="JPEG", quality=95, optimize=True)
            return buf.getvalue(), "image/jpeg"
        if fmt == "webp":
            out_im.save(buf, format="WEBP", quality=95, method=6)
            return buf.getvalue(), "image/webp"
        # default png
        out_im.save(buf, format="PNG", optimize=True)
        return buf.getvalue(), "image/png"

    _progress_set(progress_id, 72, "running", "render")
    out_bytes, out_mime = await asyncio.to_thread(_render)
    _progress_set(progress_id, 95, "running", "encode")
    img_id = _img_cache_put(out_bytes, out_mime)
    out_url = f"{str(request.base_url).rstrip('/')}/cache/image/{img_id}"

    out = {
        "images": [{"url": out_url}],
        "ok": True,
        "model": "roary-depthpop-fast-dof",
        "depth_map_url": _proxyify_url(str(request.base_url).rstrip('/'), depth_img),
        "controls": {
            "preview": int(preview),
            "strength": float(strength),
            "bokeh": int(bokeh),
            "depth_fidelity": float(control_lora_strength),
            "num_inference_steps": int(steps_q),
            "depth_infer_width": int(infer_w),
        },
    }
    return JSONResponse(out)


# -----------------------------
# Upscale (used by mini chat + node tools)
# -----------------------------


@app.post("/tool/upscale")
@app.post("/tool/clarity_upscale")
@app.post("/tool/hd")
async def upscale(
    request: Request,
    image: Optional[UploadFile] = File(None),
    image_url: Optional[str] = Form(None),
    fetch_and_upload: int = Form(0),
    scale: float = Form(2),
    face: bool = Form(False),
    model: str = Form("RealESRGAN_x4plus"),
    output_format: str = Form("png"),
    x_fal_key: Optional[str] = Header(None),
):
    _maybe_set_fal_key(x_fal_key)
    img_in, img_key = await _resolve_image_input_with_key(image, image_url, fetch_and_upload=fetch_and_upload)
    args = {
        "image_url": img_in,
        "scale": float(max(1.0, min(float(scale), 8.0))),
        "face": bool(face),
        "model": model,
        "output_format": output_format,
    }
    out = await _fal_run("fal-ai/esrgan", args)
    out = _normalize_image_result(out)
    out = _proxyify_images_payload(str(request.base_url).rstrip('/'), out)
    out.update({"ok": True, "model": "fal-ai/esrgan"})
    return JSONResponse(out)


# -----------------------------
# Video search (basic YouTube scrape)
# -----------------------------


@app.get("/tool/video_search")
async def video_search(q: str, count: int = 3):
    """Lightweight YouTube search.

    Returns: { ok: true, videos: [{title,page_url,thumbnail,channel}] }
    """
    import json
    import urllib.parse
    import urllib.request

    query = (q or "").strip()
    if not query:
        return {"ok": True, "videos": []}

    url = "https://www.youtube.com/results?" + urllib.parse.urlencode({"search_query": query})
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36"
        },
    )
    try:
        html = urllib.request.urlopen(req, timeout=10).read().decode("utf-8", errors="ignore")
    except Exception:
        return {"ok": True, "videos": []}

    # Extract ytInitialData JSON
    m = re.search(r"var ytInitialData = (\{.*?\});", html, flags=re.S)
    if not m:
        m = re.search(r"ytInitialData\s*=\s*(\{.*?\});", html, flags=re.S)
    if not m:
        return {"ok": True, "videos": []}

    try:
        data = json.loads(m.group(1))
    except Exception:
        return {"ok": True, "videos": []}

    vids: List[Dict[str, Any]] = []
    try:
        contents = (
            data["contents"]["twoColumnSearchResultsRenderer"]["primaryContents"][
                "sectionListRenderer"
            ]["contents"]
        )
    except Exception:
        contents = []

    def walk(obj):
        if isinstance(obj, dict):
            if "videoRenderer" in obj:
                vr = obj["videoRenderer"]
                vid = vr.get("videoId")
                if vid:
                    title_runs = ((vr.get("title") or {}).get("runs") or [])
                    title = title_runs[0].get("text") if title_runs else ""
                    channel_runs = ((vr.get("ownerText") or {}).get("runs") or [])
                    channel = channel_runs[0].get("text") if channel_runs else ""
                    thumb_list = ((vr.get("thumbnail") or {}).get("thumbnails") or [])
                    thumb = thumb_list[-1].get("url") if thumb_list else ""
                    vids.append(
                        {
                            "title": title,
                            "source": "youtube",
                            "channel": channel,
                            "page_url": f"https://www.youtube.com/watch?v={vid}",
                            "thumbnail": thumb,
                        }
                    )
            for v in obj.values():
                walk(v)
        elif isinstance(obj, list):
            for it in obj:
                walk(it)

    walk(contents)
    # de-dupe
    seen = set()
    out = []
    for v in vids:
        pu = v.get("page_url")
        if not pu or pu in seen:
            continue
        seen.add(pu)
        out.append(v)
        if len(out) >= max(1, min(int(count), 10)):
            break
    return {"ok": True, "videos": out}