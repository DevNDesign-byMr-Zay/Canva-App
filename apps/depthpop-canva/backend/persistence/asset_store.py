from __future__ import annotations

import hashlib
import os
import sqlite3
import time
import uuid
from pathlib import Path

from persistence.contracts import StoredSceneAsset


class DiskSceneAssetRepository:
    def __init__(
        self,
        database_path: str | Path,
        asset_root: str | Path,
        *,
        max_assets: int = 500,
        ttl_seconds: int = 3600,
    ) -> None:
        self.database_path = Path(database_path)
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self.asset_root = Path(asset_root)
        self.asset_root.mkdir(parents=True, exist_ok=True)
        self.max_assets = max(1, int(max_assets))
        self.ttl_seconds = max(1, int(ttl_seconds))
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS depthpop_assets (
                    asset_id TEXT PRIMARY KEY,
                    scene_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    brand_id TEXT NOT NULL,
                    relative_path TEXT NOT NULL,
                    mime_type TEXT NOT NULL,
                    size INTEGER NOT NULL,
                    created_at REAL NOT NULL,
                    sha256 TEXT NOT NULL
                )
                """
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_depthpop_assets_scene ON depthpop_assets(scene_id)"
            )

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode = WAL")
        return connection

    def _resolved_root(self) -> Path:
        return self.asset_root.resolve()

    def _safe_path(self, path: Path) -> Path:
        resolved = path.resolve()
        try:
            resolved.relative_to(self._resolved_root())
        except ValueError as exc:
            raise ValueError("asset path is outside DEPTHPOP_ASSET_ROOT") from exc
        return resolved

    def delete_owned_path(self, path: str | Path) -> None:
        resolved = self._safe_path(Path(path))
        if resolved.is_file() or resolved.is_symlink():
            resolved.unlink(missing_ok=True)

    def _relative_path(self, scene_id: str, asset_id: str) -> Path:
        scene_bucket = hashlib.sha256(scene_id.encode("utf-8")).hexdigest()[:24]
        return Path(scene_bucket) / asset_id

    def path_for_asset(self, asset_id: str) -> Path:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT relative_path FROM depthpop_assets WHERE asset_id = ?",
                (asset_id,),
            ).fetchone()
        if row is None:
            raise KeyError(asset_id)
        return self._safe_path(self.asset_root / str(row["relative_path"]))

    def _delete_asset_sync(
        self,
        connection: sqlite3.Connection,
        asset_id: str,
    ) -> None:
        row = connection.execute(
            "SELECT relative_path FROM depthpop_assets WHERE asset_id = ?",
            (asset_id,),
        ).fetchone()
        if row is not None:
            path = self.asset_root / str(row["relative_path"])
            self.delete_owned_path(path)
            parent = self._safe_path(path).parent
            if parent != self._resolved_root():
                try:
                    parent.rmdir()
                except OSError:
                    pass
        connection.execute(
            "DELETE FROM depthpop_assets WHERE asset_id = ?",
            (asset_id,),
        )

    def _cleanup_expired_sync(self, connection: sqlite3.Connection) -> None:
        cutoff = time.time() - self.ttl_seconds
        rows = connection.execute(
            "SELECT asset_id FROM depthpop_assets WHERE created_at < ?",
            (cutoff,),
        ).fetchall()
        for row in rows:
            self._delete_asset_sync(connection, str(row["asset_id"]))

    def _evict_for_insert_sync(self, connection: sqlite3.Connection) -> None:
        self._cleanup_expired_sync(connection)
        while True:
            count = int(
                connection.execute(
                    "SELECT COUNT(*) AS n FROM depthpop_assets"
                ).fetchone()["n"]
            )
            if count < self.max_assets:
                return
            oldest = connection.execute(
                """
                SELECT asset_id
                FROM depthpop_assets
                ORDER BY created_at ASC, asset_id ASC
                LIMIT 1
                """
            ).fetchone()
            if oldest is None:
                return
            self._delete_asset_sync(connection, str(oldest["asset_id"]))

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

        resource_id = asset_id or f"asset_{uuid.uuid4().hex}"
        relative = self._relative_path(scene_id, resource_id)
        target = self._safe_path(self.asset_root / relative)
        target.parent.mkdir(parents=True, exist_ok=True)
        digest = hashlib.sha256(data).hexdigest()
        created_at = time.time()

        with self._connect() as connection:
            self._evict_for_insert_sync(connection)
            collision = connection.execute(
                "SELECT 1 FROM depthpop_assets WHERE asset_id = ?",
                (resource_id,),
            ).fetchone()
            if collision is not None:
                raise ValueError("scene asset id collision")

            temp = target.with_name(target.name + ".tmp-" + uuid.uuid4().hex)
            safe_temp = self._safe_path(temp)
            try:
                safe_temp.write_bytes(data)
                os.replace(safe_temp, target)
                connection.execute(
                    """
                    INSERT INTO depthpop_assets
                        (asset_id, scene_id, user_id, brand_id, relative_path,
                         mime_type, size, created_at, sha256)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        resource_id,
                        scene_id,
                        user_id,
                        brand_id,
                        relative.as_posix(),
                        mime_type,
                        len(data),
                        created_at,
                        digest,
                    ),
                )
            except Exception:
                safe_temp.unlink(missing_ok=True)
                target.unlink(missing_ok=True)
                raise

        return StoredSceneAsset(
            asset_id=resource_id,
            scene_id=scene_id,
            user_id=user_id,
            brand_id=brand_id,
            data=data,
            mime_type=mime_type,
            size=len(data),
            created_at=created_at,
            sha256=digest,
        )

    async def save_asset(self, **kwargs) -> StoredSceneAsset:
        return self.save_asset_sync(**kwargs)

    async def get_asset(
        self,
        asset_id: str,
        *,
        user_id: str,
        brand_id: str,
    ) -> StoredSceneAsset | None:
        with self._connect() as connection:
            self._cleanup_expired_sync(connection)
            row = connection.execute(
                """
                SELECT *
                FROM depthpop_assets
                WHERE asset_id = ? AND user_id = ? AND brand_id = ?
                """,
                (asset_id, user_id, brand_id),
            ).fetchone()
            if row is None:
                return None
            path = self._safe_path(self.asset_root / str(row["relative_path"]))
            if not path.is_file():
                connection.execute(
                    "DELETE FROM depthpop_assets WHERE asset_id = ?",
                    (asset_id,),
                )
                return None
            data = path.read_bytes()
            digest = hashlib.sha256(data).hexdigest()
            if digest != str(row["sha256"]) or len(data) != int(row["size"]):
                self._delete_asset_sync(connection, asset_id)
                return None

        return StoredSceneAsset(
            asset_id=str(row["asset_id"]),
            scene_id=str(row["scene_id"]),
            user_id=str(row["user_id"]),
            brand_id=str(row["brand_id"]),
            data=data,
            mime_type=str(row["mime_type"]),
            size=int(row["size"]),
            created_at=float(row["created_at"]),
            sha256=str(row["sha256"]),
        )

    def cleanup_scene_assets_sync(self, scene_id: str) -> None:
        if not scene_id:
            return
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT asset_id FROM depthpop_assets WHERE scene_id = ?",
                (scene_id,),
            ).fetchall()
            for row in rows:
                self._delete_asset_sync(connection, str(row["asset_id"]))

    async def cleanup_scene_assets(self, scene_id: str) -> None:
        self.cleanup_scene_assets_sync(scene_id)
