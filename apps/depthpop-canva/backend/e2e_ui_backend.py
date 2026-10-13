from __future__ import annotations

import os

# Configure the ephemeral backend before importing application modules.
os.environ.setdefault("ENVIRONMENT", "e2e")
os.environ.setdefault("CANVA_APP_ID", "depthpop-e2e")
os.environ.setdefault("CANVA_APP_ORIGIN", "http://127.0.0.1:4173")
os.environ.setdefault("DEPTHPOP_DEV_ORIGINS", "http://127.0.0.1:4173")
os.environ.setdefault("PUBLIC_BASE_URL", "http://127.0.0.1:8081")
os.environ.setdefault("SEGMENTATION_PROVIDER", "fal")
os.environ.setdefault("DEPTH_PROVIDER", "fal")
os.environ.setdefault("INPAINT_PROVIDER", "fal")
os.environ.setdefault("DEPTHPOP_ALLOW_BBOX_FALLBACK", "false")
os.environ.setdefault("DEPTHPOP_REPOSITORY_BACKEND", "memory")
os.environ.setdefault("DEPTHPOP_MAX_CONCURRENCY", "1")

import uvicorn

import app as depthpop
from auth import VerifiedCanvaUser, verify_canva_user


async def e2e_identity() -> VerifiedCanvaUser:
    return VerifiedCanvaUser(
        user_id="ui-e2e-user",
        brand_id="ui-e2e-brand",
    )


depthpop.app.dependency_overrides[verify_canva_user] = e2e_identity

if __name__ == "__main__":
    uvicorn.run(
        depthpop.app,
        host="127.0.0.1",
        port=8081,
        log_level="info",
    )
