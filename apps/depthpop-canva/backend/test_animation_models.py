import math

import pytest
from pydantic import ValidationError

from models.object import DepthObject
from models.scene import DepthScene


def object_payload(*, tracks=None):
    return {
        "id": "person_01",
        "label": "person",
        "semanticType": "person",
        "extractionQuality": "mask",
        "confidence": 0.98,
        "bbox": {"x": 100, "y": 100, "width": 200, "height": 400},
        "assets": {
            "cutoutUrl": "/api/v1/assets/cutout",
            "maskUrl": "/api/v1/assets/mask",
            "thumbnailUrl": "/api/v1/assets/thumb",
        },
        "depth": {"mean": 0.3, "median": 0.28, "min": 0.2, "max": 0.4},
        "transform": {
            "position": {"x": 0.5, "y": 0.5, "z": 0.2},
            "rotation": {"x": 0, "y": 0, "z": 0},
            "scale": {"x": 1, "y": 1, "z": 1},
        },
        "opacity": 1,
        "feather": 0,
        "visible": True,
        "locked": False,
        "order": 0,
        "animationTracks": tracks or [],
    }


def scene_payload(*, tracks=None):
    return {
        "schemaVersion": 1,
        "id": "scene_test123",
        "userId": "user_1",
        "brandId": "brand_1",
        "sourceAssetId": "asset_abc",
        "width": 800,
        "height": 600,
        "settings": {
            "depthStrength": 0.32,
            "depthBlur": 35,
            "depthFidelity": 0.95,
            "renderQuality": "cinematic",
            "numInferenceSteps": 34,
        },
        "objects": [object_payload(tracks=tracks)],
        "reconstructedPlate": {
            "imageUrl": "/api/v1/assets/plate",
            "depthMapUrl": "/api/v1/assets/depth",
        },
        "camera": {
            "position": {"x": 0, "y": 0, "z": 5},
            "target": {"x": 0, "y": 0, "z": 0},
            "fov": 50,
        },
        "timeline": {"durationMs": 2000, "fps": 30, "currentTimeMs": 500},
        "createdAt": "2026-10-01T00:00:00Z",
        "updatedAt": "2026-10-01T00:00:00Z",
    }


def track(property_name="position.x", keyframes=None):
    return {
        "id": "track_1",
        "property": property_name,
        "keyframes": keyframes
        or [
            {"timeMs": 0, "value": 0.5, "easing": "linear"},
            {"timeMs": 1000, "value": 0.7, "easing": "ease-in-out"},
        ],
    }


def test_animation_models_accept_supported_track():
    obj = DepthObject.model_validate(object_payload(tracks=[track()]))
    assert obj.animationTracks[0].property == "position.x"


def test_animation_models_reject_duplicate_times():
    with pytest.raises(ValidationError):
        DepthObject.model_validate(
            object_payload(
                tracks=[
                    track(
                        keyframes=[
                            {"timeMs": 500, "value": 0.2, "easing": "linear"},
                            {"timeMs": 500, "value": 0.4, "easing": "ease-in"},
                        ]
                    )
                ]
            )
        )


def test_animation_models_reject_unsupported_property():
    with pytest.raises(ValidationError):
        DepthObject.model_validate(object_payload(tracks=[track("depth.mean")]))


def test_animation_models_reject_non_finite_values():
    with pytest.raises(ValidationError):
        DepthObject.model_validate(
            object_payload(
                tracks=[
                    track(
                        keyframes=[
                            {"timeMs": 0, "value": math.nan, "easing": "linear"}
                        ]
                    )
                ]
            )
        )


def test_animation_models_reject_opacity_above_one():
    with pytest.raises(ValidationError):
        DepthObject.model_validate(
            object_payload(
                tracks=[
                    track(
                        "opacity",
                        [{"timeMs": 0, "value": 1.1, "easing": "linear"}],
                    )
                ]
            )
        )


def test_animation_models_reject_keyframe_after_timeline():
    with pytest.raises(ValidationError):
        DepthScene.model_validate(
            scene_payload(
                tracks=[
                    track(
                        keyframes=[
                            {"timeMs": 0, "value": 0.5, "easing": "linear"},
                            {"timeMs": 2501, "value": 0.8, "easing": "linear"},
                        ]
                    )
                ]
            )
        )


def test_scene_settings_preserve_runtime_quality_mapping():
    scene = DepthScene.model_validate(scene_payload())
    dumped = scene.model_dump(mode="json", by_alias=True)
    assert dumped["settings"] == {
        "depthStrength": 0.32,
        "depthBlur": 35,
        "depthFidelity": 0.95,
        "renderQuality": "cinematic",
        "numInferenceSteps": 34,
    }
