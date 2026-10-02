from __future__ import annotations

from urllib.parse import urlparse

import httpx
from fastapi import HTTPException

MAX_PROVIDER_IMAGE_BYTES = 50 * 1024 * 1024
FAL_MEDIA_BASES = {
    "fal.media": "https://fal.media",
    "v2.fal.media": "https://v2.fal.media",
    "v3.fal.media": "https://v3.fal.media",
}


def fal_media_target(url: str) -> tuple[str, str]:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    base = FAL_MEDIA_BASES.get(host)
    if parsed.scheme.lower() != "https" or not base:
        raise HTTPException(
            status_code=502,
            detail="FAL provider returned an unexpected file host.",
        )
    if not parsed.path.startswith("/") or parsed.path.startswith("//"):
        raise HTTPException(
            status_code=502,
            detail="FAL provider returned an invalid file path.",
        )
    target = parsed.path
    if parsed.query:
        target += "?" + parsed.query
    return base, target


async def fetch_fal_media(url: str) -> bytes:
    base, target = fal_media_target(url)
    async with httpx.AsyncClient(
        base_url=base,
        timeout=httpx.Timeout(30.0),
        follow_redirects=False,
        headers={"User-Agent": "depthpop-canva/1.0"},
    ) as client:
        response = await client.get(target)

    if response.status_code in {301, 302, 303, 307, 308}:
        raise HTTPException(
            status_code=502,
            detail="FAL provider media redirected unexpectedly.",
        )
    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail="FAL provider media download failed.",
        )

    raw = response.content
    if not raw or len(raw) > MAX_PROVIDER_IMAGE_BYTES:
        raise HTTPException(
            status_code=502,
            detail="FAL provider media was empty or too large.",
        )
    return raw
