"""Object transforms and keyframe sampling, independent of worker startup."""
import math
from animation_easing import blender_keyframe_style
from animation_motion import animated_data_path, sample_builtin_motion, sampled_motion_frames

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


def _insert_builtin_motion(obj, item: dict, preset: str, scene, scene_data: dict):
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


def add_keyframes(obj, item: dict, scene, scene_data: dict):
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


