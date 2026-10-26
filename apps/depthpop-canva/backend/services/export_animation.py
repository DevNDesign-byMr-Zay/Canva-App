"""Deterministic authored scene sampling for video and glTF exports."""
from models.object import AnimationTrack, DepthObject, ObjectTransform
from models.scene import DepthScene

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


