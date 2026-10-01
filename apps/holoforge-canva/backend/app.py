from __future__ import annotations

import os
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from auth import VerifiedCanvaUser, verify_canva_user
from export_service import ExportService
from models import CreateExportResponse, ExportStatusResponse, ExportSubmission
from renderers import RendererRegistry
from repositories import ArtifactRepository, JobRepository, OwnedKey

CANVA_APP_ORIGIN = os.getenv("CANVA_APP_ORIGIN", "").strip().rstrip("/")

app = FastAPI(title="HoloForge Render Backend", version="0.1.0")
if CANVA_APP_ORIGIN:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[CANVA_APP_ORIGIN],
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

jobs = JobRepository()
artifacts = ArtifactRepository()
renderers = RendererRegistry()
exports = ExportService(jobs=jobs, artifacts=artifacts, renderers=renderers)


@app.get("/health")
async def health() -> dict[str, object]:
    return {
        "ok": True,
        "service": "holoforge-render-backend",
        "version": "0.1.0",
        "supportedFormats": renderers.supported_formats(),
    }


@app.post("/api/v1/exports", response_model=CreateExportResponse, status_code=202)
async def create_export(
    submission: ExportSubmission,
    user: VerifiedCanvaUser = Depends(verify_canva_user),
) -> CreateExportResponse:
    # Resolve before queueing so unsupported render-worker formats fail closed
    # instead of producing a job that can never run.
    try:
        renderers.resolve(submission.request.format)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    job, export_id = exports.create(
        submission,
        user_id=user.user_id,
        brand_id=user.brand_id,
    )
    return CreateExportResponse(
        jobId=job.id,
        exportId=export_id,
        status=job.status,
    )


@app.get("/api/v1/jobs/{job_id}")
async def get_job(
    job_id: str,
    user: VerifiedCanvaUser = Depends(verify_canva_user),
):
    job = jobs.get(
        OwnedKey(user_id=user.user_id, brand_id=user.brand_id, resource_id=job_id)
    )
    if not job:
        raise HTTPException(status_code=404, detail="Export job not found")
    return job


@app.get("/api/v1/exports/{export_id}", response_model=ExportStatusResponse)
async def get_export(
    export_id: str,
    user: VerifiedCanvaUser = Depends(verify_canva_user),
) -> ExportStatusResponse:
    artifact = artifacts.get(
        OwnedKey(user_id=user.user_id, brand_id=user.brand_id, resource_id=export_id)
    )
    if artifact:
        return ExportStatusResponse(
            exportId=artifact.id,
            status="complete",
            downloadUrl=f"/api/v1/exports/{artifact.id}/download",
            fileName=artifact.fileName,
            mimeType=artifact.mimeType,
            sizeBytes=artifact.sizeBytes,
            expiresAt=artifact.expiresAt,
        )

    matching = None
    # Job count is bounded; this linear ownership-safe lookup remains small in v1.
    for _, (_, job) in list(jobs._values.items()):
        if (
            job.exportId == export_id
            and job.userId == user.user_id
            and job.brandId == user.brand_id
        ):
            matching = job
            break

    if not matching:
        raise HTTPException(status_code=404, detail="Export not found")

    return ExportStatusResponse(
        exportId=export_id,
        status=matching.status,
        error=matching.error,
    )


@app.get("/api/v1/exports/{export_id}/download")
async def download_export(
    export_id: str,
    user: VerifiedCanvaUser = Depends(verify_canva_user),
):
    artifact = artifacts.get(
        OwnedKey(user_id=user.user_id, brand_id=user.brand_id, resource_id=export_id)
    )
    if not artifact:
        raise HTTPException(status_code=404, detail="Export artifact not found")

    path = Path(artifact.path)
    if not path.is_file():
        raise HTTPException(status_code=410, detail="Export artifact expired")

    return FileResponse(
        path,
        media_type=artifact.mimeType,
        filename=artifact.fileName,
        headers={"Cache-Control": "private, max-age=60"},
    )
