from __future__ import annotations

import os

from fastapi import HTTPException

from providers.depth_provider import (
    DepthMap,
    DepthProvider,
    DepthQuality,
    FalDepthProvider,
    MockDepthProvider,
)


def get_depth_provider(mode: str | None = None) -> DepthProvider:
    selected = (
        mode or os.getenv("DEPTH_PROVIDER", "auto")
    ).lower().strip()

    if selected == "fal":
        return FalDepthProvider()
    if selected == "mock":
        if os.getenv("ENVIRONMENT", "").lower() == "production":
            raise HTTPException(
                status_code=503,
                detail="Mock depth estimation is disabled in production.",
            )
        return MockDepthProvider()
    if selected != "auto":
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported depth provider '{selected}'.",
        )

    if os.getenv("FAL_KEY", "").strip():
        return FalDepthProvider()
    if (
        os.getenv("ENVIRONMENT", "").lower() == "test"
        or "PYTEST_CURRENT_TEST" in os.environ
    ):
        return MockDepthProvider()

    raise HTTPException(
        status_code=503,
        detail="No production depth provider is configured.",
    )


class DepthService:
    def __init__(self, provider: DepthProvider | None = None):
        self._provider = provider

    async def estimate_depth(
        self,
        image: bytes,
        *,
        quality: DepthQuality = "high",
    ) -> DepthMap:
        provider = self._provider or get_depth_provider()
        return await provider.estimate(image, quality=quality)
