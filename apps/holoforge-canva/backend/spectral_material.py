from __future__ import annotations

import colorsys
from dataclasses import dataclass


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def _hue_rgb(hue_degrees: float, saturation: float = 0.88, lightness: float = 0.66) -> tuple[float, float, float, float]:
    hue = (hue_degrees % 360.0) / 360.0
    red, green, blue = colorsys.hls_to_rgb(hue, clamp(lightness), clamp(saturation))
    return (red, green, blue, 1.0)


@dataclass(frozen=True)
class SpectralProfile:
    family: str
    spectral: bool
    ramp: tuple[tuple[float, tuple[float, float, float, float]], ...]
    metallic: float
    roughness: float
    opacity: float
    transmission: float
    ior: float
    emission_strength: float
    coat_weight: float


def build_spectral_profile(spec: dict) -> SpectralProfile:
    family = str(spec.get("family", "metal")).strip().lower() or "metal"
    shift = clamp(float(spec.get("spectralShift", 0.0)) / 100.0)
    diffraction = clamp(float(spec.get("diffraction", 0.0)))
    reflection = clamp(float(spec.get("reflectionStrength", 0.0)) / 100.0)

    metallic = clamp(float(spec.get("metalness", 0.25)))
    roughness = clamp(float(spec.get("roughness", 0.25)), 0.02, 1.0)
    opacity = clamp(float(spec.get("opacity", 1.0)))
    transmission = clamp(float(spec.get("transmission", 0.0)))
    ior = clamp(float(spec.get("ior", 1.45)), 1.0, 2.5)
    emission_strength = max(0.0, float(spec.get("emissionStrength", 0.0)))

    spectral = family in {"iridescent", "foil", "pearl", "neon"} or diffraction >= 0.22
    hue_center = 180.0 + shift * 150.0

    span = 90.0 + diffraction * 170.0
    stops = (
        (0.0, _hue_rgb(hue_center - span * 0.52)),
        (0.22, _hue_rgb(hue_center - span * 0.18)),
        (0.48, _hue_rgb(hue_center + span * 0.12)),
        (0.74, _hue_rgb(hue_center + span * 0.42)),
        (1.0, _hue_rgb(hue_center + span * 0.76)),
    )

    if family == "neon":
        metallic = min(metallic, 0.18)
        roughness = min(roughness, 0.28)
        emission_strength = max(emission_strength, 0.65)
    elif family == "foil":
        metallic = max(metallic, 0.72)
        roughness = min(roughness, 0.24)
    elif family == "pearl":
        metallic = min(metallic, 0.18)
        roughness = max(0.18, min(roughness, 0.42))
    elif family == "glass":
        transmission = max(transmission, 0.52)
        roughness = min(roughness, 0.34)
    elif family == "crystal":
        transmission = max(transmission, 0.38)
        roughness = min(roughness, 0.26)
    elif family == "metal":
        metallic = max(metallic, 0.62)

    coat_weight = clamp(0.18 + reflection * 0.72)

    return SpectralProfile(
        family=family,
        spectral=spectral,
        ramp=stops,
        metallic=metallic,
        roughness=roughness,
        opacity=opacity,
        transmission=transmission,
        ior=ior,
        emission_strength=emission_strength,
        coat_weight=coat_weight,
    )
