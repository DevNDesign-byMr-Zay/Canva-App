from __future__ import annotations

import json
import os
import subprocess
import tempfile
from pathlib import Path


def main() -> int:
    blender = os.environ.get("BLENDER_BIN", "").strip()
    if not blender:
        raise SystemExit("BLENDER_BIN is not configured")

    worker = Path(__file__).with_name("blender_worker.py")
    with tempfile.TemporaryDirectory(prefix="holoforge-blender-smoke-") as temp:
        root = Path(temp)
        payload = {
            "scene": {
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
                            "baseColor": "#5cecff",
                            "opacity": 1.0,
                            "metalness": 0.6,
                            "roughness": 0.2,
                            "transmission": 0.0,
                            "ior": 1.3,
                            "emissionColor": "#9c73ff",
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
                    "durationMs": 1000,
                    "fps": 24,
                    "currentTimeMs": 0,
                    "playing": False,
                },
                "exportProfile": "generic-3d",
            },
            "request": {
                "schemaVersion": 1,
                "sceneId": "render-smoke",
                "format": "glb",
                "profile": "generic-3d",
                "includeAnimation": True,
                "resolution": {"width": 320, "height": 180},
                "transparentBackground": True,
            },
            "outputDir": str(root),
        }
        job = root / "job.json"
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
            print(completed.stdout[-4000:])
            print(completed.stderr[-4000:])
            raise SystemExit("Blender worker smoke failed")

        result_path = root / "result.json"
        if not result_path.is_file():
            raise SystemExit("Blender worker did not create result.json")

        result = json.loads(result_path.read_text(encoding="utf-8"))
        artifact = Path(result["path"])
        if not artifact.is_file() or artifact.stat().st_size <= 0:
            raise SystemExit("Blender worker produced no GLB artifact")
        if artifact.suffix.lower() != ".glb":
            raise SystemExit("Blender worker smoke produced the wrong artifact type")

        print(
            json.dumps(
                {
                    "ok": True,
                    "artifact": artifact.name,
                    "sizeBytes": artifact.stat().st_size,
                }
            )
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
