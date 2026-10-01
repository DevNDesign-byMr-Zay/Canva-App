from __future__ import annotations

from spectral_material import build_spectral_profile


def test_prism_foil_builds_bounded_spectral_ramp() -> None:
    profile = build_spectral_profile(
        {
            "family": "foil",
            "spectralShift": 100,
            "diffraction": 0.72,
            "reflectionStrength": 80,
            "metalness": 0.4,
            "roughness": 0.5,
            "opacity": 1.0,
            "transmission": 0.0,
            "ior": 1.1,
            "emissionStrength": 0.2,
        }
    )

    assert profile.spectral is True
    assert len(profile.ramp) == 5
    assert profile.metallic >= 0.72
    assert profile.roughness <= 0.24
    assert 0.0 <= profile.coat_weight <= 1.0
    assert all(0.0 <= channel <= 1.0 for _, color in profile.ramp for channel in color)


def test_neon_forces_emissive_nonmetal_profile() -> None:
    profile = build_spectral_profile(
        {
            "family": "neon",
            "spectralShift": 90,
            "diffraction": 0.4,
            "reflectionStrength": 20,
            "metalness": 0.9,
            "roughness": 0.8,
            "opacity": 0.84,
            "emissionStrength": 0.1,
        }
    )

    assert profile.spectral is True
    assert profile.metallic <= 0.18
    assert profile.roughness <= 0.28
    assert profile.emission_strength >= 0.65
    assert profile.opacity == 0.84


def test_glass_prioritizes_transmission_without_forcing_spectral() -> None:
    profile = build_spectral_profile(
        {
            "family": "glass",
            "spectralShift": 20,
            "diffraction": 0.1,
            "reflectionStrength": 50,
            "metalness": 0.0,
            "roughness": 0.6,
            "opacity": 0.7,
            "transmission": 0.2,
            "ior": 1.45,
            "emissionStrength": 0.0,
        }
    )

    assert profile.spectral is False
    assert profile.transmission >= 0.52
    assert profile.roughness <= 0.34
    assert 1.0 <= profile.ior <= 2.5


def test_values_are_clamped_to_safe_renderer_ranges() -> None:
    profile = build_spectral_profile(
        {
            "family": "metal",
            "spectralShift": 500,
            "diffraction": 4,
            "reflectionStrength": 900,
            "metalness": 4,
            "roughness": -2,
            "opacity": 5,
            "transmission": -3,
            "ior": 99,
            "emissionStrength": -1,
        }
    )

    assert 0.0 <= profile.metallic <= 1.0
    assert 0.02 <= profile.roughness <= 1.0
    assert 0.0 <= profile.opacity <= 1.0
    assert 0.0 <= profile.transmission <= 1.0
    assert 1.0 <= profile.ior <= 2.5
    assert 0.0 <= profile.coat_weight <= 1.0
    assert profile.emission_strength == 0.0
