from __future__ import annotations

import os

from persistence.contracts import ArtifactRepositoryContract, JobRepositoryContract
from persistence.memory_repository import MemoryArtifactRepository, MemoryJobRepository
from persistence.sqlite_repository import SqliteArtifactRepository, SqliteJobRepository


def create_job_repository() -> JobRepositoryContract:
    backend = os.getenv("HOLOFORGE_REPOSITORY_BACKEND", "sqlite").lower()
    if backend == "memory":
        return MemoryJobRepository()
    return SqliteJobRepository()


def create_artifact_repository() -> ArtifactRepositoryContract:
    backend = os.getenv("HOLOFORGE_REPOSITORY_BACKEND", "sqlite").lower()
    if backend == "memory":
        return MemoryArtifactRepository()
    return SqliteArtifactRepository()
