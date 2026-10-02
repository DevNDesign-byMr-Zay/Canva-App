from __future__ import annotations

import pytest
from fastapi import HTTPException

from providers.depth_provider import FalDepthProvider, MockDepthProvider
from providers.inpaint_provider import FalInpaintProvider, MockInpaintProvider
from providers.segmentation_provider import FalSegmentationProvider, MockSegmentationProvider
from services.depth import get_depth_provider
from services.inpainting import get_inpaint_provider
from services.segmentation import get_segmentation_provider


def test_auto_provider_selection_uses_fal_when_key_present(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("FAL_KEY", "configured")
    monkeypatch.setenv("DEPTH_PROVIDER", "auto")
    monkeypatch.setenv("SEGMENTATION_PROVIDER", "auto")
    monkeypatch.setenv("INPAINT_PROVIDER", "auto")

    assert isinstance(get_depth_provider(), FalDepthProvider)
    assert isinstance(get_segmentation_provider(), FalSegmentationProvider)
    assert isinstance(get_inpaint_provider(), FalInpaintProvider)


def test_auto_provider_selection_fails_closed_in_production_without_key(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.delenv("FAL_KEY", raising=False)
    monkeypatch.setenv("DEPTH_PROVIDER", "auto")
    monkeypatch.setenv("SEGMENTATION_PROVIDER", "auto")
    monkeypatch.setenv("INPAINT_PROVIDER", "auto")

    for factory in (
        get_depth_provider,
        get_segmentation_provider,
        get_inpaint_provider,
    ):
        with pytest.raises(HTTPException) as exc:
            factory()
        assert exc.value.status_code == 503


def test_mock_selection_is_explicitly_available_in_test(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "test")
    monkeypatch.delenv("FAL_KEY", raising=False)

    assert isinstance(get_depth_provider("mock"), MockDepthProvider)
    assert isinstance(
        get_segmentation_provider("mock"),
        MockSegmentationProvider,
    )
    assert isinstance(get_inpaint_provider("mock"), MockInpaintProvider)


def test_mock_selection_is_rejected_in_production(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")

    for factory in (
        lambda: get_depth_provider("mock"),
        lambda: get_segmentation_provider("mock"),
        lambda: get_inpaint_provider("mock"),
    ):
        with pytest.raises(HTTPException) as exc:
            factory()
        assert exc.value.status_code == 503
