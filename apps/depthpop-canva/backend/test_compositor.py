from __future__ import annotations

import asyncio
import io

import pytest
from fastapi import HTTPException
from PIL import Image, ImageDraw

from models.object import (
    BBox,
    DepthObject,
    ObjectAssets,
    ObjectDepthStats,
    ObjectTransform,
    Vector3,
)
from models.scene import CameraConfig, DepthScene, ReconstructedPlate, TimelineConfig
from services.compositor import composite_scene


def png_bytes(
    size: tuple[int, int],
    *,
    color=(0, 0, 0, 0),
    rect: tuple[int, int, int, int] | None = None,
    rect_color=(255, 0, 0, 255),
) -> bytes:
    image = Image.new("RGBA", size, color)
    if rect is not None:
        ImageDraw.Draw(image).rectangle(rect, fill=rect_color)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def depth_object(
    object_id: str,
    *,
    order: int = 0,
    visible: bool = True,
    position=(0.2, 0.2, 0.0),
    scale=(1.0, 1.0, 1.0),
    rotation_z=0.0,
    opacity=1.0,
    feather=0.0,
    cutout_url="asset://red",
) -> DepthObject:
    return DepthObject(
        id=object_id,
        label=object_id,
        semanticType="prop",
        confidence=1.0,
        bbox=BBox(x=10, y=10, width=20, height=20),
        assets=ObjectAssets(
            cutoutUrl=cutout_url,
            maskUrl="asset://mask",
            thumbnailUrl="asset://thumb",
        ),
        depth=ObjectDepthStats(mean=0.5, median=0.5, min=0.5, max=0.5),
        transform=ObjectTransform(
            position=Vector3(x=position[0], y=position[1], z=position[2]),
            rotation=Vector3(x=0, y=0, z=rotation_z),
            scale=Vector3(x=scale[0], y=scale[1], z=scale[2]),
        ),
        opacity=opacity,
        feather=feather,
        visible=visible,
        locked=False,
        order=order,
        animationTracks=[],
    )


def scene_with(objects: list[DepthObject]) -> DepthScene:
    return DepthScene(
        schemaVersion=1,
        id="scene_compositor",
        sourceAssetId="source",
        width=100,
        height=100,
        objects=objects,
        reconstructedPlate=ReconstructedPlate(
            imageUrl="asset://plate",
            depthMapUrl="asset://depth",
        ),
        camera=CameraConfig(),
        timeline=TimelineConfig(),
        createdAt="2026-10-01T00:00:00Z",
        updatedAt="2026-10-01T00:00:00Z",
    )


def decode(payload: bytes) -> Image.Image:
    return Image.open(io.BytesIO(payload)).convert("RGBA")


def test_full_canvas_cutout_is_cropped_before_positioning():
    assets = {
        "asset://plate": png_bytes((100, 100)),
        "asset://red": png_bytes(
            (100, 100),
            rect=(10, 10, 29, 29),
            rect_color=(255, 0, 0, 255),
        ),
    }

    async def fetch(url: str) -> bytes:
        return assets[url]

    payload = asyncio.run(
        composite_scene(
            scene_with([depth_object("red", position=(0.8, 0.8, 0.0))]),
            fetch,
        )
    )
    image = decode(payload)

    assert image.getpixel((80, 80))[0] > 220
    assert image.getpixel((20, 20))[3] == 0


def test_visibility_opacity_scale_and_rotation_affect_render():
    assets = {
        "asset://plate": png_bytes((100, 100)),
        "asset://red": png_bytes(
            (100, 100),
            rect=(10, 10, 29, 29),
            rect_color=(255, 0, 0, 255),
        ),
    }

    async def fetch(url: str) -> bytes:
        return assets[url]

    visible = depth_object(
        "red",
        position=(0.5, 0.5, 0.0),
        scale=(2.0, 1.0, 1.0),
        rotation_z=20,
        opacity=0.5,
        feather=1.0,
    )
    rendered = decode(asyncio.run(composite_scene(scene_with([visible]), fetch)))
    assert rendered.getbbox() is not None
    assert 0 < rendered.getpixel((50, 50))[3] < 255

    hidden = depth_object("red", visible=False, position=(0.5, 0.5, 0.0))
    hidden_render = decode(
        asyncio.run(composite_scene(scene_with([hidden]), fetch))
    )
    assert hidden_render.getbbox() is None


def test_layer_order_is_deterministic():
    assets = {
        "asset://plate": png_bytes((100, 100)),
        "asset://red": png_bytes(
            (100, 100),
            rect=(10, 10, 29, 29),
            rect_color=(255, 0, 0, 255),
        ),
        "asset://blue": png_bytes(
            (100, 100),
            rect=(10, 10, 29, 29),
            rect_color=(0, 0, 255, 255),
        ),
    }

    async def fetch(url: str) -> bytes:
        return assets[url]

    red = depth_object("red", order=0, position=(0.5, 0.5, 0), cutout_url="asset://red")
    blue = depth_object("blue", order=1, position=(0.5, 0.5, 0), cutout_url="asset://blue")
    image = decode(asyncio.run(composite_scene(scene_with([blue, red]), fetch)))

    pixel = image.getpixel((50, 50))
    assert pixel[2] > 220
    assert pixel[0] < 20


def test_missing_object_asset_fails_instead_of_silently_omitting():
    async def fetch(url: str) -> bytes:
        if url == "asset://plate":
            return png_bytes((100, 100))
        raise HTTPException(status_code=404, detail="missing")

    with pytest.raises(HTTPException) as exc:
        asyncio.run(composite_scene(scene_with([depth_object("red")]), fetch))

    assert exc.value.status_code == 404


def test_partially_off_canvas_object_is_clipped_without_failure():
    assets = {
        "asset://plate": png_bytes((100, 100)),
        "asset://red": png_bytes(
            (100, 100),
            rect=(10, 10, 29, 29),
            rect_color=(255, 0, 0, 255),
        ),
    }

    async def fetch(url: str) -> bytes:
        return assets[url]

    moved = depth_object(
        "red",
        position=(0.02, 0.02, 0.0),
        scale=(2.0, 2.0, 1.0),
    )
    rendered = decode(
        asyncio.run(composite_scene(scene_with([moved]), fetch))
    )

    assert rendered.size == (100, 100)
    assert rendered.getbbox() is not None
    assert rendered.getpixel((0, 0))[3] > 0


def test_camera_xy_and_fov_are_applied_to_final_frame():
    assets = {
        "asset://plate": png_bytes(
            (100, 100),
            rect=(45, 45, 54, 54),
            rect_color=(255, 255, 255, 255),
        ),
    }

    async def fetch(url: str) -> bytes:
        return assets[url]

    scene = scene_with([])
    scene.camera.position.x = 10
    scene.camera.position.y = -5
    scene.camera.fov = 100

    rendered = decode(asyncio.run(composite_scene(scene, fetch)))

    assert rendered.size == (100, 100)
    # FOV 100 maps to the compositor's minimum 0.55 view scale. The white
    # center marker remains visible but moves with the authored camera.
    assert rendered.getbbox() is not None
    assert rendered.getpixel((60, 45))[3] > 0
    assert rendered.getpixel((5, 5))[3] == 0
