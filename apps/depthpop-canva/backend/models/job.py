from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

JobStatus = Literal["queued", "processing", "complete", "error"]
JobStage = Literal[
    "queued",
    "decoding",
    "segmenting_objects",
    "estimating_depth",
    "extracting_objects",
    "reconstructing_plate",
    "building_scene",
    "complete",
    "error",
]


class DepthJob(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    jobId: str = Field(..., alias="jobId")
    userId: str = Field(..., alias="userId")
    brandId: str = Field(..., alias="brandId")
    status: JobStatus
    stage: JobStage
    progress: float = 0.0
    sceneId: str | None = Field(None, alias="sceneId")
    error: str | None = None
    createdAt: str = Field(..., alias="createdAt")
    updatedAt: str = Field(..., alias="updatedAt")
