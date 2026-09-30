import io

import numpy as np
from fastapi.testclient import TestClient
from PIL import Image

import app as depthpop


def _png_bytes(size=(24, 24), color=(180, 90, 220)):
    image = Image.new("RGB", size, color)
    output = io.BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def test_health_is_available_without_provider_configuration():
    client = TestClient(depthpop.app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"service": "depthpop-canva", "status": "ok"}


def test_render_preserves_dimensions_and_outputs_png_bytes():
    source = _png_bytes((32, 20))
    depth_image = Image.new("L", (32, 20))
    depth_image.putdata([int((x / 31) * 255) for _y in range(20) for x in range(32)])
    depth_buf = io.BytesIO()
    depth_image.save(depth_buf, format="PNG")

    rendered = depthpop._render_depthpop(
        source,
        depth_buf.getvalue(),
        depth_fidelity=0.95,
        strength=0.32,
        bokeh=35,
        num_inference_steps=28,
    )

    with Image.open(io.BytesIO(rendered)) as result:
        assert result.size == (32, 20)
        assert result.format == "PNG"


def test_depth_focus_heuristic_returns_bounded_focus():
    depth = np.linspace(0, 1, 100, dtype=np.float32).reshape(10, 10)
    invert, focus = depthpop._auto_invert_and_focus(depth)
    assert isinstance(invert, bool)
    assert 0.05 <= focus <= 0.95


def test_cached_output_expires_when_stale(monkeypatch):
    payload = _png_bytes((8, 8))
    key = depthpop._cache_put(payload, "image/png")
    created, data, mime = depthpop._image_cache[key]
    monkeypatch.setattr(depthpop, "CACHE_TTL_SECONDS", 1)
    depthpop._image_cache[key] = (created - 5, data, mime)

    client = TestClient(depthpop.app)
    response = client.get("/cache/image/" + key)
    assert response.status_code == 404


def test_fal_media_url_is_rebuilt_against_fixed_origin():
    base, target = depthpop._fal_media_request_target(
        "https://v2.fal.media/files/example/depth.png?token=abc"
    )
    assert base == "https://v2.fal.media"
    assert target == "/files/example/depth.png?token=abc"


def test_fal_media_url_rejects_untrusted_hosts():
    try:
        depthpop._fal_media_request_target("https://example.com/anything.png")
    except Exception as exc:
        assert getattr(exc, "status_code", None) == 502
    else:
        raise AssertionError("untrusted provider host should have been rejected")


def test_depthpop_route_completes_with_stubbed_depth_provider(monkeypatch):
    async def fake_verify():
        return depthpop.VerifiedCanvaUser(user_id="user-1", brand_id="brand-1")

    async def fake_depth_map(raw: bytes, mime: str):
        assert raw
        assert mime == "image/png"
        depth = Image.new("L", (24, 24))
        depth.putdata([int((x / 23) * 255) for _y in range(24) for x in range(24)])
        buffer = io.BytesIO()
        depth.save(buffer, format="PNG")
        return buffer.getvalue(), "https://v2.fal.media/files/test/depth.png"

    monkeypatch.setattr(depthpop, "CANVA_APP_ID", "test-app")
    monkeypatch.setenv("FAL_KEY", "test-key")
    monkeypatch.setattr(depthpop, "_depth_map", fake_depth_map)
    depthpop.app.dependency_overrides[depthpop.verify_canva_user] = fake_verify

    try:
        client = TestClient(depthpop.app)
        response = client.post(
            "/api/depthpop",
            files={"image": ("source.png", _png_bytes((24, 24)), "image/png")},
            data={
                "strength": "0.32",
                "bokeh": "35",
                "depth_fidelity": "0.95",
                "num_inference_steps": "28",
            },
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["ok"] is True
        assert payload["mimeType"] == "image/png"
        assert payload["model"] == "depthpop-depth-anything-v2-local-dof"
        assert payload["url"].startswith("http://testserver/cache/image/")

        cached = client.get(payload["url"].removeprefix("http://testserver"))
        assert cached.status_code == 200
        assert cached.headers["content-type"].startswith("image/png")
        with Image.open(io.BytesIO(cached.content)) as result:
            assert result.size == (24, 24)
    finally:
        depthpop.app.dependency_overrides.clear()
