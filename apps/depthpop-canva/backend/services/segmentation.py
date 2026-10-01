from __future__ import annotations

import os
from providers.segmentation_provider import (
    MockSegmentationProvider,
    ProductionSegmentationError,
    ProductionSegmentationProvider,
    SegmentedObject,
    SegmentationProvider,
)


def get_segmentation_provider() -> SegmentationProvider:
    mode = os.getenv("SEGMENTATION_PROVIDER", "auto").lower().strip()
    if mode == "production":
        return ProductionSegmentationProvider(
            endpoint=os.getenv("SEGMENTATION_ENDPOINT"),
            api_key=os.getenv("SEGMENTATION_API_KEY"),
        )
    if mode == "mock":
        return MockSegmentationProvider()

    # auto mode: check if production credentials exist, otherwise fail-closed in production, mock in tests
    endpoint = os.getenv("SEGMENTATION_ENDPOINT", "").strip()
    api_key = os.getenv("SEGMENTATION_API_KEY", "").strip()
    if endpoint and api_key:
        return ProductionSegmentationProvider(endpoint=endpoint, api_key=api_key)

    is_pytest = "PYTEST_CURRENT_TEST" in os.environ or os.getenv("ENVIRONMENT") == "test"
    if is_pytest:
        return MockSegmentationProvider()

    # Fail closed in production if no segmentation provider is configured
    return ProductionSegmentationProvider()


class SegmentationService:
    def __init__(self, provider: SegmentationProvider | None = None):
        self._provider = provider

    @property
    def provider(self) -> SegmentationProvider:
        return self._provider or get_segmentation_provider()

    async def segment_objects(self, image: bytes, max_objects: int = 24) -> list[SegmentedObject]:
        return await self.provider.segment(image, max_objects=max_objects)
