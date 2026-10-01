from __future__ import annotations

import io
from PIL import Image
from fastapi import HTTPException, UploadFile

MAX_IMAGE_BYTES = 50 * 1024 * 1024
SUPPORTED_IMAGE_MIME = {"image/png", "image/jpeg", "image/webp"}


async def validate_and_read_upload(image: UploadFile) -> tuple[bytes, str]:
    mime = (image.content_type or "").split(";", 1)[0].strip().lower()
    if mime not in SUPPORTED_IMAGE_MIME:
        raise HTTPException(status_code=415, detail="DepthPop supports PNG, JPEG, and WebP images")

    raw = await image.read(MAX_IMAGE_BYTES + 1)
    if not raw:
        raise HTTPException(status_code=400, detail="Selected image was empty")
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Selected image exceeds 50 MB limit")

    try:
        with Image.open(io.BytesIO(raw)) as probe:
            probe.verify()
            fmt = (probe.format or "").upper()
            if fmt == "PNG":
                detected_mime = "image/png"
            elif fmt in ("JPEG", "JPG"):
                detected_mime = "image/jpeg"
            elif fmt == "WEBP":
                detected_mime = "image/webp"
            else:
                detected_mime = mime
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Selected file is not a valid raster image") from exc

    return raw, detected_mime
