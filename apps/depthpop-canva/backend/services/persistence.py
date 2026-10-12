from __future__ import annotations

import os
import time
from pathlib import Path

from persistence.asset_store import DiskSceneAssetRepository
from persistence.contracts import JobRepository, SceneRepository, StoredSceneAsset
from persistence.memory_repository import (
    MemoryJobRepository,
    MemorySceneAssetRepository,
    MemorySceneRepository,
)
from persistence.sqlite_repository import SQLiteJobRepository, SQLiteSceneRepository

JOB_TTL_SECONDS = int(os.getenv("DEPTHPOP_JOB_TTL_SECONDS", "3600"))
SCENE_TTL_SECONDS = int(os.getenv("DEPTHPOP_SCENE_TTL_SECONDS", "3600"))
ASSET_TTL_SECONDS = max(
    SCENE_TTL_SECONDS,
    int(os.getenv("DEPTHPOP_SCENE_ASSET_TTL_SECONDS", str(SCENE_TTL_SECONDS))),
)
MAX_JOBS = int(os.getenv("DEPTHPOP_MAX_JOBS", "100"))
MAX_SCENES = int(os.getenv("DEPTHPOP_MAX_SCENES", "50"))
MAX_SCENE_ASSETS = int(os.getenv("DEPTHPOP_MAX_SCENE_ASSETS", "500"))

REPOSITORY_BACKEND = os.getenv("DEPTHPOP_REPOSITORY_BACKEND", "memory").strip().lower()
DATABASE_PATH = Path(
    os.getenv("DEPTHPOP_DATABASE_PATH", "/data/depthpop/depthpop.sqlite3")
)
ASSET_ROOT = Path(os.getenv("DEPTHPOP_ASSET_ROOT", "/data/depthpop/assets"))


if REPOSITORY_BACKEND == "sqlite":
    scene_asset_repo = DiskSceneAssetRepository(
        DATABASE_PATH,
        ASSET_ROOT,
        max_assets=MAX_SCENE_ASSETS,
        ttl_seconds=ASSET_TTL_SECONDS,
    )
    scene_repo = SQLiteSceneRepository(
        DATABASE_PATH,
        max_scenes=MAX_SCENES,
        ttl_seconds=SCENE_TTL_SECONDS,
        asset_store=scene_asset_repo,
    )
    job_repo = SQLiteJobRepository(
        DATABASE_PATH,
        max_jobs=MAX_JOBS,
        ttl_seconds=JOB_TTL_SECONDS,
        recover_incomplete=True,
    )
elif REPOSITORY_BACKEND == "memory":
    scene_asset_repo = MemorySceneAssetRepository(
        max_assets=MAX_SCENE_ASSETS,
        ttl_seconds=ASSET_TTL_SECONDS,
    )
    scene_repo = MemorySceneRepository(
        max_scenes=MAX_SCENES,
        ttl_seconds=SCENE_TTL_SECONDS,
        asset_store=scene_asset_repo,
    )
    job_repo = MemoryJobRepository(
        max_jobs=MAX_JOBS,
        ttl_seconds=JOB_TTL_SECONDS,
    )
else:
    raise RuntimeError(
        "DEPTHPOP_REPOSITORY_BACKEND must be either 'memory' or 'sqlite'"
    )


# Compatibility aliases retained for existing tests and downstream imports.
BoundedSceneAssetRepository = MemorySceneAssetRepository
BoundedSceneRepository = MemorySceneRepository
BoundedJobRepository = MemoryJobRepository

__all__ = [
    "ASSET_ROOT",
    "ASSET_TTL_SECONDS",
    "BoundedJobRepository",
    "BoundedSceneAssetRepository",
    "BoundedSceneRepository",
    "DATABASE_PATH",
    "JOB_TTL_SECONDS",
    "JobRepository",
    "MAX_JOBS",
    "MAX_SCENE_ASSETS",
    "MAX_SCENES",
    "REPOSITORY_BACKEND",
    "SCENE_TTL_SECONDS",
    "SceneRepository",
    "StoredSceneAsset",
    "job_repo",
    "scene_asset_repo",
    "scene_repo",
]
