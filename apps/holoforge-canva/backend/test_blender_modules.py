"""Pure Blender worker helpers remain testable without importing/running bpy."""
from types import SimpleNamespace

import pytest

from blender_materials import rgba, animate_material
from blender_animation import apply_transform, add_keyframes
from blender_geometry import decode_data_image


def test_color_parsing_preserves_hex_hsl_and_fallback():
    assert rgba('#abc') == pytest.approx((170/255, 187/255, 204/255, 1))
    assert rgba('hsl(120 100% 50%)') == pytest.approx((0, 1, 0, 1))
    assert rgba('invalid') == (0.35, 0.8, 1.0, 1.0)


def test_embedded_image_decode_stays_within_output_directory(tmp_path):
    path = decode_data_image('data:image/png;base64,aGVsbG8=', 'source', tmp_path)
    assert path == tmp_path / 'source.png'
    assert path.read_bytes() == b'hello'
    assert decode_data_image('https://example.com/file', 'source', tmp_path) is None
    assert decode_data_image('data:image/gif;base64,aGVsbG8=', 'source', tmp_path) is None


def test_authored_keyframes_restore_object_pose():
    obj = SimpleNamespace(location=None, rotation_euler=None, scale=None)
    frames = []
    obj.keyframe_insert = lambda **kw: frames.append((kw, obj.location))
    transform = {key: dict(x=1, y=2, z=3) for key in ['position', 'rotation', 'scale']}
    item = {'transform': transform, 'animationTracks': [{'property': 'position', 'keyframes': [
        {'timeMs': 500, 'value': {'x': 4, 'y': 5, 'z': 6}},
    ]}]}
    apply_transform(obj, transform)
    add_keyframes(obj, item, SimpleNamespace(frame_end=30), {'timeline': {'durationMs': 1000, 'fps': 30}})
    assert frames == [({'data_path': 'location', 'frame': 16}, (4, 5, 6))]
    assert obj.location == (1, 2, 3)


def test_shimmer_material_inserts_bounded_emission_keyframes():
    values = []
    emission = SimpleNamespace(default_value=0)
    emission.keyframe_insert = lambda **kw: values.append((kw['frame'], emission.default_value))
    principled = SimpleNamespace(inputs={'Emission Strength': emission})
    material = SimpleNamespace(use_nodes=True, node_tree=SimpleNamespace(nodes={'Principled BSDF': principled}))
    animate_material(material, {'animationPreset': 'shimmer', 'material': {'emissionStrength': 2}}, SimpleNamespace(frame_end=30))
    assert values == [(1, 1.3), (15, 3.4), (30, 1.3)]


def test_worker_passes_only_supported_geometry_arguments():
    import ast
    import inspect
    from pathlib import Path
    from blender_geometry import create_extruded_contour_object, attach_source_face
    contracts = {function.__name__: inspect.signature(function) for function in [
        create_extruded_contour_object, attach_source_face,
    ]}
    tree = ast.parse(Path(__file__).with_name('blender_worker.py').read_text())
    for call in ast.walk(tree):
        if isinstance(call, ast.Call) and isinstance(call.func, ast.Name) and call.func.id in contracts:
            contracts[call.func.id].bind(*[None for arg in call.args], **{kw.arg: None for kw in call.keywords})
