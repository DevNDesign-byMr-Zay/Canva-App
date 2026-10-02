from __future__ import annotations

from fastapi.testclient import TestClient
import pytest

import app as depthpop
from auth import VerifiedCanvaUser, verify_canva_user
from services.persistence import scene_asset_repo


@pytest.fixture()
def asset_client():
    async def user_a():
        return VerifiedCanvaUser(user_id="user-a", brand_id="brand-a")

    depthpop.app.dependency_overrides[verify_canva_user] = user_a
    scene_asset_repo._assets.clear()
    try:
        yield TestClient(depthpop.app)
    finally:
        depthpop.app.dependency_overrides.clear()
        scene_asset_repo._assets.clear()


def test_scene_asset_route_is_private_and_owner_scoped(asset_client):
    asset = scene_asset_repo.save_asset_sync(
        scene_id="scene-a",
        user_id="user-a",
        brand_id="brand-a",
        data=b"png-test",
        mime_type="image/png",
    )

    response = asset_client.get(f"/api/v1/assets/{asset.asset_id}")
    assert response.status_code == 200
    assert response.content == b"png-test"
    assert response.headers["cache-control"] == "private, no-store"
    assert response.headers["etag"] == f'"{asset.sha256}"'

    async def wrong_user():
        return VerifiedCanvaUser(user_id="user-b", brand_id="brand-a")

    depthpop.app.dependency_overrides[verify_canva_user] = wrong_user
    denied = asset_client.get(f"/api/v1/assets/{asset.asset_id}")
    assert denied.status_code == 404


def test_same_content_assets_remain_distinct_across_owners(asset_client):
    first = scene_asset_repo.save_asset_sync(
        scene_id="scene-a",
        user_id="user-a",
        brand_id="brand-a",
        data=b"same",
        mime_type="image/png",
    )
    second = scene_asset_repo.save_asset_sync(
        scene_id="scene-b",
        user_id="user-b",
        brand_id="brand-b",
        data=b"same",
        mime_type="image/png",
    )

    assert first.asset_id != second.asset_id
    assert first.sha256 == second.sha256
