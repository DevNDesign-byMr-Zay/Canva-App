from __future__ import annotations

import asyncio
import time as real_time

from models.scene import DepthScene
from services import persistence
from services.persistence import (
    BoundedJobRepository,
    BoundedSceneAssetRepository,
    BoundedSceneRepository,
)


def scene(scene_id: str, user_id="user-a", brand_id="brand-a") -> DepthScene:
    return DepthScene(
        schemaVersion=1,
        id=scene_id,
        userId=user_id,
        brandId=brand_id,
        sourceAssetId="asset-source",
        width=10,
        height=10,
        objects=[],
        reconstructedPlate={
            "imageUrl": "https://api.test/api/v1/assets/plate",
            "depthMapUrl": "https://api.test/api/v1/assets/depth",
        },
        createdAt="2026-10-01T00:00:00Z",
        updatedAt="2026-10-01T00:00:00Z",
    )


def test_identical_bytes_never_share_owned_resource_id():
    repo = BoundedSceneAssetRepository(max_assets=10, ttl_seconds=60)

    first = repo.save_asset_sync(
        scene_id="scene-a",
        user_id="user-a",
        brand_id="brand-a",
        data=b"same-content",
        mime_type="image/png",
    )
    second = repo.save_asset_sync(
        scene_id="scene-b",
        user_id="user-b",
        brand_id="brand-b",
        data=b"same-content",
        mime_type="image/png",
    )

    assert first.asset_id != second.asset_id
    assert first.sha256 == second.sha256


def test_scene_asset_access_requires_exact_user_and_brand():
    repo = BoundedSceneAssetRepository(max_assets=10, ttl_seconds=60)
    asset = repo.save_asset_sync(
        scene_id="scene-a",
        user_id="user-a",
        brand_id="brand-a",
        data=b"image",
        mime_type="image/png",
    )

    assert (
        asyncio.run(
            repo.get_asset(
                asset.asset_id,
                user_id="user-a",
                brand_id="brand-a",
            )
        )
        is not None
    )
    assert (
        asyncio.run(
            repo.get_asset(
                asset.asset_id,
                user_id="user-b",
                brand_id="brand-a",
            )
        )
        is None
    )
    assert (
        asyncio.run(
            repo.get_asset(
                asset.asset_id,
                user_id="user-a",
                brand_id="brand-b",
            )
        )
        is None
    )


def test_asset_capacity_is_enforced_immediately():
    repo = BoundedSceneAssetRepository(max_assets=2, ttl_seconds=60)
    for index in range(3):
        repo.save_asset_sync(
            scene_id=f"scene-{index}",
            user_id="user",
            brand_id="brand",
            data=f"asset-{index}".encode(),
            mime_type="image/png",
        )
        real_time.sleep(0.002)

    assert len(repo._assets) == 2


def test_scene_eviction_removes_associated_assets():
    assets = BoundedSceneAssetRepository(max_assets=20, ttl_seconds=60)
    scenes = BoundedSceneRepository(
        max_scenes=1,
        ttl_seconds=60,
        asset_repo=assets,
    )

    first_asset = assets.save_asset_sync(
        scene_id="scene-1",
        user_id="user-a",
        brand_id="brand-a",
        data=b"first",
        mime_type="image/png",
    )
    asyncio.run(scenes.save_scene(scene("scene-1")))
    real_time.sleep(0.002)

    assets.save_asset_sync(
        scene_id="scene-2",
        user_id="user-a",
        brand_id="brand-a",
        data=b"second",
        mime_type="image/png",
    )
    asyncio.run(scenes.save_scene(scene("scene-2")))

    assert "scene-1" not in scenes._scenes
    assert first_asset.asset_id not in assets._assets


def test_scene_expiry_removes_associated_assets(monkeypatch):
    clock = [1000.0]
    monkeypatch.setattr(persistence.time, "time", lambda: clock[0])

    assets = BoundedSceneAssetRepository(max_assets=20, ttl_seconds=5)
    scenes = BoundedSceneRepository(
        max_scenes=5,
        ttl_seconds=5,
        asset_repo=assets,
    )
    asset = assets.save_asset_sync(
        scene_id="scene-expire",
        user_id="user-a",
        brand_id="brand-a",
        data=b"expired",
        mime_type="image/png",
    )
    asyncio.run(scenes.save_scene(scene("scene-expire")))

    clock[0] = 1006.0
    assert asyncio.run(scenes.get_scene("scene-expire")) is None
    assert asset.asset_id not in assets._assets


def test_job_capacity_is_enforced_immediately():
    repo = BoundedJobRepository(max_jobs=2, ttl_seconds=60)
    for index in range(3):
        asyncio.run(
            repo.update_job_stage(
                f"job-{index}",
                stage="queued",
                status="queued",
                user_id="user-a",
                brand_id="brand-a",
            )
        )
        real_time.sleep(0.002)

    assert len(repo._jobs) == 2
