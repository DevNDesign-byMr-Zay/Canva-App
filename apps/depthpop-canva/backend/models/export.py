from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

ExportFormat = Literal[
    "scene-json",
    "png-layers",
    "gltf",
    "glb",
    "webm",
    "mp4",
]
ExportStatus = Literal["queued", "processing", "complete", "failed", "cancelled"]
ExportStage = Literal[
    "queued",
    "loading_scene",
    "loading_assets",
    "building_gltf",
    "packaging_layers",
    "rendering_frames",
    "encoding_video",
    "complete",
    "failed",
    "cancelled",
]


class ExportResolution(BaseModel):
    width: int = Field(..., ge=64, le=4096)
    height: int = Field(..., ge=64, le=4096)


class ExportRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    format: ExportFormat
    includeAnimation: bool = Field(True, alias="includeAnimation")
    resolution: ExportResolution | None = None
    fps: int | None = Field(None, ge=1, le=60)


class DepthExportJob(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    jobId: str = Field(..., alias="jobId")
    userId: str = Field(..., alias="userId")
    brandId: str = Field(..., alias="brandId")
    sceneId: str = Field(..., alias="sceneId")
    format: ExportFormat
    status: ExportStatus
    stage: ExportStage
    progress: float = Field(0.0, ge=0.0, le=1.0)
    artifactId: str | None = Field(None, alias="artifactId")
    error: str | None = None
    cancelRequested: bool = Field(False, alias="cancelRequested")
    createdAt: str = Field(..., alias="createdAt")
    updatedAt: str = Field(..., alias="updatedAt")


class DepthExportArtifact(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    artifactId: str = Field(..., alias="artifactId")
    userId: str = Field(..., alias="userId")
    brandId: str = Field(..., alias="brandId")
    sceneId: str = Field(..., alias="sceneId")
    format: ExportFormat
    path: str
    mimeType: str = Field(..., alias="mimeType")
    size: int = Field(..., ge=1)
    sha256: str = Field(..., min_length=64, max_length=64)
    createdAt: str = Field(..., alias="createdAt")
    expiresAt: str = Field(..., alias="expiresAt")


class ExportStatusResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    jobId: str = Field(..., alias="jobId")
    status: ExportStatus
    stage: ExportStage
    progress: float
    format: ExportFormat
    artifactId: str | None = Field(None, alias="artifactId")
    downloadUrl: str | None = Field(None, alias="downloadUrl")
    error: str | None = None


class CreateExportResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    jobId: str = Field(..., alias="jobId")
    status: Literal["queued"] = "queued"
