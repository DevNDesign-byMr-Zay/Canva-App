from __future__ import annotations

import base64
import colorsys
import json
import math
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from blender_materials import material_for, animate_material
from blender_geometry import decode_data_image, source_alpha_geometry, create_extruded_contour_object, attach_source_face
from blender_animation import apply_transform, add_keyframes

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
        image_path = decode_data_image(source_url, item["id"], output_dir) if source_url else None
        if image_path:
            image = bpy.data.images.load(str(image_path))
            alpha_geometry = source_alpha_geometry(image)

            if alpha_geometry:
                obj = create_extruded_contour_object(
                    item,
                    alpha_geometry,
                    thickness=thickness, scene=scene,
                )
                if obj is None:
                    alpha_geometry = None

            if alpha_geometry:
                material = material_for(item["material"])
                animate_material(material, item, scene)
                obj.data.materials.append(material)
                attach_source_face(
                    obj,
                    image,
                    alpha_geometry,
                    thickness=thickness,
                )
                material = None
            else:
                source_width, source_height = int(image.size[0]), int(image.size[1])
                aspect = source_height / max(1, source_width)
                plate_height = max(0.35, min(2.2, 2.3 * aspect))
                bpy.ops.mesh.primitive_cube_add(
                    scale=(1.15, plate_height / 2.0, max(0.015, thickness / 2))
                )
                obj = bpy.context.object
                obj["holoforge_geometry"] = "plate-fallback"
                bpy.context.view_layer.objects.active = obj
                obj.select_set(True)
                bpy.ops.object.transform_apply(
                    location=False,
                    rotation=False,
                    scale=True,
                )

                material = material_for(item["material"])
                animate_material(material, item, scene)
                obj.data.materials.append(material)
                attach_source_face(
                    obj,
                    image,
                    {
                        "width": 2.3,
                        "height": plate_height,
                        "coverage": 1.0,
                    },
                    thickness=thickness,
                )
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
        animate_material(generated_material, item, scene)
        obj.data.materials.append(generated_material)
    apply_transform(obj, item["transform"])
    add_keyframes(obj, item, scene, scene_data)
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
camera_target = (
    float(target["x"]),
    float(target["y"]),
    float(target["z"]),
)
camera_base_location = (
    float(camera.location.x),
    float(camera.location.y),
    float(camera.location.z),
)

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


def authored_current_frame():
    timeline = scene_data["timeline"]
    frame = 1 + round(
        (float(timeline.get("currentTimeMs", 0)) / 1000.0)
        * float(timeline["fps"])
    )
    return max(scene.frame_start, min(scene.frame_end, frame))


if not bool(request.get("includeAnimation", False)):
    scene.frame_set(authored_current_frame())

format_name = request["format"]
stem = "".join(char if char.isalnum() or char in "-_" else "-" for char in scene_data["id"]).strip("-")[:100] or "holoforge"

if format_name == "glb":
    target = output_dir / (stem + ".glb")
    bpy.ops.export_scene.gltf(filepath=str(target), export_format="GLB", export_animations=bool(request["includeAnimation"]))
elif format_name == "gltf":
    target = output_dir / (stem + ".gltf")
    gltf_addon = bpy.context.preferences.addons.get("io_scene_gltf2")
    if gltf_addon is not None:
        gltf_preferences = gltf_addon.preferences
        if hasattr(gltf_preferences, "allow_embedded_format"):
            gltf_preferences.allow_embedded_format = True
    bpy.ops.export_scene.gltf(
        filepath=str(target),
        export_format="GLTF_EMBEDDED",
        export_animations=bool(request["includeAnimation"]),
    )
    if not target.is_file() or target.stat().st_size <= 0:
        raise RuntimeError("Blender produced no embedded glTF artifact")
elif format_name == "usdz":
    target = output_dir / (stem + ".usdz")
    bpy.ops.wm.usd_export(
        filepath=str(target),
        export_animation=bool(request["includeAnimation"]),
        root_prim_path="/HoloForge",
        relative_paths=True,
    )
    if not target.is_file() or target.stat().st_size <= 0:
        raise RuntimeError("Blender produced no USDZ artifact")
elif format_name == "png-still":
    target = output_dir / (stem + "-still.png")
    current_frame = authored_current_frame()
    scene.frame_set(current_frame)
    scene.render.filepath = str(target)
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = (
        "RGBA" if request.get("transparentBackground") else "RGB"
    )
    scene.render.image_settings.color_depth = "8"
    bpy.ops.render.render(write_still=True)
    if not target.is_file() or target.stat().st_size <= 0:
        raise RuntimeError("Blender produced no static PNG artifact")
elif format_name == "webm-alpha":
    frames = output_dir / "webm-alpha-frames"
    frames.mkdir(exist_ok=True)
    scene.render.film_transparent = True
    scene.render.filepath = str(frames / "frame_")
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    bpy.ops.render.render(animation=True)

    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg is required for webm-alpha export")

    target = output_dir / (stem + ".webm")
    command = [
        ffmpeg,
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-framerate",
        str(scene.render.fps),
        "-start_number",
        str(scene.frame_start),
        "-i",
        str(frames / "frame_%04d.png"),
        "-an",
        "-c:v",
        "libvpx-vp9",
        "-pix_fmt",
        "yuva420p",
        "-auto-alt-ref",
        "0",
        "-b:v",
        "0",
        "-crf",
        "24",
        str(target),
    ]
    completed = subprocess.run(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=300,
        check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(
            "ffmpeg alpha WebM encode failed: " + completed.stderr[-3000:]
        )
    if not target.is_file() or target.stat().st_size <= 0:
        raise RuntimeError("ffmpeg produced no alpha WebM artifact")
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
elif format_name == "lightfield-quilt":
    quilt = request.get("quilt") or {}
    columns = int(quilt["columns"])
    rows = int(quilt["rows"])
    views = int(quilt["views"])
    view_aspect = float(quilt["viewAspect"])
    view_cone = float(quilt["viewConeDegrees"])

    width = int(request["resolution"]["width"])
    height = int(request["resolution"]["height"])
    if width % columns != 0 or height % rows != 0:
        raise RuntimeError("quilt resolution must divide evenly into its tile grid")

    tile_width = width // columns
    tile_height = height // rows
    actual_aspect = tile_width / max(1, tile_height)
    if abs(actual_aspect - view_aspect) > 0.02:
        raise RuntimeError(
            "quilt viewAspect does not match the requested resolution/grid"
        )

    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg is required for lightfield-quilt export")

    views_dir = output_dir / "lightfield-views"
    views_dir.mkdir(exist_ok=True)

    # The quilt convention used here stores the left-most view at bottom-left
    # and advances left-to-right, bottom-to-top. FFmpeg tiles top-to-bottom,
    # so each output slot maps back into that canonical view ordering.
    base_x, base_y, base_z = camera_base_location
    target_x, target_y, target_z = camera_target
    rel_x = base_x - target_x
    rel_y = base_y - target_y
    rel_z = base_z - target_z

    scene.render.resolution_x = tile_width
    scene.render.resolution_y = tile_height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA" if request.get("transparentBackground") else "RGB"
    scene.render.image_settings.color_depth = "8"

    source_frame_start = scene.frame_start
    source_frame_end = scene.frame_end
    current_frame = authored_current_frame()
    scene.frame_set(current_frame)

    # Freeze the authored scene at its selected timeline time. Quilt frames are
    # camera views, not animation frames, so object/material animation must not
    # advance while the camera walks through the view cone.
    frozen_objects = []
    for obj in scene.objects:
        if obj == camera:
            continue
        frozen_objects.append((obj, obj.matrix_world.copy()))
    for obj, matrix in frozen_objects:
        obj.animation_data_clear()
        obj.matrix_world = matrix

    for material in bpy.data.materials:
        if material.node_tree and material.node_tree.animation_data:
            material.node_tree.animation_data_clear()

    camera.animation_data_clear()
    scene.frame_start = 1
    scene.frame_end = views

    for slot_index in range(views):
        row_from_top = slot_index // columns
        column = slot_index % columns
        view_index = (rows - 1 - row_from_top) * columns + column

        fraction = view_index / max(1, views - 1)
        angle = math.radians((-view_cone / 2.0) + view_cone * fraction)
        cosine = math.cos(angle)
        sine = math.sin(angle)

        rotated_x = rel_x * cosine + rel_z * sine
        rotated_z = -rel_x * sine + rel_z * cosine
        camera.location = (
            target_x + rotated_x,
            target_y + rel_y,
            target_z + rotated_z,
        )

        view_direction = __import__("mathutils").Vector(
            (
                target_x - camera.location.x,
                target_y - camera.location.y,
                target_z - camera.location.z,
            )
        )
        camera.rotation_euler = view_direction.to_track_quat("-Z", "Y").to_euler()

        render_frame = slot_index + 1
        camera.keyframe_insert(data_path="location", frame=render_frame)
        camera.keyframe_insert(data_path="rotation_euler", frame=render_frame)

    # Prevent Blender from interpolating between adjacent discrete quilt views.
    if camera.animation_data and camera.animation_data.action:
        for fcurve in camera.animation_data.action.fcurves:
            for keyframe in fcurve.keyframe_points:
                keyframe.interpolation = "CONSTANT"

    scene.render.filepath = str(views_dir / "slot_")
    bpy.ops.render.render(animation=True)

    aspect_text = f"{view_aspect:.5f}".rstrip("0").rstrip(".")
    target = output_dir / (
        f"{stem}_qs{columns}x{rows}a{aspect_text}.png"
    )
    tile_filter = (
        f"tile={columns}x{rows}:nb_frames={views}:padding=0:margin=0"
    )
    completed = subprocess.run(
        [
            ffmpeg,
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-framerate",
            "1",
            "-start_number",
            "1",
            "-i",
            str(views_dir / "slot_%04d.png"),
            "-vf",
            tile_filter,
            "-frames:v",
            "1",
            str(target),
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=300,
        check=False,
    )
    if completed.returncode != 0:
        raise RuntimeError(
            "ffmpeg light-field quilt assembly failed: "
            + completed.stderr[-3000:]
        )
    if not target.is_file() or target.stat().st_size <= 0:
        raise RuntimeError("ffmpeg produced no light-field quilt artifact")
else:
    raise RuntimeError("Unsupported worker format: " + format_name)

(output_dir / "result.json").write_text(
    json.dumps({"path": str(target.resolve()), "format": format_name, "frame": int(scene.frame_current)}),
    encoding="utf-8",
)
