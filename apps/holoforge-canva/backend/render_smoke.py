from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path

from PIL import Image


def scene_payload() -> dict:
    return {
        "schemaVersion": 1,
        "id": "render-smoke",
        "source": {"type": "text", "text": "HF"},
        "objects": [
            {
                "id": "smoke-text",
                "name": "HF",
                "creationType": "holo_text",
                "geometry": {
                    "type": "text",
                    "thickness": 0.08,
                    "bevelSize": 0.01,
                    "bevelSegments": 2,
                },
                "material": {
                    "family": "foil",
                    "baseColor": "hsl(205 88% 66%)",
                    "opacity": 0.88,
                    "metalness": 0.6,
                    "roughness": 0.2,
                    "transmission": 0.0,
                    "ior": 1.3,
                    "emissionColor": "hsl(274 88% 66%)",
                    "emissionStrength": 0.45,
                    "spectralShift": 70,
                    "diffraction": 0.4,
                    "scanlineStrength": 0.3,
                    "shimmerStrength": 0.5,
                    "reflectionStrength": 80,
                },
                "transform": {
                    "position": {"x": 0, "y": 0, "z": 0},
                    "rotation": {"x": 0, "y": 0, "z": 0},
                    "scale": {"x": 1, "y": 1, "z": 1},
                },
                "animationPreset": "turntable",
                "animationTracks": [],
                "sourceText": "HF",
                "visible": True,
            }
        ],
        "environment": {
            "background": "#020307",
            "ambientIntensity": 0.68,
            "keyLightIntensity": 2.15,
            "rimLightIntensity": 1.65,
            "floorGrid": True,
        },
        "camera": {
            "position": {"x": 0, "y": 0.35, "z": 4.3},
            "target": {"x": 0, "y": 0, "z": 0},
            "fov": 42,
            "near": 0.05,
            "far": 100,
        },
        "timeline": {
            "durationMs": 250,
            "fps": 8,
            "currentTimeMs": 0,
            "playing": False,
        },
        "exportProfile": "generic-3d",
    }


def run_worker(
    blender: str,
    worker: Path,
    root: Path,
    *,
    format_name: str,
    profile: str,
    transparent: bool,
    include_animation: bool = True,
    resolution: tuple[int, int] = (320, 180),
    quilt: dict | None = None,
) -> tuple[Path, dict]:
    output = root / format_name
    output.mkdir(parents=True, exist_ok=True)
    request = {
        "schemaVersion": 1,
        "sceneId": "render-smoke",
        "format": format_name,
        "profile": profile,
        "includeAnimation": include_animation,
        "resolution": {"width": resolution[0], "height": resolution[1]},
        "transparentBackground": transparent,
    }
    if quilt is not None:
        request["quilt"] = quilt

    payload = {
        "scene": scene_payload(),
        "request": request,
        "outputDir": str(output),
    }
    job = output / "job.json"
    job.write_text(json.dumps(payload), encoding="utf-8")

    completed = subprocess.run(
        [
            blender,
            "--background",
            "--factory-startup",
            "--python",
            str(worker),
            "--",
            str(job),
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=600 if format_name == "lightfield-quilt" else 240,
        check=False,
    )
    if completed.returncode != 0:
        print(completed.stdout[-5000:])
        print(completed.stderr[-5000:])
        raise SystemExit(f"Blender worker smoke failed for {format_name}")

    result_path = output / "result.json"
    if not result_path.is_file():
        raise SystemExit(f"Blender worker returned no result manifest for {format_name}")

    result = json.loads(result_path.read_text(encoding="utf-8"))
    artifact = Path(result["path"])
    if not artifact.is_file() or artifact.stat().st_size <= 0:
        raise SystemExit(f"Blender worker produced no {format_name} artifact")
    return artifact, result


def verify_png_still(artifact: Path, *, width: int, height: int) -> None:
    if artifact.suffix.lower() != ".png":
        raise SystemExit("PNG still smoke produced the wrong artifact extension")

    with Image.open(artifact) as image:
        if image.size != (width, height):
            raise SystemExit(
                f"PNG still dimensions are wrong: {image.size}; expected {(width, height)}"
            )
        if image.mode != "RGBA":
            raise SystemExit(f"PNG still is not RGBA: {image.mode}")
        alpha = image.getchannel("A")
        minimum, maximum = alpha.getextrema()
        if minimum >= 255 or maximum <= 0:
            raise SystemExit("PNG still smoke did not preserve meaningful transparency")


def verify_webm_alpha(artifact: Path) -> None:
    ffprobe = shutil.which("ffprobe")
    ffmpeg = shutil.which("ffmpeg")
    if not ffprobe or not ffmpeg:
        raise SystemExit("ffmpeg/ffprobe are required for alpha WebM smoke")

    probe = subprocess.run(
        [
            ffprobe,
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=codec_name",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(artifact),
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=30,
        check=False,
    )
    if probe.returncode != 0 or probe.stdout.strip() != "vp9":
        raise SystemExit("alpha WebM smoke did not produce a VP9 video stream")

    alpha_png = artifact.with_name("decoded-alpha.png")
    alpha = subprocess.run(
        [
            ffmpeg,
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-c:v",
            "libvpx-vp9",
            "-i",
            str(artifact),
            "-vf",
            "alphaextract",
            "-frames:v",
            "1",
            str(alpha_png),
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=30,
        check=False,
    )
    if alpha.returncode != 0 or not alpha_png.is_file() or alpha_png.stat().st_size <= 0:
        print(alpha.stderr[-3000:])
        raise SystemExit("alpha WebM smoke could not extract a real alpha plane")


def verify_usdz(artifact: Path) -> None:
    if artifact.suffix.lower() != ".usdz":
        raise SystemExit("USDZ smoke produced the wrong artifact extension")
    if not zipfile.is_zipfile(artifact):
        raise SystemExit("USDZ smoke did not produce a valid ZIP package")

    with zipfile.ZipFile(artifact, "r") as archive:
        entries = archive.infolist()
        if not entries:
            raise SystemExit("USDZ smoke produced an empty package")
        first = entries[0]
        if Path(first.filename).suffix.lower() not in {".usd", ".usda", ".usdc"}:
            raise SystemExit("USDZ smoke package does not begin with a USD layer")
        if any(entry.compress_type != zipfile.ZIP_STORED for entry in entries):
            raise SystemExit("USDZ smoke package contains compressed ZIP entries")


def verify_quilt(artifact: Path, *, width: int, height: int, views: int) -> None:
    ffprobe = shutil.which("ffprobe")
    if not ffprobe:
        raise SystemExit("ffprobe is required for quilt smoke")

    probe = subprocess.run(
        [
            ffprobe,
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-of",
            "csv=s=x:p=0",
            str(artifact),
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=30,
        check=False,
    )
    if probe.returncode != 0 or probe.stdout.strip() != f"{width}x{height}":
        raise SystemExit(
            "light-field quilt dimensions are wrong: "
            + (probe.stdout.strip() or probe.stderr[-500:])
        )

    rendered_views = list((artifact.parent / "lightfield-views").glob("slot_*.png"))
    if len(rendered_views) != views:
        raise SystemExit(
            f"light-field quilt rendered {len(rendered_views)} views; expected {views}"
        )


def main() -> int:
    blender = os.environ.get("BLENDER_BIN", "").strip()
    if not blender:
        raise SystemExit("BLENDER_BIN is not configured")

    worker = Path(__file__).with_name("blender_worker.py")
    with tempfile.TemporaryDirectory(prefix="holoforge-blender-smoke-") as temp:
        root = Path(temp)

        glb, _ = run_worker(
            blender,
            worker,
            root,
            format_name="glb",
            profile="generic-3d",
            transparent=True,
        )
        if glb.suffix.lower() != ".glb":
            raise SystemExit("Blender worker smoke produced the wrong GLB artifact type")

        usdz, _ = run_worker(
            blender,
            worker,
            root,
            format_name="usdz",
            profile="ios-ar",
            transparent=True,
            include_animation=False,
        )
        verify_usdz(usdz)

        png_still, _ = run_worker(
            blender,
            worker,
            root,
            format_name="png-still",
            profile="still-image",
            transparent=True,
            include_animation=False,
            resolution=(320, 180),
        )
        verify_png_still(png_still, width=320, height=180)

        webm, _ = run_worker(
            blender,
            worker,
            root,
            format_name="webm-alpha",
            profile="transparent-video",
            transparent=True,
        )
        if webm.suffix.lower() != ".webm":
            raise SystemExit("Blender worker smoke produced the wrong WebM artifact type")
        verify_webm_alpha(webm)

        quilt_options = {
            "columns": 3,
            "rows": 3,
            "views": 9,
            "viewAspect": 1.0,
            "viewConeDegrees": 30,
        }
        quilt, _ = run_worker(
            blender,
            worker,
            root,
            format_name="lightfield-quilt",
            profile="lightfield-quilt",
            transparent=True,
            include_animation=False,
            resolution=(150, 150),
            quilt=quilt_options,
        )
        if quilt.suffix.lower() != ".png" or "_qs3x3a1.png" not in quilt.name:
            raise SystemExit("Blender worker smoke produced the wrong quilt artifact name")
        verify_quilt(quilt, width=150, height=150, views=9)

        print(
            json.dumps(
                {
                    "ok": True,
                    "glb": {"artifact": glb.name, "sizeBytes": glb.stat().st_size},
                    "usdz": {"artifact": usdz.name, "sizeBytes": usdz.stat().st_size},
                    "pngStill": {
                        "artifact": png_still.name,
                        "sizeBytes": png_still.stat().st_size,
                        "resolution": [320, 180],
                        "alphaVerified": True,
                    },
                    "webmAlpha": {
                        "artifact": webm.name,
                        "sizeBytes": webm.stat().st_size,
                        "codec": "vp9",
                        "alphaVerified": True,
                    },
                    "lightfieldQuilt": {
                        "artifact": quilt.name,
                        "sizeBytes": quilt.stat().st_size,
                        "resolution": [150, 150],
                        "grid": [3, 3],
                        "views": 9,
                        "viewConeDegrees": 30,
                    },
                }
            )
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
