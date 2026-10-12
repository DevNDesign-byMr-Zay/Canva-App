from __future__ import annotations

import asyncio
import io
import json
import struct
import zipfile
from pathlib import Path

from PIL import Image

from models.object import (
    AnimationKeyframe,
    AnimationTrack,
    BBox,
    DepthObject,
    ObjectAssets,
    ObjectDepthStats,
    ObjectTransform,
    Vector3,
)
from models.scene import CameraConfig, DepthScene, ReconstructedPlate, TimelineConfig
from services.export_formats import (
    export_gltf_or_glb,
    export_png_layers,
    export_portable_scene_json,
)


def _png(color=(255, 0, 0, 255)) -> bytes:
    image = Image.new("RGBA", (16, 16), color)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _scene() -> tuple[DepthScene, dict[str, bytes]]:
    plate = "asset://plate"
    depth = "asset://depth"
    cutout = "asset://cutout"
    mask = "asset://mask"
    thumb = "asset://thumb"

    obj = DepthObject(
        id="hero",
        label="Hero",
        semanticType="person",
        confidence=0.99,
        bbox=BBox(x=2, y=2, width=12, height=12),
        assets=ObjectAssets(
            cutoutUrl=cutout,
            maskUrl=mask,
            thumbnailUrl=thumb,
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
        animationTracks=[
            AnimationTrack(
                id="hero-x",
                property="position.x",
                keyframes=[
                    AnimationKeyframe(timeMs=0, value=0.4, easing="ease-in-out"),
                    AnimationKeyframe(timeMs=1000, value=0.6, easing="ease-in-out"),
                ],
            )
        ],
    )
    scene = DepthScene(
        schemaVersion=1,
        id="scene_export",
        userId="user-a",
        brandId="brand-a",
        sourceAssetId="source",
        width=16,
        height=16,
        objects=[obj],
        reconstructedPlate=ReconstructedPlate(
            imageUrl=plate,
            depthMapUrl=depth,
        ),
        camera=CameraConfig(),
        timeline=TimelineConfig(durationMs=1000, fps=10, currentTimeMs=0),
        createdAt="2026-10-12T00:00:00Z",
        updatedAt="2026-10-12T00:00:00Z",
    )
    assets = {
        plate: _png((10, 10, 10, 255)),
        depth: _png((128, 128, 128, 255)),
        cutout: _png(),
        mask: _png((255, 255, 255, 255)),
        thumb: _png(),
    }
    return scene, assets


async def _fetcher(mapping: dict[str, bytes], url: str) -> bytes:
    return mapping[url]


def test_portable_scene_json_embeds_owned_assets(tmp_path: Path):
    scene, assets = _scene()
    target = tmp_path / "scene.depthscene.json"
    asyncio.run(
        export_portable_scene_json(
            scene,
            lambda url: _fetcher(assets, url),
            target,
        )
    )

    payload = json.loads(target.read_text(encoding="utf-8"))
    assert payload["format"] == "depthscene-portable-v1"
    assert payload["scene"]["id"] == scene.id
    assert payload["assets"]["asset://cutout"]["dataUrl"].startswith(
        "data:image/png;base64,"
    )


def test_png_layer_package_contains_manifest_plate_depth_and_object_files(
    tmp_path: Path,
):
    scene, assets = _scene()
    target = tmp_path / "layers.zip"
    asyncio.run(
        export_png_layers(
            scene,
            lambda url: _fetcher(assets, url),
            target,
        )
    )

    with zipfile.ZipFile(target) as archive:
        names = set(archive.namelist())
        assert "scene.json" in names
        assert "base/reconstructed-plate.png" in names
        assert "base/depth-map.png" in names
        assert "objects/hero.png" in names
        assert "objects/hero-mask.png" in names


def test_gltf_is_structurally_valid_and_contains_sampled_animation(tmp_path: Path):
    scene, assets = _scene()
    target = tmp_path / "scene.gltf"
    asyncio.run(
        export_gltf_or_glb(
            scene,
            lambda url: _fetcher(assets, url),
            target,
            glb=False,
            include_animation=True,
        )
    )

    payload = json.loads(target.read_text(encoding="utf-8"))
    assert payload["asset"]["version"] == "2.0"
    assert payload["buffers"][0]["uri"].startswith(
        "data:application/octet-stream;base64,"
    )
    assert payload["images"][0]["uri"].startswith("data:image/png;base64,")
    assert payload["animations"]
    assert payload["animations"][0]["channels"][0]["target"]["path"] == "translation"


def test_glb_has_real_gltf_binary_header_and_json_chunk(tmp_path: Path):
    scene, assets = _scene()
    target = tmp_path / "scene.glb"
    asyncio.run(
        export_gltf_or_glb(
            scene,
            lambda url: _fetcher(assets, url),
            target,
            glb=True,
            include_animation=True,
        )
    )

    payload = target.read_bytes()
    magic, version, length = struct.unpack("<4sII", payload[:12])
    assert magic == b"glTF"
    assert version == 2
    assert length == len(payload)
    json_length, json_type = struct.unpack("<I4s", payload[12:20])
    assert json_type == b"JSON"
    document = json.loads(payload[20 : 20 + json_length].decode("utf-8"))
    assert document["asset"]["version"] == "2.0"
    assert document["animations"]
