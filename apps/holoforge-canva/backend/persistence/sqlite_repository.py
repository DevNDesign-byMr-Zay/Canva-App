from __future__ import annotations

import os
import sqlite3
import threading
import time
from pathlib import Path

from models import ExportArtifact, ExportJob
from repositories import (
    ARTIFACT_ROOT,
    MAX_ARTIFACTS,
    MAX_JOBS,
    OwnedKey,
    _remove_artifact_tree,
)


def get_db_path() -> Path:
    env_path = os.getenv("HOLOFORGE_DATABASE_PATH")
    if env_path:
        path = Path(env_path).resolve()
    else:
        path = ARTIFACT_ROOT / "holoforge.sqlite3"
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


class SqliteJobRepository:
    def __init__(self, db_path: Path | None = None) -> None:
        self.db_path = db_path or get_db_path()
        self._lock = threading.RLock()
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), timeout=30.0)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._lock, self._get_conn() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY,
                    export_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    brand_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    stage TEXT NOT NULL,
                    percent INTEGER NOT NULL,
                    message TEXT NOT NULL,
                    error TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    created_timestamp REAL NOT NULL
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_jobs_owner ON jobs(user_id, brand_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_jobs_export ON jobs(export_id)")

    def put(self, job: ExportJob) -> None:
        with self._lock, self._get_conn() as conn:
            now_ts = time.time()
            conn.execute(
                """
                INSERT INTO jobs (
                    id, export_id, user_id, brand_id, status, stage, percent,
                    message, error, created_at, updated_at, created_timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    status=excluded.status,
                    stage=excluded.stage,
                    percent=excluded.percent,
                    message=excluded.message,
                    error=excluded.error,
                    updated_at=excluded.updated_at
                """,
                (
                    job.id,
                    job.exportId,
                    job.userId,
                    job.brandId,
                    job.status,
                    job.stage,
                    job.percent,
                    job.message,
                    job.error,
                    job.createdAt,
                    job.updatedAt,
                    now_ts,
                ),
            )
            cursor = conn.execute("SELECT COUNT(*) FROM jobs")
            count = cursor.fetchone()[0]
            if count > MAX_JOBS:
                to_delete = count - MAX_JOBS
                conn.execute(
                    """
                    DELETE FROM jobs WHERE id IN (
                        SELECT id FROM jobs ORDER BY created_timestamp ASC LIMIT ?
                    )
                    """,
                    (to_delete,),
                )

    def get(self, key: OwnedKey) -> ExportJob | None:
        with self._lock, self._get_conn() as conn:
            row = conn.execute(
                """
                SELECT id, export_id, user_id, brand_id, status, stage, percent, message, error, created_at, updated_at
                FROM jobs WHERE id = ? AND user_id = ? AND brand_id = ?
                """,
                (key.resource_id, key.user_id, key.brand_id),
            ).fetchone()
            if not row:
                return None
            return ExportJob(
                id=row["id"],
                exportId=row["export_id"],
                userId=row["user_id"],
                brandId=row["brand_id"],
                status=row["status"],
                stage=row["stage"],
                percent=row["percent"],
                message=row["message"],
                error=row["error"],
                createdAt=row["created_at"],
                updatedAt=row["updated_at"],
            )

    def find_by_export(
        self,
        *,
        user_id: str,
        brand_id: str,
        export_id: str,
    ) -> ExportJob | None:
        with self._lock, self._get_conn() as conn:
            row = conn.execute(
                """
                SELECT id, export_id, user_id, brand_id, status, stage, percent, message, error, created_at, updated_at
                FROM jobs WHERE export_id = ? AND user_id = ? AND brand_id = ?
                ORDER BY created_timestamp DESC LIMIT 1
                """,
                (export_id, user_id, brand_id),
            ).fetchone()
            if not row:
                return None
            return ExportJob(
                id=row["id"],
                exportId=row["export_id"],
                userId=row["user_id"],
                brandId=row["brand_id"],
                status=row["status"],
                stage=row["stage"],
                percent=row["percent"],
                message=row["message"],
                error=row["error"],
                createdAt=row["created_at"],
                updatedAt=row["updated_at"],
            )

    def recover_stale_jobs(self) -> int:
        with self._lock, self._get_conn() as conn:
            now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            cursor = conn.execute(
                """
                UPDATE jobs
                SET status = 'error',
                    stage = 'error',
                    error = 'Server restarted while render was processing',
                    updated_at = ?
                WHERE status IN ('queued', 'rendering', 'validating', 'packaging')
                """,
                (now_iso,),
            )
            return cursor.rowcount


class SqliteArtifactRepository:
    def __init__(self, db_path: Path | None = None) -> None:
        self.db_path = db_path or get_db_path()
        ARTIFACT_ROOT.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), timeout=30.0)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._lock, self._get_conn() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS artifacts (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    brand_id TEXT NOT NULL,
                    format TEXT NOT NULL,
                    profile TEXT NOT NULL,
                    file_name TEXT NOT NULL,
                    mime_type TEXT NOT NULL,
                    path TEXT NOT NULL,
                    size_bytes INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    created_timestamp REAL NOT NULL
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_artifacts_owner ON artifacts(user_id, brand_id)")

    def allocate_dir(self, export_id: str) -> Path:
        root = ARTIFACT_ROOT / export_id
        if root.exists():
            import shutil
            shutil.rmtree(root)
        root.mkdir(parents=True, exist_ok=False)
        return root

    def put(self, artifact: ExportArtifact) -> None:
        with self._lock, self._get_conn() as conn:
            now_ts = time.time()
            conn.execute(
                """
                INSERT INTO artifacts (
                    id, user_id, brand_id, format, profile, file_name, mime_type,
                    path, size_bytes, created_at, expires_at, created_timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    path=excluded.path,
                    size_bytes=excluded.size_bytes,
                    expires_at=excluded.expires_at
                """,
                (
                    artifact.id,
                    artifact.userId,
                    artifact.brandId,
                    artifact.format,
                    artifact.profile,
                    artifact.fileName,
                    artifact.mimeType,
                    artifact.path,
                    artifact.sizeBytes,
                    artifact.createdAt,
                    artifact.expiresAt,
                    now_ts,
                ),
            )
            cursor = conn.execute("SELECT id, path FROM artifacts ORDER BY created_timestamp ASC")
            rows = cursor.fetchall()
            if len(rows) > MAX_ARTIFACTS:
                to_remove = rows[: len(rows) - MAX_ARTIFACTS]
                for row in to_remove:
                    conn.execute("DELETE FROM artifacts WHERE id = ?", (row["id"],))
                    dummy_art = ExportArtifact(
                        id=row["id"],
                        userId=artifact.userId,
                        brandId=artifact.brandId,
                        format=artifact.format,
                        profile=artifact.profile,
                        fileName=artifact.fileName,
                        mimeType=artifact.mimeType,
                        path=row["path"],
                        sizeBytes=0,
                        createdAt=artifact.createdAt,
                        expiresAt=artifact.expiresAt,
                    )
                    _remove_artifact_tree(dummy_art)

    def get(self, key: OwnedKey) -> ExportArtifact | None:
        with self._lock, self._get_conn() as conn:
            row = conn.execute(
                """
                SELECT id, user_id, brand_id, format, profile, file_name, mime_type, path, size_bytes, created_at, expires_at
                FROM artifacts WHERE id = ? AND user_id = ? AND brand_id = ?
                """,
                (key.resource_id, key.user_id, key.brand_id),
            ).fetchone()
            if not row:
                return None
            artifact = ExportArtifact(
                id=row["id"],
                userId=row["user_id"],
                brandId=row["brand_id"],
                format=row["format"],
                profile=row["profile"],
                fileName=row["file_name"],
                mimeType=row["mime_type"],
                path=row["path"],
                sizeBytes=row["size_bytes"],
                createdAt=row["created_at"],
                expiresAt=row["expires_at"],
            )
            if not Path(artifact.path).is_file():
                conn.execute("DELETE FROM artifacts WHERE id = ?", (artifact.id,))
                _remove_artifact_tree(artifact)
                return None
            return artifact
