from __future__ import annotations

import os
import shutil
import tempfile
import threading
import time
from dataclasses import dataclass
from pathlib import Path

from models import ExportArtifact, ExportJob

JOB_TTL_SECONDS = max(60, int(os.getenv("HOLOFORGE_JOB_TTL_SECONDS", "3600")))
ARTIFACT_TTL_SECONDS = max(60, int(os.getenv("HOLOFORGE_ARTIFACT_TTL_SECONDS", "86400")))
MAX_JOBS = max(8, int(os.getenv("HOLOFORGE_MAX_JOBS", "256")))
MAX_ARTIFACTS = max(4, int(os.getenv("HOLOFORGE_MAX_ARTIFACTS", "128")))
ARTIFACT_ROOT = Path(
    os.getenv(
        "HOLOFORGE_ARTIFACT_ROOT",
        str(Path(tempfile.gettempdir()) / "holoforge-artifacts"),
    )
).resolve()


@dataclass(frozen=True)
class OwnedKey:
    user_id: str
    brand_id: str
    resource_id: str


class JobRepository:
    def __init__(self) -> None:
        self._values: dict[str, tuple[float, ExportJob]] = {}
        self._lock = threading.RLock()

    def _cleanup(self) -> None:
        now = time.time()
        expired = [
            key for key, (created, _) in self._values.items()
            if now - created > JOB_TTL_SECONDS
        ]
        for key in expired:
            self._values.pop(key, None)
        if len(self._values) > MAX_JOBS:
            ordered = sorted(self._values.items(), key=lambda item: item[1][0])
            for key, _ in ordered[: len(self._values) - MAX_JOBS]:
                self._values.pop(key, None)

    def put(self, job: ExportJob) -> None:
        with self._lock:
            self._cleanup()
            self._values[job.id] = (time.time(), job)

    def get(self, key: OwnedKey) -> ExportJob | None:
        with self._lock:
            self._cleanup()
            found = self._values.get(key.resource_id)
            if not found:
                return None
            job = found[1]
            if job.userId != key.user_id or job.brandId != key.brand_id:
                return None
            return job


class ArtifactRepository:
    def __init__(self) -> None:
        ARTIFACT_ROOT.mkdir(parents=True, exist_ok=True)
        self._values: dict[str, tuple[float, ExportArtifact]] = {}
        self._lock = threading.RLock()

    def _cleanup(self) -> None:
        now = time.time()
        expired = [
            key for key, (created, _) in self._values.items()
            if now - created > ARTIFACT_TTL_SECONDS
        ]
        for key in expired:
            record = self._values.pop(key, None)
            if record:
                Path(record[1].path).unlink(missing_ok=True)
        if len(self._values) > MAX_ARTIFACTS:
            ordered = sorted(self._values.items(), key=lambda item: item[1][0])
            for key, (_, artifact) in ordered[: len(self._values) - MAX_ARTIFACTS]:
                self._values.pop(key, None)
                Path(artifact.path).unlink(missing_ok=True)

    def allocate_dir(self, export_id: str) -> Path:
        root = ARTIFACT_ROOT / export_id
        if root.exists():
            shutil.rmtree(root)
        root.mkdir(parents=True, exist_ok=False)
        return root

    def put(self, artifact: ExportArtifact) -> None:
        with self._lock:
            self._cleanup()
            self._values[artifact.id] = (time.time(), artifact)

    def get(self, key: OwnedKey) -> ExportArtifact | None:
        with self._lock:
            self._cleanup()
            found = self._values.get(key.resource_id)
            if not found:
                return None
            artifact = found[1]
            if artifact.userId != key.user_id or artifact.brandId != key.brand_id:
                return None
            if not Path(artifact.path).is_file():
                self._values.pop(key.resource_id, None)
                return None
            return artifact
