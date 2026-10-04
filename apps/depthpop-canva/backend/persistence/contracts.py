from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from models.job import DepthJob, JobStage, JobStatus
from models.scene import DepthScene


@dataclass(frozen=True)
class StoredSceneAsset:
    asset_id: str
    scene_id: str
    user_id: str
    brand_id: str
    data: bytes
    mime_type: str
    size: int
    created_at: float
    sha256: str


class SceneRepository(Protocol):
    async def save_scene(self, scene: DepthScene) -> None: ...

    async def get_scene(
        self,
        scene_id: str,
        *,
        user_id: str | None = None,
        brand_id: str | None = None,
    ) -> DepthScene | None: ...


class JobRepository(Protocol):
    async def save_job(self, job: DepthJob) -> None: ...

    async def get_job(
        self,
        job_id: str,
        *,
        user_id: str | None = None,
        brand_id: str | None = None,
    ) -> DepthJob | None: ...

    async def update_job_stage(
        self,
        job_id: str,
        stage: JobStage,
        status: JobStatus = "processing",
        scene_id: str | None = None,
        error: str | None = None,
        progress: float = 0.0,
        user_id: str = "",
        brand_id: str = "",
    ) -> DepthJob: ...
