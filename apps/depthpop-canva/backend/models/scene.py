from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, ConfigDict, Field
from models.object import DepthObject, Vector3


class ReconstructedPlate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    imageUrl: str = Field(..., alias="imageUrl")
    depthMapUrl: str = Field(..., alias="depthMapUrl")


class CameraConfig(BaseModel):
    position: Vector3 = Field(default_factory=lambda: Vector3(x=0.0, y=0.0, z=5.0))
    target: Vector3 = Field(default_factory=lambda: Vector3(x=0.0, y=0.0, z=0.0))
    fov: float = 50.0


class TimelineConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    durationMs: int = Field(0, alias="durationMs")
    fps: int = 30
    currentTimeMs: int = Field(0, alias="currentTimeMs")


class DepthScene(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    schemaVersion: Literal[1] = Field(1, alias="schemaVersion")
    id: str
    sourceAssetId: str = Field(..., alias="sourceAssetId")
    width: int
    height: int
    objects: list[DepthObject]
    reconstructedPlate: ReconstructedPlate = Field(..., alias="reconstructedPlate")
    camera: CameraConfig = Field(default_factory=CameraConfig)
    timeline: TimelineConfig = Field(default_factory=TimelineConfig)
    createdAt: str = Field(..., alias="createdAt")
    updatedAt: str = Field(..., alias="updatedAt")
