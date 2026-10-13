from __future__ import annotations

import argparse
import asyncio
import base64
import io
import json
import os
from pathlib import Path
from typing import Any

import fal_client
from PIL import Image, ImageDraw

from providers.depth_provider import DEPTH_MODEL, FalDepthProvider
from providers.inpaint_provider import (
    INPAINT_MODEL,
    FalInpaintProvider,
)
from providers.media import fetch_fal_media
from providers.segmentation_provider import (
    FLORENCE_MODEL,
    SAM_MODEL,
    parse_florence2_response,
    parse_sam3_response,
)

ALLOWED_SUITES = {"all", "detection", "segmentation", "depth", "inpaint"}


def _png_data_url(raw: bytes) -> str:
    return "data:image/png;base64," + base64.b64encode(raw).decode("ascii")


def _fixture() -> tuple[bytes, bytes]:
    image = Image.new("RGB", (128, 128), (24, 34, 52))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((38, 30, 90, 106), radius=10, fill=(235, 92, 76))
    draw.ellipse((50, 12, 78, 40), fill=(245, 202, 155))
    draw.rectangle((44, 105, 56, 124), fill=(58, 95, 160))
    draw.rectangle((72, 105, 84, 124), fill=(58, 95, 160))

    image_buffer = io.BytesIO()
    image.save(image_buffer, format="PNG", optimize=True)

    mask = Image.new("L", (128, 128), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle((36, 10, 92, 124), radius=10, fill=255)
    mask_buffer = io.BytesIO()
    mask.save(mask_buffer, format="PNG", optimize=True)
    return image_buffer.getvalue(), mask_buffer.getvalue()


def _require_live_authorization() -> str:
    if os.getenv("DEPTHPOP_LIVE_PROVIDER_SMOKE") != "1":
        raise SystemExit(
            "Refusing paid provider execution: "
            "DEPTHPOP_LIVE_PROVIDER_SMOKE must equal 1."
        )
    key = os.getenv("FAL_KEY", "").strip()
    if not key:
        raise SystemExit("FAL_KEY is required for the paid provider smoke.")
    return key


def _validate_png(
    raw: bytes,
    expected_size: tuple[int, int] | None = None,
) -> dict[str, Any]:
    with Image.open(io.BytesIO(raw)) as image:
        image.load()
        if image.width <= 0 or image.height <= 0:
            raise RuntimeError("provider returned an empty raster")
        if expected_size is not None and image.size != expected_size:
            raise RuntimeError(
                f"provider raster size mismatch: {image.size} != {expected_size}"
            )
        return {
            "format": image.format or "unknown",
            "width": image.width,
            "height": image.height,
        }


async def _detection(image: bytes) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    payload = await asyncio.to_thread(
        fal_client.run,
        FLORENCE_MODEL,
        arguments={"image_url": _png_data_url(image)},
    )
    detections = parse_florence2_response(payload, width=128, height=128)
    if not detections:
        raise RuntimeError("Florence-2 returned no detections for the smoke fixture.")
    return {
        "model": FLORENCE_MODEL,
        "ok": True,
        "detectionCount": len(detections),
        "schemaValidated": True,
    }, detections


async def _segmentation(
    image: bytes,
    detections: list[dict[str, Any]] | None = None,
) -> tuple[dict[str, Any], bytes]:
    # In the full smoke, use Florence's actual detection rather than
    # an unrelated hardcoded box. Standalone SAM smoke uses the fixture box.
    if detections is not None:
        subject = detections[0]
        x_min = int(round(subject["x"]))
        y_min = int(round(subject["y"]))
        x_max = int(round(subject["x"] + subject["width"]))
        y_max = int(round(subject["y"] + subject["height"]))
    else:
        x_min, y_min, x_max, y_max = 34, 8, 94, 125

    payload = await asyncio.to_thread(
        fal_client.run,
        SAM_MODEL,
        arguments={
            "image_url": _png_data_url(image),
            "prompt": "",
            "box_prompts": [
                {
                    "x_min": x_min,
                    "y_min": y_min,
                    "x_max": x_max,
                    "y_max": y_max,
                    "object_id": 1,
                }
            ],
            "apply_mask": False,
            "return_multiple_masks": False,
            "max_masks": 1,
            "include_scores": True,
            "include_boxes": True,
            "output_format": "png",
        },
    )
    masks = parse_sam3_response(payload)
    if not masks:
        raise RuntimeError("SAM-3 returned no mask for the bounded box prompt.")
    raw = await fetch_fal_media(masks[0]["url"])
    raster = _validate_png(raw, (128, 128))
    return {
        "model": SAM_MODEL,
        "ok": True,
        "maskCount": len(masks),
        "mask": raster,
        "promptSource": "florence-2" if detections is not None else "fixture",
    }, raw


async def _depth(image: bytes) -> dict[str, Any]:
    result = await FalDepthProvider().estimate(image, quality="standard")
    canonical = _validate_png(result.canonical_depth, (128, 128))
    return {
        "model": DEPTH_MODEL,
        "ok": True,
        "quality": "standard",
        "polarity": result.polarity,
        "canonicalDepth": canonical,
    }


async def _inpaint(image: bytes, mask: bytes) -> dict[str, Any]:
    provider = FalInpaintProvider()
    result = await provider.inpaint(
        image,
        mask,
        num_inference_steps=8,
    )
    raster = _validate_png(result, (128, 128))
    return {
        "model": INPAINT_MODEL,
        "removalModel": "best_quality",
        "maskExpansion": 20,
        "ok": True,
        "output": raster,
    }


async def run_suite(suite: str) -> dict[str, Any]:
    if suite not in ALLOWED_SUITES:
        raise SystemExit(f"Unsupported suite: {suite}")

    _require_live_authorization()
    image, fixture_mask = _fixture()
    results: dict[str, Any] = {}
    detections: list[dict[str, Any]] | None = None
    sam_mask: bytes | None = None

    # One bounded real call per provider, in actual application order.
    if suite in {"all", "detection"}:
        print("[smoke] Florence-2: start", flush=True)
        results["detection"], detections = await _detection(image)
        print("[smoke] Florence-2: passed provider contract", flush=True)
    if suite in {"all", "segmentation"}:
        print("[smoke] SAM-3: start", flush=True)
        results["segmentation"], sam_mask = await _segmentation(
            image, detections if suite == "all" else None,
        )
        print("[smoke] SAM-3: passed provider contract", flush=True)
    if suite in {"all", "depth"}:
        print("[smoke] Depth Anything V2: start", flush=True)
        results["depth"] = await _depth(image)
        print("[smoke] Depth Anything V2: passed provider contract", flush=True)
    if suite in {"all", "inpaint"}:
        print("[smoke] Mask-guided object removal: start", flush=True)
        results["inpaint"] = await _inpaint(
            image, sam_mask if suite == "all" and sam_mask is not None else fixture_mask,
        )
        results["inpaint"]["sourceMask"] = "sam-3" if suite == "all" else "fixture"
        print("[smoke] Mask-guided object removal: passed provider contract", flush=True)

    return {
        "ok": True,
        "suite": suite,
        "fixture": {
            "width": 128,
            "height": 128,
            "stored": False,
        },
        "paidCallsMaximum": 4 if suite == "all" else 1,
        "results": results,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--suite",
        choices=sorted(ALLOWED_SUITES),
        default="all",
    )
    parser.add_argument(
        "--report",
        default="live-provider-smoke-report.json",
    )
    args = parser.parse_args()

    report = asyncio.run(run_suite(args.suite))
    report_path = Path(args.report)
    report_path.write_text(
        json.dumps(report, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    # Intentionally print only the safe report. Provider media URLs, request
    # payloads and FAL_KEY are never emitted.
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
