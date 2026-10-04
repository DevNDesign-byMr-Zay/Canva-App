from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from auth import verify_canva_user, VerifiedCanvaUser
from services.persistence import job_repo

router = APIRouter(prefix="/api/v1/jobs", tags=["jobs"])


@router.get("/{job_id}")
async def get_job_status(
    job_id: str,
    user: VerifiedCanvaUser = Depends(verify_canva_user),
) -> dict:
    job = await job_repo.get_job(
        job_id,
        user_id=user.user_id,
        brand_id=user.brand_id,
    )
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return job.model_dump(mode="json", by_alias=True)
