"""Offline tests for the bounded paid-provider smoke chain (never bill fal)."""

import asyncio
import io

from PIL import Image

import live_provider_smoke as smoke


def _mask():
    image = Image.new("L", (128, 128), 0)
    image.paste(255, (38, 30, 90, 110))
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def test_all_smoke_stages_are_linked_in_order_without_paid_inference(monkeypatch):
    calls = []
    live_mask = _mask()

    async def fake_detection(_image):
        calls.append("florence")
        return {"ok": True}, [
            {"x": 38, "y": 30, "width": 52, "height": 80, "label": "object"},
        ]

    async def fake_segmentation(_image, detections=None):
        calls.append("sam")
        assert detections is not None and detections[0]["label"] == "object"
        return {"ok": True}, live_mask

    async def fake_depth(_image):
        calls.append("depth")
        return {"ok": True}

    async def fake_inpaint(_image, mask):
        calls.append("inpaint")
        assert mask == live_mask
        return {"ok": True}

    monkeypatch.setenv("DEPTHPOP_LIVE_PROVIDER_SMOKE", "1")
    monkeypatch.setenv("FAL_KEY", "offline-test-placeholder")
    monkeypatch.setattr(smoke, "_detection", fake_detection)
    monkeypatch.setattr(smoke, "_segmentation", fake_segmentation)
    monkeypatch.setattr(smoke, "_depth", fake_depth)
    monkeypatch.setattr(smoke, "_inpaint", fake_inpaint)

    report = asyncio.run(smoke.run_suite("all"))
    assert calls == ["florence", "sam", "depth", "inpaint"]
    assert report["ok"] is True
    assert report["paidCallsMaximum"] == 4
    assert report["results"]["inpaint"]["sourceMask"] == "sam-3"


def test_smoke_refuses_paid_execution_without_key(monkeypatch):
    monkeypatch.setenv("DEPTHPOP_LIVE_PROVIDER_SMOKE", "1")
    monkeypatch.delenv("FAL_KEY", raising=False)
    try:
        asyncio.run(smoke.run_suite("all"))
    except SystemExit as exc:
        assert "FAL_KEY is required" in str(exc)
    else:
        raise AssertionError("Missing key must fail before any provider call")
