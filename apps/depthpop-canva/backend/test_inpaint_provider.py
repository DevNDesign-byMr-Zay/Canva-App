from __future__ import annotations

import asyncio
import base64
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


def test_fal_inpaint_uses_documented_image_and_white_mask_contract(monkeypatch):
    captured: list[dict] = []

    def fake_run(model: str, arguments: dict):
        captured.append({"model": model, "arguments": arguments})
        return {
            "image": {
                "url": "https://v2.fal.media/files/test/inpaint.png",
                "content_type": "image/png",
            },
            "seed": 123,
        }

    async def fake_media(_url: str) -> bytes:
        return png((96, 96), (70, 80, 90))

    monkeypatch.setattr(inpaint.fal_client, "run", fake_run)
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
    assert args["model_name"] == inpaint.DEFAULT_BASE_MODEL
    assert args["image_url"].startswith("data:image/png;base64,")
    assert args["mask_url"].startswith("data:image/png;base64,")

    mask_bytes = base64.b64decode(args["mask_url"].split(",", 1)[1])
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
