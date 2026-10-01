from __future__ import annotations

import io
import time
import pytest
import numpy as np
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw, ImageFont

import app as depthpop
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
        # Draw a logo shape in the center
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


@pytest.fixture
def test_client():
    return TestClient(depthpop.app)


def test_post_scene_returns_queued_job_and_completes(test_client):
    image_bytes = _create_test_image((64, 64))
    response = test_client.post(
        "/api/v1/scenes",
        files={"image": ("test.png", image_bytes, "image/png")},
        data={
            "max_objects": "10",
            "segmentation_mode": "auto",
            "depth_quality": "high",
            "inpaint": "true",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "jobId" in data
    assert data["status"] == "queued"

    job_id = data["jobId"]

    # Poll job status until complete
    scene_id = None
    for _ in range(30):
        time.sleep(0.1)
        job_resp = test_client.get(f"/api/v1/jobs/{job_id}")
        assert job_resp.status_code == 200
        job_data = job_resp.json()
        assert job_data["jobId"] == job_id
        if job_data["status"] == "complete":
            scene_id = job_data["sceneId"]
            assert job_data["stage"] == "complete"
            break

    assert scene_id is not None

    # Retrieve canonical scene
    scene_resp = test_client.get(f"/api/v1/scenes/{scene_id}")
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
    assert scene["camera"]["fov"] == 50.0

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
        assert obj["assets"]["cutoutUrl"].startswith("http")
        assert obj["assets"]["maskUrl"].startswith("http")
        assert obj["assets"]["thumbnailUrl"].startswith("http")


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

    def dummy_url_builder(data: bytes, mime: str) -> str:
        return "https://test.server/cache/image/123"

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

    def dummy_url_builder(data: bytes, mime: str) -> str:
        return "https://test.server/cache/image/multi"

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
    assert len(set(ids)) == 2


def test_fixture_overlapping_objects():
    class OverlapSegProvider:
        async def segment(self, image: bytes, max_objects: int = 24):
            m1 = np.zeros((80, 80), dtype=bool)
            m1[20:60, 20:60] = True
            m2 = np.zeros((80, 80), dtype=bool)
            m2[40:70, 40:70] = True  # Overlaps with m1

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

    def dummy_url_builder(data: bytes, mime: str) -> str:
        return "https://test.server/cache/image/overlap"

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

    def dummy_url_builder(data: bytes, mime: str) -> str:
        return "https://test.server/cache/image/logo"

    scene = asyncio.run(
        builder.build_scene(
            image_bytes=image_bytes,
            source_asset_id="asset_logo",
            url_builder=dummy_url_builder,
        )
    )

    assert len(scene.objects) >= 1
    logo_objs = [o for o in scene.objects if o.semanticType == "logo"]
    assert len(logo_objs) >= 1
    assert logo_objs[0].id.startswith("logo_")


def test_fixture_text_region():
    image_bytes = _create_test_image((120, 120), with_text=True)
    builder = SceneBuilderService()

    import asyncio

    def dummy_url_builder(data: bytes, mime: str) -> str:
        return "https://test.server/cache/image/text"

    scene = asyncio.run(
        builder.build_scene(
            image_bytes=image_bytes,
            source_asset_id="asset_text",
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

    def dummy_url_builder(data: bytes, mime: str) -> str:
        return "https://test.server/cache/image/err"

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
        async def estimate(self, image: bytes):
            raise RuntimeError("Depth estimation service offline")

    builder = SceneBuilderService(
        depth_service=DepthService(provider=ErrorDepthProvider())
    )

    import asyncio

    def dummy_url_builder(data: bytes, mime: str) -> str:
        return "https://test.server/cache/image/err"

    image_bytes = _create_test_image((50, 50))
    with pytest.raises(RuntimeError, match="Depth estimation service offline"):
        asyncio.run(
            builder.build_scene(
                image_bytes=image_bytes,
                source_asset_id="asset_err2",
                url_builder=dummy_url_builder,
            )
        )


def test_production_segmentation_provider_fails_closed(monkeypatch):
    monkeypatch.setenv("SEGMENTATION_PROVIDER", "production")
    monkeypatch.delenv("SEGMENTATION_ENDPOINT", raising=False)
    monkeypatch.delenv("SEGMENTATION_API_KEY", raising=False)

    from providers.segmentation_provider import ProductionSegmentationError
    from services.segmentation import SegmentationService

    service = SegmentationService()
    import asyncio

    with pytest.raises(ProductionSegmentationError, match="Production segmentation provider is not configured"):
        asyncio.run(service.segment_objects(_create_test_image()))


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

    def dummy_url_builder(data: bytes, mime: str) -> str:
        return "https://test.server/cache/image/limit"

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
