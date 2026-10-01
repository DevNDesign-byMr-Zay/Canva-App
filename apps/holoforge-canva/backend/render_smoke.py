from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path


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
) -> Path:
    output = root / format_name
    output.mkdir(parents=True, exist_ok=True)
    payload = {
        "scene": scene_payload(),
        "request": {
            "schemaVersion": 1,
            "sceneId": "render-smoke",
            "format": format_name,
            "profile": profile,
            "includeAnimation": True,
            "resolution": {"width": 320, "height": 180},
            "transparentBackground": transparent,
        },
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
        timeout=180,
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
    return artifact


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


def main() -> int:
    blender = os.environ.get("BLENDER_BIN", "").strip()
    if not blender:
        raise SystemExit("BLENDER_BIN is not configured")

    worker = Path(__file__).with_name("blender_worker.py")
    with tempfile.TemporaryDirectory(prefix="holoforge-blender-smoke-") as temp:
        root = Path(temp)

        glb = run_worker(
            blender,
            worker,
            root,
            format_name="glb",
            profile="generic-3d",
            transparent=True,
        )
        if glb.suffix.lower() != ".glb":
            raise SystemExit("Blender worker smoke produced the wrong GLB artifact type")

        webm = run_worker(
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

        print(
            json.dumps(
                {
                    "ok": True,
                    "glb": {"artifact": glb.name, "sizeBytes": glb.stat().st_size},
                    "webmAlpha": {
                        "artifact": webm.name,
                        "sizeBytes": webm.stat().st_size,
                        "codec": "vp9",
                        "alphaVerified": True,
                    },
                }
            )
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
