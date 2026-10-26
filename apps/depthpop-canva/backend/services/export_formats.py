from __future__ import annotations

import asyncio
import base64
import io
import json
import math
import os
import shutil
import struct
import subprocess
import zipfile
from pathlib import Path
from typing import Awaitable, Callable

from PIL import Image

from models.export import ExportRequest
from models.object import AnimationTrack, DepthObject, ObjectTransform, Vector3
from models.scene import DepthScene
from services.compositor import composite_scene
# Preserve the existing facade used by jobs and integrations.
from services.export_assets import _mime_for_bytes, _data_url, _safe_name, _collect_scene_assets
from services.export_animation import scene_at_time
from services.export_gltf import export_gltf_or_glb

AssetFetcher = Callable[[str], Awaitable[bytes]]
ProgressReporter = Callable[[str, float], Awaitable[None]]
CancelChecker = Callable[[], Awaitable[bool]]

from services.export_limits import MAX_EXPORT_PIXELS, MAX_EXPORT_FRAMES, MAX_EXPORT_DURATION_MS


async def export_portable_scene_json(
    scene: DepthScene,
    fetch_asset: AssetFetcher,
    target: Path,
) -> tuple[Path, str]:
    assets = await _collect_scene_assets(scene, fetch_asset)
    payload = {
        "format": "depthscene-portable-v1",
        "scene": scene.model_dump(mode="json", by_alias=True),
        "assets": {
            url: {
                "mimeType": _mime_for_bytes(data),
                "dataUrl": _data_url(data),
            }
            for url, data in assets.items()
        },
    }
    target.write_text(
        json.dumps(payload, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    return target, "application/json"


async def export_png_layers(
    scene: DepthScene,
    fetch_asset: AssetFetcher,
    target: Path,
) -> tuple[Path, str]:
    assets = await _collect_scene_assets(scene, fetch_asset)
    manifest = {
        "format": "depthpop-layer-package-v1",
        "scene": scene.model_dump(mode="json", by_alias=True),
        "files": {},
    }
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        plate = assets[scene.reconstructedPlate.imageUrl]
        depth = assets[scene.reconstructedPlate.depthMapUrl]
        archive.writestr("base/reconstructed-plate.png", plate)
        archive.writestr("base/depth-map.png", depth)
        manifest["files"]["reconstructedPlate"] = "base/reconstructed-plate.png"
        manifest["files"]["depthMap"] = "base/depth-map.png"

        object_files: dict[str, dict[str, str]] = {}
        for obj in scene.objects:
            stem = _safe_name(obj.id)
            cutout_name = f"objects/{stem}.png"
            mask_name = f"objects/{stem}-mask.png"
            archive.writestr(cutout_name, assets[obj.assets.cutoutUrl])
            archive.writestr(mask_name, assets[obj.assets.maskUrl])
            object_files[obj.id] = {
                "cutout": cutout_name,
                "mask": mask_name,
            }
        manifest["files"]["objects"] = object_files
        archive.writestr(
            "scene.json",
            json.dumps(manifest, indent=2, sort_keys=True).encode("utf-8"),
        )
    return target, "application/zip"


async def export_video(
    scene: DepthScene,
    fetch_asset: AssetFetcher,
    target: Path,
    request: ExportRequest,
    workspace: Path,
    report: ProgressReporter,
    is_cancelled: CancelChecker,
) -> tuple[Path, str]:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg is required for DepthPop video export")

    duration_ms = scene.timeline.durationMs if request.includeAnimation else 0
    if duration_ms > MAX_EXPORT_DURATION_MS:
        raise ValueError("DepthScene duration exceeds DEPTHPOP_MAX_EXPORT_DURATION_MS")

    fps = request.fps or scene.timeline.fps
    fps = max(1, min(60, fps))
    frame_count = (
        max(1, int(math.ceil(duration_ms / 1000.0 * fps)) + 1)
        if duration_ms > 0
        else 1
    )
    if frame_count > MAX_EXPORT_FRAMES:
        raise ValueError("DepthScene export exceeds DEPTHPOP_MAX_EXPORT_FRAMES")

    width = request.resolution.width if request.resolution else scene.width
    height = request.resolution.height if request.resolution else scene.height
    if width * height > MAX_EXPORT_PIXELS:
        raise ValueError("DepthScene export exceeds DEPTHPOP_MAX_EXPORT_PIXELS")

    frames_dir = workspace / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)
    await report("rendering_frames", 0.18)

    for index in range(frame_count):
        if await is_cancelled():
            raise asyncio.CancelledError()
        time_ms = (
            round(duration_ms * index / max(1, frame_count - 1))
            if duration_ms > 0
            else scene.timeline.currentTimeMs
        )
        frame_scene = scene_at_time(scene, time_ms)
        png = await composite_scene(frame_scene, fetch_asset)
        if (width, height) != (scene.width, scene.height):
            with Image.open(io.BytesIO(png)) as image:
                resized = image.convert("RGBA").resize(
                    (width, height),
                    Image.Resampling.LANCZOS,
                )
                resized.save(
                    frames_dir / f"frame_{index:05d}.png",
                    format="PNG",
                    optimize=True,
                )
        else:
            (frames_dir / f"frame_{index:05d}.png").write_bytes(png)
        await report(
            "rendering_frames",
            0.18 + 0.62 * ((index + 1) / frame_count),
        )

    if await is_cancelled():
        raise asyncio.CancelledError()

    await report("encoding_video", 0.84)
    input_pattern = str(frames_dir / "frame_%05d.png")
    if request.format == "mp4":
        command = [
            ffmpeg,
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-framerate",
            str(fps),
            "-i",
            input_pattern,
            "-an",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(target),
        ]
        mime = "video/mp4"
    else:
        command = [
            ffmpeg,
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-framerate",
            str(fps),
            "-i",
            input_pattern,
            "-an",
            "-c:v",
            "libvpx-vp9",
            "-pix_fmt",
            "yuv420p",
            "-b:v",
            "0",
            "-crf",
            "28",
            str(target),
        ]
        mime = "video/webm"

    completed = await asyncio.to_thread(
        subprocess.run,
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=300,
        check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(
            f"ffmpeg {request.format} encode failed: {completed.stderr[-2000:]}"
        )
    if not target.is_file() or target.stat().st_size <= 0:
        raise RuntimeError("ffmpeg produced no video artifact")
    return target, mime
