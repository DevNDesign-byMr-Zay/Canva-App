from __future__ import annotations

import asyncio
import io
import json
import os
import shutil
import struct
import subprocess
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app import app
from models.export import DepthExportArtifact, DepthExportJob
from models.object import (
    BBox,
    DepthObject,
    ObjectAssets,
    ObjectDepthStats,
    ObjectTransform,
    Vector3,
)
from models.scene import CameraConfig, DepthScene, ReconstructedPlate, TimelineConfig
from persistence.asset_store import DiskSceneAssetRepository
from persistence.export_repository import SQLiteExportRepository
from persistence.export_storage import ExportArtifactStorage
from persistence.sqlite_repository import SQLiteJobRepository, SQLiteSceneRepository
from services.export_formats import (
    export_gltf_or_glb,
    export_png_layers,
    export_portable_scene_json,
)

client = TestClient(app)


def _png(color=(255, 0, 0, 255)) -> bytes:
    image = Image.new("RGBA", (16, 16), color)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _scene() -> tuple[DepthScene, dict[str, bytes]]:
    assets = {
        "asset://plate": _png((20, 20, 24, 255)),
        "asset://depth": _png((128, 128, 128, 255)),
        "asset://cutout": _png((255, 0, 0, 255)),
        "asset://mask": _png((255, 255, 255, 255)),
        "asset://thumb": _png((255, 0, 0, 255)),
    }
    obj = DepthObject(
        id="hero",
        label="Hero",
        semanticType="person",
        confidence=0.99,
        bbox=BBox(x=2, y=2, width=12, height=12),
        assets=ObjectAssets(
            cutoutUrl="asset://cutout",
            maskUrl="asset://mask",
            thumbnailUrl="asset://thumb",
        ),
        depth=ObjectDepthStats(mean=0.7, median=0.7, min=0.6, max=0.8),
        transform=ObjectTransform(
            position=Vector3(x=0.5, y=0.5, z=0.4),
            rotation=Vector3(x=0, y=0, z=0),
            scale=Vector3(x=1, y=1, z=1),
        ),
        opacity=1,
        feather=0,
        visible=True,
        locked=False,
        order=0,
        animationTracks=[],
    )
    return (
        DepthScene(
            schemaVersion=1,
            id="deployment-smoke-scene",
            userId="user-a",
            brandId="brand-a",
            sourceAssetId="source-a",
            width=16,
            height=16,
            objects=[obj],
            reconstructedPlate=ReconstructedPlate(
                imageUrl="asset://plate",
                depthMapUrl="asset://depth",
            ),
            camera=CameraConfig(),
            timeline=TimelineConfig(durationMs=1000, fps=10, currentTimeMs=0),
            createdAt="2026-10-12T00:00:00Z",
            updatedAt="2026-10-12T00:00:00Z",
        ),
        assets,
    )


async def _fetch(mapping: dict[str, bytes], url: str) -> bytes:
    return mapping[url]


def _export_job(job_id: str, status: str = "processing") -> DepthExportJob:
    now = datetime.now(timezone.utc)
    return DepthExportJob(
        jobId=job_id,
        userId="user-a",
        brandId="brand-a",
        sceneId="deployment-smoke-scene",
        format="scene-json",
        status=status,
        stage="loading_scene",
        progress=0.1,
        artifactId=None,
        error=None,
        cancelRequested=False,
        createdAt=now.isoformat().replace("+00:00", "Z"),
        updatedAt=now.isoformat().replace("+00:00", "Z"),
    )


def test_health_endpoint_is_available():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"service": "depthpop-canva", "status": "ok"}


def test_sqlite_scene_and_owned_asset_survive_repository_reopen(tmp_path: Path):
    database = tmp_path / "depthpop.sqlite3"
    asset_root = tmp_path / "assets"

    asset_store = DiskSceneAssetRepository(
        database,
        asset_root,
        max_assets=32,
        ttl_seconds=3600,
    )
    scene_repo = SQLiteSceneRepository(
        database,
        max_scenes=8,
        ttl_seconds=3600,
        asset_store=asset_store,
    )

    scene, _ = _scene()
    asyncio.run(scene_repo.save_scene(scene))
    stored = asset_store.save_asset_sync(
        scene_id=scene.id,
        user_id=scene.userId,
        brand_id=scene.brandId,
        data=_png(),
        mime_type="image/png",
        asset_id="deployment-smoke-asset",
    )

    reopened_assets = DiskSceneAssetRepository(
        database,
        asset_root,
        max_assets=32,
        ttl_seconds=3600,
    )
    reopened_scenes = SQLiteSceneRepository(
        database,
        max_scenes=8,
        ttl_seconds=3600,
        asset_store=reopened_assets,
    )

    restored_scene = asyncio.run(
        reopened_scenes.get_scene(
            scene.id,
            user_id=scene.userId,
            brand_id=scene.brandId,
        )
    )
    restored_asset = asyncio.run(
        reopened_assets.get_asset(
            stored.asset_id,
            user_id=scene.userId,
            brand_id=scene.brandId,
        )
    )

    assert restored_scene is not None
    assert restored_scene.id == scene.id
    assert restored_asset is not None
    assert restored_asset.sha256 == stored.sha256

    assert (
        asyncio.run(
            reopened_assets.get_asset(
                stored.asset_id,
                user_id="other-user",
                brand_id=scene.brandId,
            )
        )
        is None
    )


def test_export_repository_recovers_incomplete_job_and_retains_artifact(
    tmp_path: Path,
):
    database = tmp_path / "depthpop.sqlite3"
    storage = ExportArtifactStorage(tmp_path / "artifacts")
    first = SQLiteExportRepository(
        database,
        storage,
        recover_incomplete=False,
    )
    first.save_job(_export_job("deployment-export"))

    workspace = storage.allocate_workspace("deployment-artifact")
    path = workspace / "scene.depthscene.json"
    path.write_text("{}", encoding="utf-8")
    now = datetime.now(timezone.utc)
    artifact = DepthExportArtifact(
        artifactId="deployment-artifact",
        userId="user-a",
        brandId="brand-a",
        sceneId="deployment-smoke-scene",
        format="scene-json",
        path=str(path),
        mimeType="application/json",
        size=path.stat().st_size,
        sha256=storage.sha256_file(path),
        createdAt=now.isoformat().replace("+00:00", "Z"),
        expiresAt=(now + timedelta(hours=1)).isoformat().replace("+00:00", "Z"),
    )
    first.save_artifact(artifact)

    reopened = SQLiteExportRepository(
        database,
        storage,
        recover_incomplete=True,
    )
    recovered = reopened.get_job(
        "deployment-export",
        user_id="user-a",
        brand_id="brand-a",
    )
    retained = reopened.get_artifact(
        artifact.artifactId,
        user_id="user-a",
        brand_id="brand-a",
    )

    assert recovered is not None
    assert recovered.status == "failed"
    assert recovered.stage == "failed"
    assert "restarted" in (recovered.error or "").lower()
    assert retained is not None
    assert Path(retained.path).is_file()


def test_scene_export_formats_are_structurally_real(tmp_path: Path):
    scene, assets = _scene()

    portable = tmp_path / "scene.depthscene.json"
    asyncio.run(
        export_portable_scene_json(
            scene,
            lambda url: _fetch(assets, url),
            portable,
        )
    )
    portable_payload = json.loads(portable.read_text(encoding="utf-8"))
    assert portable_payload["format"] == "depthscene-portable-v1"

    layers = tmp_path / "layers.zip"
    asyncio.run(
        export_png_layers(
            scene,
            lambda url: _fetch(assets, url),
            layers,
        )
    )
    with zipfile.ZipFile(layers) as archive:
        names = set(archive.namelist())
        assert "scene.json" in names
        assert "base/reconstructed-plate.png" in names
        assert "objects/hero.png" in names

    gltf = tmp_path / "scene.gltf"
    asyncio.run(
        export_gltf_or_glb(
            scene,
            lambda url: _fetch(assets, url),
            gltf,
            glb=False,
            include_animation=True,
        )
    )
    gltf_payload = json.loads(gltf.read_text(encoding="utf-8"))
    assert gltf_payload["asset"]["version"] == "2.0"

    glb = tmp_path / "scene.glb"
    asyncio.run(
        export_gltf_or_glb(
            scene,
            lambda url: _fetch(assets, url),
            glb,
            glb=True,
            include_animation=True,
        )
    )
    payload = glb.read_bytes()
    magic, version, length = struct.unpack("<4sII", payload[:12])
    assert magic == b"glTF"
    assert version == 2
    assert length == len(payload)


def test_ffmpeg_runtime_probe_is_real_when_required():
    if os.getenv("DEPTHPOP_REQUIRE_FFMPEG_SMOKE") != "1":
        pytest.skip(
            "DEPTHPOP_REQUIRE_FFMPEG_SMOKE=1 enables the production-image FFmpeg probe"
        )

    executable = shutil.which("ffmpeg")
    assert executable, "ffmpeg must be installed in the production DepthPop image"
    completed = subprocess.run(
        [executable, "-version"],
        check=False,
        capture_output=True,
        text=True,
        timeout=10,
    )
    assert completed.returncode == 0
    assert "ffmpeg version" in (completed.stdout + completed.stderr).lower()


def test_live_fal_provider_is_explicitly_opt_in():
    if os.getenv("DEPTHPOP_LIVE_PROVIDER_SMOKE") != "1":
        pytest.skip(
            "DEPTHPOP_LIVE_PROVIDER_SMOKE=1 enables bounded paid provider validation"
        )
    assert os.getenv("FAL_KEY"), (
        "FAL_KEY must be configured when DEPTHPOP_LIVE_PROVIDER_SMOKE=1"
    )
