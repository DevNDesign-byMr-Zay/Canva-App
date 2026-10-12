from __future__ import annotations

import os
import tempfile
from pathlib import Path

from persistence.export_repository import (
    MemoryExportRepository,
    SQLiteExportRepository,
)
from persistence.export_storage import ExportArtifactStorage
from services.persistence import DATABASE_PATH, REPOSITORY_BACKEND

EXPORT_JOB_TTL_SECONDS = int(os.getenv("DEPTHPOP_EXPORT_JOB_TTL_SECONDS", "3600"))
EXPORT_ARTIFACT_TTL_SECONDS = int(
    os.getenv("DEPTHPOP_EXPORT_ARTIFACT_TTL_SECONDS", "86400")
)
MAX_EXPORT_JOBS = int(os.getenv("DEPTHPOP_MAX_EXPORT_JOBS", "128"))
MAX_EXPORT_ARTIFACTS = int(os.getenv("DEPTHPOP_MAX_EXPORT_ARTIFACTS", "64"))

_default_root = Path(tempfile.gettempdir()) / "depthpop-artifacts"
ARTIFACT_ROOT = Path(
    os.getenv("DEPTHPOP_ARTIFACT_ROOT", str(_default_root))
)

export_storage = ExportArtifactStorage(ARTIFACT_ROOT)

if REPOSITORY_BACKEND == "sqlite":
    export_repo = SQLiteExportRepository(
        DATABASE_PATH,
        export_storage,
        max_jobs=MAX_EXPORT_JOBS,
        max_artifacts=MAX_EXPORT_ARTIFACTS,
        job_ttl_seconds=EXPORT_JOB_TTL_SECONDS,
        recover_incomplete=True,
    )
else:
    export_repo = MemoryExportRepository(
        export_storage,
        max_jobs=MAX_EXPORT_JOBS,
        max_artifacts=MAX_EXPORT_ARTIFACTS,
        job_ttl_seconds=EXPORT_JOB_TTL_SECONDS,
    )

__all__ = [
    "ARTIFACT_ROOT",
    "EXPORT_ARTIFACT_TTL_SECONDS",
    "EXPORT_JOB_TTL_SECONDS",
    "MAX_EXPORT_ARTIFACTS",
    "MAX_EXPORT_JOBS",
    "export_repo",
    "export_storage",
]
