from __future__ import annotations

import io
import time
import pytest
import numpy as np
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

import app as depthpop
from auth import verify_canva_user, VerifiedCanvaUser
from models.object import BBox
from providers.segmentation_provider import SegmentedObject
from services.scene_builder import SceneBuilderService
from services.segmentation import SegmentationService
from services.depth import DepthService


def _create_test_image(
    size=(100, 100),
    color=(200, 100, 50),
    transparent_logo=False,
    with_text=False,
) -> bytes:
    if transparent_logo:
        img = Image.new("RGBA", size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        draw.ellipse((25, 25, 75, 75), fill=(255, 215, 0, 255))
    elif with_text:
        img = Image.new("RGBA", size, (240, 240, 240, 255))
        draw = ImageDraw.Draw(img)
        draw.rectangle((10, 10, 90, 30), fill=(20, 20, 20, 255))
        draw.text((15, 15), "DEPTHPOP", fill=(255, 255, 255, 255))
    else:
        img = Image.new("RGBA", size, color + (255,))
        draw = ImageDraw.Draw(img)
        draw.rectangle((20, 20, 80, 80), fill=(100, 200, 150, 255))

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


async def dummy_url_builder(data: bytes, mime: str) -> str:
    return "https://test.server/api/v1/assets/dummy123"


@pytest.fixture
def test_client():
    return TestClient(depthpop.app)


@pytest.fixture
def auth_client(test_client):
    async def fake_verify():
        return VerifiedCanvaUser(user_id="user_test_a", brand_id="brand_test_a")

    depthpop.app.dependency_overrides[verify_canva_user] = fake_verify
    yield test_client
    depthpop.app.dependency_overrides.clear()


def test_unauthenticated_api_v1_requests_fail_with_401(test_client):
    depthpop.app.dependency_overrides.clear()
    image_bytes = _create_test_image((32, 32))

    # POST scene unauthenticated
    resp_post = test_client.post(
        "/api/v1/scenes",
        files={"image": ("test.png", image_bytes, "image/png")},
    )
    assert resp_post.status_code == 401

    # GET job unauthenticated
    resp_job = test_client.get("/api/v1/jobs/job_missing")
    assert resp_job.status_code == 401

    # GET scene unauthenticated
    resp_scene = test_client.get("/api/v1/scenes/scene_missing")
    assert resp_scene.status_code == 401


def test_cross_user_scene_and_job_access_denial(test_client):
    async def fake_user_a():
        return VerifiedCanvaUser(user_id="user_a", brand_id="brand_a")

    async def fake_user_b():
        return VerifiedCanvaUser(user_id="user_b", brand_id="brand_b")

    image_bytes = _create_test_image((64, 64))

    # User A creates scene
    depthpop.app.dependency_overrides[verify_canva_user] = fake_user_a
    try:
        post_resp = test_client.post(
            "/api/v1/scenes",
            files={"image": ("test.png", image_bytes, "image/png")},
            data={"inpaint": "false"},
        )
        assert post_resp.status_code == 200
        job_id = post_resp.json()["jobId"]

        job_resp = test_client.get(f"/api/v1/jobs/{job_id}")
        assert job_resp.status_code == 200
        scene_id = job_resp.json()["sceneId"]
        assert scene_id is not None

        # User B attempts to access User A's job and scene
        depthpop.app.dependency_overrides[verify_canva_user] = fake_user_b

        b_job_resp = test_client.get(f"/api/v1/jobs/{job_id}")
        assert b_job_resp.status_code == 404, "User B should not be able to access User A's job"

        b_scene_resp = test_client.get(f"/api/v1/scenes/{scene_id}")
        assert b_scene_resp.status_code == 404, "User B should not be able to access User A's scene"
    finally:
        depthpop.app.dependency_overrides.clear()


def test_post_scene_returns_queued_job_and_completes(auth_client):
    image_bytes = _create_test_image((64, 64))
    response = auth_client.post(
        "/api/v1/scenes",
        files={"image": ("test.png", image_bytes, "image/png")},
        data={
            "max_objects": "10",
            "segmentation_mode": "auto",
            "depth_quality": "high",
            "inpaint": "false",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "jobId" in data
    assert data["status"] == "queued"

    job_id = data["jobId"]

    # Retrieve job status
    job_resp = auth_client.get(f"/api/v1/jobs/{job_id}")
    assert job_resp.status_code == 200
    job_data = job_resp.json()
    assert job_data["jobId"] == job_id
    assert job_data["status"] == "complete"
    scene_id = job_data["sceneId"]
    assert scene_id is not None

    # Retrieve canonical scene
    scene_resp = auth_client.get(f"/api/v1/scenes/{scene_id}")
    assert scene_resp.status_code == 200
    scene = scene_resp.json()

    # Schema Version 1 Verification
    assert scene["schemaVersion"] == 1
    assert scene["id"] == scene_id
    assert scene["width"] == 64
    assert scene["height"] == 64
    assert "objects" in scene
    assert "reconstructedPlate" in scene
    assert "camera" in scene
    assert "timeline" in scene

    # Objects ID uniqueness and semantic taxonomy verification
    objects = scene["objects"]
    object_ids = [obj["id"] for obj in objects]
    assert len(object_ids) == len(set(object_ids)), "Duplicate object IDs detected in scene graph!"

    for obj in objects:
        assert obj["semanticType"] in [
            "person",
            "logo",
            "text",
            "product",
            "building",
            "vehicle",
            "prop",
            "unknown",
        ]
        assert not any(bad in obj["semanticType"] for bad in ["foreground", "midground", "background"])
        assert 0.0 <= obj["depth"]["mean"] <= 1.0
        assert 0.0 <= obj["depth"]["median"] <= 1.0
        assert 0.0 <= obj["depth"]["min"] <= 1.0
        assert 0.0 <= obj["depth"]["max"] <= 1.0


def test_fixture_single_object():
    class SingleObjSegProvider:
        async def segment(self, image: bytes, max_objects: int = 24):
            m = np.zeros((50, 50), dtype=bool)
            m[10:40, 10:40] = True
            buf = io.BytesIO()
            Image.fromarray((m * 255).astype(np.uint8)).save(buf, format="PNG")
            return [
                SegmentedObject(
                    id="product_01",
                    label="shoe",
                    semantic_type="product",
                    confidence=0.99,
                    bbox=BBox(x=10, y=10, width=30, height=30),
                    mask_bytes=buf.getvalue(),
                    mask_array=m,
                )
            ]

    builder = SceneBuilderService(
        segmentation_service=SegmentationService(provider=SingleObjSegProvider())
    )

    import asyncio

    image_bytes = _create_test_image((50, 50))
    scene = asyncio.run(
        builder.build_scene(
            image_bytes=image_bytes,
            source_asset_id="asset_single",
            url_builder=dummy_url_builder,
        )
    )

    assert len(scene.objects) == 1
    obj = scene.objects[0]
    assert obj.id == "shoe_01"
    assert obj.semanticType == "product"


def test_fixture_multiple_objects_different_depths():
    class MultiObjSegProvider:
        async def segment(self, image: bytes, max_objects: int = 24):
            m1 = np.zeros((100, 100), dtype=bool)
            m1[10:30, 10:30] = True
            m2 = np.zeros((100, 100), dtype=bool)
            m2[60:90, 60:90] = True

            buf1, buf2 = io.BytesIO(), io.BytesIO()
            Image.fromarray((m1 * 255).astype(np.uint8)).save(buf1, format="PNG")
            Image.fromarray((m2 * 255).astype(np.uint8)).save(buf2, format="PNG")

            return [
                SegmentedObject(
                    id="person_01",
                    label="person",
                    semantic_type="person",
                    confidence=0.95,
                    bbox=BBox(x=10, y=10, width=20, height=20),
                    mask_bytes=buf1.getvalue(),
                    mask_array=m1,
                ),
                SegmentedObject(
                    id="building_01",
                    label="building",
                    semantic_type="building",
                    confidence=0.90,
                    bbox=BBox(x=60, y=60, width=30, height=30),
                    mask_bytes=buf2.getvalue(),
                    mask_array=m2,
                ),
            ]

    builder = SceneBuilderService(
        segmentation_service=SegmentationService(provider=MultiObjSegProvider())
    )

    import asyncio

    image_bytes = _create_test_image((100, 100))
    scene = asyncio.run(
        builder.build_scene(
            image_bytes=image_bytes,
            source_asset_id="asset_multi",
            url_builder=dummy_url_builder,
        )
    )

    assert len(scene.objects) == 2
    ids = [o.id for o in scene.objects]
    assert "person_01" in ids
    assert "building_01" in ids


def test_fixture_overlapping_objects():
    class OverlapSegProvider:
        async def segment(self, image: bytes, max_objects: int = 24):
            m1 = np.zeros((80, 80), dtype=bool)
            m1[20:60, 20:60] = True
            m2 = np.zeros((80, 80), dtype=bool)
            m2[40:70, 40:70] = True

            buf1, buf2 = io.BytesIO(), io.BytesIO()
            Image.fromarray((m1 * 255).astype(np.uint8)).save(buf1, format="PNG")
            Image.fromarray((m2 * 255).astype(np.uint8)).save(buf2, format="PNG")

            return [
                SegmentedObject(
                    id="person_01",
                    label="person",
                    semantic_type="person",
                    confidence=0.95,
                    bbox=BBox(x=20, y=20, width=40, height=40),
                    mask_bytes=buf1.getvalue(),
                    mask_array=m1,
                ),
                SegmentedObject(
                    id="vehicle_01",
                    label="car",
                    semantic_type="vehicle",
                    confidence=0.88,
                    bbox=BBox(x=40, y=40, width=30, height=30),
                    mask_bytes=buf2.getvalue(),
                    mask_array=m2,
                ),
            ]

    builder = SceneBuilderService(
        segmentation_service=SegmentationService(provider=OverlapSegProvider())
    )

    import asyncio

    image_bytes = _create_test_image((80, 80))
    scene = asyncio.run(
        builder.build_scene(
            image_bytes=image_bytes,
            source_asset_id="asset_overlap",
            url_builder=dummy_url_builder,
        )
    )

    assert len(scene.objects) == 2
    assert scene.objects[0].id != scene.objects[1].id


def test_fixture_transparent_logo_source():
    image_bytes = _create_test_image((100, 100), transparent_logo=True)
    builder = SceneBuilderService()

    import asyncio

    scene = asyncio.run(
        builder.build_scene(
            image_bytes=image_bytes,
            source_asset_id="asset_logo",
            url_builder=dummy_url_builder,
        )
    )

    assert len(scene.objects) >= 1


def test_fixture_segmentation_provider_error():
    class ErrorSegProvider:
        async def segment(self, image: bytes, max_objects: int = 24):
            raise RuntimeError("Segmentation engine unavailable")

    builder = SceneBuilderService(
        segmentation_service=SegmentationService(provider=ErrorSegProvider())
    )

    import asyncio

    image_bytes = _create_test_image((50, 50))
    with pytest.raises(RuntimeError, match="Segmentation engine unavailable"):
        asyncio.run(
            builder.build_scene(
                image_bytes=image_bytes,
                source_asset_id="asset_err",
                url_builder=dummy_url_builder,
            )
        )


def test_fixture_depth_provider_error():
    class ErrorDepthProvider:
        async def estimate(self, image: bytes, quality: str = "high"):
            raise RuntimeError("Depth estimation service offline")

    builder = SceneBuilderService(
        depth_service=DepthService(provider=ErrorDepthProvider())
    )

    import asyncio

    image_bytes = _create_test_image((50, 50))
    with pytest.raises(RuntimeError, match="Depth estimation service offline"):
        asyncio.run(
            builder.build_scene(
                image_bytes=image_bytes,
                source_asset_id="asset_err2",
                url_builder=dummy_url_builder,
            )
        )


def test_safe_object_count_limit():
    class ManyObjSegProvider:
        async def segment(self, image: bytes, max_objects: int = 24):
            objs = []
            for i in range(50):
                m = np.zeros((100, 100), dtype=bool)
                m[i : i + 2, i : i + 2] = True
                buf = io.BytesIO()
                Image.fromarray((m * 255).astype(np.uint8)).save(buf, format="PNG")
                objs.append(
                    SegmentedObject(
                        id=f"item_{i}",
                        label="prop",
                        semantic_type="prop",
                        confidence=0.8,
                        bbox=BBox(x=i, y=i, width=2, height=2),
                        mask_bytes=buf.getvalue(),
                        mask_array=m,
                    )
                )
            return objs[:max_objects]

    builder = SceneBuilderService(
        segmentation_service=SegmentationService(provider=ManyObjSegProvider())
    )

    import asyncio

    image_bytes = _create_test_image((100, 100))
    scene = asyncio.run(
        builder.build_scene(
            image_bytes=image_bytes,
            source_asset_id="asset_limit",
            url_builder=dummy_url_builder,
            max_objects=5,
        )
    )

    assert len(scene.objects) == 5


def test_upload_validation_empty_fails_400(auth_client):
    resp = auth_client.post(
        "/api/v1/scenes",
        files={"image": ("empty.png", b"", "image/png")},
    )
    assert resp.status_code == 400


def test_upload_validation_unsupported_type_fails_415(auth_client):
    resp = auth_client.post(
        "/api/v1/scenes",
        files={"image": ("test.gif", b"GIF89a...", "image/gif")},
    )
    assert resp.status_code == 415


def test_upload_validation_malformed_raster_fails_400(auth_client):
    resp = auth_client.post(
        "/api/v1/scenes",
        files={"image": ("corrupted.png", b"not-a-real-png-image", "image/png")},
    )
    assert resp.status_code == 400


def test_upload_validation_over_50mb_fails_413(auth_client):
    oversized = b"a" * (50 * 1024 * 1024 + 10)
    resp = auth_client.post(
        "/api/v1/scenes",
        files={"image": ("big.png", oversized, "image/png")},
    )
    assert resp.status_code == 413


def test_webp_image_data_url_and_mime_detection():
    from providers.depth_provider import _detect_image_mime

    webp_img = Image.new("RGB", (32, 32), (100, 150, 200))
    buf = io.BytesIO()
    webp_img.save(buf, format="WEBP")
    webp_bytes = buf.getvalue()

    mime = _detect_image_mime(webp_bytes)
    assert mime == "image/webp"


def test_florence2_response_parser_with_frozen_fixture():
    from providers.segmentation_provider import parse_florence2_response

    frozen_florence_fixture = {
        "status": "OK",
        "output": {
            "bboxes": [
                [10.0, 10.0, 50.0, 80.0],
                [60.0, 60.0, 90.0, 90.0],
            ],
            "labels": ["person", "shoe"],
        },
    }

    parsed = parse_florence2_response(frozen_florence_fixture)
    assert len(parsed) == 2
    assert parsed[0]["label"] == "person"
    assert parsed[0]["box"] == [10.0, 10.0, 50.0, 80.0]
    assert parsed[1]["label"] == "shoe"


def test_sam3_response_parser_with_frozen_fixture():
    from providers.segmentation_provider import parse_sam3_response

    frozen_sam3_fixture = {
        "status": "OK",
        "masks": [
            {"url": "https://v2.fal.media/files/mask1.png", "score": 0.96},
            {"url": "https://v2.fal.media/files/mask2.png", "score": 0.89},
        ],
    }

    parsed = parse_sam3_response(frozen_sam3_fixture)
    assert len(parsed) == 2
    assert parsed[0]["url"] == "https://v2.fal.media/files/mask1.png"
    assert parsed[0]["score"] == 0.96


def test_mock_providers_fail_closed_in_production_mode(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.delenv("SEGMENTATION_PROVIDER", raising=False)
    monkeypatch.delenv("DEPTH_PROVIDER", raising=False)
    monkeypatch.delenv("INPAINT_PROVIDER", raising=False)

    from providers.segmentation_provider import MockSegmentationProvider
    from providers.depth_provider import MockDepthProvider
    from providers.inpaint_provider import MockInpaintProvider
    from fastapi import HTTPException

    mock_seg = MockSegmentationProvider()
    mock_depth = MockDepthProvider()
    mock_inpaint = MockInpaintProvider()

    import asyncio
    test_img = _create_test_image((32, 32))

    with pytest.raises(HTTPException) as exc_seg:
        asyncio.run(mock_seg.segment(test_img))
    assert exc_seg.value.status_code == 503

    with pytest.raises(HTTPException) as exc_depth:
        asyncio.run(mock_depth.estimate(test_img))
    assert exc_depth.value.status_code == 503

    with pytest.raises(HTTPException) as exc_inp:
        asyncio.run(mock_inpaint.inpaint(test_img, test_img))
    assert exc_inp.value.status_code == 503


def test_unsupported_segmentation_mode_and_depth_quality_return_422(auth_client):
    image_bytes = _create_test_image((32, 32))

    resp_seg = auth_client.post(
        "/api/v1/scenes",
        files={"image": ("test.png", image_bytes, "image/png")},
        data={"segmentation_mode": "invalid_mode"},
    )
    assert resp_seg.status_code == 422

    resp_depth = auth_client.post(
        "/api/v1/scenes",
        files={"image": ("test.png", image_bytes, "image/png")},
        data={"depth_quality": "invalid_quality"},
    )
    assert resp_depth.status_code == 422


def test_depth_orientation_canonical_normalization():
    from services.object_builder import build_depth_object
    from models.object import BBox
    import asyncio

    depth_array = np.zeros((100, 100), dtype=np.float32)
    depth_array[10:40, 10:40] = 0.1
    depth_array[60:90, 60:90] = 0.9

    bg_mask = np.zeros((100, 100), dtype=bool)
    bg_mask[10:40, 10:40] = True

    fg_mask = np.zeros((100, 100), dtype=bool)
    fg_mask[60:90, 60:90] = True

    buf_bg, buf_fg = io.BytesIO(), io.BytesIO()
    Image.fromarray((bg_mask * 255).astype(np.uint8)).save(buf_bg, format="PNG")
    Image.fromarray((fg_mask * 255).astype(np.uint8)).save(buf_fg, format="PNG")

    bg_seg = SegmentedObject(
        id="bg_01",
        label="building",
        semantic_type="building",
        confidence=0.90,
        bbox=BBox(x=10, y=10, width=30, height=30),
        mask_bytes=buf_bg.getvalue(),
        mask_array=bg_mask,
    )
    fg_seg = SegmentedObject(
        id="fg_01",
        label="person",
        semantic_type="person",
        confidence=0.98,
        bbox=BBox(x=60, y=60, width=30, height=30),
        mask_bytes=buf_fg.getvalue(),
        mask_array=fg_mask,
    )

    src_img = _create_test_image((100, 100))

    bg_obj = asyncio.run(build_depth_object(bg_seg, src_img, depth_array, dummy_url_builder))
    fg_obj = asyncio.run(build_depth_object(fg_seg, src_img, depth_array, dummy_url_builder))

    assert fg_obj.depth.median > bg_obj.depth.median
    assert fg_obj.transform.position.z > bg_obj.transform.position.z
    assert fg_obj.transform.position.z > 0.0, "Foreground object Z should be positive (nearer camera)"
    assert bg_obj.transform.position.z < 0.0, "Background object Z should be negative (farther from camera)"


def test_scene_patch_and_composite(auth_client):
    image_bytes = _create_test_image((64, 64))

    post_resp = auth_client.post(
        "/api/v1/scenes",
        files={"image": ("test.png", image_bytes, "image/png")},
        data={"inpaint": "false"},
    )
    assert post_resp.status_code == 200
    job_id = post_resp.json()["jobId"]

    job_resp = auth_client.get(f"/api/v1/jobs/{job_id}")
    scene_id = job_resp.json()["sceneId"]

    # PATCH scene transform
    patch_resp = auth_client.patch(
        f"/api/v1/scenes/{scene_id}",
        json={
            "camera": {"fov": 60},
            "objects": [
                {
                  "id": "person_01",
                  "label": "person",
                  "order": 1,
                  "opacity": 0.9,
                  "feather": 2,
                  "visible": True,
                  "locked": False,
                  "transform": {
                    "position": {"x": 0.4, "y": 0.4, "z": 0.8},
                    "rotation": {"x": 0, "y": 0, "z": 10},
                    "scale": {"x": 1.1, "y": 1.1, "z": 1.1}
                  }
                }
            ]
        }
    )
    assert patch_resp.status_code == 200
    updated_scene = patch_resp.json()
    assert updated_scene["camera"]["fov"] == 60

    # Composite scene
    comp_resp = auth_client.post(f"/api/v1/scenes/{scene_id}/composite")
    assert comp_resp.status_code == 200
    comp_data = comp_resp.json()
    assert comp_data["ok"] is True
    assert comp_data["url"].startswith("http://testserver/api/v1/assets/")


def test_segmentation_mode_routing():
    from services.segmentation import SegmentationService
    from providers.segmentation_provider import FalSegmentationProvider, MockSegmentationProvider

    srv = SegmentationService()
    p_fal = srv.get_provider(mode="florence_sam3")
    assert isinstance(p_fal, FalSegmentationProvider)

    p_mock = srv.get_provider(mode="mock")
    assert isinstance(p_mock, MockSegmentationProvider)


def test_depth_polarity_normalization_inversion():
    from providers.depth_provider import normalize_depth_polarity

    # Dark center, bright edges (center < edges) -> should invert
    arr = np.ones((50, 50), dtype=np.float32) * 0.9
    arr[18:32, 18:32] = 0.1

    norm_arr, polarity = normalize_depth_polarity(arr)
    assert polarity == "inverted"
    assert norm_arr[25, 25] == 0.9, "Center should become near (0.9)"
