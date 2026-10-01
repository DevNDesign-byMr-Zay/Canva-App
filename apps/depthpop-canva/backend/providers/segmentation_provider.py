from __future__ import annotations

import asyncio
import base64
import io
import os
from typing import Any, Protocol
import fal_client
import httpx
import numpy as np
from fastapi import HTTPException
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


def parse_florence2_response(payload: dict[str, Any]) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    output = payload.get("output") or payload.get("results") or payload
    if isinstance(output, dict):
        bboxes = output.get("bboxes") or output.get("boxes") or []
        labels = output.get("labels") or []
        for idx, box in enumerate(bboxes):
            label = labels[idx] if idx < len(labels) else "object"
            if len(box) == 4:
                results.append({"label": str(label), "box": [float(v) for v in box]})
    elif isinstance(output, list):
        for item in output:
            if isinstance(item, dict):
                lbl = item.get("label") or item.get("name") or "object"
                bx = item.get("box") or item.get("bbox") or [item.get("x", 0), item.get("y", 0), item.get("width", 0), item.get("height", 0)]
                results.append({"label": str(lbl), "box": [float(v) for v in bx]})

    return results


def parse_sam3_response(payload: dict[str, Any]) -> list[dict[str, Any]]:
    masks: list[dict[str, Any]] = []
    items = payload.get("masks") or payload.get("results") or payload.get("output") or []
    if isinstance(items, list):
        for item in items:
            if isinstance(item, dict):
                url = item.get("url") or item.get("mask_url") or item.get("image_url")
                score = float(item.get("score") or item.get("confidence") or 0.90)
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

        detections = parse_florence2_response(florence_resp)
        if not detections:
            detections = [{"label": "object", "box": [0, 0, width, height]}]

        boxes_prompt = [d["box"] for d in detections[:max_objects]]
        try:
            sam_resp = await asyncio.to_thread(
                fal_client.run,
                "fal-ai/sam-3/image",
                arguments={"image_url": data_url, "box_prompts": boxes_prompt},
            )
        except Exception as exc:
            raise HTTPException(status_code=502, detail="Segmentation provider (SAM-3) failed") from exc

        parsed_masks = parse_sam3_response(sam_resp)

        segmented_objects: list[SegmentedObject] = []
        for idx, det in enumerate(detections[:max_objects]):
            lbl = det["label"]
            sem_type = map_label_to_semantic_type(lbl)
            box = det["box"]

            if box[2] > box[0] and box[3] > box[1]:
                bx, by, bw, bh = box[0], box[1], box[2] - box[0], box[3] - box[1]
            else:
                bx, by, bw, bh = box[0], box[1], box[2], box[3]

            m_info = parsed_masks[idx] if idx < len(parsed_masks) else None
            mask_arr = np.zeros((height, width), dtype=bool)

            if m_info and m_info.get("url"):
                try:
                    from providers.depth_provider import FalDepthProvider
                    mask_raw = await FalDepthProvider._fetch_provider_image(m_info["url"])
                    with Image.open(io.BytesIO(mask_raw)) as m_img:
                        mask_arr = np.array(m_img.convert("L")) > 128
                except Exception:
                    mask_arr[int(by):int(by+bh), int(bx):int(bx+bw)] = True
            else:
                mask_arr[int(by):int(by+bh), int(bx):int(bx+bw)] = True

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
                )
            )

        return segmented_objects[:max_objects]


class MockSegmentationProvider:
    """Deterministic segmentation provider for testing / local execution."""

    async def segment(self, image: bytes, max_objects: int = 24) -> list[SegmentedObject]:
        env = os.getenv("ENVIRONMENT", "").lower()
        mode = os.getenv("SEGMENTATION_PROVIDER", "").lower()
        if env == "production" or (env != "test" and mode != "mock" and "PYTEST_CURRENT_TEST" not in os.environ):
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
            )
        )

        return objects[:max_objects]
