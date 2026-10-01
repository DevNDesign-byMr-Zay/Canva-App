from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator
from models.object import DepthObject, DepthObjectPatch, Vector3


class ReconstructedPlate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    imageUrl: str = Field(..., alias="imageUrl")
    depthMapUrl: str = Field(..., alias="depthMapUrl")


class CameraConfig(BaseModel):
    position: Vector3 = Field(default_factory=lambda: Vector3(x=0.0, y=0.0, z=5.0))
    target: Vector3 = Field(default_factory=lambda: Vector3(x=0.0, y=0.0, z=0.0))
    fov: float = Field(50.0, ge=1.0, le=180.0)


class CameraConfigPatch(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    position: Vector3 | None = None
    target: Vector3 | None = None
    fov: float | None = Field(None, ge=1.0, le=180.0)


class TimelineConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    durationMs: int = Field(0, ge=0, alias="durationMs")
    fps: int = Field(30, ge=1, le=120)
    currentTimeMs: int = Field(0, ge=0, alias="currentTimeMs")


class TimelineConfigPatch(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    durationMs: int | None = Field(None, ge=0, alias="durationMs")
    fps: int | None = Field(None, ge=1, le=120)
    currentTimeMs: int | None = Field(None, ge=0, alias="currentTimeMs")


class DepthScene(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    schemaVersion: Literal[1] = Field(1, alias="schemaVersion")
    id: str = Field(..., min_length=1)
    userId: str = Field("", alias="userId")
    brandId: str = Field("", alias="brandId")
    sourceAssetId: str = Field(..., min_length=1, alias="sourceAssetId")
    width: int = Field(..., gt=0)
    height: int = Field(..., gt=0)
    objects: list[DepthObject]
    reconstructedPlate: ReconstructedPlate = Field(..., alias="reconstructedPlate")
    camera: CameraConfig = Field(default_factory=CameraConfig)
    timeline: TimelineConfig = Field(default_factory=TimelineConfig)
    createdAt: str = Field(..., alias="createdAt")
    updatedAt: str = Field(..., alias="updatedAt")

    @field_validator("objects")
    @classmethod
    def check_unique_object_ids(cls, objects: list[DepthObject]) -> list[DepthObject]:
        seen_ids = set()
        for obj in objects:
            if obj.id in seen_ids:
                raise ValueError(f"Duplicate object ID '{obj.id}' found in DepthScene")
            seen_ids.add(obj.id)
        return objects


class DepthScenePatch(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    objects: list[DepthObjectPatch] | None = None
    camera: CameraConfigPatch | None = None
    timeline: TimelineConfigPatch | None = None
