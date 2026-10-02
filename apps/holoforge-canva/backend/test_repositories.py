from __future__ import annotations

import hashlib
import time
from pathlib import Path

import repositories
from export_service import sha256_file
from models import ExportArtifact, ExportJob
from repositories import ArtifactRepository, JobRepository, OwnedKey


def job_for(job_id: str, export_id: str) -> ExportJob:
    return ExportJob(
        id=job_id,
        exportId=export_id,
        userId="user-1",
        brandId="brand-1",
        status="queued",
        stage="queued",
        percent=0,
        message="queued",
        createdAt="2026-10-01T00:00:00+00:00",
        updatedAt="2026-10-01T00:00:00+00:00",
    )


def artifact_for(path: Path, export_id: str = "hfexp_test") -> ExportArtifact:
    return ExportArtifact(
        id=export_id,
        userId="user-1",
        brandId="brand-1",
        format="png-still",
        profile="still-image",
        fileName=path.name,
        mimeType="image/png",
        path=str(path),
        sizeBytes=path.stat().st_size,
        createdAt="2026-10-01T00:00:00+00:00",
        expiresAt="2026-10-02T00:00:00+00:00",
    )


def test_expired_artifact_removes_entire_render_workspace(tmp_path, monkeypatch):
    monkeypatch.setattr(repositories, "ARTIFACT_ROOT", tmp_path)
    monkeypatch.setattr(repositories, "ARTIFACT_TTL_SECONDS", 1)

    repo = ArtifactRepository()
    export_dir = repo.allocate_dir("hfexp_test")
    artifact_path = export_dir / "scene.png"
    artifact_path.write_bytes(b"png")
    frames = export_dir / "frames"
    frames.mkdir()
    (frames / "frame_0001.png").write_bytes(b"frame")
    (export_dir / "job.json").write_text("{}", encoding="utf-8")

    artifact = artifact_for(artifact_path)
    repo.put(artifact)
    repo._values[artifact.id] = (time.time() - 5, artifact)

    found = repo.get(
        OwnedKey(
            user_id=artifact.userId,
            brand_id=artifact.brandId,
            resource_id=artifact.id,
        )
    )

    assert found is None
    assert not export_dir.exists()


def test_missing_artifact_file_cleans_leftover_workspace(tmp_path, monkeypatch):
    monkeypatch.setattr(repositories, "ARTIFACT_ROOT", tmp_path)

    repo = ArtifactRepository()
    export_dir = repo.allocate_dir("hfexp_missing")
    artifact_path = export_dir / "scene.png"
    artifact_path.write_bytes(b"png")
    artifact = artifact_for(artifact_path, export_id="hfexp_missing")
    repo.put(artifact)

    artifact_path.unlink()
    (export_dir / "result.json").write_text("{}", encoding="utf-8")

    found = repo.get(
        OwnedKey(
            user_id=artifact.userId,
            brand_id=artifact.brandId,
            resource_id=artifact.id,
        )
    )

    assert found is None
    assert not export_dir.exists()


def test_cleanup_never_removes_paths_outside_artifact_root(tmp_path, monkeypatch):
    artifact_root = tmp_path / "root"
    external_dir = tmp_path / "external"
    external_dir.mkdir()
    external_file = external_dir / "outside.png"
    external_file.write_bytes(b"keep")

    monkeypatch.setattr(repositories, "ARTIFACT_ROOT", artifact_root)
    monkeypatch.setattr(repositories, "ARTIFACT_TTL_SECONDS", 1)

    repo = ArtifactRepository()
    artifact = artifact_for(external_file, export_id="hfexp_external")
    repo._values[artifact.id] = (time.time() - 5, artifact)

    found = repo.get(
        OwnedKey(
            user_id=artifact.userId,
            brand_id=artifact.brandId,
            resource_id=artifact.id,
        )
    )

    assert found is None
    assert external_file.is_file()



def test_sha256_file_matches_standard_digest(tmp_path):
    payload = (b"HoloForge-render-artifact-" * 100_000) + b"tail"
    path = tmp_path / "artifact.bin"
    path.write_bytes(payload)

    assert sha256_file(path, chunk_size=4096) == hashlib.sha256(payload).hexdigest()



def test_job_repository_cap_is_enforced_during_put(monkeypatch):
    monkeypatch.setattr(repositories, "MAX_JOBS", 2)
    repo = JobRepository()

    repo.put(job_for("job-1", "exp-1"))
    time.sleep(0.002)
    repo.put(job_for("job-2", "exp-2"))
    time.sleep(0.002)
    repo.put(job_for("job-3", "exp-3"))

    assert len(repo._values) == 2
    assert "job-1" not in repo._values
    assert {"job-2", "job-3"} == set(repo._values)


def test_artifact_repository_cap_evicts_oldest_workspace_on_put(
    tmp_path,
    monkeypatch,
):
    monkeypatch.setattr(repositories, "ARTIFACT_ROOT", tmp_path)
    monkeypatch.setattr(repositories, "MAX_ARTIFACTS", 2)
    repo = ArtifactRepository()

    workspaces = []
    for index in range(1, 4):
        export_id = f"hfexp-{index}"
        export_dir = repo.allocate_dir(export_id)
        path = export_dir / "scene.png"
        path.write_bytes(f"png-{index}".encode())
        repo.put(artifact_for(path, export_id=export_id))
        workspaces.append(export_dir)
        time.sleep(0.002)

    assert len(repo._values) == 2
    assert "hfexp-1" not in repo._values
    assert not workspaces[0].exists()
    assert workspaces[1].exists()
    assert workspaces[2].exists()
