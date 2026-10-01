from __future__ import annotations

from fastapi import APIRouter, HTTPException
from models.job import DepthJob
from services.persistence import job_repo

router = APIRouter(prefix="/api/v1/jobs", tags=["jobs"])


@router.get("/{job_id}")
async def get_job_status(job_id: str) -> dict:
    job = await job_repo.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return job.model_dump(mode="json", by_alias=True)
