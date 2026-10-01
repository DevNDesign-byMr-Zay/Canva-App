from __future__ import annotations

import io
from typing import Protocol
import numpy as np
from PIL import Image, ImageDraw, ImageFont
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


class ProductionSegmentationError(Exception):
    pass


class ProductionSegmentationProvider:
    """Production segmentation provider.

    Fails closed if external segmentation provider service or credentials are not configured.
    """

    def __init__(self, endpoint: str | None = None, api_key: str | None = None):
        self.endpoint = endpoint
        self.api_key = api_key

    async def segment(self, image: bytes, max_objects: int = 24) -> list[SegmentedObject]:
        if not self.endpoint or not self.api_key:
            raise ProductionSegmentationError(
                "Production segmentation provider is not configured. Set SEGMENTATION_PROVIDER=mock "
                "for local/test execution or supply production segmentation credentials."
            )
        # If credentials exist, call external segmentation API here.
        raise ProductionSegmentationError("Production segmentation provider execution failed.")


class MockSegmentationProvider:
    """Deterministic segmentation provider for testing and local development."""

    async def segment(self, image: bytes, max_objects: int = 24) -> list[SegmentedObject]:
        with Image.open(io.BytesIO(image)) as img:
            img_rgba = img.convert("RGBA")
            width, height = img_rgba.size

        objects: list[SegmentedObject] = []
        img_np = np.array(img_rgba)

        # Check if alpha channel has distinct objects (transparent source / logo source)
        alpha = img_np[:, :, 3]
        has_alpha_variation = np.any(alpha == 0) and np.any(alpha > 0)

        if has_alpha_variation:
            # Alpha cutout / logo object
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

        # Generate deterministic regions based on image dimensions / grid
        # Region 1: Central element (person / main object)
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

        # Region 2: Secondary element (prop / shoe / product)
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

        # Region 3: Text region (if top region is present)
        t_min_x, t_max_x = int(width * 0.10), int(width * 0.50)
        t_min_y, t_max_y = int(height * 0.05), int(height * 0.20)

        t_mask = np.zeros((height, width), dtype=bool)
        t_mask[t_min_y:t_max_y, t_min_x:t_max_x] = True
        t_mask_img = Image.fromarray((t_mask * 255).astype(np.uint8), mode="L")
        buf_t = io.BytesIO()
        t_mask_img.save(buf_t, format="PNG")

        objects.append(
            SegmentedObject(
                id="text_01",
                label="text",
                semantic_type="text",
                confidence=0.92,
                bbox=BBox(
                    x=float(t_min_x),
                    y=float(t_min_y),
                    width=float(t_max_x - t_min_x),
                    height=float(t_max_y - t_min_y),
                ),
                mask_bytes=buf_t.getvalue(),
                mask_array=t_mask,
            )
        )

        # Ensure max_objects limit is respected
        return objects[:max_objects]
