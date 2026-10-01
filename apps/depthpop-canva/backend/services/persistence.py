from __future__ import annotations

import time
from typing import Protocol
from models.job import DepthJob, JobStage, JobStatus
from models.scene import DepthScene


class SceneRepository(Protocol):
    async def save_scene(self, scene: DepthScene) -> None: ...
    async def get_scene(self, scene_id: str) -> DepthScene | None: ...


class JobRepository(Protocol):
    async def save_job(self, job: DepthJob) -> None: ...
    async def get_job(self, job_id: str) -> DepthJob | None: ...
    async def update_job_stage(
        self,
        job_id: str,
        stage: JobStage,
        status: JobStatus = "processing",
        scene_id: str | None = None,
        error: str | None = None,
        progress: float = 0.0,
    ) -> DepthJob: ...


class InMemorySceneRepository:
    def __init__(self) -> None:
        self._scenes: dict[str, DepthScene] = {}

    async def save_scene(self, scene: DepthScene) -> None:
        self._scenes[scene.id] = scene

    async def get_scene(self, scene_id: str) -> DepthScene | None:
        return self._scenes.get(scene_id)


class InMemoryJobRepository:
    def __init__(self) -> None:
        self._jobs: dict[str, DepthJob] = {}

    async def save_job(self, job: DepthJob) -> None:
        self._jobs[job.jobId] = job

    async def get_job(self, job_id: str) -> DepthJob | None:
        return self._jobs.get(job_id)

    async def update_job_stage(
        self,
        job_id: str,
        stage: JobStage,
        status: JobStatus = "processing",
        scene_id: str | None = None,
        error: str | None = None,
        progress: float = 0.0,
    ) -> DepthJob:
        existing = self._jobs.get(job_id)
        now_str = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        if existing:
            updated = DepthJob(
                jobId=job_id,
                status=status,
                stage=stage,
                progress=progress,
                sceneId=scene_id or existing.sceneId,
                error=error or existing.error,
                createdAt=existing.createdAt,
                updatedAt=now_str,
            )
        else:
            updated = DepthJob(
                jobId=job_id,
                status=status,
                stage=stage,
                progress=progress,
                sceneId=scene_id,
                error=error,
                createdAt=now_str,
                updatedAt=now_str,
            )
        self._jobs[job_id] = updated
        return updated


scene_repo = InMemorySceneRepository()
job_repo = InMemoryJobRepository()
