from __future__ import annotations

import os
from providers.segmentation_provider import (
    FalSegmentationProvider,
    MockSegmentationProvider,
    SegmentedObject,
    SegmentationProvider,
)


def get_segmentation_provider() -> SegmentationProvider:
    mode = os.getenv("SEGMENTATION_PROVIDER", "auto").lower().strip()
    if mode == "fal":
        return FalSegmentationProvider()
    if mode == "mock":
        return MockSegmentationProvider()

    # auto mode: check if FAL_KEY exists or if running in pytest/test
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

    @property
    def provider(self) -> SegmentationProvider:
        return self._provider or get_segmentation_provider()

    async def segment_objects(self, image: bytes, max_objects: int = 24) -> list[SegmentedObject]:
        return await self.provider.segment(image, max_objects=max_objects)
