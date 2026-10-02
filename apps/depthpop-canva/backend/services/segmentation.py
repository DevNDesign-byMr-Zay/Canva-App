from __future__ import annotations

import os

from fastapi import HTTPException

from providers.segmentation_provider import (
    FalSegmentationProvider,
    MockSegmentationProvider,
    SegmentedObject,
    SegmentationProvider,
)


def get_segmentation_provider(
    mode: str | None = None,
) -> SegmentationProvider:
    selected = (
        mode or os.getenv("SEGMENTATION_PROVIDER", "auto")
    ).lower().strip()

    if selected in {"fal", "florence_sam3"}:
        return FalSegmentationProvider()
    if selected == "mock":
        if os.getenv("ENVIRONMENT", "").lower() == "production":
            raise HTTPException(
                status_code=503,
                detail="Mock segmentation is disabled in production.",
            )
        return MockSegmentationProvider()
    if selected != "auto":
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported segmentation provider '{selected}'.",
        )

    environment = os.getenv("ENVIRONMENT", "").lower()
    has_fal_key = bool(os.getenv("FAL_KEY", "").strip())
    if environment == "production" and not has_fal_key:
        raise HTTPException(
            status_code=503,
            detail="No production provider is configured.",
        )

    if has_fal_key:
        return FalSegmentationProvider()

    if (
        os.getenv("ENVIRONMENT", "").lower() == "test"
        or "PYTEST_CURRENT_TEST" in os.environ
    ):
        return MockSegmentationProvider()

    raise HTTPException(
        status_code=503,
        detail="No production segmentation provider is configured.",
    )


class SegmentationService:
    def __init__(self, provider: SegmentationProvider | None = None):
        self._provider = provider

    async def segment_objects(
        self,
        image: bytes,
        max_objects: int = 24,
        *,
        mode: str = "auto",
    ) -> list[SegmentedObject]:
        provider = self._provider or get_segmentation_provider(mode)
        return await provider.segment(image, max_objects=max_objects)
