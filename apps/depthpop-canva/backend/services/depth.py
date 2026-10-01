from __future__ import annotations

import os
from providers.depth_provider import (
    DepthMap,
    DepthProvider,
    FalDepthProvider,
    MockDepthProvider,
)


def get_depth_provider() -> DepthProvider:
    mode = os.getenv("DEPTH_PROVIDER", "auto").lower().strip()
    if mode == "fal":
        return FalDepthProvider()
    if mode == "mock":
        return MockDepthProvider()

    # auto mode: check for FAL_KEY
    if os.getenv("FAL_KEY", "").strip():
        return FalDepthProvider()
    return MockDepthProvider()


class DepthService:
    def __init__(self, provider: DepthProvider | None = None):
        self._provider = provider

    @property
    def provider(self) -> DepthProvider:
        return self._provider or get_depth_provider()

    async def estimate_depth(self, image: bytes) -> DepthMap:
        return await self.provider.estimate(image)
