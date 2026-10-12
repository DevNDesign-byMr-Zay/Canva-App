from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

HoloEasing = Literal["linear", "ease-in", "ease-out", "ease-in-out"]


@dataclass(frozen=True)
class BlenderKeyframeStyle:
    interpolation: str
    easing: str | None


def blender_keyframe_style(easing: HoloEasing | str) -> BlenderKeyframeStyle:
    """Map the HoloScene easing contract onto Blender's FCurve keyframe model.

    HoloForge's authored ease-in/ease-out/ease-in-out curves are quadratic.
    Blender's QUAD interpolation with the matching easing mode preserves that
    intent more faithfully than the previous default BEZIER interpolation.
    """

    if easing == "linear":
        return BlenderKeyframeStyle(interpolation="LINEAR", easing=None)
    if easing == "ease-in":
        return BlenderKeyframeStyle(interpolation="QUAD", easing="EASE_IN")
    if easing == "ease-out":
        return BlenderKeyframeStyle(interpolation="QUAD", easing="EASE_OUT")
    if easing == "ease-in-out":
        return BlenderKeyframeStyle(interpolation="QUAD", easing="EASE_IN_OUT")
    raise ValueError(f"Unsupported HoloForge easing: {easing}")
