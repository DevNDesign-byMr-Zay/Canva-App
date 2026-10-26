"""Animation and binary output contracts across the internal module boundary."""
import hashlib
import asyncio
import struct

import pytest

from models.object import AnimationKeyframe, AnimationTrack
from test_export_formats import _scene
from services import export_formats as facade
from services import export_animation as animation
from services import export_gltf as gltf


def test_sampling_is_clamped_and_never_mutates_authored_scene():
    scene, _ = _scene()
    original = scene.model_dump()
    assert facade.scene_at_time is animation.scene_at_time
    assert facade.scene_at_time(scene, -99).timeline.currentTimeMs == 0
    sampled = facade.scene_at_time(scene, 5000)
    assert sampled.timeline.currentTimeMs == 1000
    assert sampled.objects[0].transform.position.x == pytest.approx(0.6)
    assert scene.model_dump() == original


@pytest.mark.parametrize('easing,expected', [('linear', .25), ('ease-in', .0625), ('ease-out', .4375), ('ease-in-out', .125)])
def test_animation_easing_and_empty_tracks(easing, expected):
    track = AnimationTrack(id='x', property='position.x', keyframes=[
        AnimationKeyframe(timeMs=0, value=0), AnimationKeyframe(timeMs=1000, value=1, easing=easing),
    ])
    assert animation._track_value(track, 250, -1) == pytest.approx(expected)
    assert animation._track_value(track, -10, -1) == 0
    assert animation._track_value(track, 1500, -1) == 1
    assert animation._track_value(track.model_copy(update={'keyframes': []}), 250, 3) == 3


def test_gltf_facade_produces_identical_binary_and_json(tmp_path):
    scene, assets = _scene()
    original = scene.model_dump()
    async def fetch(url):
        return assets[url]
    assert facade.export_gltf_or_glb is gltf.export_gltf_or_glb
    first = tmp_path / 'first.glb'
    second = tmp_path / 'second.glb'
    for target, export in [(first, facade.export_gltf_or_glb), (second, gltf.export_gltf_or_glb)]:
        path, mime = asyncio.run(export(scene, fetch, target, glb=True, include_animation=True))
        assert path == target
        assert mime == 'model/gltf-binary'
    assert first.read_bytes() == second.read_bytes()
    magic, version, size = struct.unpack('<4sII', first.read_bytes()[:12])
    assert (magic, version, size) == (b'glTF', 2, first.stat().st_size)
    assert scene.model_dump() == original


@pytest.mark.parametrize('glb,expected', [
    (True, 'd15a3f39913109a5ea0ef41ded157a9cac746056a392d2eae0b3f476fa65c5e1'),
    (False, 'eab8433cd7596120ae8627dadc93bc041c0c75bf5541e95eeb70bbd31a31caa1'),
])
def test_export_bytes_match_pre_refactor_main(tmp_path, glb, expected):
    # Captured from main 9aef85f using this authored scene and owned PNG fixtures.
    scene, assets = _scene()
    async def fetch(url):
        return assets[url]
    target = tmp_path / 'golden'
    asyncio.run(facade.export_gltf_or_glb(scene, fetch, target, glb=glb, include_animation=True))
    assert hashlib.sha256(target.read_bytes()).hexdigest() == expected
