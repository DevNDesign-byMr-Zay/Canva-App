from __future__ import annotations

import asyncio
import base64
import io
import os
from typing import Any, Protocol

import fal_client
import numpy as np
from fastapi import HTTPException
from PIL import Image
from pydantic import BaseModel, ConfigDict

from models.object import BBox, ExtractionQuality, SemanticType
from providers.media import fetch_fal_media

FLORENCE_MODEL = "fal-ai/florence-2-large/object-detection"
SAM_MODEL = "fal-ai/sam-3/image"


class SegmentedObject(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: str
    label: str
    semantic_type: SemanticType
    extraction_quality: ExtractionQuality = "mask"
    confidence: float
    bbox: BBox
    mask_bytes: bytes
    mask_array: np.ndarray | None = None


class SegmentationProvider(Protocol):
    async def segment(
        self,
        image: bytes,
        max_objects: int = 24,
    ) -> list[SegmentedObject]: ...


def _bool_env(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _image_mime(image_bytes: bytes) -> str:
    with Image.open(io.BytesIO(image_bytes)) as image:
        fmt = (image.format or "").upper()
    if fmt == "PNG":
        return "image/png"
    if fmt in {"JPEG", "JPG"}:
        return "image/jpeg"
    if fmt == "WEBP":
        return "image/webp"
    raise HTTPException(
        status_code=415,
        detail="Segmentation provider supports PNG, JPEG, and WebP sources.",
    )


def _data_url(image_bytes: bytes) -> str:
    return (
        f"data:{_image_mime(image_bytes)};base64,"
        + base64.b64encode(image_bytes).decode("ascii")
    )


def map_label_to_semantic_type(label: str) -> SemanticType:
    clean = label.lower().strip()
    if any(
        key in clean
        for key in (
            "person",
            "man",
            "woman",
            "child",
            "human",
            "face",
            "boy",
            "girl",
        )
    ):
        return "person"
    if any(key in clean for key in ("logo", "brand", "emblem", "insignia", "symbol")):
        return "logo"
    if any(key in clean for key in ("text", "word", "letter", "font", "sign", "label", "caption")):
        return "text"
    if any(
        key in clean
        for key in (
            "shoe",
            "boot",
            "sneaker",
            "product",
            "bottle",
            "watch",
            "bag",
            "phone",
            "item",
        )
    ):
        return "product"
    if any(key in clean for key in ("building", "house", "tower", "structure", "skyscraper", "wall")):
        return "building"
    if any(key in clean for key in ("car", "vehicle", "truck", "bus", "bicycle", "bike", "motorcycle", "train")):
        return "vehicle"
    if any(key in clean for key in ("chair", "table", "furniture", "couch", "lamp", "prop", "desk", "box")):
        return "prop"
    return "unknown"


def _results_root(payload: dict[str, Any]) -> dict[str, Any]:
    if isinstance(payload.get("results"), dict):
        return payload["results"]
    data = payload.get("data")
    if isinstance(data, dict) and isinstance(data.get("results"), dict):
        return data["results"]
    raise ValueError("Florence-2 response is missing results.bboxes")


def parse_florence2_response(
    payload: dict[str, Any],
    *,
    width: int,
    height: int,
) -> list[dict[str, Any]]:
    """Parse the current documented FAL Florence-2 BoundingBoxes schema.

    Each results.bboxes entry is an object containing x, y, w, h, and label.
    Unknown response shapes fail instead of becoming a fake full-image object.
    """

    root = _results_root(payload)
    boxes = root.get("bboxes")
    if not isinstance(boxes, list):
        raise ValueError("Florence-2 results.bboxes must be a list")

    detections: list[dict[str, Any]] = []
    for index, item in enumerate(boxes):
        if not isinstance(item, dict):
            raise ValueError(f"Florence-2 bbox {index} is not an object")

        required = ("x", "y", "w", "h", "label")
        if any(key not in item for key in required):
            raise ValueError(
                f"Florence-2 bbox {index} is missing x/y/w/h/label"
            )

        x = float(item["x"])
        y = float(item["y"])
        box_width = float(item["w"])
        box_height = float(item["h"])
        label = str(item["label"]).strip() or "object"

        x0 = max(0.0, min(float(width), x))
        y0 = max(0.0, min(float(height), y))
        x1 = max(0.0, min(float(width), x + box_width))
        y1 = max(0.0, min(float(height), y + box_height))
        if x1 <= x0 or y1 <= y0:
            continue

        detections.append(
            {
                "label": label,
                "x": x0,
                "y": y0,
                "width": x1 - x0,
                "height": y1 - y0,
            }
        )

    return detections


def parse_sam3_response(payload: dict[str, Any]) -> list[dict[str, Any]]:
    """Parse current FAL SAM-3 masks with separate score/metadata arrays."""

    root = payload
    if isinstance(payload.get("data"), dict):
        root = payload["data"]

    masks = root.get("masks")
    if not isinstance(masks, list):
        raise ValueError("SAM-3 response is missing masks[]")

    scores = root.get("scores")
    metadata = root.get("metadata")
    parsed: list[dict[str, Any]] = []

    for index, item in enumerate(masks):
        if not isinstance(item, dict) or not isinstance(item.get("url"), str):
            raise ValueError(f"SAM-3 mask {index} is missing its image URL")

        score: float | None = None
        if isinstance(scores, list) and index < len(scores):
            try:
                score = float(scores[index])
            except (TypeError, ValueError):
                score = None
        if score is None and isinstance(metadata, list) and index < len(metadata):
            meta = metadata[index]
            if isinstance(meta, dict) and meta.get("score") is not None:
                try:
                    score = float(meta["score"])
                except (TypeError, ValueError):
                    score = None

        parsed.append(
            {
                "url": item["url"],
                "score": max(0.0, min(1.0, score if score is not None else 0.90)),
            }
        )

    return parsed


def _bbox_mask(
    *,
    width: int,
    height: int,
    detection: dict[str, Any],
) -> np.ndarray:
    x0 = max(0, min(width - 1, int(round(detection["x"]))))
    y0 = max(0, min(height - 1, int(round(detection["y"]))))
    x1 = max(x0 + 1, min(width, int(round(detection["x"] + detection["width"]))))
    y1 = max(y0 + 1, min(height, int(round(detection["y"] + detection["height"]))))
    mask = np.zeros((height, width), dtype=bool)
    mask[y0:y1, x0:x1] = True
    return mask


def _encode_mask(mask_array: np.ndarray) -> bytes:
    image = Image.fromarray((mask_array * 255).astype(np.uint8), mode="L")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


class FalSegmentationProvider:
    """FAL Florence-2 detection + SAM-3 segmentation with truthful degradation."""

    def __init__(
        self,
        fal_key: str | None = None,
        *,
        allow_bbox_fallback: bool | None = None,
    ):
        self.fal_key = fal_key or os.getenv("FAL_KEY", "").strip()
        self.allow_bbox_fallback = (
            _bool_env("DEPTHPOP_ALLOW_BBOX_FALLBACK", False)
            if allow_bbox_fallback is None
            else allow_bbox_fallback
        )

    async def segment(
        self,
        image: bytes,
        max_objects: int = 24,
    ) -> list[SegmentedObject]:
        if not self.fal_key:
            raise HTTPException(
                status_code=503,
                detail="Production segmentation requires FAL_KEY.",
            )

        with Image.open(io.BytesIO(image)) as source:
            width, height = source.size

        image_url = _data_url(image)
        try:
            florence_payload = await asyncio.to_thread(
                fal_client.run,
                FLORENCE_MODEL,
                arguments={"image_url": image_url},
            )
            detections = parse_florence2_response(
                florence_payload,
                width=width,
                height=height,
            )[:max_objects]
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail="Florence-2 returned an invalid object-detection response.",
            ) from exc

        if not detections:
            return []

        prompts = [
            {
                "x_min": int(round(detection["x"])),
                "y_min": int(round(detection["y"])),
                "x_max": int(round(detection["x"] + detection["width"])),
                "y_max": int(round(detection["y"] + detection["height"])),
                "object_id": index + 1,
            }
            for index, detection in enumerate(detections)
        ]

        try:
            sam_payload = await asyncio.to_thread(
                fal_client.run,
                SAM_MODEL,
                arguments={
                    "image_url": image_url,
                    "prompt": "",
                    "box_prompts": prompts,
                    "apply_mask": False,
                    "return_multiple_masks": True,
                    "max_masks": len(prompts),
                    "include_scores": True,
                    "include_boxes": True,
                    "output_format": "png",
                },
            )
            masks = parse_sam3_response(sam_payload)
        except Exception as exc:
            if not self.allow_bbox_fallback:
                raise HTTPException(
                    status_code=502,
                    detail="SAM-3 segmentation failed and bbox fallback is disabled.",
                ) from exc
            masks = []

        objects: list[SegmentedObject] = []
        for index, detection in enumerate(detections):
            quality: ExtractionQuality = "mask"
            score = 0.90
            mask_array: np.ndarray

            mask_info = masks[index] if index < len(masks) else None
            if mask_info is not None:
                try:
                    mask_bytes = await fetch_fal_media(mask_info["url"])
                    with Image.open(io.BytesIO(mask_bytes)) as mask_image:
                        mask_l = mask_image.convert("L").resize(
                            (width, height),
                            Image.Resampling.NEAREST,
                        )
                        mask_array = np.asarray(mask_l) > 127
                    if not np.any(mask_array):
                        raise ValueError("SAM-3 returned an empty mask")
                    score = float(mask_info["score"])
                except Exception as exc:
                    if not self.allow_bbox_fallback:
                        raise HTTPException(
                            status_code=502,
                            detail=(
                                "SAM-3 returned an unusable mask and "
                                "bbox fallback is disabled."
                            ),
                        ) from exc
                    mask_array = _bbox_mask(
                        width=width,
                        height=height,
                        detection=detection,
                    )
                    quality = "bbox_fallback"
            else:
                if not self.allow_bbox_fallback:
                    raise HTTPException(
                        status_code=502,
                        detail=(
                            "SAM-3 returned fewer masks than requested and "
                            "bbox fallback is disabled."
                        ),
                    )
                mask_array = _bbox_mask(
                    width=width,
                    height=height,
                    detection=detection,
                )
                quality = "bbox_fallback"

            label = detection["label"]
            objects.append(
                SegmentedObject(
                    id=f"segment_{index + 1:02d}",
                    label=label,
                    semantic_type=map_label_to_semantic_type(label),
                    extraction_quality=quality,
                    confidence=score,
                    bbox=BBox(
                        x=detection["x"],
                        y=detection["y"],
                        width=detection["width"],
                        height=detection["height"],
                    ),
                    mask_bytes=_encode_mask(mask_array),
                    mask_array=mask_array,
                )
            )

        return objects


class MockSegmentationProvider:
    """Deterministic segmentation provider for tests and explicit local dev."""

    async def segment(
        self,
        image: bytes,
        max_objects: int = 24,
    ) -> list[SegmentedObject]:
        environment = os.getenv("ENVIRONMENT", "").lower()
        mode = os.getenv("SEGMENTATION_PROVIDER", "").lower()
        is_test = environment == "test" or "PYTEST_CURRENT_TEST" in os.environ
        if not is_test and mode != "mock":
            raise HTTPException(
                status_code=503,
                detail=(
                    "Mock segmentation is available only in tests or when "
                    "SEGMENTATION_PROVIDER=mock outside production."
                ),
            )
        if environment == "production":
            raise HTTPException(
                status_code=503,
                detail="Mock segmentation is disabled in production.",
            )

        with Image.open(io.BytesIO(image)) as source:
            rgba = source.convert("RGBA")
            width, height = rgba.size

        image_array = np.asarray(rgba)
        alpha = image_array[:, :, 3]
        objects: list[SegmentedObject] = []

        if np.any(alpha == 0) and np.any(alpha > 0):
            mask = alpha > 127
            ys, xs = np.where(mask)
            if len(xs):
                bbox = BBox(
                    x=float(xs.min()),
                    y=float(ys.min()),
                    width=float(xs.max() - xs.min() + 1),
                    height=float(ys.max() - ys.min() + 1),
                )
                objects.append(
                    SegmentedObject(
                        id="logo_01",
                        label="logo",
                        semantic_type="logo",
                        extraction_quality="mask",
                        confidence=0.98,
                        bbox=bbox,
                        mask_bytes=_encode_mask(mask),
                        mask_array=mask,
                    )
                )

        if not objects:
            x0, x1 = int(width * 0.25), max(int(width * 0.75), 1)
            y0, y1 = int(height * 0.20), max(int(height * 0.85), 1)
            mask = np.zeros((height, width), dtype=bool)
            mask[y0:y1, x0:x1] = True
            objects.append(
                SegmentedObject(
                    id="person_01",
                    label="person",
                    semantic_type="person",
                    extraction_quality="mask",
                    confidence=0.95,
                    bbox=BBox(
                        x=float(x0),
                        y=float(y0),
                        width=float(max(1, x1 - x0)),
                        height=float(max(1, y1 - y0)),
                    ),
                    mask_bytes=_encode_mask(mask),
                    mask_array=mask,
                )
            )

        return objects[:max_objects]
