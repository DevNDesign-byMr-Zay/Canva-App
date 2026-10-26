"""Embedded sources, alpha silhouettes and image-facing geometry."""
import base64
from pathlib import Path
from source_geometry import normalize_contours, useful_contours

def decode_data_image(url: str, stem: str, output_dir: Path) -> Path | None:
    if not url.startswith("data:image/") or ";base64," not in url:
        return None
    header, encoded = url.split(",", 1)
    mime = header.split(";", 1)[0]
    extension = {
        "data:image/png": ".png",
        "data:image/jpeg": ".jpg",
        "data:image/webp": ".webp",
    }.get(mime)
    if not extension:
        return None
    raw = base64.b64decode(encoded, validate=True)
    if not raw or len(raw) > 20 * 1024 * 1024:
        return None
    path = output_dir / (stem + extension)
    path.write_bytes(raw)
    return path


def source_alpha_geometry(
    image,
    *,
    max_side: int = 192,
    alpha_threshold: float = 0.08,
):
    import bpy

    source_width, source_height = int(image.size[0]), int(image.size[1])
    if source_width <= 0 or source_height <= 0:
        return None

    scale = min(1.0, max_side / max(source_width, source_height))
    width = max(2, round(source_width * scale))
    height = max(2, round(source_height * scale))

    analysis = image.copy()
    try:
        analysis.scale(width, height)
        pixels = list(analysis.pixels[:])
        if len(pixels) < width * height * 4:
            return None

        mask = bytearray(width * height)
        opaque = 0
        for index in range(width * height):
            alpha = float(pixels[index * 4 + 3])
            if alpha >= alpha_threshold:
                mask[index] = 1
                opaque += 1

        coverage = opaque / max(1, width * height)
        if coverage <= 0.002 or coverage >= 0.985:
            return None

        contours = useful_contours(
            mask,
            width,
            height,
            epsilon=1.15,
            max_contours=32,
            minimum_relative_area=0.002,
        )
        if not contours:
            return None

        normalized = normalize_contours(
            contours,
            width,
            height,
            target_width=2.3,
        )
        return {
            "contours": normalized,
            "width": 2.3,
            "height": 2.3 * (source_height / source_width),
            "coverage": coverage,
        }
    finally:
        bpy.data.images.remove(analysis)


def create_extruded_contour_object(
    item: dict,
    alpha_geometry: dict,
    *,
    thickness: float,
    scene,
):
    import bpy

    curve = bpy.data.curves.new(item["id"] + "-silhouette", type="CURVE")
    curve.dimensions = "2D"
    curve.resolution_u = 2
    curve.render_resolution_u = 2
    curve.fill_mode = "BOTH"
    curve.extrude = max(0.01, thickness * 0.5)
    curve.bevel_depth = min(
        max(0.0, float(item["geometry"].get("bevelSize", 0.0))),
        max(0.0, thickness * 0.20),
    )
    curve.bevel_resolution = max(
        0,
        min(4, int(item["geometry"].get("bevelSegments", 2))),
    )

    for contour in alpha_geometry["contours"]:
        if len(contour) < 3:
            continue
        spline = curve.splines.new("POLY")
        spline.points.add(len(contour) - 1)
        for point, source in zip(spline.points, contour):
            point.co = (source.x, source.y, 0.0, 1.0)
        spline.use_cyclic_u = True

    if not curve.splines:
        bpy.data.curves.remove(curve)
        return None

    obj = bpy.data.objects.new(item["id"] + "-silhouette", curve)
    scene.collection.objects.link(obj)
    obj["holoforge_geometry"] = "alpha-extruded"
    obj["holoforge_alpha_coverage"] = float(alpha_geometry["coverage"])

    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.view_layer.objects.active
    if obj is not None:
        obj.name = item["id"]
        obj["holoforge_geometry"] = "alpha-extruded"
        obj["holoforge_alpha_coverage"] = float(alpha_geometry["coverage"])
    return obj


def attach_source_face(
    parent,
    image,
    alpha_geometry: dict,
    *,
    thickness: float,
):
    import bpy

    material = bpy.data.materials.new(parent.name + "-source-face")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    principled = nodes.get("Principled BSDF")
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = image
    if principled:
        links.new(texture.outputs["Color"], principled.inputs["Base Color"])
        if texture.outputs.get("Alpha"):
            links.new(texture.outputs["Alpha"], principled.inputs["Alpha"])
        principled.inputs["Roughness"].default_value = 0.28
        if "Emission Color" in principled.inputs:
            links.new(texture.outputs["Color"], principled.inputs["Emission Color"])
        if "Emission Strength" in principled.inputs:
            principled.inputs["Emission Strength"].default_value = 0.12
    material.surface_render_method = "DITHERED"

    bpy.ops.mesh.primitive_plane_add(
        size=2.0,
        location=(0.0, 0.0, max(0.012, thickness + 0.014)),
    )
    face = bpy.context.object
    face.name = parent.name + "-source-face"
    face.scale = (
        float(alpha_geometry["width"]) / 2.0,
        float(alpha_geometry["height"]) / 2.0,
        1.0,
    )
    face.data.materials.append(material)
    face.parent = parent
    return face


