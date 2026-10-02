from __future__ import annotations

import pytest

from animation_easing import blender_keyframe_style


@pytest.mark.parametrize(
    ("authored", "interpolation", "easing"),
    [
        ("linear", "LINEAR", None),
        ("ease-in", "QUAD", "EASE_IN"),
        ("ease-out", "QUAD", "EASE_OUT"),
        ("ease-in-out", "QUAD", "EASE_IN_OUT"),
    ],
)
def test_authored_easing_maps_to_blender_curve(
    authored: str,
    interpolation: str,
    easing: str | None,
) -> None:
    style = blender_keyframe_style(authored)
    assert style.interpolation == interpolation
    assert style.easing == easing


def test_unknown_easing_fails_closed() -> None:
    with pytest.raises(ValueError, match="Unsupported HoloForge easing"):
        blender_keyframe_style("elastic")
