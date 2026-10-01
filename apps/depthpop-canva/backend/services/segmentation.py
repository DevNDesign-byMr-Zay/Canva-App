from __future__ import annotations

import os
from providers.segmentation_provider import (
    FalSegmentationProvider,
    MockSegmentationProvider,
    SegmentedObject,
    SegmentationProvider,
)


def get_segmentation_provider(requested_mode: str = "auto") -> SegmentationProvider:
    clean_mode = requested_mode.lower().strip()
    if clean_mode == "florence_sam3":
        return FalSegmentationProvider()
    if clean_mode == "mock":
        return MockSegmentationProvider()

    env_mode = os.getenv("SEGMENTATION_PROVIDER", "auto").lower().strip()
    if env_mode == "fal":
        return FalSegmentationProvider()
    if env_mode == "mock":
        return MockSegmentationProvider()

    fal_key = os.getenv("FAL_KEY", "").strip()
    is_pytest = "PYTEST_CURRENT_TEST" in os.environ or os.getenv("ENVIRONMENT") == "test"

    if fal_key:
        return FalSegmentationProvider()
    if is_pytest:
        return MockSegmentationProvider()

    return FalSegmentationProvider()


class SegmentationService:
    def __init__(self, provider: SegmentationProvider | None = None):
        self._provider = provider

    def get_provider(self, mode: str = "auto") -> SegmentationProvider:
        return self._provider or get_segmentation_provider(requested_mode=mode)

    async def segment_objects(
        self, image: bytes, max_objects: int = 24, mode: str = "auto"
    ) -> list[SegmentedObject]:
        provider = self.get_provider(mode=mode)
        return await provider.segment(image, max_objects=max_objects)
