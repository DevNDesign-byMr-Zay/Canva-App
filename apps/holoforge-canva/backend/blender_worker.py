from __future__ import annotations

import base64
import colorsys
import json
import math
import re
import sys
import tempfile
import zipfile
from pathlib import Path

import bpy

args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
if len(args) != 1:
    raise SystemExit("usage: blender --background --python blender_worker.py -- JOB_JSON")

job_path = Path(args[0]).resolve()
payload = json.loads(job_path.read_text(encoding="utf-8"))
scene_data = payload["scene"]
request = payload["request"]
output_dir = Path(payload["outputDir"]).resolve()
output_dir.mkdir(parents=True, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE_NEXT"
scene.render.resolution_x = int(request["resolution"]["width"])
scene.render.resolution_y = int(request["resolution"]["height"])
scene.render.resolution_percentage = 100
scene.render.fps = int(scene_data["timeline"]["fps"])
scene.frame_start = 1
scene.frame_end = max(
    1,
    round(
        scene_data["timeline"]["durationMs"]
        / 1000
        * scene_data["timeline"]["fps"]
    ),
)
scene.render.film_transparent = bool(request.get("transparentBackground", False))


def rgba(hex_or_hsl: str):
    value = (hex_or_hsl or "#ffffff").strip()
    if value.startswith("#") and len(value) in {4, 7}:
        if len(value) == 4:
            value = "#" + "".join(char * 2 for char in value[1:])
        return tuple(int(value[index:index+2], 16) / 255 for index in (1, 3, 5)) + (1.0,)

    match = re.fullmatch(
        r"hsl\(\s*([-+]?\d+(?:\.\d+)?)\s+([-+]?\d+(?:\.\d+)?)%\s+([-+]?\d+(?:\.\d+)?)%\s*\)",
        value,
        flags=re.IGNORECASE,
    )
    if match:
        hue = (float(match.group(1)) % 360.0) / 360.0
        saturation = max(0.0, min(1.0, float(match.group(2)) / 100.0))
        lightness = max(0.0, min(1.0, float(match.group(3)) / 100.0))
        red, green, blue = colorsys.hls_to_rgb(hue, lightness, saturation)
        return (red, green, blue, 1.0)

    return (0.35, 0.8, 1.0, 1.0)


def material_for(spec: dict):
    material = bpy.data.materials.new("HoloForgeMaterial")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    principled = nodes.get("Principled BSDF")
    if principled:
        principled.inputs["Base Color"].default_value = rgba(spec.get("baseColor", "#5cecff"))
        principled.inputs["Metallic"].default_value = float(spec.get("metalness", 0.25))
        principled.inputs["Roughness"].default_value = float(spec.get("roughness", 0.25))
        principled.inputs["Alpha"].default_value = float(spec.get("opacity", 1.0))
        if "Transmission Weight" in principled.inputs:
            principled.inputs["Transmission Weight"].default_value = float(spec.get("transmission", 0.0))
        if "IOR" in principled.inputs:
            principled.inputs["IOR"].default_value = float(spec.get("ior", 1.45))
        if "Emission Color" in principled.inputs:
            principled.inputs["Emission Color"].default_value = rgba(spec.get("emissionColor", "#6cefff"))
        if "Emission Strength" in principled.inputs:
            principled.inputs["Emission Strength"].default_value = float(spec.get("emissionStrength", 0.0))
    material.surface_render_method = "DITHERED" if float(spec.get("opacity", 1.0)) < 0.999 else "DITHERED"
    return material


def animate_material(material, item: dict):
    preset = item.get("animationPreset", "static")
    if preset != "shimmer" or not material.use_nodes:
        return

    principled = material.node_tree.nodes.get("Principled BSDF")
    if not principled or "Emission Strength" not in principled.inputs:
        return

    emission = principled.inputs["Emission Strength"]
    baseline = max(0.0, float(item["material"].get("emissionStrength", 0.0)))
    emission.default_value = baseline * 0.65
    emission.keyframe_insert(data_path="default_value", frame=1)
    emission.default_value = max(baseline * 1.7, baseline + 0.4)
    emission.keyframe_insert(data_path="default_value", frame=max(2, scene.frame_end // 2))
    emission.default_value = baseline * 0.65
    emission.keyframe_insert(data_path="default_value", frame=scene.frame_end)


def decode_data_image(url: str, stem: str) -> Path | None:
    if not url.startswith("data:image/") or ";base64," not in url:
        return None
    header, encoded = url.split(",", 1)
    mime = header.split(";", 1)[0]
    extension = {
        "data:image/png": ".png",
        "data:image/jpeg": ".jpg",
        "data:image/webp": ".webp",
    }.get(mime)
    if not extension:
        return None
    raw = base64.b64decode(encoded, validate=True)
    if not raw or len(raw) > 20 * 1024 * 1024:
        return None
    path = output_dir / (stem + extension)
    path.write_bytes(raw)
    return path


def apply_transform(obj, transform: dict):
    position = transform["position"]
    rotation = transform["rotation"]
    scale = transform["scale"]
    obj.location = (position["x"], position["y"], position["z"])
    obj.rotation_euler = (rotation["x"], rotation["y"], rotation["z"])
    obj.scale = (scale["x"], scale["y"], scale["z"])


def add_keyframes(obj, item: dict):
    tracks = item.get("animationTracks") or []
    duration = scene_data["timeline"]["durationMs"]
    fps = scene_data["timeline"]["fps"]
    for track in tracks:
        property_name = track["property"]
        path = {
            "position": "location",
            "rotation": "rotation_euler",
            "scale": "scale",
        }[property_name]
        for keyframe in track.get("keyframes", []):
            frame = 1 + round((keyframe["timeMs"] / 1000) * fps)
            value = keyframe["value"]
            setattr(obj, path, (value["x"], value["y"], value["z"]))
            obj.keyframe_insert(data_path=path, frame=frame)
    if tracks:
        apply_transform(obj, item["transform"])
        return

    preset = item.get("animationPreset", "static")
    if preset in {"turntable", "sweep"}:
        start = tuple(obj.rotation_euler)
        obj.keyframe_insert(data_path="rotation_euler", frame=1)
        obj.rotation_euler[1] = start[1] + math.tau
        obj.keyframe_insert(data_path="rotation_euler", frame=scene.frame_end)
    elif preset == "pulse":
        start = tuple(obj.scale)
        obj.keyframe_insert(data_path="scale", frame=1)
        obj.scale = tuple(value * 1.08 for value in start)
        obj.keyframe_insert(data_path="scale", frame=max(2, scene.frame_end // 2))
        obj.scale = start
        obj.keyframe_insert(data_path="scale", frame=scene.frame_end)
    elif preset == "orbit":
        start = tuple(obj.location)
        obj.keyframe_insert(data_path="location", frame=1)
        obj.location[0] = start[0] + 0.5
        obj.location[2] = start[2] + 0.25
        obj.keyframe_insert(data_path="location", frame=max(2, scene.frame_end // 2))
        obj.location = start
        obj.keyframe_insert(data_path="location", frame=scene.frame_end)


def create_object(item: dict):
    kind = item["creationType"]
    geometry = item["geometry"]
    thickness = max(0.02, float(geometry.get("thickness", 0.08)))

    if kind == "holo_text":
        bpy.ops.object.text_add()
        obj = bpy.context.object
        obj.data.body = item.get("sourceText") or item["name"]
        obj.data.align_x = "CENTER"
        obj.data.align_y = "CENTER"
        obj.data.extrude = thickness
        obj.data.bevel_depth = min(float(geometry.get("bevelSize", 0.02)), thickness * 0.5)
        obj.data.size = 1.0
    elif kind == "light_fx":
        bpy.ops.mesh.primitive_torus_add(major_radius=0.9, minor_radius=max(0.025, thickness * 0.18))
        obj = bpy.context.object
    else:
        source_url = geometry.get("sourceUrl") or scene_data.get("source", {}).get("previewUrl")
        image_path = decode_data_image(source_url, item["id"]) if source_url else None
        if image_path:
            bpy.ops.mesh.primitive_cube_add(scale=(1.15, 0.72, max(0.015, thickness / 2)))
            obj = bpy.context.object
            image = bpy.data.images.load(str(image_path))
            material = material_for(item["material"])
            nodes = material.node_tree.nodes
            links = material.node_tree.links
            texture = nodes.new("ShaderNodeTexImage")
            texture.image = image
            principled = nodes.get("Principled BSDF")
            if principled:
                links.new(texture.outputs["Color"], principled.inputs["Base Color"])
                if texture.outputs.get("Alpha"):
                    links.new(texture.outputs["Alpha"], principled.inputs["Alpha"])
            animate_material(material, item)
            obj.data.materials.append(material)
            material = None
        elif kind in {"glass", "chrome", "holo_logo", "holo_graphic"}:
            bpy.ops.mesh.primitive_cube_add(scale=(1.15, 0.72, max(0.015, thickness / 2)))
            obj = bpy.context.object
        else:
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1.0)
            obj = bpy.context.object

    obj.name = item["id"]
    if not obj.data.materials:
        generated_material = material_for(item["material"])
        animate_material(generated_material, item)
        obj.data.materials.append(generated_material)
    apply_transform(obj, item["transform"])
    add_keyframes(obj, item)
    obj.hide_render = not bool(item.get("visible", True))
    return obj


for item in scene_data["objects"]:
    create_object(item)

# Camera
camera_data = bpy.data.cameras.new("HoloForgeCamera")
camera = bpy.data.objects.new("HoloForgeCamera", camera_data)
scene.collection.objects.link(camera)
camera_spec = scene_data["camera"]
camera.location = (
    camera_spec["position"]["x"],
    camera_spec["position"]["y"],
    camera_spec["position"]["z"],
)
camera_data.sensor_width = 36.0
fov_radians = math.radians(float(camera_spec["fov"]))
camera_data.lens = 0.5 * camera_data.sensor_width / math.tan(max(0.01, fov_radians / 2.0))
scene.camera = camera

target = camera_spec["target"]
direction = (
    target["x"] - camera.location.x,
    target["y"] - camera.location.y,
    target["z"] - camera.location.z,
)
camera.rotation_euler = __import__("mathutils").Vector(direction).to_track_quat("-Z", "Y").to_euler()

# Lighting
world = bpy.data.worlds.new("HoloForgeWorld")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = rgba(
    scene_data["environment"].get("background", "#020307")
)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = float(
    scene_data["environment"]["ambientIntensity"]
) * 0.35

for name, location, energy, color in [
    ("Key", (3.5, 4.0, 5.0), scene_data["environment"]["keyLightIntensity"] * 650, (0.75, 0.95, 1.0)),
    ("RimA", (-3.5, 2.0, 2.0), scene_data["environment"]["rimLightIntensity"] * 500, (0.45, 0.25, 1.0)),
    ("RimB", (3.2, -2.0, 1.5), scene_data["environment"]["rimLightIntensity"] * 400, (1.0, 0.25, 0.75)),
]:
    light_data = bpy.data.lights.new(name, "AREA")
    light_data.energy = float(energy)
    light_data.color = color
    light_data.shape = "DISK"
    light_data.size = 3.0
    light = bpy.data.objects.new(name, light_data)
    scene.collection.objects.link(light)
    light.location = location
    light.rotation_euler = (0.5, 0.0, 0.5)

format_name = request["format"]
stem = "".join(char if char.isalnum() or char in "-_" else "-" for char in scene_data["id"]).strip("-")[:100] or "holoforge"

if format_name == "glb":
    target = output_dir / (stem + ".glb")
    bpy.ops.export_scene.gltf(filepath=str(target), export_format="GLB", export_animations=bool(request["includeAnimation"]))
elif format_name == "gltf":
    target = output_dir / (stem + ".gltf")
    bpy.ops.export_scene.gltf(filepath=str(target), export_format="GLTF_EMBEDDED", export_animations=bool(request["includeAnimation"]))
elif format_name == "mp4":
    target = output_dir / (stem + ".mp4")
    scene.render.filepath = str(target)
    scene.render.image_settings.file_format = "FFMPEG"
    scene.render.ffmpeg.format = "MPEG4"
    scene.render.ffmpeg.codec = "H264"
    scene.render.ffmpeg.constant_rate_factor = "MEDIUM"
    bpy.ops.render.render(animation=bool(request["includeAnimation"]))
    if not request["includeAnimation"]:
        still = output_dir / (stem + ".png")
        scene.render.filepath = str(still)
        scene.render.image_settings.file_format = "PNG"
        bpy.ops.render.render(write_still=True)
        target = still
elif format_name == "png-sequence":
    frames = output_dir / "frames"
    frames.mkdir(exist_ok=True)
    scene.render.filepath = str(frames / "frame_")
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    bpy.ops.render.render(animation=True)
    target = output_dir / (stem + "-png-sequence.zip")
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        for frame in sorted(frames.glob("*.png")):
            archive.write(frame, arcname=frame.name)
else:
    raise RuntimeError("Unsupported worker format: " + format_name)

(output_dir / "result.json").write_text(
    json.dumps({"path": str(target.resolve()), "format": format_name}),
    encoding="utf-8",
)
