from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass(frozen=True)
class Vec3:
    x: float
    y: float
    z: float


@dataclass(frozen=True)
class MotionDelta:
    position: Vec3
    rotation: Vec3
    scale: Vec3


ZERO = Vec3(0.0, 0.0, 0.0)
ONE = Vec3(1.0, 1.0, 1.0)


def sample_builtin_motion(preset: str, time_seconds: float) -> MotionDelta:
    """Sample the same built-in motion formulas used by the WebGL viewport."""

    t = max(0.0, float(time_seconds))
    position = ZERO
    rotation = ZERO
    scale = ONE

    if preset == "shimmer":
        rotation = Vec3(
            x=math.cos(t * 0.8) * 0.045,
            y=math.sin(t * 1.25) * 0.18,
            z=0.0,
        )
    elif preset == "sweep":
        rotation = Vec3(0.0, t * 0.34, 0.0)
    elif preset == "pulse":
        pulse = 1.0 + math.sin(t * 2.4) * 0.045
        scale = Vec3(pulse, pulse, pulse)
    elif preset == "turntable":
        rotation = Vec3(0.0, t * 0.5, 0.0)
    elif preset == "orbit":
        position = Vec3(
            x=math.cos(t * 0.55) * 0.32,
            y=0.0,
            z=math.sin(t * 0.55) * 0.18,
        )

    return MotionDelta(position=position, rotation=rotation, scale=scale)


def sampled_motion_frames(
    frame_start: int,
    frame_end: int,
    *,
    max_samples: int = 480,
) -> tuple[int, ...]:
    """Return bounded animation frames while retaining exact per-frame parity for normal clips."""

    start = max(1, int(frame_start))
    end = max(start, int(frame_end))
    if end == start:
        return (start,)

    limit = max(2, int(max_samples))
    span = end - start
    if span + 1 <= limit:
        return tuple(range(start, end + 1))

    step = max(1, math.ceil(span / (limit - 1)))
    frames = list(range(start, end + 1, step))
    if frames[-1] != end:
        frames.append(end)
    return tuple(frames)


def animated_data_path(preset: str) -> str | None:
    if preset in {"shimmer", "sweep", "turntable"}:
        return "rotation_euler"
    if preset == "pulse":
        return "scale"
    if preset == "orbit":
        return "location"
    return None
