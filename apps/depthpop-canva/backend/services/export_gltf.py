"""glTF and GLB geometry, buffers, animation channels and serialization."""
import json
import math
import struct
from pathlib import Path
from models.object import DepthObject, Vector3
from models.scene import DepthScene
from services.export_assets import AssetFetcher, _collect_scene_assets, _data_url
from services.export_animation import _animated_object
from services.export_limits import MAX_EXPORT_FRAMES

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


