from __future__ import annotations

import math
import pytest

from animation_easing import blender_keyframe_style
from animation_motion import sample_builtin_motion, sampled_motion_frames


def test_preset_motion_turntable():
    motion = sample_builtin_motion("turntable", 6.0)
    assert pytest.approx(motion.rotation.y, abs=1e-6) == 3.0


def test_preset_motion_sweep():
    motion = sample_builtin_motion("sweep", 6.0)
    assert pytest.approx(motion.rotation.y, abs=1e-6) == 2.04


def test_preset_motion_pulse():
    motion = sample_builtin_motion("pulse", Math_PI := math.pi / 4.8)
    assert pytest.approx(motion.scale.x, abs=1e-5) == 1.045
    assert motion.scale.x == motion.scale.y == motion.scale.z


def test_preset_motion_orbit():
    m0 = sample_builtin_motion("orbit", 0.0)
    assert pytest.approx(m0.position.x, abs=1e-6) == 0.32
    assert pytest.approx(m0.position.z, abs=1e-6) == 0.0

    quarter = sample_builtin_motion("orbit", math.pi / (2 * 0.55))
    assert pytest.approx(quarter.position.x, abs=1e-5) == 0.0
    assert pytest.approx(quarter.position.z, abs=1e-5) == 0.18


def test_blender_keyframe_style_mapping():
    assert blender_keyframe_style("linear").interpolation == "LINEAR"
    assert blender_keyframe_style("ease-in").easing == "EASE_IN"
    assert blender_keyframe_style("ease-out").easing == "EASE_OUT"
    assert blender_keyframe_style("ease-in-out").easing == "EASE_IN_OUT"


def test_sampled_motion_frames_bounds():
    # Short clip keeps per-frame parity
    short_frames = sampled_motion_frames(1, 100, max_samples=480)
    assert len(short_frames) == 100
    assert short_frames[0] == 1
    assert short_frames[-1] == 100

    # Long clip is bounded by max_samples
    long_frames = sampled_motion_frames(1, 10000, max_samples=480)
    assert len(long_frames) <= 481
    assert long_frames[0] == 1
    assert long_frames[-1] == 10000
