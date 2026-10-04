from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from models.object import DepthObject, Vector3

RenderQuality = Literal["fast", "balanced", "cinematic"]
QUALITY_STEPS: dict[str, int] = {
    "fast": 14,
    "balanced": 22,
    "cinematic": 34,
}


class ReconstructedPlate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    imageUrl: str = Field(..., alias="imageUrl")
    depthMapUrl: str = Field(..., alias="depthMapUrl")


class CameraConfig(BaseModel):
    position: Vector3 = Field(default_factory=lambda: Vector3(x=0.0, y=0.0, z=5.0))
    target: Vector3 = Field(default_factory=lambda: Vector3(x=0.0, y=0.0, z=0.0))
    fov: float = Field(50.0, ge=1.0, lt=180.0)


class TimelineConfig(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    durationMs: int = Field(0, ge=0, alias="durationMs")
    fps: int = Field(30, ge=1, le=120)
    currentTimeMs: int = Field(0, ge=0, alias="currentTimeMs")


class DepthPopSceneSettings(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    depthStrength: float = Field(0.32, ge=0.05, le=0.75, alias="depthStrength")
    depthBlur: int = Field(35, ge=0, le=100, alias="depthBlur")
    depthFidelity: float = Field(0.95, ge=0.05, le=1.0, alias="depthFidelity")
    renderQuality: RenderQuality = Field("cinematic", alias="renderQuality")
    numInferenceSteps: int = Field(34, alias="numInferenceSteps")

    @model_validator(mode="after")
    def exact_quality_step_mapping(self) -> "DepthPopSceneSettings":
        expected = QUALITY_STEPS[self.renderQuality]
        if self.numInferenceSteps != expected:
            raise ValueError(
                f"{self.renderQuality} quality requires {expected} inference steps"
            )
        return self


class DepthScene(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    schemaVersion: Literal[1] = Field(1, alias="schemaVersion")
    id: str = Field(..., min_length=1)
    userId: str = Field("", alias="userId")
    brandId: str = Field("", alias="brandId")
    sourceAssetId: str = Field(..., min_length=1, alias="sourceAssetId")
    width: int = Field(..., gt=0)
    height: int = Field(..., gt=0)
    settings: DepthPopSceneSettings = Field(default_factory=DepthPopSceneSettings)
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

    @model_validator(mode="after")
    def check_animation_times(self) -> "DepthScene":
        duration = self.timeline.durationMs
        for obj in self.objects:
            for track in obj.animationTracks:
                for keyframe in track.keyframes:
                    if keyframe.timeMs > duration:
                        raise ValueError(
                            "animation keyframe time cannot exceed timeline duration"
                        )
        return self
