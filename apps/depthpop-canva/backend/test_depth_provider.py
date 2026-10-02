from __future__ import annotations

import io
import pytest
import numpy as np
from PIL import Image
from providers.depth_provider import (
    normalize_depth_polarity,
    _detect_image_mime,
    MockDepthProvider,
)


def test_normalize_depth_polarity_canonical():
    depth_raw = np.array([[0.1, 0.2], [0.8, 1.0]], dtype=np.float32)
    canonical, polarity = normalize_depth_polarity(depth_raw)
    assert polarity == "canonical_near_high"
    assert canonical[1, 1] == 1.0
    assert canonical[0, 0] == 0.1


def test_detect_image_mime_types():
    for fmt, expected_mime in [("PNG", "image/png"), ("JPEG", "image/jpeg"), ("WEBP", "image/webp")]:
        img = Image.new("RGB", (10, 10), color=(255, 0, 0))
        buf = io.BytesIO()
        img.save(buf, format=fmt)
        detected = _detect_image_mime(buf.getvalue())
        assert detected == expected_mime


@pytest.mark.anyio
async def test_mock_depth_provider_returns_canonical_map():
    provider = MockDepthProvider()
    img = Image.new("RGB", (100, 100), color=(128, 128, 128))
    buf = io.BytesIO()
    img.save(buf, format="PNG")

    depth_map = await provider.estimate(buf.getvalue(), quality="high")
    assert depth_map.canonical_depth_array.shape == (100, 100)
    assert depth_map.canonical_depth_array.min() >= 0.0
    assert depth_map.canonical_depth_array.max() <= 1.0
    assert depth_map.polarity == "canonical_near_high"

@pytest.mark.parametrize("dimensions", [(1000, 500), (500, 1000), (2048, 2048)])
@pytest.mark.parametrize("quality", ["standard", "high"])
@pytest.mark.anyio
async def test_depth_resolution_resampling_matches_source(dimensions, quality):
    provider = MockDepthProvider()
    w, h = dimensions
    img = Image.new("RGB", (w, h), color=(100, 150, 200))
    buf = io.BytesIO()
    img.save(buf, format="PNG")

    depth_map = await provider.estimate(buf.getvalue(), quality=quality)
    assert depth_map.canonical_depth_array.shape == (h, w)
