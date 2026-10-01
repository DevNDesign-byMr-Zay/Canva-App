from __future__ import annotations

import os
import time
from dataclasses import dataclass
from typing import Protocol
from models.job import DepthJob, JobStage, JobStatus
from models.scene import DepthScene

JOB_TTL_SECONDS = int(os.getenv("DEPTHPOP_JOB_TTL_SECONDS", "3600"))
SCENE_TTL_SECONDS = int(os.getenv("DEPTHPOP_SCENE_TTL_SECONDS", "3600"))
MAX_JOBS = int(os.getenv("DEPTHPOP_MAX_JOBS", "100"))
MAX_SCENES = int(os.getenv("DEPTHPOP_MAX_SCENES", "50"))
MAX_SCENE_ASSETS = int(os.getenv("DEPTHPOP_MAX_SCENE_ASSETS", "500"))


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
        user_id: str = "",
        brand_id: str = "",
    ) -> DepthJob: ...


@dataclass(frozen=True)
class StoredSceneAsset:
    asset_id: str
    scene_id: str
    user_id: str
    brand_id: str
    data: bytes
    mime_type: str
    created_at: float


class BoundedSceneAssetRepository:
    def __init__(self, max_assets: int = MAX_SCENE_ASSETS, ttl_seconds: int = SCENE_TTL_SECONDS) -> None:
        self.max_assets = max_assets
        self.ttl_seconds = ttl_seconds
        self._assets: dict[str, StoredSceneAsset] = {}

    def _cleanup_expired(self) -> None:
        now = time.time()
        expired = [aid for aid, a in self._assets.items() if now - a.created_at > self.ttl_seconds]
        for aid in expired:
            self._assets.pop(aid, None)

        if len(self._assets) >= self.max_assets:
            oldest_id = min(self._assets, key=lambda k: self._assets[k].created_at)
            self._assets.pop(oldest_id, None)

    async def save_asset(
        self, asset_id: str, scene_id: str, user_id: str, brand_id: str, data: bytes, mime_type: str
    ) -> StoredSceneAsset:
        self._cleanup_expired()
        asset = StoredSceneAsset(
            asset_id=asset_id,
            scene_id=scene_id,
            user_id=user_id,
            brand_id=brand_id,
            data=data,
            mime_type=mime_type,
            created_at=time.time(),
        )
        self._assets[asset_id] = asset
        return asset

    async def get_asset(self, asset_id: str, user_id: str = "", brand_id: str = "") -> StoredSceneAsset | None:
        self._cleanup_expired()
        asset = self._assets.get(asset_id)
        if not asset:
            return None
        if time.time() - asset.created_at > self.ttl_seconds:
            self._assets.pop(asset_id, None)
            return None
        if user_id and asset.user_id and asset.user_id != user_id:
            return None
        if brand_id and asset.brand_id and asset.brand_id != brand_id:
            return None
        return asset

    async def cleanup_scene_assets(self, scene_id: str) -> None:
        to_remove = [aid for aid, a in self._assets.items() if a.scene_id == scene_id]
        for aid in to_remove:
            self._assets.pop(aid, None)


class BoundedSceneRepository:
    def __init__(
        self,
        max_scenes: int = MAX_SCENES,
        ttl_seconds: int = SCENE_TTL_SECONDS,
        asset_repo: BoundedSceneAssetRepository | None = None,
    ) -> None:
        self.max_scenes = max_scenes
        self.ttl_seconds = ttl_seconds
        self.asset_repo = asset_repo
        self._scenes: dict[str, tuple[float, DepthScene]] = {}

    def _cleanup_expired(self) -> None:
        now = time.time()
        expired = [sid for sid, (created, _) in self._scenes.items() if now - created > self.ttl_seconds]
        for sid in expired:
            self._scenes.pop(sid, None)
            if self.asset_repo:
                import asyncio
                try:
                    asyncio.create_task(self.asset_repo.cleanup_scene_assets(sid))
                except Exception:
                    pass

        if len(self._scenes) >= self.max_scenes:
            oldest_id = min(self._scenes, key=lambda k: self._scenes[k][0])
            self._scenes.pop(oldest_id, None)
            if self.asset_repo:
                import asyncio
                try:
                    asyncio.create_task(self.asset_repo.cleanup_scene_assets(oldest_id))
                except Exception:
                    pass

    async def save_scene(self, scene: DepthScene) -> None:
        self._cleanup_expired()
        self._scenes[scene.id] = (time.time(), scene)

    async def get_scene(self, scene_id: str) -> DepthScene | None:
        self._cleanup_expired()
        record = self._scenes.get(scene_id)
        if not record:
            return None
        created, scene = record
        if time.time() - created > self.ttl_seconds:
            self._scenes.pop(scene_id, None)
            if self.asset_repo:
                await self.asset_repo.cleanup_scene_assets(scene_id)
            return None
        return scene


class BoundedJobRepository:
    def __init__(self, max_jobs: int = MAX_JOBS, ttl_seconds: int = JOB_TTL_SECONDS) -> None:
        self.max_jobs = max_jobs
        self.ttl_seconds = ttl_seconds
        self._jobs: dict[str, tuple[float, DepthJob]] = {}

    def _cleanup_expired(self) -> None:
        now = time.time()
        expired = [jid for jid, (created, _) in self._jobs.items() if now - created > self.ttl_seconds]
        for jid in expired:
            self._jobs.pop(jid, None)

        if len(self._jobs) >= self.max_jobs:
            oldest_id = min(self._jobs, key=lambda k: self._jobs[k][0])
            self._jobs.pop(oldest_id, None)

    async def save_job(self, job: DepthJob) -> None:
        self._cleanup_expired()
        self._jobs[job.jobId] = (time.time(), job)

    async def get_job(self, job_id: str) -> DepthJob | None:
        self._cleanup_expired()
        record = self._jobs.get(job_id)
        if not record:
            return None
        created, job = record
        if time.time() - created > self.ttl_seconds:
            self._jobs.pop(job_id, None)
            return None
        return job

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
    ) -> DepthJob:
        self._cleanup_expired()
        existing_record = self._jobs.get(job_id)
        existing = existing_record[1] if existing_record else None
        now_str = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        u_id = user_id or (existing.userId if existing else "")
        b_id = brand_id or (existing.brandId if existing else "")

        if existing:
            updated = DepthJob(
                jobId=job_id,
                userId=u_id,
                brandId=b_id,
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
                userId=u_id,
                brandId=b_id,
                status=status,
                stage=stage,
                progress=progress,
                sceneId=scene_id,
                error=error,
                createdAt=now_str,
                updatedAt=now_str,
            )
        self._jobs[job_id] = (time.time(), updated)
        return updated


scene_asset_repo = BoundedSceneAssetRepository()
scene_repo = BoundedSceneRepository(asset_repo=scene_asset_repo)
job_repo = BoundedJobRepository()
