from __future__ import annotations

import asyncio
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Protocol

from models import HoloExportRequest, HoloScene

MIME_BY_FORMAT = {
    "scene-json": "application/json",
    "glb": "model/gltf-binary",
    "gltf": "model/gltf+json",
    "usdz": "model/vnd.usdz+zip",
    "webm-alpha": "video/webm",
    "mp4": "video/mp4",
    "png-sequence": "application/zip",
    "lightfield-quilt": "image/png",
}

EXTENSION_BY_FORMAT = {
    "scene-json": ".holoscene.json",
    "glb": ".glb",
    "gltf": ".gltf",
    "usdz": ".usdz",
    "webm-alpha": ".webm",
    "mp4": ".mp4",
    "png-sequence": ".zip",
    "lightfield-quilt": ".png",
}


class Renderer(Protocol):
    def supports(self, format_name: str) -> bool: ...
    async def render(
        self,
        scene: HoloScene,
        request: HoloExportRequest,
        output_dir: Path,
    ) -> tuple[Path, str]: ...


class SceneJsonRenderer:
    def supports(self, format_name: str) -> bool:
        return format_name == "scene-json"

    async def render(
        self,
        scene: HoloScene,
        request: HoloExportRequest,
        output_dir: Path,
    ) -> tuple[Path, str]:
        del request
        path = output_dir / (safe_stem(scene.id) + ".holoscene.json")
        path.write_text(scene.model_dump_json(indent=2), encoding="utf-8")
        return path, MIME_BY_FORMAT["scene-json"]


class BlenderRenderer:
    IMPLEMENTED = frozenset({"glb", "gltf", "usdz", "webm-alpha", "mp4", "png-sequence", "lightfield-quilt"})

    def __init__(self, blender_bin: str | None = None) -> None:
        self.blender_bin = (
            blender_bin
            or os.getenv("BLENDER_BIN", "").strip()
            or shutil.which("blender")
            or ""
        )
        self.worker = Path(__file__).with_name("blender_worker.py")

    def available(self) -> bool:
        return bool(self.blender_bin and Path(self.blender_bin).is_file() and self.worker.is_file())

    def supports(self, format_name: str) -> bool:
        return self.available() and format_name in self.IMPLEMENTED

    async def render(
        self,
        scene: HoloScene,
        request: HoloExportRequest,
        output_dir: Path,
    ) -> tuple[Path, str]:
        if request.format not in self.IMPLEMENTED:
            raise RuntimeError(f"Blender renderer does not implement {request.format}")
        if not self.available():
            raise RuntimeError("Blender renderer is not configured")

        input_path = output_dir / "job.json"
        input_path.write_text(
            json.dumps(
                {
                    "scene": scene.model_dump(mode="json"),
                    "request": request.model_dump(mode="json"),
                    "outputDir": str(output_dir),
                }
            ),
            encoding="utf-8",
        )

        command = [
            self.blender_bin,
            "--background",
            "--factory-startup",
            "--python",
            str(self.worker),
            "--",
            str(input_path),
        ]

        process = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        timeout_env = (
            "HOLOFORGE_QUILT_TIMEOUT_SECONDS"
            if request.format == "lightfield-quilt"
            else "HOLOFORGE_RENDER_TIMEOUT_SECONDS"
        )
        timeout_default = "1800" if request.format == "lightfield-quilt" else "600"
        render_timeout = max(30, int(os.getenv(timeout_env, timeout_default)))

        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=render_timeout,
            )
        except TimeoutError:
            process.kill()
            await process.communicate()
            raise RuntimeError("Blender export timed out")

        if process.returncode != 0:
            detail = (stderr or stdout).decode("utf-8", "replace")[-4000:]
            raise RuntimeError("Blender export failed: " + detail)

        manifest = output_dir / "result.json"
        if not manifest.is_file():
            raise RuntimeError("Blender worker returned no result manifest")
        result = json.loads(manifest.read_text(encoding="utf-8"))
        artifact = Path(str(result.get("path") or "")).resolve()
        try:
            artifact.relative_to(output_dir.resolve())
        except ValueError as exc:
            raise RuntimeError("Blender worker returned an unsafe artifact path") from exc
        if not artifact.is_file():
            raise RuntimeError("Blender worker artifact is missing")

        return artifact, MIME_BY_FORMAT[request.format]


def safe_stem(value: str) -> str:
    cleaned = "".join(char if char.isalnum() or char in "-_" else "-" for char in value.strip())
    cleaned = cleaned.strip("-_")
    return cleaned[:120] or "holoforge"


class RendererRegistry:
    def __init__(self, renderers: list[Renderer] | None = None) -> None:
        self.renderers = renderers or [SceneJsonRenderer(), BlenderRenderer()]

    def resolve(self, format_name: str) -> Renderer:
        for renderer in self.renderers:
            if renderer.supports(format_name):
                return renderer
        raise RuntimeError(
            f"No configured HoloForge renderer can produce {format_name}. "
            "scene-json is always available; GLB/glTF/USDZ/WebM-alpha/MP4/PNG-sequence/light-field quilt require BLENDER_BIN."
        )

    def supported_formats(self) -> list[str]:
        formats = ["scene-json"]
        blender = next((item for item in self.renderers if isinstance(item, BlenderRenderer)), None)
        if blender and blender.available():
            formats.extend(sorted(BlenderRenderer.IMPLEMENTED))
        return formats
