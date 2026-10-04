from __future__ import annotations

import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

import app as depthpop
from auth import VerifiedCanvaUser, verify_canva_user


def _png(size=(48, 48)) -> bytes:
    image = Image.new("RGB", size, (100, 140, 180))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.fixture
def client():
    async def fake_verify():
        return VerifiedCanvaUser(user_id="settings-user", brand_id="settings-brand")

    depthpop.app.dependency_overrides[verify_canva_user] = fake_verify
    try:
        yield TestClient(depthpop.app)
    finally:
        depthpop.app.dependency_overrides.clear()


def _create_and_fetch(client: TestClient, **settings):
    response = client.post(
        "/api/v1/scenes",
        files={"image": ("source.png", _png(), "image/png")},
        data={
            "inpaint": "false",
            **{key: str(value) for key, value in settings.items()},
        },
    )
    assert response.status_code == 200
    job_id = response.json()["jobId"]
    job = client.get(f"/api/v1/jobs/{job_id}")
    assert job.status_code == 200
    scene_id = job.json()["sceneId"]
    assert scene_id
    scene = client.get(f"/api/v1/scenes/{scene_id}")
    assert scene.status_code == 200
    return scene.json()


def test_invalid_render_quality_returns_422(client):
    response = client.post(
        "/api/v1/scenes",
        files={"image": ("source.png", _png(), "image/png")},
        data={"render_quality": "ultra"},
    )
    assert response.status_code == 422


@pytest.mark.parametrize(
    ("quality", "expected_steps"),
    [("fast", 14), ("balanced", 22), ("cinematic", 34)],
)
def test_scene_records_normalized_quality_and_steps(client, quality, expected_steps):
    scene = _create_and_fetch(
        client,
        render_quality=quality,
        depth_strength=0.41,
        depth_blur=57,
        depth_fidelity=0.88,
    )
    assert scene["settings"] == {
        "depthStrength": 0.41,
        "depthBlur": 57,
        "depthFidelity": 0.88,
        "renderQuality": quality,
        "numInferenceSteps": expected_steps,
    }


def test_strength_changes_authored_z_but_not_measured_depth(client):
    weak = _create_and_fetch(
        client,
        render_quality="balanced",
        depth_strength=0.10,
        depth_fidelity=0.95,
    )
    strong = _create_and_fetch(
        client,
        render_quality="balanced",
        depth_strength=0.70,
        depth_fidelity=0.95,
    )

    assert weak["objects"]
    assert strong["objects"]
    weak_object = weak["objects"][0]
    strong_object = strong["objects"][0]
    assert weak_object["depth"] == strong_object["depth"]
    assert abs(weak_object["transform"]["position"]["z"]) < abs(
        strong_object["transform"]["position"]["z"]
    )


def test_quality_controls_depth_lane_and_inpaint_budget(monkeypatch, client):
    captured: list[dict] = []
    original = depthpop.scenes_router.routes if False else None

    from services.scene_builder import SceneBuilderService

    real_build = SceneBuilderService.build_scene

    async def capture_build(self, *args, **kwargs):
        captured.append(dict(kwargs))
        return await real_build(self, *args, **kwargs)

    monkeypatch.setattr(SceneBuilderService, "build_scene", capture_build)

    _create_and_fetch(client, render_quality="fast")
    _create_and_fetch(client, render_quality="balanced")
    _create_and_fetch(client, render_quality="cinematic")

    assert [item["depth_quality"] for item in captured] == [
        "standard",
        "high",
        "high",
    ]
    assert [item["inpaint_steps"] for item in captured] == [14, 22, 34]
