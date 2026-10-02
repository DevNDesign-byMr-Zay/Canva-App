from __future__ import annotations

import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

import app as depthpop
from auth import VerifiedCanvaUser, verify_canva_user
from models.object import (
    BBox,
    DepthObject,
    ObjectAssets,
    ObjectDepthStats,
    ObjectTransform,
    Vector3,
)
from models.scene import CameraConfig, DepthScene, ReconstructedPlate, TimelineConfig
from services.persistence import scene_repo


def image_bytes(*, object_color=(255, 0, 0, 255), transparent=False) -> bytes:
    image = Image.new(
        "RGBA",
        (100, 100),
        (0, 0, 0, 0) if transparent else (20, 20, 24, 255),
    )
    if transparent:
        ImageDraw.Draw(image).rectangle((10, 10, 29, 29), fill=object_color)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def make_object(
    object_id: str,
    cutout_url: str,
    *,
    order: int,
    position=(0.2, 0.2, 0.4),
) -> DepthObject:
    return DepthObject(
        id=object_id,
        label=object_id,
        semanticType="prop",
        confidence=0.95,
        bbox=BBox(x=10, y=10, width=20, height=20),
        assets=ObjectAssets(
            cutoutUrl=cutout_url,
            maskUrl=cutout_url,
            thumbnailUrl=cutout_url,
        ),
        depth=ObjectDepthStats(mean=0.6, median=0.6, min=0.5, max=0.7),
        transform=ObjectTransform(
            position=Vector3(x=position[0], y=position[1], z=position[2]),
            rotation=Vector3(x=0, y=0, z=0),
            scale=Vector3(x=1, y=1, z=1),
        ),
        opacity=1,
        feather=0,
        visible=True,
        locked=False,
        order=order,
        animationTracks=[],
    )


@pytest.fixture()
def seeded_client():
    async def fake_user():
        return VerifiedCanvaUser(user_id="user-a", brand_id="brand-a")

    depthpop.app.dependency_overrides[verify_canva_user] = fake_user
    depthpop._image_cache.clear()
    scene_repo._scenes.clear()

    plate_key = depthpop._cache_put(image_bytes(), "image/png")
    red_key = depthpop._cache_put(image_bytes(transparent=True), "image/png")
    blue_key = depthpop._cache_put(
        image_bytes(object_color=(0, 0, 255, 255), transparent=True),
        "image/png",
    )

    plate_url = f"http://testserver/cache/image/{plate_key}"
    red_url = f"http://testserver/cache/image/{red_key}"
    blue_url = f"http://testserver/cache/image/{blue_key}"

    scene = DepthScene(
        schemaVersion=1,
        id="scene-api-test",
        userId="user-a",
        brandId="brand-a",
        sourceAssetId="source-a",
        width=100,
        height=100,
        objects=[
            make_object("red", red_url, order=0),
            make_object("blue", blue_url, order=1, position=(0.8, 0.8, -0.2)),
        ],
        reconstructedPlate=ReconstructedPlate(
            imageUrl=plate_url,
            depthMapUrl=plate_url,
        ),
        camera=CameraConfig(),
        timeline=TimelineConfig(durationMs=1000, fps=30, currentTimeMs=0),
        createdAt="2026-10-01T00:00:00Z",
        updatedAt="2026-10-01T00:00:00Z",
    )

    import asyncio

    asyncio.run(scene_repo.save_scene(scene))

    try:
        yield TestClient(depthpop.app)
    finally:
        depthpop.app.dependency_overrides.clear()
        depthpop._image_cache.clear()
        scene_repo._scenes.clear()


def test_patch_allows_only_editable_fields_and_preserves_partial_transform(
    seeded_client,
):
    response = seeded_client.patch(
        "/api/v1/scenes/scene-api-test",
        json={
            "objects": [
                {
                    "id": "red",
                    "transform": {"position": {"x": 0.75}},
                    "opacity": 0.7,
                }
            ],
            "camera": {"fov": 65},
            "timeline": {"currentTimeMs": 500},
        },
    )
    assert response.status_code == 200
    payload = response.json()
    red = next(item for item in payload["objects"] if item["id"] == "red")

    assert red["transform"]["position"] == {"x": 0.75, "y": 0.2, "z": 0.4}
    assert red["opacity"] == 0.7
    assert payload["camera"]["fov"] == 65
    assert payload["timeline"]["currentTimeMs"] == 500
    assert red["confidence"] == 0.95


def test_patch_rejects_immutable_unknown_and_duplicate_object_ids(seeded_client):
    immutable = seeded_client.patch(
        "/api/v1/scenes/scene-api-test",
        json={"sourceAssetId": "attacker"},
    )
    assert immutable.status_code == 422

    unknown = seeded_client.patch(
        "/api/v1/scenes/scene-api-test",
        json={"objects": [{"id": "missing", "opacity": 0.5}]},
    )
    assert unknown.status_code == 422

    duplicate = seeded_client.patch(
        "/api/v1/scenes/scene-api-test",
        json={
            "objects": [
                {"id": "red", "opacity": 0.8},
                {"id": "red", "opacity": 0.7},
            ]
        },
    )
    assert duplicate.status_code == 422


def test_patch_rejects_invalid_scale_order_and_timeline(seeded_client):
    scale = seeded_client.patch(
        "/api/v1/scenes/scene-api-test",
        json={
            "objects": [
                {"id": "red", "transform": {"scale": {"x": 0}}}
            ]
        },
    )
    assert scale.status_code == 422

    order = seeded_client.patch(
        "/api/v1/scenes/scene-api-test",
        json={"objects": [{"id": "blue", "order": 0}]},
    )
    assert order.status_code == 422

    timeline = seeded_client.patch(
        "/api/v1/scenes/scene-api-test",
        json={"timeline": {"currentTimeMs": 1500}},
    )
    assert timeline.status_code == 422


def test_patch_and_composite_enforce_scene_ownership(seeded_client):
    async def other_user():
        return VerifiedCanvaUser(user_id="user-b", brand_id="brand-b")

    depthpop.app.dependency_overrides[verify_canva_user] = other_user

    assert (
        seeded_client.patch(
            "/api/v1/scenes/scene-api-test",
            json={"camera": {"fov": 60}},
        ).status_code
        == 404
    )
    assert (
        seeded_client.post(
            "/api/v1/scenes/scene-api-test/composite",
        ).status_code
        == 404
    )


def test_composite_route_returns_raw_png_bytes(seeded_client):
    response = seeded_client.post("/api/v1/scenes/scene-api-test/composite")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/png")
    assert response.headers["cache-control"] == "private, no-store"

    with Image.open(io.BytesIO(response.content)) as rendered:
        assert rendered.format == "PNG"
        assert rendered.size == (100, 100)
