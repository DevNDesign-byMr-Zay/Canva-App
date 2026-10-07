from __future__ import annotations

import time
from pathlib import Path

from models import ExportArtifact, ExportJob
from persistence.sqlite_repository import SqliteArtifactRepository, SqliteJobRepository
from repositories import OwnedKey


def job_for(job_id: str, export_id: str, status: str = "queued") -> ExportJob:
    return ExportJob(
        id=job_id,
        exportId=export_id,
        userId="u-100",
        brandId="b-200",
        status=status,
        stage=status,
        percent=10,
        message="processing",
        createdAt="2026-10-01T00:00:00Z",
        updatedAt="2026-10-01T00:00:00Z",
    )


def test_sqlite_repository_persistence_and_recovery(tmp_path):
    db_path = tmp_path / "test.sqlite3"
    job_repo = SqliteJobRepository(db_path=db_path)

    j1 = job_for("job-1", "exp-1", status="rendering")
    job_repo.put(j1)

    # Reopen database to test persistence
    job_repo2 = SqliteJobRepository(db_path=db_path)
    fetched = job_repo2.get(OwnedKey("u-100", "b-200", "job-1"))
    assert fetched is not None
    assert fetched.status == "rendering"

    # Recover stale jobs
    recovered_count = job_repo2.recover_stale_jobs()
    assert recovered_count == 1

    recovered_job = job_repo2.get(OwnedKey("u-100", "b-200", "job-1"))
    assert recovered_job is not None
    assert recovered_job.status == "error"
    assert "Server restarted" in recovered_job.error


def test_sqlite_ownership_isolation(tmp_path):
    db_path = tmp_path / "test.sqlite3"
    job_repo = SqliteJobRepository(db_path=db_path)

    j1 = job_for("job-1", "exp-1")
    job_repo.put(j1)

    # Wrong user or brand should return None
    assert job_repo.get(OwnedKey("u-WRONG", "b-200", "job-1")) is None
    assert job_repo.get(OwnedKey("u-100", "b-WRONG", "job-1")) is None
    assert job_repo.find_by_export(user_id="u-WRONG", brand_id="b-200", export_id="exp-1") is None
