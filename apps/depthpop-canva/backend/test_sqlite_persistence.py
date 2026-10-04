from __future__ import annotations

import asyncio
from pathlib import Path

from models.job import DepthJob
from models.scene import DepthScene
from persistence.sqlite_repository import SQLiteJobRepository, SQLiteSceneRepository


def _scene(scene_id: str = "scene_persist") -> DepthScene:
    return DepthScene.model_validate(
        {
            "schemaVersion": 1,
            "id": scene_id,
            "userId": "user-a",
            "brandId": "brand-a",
            "sourceAssetId": "asset-source",
            "width": 800,
            "height": 600,
            "settings": {
                "depthStrength": 0.32,
                "depthBlur": 35,
                "depthFidelity": 0.95,
                "renderQuality": "cinematic",
                "numInferenceSteps": 34,
            },
            "objects": [],
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
            "createdAt": "2026-10-04T00:00:00Z",
            "updatedAt": "2026-10-04T00:00:00Z",
        }
    )


def _job(job_id: str = "job_persist", *, status: str = "complete") -> DepthJob:
    stage = "complete" if status == "complete" else "building_scene"
    return DepthJob(
        jobId=job_id,
        userId="user-a",
        brandId="brand-a",
        status=status,
        stage=stage,
        progress=1.0 if status == "complete" else 0.6,
        sceneId="scene_persist" if status == "complete" else None,
        error=None,
        createdAt="2026-10-04T00:00:00Z",
        updatedAt="2026-10-04T00:00:00Z",
    )


def test_scene_survives_sqlite_repository_reopen(tmp_path: Path):
    db = tmp_path / "depthpop.sqlite3"

    first = SQLiteSceneRepository(db, ttl_seconds=3600)
    asyncio.run(first.save_scene(_scene()))

    reopened = SQLiteSceneRepository(db, ttl_seconds=3600)
    restored = asyncio.run(reopened.get_scene("scene_persist"))

    assert restored is not None
    assert restored.id == "scene_persist"
    assert restored.timeline.currentTimeMs == 500
    assert restored.settings.renderQuality == "cinematic"


def test_scene_lookup_is_owner_scoped(tmp_path: Path):
    db = tmp_path / "depthpop.sqlite3"
    repo = SQLiteSceneRepository(db, ttl_seconds=3600)
    asyncio.run(repo.save_scene(_scene()))

    assert asyncio.run(
        repo.get_scene("scene_persist", user_id="user-a", brand_id="brand-a")
    ) is not None
    assert asyncio.run(
        repo.get_scene("scene_persist", user_id="other-user", brand_id="brand-a")
    ) is None
    assert asyncio.run(
        repo.get_scene("scene_persist", user_id="user-a", brand_id="other-brand")
    ) is None


def test_completed_job_survives_sqlite_repository_reopen(tmp_path: Path):
    db = tmp_path / "depthpop.sqlite3"

    first = SQLiteJobRepository(db, ttl_seconds=3600)
    asyncio.run(first.save_job(_job()))

    reopened = SQLiteJobRepository(db, ttl_seconds=3600)
    restored = asyncio.run(
        reopened.get_job("job_persist", user_id="user-a", brand_id="brand-a")
    )

    assert restored is not None
    assert restored.status == "complete"
    assert restored.sceneId == "scene_persist"


def test_restart_recovers_stale_processing_job_truthfully(tmp_path: Path):
    db = tmp_path / "depthpop.sqlite3"

    first = SQLiteJobRepository(db, ttl_seconds=3600)
    asyncio.run(first.save_job(_job("job_stale", status="processing")))

    reopened = SQLiteJobRepository(db, ttl_seconds=3600, recover_incomplete=True)
    restored = asyncio.run(
        reopened.get_job("job_stale", user_id="user-a", brand_id="brand-a")
    )

    assert restored is not None
    assert restored.status == "error"
    assert restored.stage == "error"
    assert restored.progress == 1.0
    assert restored.error == "DepthPop service restarted before this job completed."


def test_sqlite_scene_ttl_cleanup_removes_expired_metadata(tmp_path: Path, monkeypatch):
    db = tmp_path / "depthpop.sqlite3"
    clock = {"now": 100.0}
    monkeypatch.setattr("persistence.sqlite_repository.time.time", lambda: clock["now"])

    repo = SQLiteSceneRepository(db, ttl_seconds=5)
    asyncio.run(repo.save_scene(_scene("scene_expired")))

    clock["now"] = 106.0
    assert asyncio.run(repo.get_scene("scene_expired")) is None


def test_sqlite_job_ttl_cleanup_removes_expired_metadata(tmp_path: Path, monkeypatch):
    db = tmp_path / "depthpop.sqlite3"
    clock = {"now": 200.0}
    monkeypatch.setattr("persistence.sqlite_repository.time.time", lambda: clock["now"])

    repo = SQLiteJobRepository(db, ttl_seconds=5)
    asyncio.run(repo.save_job(_job("job_expired")))

    clock["now"] = 206.0
    assert asyncio.run(repo.get_job("job_expired")) is None
