from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from models.export import DepthExportArtifact, DepthExportJob
from persistence.export_repository import (
    MemoryExportRepository,
    SQLiteExportRepository,
)
from persistence.export_storage import ExportArtifactStorage


def _now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _job(job_id: str, status: str = "queued") -> DepthExportJob:
    now = _now()
    stage = "queued" if status == "queued" else "loading_scene"
    return DepthExportJob(
        jobId=job_id,
        userId="user-a",
        brandId="brand-a",
        sceneId="scene-a",
        format="scene-json",
        status=status,
        stage=stage,
        progress=0.0,
        artifactId=None,
        error=None,
        cancelRequested=False,
        createdAt=now,
        updatedAt=now,
    )


def _artifact(storage: ExportArtifactStorage, artifact_id: str) -> DepthExportArtifact:
    workspace = storage.allocate_workspace(artifact_id)
    path = workspace / "scene.depthscene.json"
    path.write_text("{}", encoding="utf-8")
    now = datetime.now(timezone.utc)
    return DepthExportArtifact(
        artifactId=artifact_id,
        userId="user-a",
        brandId="brand-a",
        sceneId="scene-a",
        format="scene-json",
        path=str(path),
        mimeType="application/json",
        size=path.stat().st_size,
        sha256=storage.sha256_file(path),
        createdAt=now.isoformat().replace("+00:00", "Z"),
        expiresAt=(now + timedelta(hours=1)).isoformat().replace("+00:00", "Z"),
    )


def test_export_storage_refuses_paths_outside_root(tmp_path: Path):
    storage = ExportArtifactStorage(tmp_path / "artifacts")
    outside = tmp_path / "outside.bin"
    outside.write_bytes(b"x")
    with pytest.raises(ValueError):
        storage.safe_path(outside)
    with pytest.raises(ValueError):
        storage.cleanup_workspace(outside)


def test_memory_export_repository_enforces_owner_and_artifact_lookup(tmp_path: Path):
    storage = ExportArtifactStorage(tmp_path / "artifacts")
    repo = MemoryExportRepository(storage)
    job = _job("job-memory")
    repo.save_job(job)
    assert repo.get_job("job-memory", user_id="user-a", brand_id="brand-a") is not None
    assert repo.get_job("job-memory", user_id="user-b", brand_id="brand-a") is None

    artifact = _artifact(storage, "artifact-memory")
    repo.save_artifact(artifact)
    assert (
        repo.get_artifact(
            "artifact-memory",
            user_id="user-a",
            brand_id="brand-a",
        )
        is not None
    )
    assert (
        repo.get_artifact(
            "artifact-memory",
            user_id="user-a",
            brand_id="brand-b",
        )
        is None
    )


def test_sqlite_export_repository_recovers_incomplete_jobs_after_restart(
    tmp_path: Path,
):
    storage = ExportArtifactStorage(tmp_path / "artifacts")
    database = tmp_path / "depthpop.sqlite3"
    first = SQLiteExportRepository(
        database,
        storage,
        recover_incomplete=False,
    )
    first.save_job(_job("job-stale", status="processing"))

    reopened = SQLiteExportRepository(
        database,
        storage,
        recover_incomplete=True,
    )
    recovered = reopened.get_job(
        "job-stale",
        user_id="user-a",
        brand_id="brand-a",
    )
    assert recovered is not None
    assert recovered.status == "failed"
    assert recovered.stage == "failed"
    assert "restarted" in (recovered.error or "").lower()


def test_sqlite_export_artifact_survives_repository_reopen(tmp_path: Path):
    storage = ExportArtifactStorage(tmp_path / "artifacts")
    database = tmp_path / "depthpop.sqlite3"
    first = SQLiteExportRepository(database, storage)
    artifact = _artifact(storage, "artifact-sqlite")
    first.save_artifact(artifact)

    reopened = SQLiteExportRepository(database, storage)
    restored = reopened.get_artifact(
        artifact.artifactId,
        user_id="user-a",
        brand_id="brand-a",
    )
    assert restored is not None
    assert Path(restored.path).is_file()
    assert restored.sha256 == artifact.sha256
