from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path
from typing import Any

from models.job import DepthJob, JobStage, JobStatus
from models.scene import DepthScene


_RESTART_ERROR = "DepthPop service restarted before this job completed."


class _SQLiteBase:
    def __init__(self, database_path: str | Path) -> None:
        self.database_path = Path(database_path)
        self.database_path.parent.mkdir(parents=True, exist_ok=True)

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA journal_mode = WAL")
        return connection


class SQLiteSceneRepository(_SQLiteBase):
    def __init__(
        self,
        database_path: str | Path,
        *,
        max_scenes: int = 50,
        ttl_seconds: int = 3600,
        asset_store: Any | None = None,
    ) -> None:
        super().__init__(database_path)
        self.max_scenes = max(1, int(max_scenes))
        self.ttl_seconds = max(1, int(ttl_seconds))
        self.asset_store = asset_store
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS depthpop_scenes (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    brand_id TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    touched_at REAL NOT NULL
                )
                """
            )

    def _remove_scene_sync(
        self,
        connection: sqlite3.Connection,
        scene_id: str,
    ) -> None:
        connection.execute("DELETE FROM depthpop_scenes WHERE id = ?", (scene_id,))
        if self.asset_store is not None:
            self.asset_store.cleanup_scene_assets_sync(scene_id)

    def _cleanup_expired_sync(self, connection: sqlite3.Connection) -> None:
        cutoff = time.time() - self.ttl_seconds
        rows = connection.execute(
            "SELECT id FROM depthpop_scenes WHERE touched_at < ?",
            (cutoff,),
        ).fetchall()
        for row in rows:
            self._remove_scene_sync(connection, str(row["id"]))

    def _evict_for_insert_sync(
        self,
        connection: sqlite3.Connection,
        scene_id: str,
    ) -> None:
        self._cleanup_expired_sync(connection)
        exists = connection.execute(
            "SELECT 1 FROM depthpop_scenes WHERE id = ?",
            (scene_id,),
        ).fetchone()
        if exists:
            return
        while True:
            count = int(
                connection.execute(
                    "SELECT COUNT(*) AS n FROM depthpop_scenes"
                ).fetchone()["n"]
            )
            if count < self.max_scenes:
                return
            oldest = connection.execute(
                "SELECT id FROM depthpop_scenes ORDER BY touched_at ASC, id ASC LIMIT 1"
            ).fetchone()
            if oldest is None:
                return
            self._remove_scene_sync(connection, str(oldest["id"]))

    async def save_scene(self, scene: DepthScene) -> None:
        now = time.time()
        payload = scene.model_dump_json(by_alias=True)
        with self._connect() as connection:
            self._evict_for_insert_sync(connection, scene.id)
            existing = connection.execute(
                "SELECT created_at FROM depthpop_scenes WHERE id = ?",
                (scene.id,),
            ).fetchone()
            created_at = float(existing["created_at"]) if existing else now
            connection.execute(
                """
                INSERT INTO depthpop_scenes
                    (id, user_id, brand_id, payload, created_at, touched_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    user_id = excluded.user_id,
                    brand_id = excluded.brand_id,
                    payload = excluded.payload,
                    touched_at = excluded.touched_at
                """,
                (
                    scene.id,
                    scene.userId,
                    scene.brandId,
                    payload,
                    created_at,
                    now,
                ),
            )

    async def get_scene(
        self,
        scene_id: str,
        *,
        user_id: str | None = None,
        brand_id: str | None = None,
    ) -> DepthScene | None:
        with self._connect() as connection:
            self._cleanup_expired_sync(connection)
            row = connection.execute(
                """
                SELECT payload, user_id, brand_id
                FROM depthpop_scenes
                WHERE id = ?
                """,
                (scene_id,),
            ).fetchone()
        if row is None:
            return None
        if user_id is not None and str(row["user_id"]) != user_id:
            return None
        if brand_id is not None and str(row["brand_id"]) != brand_id:
            return None
        return DepthScene.model_validate_json(str(row["payload"]))


class SQLiteJobRepository(_SQLiteBase):
    def __init__(
        self,
        database_path: str | Path,
        *,
        max_jobs: int = 100,
        ttl_seconds: int = 3600,
        recover_incomplete: bool = False,
    ) -> None:
        super().__init__(database_path)
        self.max_jobs = max(1, int(max_jobs))
        self.ttl_seconds = max(1, int(ttl_seconds))
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS depthpop_jobs (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    brand_id TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    touched_at REAL NOT NULL
                )
                """
            )
        if recover_incomplete:
            self._recover_incomplete_sync()

    def _cleanup_expired_sync(self, connection: sqlite3.Connection) -> None:
        cutoff = time.time() - self.ttl_seconds
        connection.execute(
            "DELETE FROM depthpop_jobs WHERE touched_at < ?",
            (cutoff,),
        )

    def _evict_for_insert_sync(
        self,
        connection: sqlite3.Connection,
        job_id: str,
    ) -> None:
        self._cleanup_expired_sync(connection)
        exists = connection.execute(
            "SELECT 1 FROM depthpop_jobs WHERE id = ?",
            (job_id,),
        ).fetchone()
        if exists:
            return
        while True:
            count = int(
                connection.execute(
                    "SELECT COUNT(*) AS n FROM depthpop_jobs"
                ).fetchone()["n"]
            )
            if count < self.max_jobs:
                return
            oldest = connection.execute(
                "SELECT id FROM depthpop_jobs ORDER BY touched_at ASC, id ASC LIMIT 1"
            ).fetchone()
            if oldest is None:
                return
            connection.execute(
                "DELETE FROM depthpop_jobs WHERE id = ?",
                (str(oldest["id"]),),
            )

    def _recover_incomplete_sync(self) -> None:
        now_string = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT id, payload FROM depthpop_jobs"
            ).fetchall()
            for row in rows:
                job = DepthJob.model_validate_json(str(row["payload"]))
                if job.status not in {"queued", "processing"}:
                    continue
                recovered = job.model_copy(
                    update={
                        "status": "error",
                        "stage": "error",
                        "progress": 1.0,
                        "error": _RESTART_ERROR,
                        "updatedAt": now_string,
                    }
                )
                connection.execute(
                    """
                    UPDATE depthpop_jobs
                    SET payload = ?, touched_at = ?
                    WHERE id = ?
                    """,
                    (
                        recovered.model_dump_json(by_alias=True),
                        time.time(),
                        job.jobId,
                    ),
                )

    async def save_job(self, job: DepthJob) -> None:
        now = time.time()
        payload = job.model_dump_json(by_alias=True)
        with self._connect() as connection:
            self._evict_for_insert_sync(connection, job.jobId)
            existing = connection.execute(
                "SELECT created_at FROM depthpop_jobs WHERE id = ?",
                (job.jobId,),
            ).fetchone()
            created_at = float(existing["created_at"]) if existing else now
            connection.execute(
                """
                INSERT INTO depthpop_jobs
                    (id, user_id, brand_id, payload, created_at, touched_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    user_id = excluded.user_id,
                    brand_id = excluded.brand_id,
                    payload = excluded.payload,
                    touched_at = excluded.touched_at
                """,
                (
                    job.jobId,
                    job.userId,
                    job.brandId,
                    payload,
                    created_at,
                    now,
                ),
            )

    async def get_job(
        self,
        job_id: str,
        *,
        user_id: str | None = None,
        brand_id: str | None = None,
    ) -> DepthJob | None:
        with self._connect() as connection:
            self._cleanup_expired_sync(connection)
            row = connection.execute(
                """
                SELECT payload, user_id, brand_id
                FROM depthpop_jobs
                WHERE id = ?
                """,
                (job_id,),
            ).fetchone()
        if row is None:
            return None
        if user_id is not None and str(row["user_id"]) != user_id:
            return None
        if brand_id is not None and str(row["brand_id"]) != brand_id:
            return None
        return DepthJob.model_validate_json(str(row["payload"]))

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
        existing = await self.get_job(job_id)
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
        await self.save_job(updated)
        return updated
