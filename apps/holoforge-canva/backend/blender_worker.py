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
from animation_easing import blender_keyframe_style
from animation_motion import animated_data_path, sample_builtin_motion, sampled_motion_frames
from source_geometry import normalize_contours, useful_contours
from spectral_material import build_spectral_profile

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
    profile = build_spectral_profile(spec)
    material = bpy.data.materials.new("HoloForgeMaterial")
    material.use_nodes = True
    material["holoforge_family"] = profile.family
    material["holoforge_spectral"] = bool(profile.spectral)
    material["holoforge_diffraction"] = float(spec.get("diffraction", 0.0))
    material["holoforge_spectral_shift"] = float(spec.get("spectralShift", 0.0))

    nodes = material.node_tree.nodes
    links = material.node_tree.links
    principled = nodes.get("Principled BSDF")
    if principled:
        principled.inputs["Base Color"].default_value = rgba(spec.get("baseColor", "#5cecff"))
        principled.inputs["Metallic"].default_value = profile.metallic
        principled.inputs["Roughness"].default_value = profile.roughness
        principled.inputs["Alpha"].default_value = profile.opacity
        if "Transmission Weight" in principled.inputs:
            principled.inputs["Transmission Weight"].default_value = profile.transmission
        if "IOR" in principled.inputs:
            principled.inputs["IOR"].default_value = profile.ior
        if "Coat Weight" in principled.inputs:
            principled.inputs["Coat Weight"].default_value = profile.coat_weight
        if "Coat Roughness" in principled.inputs:
            principled.inputs["Coat Roughness"].default_value = max(0.02, profile.roughness * 0.55)
        if "Emission Color" in principled.inputs:
            principled.inputs["Emission Color"].default_value = rgba(spec.get("emissionColor", "#6cefff"))
        if "Emission Strength" in principled.inputs:
            principled.inputs["Emission Strength"].default_value = profile.emission_strength

        if profile.spectral:
            layer_weight = nodes.new("ShaderNodeLayerWeight")
            layer_weight.name = "HoloForge View Angle"
            layer_weight.inputs["Blend"].default_value = 0.38

            spectrum = nodes.new("ShaderNodeValToRGB")
            spectrum.name = "HoloForge Spectrum"
            spectrum.color_ramp.interpolation = "EASE"

            first = spectrum.color_ramp.elements[0]
            last = spectrum.color_ramp.elements[1]
            first.position = profile.ramp[0][0]
            first.color = profile.ramp[0][1]
            last.position = profile.ramp[-1][0]
            last.color = profile.ramp[-1][1]

            for position, color in profile.ramp[1:-1]:
                stop = spectrum.color_ramp.elements.new(position)
                stop.color = color

            links.new(layer_weight.outputs["Facing"], spectrum.inputs["Fac"])
            links.new(spectrum.outputs["Color"], principled.inputs["Base Color"])
            if "Emission Color" in principled.inputs:
                links.new(spectrum.outputs["Color"], principled.inputs["Emission Color"])

    material.surface_render_method = "DITHERED"
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


def source_alpha_geometry(
    image,
    *,
    max_side: int = 192,
    alpha_threshold: float = 0.08,
):
    source_width, source_height = int(image.size[0]), int(image.size[1])
    if source_width <= 0 or source_height <= 0:
        return None

    scale = min(1.0, max_side / max(source_width, source_height))
    width = max(2, round(source_width * scale))
    height = max(2, round(source_height * scale))

    analysis = image.copy()
    try:
        analysis.scale(width, height)
        pixels = list(analysis.pixels[:])
        if len(pixels) < width * height * 4:
            return None

        mask = bytearray(width * height)
        opaque = 0
        for index in range(width * height):
            alpha = float(pixels[index * 4 + 3])
            if alpha >= alpha_threshold:
                mask[index] = 1
                opaque += 1

        coverage = opaque / max(1, width * height)
        if coverage <= 0.002 or coverage >= 0.985:
            return None

        contours = useful_contours(
            mask,
            width,
            height,
            epsilon=1.15,
            max_contours=32,
            minimum_relative_area=0.002,
        )
        if not contours:
            return None

        normalized = normalize_contours(
            contours,
            width,
            height,
            target_width=2.3,
        )
        return {
            "contours": normalized,
            "width": 2.3,
            "height": 2.3 * (source_height / source_width),
            "coverage": coverage,
        }
    finally:
        bpy.data.images.remove(analysis)


def create_extruded_contour_object(
    item: dict,
    alpha_geometry: dict,
    *,
    thickness: float,
):
    curve = bpy.data.curves.new(item["id"] + "-silhouette", type="CURVE")
    curve.dimensions = "2D"
    curve.resolution_u = 2
    curve.render_resolution_u = 2
    curve.fill_mode = "BOTH"
    curve.extrude = max(0.01, thickness * 0.5)
    curve.bevel_depth = min(
        max(0.0, float(item["geometry"].get("bevelSize", 0.0))),
        max(0.0, thickness * 0.20),
    )
    curve.bevel_resolution = max(
        0,
        min(4, int(item["geometry"].get("bevelSegments", 2))),
    )

    for contour in alpha_geometry["contours"]:
        if len(contour) < 3:
            continue
        spline = curve.splines.new("POLY")
        spline.points.add(len(contour) - 1)
        for point, source in zip(spline.points, contour):
            point.co = (source.x, source.y, 0.0, 1.0)
        spline.use_cyclic_u = True

    if not curve.splines:
        bpy.data.curves.remove(curve)
        return None

    obj = bpy.data.objects.new(item["id"] + "-silhouette", curve)
    scene.collection.objects.link(obj)
    obj["holoforge_geometry"] = "alpha-extruded"
    obj["holoforge_alpha_coverage"] = float(alpha_geometry["coverage"])

    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.view_layer.objects.active
    if obj is not None:
        obj.name = item["id"]
        obj["holoforge_geometry"] = "alpha-extruded"
        obj["holoforge_alpha_coverage"] = float(alpha_geometry["coverage"])
    return obj


def attach_source_face(
    parent,
    image,
    alpha_geometry: dict,
    *,
    thickness: float,
    material_spec: dict,
):
    profile = build_spectral_profile(material_spec)
    material = bpy.data.materials.new(parent.name + "-source-face")
    material.use_nodes = True
    material["holoforge_source_face"] = True
    material["holoforge_source_opacity"] = float(profile.opacity)

    nodes = material.node_tree.nodes
    links = material.node_tree.links
    principled = nodes.get("Principled BSDF")
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = image

    if principled:
        links.new(texture.outputs["Color"], principled.inputs["Base Color"])
        principled.inputs["Metallic"].default_value = 0.0
        principled.inputs["Roughness"].default_value = 0.42

        alpha_output = texture.outputs.get("Alpha")
        if alpha_output:
            alpha_multiply = nodes.new("ShaderNodeMath")
            alpha_multiply.operation = "MULTIPLY"
            alpha_multiply.inputs[1].default_value = max(
                0.0,
                min(1.0, float(profile.opacity) * 0.96),
            )
            links.new(alpha_output, alpha_multiply.inputs[0])
            links.new(alpha_multiply.outputs[0], principled.inputs["Alpha"])
        else:
            principled.inputs["Alpha"].default_value = max(
                0.0,
                min(1.0, float(profile.opacity) * 0.96),
            )

        if "Emission Color" in principled.inputs:
            links.new(texture.outputs["Color"], principled.inputs["Emission Color"])
        if "Emission Strength" in principled.inputs:
            # Browser source faces are unlit mesh-basic overlays. A modest
            # emission contribution keeps the Blender face readable without
            # overpowering the spectral shell beneath it.
            principled.inputs["Emission Strength"].default_value = 0.35

    material.surface_render_method = "DITHERED"

    bpy.ops.mesh.primitive_plane_add(
        size=2.0,
        location=(0.0, 0.0, max(0.012, thickness + 0.014)),
    )
    face = bpy.context.object
    face.name = parent.name + "-source-face"
    face.scale = (
        float(alpha_geometry["width"]) / 2.0,
        float(alpha_geometry["height"]) / 2.0,
        1.0,
    )
    face.data.materials.append(material)
    face.parent = parent
    return face


def apply_transform(obj, transform: dict):
    position = transform["position"]
    rotation = transform["rotation"]
    scale = transform["scale"]
    obj.location = (position["x"], position["y"], position["z"])
    obj.rotation_euler = (rotation["x"], rotation["y"], rotation["z"])
    obj.scale = (scale["x"], scale["y"], scale["z"])


def _style_keyframe_segment(obj, data_path: str, frame: int, easing: str):
    if not obj.animation_data or not obj.animation_data.action:
        return

    style = blender_keyframe_style(easing)
    for fcurve in obj.animation_data.action.fcurves:
        if fcurve.data_path != data_path:
            continue
        for point in fcurve.keyframe_points:
            if abs(float(point.co.x) - float(frame)) > 0.25:
                continue
            point.interpolation = style.interpolation
            if style.easing is not None and hasattr(point, "easing"):
                point.easing = style.easing


def _insert_builtin_motion(obj, item: dict, preset: str):
    data_path = animated_data_path(preset)
    if data_path is None:
        return

    fps = float(scene_data["timeline"]["fps"])
    base_position = tuple(float(value) for value in obj.location)
    base_rotation = tuple(float(value) for value in obj.rotation_euler)
    base_scale = tuple(float(value) for value in obj.scale)

    for frame in sampled_motion_frames(scene.frame_start, scene.frame_end):
        time_seconds = max(0.0, (frame - 1) / max(1.0, fps))
        motion = sample_builtin_motion(preset, time_seconds)

        if data_path == "location":
            obj.location = (
                base_position[0] + motion.position.x,
                base_position[1] + motion.position.y,
                base_position[2] + motion.position.z,
            )
        elif data_path == "rotation_euler":
            obj.rotation_euler = (
                base_rotation[0] + motion.rotation.x,
                base_rotation[1] + motion.rotation.y,
                base_rotation[2] + motion.rotation.z,
            )
        elif data_path == "scale":
            obj.scale = (
                base_scale[0] * motion.scale.x,
                base_scale[1] * motion.scale.y,
                base_scale[2] * motion.scale.z,
            )

        obj.keyframe_insert(data_path=data_path, frame=frame)

    if obj.animation_data and obj.animation_data.action:
        for fcurve in obj.animation_data.action.fcurves:
            if fcurve.data_path != data_path:
                continue
            for point in fcurve.keyframe_points:
                point.interpolation = "LINEAR"

    apply_transform(obj, item["transform"])


def add_keyframes(obj, item: dict):
    tracks = item.get("animationTracks") or []
    fps = float(scene_data["timeline"]["fps"])

    for track in tracks:
        property_name = track["property"]
        path = {
            "position": "location",
            "rotation": "rotation_euler",
            "scale": "scale",
        }[property_name]
        keyframes = list(track.get("keyframes", []))

        for keyframe in keyframes:
            frame = 1 + round((keyframe["timeMs"] / 1000) * fps)
            value = keyframe["value"]
            setattr(obj, path, (value["x"], value["y"], value["z"]))
            obj.keyframe_insert(data_path=path, frame=frame)

        # HoloForge's frontend applies the RIGHT keyframe's easing to the
        # segment leading into it. Blender stores segment interpolation on the
        # LEFT keyframe, so map each authored right-hand easing onto its left
        # FCurve point.
        for index in range(len(keyframes) - 1):
            left = keyframes[index]
            right = keyframes[index + 1]
            left_frame = 1 + round((left["timeMs"] / 1000) * fps)
            _style_keyframe_segment(
                obj,
                path,
                left_frame,
                str(right.get("easing", "ease-in-out")),
            )

    if tracks:
        apply_transform(obj, item["transform"])
        return

    _insert_builtin_motion(
        obj,
        item,
        str(item.get("animationPreset", "static")),
    )


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
            image = bpy.data.images.load(str(image_path))
            alpha_geometry = source_alpha_geometry(image)

            if alpha_geometry:
                obj = create_extruded_contour_object(
                    item,
                    alpha_geometry,
                    thickness=thickness,
                )
                if obj is None:
                    alpha_geometry = None

            if alpha_geometry:
                material = material_for(item["material"])
                animate_material(material, item)
                obj.data.materials.append(material)
                attach_source_face(
                    obj,
                    image,
                    alpha_geometry,
                    thickness=thickness,
                    material_spec=item["material"],
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

                # Bake the primitive dimensions before parenting the source
                # overlay so the face inherits only the authored HoloObject
                # transform, not the primitive's construction scale.
                bpy.context.view_layer.objects.active = obj
                obj.select_set(True)
                bpy.ops.object.transform_apply(
                    location=False,
                    rotation=False,
                    scale=True,
                )

                material = material_for(item["material"])
                animate_material(material, item)
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
                    material_spec=item["material"],
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

format_name = request["format"]
stem = "".join(char if char.isalnum() or char in "-_" else "-" for char in scene_data["id"]).strip("-")[:100] or "holoforge"

if format_name == "glb":
    target = output_dir / (stem + ".glb")
    bpy.ops.export_scene.gltf(filepath=str(target), export_format="GLB", export_animations=bool(request["includeAnimation"]))
elif format_name == "gltf":
    target = output_dir / (stem + ".gltf")
    bpy.ops.export_scene.gltf(filepath=str(target), export_format="GLTF_EMBEDDED", export_animations=bool(request["includeAnimation"]))
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
    timeline = scene_data["timeline"]
    current_frame = 1 + round(
        (float(timeline.get("currentTimeMs", 0)) / 1000.0)
        * float(timeline["fps"])
    )
    current_frame = max(scene.frame_start, min(scene.frame_end, current_frame))
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

    timeline = scene_data["timeline"]
    source_frame_start = scene.frame_start
    source_frame_end = scene.frame_end
    current_frame = 1 + round(
        (float(timeline.get("currentTimeMs", 0)) / 1000.0)
        * float(timeline["fps"])
    )
    current_frame = max(source_frame_start, min(source_frame_end, current_frame))
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
    json.dumps({"path": str(target.resolve()), "format": format_name}),
    encoding="utf-8",
)
