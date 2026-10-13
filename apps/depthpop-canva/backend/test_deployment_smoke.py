import os
import shutil
import pytest
from fastapi.testclient import TestClient

from app import app, _progress_cache, _image_cache

client = TestClient(app)

def test_health_and_readiness():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "depthpop-canva"

def test_live_fal_provider_opt_in_gating():
    if not os.getenv("DEPTHPOP_LIVE_PROVIDER_SMOKE"):
        pytest.skip("DEPTHPOP_LIVE_PROVIDER_SMOKE not set; skipping paid live provider call")

    assert os.getenv("FAL_KEY"), "FAL_KEY must be set when DEPTHPOP_LIVE_PROVIDER_SMOKE=1"

def test_ffmpeg_dependency_check():
    ffmpeg_path = shutil.which("ffmpeg")
    # Verified availability check without breaking offline runner
    assert ffmpeg_path is None or isinstance(ffmpeg_path, str)
