from __future__ import annotations

import asyncio
import base64
import io

import numpy as np
from PIL import Image

import providers.depth_provider as depth


def source_bytes(
    size=(2048, 1024),
    *,
    fmt="JPEG",
) -> bytes:
    image = Image.new("RGB", size, (40, 70, 110))
    buffer = io.BytesIO()
    image.save(buffer, format=fmt)
    return buffer.getvalue()


def depth_png(values: np.ndarray) -> bytes:
    image = Image.fromarray(values.astype(np.uint8), mode="L")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def test_quality_preprocessing_is_real_and_always_truthful_png():
    raw = source_bytes()

    standard, source_size, standard_size = depth.prepare_depth_input(
        raw,
        "standard",
    )
    high, source_size_high, high_size = depth.prepare_depth_input(
        raw,
        "high",
    )

    assert source_size == (2048, 1024)
    assert source_size_high == source_size
    assert max(standard_size) <= depth.QUALITY_MAX_EDGE["standard"]
    assert max(high_size) <= depth.QUALITY_MAX_EDGE["high"]
    assert max(high_size) > max(standard_size)

    with Image.open(io.BytesIO(standard)) as image:
        assert image.format == "PNG"
    with Image.open(io.BytesIO(high)) as image:
        assert image.format == "PNG"


def test_fal_depth_canonicalization_preserves_disparity_high_as_near():
    provider = depth_png(
        np.array(
            [
                [0, 64],
                [192, 255],
            ],
            dtype=np.uint8,
        )
    )
    raw_array, canonical, canonical_png = depth.canonicalize_fal_depth(
        provider,
        source_size=(4, 4),
    )

    assert raw_array.shape == (2, 2)
    assert canonical.shape == (4, 4)
    assert canonical.min() >= 0
    assert canonical.max() <= 1
    assert canonical[-1, -1] > canonical[0, 0]

    with Image.open(io.BytesIO(canonical_png)) as image:
        assert image.size == (4, 4)
        assert image.mode == "L"


def test_fal_estimate_resizes_canonical_depth_back_to_source(monkeypatch):
    calls: list[dict] = []

    def fake_run(model: str, arguments: dict):
        calls.append(arguments)
        return {
            "image": {
                "url": "https://v2.fal.media/files/test/depth.png"
            }
        }

    async def fake_media(_url: str) -> bytes:
        return depth_png(
            np.array(
                [
                    [0, 0, 0],
                    [128, 128, 128],
                    [255, 255, 255],
                ],
                dtype=np.uint8,
            )
        )

    monkeypatch.setattr(depth.fal_client, "run", fake_run)
    monkeypatch.setattr(depth, "fetch_fal_media", fake_media)

    provider = depth.FalDepthProvider(fal_key="test-key")
    result = asyncio.run(
        provider.estimate(
            source_bytes((1200, 600), fmt="JPEG"),
            quality="standard",
        )
    )

    assert result.depth_array.shape == (600, 1200)
    assert result.raw_depth_array.shape == (3, 3)
    assert result.polarity == depth.CANONICAL_POLARITY
    assert result.quality == "standard"

    data_url = calls[0]["image_url"]
    assert data_url.startswith("data:image/png;base64,")
    encoded = data_url.split(",", 1)[1]
    with Image.open(io.BytesIO(base64.b64decode(encoded))) as prepared:
        assert prepared.format == "PNG"
        assert max(prepared.size) <= depth.QUALITY_MAX_EDGE["standard"]


def test_mock_depth_is_already_canonical(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "test")
    result = asyncio.run(
        depth.MockDepthProvider().estimate(
            source_bytes((80, 60), fmt="PNG"),
            quality="high",
        )
    )

    center = result.depth_array[30, 40]
    edge = result.depth_array[0, 0]
    assert center > edge
    assert result.depth_array.shape == (60, 80)
    assert result.polarity == depth.CANONICAL_POLARITY
