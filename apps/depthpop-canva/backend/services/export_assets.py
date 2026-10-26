"""Owned export asset collection and portable encodings."""
import base64
from typing import Awaitable, Callable
from models.scene import DepthScene
AssetFetcher = Callable[[str], Awaitable[bytes]]

def _mime_for_bytes(payload: bytes) -> str:
    if payload.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if payload.startswith(b"\xff\xd8"):
        return "image/jpeg"
    if payload[:4] == b"RIFF" and payload[8:12] == b"WEBP":
        return "image/webp"
    return "application/octet-stream"


def _data_url(payload: bytes, mime: str | None = None) -> str:
    resolved = mime or _mime_for_bytes(payload)
    return f"data:{resolved};base64," + base64.b64encode(payload).decode("ascii")


def _safe_name(value: str) -> str:
    clean = "".join(char if char.isalnum() or char in "-_" else "-" for char in value)
    return clean.strip("-_")[:96] or "asset"


async def _collect_scene_assets(
    scene: DepthScene,
    fetch_asset: AssetFetcher,
) -> dict[str, bytes]:
    urls = {
        scene.reconstructedPlate.imageUrl,
        scene.reconstructedPlate.depthMapUrl,
    }
    for obj in scene.objects:
        urls.update(
            {
                obj.assets.cutoutUrl,
                obj.assets.maskUrl,
                obj.assets.thumbnailUrl,
            }
        )
    collected: dict[str, bytes] = {}
    for url in sorted(urls):
        collected[url] = await fetch_asset(url)
    return collected


