from __future__ import annotations

import json
import sqlite3
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

from models.export import DepthExportArtifact, DepthExportJob
from persistence.export_storage import ExportArtifactStorage

_RESTART_ERROR = "DepthPop service restarted before this export completed."


def _epoch(iso_value: str) -> float:
    try:
        return datetime.fromisoformat(iso_value.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return 0.0


class MemoryExportRepository:
    def __init__(
        self,
        storage: ExportArtifactStorage,
        *,
        max_jobs: int = 128,
        max_artifacts: int = 64,
        job_ttl_seconds: int = 3600,
    ) -> None:
        self.storage = storage
        self.max_jobs = max(1, int(max_jobs))
        self.max_artifacts = max(1, int(max_artifacts))
        self.job_ttl_seconds = max(60, int(job_ttl_seconds))
        self._jobs: dict[str, tuple[float, DepthExportJob]] = {}
        self._artifacts: dict[str, tuple[float, DepthExportArtifact]] = {}
        self._lock = threading.RLock()

    def _cleanup(self) -> None:
        now = time.time()
        expired_jobs = [
            key
            for key, (created, _) in self._jobs.items()
            if now - created > self.job_ttl_seconds
        ]
        for key in expired_jobs:
            self._jobs.pop(key, None)

        expired_artifacts = [
            key
            for key, (_, artifact) in self._artifacts.items()
            if _epoch(artifact.expiresAt) <= now
        ]
        for key in expired_artifacts:
            record = self._artifacts.pop(key, None)
            if record is not None:
                self.storage.cleanup_workspace(record[1].path)

    def save_job(self, job: DepthExportJob) -> None:
        with self._lock:
            self._cleanup()
            created = self._jobs.get(job.jobId, (time.time(), job))[0]
            self._jobs[job.jobId] = (created, job)
            while len(self._jobs) > self.max_jobs:
                oldest = min(self._jobs, key=lambda key: self._jobs[key][0])
                self._jobs.pop(oldest, None)

    def get_job(
        self,
        job_id: str,
        *,
        user_id: str,
        brand_id: str,
    ) -> DepthExportJob | None:
        with self._lock:
            self._cleanup()
            record = self._jobs.get(job_id)
            if record is None:
                return None
            job = record[1]
            if job.userId != user_id or job.brandId != brand_id:
                return None
            return job

    def request_cancel(
        self,
        job_id: str,
        *,
        user_id: str,
        brand_id: str,
    ) -> DepthExportJob | None:
        with self._lock:
            job = self.get_job(job_id, user_id=user_id, brand_id=brand_id)
            if job is None:
                return None
            if job.status in {"complete", "failed", "cancelled"}:
                return job
            updated = job.model_copy(update={"cancelRequested": True})
            self.save_job(updated)
            return updated

    def save_artifact(self, artifact: DepthExportArtifact) -> None:
        with self._lock:
            self._cleanup()
            self._artifacts[artifact.artifactId] = (time.time(), artifact)
            while len(self._artifacts) > self.max_artifacts:
                oldest = min(self._artifacts, key=lambda key: self._artifacts[key][0])
                _, evicted = self._artifacts.pop(oldest)
                self.storage.cleanup_workspace(evicted.path)

    def get_artifact(
        self,
        artifact_id: str,
        *,
        user_id: str,
        brand_id: str,
    ) -> DepthExportArtifact | None:
        with self._lock:
            self._cleanup()
            record = self._artifacts.get(artifact_id)
            if record is None:
                return None
            artifact = record[1]
            if artifact.userId != user_id or artifact.brandId != brand_id:
                return None
            path = self.storage.safe_path(artifact.path)
            if not path.is_file():
                self._artifacts.pop(artifact_id, None)
                return None
            return artifact


class SQLiteExportRepository:
    def __init__(
        self,
        database_path: str | Path,
        storage: ExportArtifactStorage,
        *,
        max_jobs: int = 128,
        max_artifacts: int = 64,
        job_ttl_seconds: int = 3600,
        recover_incomplete: bool = True,
    ) -> None:
        self.database_path = Path(database_path)
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self.storage = storage
        self.max_jobs = max(1, int(max_jobs))
        self.max_artifacts = max(1, int(max_artifacts))
        self.job_ttl_seconds = max(60, int(job_ttl_seconds))
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS depthpop_export_jobs (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    brand_id TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    touched_at REAL NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS depthpop_export_artifacts (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    brand_id TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    expires_at REAL NOT NULL
                )
                """
            )
        if recover_incomplete:
            self._recover_incomplete()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode = WAL")
        return connection

    def _recover_incomplete(self) -> None:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT id, payload FROM depthpop_export_jobs"
            ).fetchall()
            now_string = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            for row in rows:
                job = DepthExportJob.model_validate_json(str(row["payload"]))
                if job.status not in {"queued", "processing"}:
                    continue
                recovered = job.model_copy(
                    update={
                        "status": "failed",
                        "stage": "failed",
                        "progress": 1.0,
                        "error": _RESTART_ERROR,
                        "updatedAt": now_string,
                    }
                )
                connection.execute(
                    "UPDATE depthpop_export_jobs SET payload = ?, touched_at = ? WHERE id = ?",
                    (recovered.model_dump_json(by_alias=True), time.time(), job.jobId),
                )

    def _cleanup(self, connection: sqlite3.Connection) -> None:
        now = time.time()
        connection.execute(
            "DELETE FROM depthpop_export_jobs WHERE touched_at < ?",
            (now - self.job_ttl_seconds,),
        )
        expired = connection.execute(
            "SELECT id, payload FROM depthpop_export_artifacts WHERE expires_at <= ?",
            (now,),
        ).fetchall()
        for row in expired:
            artifact = DepthExportArtifact.model_validate_json(str(row["payload"]))
            try:
                self.storage.cleanup_workspace(artifact.path)
            finally:
                connection.execute(
                    "DELETE FROM depthpop_export_artifacts WHERE id = ?",
                    (str(row["id"]),),
                )

    def save_job(self, job: DepthExportJob) -> None:
        with self._connect() as connection:
            self._cleanup(connection)
            now = time.time()
            existing = connection.execute(
                "SELECT created_at FROM depthpop_export_jobs WHERE id = ?",
                (job.jobId,),
            ).fetchone()
            created = float(existing["created_at"]) if existing else now
            connection.execute(
                """
                INSERT INTO depthpop_export_jobs
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
                    job.model_dump_json(by_alias=True),
                    created,
                    now,
                ),
            )
            count = int(
                connection.execute(
                    "SELECT COUNT(*) AS n FROM depthpop_export_jobs"
                ).fetchone()["n"]
            )
            if count > self.max_jobs:
                rows = connection.execute(
                    """
                    SELECT id FROM depthpop_export_jobs
                    ORDER BY created_at ASC, id ASC
                    LIMIT ?
                    """,
                    (count - self.max_jobs,),
                ).fetchall()
                for row in rows:
                    connection.execute(
                        "DELETE FROM depthpop_export_jobs WHERE id = ?",
                        (str(row["id"]),),
                    )

    def get_job(
        self,
        job_id: str,
        *,
        user_id: str,
        brand_id: str,
    ) -> DepthExportJob | None:
        with self._connect() as connection:
            self._cleanup(connection)
            row = connection.execute(
                """
                SELECT payload FROM depthpop_export_jobs
                WHERE id = ? AND user_id = ? AND brand_id = ?
                """,
                (job_id, user_id, brand_id),
            ).fetchone()
        if row is None:
            return None
        return DepthExportJob.model_validate_json(str(row["payload"]))

    def request_cancel(
        self,
        job_id: str,
        *,
        user_id: str,
        brand_id: str,
    ) -> DepthExportJob | None:
        job = self.get_job(job_id, user_id=user_id, brand_id=brand_id)
        if job is None:
            return None
        if job.status in {"complete", "failed", "cancelled"}:
            return job
        updated = job.model_copy(update={"cancelRequested": True})
        self.save_job(updated)
        return updated

    def save_artifact(self, artifact: DepthExportArtifact) -> None:
        with self._connect() as connection:
            self._cleanup(connection)
            created = _epoch(artifact.createdAt)
            expires = _epoch(artifact.expiresAt)
            connection.execute(
                """
                INSERT OR REPLACE INTO depthpop_export_artifacts
                    (id, user_id, brand_id, payload, created_at, expires_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    artifact.artifactId,
                    artifact.userId,
                    artifact.brandId,
                    artifact.model_dump_json(by_alias=True),
                    created,
                    expires,
                ),
            )
            count = int(
                connection.execute(
                    "SELECT COUNT(*) AS n FROM depthpop_export_artifacts"
                ).fetchone()["n"]
            )
            if count > self.max_artifacts:
                rows = connection.execute(
                    """
                    SELECT id, payload FROM depthpop_export_artifacts
                    ORDER BY created_at ASC, id ASC
                    LIMIT ?
                    """,
                    (count - self.max_artifacts,),
                ).fetchall()
                for row in rows:
                    evicted = DepthExportArtifact.model_validate_json(str(row["payload"]))
                    try:
                        self.storage.cleanup_workspace(evicted.path)
                    finally:
                        connection.execute(
                            "DELETE FROM depthpop_export_artifacts WHERE id = ?",
                            (str(row["id"]),),
                        )

    def get_artifact(
        self,
        artifact_id: str,
        *,
        user_id: str,
        brand_id: str,
    ) -> DepthExportArtifact | None:
        with self._connect() as connection:
            self._cleanup(connection)
            row = connection.execute(
                """
                SELECT payload FROM depthpop_export_artifacts
                WHERE id = ? AND user_id = ? AND brand_id = ?
                """,
                (artifact_id, user_id, brand_id),
            ).fetchone()
            if row is None:
                return None
            artifact = DepthExportArtifact.model_validate_json(str(row["payload"]))
            path = self.storage.safe_path(artifact.path)
            if not path.is_file():
                connection.execute(
                    "DELETE FROM depthpop_export_artifacts WHERE id = ?",
                    (artifact_id,),
                )
                return None
            return artifact
