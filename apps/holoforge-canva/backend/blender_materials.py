"""Blender material construction and emission animation."""
import colorsys
import re
from spectral_material import build_spectral_profile

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
    import bpy

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


def animate_material(material, item: dict, scene):
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


