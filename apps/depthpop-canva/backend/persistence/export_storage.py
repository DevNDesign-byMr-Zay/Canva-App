from __future__ import annotations

import hashlib
import shutil
from pathlib import Path


class ExportArtifactStorage:
    def __init__(self, root: str | Path) -> None:
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def safe_path(self, path: str | Path) -> Path:
        resolved = Path(path).resolve()
        try:
            resolved.relative_to(self.root)
        except ValueError as exc:
            raise ValueError("export artifact path is outside DEPTHPOP_ARTIFACT_ROOT") from exc
        return resolved

    def allocate_workspace(self, job_id: str) -> Path:
        if not job_id or any(part in job_id for part in ("/", "\\", "..")):
            raise ValueError("invalid export job id")
        workspace = self.safe_path(self.root / job_id)
        if workspace.exists():
            shutil.rmtree(workspace)
        workspace.mkdir(parents=True, exist_ok=False)
        return workspace

    def cleanup_workspace(self, path: str | Path) -> None:
        resolved = self.safe_path(path)
        workspace = resolved if resolved.is_dir() else resolved.parent
        workspace = self.safe_path(workspace)
        if workspace == self.root:
            raise ValueError("refusing to delete DEPTHPOP_ARTIFACT_ROOT")
        if workspace.exists():
            shutil.rmtree(workspace)

    def sha256_file(self, path: str | Path, *, chunk_size: int = 1024 * 1024) -> str:
        resolved = self.safe_path(path)
        if not resolved.is_file():
            raise FileNotFoundError(resolved)
        digest = hashlib.sha256()
        with resolved.open("rb") as handle:
            while True:
                chunk = handle.read(chunk_size)
                if not chunk:
                    break
                digest.update(chunk)
        return digest.hexdigest()
