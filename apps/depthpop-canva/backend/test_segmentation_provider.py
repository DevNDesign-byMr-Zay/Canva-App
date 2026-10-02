from __future__ import annotations

import os
import pytest
from providers.segmentation_provider import (
    parse_florence2_response,
    parse_sam3_response,
    map_label_to_semantic_type,
    FalSegmentationProvider,
    MockSegmentationProvider,
)


def test_florence2_standard_od_dict_parser():
    payload = {
        "output": {
            "<OD>": {
                "bboxes": [[200, 100, 800, 500], [500, 600, 900, 900]],
                "labels": ["person", "shoe"]
            }
        }
    }
    parsed = parse_florence2_response(payload, image_width=1000, image_height=1000, strict_schema=True)
    assert len(parsed) == 2
    assert parsed[0]["label"] == "person"
    assert parsed[0]["bbox"] == [100.0, 200.0, 400.0, 600.0]
    assert parsed[1]["label"] == "shoe"
    assert parsed[1]["bbox"] == [600.0, 500.0, 300.0, 400.0]


def test_florence2_normalized_0_1_coordinates():
    payload = {
        "output": {
            "bboxes": [[0.2, 0.1, 0.8, 0.5]],
            "labels": ["car"]
        }
    }
    parsed = parse_florence2_response(payload, image_width=500, image_height=1000, strict_schema=True)
    assert len(parsed) == 1
    assert parsed[0]["label"] == "car"
    assert parsed[0]["bbox"] == [50.0, 200.0, 200.0, 600.0]


def test_florence2_structured_objects_list():
    payload = {
        "objects": [
            {"label": "logo", "box": [0, 0, 100, 100]}
        ]
    }
    parsed = parse_florence2_response(payload, image_width=1000, image_height=1000, strict_schema=True)
    assert len(parsed) == 1
    assert parsed[0]["label"] == "logo"
    assert parsed[0]["bbox"] == [0.0, 0.0, 100.0, 100.0]


def test_florence2_unrecognized_schema_strict_fails():
    with pytest.raises(ValueError, match="Unrecognized or empty Florence-2 response schema"):
        parse_florence2_response({"unknown": "data"}, strict_schema=True)


def test_sam3_response_parser():
    payload = {
        "masks": [
            {"url": "https://fal.media/mask1.png", "score": 0.96},
            {"mask": {"url": "https://fal.media/mask2.png"}, "confidence": 0.91}
        ]
    }
    parsed = parse_sam3_response(payload)
    assert len(parsed) == 2
    assert parsed[0]["url"] == "https://fal.media/mask1.png"
    assert parsed[0]["score"] == 0.96
    assert parsed[1]["url"] == "https://fal.media/mask2.png"
    assert parsed[1]["score"] == 0.91


def test_label_mapping():
    assert map_label_to_semantic_type("Young Woman") == "person"
    assert map_label_to_semantic_type("Nike Logo") == "logo"
    assert map_label_to_semantic_type("Text Sign") == "text"
    assert map_label_to_semantic_type("Sports Shoe") == "product"
    assert map_label_to_semantic_type("Office Tower") == "building"
    assert map_label_to_semantic_type("Red Sports Car") == "vehicle"
    assert map_label_to_semantic_type("Wooden Chair") == "prop"
    assert map_label_to_semantic_type("Random Noise") == "unknown"
