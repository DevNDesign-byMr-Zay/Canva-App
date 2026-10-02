from __future__ import annotations

import os

from fastapi import HTTPException

from providers.inpaint_provider import (
    FalInpaintProvider,
    InpaintProvider,
    MockInpaintProvider,
)


def get_inpaint_provider(
    mode: str | None = None,
) -> InpaintProvider:
    selected = (
        mode or os.getenv("INPAINT_PROVIDER", "auto")
    ).lower().strip()

    if selected == "fal":
        return FalInpaintProvider()
    if selected == "mock":
        if os.getenv("ENVIRONMENT", "").lower() == "production":
            raise HTTPException(
                status_code=503,
                detail="Mock inpainting is disabled in production.",
            )
        return MockInpaintProvider()
    if selected in {"off", "none", "disabled"}:
        raise HTTPException(
            status_code=503,
            detail="Background reconstruction is disabled by server configuration.",
        )
    if selected != "auto":
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported inpainting provider '{selected}'.",
        )

    if os.getenv("FAL_KEY", "").strip():
        return FalInpaintProvider()
    if (
        os.getenv("ENVIRONMENT", "").lower() == "test"
        or "PYTEST_CURRENT_TEST" in os.environ
    ):
        return MockInpaintProvider()

    raise HTTPException(
        status_code=503,
        detail="No production background reconstruction provider is configured.",
    )


class InpaintingService:
    def __init__(self, provider: InpaintProvider | None = None):
        self._provider = provider

    async def inpaint_plate(
        self,
        image: bytes,
        mask: bytes,
    ) -> bytes:
        provider = self._provider or get_inpaint_provider()
        return await provider.inpaint(image, mask)
