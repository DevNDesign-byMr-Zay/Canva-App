from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import FileResponse

from api.scenes import _scene_asset_bytes
from auth import VerifiedCanvaUser, verify_canva_user
from models.export import (
    CreateExportResponse,
    ExportRequest,
    ExportStatusResponse,
)
from services.export_jobs import (
    create_export_job,
    remember_runner_owner,
    run_export_job,
)
from services.export_persistence import export_repo, export_storage
from services.persistence import scene_repo

router = APIRouter(prefix="/api/v1", tags=["exports"])


@router.post(
    "/scenes/{scene_id}/exports",
    response_model=CreateExportResponse,
    status_code=202,
)
async def create_export(
    scene_id: str,
    body: ExportRequest,
    background_tasks: BackgroundTasks,
    user: VerifiedCanvaUser = Depends(verify_canva_user),
) -> CreateExportResponse:
    scene = await scene_repo.get_scene(
        scene_id,
        user_id=user.user_id,
        brand_id=user.brand_id,
    )
    if scene is None:
        raise HTTPException(status_code=404, detail="Scene not found")

    job = create_export_job(
        scene_id=scene_id,
        user_id=user.user_id,
        brand_id=user.brand_id,
        request=body,
    )
    remember_runner_owner(job)

    async def fetch_asset(url: str) -> bytes:
        return await _scene_asset_bytes(
            url,
            user_id=user.user_id,
            brand_id=user.brand_id,
        )

    background_tasks.add_task(
        run_export_job,
        job.jobId,
        body,
        fetch_asset=fetch_asset,
    )
    return CreateExportResponse(jobId=job.jobId)


@router.get(
    "/exports/{job_id}",
    response_model=ExportStatusResponse,
)
async def get_export_status(
    job_id: str,
    user: VerifiedCanvaUser = Depends(verify_canva_user),
) -> ExportStatusResponse:
    job = export_repo.get_job(
        job_id,
        user_id=user.user_id,
        brand_id=user.brand_id,
    )
    if job is None:
        raise HTTPException(status_code=404, detail="Export job not found")

    download_url = (
        f"/api/v1/artifacts/{job.artifactId}/download"
        if job.status == "complete" and job.artifactId
        else None
    )
    return ExportStatusResponse(
        jobId=job.jobId,
        status=job.status,
        stage=job.stage,
        progress=job.progress,
        format=job.format,
        artifactId=job.artifactId,
        downloadUrl=download_url,
        error=job.error or None,
    )


@router.post(
    "/exports/{job_id}/cancel",
    response_model=ExportStatusResponse,
)
async def cancel_export(
    job_id: str,
    user: VerifiedCanvaUser = Depends(verify_canva_user),
) -> ExportStatusResponse:
    job = export_repo.request_cancel(
        job_id,
        user_id=user.user_id,
        brand_id=user.brand_id,
    )
    if job is None:
        raise HTTPException(status_code=404, detail="Export job not found")

    return ExportStatusResponse(
        jobId=job.jobId,
        status=job.status,
        stage=job.stage,
        progress=job.progress,
        format=job.format,
        artifactId=job.artifactId,
        downloadUrl=(
            f"/api/v1/artifacts/{job.artifactId}/download"
            if job.status == "complete" and job.artifactId
            else None
        ),
        error=job.error or None,
    )


@router.get("/artifacts/{artifact_id}/download")
async def download_artifact(
    artifact_id: str,
    user: VerifiedCanvaUser = Depends(verify_canva_user),
) -> FileResponse:
    artifact = export_repo.get_artifact(
        artifact_id,
        user_id=user.user_id,
        brand_id=user.brand_id,
    )
    if artifact is None:
        raise HTTPException(status_code=404, detail="Export artifact not found")

    path = export_storage.safe_path(artifact.path)
    if not path.is_file():
        raise HTTPException(status_code=410, detail="Export artifact expired")

    return FileResponse(
        path,
        media_type=artifact.mimeType,
        filename=path.name,
        headers={"Cache-Control": "private, no-store"},
    )
