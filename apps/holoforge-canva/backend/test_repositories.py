from __future__ import annotations

import time
from pathlib import Path

import repositories
from models import ExportArtifact
from repositories import ArtifactRepository, OwnedKey


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
