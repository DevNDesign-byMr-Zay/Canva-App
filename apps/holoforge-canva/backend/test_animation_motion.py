from __future__ import annotations

import math

from animation_motion import (
    animated_data_path,
    sample_builtin_motion,
    sampled_motion_frames,
)


def test_turntable_matches_webgl_rate() -> None:
    motion = sample_builtin_motion("turntable", 6.0)
    assert motion.rotation.y == 3.0


def test_sweep_matches_webgl_rate() -> None:
    motion = sample_builtin_motion("sweep", 6.0)
    assert math.isclose(motion.rotation.y, 2.04, rel_tol=1e-9)


def test_pulse_matches_webgl_formula() -> None:
    motion = sample_builtin_motion("pulse", math.pi / 4.8)
    assert math.isclose(motion.scale.x, 1.045, rel_tol=1e-6)
    assert motion.scale.x == motion.scale.y == motion.scale.z


def test_orbit_matches_webgl_formula() -> None:
    start = sample_builtin_motion("orbit", 0.0)
    assert math.isclose(start.position.x, 0.32, rel_tol=1e-9)
    assert math.isclose(start.position.z, 0.0, abs_tol=1e-9)

    quarter = sample_builtin_motion("orbit", math.pi / (2 * 0.55))
    assert math.isclose(quarter.position.x, 0.0, abs_tol=1e-9)
    assert math.isclose(quarter.position.z, 0.18, rel_tol=1e-9)


def test_shimmer_matches_webgl_formula() -> None:
    start = sample_builtin_motion("shimmer", 0.0)
    assert math.isclose(start.rotation.x, 0.045, rel_tol=1e-9)
    assert math.isclose(start.rotation.y, 0.0, abs_tol=1e-9)


def test_normal_timeline_preserves_every_frame() -> None:
    frames = sampled_motion_frames(1, 180)
    assert len(frames) == 180
    assert frames[0] == 1
    assert frames[-1] == 180


def test_long_timeline_is_bounded_but_keeps_last_frame() -> None:
    frames = sampled_motion_frames(1, 10000, max_samples=480)
    assert len(frames) <= 481
    assert frames[0] == 1
    assert frames[-1] == 10000


def test_preset_data_path_contract() -> None:
    assert animated_data_path("shimmer") == "rotation_euler"
    assert animated_data_path("sweep") == "rotation_euler"
    assert animated_data_path("turntable") == "rotation_euler"
    assert animated_data_path("pulse") == "scale"
    assert animated_data_path("orbit") == "location"
    assert animated_data_path("static") is None
