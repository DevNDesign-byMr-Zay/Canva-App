from __future__ import annotations

import asyncio
import io

from PIL import Image, ImageDraw

import providers.inpaint_provider as inpaint


def png(size=(64, 48), color=(30, 40, 50)) -> bytes:
    image = Image.new("RGB", size, color)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def mask_png(size=(64, 48)) -> bytes:
    image = Image.new("L", size, 0)
    right = max(1, min(size[0] - 1, 29))
    bottom = max(1, min(size[1] - 1, 27))
    ImageDraw.Draw(image).rectangle((10, 8, right, bottom), fill=255)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def fake_upload(raw: bytes, content_type: str, filename: str) -> str:
    assert content_type == "image/png"
    assert raw[:4] == bytes((137, 80, 78, 71))
    return f"https://v3b.fal.media/files/b/test/{filename}"


def test_fal_inpaint_uses_documented_image_and_white_mask_contract(monkeypatch):
    captured: list[dict] = []
    uploaded: dict[str, bytes] = {}

    def capture_upload(raw, content_type, filename):
        uploaded[filename] = raw
        return fake_upload(raw, content_type, filename)

    def fake_run(model: str, arguments: dict, **_kwargs):
        captured.append({"model": model, "arguments": arguments})
        return {
            "images": [{"url": "https://v2.fal.media/files/test/inpaint.png", "content_type": "image/png"}],
            "seed": 123,
        }

    async def fake_media(_url: str) -> bytes:
        return png((96, 96), (70, 80, 90))

    monkeypatch.setattr(inpaint.fal_client, "subscribe", fake_run)
    monkeypatch.setattr(inpaint.fal_client, "upload", capture_upload)
    monkeypatch.setattr(inpaint, "fetch_fal_media", fake_media)

    provider = inpaint.FalInpaintProvider(fal_key="test-key")
    result = asyncio.run(
        provider.inpaint(
            png((64, 48)),
            mask_png((64, 48)),
        )
    )

    assert captured[0]["model"] == inpaint.INPAINT_MODEL
    args = captured[0]["arguments"]
    assert args["model"] == inpaint.OBJECT_REMOVAL_MODEL
    assert args["mask_expansion"] == inpaint.MASK_EXPANSION_PX
    assert "model_name" not in args and "prompt" not in args
    assert "num_inference_steps" not in args
    assert args["image_url"].endswith("/depthpop-source.png")
    assert args["mask_url"].endswith("/depthpop-mask.png")
    assert uploaded.keys() == {"depthpop-source.png", "depthpop-mask.png"}

    mask_bytes = uploaded["depthpop-mask.png"]
    with Image.open(io.BytesIO(mask_bytes)) as mask:
        assert mask.mode == "L"
        assert mask.getpixel((15, 15)) == 255
        assert mask.getpixel((0, 0)) == 0

    with Image.open(io.BytesIO(result)) as output:
        assert output.format == "PNG"
        assert output.size == (64, 48)


def test_mock_inpaint_is_test_only(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "test")
    provider = inpaint.MockInpaintProvider()
    result = asyncio.run(
        provider.inpaint(
            png((32, 24)),
            mask_png((32, 24)),
        )
    )
    with Image.open(io.BytesIO(result)) as output:
        assert output.size == (32, 24)


def test_object_removal_keeps_legacy_interface_without_unsupported_steps(monkeypatch):
    captured: list[dict] = []

    def fake_run(model: str, arguments: dict, **_kwargs):
        captured.append({"model": model, "arguments": arguments})
        return {
            "images": [{"url": "https://v2.fal.media/files/test/inpaint.png", "content_type": "image/png"}]
        }

    async def fake_media(_url: str) -> bytes:
        return png((64, 48), (70, 80, 90))

    monkeypatch.setattr(inpaint.fal_client, "subscribe", fake_run)
    monkeypatch.setattr(inpaint.fal_client, "upload", fake_upload)
    monkeypatch.setattr(inpaint, "fetch_fal_media", fake_media)

    provider = inpaint.FalInpaintProvider(fal_key="test-key")
    asyncio.run(
        provider.inpaint(
            png((64, 48)),
            mask_png((64, 48)),
            num_inference_steps=14,
        )
    )

    assert captured[0]["arguments"]["model"] == "best_quality"
    assert "num_inference_steps" not in captured[0]["arguments"]


def test_inpaint_preserves_all_original_pixels_outside_expanded_mask(monkeypatch):
    def fake_run(_model, arguments, **_kwargs):
        return {"images": [{"url": "https://v3b.fal.media/files/b/test/result.png"}]}

    async def fake_media(_url):
        return png((64, 48), (180, 0, 0))

    monkeypatch.setattr(inpaint.fal_client, "subscribe", fake_run)
    monkeypatch.setattr(inpaint.fal_client, "upload", fake_upload)
    monkeypatch.setattr(inpaint, "fetch_fal_media", fake_media)
    output = asyncio.run(inpaint.FalInpaintProvider(
        fal_key="unit-key",
    ).inpaint(png((64, 48), (30, 40, 50)), mask_png((64, 48))))
    with Image.open(io.BytesIO(output)) as image:
        assert image.getpixel((0, 0))[:3] == (30, 40, 50)
        assert image.getpixel((63, 47))[:3] == (30, 40, 50)
        assert image.getpixel((15, 15))[:3] == (180, 0, 0)
