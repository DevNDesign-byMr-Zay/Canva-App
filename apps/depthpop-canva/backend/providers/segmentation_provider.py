from __future__ import annotations

import asyncio
import base64
import io
import os
from typing import Any, Literal, Protocol
import fal_client
from fastapi import HTTPException
import numpy as np
from PIL import Image
from pydantic import BaseModel, ConfigDict
from models.object import BBox, SemanticType


class SegmentedObject(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: str
    label: str
    semantic_type: SemanticType
    confidence: float
    bbox: BBox
    mask_bytes: bytes
    mask_array: np.ndarray | None = None
    extraction_quality: Literal["mask", "bbox_fallback"] = "mask"


class SegmentationProvider(Protocol):
    async def segment(self, image: bytes, max_objects: int = 24) -> list[SegmentedObject]: ...


def map_label_to_semantic_type(label: str) -> SemanticType:
    clean = label.lower().strip()
    if any(k in clean for k in ("person", "man", "woman", "child", "human", "face", "boy", "girl")):
        return "person"
    if any(k in clean for k in ("logo", "brand", "emblem", "insignia", "symbol")):
        return "logo"
    if any(k in clean for k in ("text", "word", "letter", "font", "sign", "label", "caption")):
        return "text"
    if any(k in clean for k in ("shoe", "boot", "sneaker", "product", "bottle", "watch", "bag", "phone", "item")):
        return "product"
    if any(k in clean for k in ("building", "house", "tower", "structure", "skyscraper", "wall")):
        return "building"
    if any(k in clean for k in ("car", "vehicle", "truck", "bus", "bicycle", "bike", "motorcycle", "train")):
        return "vehicle"
    if any(k in clean for k in ("chair", "table", "furniture", "couch", "lamp", "prop", "desk", "box")):
        return "prop"
    return "unknown"


def _normalize_florence_bbox(
    box: list[float], image_width: int, image_height: int
) -> tuple[float, float, float, float]:
    """Normalize Florence-2 bounding box [ymin, xmin, ymax, xmax] to pixel [x, y, w, h]."""
    if len(box) != 4:
        raise ValueError(f"Invalid Florence-2 box length {len(box)}, expected 4")

    v0, v1, v2, v3 = [float(x) for x in box]
    max_val = max(abs(v0), abs(v1), abs(v2), abs(v3))

    if max_val <= 1.0:
        ymin, xmin, ymax, xmax = v0 * image_height, v1 * image_width, v2 * image_height, v3 * image_width
    elif max_val <= 1000.0:
        ymin, xmin, ymax, xmax = (
            (v0 / 1000.0) * image_height,
            (v1 / 1000.0) * image_width,
            (v2 / 1000.0) * image_height,
            (v3 / 1000.0) * image_width,
        )
    else:
        ymin, xmin, ymax, xmax = v0, v1, v2, v3

    xmin = max(0.0, min(float(image_width), xmin))
    xmax = max(0.0, min(float(image_width), xmax))
    ymin = max(0.0, min(float(image_height), ymin))
    ymax = max(0.0, min(float(image_height), ymax))

    if xmax <= xmin:
        xmax = min(float(image_width), xmin + 1.0)
    if ymax <= ymin:
        ymax = min(float(image_height), ymin + 1.0)

    bx = xmin
    by = ymin
    bw = xmax - xmin
    bh = ymax - ymin
    return bx, by, bw, bh


def parse_florence2_response(
    payload: dict[str, Any],
    image_width: int = 1000,
    image_height: int = 1000,
    strict_schema: bool = False,
) -> list[dict[str, Any]]:
    """Parse Florence-2 object detection output into normalized detection dicts."""
    if not isinstance(payload, dict):
        if strict_schema:
            raise ValueError("Florence-2 payload must be a JSON object dictionary")
        return []

    results: list[dict[str, Any]] = []

    output = payload.get("output") or payload.get("results") or payload

    if isinstance(output, dict):
        od_dict = output.get("<OD>") if isinstance(output.get("<OD>"), dict) else {}
        bboxes = od_dict.get("bboxes") or output.get("bboxes") or output.get("boxes") or []
        labels = od_dict.get("labels") or output.get("labels") or []

        if bboxes and isinstance(bboxes, list):
            for idx, box in enumerate(bboxes):
                if not isinstance(box, (list, tuple)) or len(box) != 4:
                    continue
                label = labels[idx] if idx < len(labels) else "object"
                try:
                    bx, by, bw, bh = _normalize_florence_bbox(list(box), image_width, image_height)
                    results.append({
                        "label": str(label),
                        "box": [bx, by, bx + bw, by + bh],
                        "bbox": [bx, by, bw, bh],
                    })
                except ValueError:
                    continue

        objects = output.get("objects") or payload.get("objects") or output.get("detections")
        if isinstance(objects, list) and not results:
            for obj in objects:
                if isinstance(obj, dict):
                    lbl = obj.get("label") or obj.get("name") or "object"
                    raw_box = obj.get("box") or obj.get("bbox") or obj.get("bboxes")
                    if isinstance(raw_box, (list, tuple)) and len(raw_box) == 4:
                        try:
                            bx, by, bw, bh = _normalize_florence_bbox(list(raw_box), image_width, image_height)
                            results.append({
                                "label": str(lbl),
                                "box": [bx, by, bx + bw, by + bh],
                                "bbox": [bx, by, bw, bh],
                            })
                        except ValueError:
                            continue

    if not results and strict_schema:
        raise ValueError("Unrecognized or empty Florence-2 response schema")

    return results


def parse_sam3_response(payload: dict[str, Any]) -> list[dict[str, Any]]:
    """Parse SAM-3 response into list of mask metadata objects."""
    if not isinstance(payload, dict):
        return []

    masks: list[dict[str, Any]] = []
    items = payload.get("masks") or payload.get("results") or payload.get("output") or []
    if isinstance(items, list):
        for item in items:
            if isinstance(item, dict):
                url = (
                    item.get("url")
                    or item.get("mask_url")
                    or item.get("image_url")
                    or (item.get("mask", {}).get("url") if isinstance(item.get("mask"), dict) else None)
                )
                score = float(
                    item.get("score")
                    or item.get("confidence")
                    or item.get("stability_score")
                    or 0.90
                )
                if url:
                    masks.append({"url": str(url), "score": score})
    return masks


class FalSegmentationProvider:
    """Concrete FAL-backed segmentation provider using Florence-2 and SAM-3."""

    def __init__(self, fal_key: str | None = None):
        self.fal_key = fal_key or os.getenv("FAL_KEY", "").strip()

    async def segment(self, image: bytes, max_objects: int = 24) -> list[SegmentedObject]:
        if not self.fal_key:
            raise HTTPException(
                status_code=503,
                detail="Production segmentation provider requires FAL_KEY configuration.",
            )

        with Image.open(io.BytesIO(image)) as img:
            width, height = img.size

        data_url = "data:image/png;base64," + base64.b64encode(image).decode("ascii")
        try:
            florence_resp = await asyncio.to_thread(
                fal_client.run,
                "fal-ai/florence-2-large/object-detection",
                arguments={"image_url": data_url},
            )
        except Exception as exc:
            raise HTTPException(status_code=502, detail="Segmentation provider (Florence-2) failed") from exc

        detections = parse_florence2_response(florence_resp, image_width=width, image_height=height, strict_schema=False)
        if not detections:
            detections = [{"label": "object", "box": [0.0, 0.0, float(width), float(height)], "bbox": [0.0, 0.0, float(width), float(height)]}]

        boxes_prompt = [[d["bbox"][0], d["bbox"][1], d["bbox"][0] + d["bbox"][2], d["bbox"][1] + d["bbox"][3]] for d in detections[:max_objects]]
        try:
            sam_resp = await asyncio.to_thread(
                fal_client.run,
                "fal-ai/sam-3/image",
                arguments={"image_url": data_url, "box_prompts": boxes_prompt},
            )
        except Exception as exc:
            sam_resp = {}

        parsed_masks = parse_sam3_response(sam_resp)
        allow_degraded = os.getenv("ALLOW_DEGRADED_SEGMENTATION", "false").lower().strip() in ("1", "true", "yes")

        segmented_objects: list[SegmentedObject] = []
        for idx, det in enumerate(detections[:max_objects]):
            lbl = det["label"]
            sem_type = map_label_to_semantic_type(lbl)
            bx, by, bw, bh = det["bbox"]

            m_info = parsed_masks[idx] if idx < len(parsed_masks) else None
            mask_arr = np.zeros((height, width), dtype=bool)
            quality: Literal["mask", "bbox_fallback"] = "mask"

            if m_info and m_info.get("url"):
                try:
                    from providers.depth_provider import FalDepthProvider
                    mask_raw = await FalDepthProvider._fetch_provider_image(m_info["url"])
                    with Image.open(io.BytesIO(mask_raw)) as m_img:
                        mask_arr = np.array(m_img.convert("L")) > 128
                    quality = "mask"
                except Exception:
                    if not allow_degraded and os.getenv("ENVIRONMENT") == "production":
                        raise HTTPException(status_code=502, detail=f"SAM-3 mask fetch failed for object {idx+1}")
                    mask_arr[int(by):int(by+bh), int(bx):int(bx+bw)] = True
                    quality = "bbox_fallback"
            else:
                if not allow_degraded and os.getenv("ENVIRONMENT") == "production":
                    raise HTTPException(status_code=502, detail=f"SAM-3 mask extraction failed for object {idx+1}")
                mask_arr[int(by):int(by+bh), int(bx):int(bx+bw)] = True
                quality = "bbox_fallback"

            mask_img = Image.fromarray((mask_arr * 255).astype(np.uint8), mode="L")
            m_buf = io.BytesIO()
            mask_img.save(m_buf, format="PNG")

            segmented_objects.append(
                SegmentedObject(
                    id=f"{lbl}_{idx+1:02d}",
                    label=lbl,
                    semantic_type=sem_type,
                    confidence=m_info["score"] if m_info else 0.90,
                    bbox=BBox(x=float(bx), y=float(by), width=float(bw), height=float(bh)),
                    mask_bytes=m_buf.getvalue(),
                    mask_array=mask_arr,
                    extraction_quality=quality,
                )
            )

        return segmented_objects[:max_objects]


class MockSegmentationProvider:
    """Deterministic segmentation provider for testing / local execution."""

    async def segment(self, image: bytes, max_objects: int = 24) -> list[SegmentedObject]:
        env = os.getenv("ENVIRONMENT", "").lower()
        mode = os.getenv("SEGMENTATION_PROVIDER", "").lower()
        if env == "production" and mode != "mock":
            raise HTTPException(
                status_code=503,
                detail="Mock segmentation provider is allowed only when ENVIRONMENT=test or SEGMENTATION_PROVIDER=mock",
            )

        with Image.open(io.BytesIO(image)) as img:
            img_rgba = img.convert("RGBA")
            width, height = img_rgba.size

        objects: list[SegmentedObject] = []
        img_np = np.array(img_rgba)

        alpha = img_np[:, :, 3]
        has_alpha_variation = np.any(alpha == 0) and np.any(alpha > 0)

        if has_alpha_variation:
            mask_arr = alpha > 128
            ys, xs = np.where(mask_arr)
            if len(xs) > 0:
                min_x, max_x = float(xs.min()), float(xs.max())
                min_y, max_y = float(ys.min()), float(ys.max())
                w_box = max(1.0, max_x - min_x + 1)
                h_box = max(1.0, max_y - min_y + 1)

                mask_img = Image.fromarray((mask_arr * 255).astype(np.uint8), mode="L")
                buf = io.BytesIO()
                mask_img.save(buf, format="PNG")

                objects.append(
                    SegmentedObject(
                        id="logo_01",
                        label="logo",
                        semantic_type="logo",
                        confidence=0.98,
                        bbox=BBox(x=min_x, y=min_y, width=w_box, height=h_box),
                        mask_bytes=buf.getvalue(),
                        mask_array=mask_arr,
                        extraction_quality="mask",
                    )
                )

        c_min_x, c_max_x = int(width * 0.25), int(width * 0.75)
        c_min_y, c_max_y = int(height * 0.20), int(height * 0.85)

        c_mask = np.zeros((height, width), dtype=bool)
        c_mask[c_min_y:c_max_y, c_min_x:c_max_x] = True
        c_mask_img = Image.fromarray((c_mask * 255).astype(np.uint8), mode="L")
        buf_c = io.BytesIO()
        c_mask_img.save(buf_c, format="PNG")

        if not any(o.id == "logo_01" for o in objects):
            objects.append(
                SegmentedObject(
                    id="person_01",
                    label="person",
                    semantic_type="person",
                    confidence=0.95,
                    bbox=BBox(
                        x=float(c_min_x),
                        y=float(c_min_y),
                        width=float(c_max_x - c_min_x),
                        height=float(c_max_y - c_min_y),
                    ),
                    mask_bytes=buf_c.getvalue(),
                    mask_array=c_mask,
                    extraction_quality="mask",
                )
            )

        p_min_x, p_max_x = int(width * 0.60), int(width * 0.90)
        p_min_y, p_max_y = int(height * 0.55), int(height * 0.90)

        p_mask = np.zeros((height, width), dtype=bool)
        p_mask[p_min_y:p_max_y, p_min_x:p_max_x] = True
        p_mask_img = Image.fromarray((p_mask * 255).astype(np.uint8), mode="L")
        buf_p = io.BytesIO()
        p_mask_img.save(buf_p, format="PNG")

        objects.append(
            SegmentedObject(
                id="shoe_01",
                label="shoe",
                semantic_type="product",
                confidence=0.88,
                bbox=BBox(
                    x=float(p_min_x),
                    y=float(p_min_y),
                    width=float(p_max_x - p_min_x),
                    height=float(p_max_y - p_min_y),
                ),
                mask_bytes=buf_p.getvalue(),
                mask_array=p_mask,
                extraction_quality="mask",
            )
        )

        return objects[:max_objects]
