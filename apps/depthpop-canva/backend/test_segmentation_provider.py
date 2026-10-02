from __future__ import annotations

import asyncio
import io

import numpy as np
import pytest
from fastapi import HTTPException
from PIL import Image

import providers.segmentation_provider as segmentation


def png_bytes(size=(64, 48), value=180) -> bytes:
    image = Image.new("L", size, value)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def rgb_png(size=(64, 48)) -> bytes:
    image = Image.new("RGB", size, (20, 30, 40))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def test_florence_parser_matches_documented_structured_bbox_schema():
    parsed = segmentation.parse_florence2_response(
        {
            "results": {
                "bboxes": [
                    {
                        "x": 5,
                        "y": 6,
                        "w": 20,
                        "h": 15,
                        "label": "person",
                    }
                ]
            }
        },
        width=64,
        height=48,
    )
    assert parsed == [
        {
            "label": "person",
            "x": 5.0,
            "y": 6.0,
            "width": 20.0,
            "height": 15.0,
        }
    ]


def test_florence_parser_rejects_unknown_schema_instead_of_fake_full_image():
    with pytest.raises(ValueError):
        segmentation.parse_florence2_response(
            {"results": {"boxes": [[0, 0, 10, 10]]}},
            width=64,
            height=48,
        )


def test_sam_parser_uses_separate_scores_array():
    parsed = segmentation.parse_sam3_response(
        {
            "masks": [
                {
                    "url": "https://v2.fal.media/files/test/mask.png",
                    "content_type": "image/png",
                }
            ],
            "scores": [0.77],
            "metadata": [{"index": 0}],
        }
    )
    assert parsed == [
        {
            "url": "https://v2.fal.media/files/test/mask.png",
            "score": 0.77,
        }
    ]


def test_fal_segmentation_sends_documented_box_prompt_objects(
    monkeypatch,
):
    calls: list[tuple[str, dict]] = []

    def fake_run(model: str, arguments: dict):
        calls.append((model, arguments))
        if model == segmentation.FLORENCE_MODEL:
            return {
                "results": {
                    "bboxes": [
                        {
                            "x": 4,
                            "y": 5,
                            "w": 20,
                            "h": 18,
                            "label": "shoe",
                        }
                    ]
                }
            }
        return {
            "masks": [
                {
                    "url": "https://v2.fal.media/files/test/mask.png",
                }
            ],
            "scores": [0.91],
        }

    async def fake_media(_url: str) -> bytes:
        return png_bytes((64, 48), 255)

    monkeypatch.setattr(segmentation.fal_client, "run", fake_run)
    monkeypatch.setattr(segmentation, "fetch_fal_media", fake_media)

    provider = segmentation.FalSegmentationProvider(
        fal_key="test-key",
        allow_bbox_fallback=False,
    )
    objects = asyncio.run(provider.segment(rgb_png(), max_objects=4))

    assert len(objects) == 1
    assert objects[0].extraction_quality == "mask"
    assert objects[0].semantic_type == "product"

    sam_args = calls[1][1]
    assert sam_args["prompt"] == ""
    assert sam_args["box_prompts"] == [
        {
            "x_min": 4,
            "y_min": 5,
            "x_max": 24,
            "y_max": 23,
            "object_id": 1,
        }
    ]
    assert sam_args["include_scores"] is True


def test_bbox_fallback_is_explicit_and_truthful(monkeypatch):
    def fake_run(model: str, arguments: dict):
        if model == segmentation.FLORENCE_MODEL:
            return {
                "results": {
                    "bboxes": [
                        {
                            "x": 5,
                            "y": 5,
                            "w": 10,
                            "h": 10,
                            "label": "person",
                        }
                    ]
                }
            }
        return {"masks": [], "metadata": []}

    monkeypatch.setattr(segmentation.fal_client, "run", fake_run)

    provider = segmentation.FalSegmentationProvider(
        fal_key="test-key",
        allow_bbox_fallback=True,
    )
    objects = asyncio.run(provider.segment(rgb_png()))

    assert len(objects) == 1
    assert objects[0].extraction_quality == "bbox_fallback"
    assert np.any(objects[0].mask_array)


def test_strict_segmentation_rejects_missing_sam_mask(monkeypatch):
    def fake_run(model: str, arguments: dict):
        if model == segmentation.FLORENCE_MODEL:
            return {
                "results": {
                    "bboxes": [
                        {
                            "x": 5,
                            "y": 5,
                            "w": 10,
                            "h": 10,
                            "label": "person",
                        }
                    ]
                }
            }
        return {"masks": [], "metadata": []}

    monkeypatch.setattr(segmentation.fal_client, "run", fake_run)

    provider = segmentation.FalSegmentationProvider(
        fal_key="test-key",
        allow_bbox_fallback=False,
    )
    with pytest.raises(HTTPException) as exc:
        asyncio.run(provider.segment(rgb_png()))

    assert exc.value.status_code == 502
    assert "bbox fallback is disabled" in str(exc.value.detail)
