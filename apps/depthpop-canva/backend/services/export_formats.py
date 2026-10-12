from __future__ import annotations

import asyncio
import base64
import io
import json
import math
import os
import shutil
import struct
import subprocess
import zipfile
from pathlib import Path
from typing import Awaitable, Callable

from PIL import Image

from models.export import ExportRequest
from models.object import AnimationTrack, DepthObject, ObjectTransform, Vector3
from models.scene import DepthScene
from services.compositor import composite_scene

AssetFetcher = Callable[[str], Awaitable[bytes]]
ProgressReporter = Callable[[str, float], Awaitable[None]]
CancelChecker = Callable[[], Awaitable[bool]]

MAX_EXPORT_PIXELS = max(
    262_144,
    int(os.getenv("DEPTHPOP_MAX_EXPORT_PIXELS", "16777216")),
)
MAX_EXPORT_FRAMES = max(
    1,
    int(os.getenv("DEPTHPOP_MAX_EXPORT_FRAMES", "3600")),
)
MAX_EXPORT_DURATION_MS = max(
    1000,
    int(os.getenv("DEPTHPOP_MAX_EXPORT_DURATION_MS", "120000")),
)


def _mime_for_bytes(payload: bytes) -> str:
    if payload.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if payload.startswith(b"\xff\xd8"):
        return "image/jpeg"
    if payload[:4] == b"RIFF" and payload[8:12] == b"WEBP":
        return "image/webp"
    return "application/octet-stream"


def _data_url(payload: bytes, mime: str | None = None) -> str:
    resolved = mime or _mime_for_bytes(payload)
    return f"data:{resolved};base64," + base64.b64encode(payload).decode("ascii")


def _safe_name(value: str) -> str:
    clean = "".join(char if char.isalnum() or char in "-_" else "-" for char in value)
    return clean.strip("-_")[:96] or "asset"


def _ease(t: float, easing: str) -> float:
    t = max(0.0, min(1.0, t))
    if easing == "ease-in":
        return t * t
    if easing == "ease-out":
        return 1.0 - (1.0 - t) * (1.0 - t)
    if easing == "ease-in-out":
        if t < 0.5:
            return 2.0 * t * t
        return 1.0 - ((-2.0 * t + 2.0) ** 2) / 2.0
    return t


def _track_value(track: AnimationTrack, time_ms: int, fallback: float) -> float:
    if not track.keyframes:
        return fallback
    frames = track.keyframes
    if time_ms <= frames[0].timeMs:
        return float(frames[0].value)
    if time_ms >= frames[-1].timeMs:
        return float(frames[-1].value)

    for left, right in zip(frames, frames[1:]):
        if left.timeMs <= time_ms <= right.timeMs:
            span = max(1, right.timeMs - left.timeMs)
            fraction = (time_ms - left.timeMs) / span
            eased = _ease(fraction, right.easing)
            return float(left.value) + (float(right.value) - float(left.value)) * eased
    return fallback


def _animated_object(obj: DepthObject, time_ms: int) -> DepthObject:
    position = obj.transform.position.model_copy(deep=True)
    rotation = obj.transform.rotation.model_copy(deep=True)
    scale = obj.transform.scale.model_copy(deep=True)
    opacity = float(obj.opacity)

    for track in obj.animationTracks:
        if track.property == "position.x":
            position.x = _track_value(track, time_ms, position.x)
        elif track.property == "position.y":
            position.y = _track_value(track, time_ms, position.y)
        elif track.property == "position.z":
            position.z = _track_value(track, time_ms, position.z)
        elif track.property == "rotation.x":
            rotation.x = _track_value(track, time_ms, rotation.x)
        elif track.property == "rotation.y":
            rotation.y = _track_value(track, time_ms, rotation.y)
        elif track.property == "rotation.z":
            rotation.z = _track_value(track, time_ms, rotation.z)
        elif track.property == "scale.x":
            scale.x = _track_value(track, time_ms, scale.x)
        elif track.property == "scale.y":
            scale.y = _track_value(track, time_ms, scale.y)
        elif track.property == "scale.z":
            scale.z = _track_value(track, time_ms, scale.z)
        elif track.property == "opacity":
            opacity = max(0.0, min(1.0, _track_value(track, time_ms, opacity)))

    return obj.model_copy(
        update={
            "transform": ObjectTransform(
                position=position,
                rotation=rotation,
                scale=scale,
            ),
            "opacity": opacity,
        },
        deep=True,
    )


def scene_at_time(scene: DepthScene, time_ms: int) -> DepthScene:
    bounded = max(0, min(scene.timeline.durationMs, int(time_ms)))
    objects = [_animated_object(obj, bounded) for obj in scene.objects]
    timeline = scene.timeline.model_copy(update={"currentTimeMs": bounded}, deep=True)
    return scene.model_copy(
        update={"objects": objects, "timeline": timeline},
        deep=True,
    )


async def _collect_scene_assets(
    scene: DepthScene,
    fetch_asset: AssetFetcher,
) -> dict[str, bytes]:
    urls = {
        scene.reconstructedPlate.imageUrl,
        scene.reconstructedPlate.depthMapUrl,
    }
    for obj in scene.objects:
        urls.update(
            {
                obj.assets.cutoutUrl,
                obj.assets.maskUrl,
                obj.assets.thumbnailUrl,
            }
        )
    collected: dict[str, bytes] = {}
    for url in sorted(urls):
        collected[url] = await fetch_asset(url)
    return collected


async def export_portable_scene_json(
    scene: DepthScene,
    fetch_asset: AssetFetcher,
    target: Path,
) -> tuple[Path, str]:
    assets = await _collect_scene_assets(scene, fetch_asset)
    payload = {
        "format": "depthscene-portable-v1",
        "scene": scene.model_dump(mode="json", by_alias=True),
        "assets": {
            url: {
                "mimeType": _mime_for_bytes(data),
                "dataUrl": _data_url(data),
            }
            for url, data in assets.items()
        },
    }
    target.write_text(
        json.dumps(payload, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    return target, "application/json"


async def export_png_layers(
    scene: DepthScene,
    fetch_asset: AssetFetcher,
    target: Path,
) -> tuple[Path, str]:
    assets = await _collect_scene_assets(scene, fetch_asset)
    manifest = {
        "format": "depthpop-layer-package-v1",
        "scene": scene.model_dump(mode="json", by_alias=True),
        "files": {},
    }
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        plate = assets[scene.reconstructedPlate.imageUrl]
        depth = assets[scene.reconstructedPlate.depthMapUrl]
        archive.writestr("base/reconstructed-plate.png", plate)
        archive.writestr("base/depth-map.png", depth)
        manifest["files"]["reconstructedPlate"] = "base/reconstructed-plate.png"
        manifest["files"]["depthMap"] = "base/depth-map.png"

        object_files: dict[str, dict[str, str]] = {}
        for obj in scene.objects:
            stem = _safe_name(obj.id)
            cutout_name = f"objects/{stem}.png"
            mask_name = f"objects/{stem}-mask.png"
            archive.writestr(cutout_name, assets[obj.assets.cutoutUrl])
            archive.writestr(mask_name, assets[obj.assets.maskUrl])
            object_files[obj.id] = {
                "cutout": cutout_name,
                "mask": mask_name,
            }
        manifest["files"]["objects"] = object_files
        archive.writestr(
            "scene.json",
            json.dumps(manifest, indent=2, sort_keys=True).encode("utf-8"),
        )
    return target, "application/zip"


def _quat_euler_degrees(rx: float, ry: float, rz: float) -> list[float]:
    x = math.radians(rx) / 2.0
    y = math.radians(ry) / 2.0
    z = math.radians(-rz) / 2.0
    cx, sx = math.cos(x), math.sin(x)
    cy, sy = math.cos(y), math.sin(y)
    cz, sz = math.cos(z), math.sin(z)
    return [
        sx * cy * cz - cx * sy * sz,
        cx * sy * cz + sx * cy * sz,
        cx * cy * sz - sx * sy * cz,
        cx * cy * cz + sx * sy * sz,
    ]


def _node_translation(scene: DepthScene, obj: DepthObject) -> list[float]:
    aspect = scene.width / max(1.0, float(scene.height))
    return [
        (float(obj.transform.position.x) - 0.5) * 2.0 * aspect,
        (0.5 - float(obj.transform.position.y)) * 2.0,
        float(obj.transform.position.z),
    ]


def _node_scale(scene: DepthScene, obj: DepthObject) -> list[float]:
    aspect = scene.width / max(1.0, float(scene.height))
    base_width = max(1.0, obj.bbox.width) / scene.width * 2.0 * aspect
    base_height = max(1.0, obj.bbox.height) / scene.height * 2.0
    return [
        base_width * float(obj.transform.scale.x),
        base_height * float(obj.transform.scale.y),
        max(0.001, float(obj.transform.scale.z)),
    ]


class _GltfBuffer:
    def __init__(self) -> None:
        self.data = bytearray()
        self.views: list[dict] = []
        self.accessors: list[dict] = []

    def add(
        self,
        raw: bytes,
        *,
        component_type: int,
        count: int,
        accessor_type: str,
        target: int | None = None,
        minimum: list[float] | None = None,
        maximum: list[float] | None = None,
    ) -> int:
        while len(self.data) % 4:
            self.data.append(0)
        offset = len(self.data)
        self.data.extend(raw)
        view: dict = {
            "buffer": 0,
            "byteOffset": offset,
            "byteLength": len(raw),
        }
        if target is not None:
            view["target"] = target
        view_index = len(self.views)
        self.views.append(view)
        accessor: dict = {
            "bufferView": view_index,
            "componentType": component_type,
            "count": count,
            "type": accessor_type,
        }
        if minimum is not None:
            accessor["min"] = minimum
        if maximum is not None:
            accessor["max"] = maximum
        accessor_index = len(self.accessors)
        self.accessors.append(accessor)
        return accessor_index


def _pack_floats(values: list[float]) -> bytes:
    return struct.pack("<" + "f" * len(values), *values)


def _pack_uint16(values: list[int]) -> bytes:
    return struct.pack("<" + "H" * len(values), *values)


def _build_gltf(
    scene: DepthScene,
    assets: dict[str, bytes],
    *,
    include_animation: bool,
) -> tuple[dict, bytes]:
    buffer = _GltfBuffer()
    positions = [
        -0.5, -0.5, 0.0,
         0.5, -0.5, 0.0,
         0.5,  0.5, 0.0,
        -0.5,  0.5, 0.0,
    ]
    texcoords = [0.0, 1.0, 1.0, 1.0, 1.0, 0.0, 0.0, 0.0]
    indices = [0, 1, 2, 0, 2, 3]
    pos_accessor = buffer.add(
        _pack_floats(positions),
        component_type=5126,
        count=4,
        accessor_type="VEC3",
        target=34962,
        minimum=[-0.5, -0.5, 0.0],
        maximum=[0.5, 0.5, 0.0],
    )
    uv_accessor = buffer.add(
        _pack_floats(texcoords),
        component_type=5126,
        count=4,
        accessor_type="VEC2",
        target=34962,
        minimum=[0.0, 0.0],
        maximum=[1.0, 1.0],
    )
    index_accessor = buffer.add(
        _pack_uint16(indices),
        component_type=5123,
        count=6,
        accessor_type="SCALAR",
        target=34963,
        minimum=[0],
        maximum=[3],
    )

    images: list[dict] = []
    textures: list[dict] = []
    materials: list[dict] = []
    meshes: list[dict] = []
    nodes: list[dict] = []
    root_nodes: list[int] = []
    object_node_indices: dict[str, int] = {}

    for obj in sorted(scene.objects, key=lambda item: item.order):
        cutout = assets[obj.assets.cutoutUrl]
        image_index = len(images)
        images.append({"uri": _data_url(cutout)})
        texture_index = len(textures)
        textures.append({"source": image_index})
        material_index = len(materials)
        materials.append(
            {
                "name": f"{obj.label} Material",
                "doubleSided": True,
                "alphaMode": "BLEND",
                "pbrMetallicRoughness": {
                    "baseColorTexture": {"index": texture_index},
                    "baseColorFactor": [1.0, 1.0, 1.0, float(obj.opacity)],
                    "metallicFactor": 0.0,
                    "roughnessFactor": 1.0,
                },
            }
        )
        mesh_index = len(meshes)
        meshes.append(
            {
                "name": obj.label,
                "primitives": [
                    {
                        "attributes": {
                            "POSITION": pos_accessor,
                            "TEXCOORD_0": uv_accessor,
                        },
                        "indices": index_accessor,
                        "material": material_index,
                    }
                ],
            }
        )
        node_index = len(nodes)
        object_node_indices[obj.id] = node_index
        nodes.append(
            {
                "name": obj.label,
                "mesh": mesh_index,
                "translation": _node_translation(scene, obj),
                "rotation": _quat_euler_degrees(
                    obj.transform.rotation.x,
                    obj.transform.rotation.y,
                    obj.transform.rotation.z,
                ),
                "scale": _node_scale(scene, obj),
                "extras": {
                    "depthpopObjectId": obj.id,
                    "semanticType": obj.semanticType,
                    "visible": obj.visible,
                    "locked": obj.locked,
                    "opacityAnimationTracks": [
                        track.model_dump(mode="json", by_alias=True)
                        for track in obj.animationTracks
                        if track.property == "opacity"
                    ],
                },
            }
        )
        if obj.visible:
            root_nodes.append(node_index)

    camera_index = 0
    cameras = [
        {
            "name": "DepthPop Camera",
            "type": "perspective",
            "perspective": {
                "yfov": math.radians(float(scene.camera.fov)),
                "znear": 0.01,
                "zfar": 1000.0,
            },
        }
    ]
    camera_node_index = len(nodes)
    nodes.append(
        {
            "name": "DepthPop Camera",
            "camera": camera_index,
            "translation": [
                float(scene.camera.position.x) / 50.0,
                float(scene.camera.position.y) / 50.0,
                float(scene.camera.position.z),
            ],
            "extras": {
                "target": scene.camera.target.model_dump(mode="json"),
            },
        }
    )
    root_nodes.append(camera_node_index)

    animations: list[dict] = []
    if include_animation and scene.timeline.durationMs > 0:
        sample_fps = min(scene.timeline.fps, 30)
        frame_count = max(
            2,
            min(
                MAX_EXPORT_FRAMES,
                int(math.ceil(scene.timeline.durationMs / 1000.0 * sample_fps)) + 1,
            ),
        )
        times_ms = [
            round(scene.timeline.durationMs * index / (frame_count - 1))
            for index in range(frame_count)
        ]
        times_seconds = [value / 1000.0 for value in times_ms]
        time_accessor = buffer.add(
            _pack_floats(times_seconds),
            component_type=5126,
            count=len(times_seconds),
            accessor_type="SCALAR",
            minimum=[min(times_seconds)],
            maximum=[max(times_seconds)],
        )

        animation_samplers: list[dict] = []
        animation_channels: list[dict] = []
        for original in scene.objects:
            node_index = object_node_indices[original.id]
            properties = {track.property for track in original.animationTracks}
            if not properties:
                continue
            samples = [_animated_object(original, value) for value in times_ms]

            if any(prop.startswith("position.") for prop in properties):
                values: list[float] = []
                for sample in samples:
                    values.extend(_node_translation(scene, sample))
                output = buffer.add(
                    _pack_floats(values),
                    component_type=5126,
                    count=len(samples),
                    accessor_type="VEC3",
                )
                sampler_index = len(animation_samplers)
                animation_samplers.append(
                    {"input": time_accessor, "output": output, "interpolation": "LINEAR"}
                )
                animation_channels.append(
                    {
                        "sampler": sampler_index,
                        "target": {"node": node_index, "path": "translation"},
                    }
                )

            if any(prop.startswith("rotation.") for prop in properties):
                values = []
                for sample in samples:
                    values.extend(
                        _quat_euler_degrees(
                            sample.transform.rotation.x,
                            sample.transform.rotation.y,
                            sample.transform.rotation.z,
                        )
                    )
                output = buffer.add(
                    _pack_floats(values),
                    component_type=5126,
                    count=len(samples),
                    accessor_type="VEC4",
                )
                sampler_index = len(animation_samplers)
                animation_samplers.append(
                    {"input": time_accessor, "output": output, "interpolation": "LINEAR"}
                )
                animation_channels.append(
                    {
                        "sampler": sampler_index,
                        "target": {"node": node_index, "path": "rotation"},
                    }
                )

            if any(prop.startswith("scale.") for prop in properties):
                values = []
                for sample in samples:
                    values.extend(_node_scale(scene, sample))
                output = buffer.add(
                    _pack_floats(values),
                    component_type=5126,
                    count=len(samples),
                    accessor_type="VEC3",
                )
                sampler_index = len(animation_samplers)
                animation_samplers.append(
                    {"input": time_accessor, "output": output, "interpolation": "LINEAR"}
                )
                animation_channels.append(
                    {
                        "sampler": sampler_index,
                        "target": {"node": node_index, "path": "scale"},
                    }
                )

        if animation_channels:
            animations.append(
                {
                    "name": "DepthPop Timeline",
                    "samplers": animation_samplers,
                    "channels": animation_channels,
                }
            )

    document: dict = {
        "asset": {
            "version": "2.0",
            "generator": "DepthPop",
        },
        "scene": 0,
        "scenes": [{"name": scene.id, "nodes": root_nodes}],
        "nodes": nodes,
        "meshes": meshes,
        "materials": materials,
        "textures": textures,
        "images": images,
        "cameras": cameras,
        "buffers": [{"byteLength": len(buffer.data)}],
        "bufferViews": buffer.views,
        "accessors": buffer.accessors,
        "extras": {
            "depthpopSchemaVersion": scene.schemaVersion,
            "depthpopSceneId": scene.id,
        },
    }
    if animations:
        document["animations"] = animations
    return document, bytes(buffer.data)


async def export_gltf_or_glb(
    scene: DepthScene,
    fetch_asset: AssetFetcher,
    target: Path,
    *,
    glb: bool,
    include_animation: bool,
) -> tuple[Path, str]:
    assets = await _collect_scene_assets(scene, fetch_asset)
    document, binary = _build_gltf(
        scene,
        assets,
        include_animation=include_animation,
    )

    if not glb:
        document["buffers"][0]["uri"] = _data_url(binary, "application/octet-stream")
        target.write_text(
            json.dumps(document, separators=(",", ":"), ensure_ascii=False),
            encoding="utf-8",
        )
        return target, "model/gltf+json"

    json_bytes = json.dumps(
        document,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")
    while len(json_bytes) % 4:
        json_bytes += b" "
    bin_bytes = binary
    while len(bin_bytes) % 4:
        bin_bytes += b"\x00"

    total_length = 12 + 8 + len(json_bytes)
    if bin_bytes:
        total_length += 8 + len(bin_bytes)
    payload = bytearray()
    payload.extend(struct.pack("<4sII", b"glTF", 2, total_length))
    payload.extend(struct.pack("<I4s", len(json_bytes), b"JSON"))
    payload.extend(json_bytes)
    if bin_bytes:
        payload.extend(struct.pack("<II", len(bin_bytes), 0x004E4942))
        payload.extend(bin_bytes)
    target.write_bytes(bytes(payload))
    return target, "model/gltf-binary"


async def export_video(
    scene: DepthScene,
    fetch_asset: AssetFetcher,
    target: Path,
    request: ExportRequest,
    workspace: Path,
    report: ProgressReporter,
    is_cancelled: CancelChecker,
) -> tuple[Path, str]:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg is required for DepthPop video export")

    duration_ms = scene.timeline.durationMs if request.includeAnimation else 0
    if duration_ms > MAX_EXPORT_DURATION_MS:
        raise ValueError("DepthScene duration exceeds DEPTHPOP_MAX_EXPORT_DURATION_MS")

    fps = request.fps or scene.timeline.fps
    fps = max(1, min(60, fps))
    frame_count = (
        max(1, int(math.ceil(duration_ms / 1000.0 * fps)) + 1)
        if duration_ms > 0
        else 1
    )
    if frame_count > MAX_EXPORT_FRAMES:
        raise ValueError("DepthScene export exceeds DEPTHPOP_MAX_EXPORT_FRAMES")

    width = request.resolution.width if request.resolution else scene.width
    height = request.resolution.height if request.resolution else scene.height
    if width * height > MAX_EXPORT_PIXELS:
        raise ValueError("DepthScene export exceeds DEPTHPOP_MAX_EXPORT_PIXELS")

    frames_dir = workspace / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)
    await report("rendering_frames", 0.18)

    for index in range(frame_count):
        if await is_cancelled():
            raise asyncio.CancelledError()
        time_ms = (
            round(duration_ms * index / max(1, frame_count - 1))
            if duration_ms > 0
            else scene.timeline.currentTimeMs
        )
        frame_scene = scene_at_time(scene, time_ms)
        png = await composite_scene(frame_scene, fetch_asset)
        if (width, height) != (scene.width, scene.height):
            with Image.open(io.BytesIO(png)) as image:
                resized = image.convert("RGBA").resize(
                    (width, height),
                    Image.Resampling.LANCZOS,
                )
                resized.save(
                    frames_dir / f"frame_{index:05d}.png",
                    format="PNG",
                    optimize=True,
                )
        else:
            (frames_dir / f"frame_{index:05d}.png").write_bytes(png)
        await report(
            "rendering_frames",
            0.18 + 0.62 * ((index + 1) / frame_count),
        )

    if await is_cancelled():
        raise asyncio.CancelledError()

    await report("encoding_video", 0.84)
    input_pattern = str(frames_dir / "frame_%05d.png")
    if request.format == "mp4":
        command = [
            ffmpeg,
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-framerate",
            str(fps),
            "-i",
            input_pattern,
            "-an",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(target),
        ]
        mime = "video/mp4"
    else:
        command = [
            ffmpeg,
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-framerate",
            str(fps),
            "-i",
            input_pattern,
            "-an",
            "-c:v",
            "libvpx-vp9",
            "-pix_fmt",
            "yuv420p",
            "-b:v",
            "0",
            "-crf",
            "28",
            str(target),
        ]
        mime = "video/webm"

    completed = await asyncio.to_thread(
        subprocess.run,
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=300,
        check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(
            f"ffmpeg {request.format} encode failed: {completed.stderr[-2000:]}"
        )
    if not target.is_file() or target.stat().st_size <= 0:
        raise RuntimeError("ffmpeg produced no video artifact")
    return target, mime
