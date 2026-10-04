from __future__ import annotations

import hashlib
import time
import uuid

from models.job import DepthJob, JobStage, JobStatus
from models.scene import DepthScene
from persistence.contracts import StoredSceneAsset


class MemorySceneAssetRepository:
    def __init__(self, *, max_assets: int = 500, ttl_seconds: int = 3600) -> None:
        self.max_assets = max(1, int(max_assets))
        self.ttl_seconds = max(1, int(ttl_seconds))
        self._assets: dict[str, StoredSceneAsset] = {}

    def _cleanup_expired_sync(self) -> None:
        now = time.time()
        expired = [
            asset_id
            for asset_id, asset in self._assets.items()
            if now - asset.created_at > self.ttl_seconds
        ]
        for asset_id in expired:
            self._assets.pop(asset_id, None)

    def _evict_for_insert_sync(self) -> None:
        self._cleanup_expired_sync()
        while len(self._assets) >= self.max_assets and self._assets:
            oldest_id = min(
                self._assets,
                key=lambda key: self._assets[key].created_at,
            )
            self._assets.pop(oldest_id, None)

    def save_asset_sync(
        self,
        *,
        scene_id: str,
        user_id: str,
        brand_id: str,
        data: bytes,
        mime_type: str,
        asset_id: str | None = None,
    ) -> StoredSceneAsset:
        if not scene_id or not user_id or not brand_id:
            raise ValueError("scene assets require scene, user, and brand ownership")
        if not data:
            raise ValueError("scene assets cannot be empty")

        self._evict_for_insert_sync()
        resource_id = asset_id or f"asset_{uuid.uuid4().hex}"
        if resource_id in self._assets:
            raise ValueError("scene asset id collision")

        asset = StoredSceneAsset(
            asset_id=resource_id,
            scene_id=scene_id,
            user_id=user_id,
            brand_id=brand_id,
            data=data,
            mime_type=mime_type,
            size=len(data),
            created_at=time.time(),
            sha256=hashlib.sha256(data).hexdigest(),
        )
        self._assets[resource_id] = asset
        return asset

    async def save_asset(self, **kwargs) -> StoredSceneAsset:
        return self.save_asset_sync(**kwargs)

    async def get_asset(
        self,
        asset_id: str,
        *,
        user_id: str,
        brand_id: str,
    ) -> StoredSceneAsset | None:
        self._cleanup_expired_sync()
        asset = self._assets.get(asset_id)
        if asset is None:
            return None
        if asset.user_id != user_id or asset.brand_id != brand_id:
            return None
        return asset

    def cleanup_scene_assets_sync(self, scene_id: str) -> None:
        if not scene_id:
            return
        for asset_id in [
            asset_id
            for asset_id, asset in self._assets.items()
            if asset.scene_id == scene_id
        ]:
            self._assets.pop(asset_id, None)

    async def cleanup_scene_assets(self, scene_id: str) -> None:
        self.cleanup_scene_assets_sync(scene_id)


class MemorySceneRepository:
    def __init__(
        self,
        *,
        max_scenes: int = 50,
        ttl_seconds: int = 3600,
        asset_store: MemorySceneAssetRepository | None = None,
    ) -> None:
        self.max_scenes = max(1, int(max_scenes))
        self.ttl_seconds = max(1, int(ttl_seconds))
        self.asset_store = asset_store
        self._scenes: dict[str, tuple[float, DepthScene]] = {}

    def _remove_scene_sync(self, scene_id: str) -> None:
        self._scenes.pop(scene_id, None)
        if self.asset_store is not None:
            self.asset_store.cleanup_scene_assets_sync(scene_id)

    def _cleanup_expired_sync(self) -> None:
        now = time.time()
        expired = [
            scene_id
            for scene_id, (created_at, _) in self._scenes.items()
            if now - created_at > self.ttl_seconds
        ]
        for scene_id in expired:
            self._remove_scene_sync(scene_id)

    def _evict_for_insert_sync(self, scene_id: str) -> None:
        self._cleanup_expired_sync()
        if scene_id in self._scenes:
            return
        while len(self._scenes) >= self.max_scenes and self._scenes:
            oldest_id = min(self._scenes, key=lambda key: self._scenes[key][0])
            self._remove_scene_sync(oldest_id)

    async def save_scene(self, scene: DepthScene) -> None:
        self._evict_for_insert_sync(scene.id)
        self._scenes[scene.id] = (time.time(), scene)

    async def get_scene(
        self,
        scene_id: str,
        *,
        user_id: str | None = None,
        brand_id: str | None = None,
    ) -> DepthScene | None:
        self._cleanup_expired_sync()
        record = self._scenes.get(scene_id)
        if record is None:
            return None
        scene = record[1]
        if user_id is not None and scene.userId != user_id:
            return None
        if brand_id is not None and scene.brandId != brand_id:
            return None
        return scene


class MemoryJobRepository:
    def __init__(self, *, max_jobs: int = 100, ttl_seconds: int = 3600) -> None:
        self.max_jobs = max(1, int(max_jobs))
        self.ttl_seconds = max(1, int(ttl_seconds))
        self._jobs: dict[str, tuple[float, DepthJob]] = {}

    def _cleanup_expired_sync(self) -> None:
        now = time.time()
        expired = [
            job_id
            for job_id, (created_at, _) in self._jobs.items()
            if now - created_at > self.ttl_seconds
        ]
        for job_id in expired:
            self._jobs.pop(job_id, None)

    def _evict_for_insert_sync(self, job_id: str) -> None:
        self._cleanup_expired_sync()
        if job_id in self._jobs:
            return
        while len(self._jobs) >= self.max_jobs and self._jobs:
            oldest_id = min(self._jobs, key=lambda key: self._jobs[key][0])
            self._jobs.pop(oldest_id, None)

    async def save_job(self, job: DepthJob) -> None:
        self._evict_for_insert_sync(job.jobId)
        self._jobs[job.jobId] = (time.time(), job)

    async def get_job(
        self,
        job_id: str,
        *,
        user_id: str | None = None,
        brand_id: str | None = None,
    ) -> DepthJob | None:
        self._cleanup_expired_sync()
        record = self._jobs.get(job_id)
        if record is None:
            return None
        job = record[1]
        if user_id is not None and job.userId != user_id:
            return None
        if brand_id is not None and job.brandId != brand_id:
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
        self._evict_for_insert_sync(job_id)
        record = self._jobs.get(job_id)
        existing = record[1] if record else None
        now_string = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        resolved_user = user_id or (existing.userId if existing else "")
        resolved_brand = brand_id or (existing.brandId if existing else "")
        if not resolved_user or not resolved_brand:
            raise ValueError("DepthPop jobs require user and brand ownership")

        if existing is None:
            updated = DepthJob(
                jobId=job_id,
                userId=resolved_user,
                brandId=resolved_brand,
                status=status,
                stage=stage,
                progress=progress,
                sceneId=scene_id,
                error=error,
                createdAt=now_string,
                updatedAt=now_string,
            )
        else:
            updated = existing.model_copy(
                update={
                    "status": status,
                    "stage": stage,
                    "progress": progress,
                    "sceneId": scene_id or existing.sceneId,
                    "error": error if error is not None else existing.error,
                    "updatedAt": now_string,
                    "userId": resolved_user,
                    "brandId": resolved_brand,
                }
            )
        self._jobs[job_id] = (time.time(), updated)
        return updated
