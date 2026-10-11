from __future__ import annotations

import asyncio
from pathlib import Path

import pytest

from persistence.asset_store import DiskSceneAssetRepository


def test_disk_asset_survives_reopen_and_enforces_owner(tmp_path: Path):
    db = tmp_path / "depthpop.sqlite3"
    root = tmp_path / "assets"

    first = DiskSceneAssetRepository(db, root, ttl_seconds=3600)
    stored = first.save_asset_sync(
        scene_id="scene-1",
        user_id="user-a",
        brand_id="brand-a",
        data=b"depthpop-owned-bytes",
        mime_type="image/png",
    )

    reopened = DiskSceneAssetRepository(db, root, ttl_seconds=3600)
    restored = asyncio.run(
        reopened.get_asset(
            stored.asset_id,
            user_id="user-a",
            brand_id="brand-a",
        )
    )

    assert restored is not None
    assert restored.data == b"depthpop-owned-bytes"
    assert restored.sha256 == stored.sha256
    assert asyncio.run(
        reopened.get_asset(stored.asset_id, user_id="user-b", brand_id="brand-a")
    ) is None


def test_scene_asset_cleanup_deletes_only_owned_scene_files(tmp_path: Path):
    db = tmp_path / "depthpop.sqlite3"
    root = tmp_path / "assets"
    repo = DiskSceneAssetRepository(db, root, ttl_seconds=3600)

    first = repo.save_asset_sync(
        scene_id="scene-delete",
        user_id="user-a",
        brand_id="brand-a",
        data=b"first",
        mime_type="image/png",
    )
    second = repo.save_asset_sync(
        scene_id="scene-keep",
        user_id="user-a",
        brand_id="brand-a",
        data=b"second",
        mime_type="image/png",
    )

    first_path = repo.path_for_asset(first.asset_id)
    second_path = repo.path_for_asset(second.asset_id)
    assert first_path.is_file()
    assert second_path.is_file()

    repo.cleanup_scene_assets_sync("scene-delete")

    assert not first_path.exists()
    assert second_path.exists()


def test_asset_ttl_cleanup_removes_metadata_and_file(tmp_path: Path, monkeypatch):
    db = tmp_path / "depthpop.sqlite3"
    root = tmp_path / "assets"
    clock = {"now": 300.0}
    monkeypatch.setattr("persistence.asset_store.time.time", lambda: clock["now"])

    repo = DiskSceneAssetRepository(db, root, ttl_seconds=5)
    stored = repo.save_asset_sync(
        scene_id="scene-expired",
        user_id="user-a",
        brand_id="brand-a",
        data=b"expired",
        mime_type="image/png",
    )
    path = repo.path_for_asset(stored.asset_id)
    assert path.exists()

    clock["now"] = 306.0
    assert asyncio.run(
        repo.get_asset(stored.asset_id, user_id="user-a", brand_id="brand-a")
    ) is None
    assert not path.exists()


def test_cleanup_refuses_path_outside_asset_root(tmp_path: Path):
    db = tmp_path / "depthpop.sqlite3"
    root = tmp_path / "assets"
    outside = tmp_path / "do-not-delete.txt"
    outside.write_text("keep me", encoding="utf-8")

    repo = DiskSceneAssetRepository(db, root, ttl_seconds=3600)
    with pytest.raises(ValueError, match="outside DEPTHPOP_ASSET_ROOT"):
        repo.delete_owned_path(outside)

    assert outside.read_text(encoding="utf-8") == "keep me"


def test_cleanup_refuses_symlink_escape(tmp_path: Path):
    db = tmp_path / "depthpop.sqlite3"
    root = tmp_path / "assets"
    outside = tmp_path / "outside"
    outside.mkdir()
    victim = outside / "victim.txt"
    victim.write_text("keep me", encoding="utf-8")

    root.mkdir()
    link = root / "link-out"
    try:
        link.symlink_to(outside, target_is_directory=True)
    except (OSError, NotImplementedError):
        pytest.skip("symlink creation is unavailable on this runner")

    repo = DiskSceneAssetRepository(db, root, ttl_seconds=3600)
    with pytest.raises(ValueError, match="outside DEPTHPOP_ASSET_ROOT"):
        repo.delete_owned_path(link / "victim.txt")

    assert victim.exists()
