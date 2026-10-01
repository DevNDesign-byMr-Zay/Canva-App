import pytest
from pydantic import ValidationError

from models import ExportSubmission, HoloScene, HoloExportRequest


def scene_payload():
    return {
        "schemaVersion": 1,
        "id": "hf-scene-test",
        "source": {
            "type": "text",
            "text": "HOLOFORGE",
        },
        "objects": [
            {
                "id": "hf-object-holo_text",
                "name": "HOLOFORGE",
                "creationType": "holo_text",
                "geometry": {
                    "type": "text",
                    "thickness": 0.16,
                    "bevelSize": 0.02,
                    "bevelSegments": 3,
                },
                "material": {
                    "family": "foil",
                    "baseColor": "#5cecff",
                    "opacity": 1,
                    "metalness": 0.5,
                    "roughness": 0.2,
                    "transmission": 0,
                    "ior": 1.3,
                    "emissionColor": "#9c73ff",
                    "emissionStrength": 0.6,
                    "spectralShift": 72,
                    "diffraction": 0.4,
                    "scanlineStrength": 0.3,
                    "shimmerStrength": 0.7,
                    "reflectionStrength": 80,
                },
                "transform": {
                    "position": {"x": 0, "y": 0, "z": 0},
                    "rotation": {"x": 0, "y": 0, "z": 0},
                    "scale": {"x": 1, "y": 1, "z": 1},
                },
                "animationPreset": "custom",
                "animationTracks": [
                    {
                        "id": "track-rotation",
                        "property": "rotation",
                        "keyframes": [
                            {
                                "id": "rotation-0",
                                "timeMs": 0,
                                "value": {"x": 0, "y": 0, "z": 0},
                                "easing": "linear",
                            },
                            {
                                "id": "rotation-3000",
                                "timeMs": 3000,
                                "value": {"x": 0, "y": 3.14, "z": 0},
                                "easing": "ease-in-out",
                            },
                        ],
                    }
                ],
                "sourceText": "HOLOFORGE",
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
            "durationMs": 6000,
            "fps": 30,
            "currentTimeMs": 0,
            "playing": False,
        },
        "exportProfile": "generic-3d",
    }


def request_payload(format_name="scene-json"):
    profiles = {
        "scene-json": "scene-authoring",
        "glb": "generic-3d",
        "gltf": "generic-3d",
        "usdz": "ios-ar",
        "webm-alpha": "transparent-video",
        "mp4": "transparent-video",
        "png-sequence": "image-sequence",
        "lightfield-quilt": "lightfield-quilt",
    }
    is_quilt = format_name == "lightfield-quilt"
    payload = {
        "schemaVersion": 1,
        "sceneId": "hf-scene-test",
        "format": format_name,
        "profile": profiles[format_name],
        "includeAnimation": not is_quilt,
        "resolution": (
            {"width": 500, "height": 900}
            if is_quilt
            else {"width": 1920, "height": 1080}
        ),
        "transparentBackground": format_name in {"webm-alpha", "lightfield-quilt"},
    }
    if is_quilt:
        payload["quilt"] = {
            "columns": 5,
            "rows": 9,
            "views": 45,
            "viewAspect": 1.0,
            "viewConeDegrees": 40,
        }
    return payload


def test_scene_contract_accepts_sorted_keyframes():
    scene = HoloScene.model_validate(scene_payload())
    assert scene.schemaVersion == 1
    assert scene.objects[0].animationTracks[0].keyframes[1].timeMs == 3000


def test_scene_contract_rejects_remote_preview_url():
    payload = scene_payload()
    payload["source"]["previewUrl"] = "https://example.com/source.png"
    with pytest.raises(ValidationError, match="embedded image data URL"):
        HoloScene.model_validate(payload)


def test_scene_contract_rejects_keyframe_after_timeline():
    payload = scene_payload()
    payload["objects"][0]["animationTracks"][0]["keyframes"][1]["timeMs"] = 7000
    with pytest.raises(ValidationError, match="outside HoloScene timeline"):
        HoloScene.model_validate(payload)


def test_export_request_rejects_wrong_profile():
    payload = request_payload("glb")
    payload["profile"] = "transparent-video"
    with pytest.raises(ValidationError, match="requires profile generic-3d"):
        HoloExportRequest.model_validate(payload)


def test_submission_requires_matching_scene_id():
    request = request_payload()
    request["sceneId"] = "another-scene"
    with pytest.raises(ValidationError, match="does not match scene"):
        ExportSubmission.model_validate({"scene": scene_payload(), "request": request})


def test_alpha_webm_requires_transparent_background():
    payload = request_payload("webm-alpha")
    payload["transparentBackground"] = False
    with pytest.raises(ValidationError, match="transparentBackground=true"):
        HoloExportRequest.model_validate(payload)


def test_alpha_webm_requires_animation():
    payload = request_payload("webm-alpha")
    payload["includeAnimation"] = False
    with pytest.raises(ValidationError, match="requires includeAnimation=true"):
        HoloExportRequest.model_validate(payload)


def test_lightfield_quilt_accepts_complete_view_grid():
    request = HoloExportRequest.model_validate(
        request_payload("lightfield-quilt")
    )
    assert request.quilt is not None
    assert request.quilt.views == 45
    assert request.quilt.viewConeDegrees == 40


def test_lightfield_quilt_rejects_missing_tile_view():
    payload = request_payload("lightfield-quilt")
    payload["quilt"]["views"] = 44
    with pytest.raises(ValidationError, match="one light-field view per quilt tile"):
        HoloExportRequest.model_validate(payload)


def test_lightfield_quilt_rejects_animation_in_v1():
    payload = request_payload("lightfield-quilt")
    payload["includeAnimation"] = True
    with pytest.raises(ValidationError, match="requires includeAnimation=false"):
        HoloExportRequest.model_validate(payload)


def test_lightfield_quilt_rejects_non_divisible_resolution():
    payload = request_payload("lightfield-quilt")
    payload["resolution"]["width"] = 501
    with pytest.raises(ValidationError, match="width must be divisible"):
        HoloExportRequest.model_validate(payload)


def test_lightfield_quilt_rejects_tile_aspect_mismatch():
    payload = request_payload("lightfield-quilt")
    payload["quilt"]["viewAspect"] = 1.8
    with pytest.raises(ValidationError, match="viewAspect must match"):
        HoloExportRequest.model_validate(payload)



def test_usdz_request_accepts_static_ios_ar_profile():
    payload = request_payload("usdz")
    payload["includeAnimation"] = False
    request = HoloExportRequest.model_validate(payload)
    assert request.format == "usdz"
    assert request.profile == "ios-ar"
