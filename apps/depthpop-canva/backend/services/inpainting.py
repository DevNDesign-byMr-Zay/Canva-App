from __future__ import annotations

from providers.inpaint_provider import InpaintProvider, MockInpaintProvider


class InpaintingService:
    def __init__(self, provider: InpaintProvider | None = None):
        self.provider = provider or MockInpaintProvider()

    async def inpaint_plate(self, image: bytes, mask: bytes) -> bytes:
        return await self.provider.inpaint(image, mask)
