from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response

from auth import VerifiedCanvaUser, verify_canva_user
from services.persistence import scene_asset_repo

router = APIRouter(prefix="/api/v1/assets", tags=["assets"])


@router.get("/{asset_id}")
async def get_scene_asset(
    asset_id: str,
    user: VerifiedCanvaUser = Depends(verify_canva_user),
) -> Response:
    asset = await scene_asset_repo.get_asset(
        asset_id,
        user_id=user.user_id,
        brand_id=user.brand_id,
    )
    if not asset:
        raise HTTPException(
            status_code=404,
            detail="Scene asset not found.",
        )

    return Response(
        content=asset.data,
        media_type=asset.mime_type,
        headers={
            "Cache-Control": "private, no-store",
            "Content-Length": str(asset.size),
            "ETag": f'"{asset.sha256}"',
        },
    )
