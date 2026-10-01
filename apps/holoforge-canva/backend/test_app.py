import time

from fastapi.testclient import TestClient

import app as module
from auth import VerifiedCanvaUser
from test_models import request_payload, scene_payload


def user_one():
    return VerifiedCanvaUser(user_id="user-1", brand_id="brand-1")


def user_two():
    return VerifiedCanvaUser(user_id="user-2", brand_id="brand-2")


def make_submission(format_name="scene-json"):
    return {
        "scene": scene_payload(),
        "request": request_payload(format_name),
    }


def wait_for_job(client, job_id, timeout=3.0):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        response = client.get("/api/v1/jobs/" + job_id)
        assert response.status_code == 200
        last = response.json()
        if last["status"] in {"complete", "error"}:
            return last
        time.sleep(0.03)
    raise AssertionError("job did not finish: " + repr(last))


def test_health_is_public_and_reports_real_support():
    with TestClient(module.app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        body = response.json()
        assert body["ok"] is True
        assert "scene-json" in body["supportedFormats"]


def test_export_requires_canva_authentication():
    with TestClient(module.app) as client:
        response = client.post("/api/v1/exports", json=make_submission())
        assert response.status_code == 401


def test_scene_json_export_completes_and_downloads():
    module.app.dependency_overrides[module.verify_canva_user] = user_one
    try:
        with TestClient(module.app) as client:
            created = client.post("/api/v1/exports", json=make_submission())
            assert created.status_code == 202
            payload = created.json()

            job = wait_for_job(client, payload["jobId"])
            assert job["status"] == "complete"
            assert job["percent"] == 100

            status = client.get("/api/v1/exports/" + payload["exportId"])
            assert status.status_code == 200
            info = status.json()
            assert info["status"] == "complete"
            assert info["mimeType"] == "application/json"
            assert info["downloadUrl"]

            artifact = client.get(info["downloadUrl"])
            assert artifact.status_code == 200
            assert artifact.headers["content-type"].startswith("application/json")
            assert b'"schemaVersion": 1' in artifact.content
    finally:
        module.app.dependency_overrides.clear()


def test_jobs_and_exports_are_isolated_by_canva_identity():
    module.app.dependency_overrides[module.verify_canva_user] = user_one
    try:
        with TestClient(module.app) as client:
            created = client.post("/api/v1/exports", json=make_submission())
            assert created.status_code == 202
            payload = created.json()
            wait_for_job(client, payload["jobId"])

            module.app.dependency_overrides[module.verify_canva_user] = user_two
            assert client.get("/api/v1/jobs/" + payload["jobId"]).status_code == 404
            assert client.get("/api/v1/exports/" + payload["exportId"]).status_code == 404
            assert client.get(
                "/api/v1/exports/" + payload["exportId"] + "/download"
            ).status_code == 404
    finally:
        module.app.dependency_overrides.clear()


def test_glb_fails_closed_when_blender_is_not_configured(monkeypatch):
    module.app.dependency_overrides[module.verify_canva_user] = user_one
    try:
        monkeypatch.setattr(module.renderers.renderers[1], "blender_bin", "")
        with TestClient(module.app) as client:
            response = client.post("/api/v1/exports", json=make_submission("glb"))
            assert response.status_code == 503
            assert "renderer" in response.json()["detail"].lower()
    finally:
        module.app.dependency_overrides.clear()
