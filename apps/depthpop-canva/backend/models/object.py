from __future__ import annotations

import math
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

SemanticType = Literal[
    "person",
    "logo",
    "text",
    "product",
    "building",
    "vehicle",
    "prop",
    "unknown",
]

ExtractionQuality = Literal["mask", "bbox_fallback"]
AnimationProperty = Literal[
    "position.x",
    "position.y",
    "position.z",
    "rotation.x",
    "rotation.y",
    "rotation.z",
    "scale.x",
    "scale.y",
    "scale.z",
    "opacity",
]
AnimationEasing = Literal["linear", "ease-in", "ease-out", "ease-in-out"]


class Vector3(BaseModel):
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0

    @field_validator("x", "y", "z")
    @classmethod
    def check_finite(cls, v: float) -> float:
        if not math.isfinite(v):
            raise ValueError("Vector3 coordinates must be finite float numbers")
        return v


class BBox(BaseModel):
    x: float
    y: float
    width: float = Field(..., gt=0.0)
    height: float = Field(..., gt=0.0)

    @field_validator("x", "y", "width", "height")
    @classmethod
    def check_finite(cls, v: float) -> float:
        if not math.isfinite(v):
            raise ValueError("BBox values must be finite float numbers")
        return v


class ObjectAssets(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    cutoutUrl: str = Field(..., alias="cutoutUrl")
    maskUrl: str = Field(..., alias="maskUrl")
    thumbnailUrl: str = Field(..., alias="thumbnailUrl")


class ObjectDepthStats(BaseModel):
    mean: float = Field(..., ge=0.0, le=1.0)
    median: float = Field(..., ge=0.0, le=1.0)
    min: float = Field(..., ge=0.0, le=1.0)
    max: float = Field(..., ge=0.0, le=1.0)


class ObjectTransform(BaseModel):
    position: Vector3 = Field(default_factory=Vector3)
    rotation: Vector3 = Field(default_factory=Vector3)
    scale: Vector3 = Field(default_factory=lambda: Vector3(x=1.0, y=1.0, z=1.0))


class AnimationKeyframe(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    timeMs: int = Field(..., ge=0, alias="timeMs")
    value: float
    easing: AnimationEasing = "linear"

    @field_validator("value")
    @classmethod
    def finite_value(cls, value: float) -> float:
        if not math.isfinite(value):
            raise ValueError("animation keyframe value must be finite")
        return value


class AnimationTrack(BaseModel):
    id: str = Field(..., min_length=1, max_length=160)
    property: AnimationProperty
    keyframes: list[AnimationKeyframe] = Field(..., min_length=1)

    @model_validator(mode="after")
    def validate_track(self) -> "AnimationTrack":
        previous = -1
        for keyframe in self.keyframes:
            if keyframe.timeMs <= previous:
                raise ValueError(
                    "animation keyframe times must be unique and strictly increasing"
                )
            if self.property == "opacity" and not 0.0 <= keyframe.value <= 1.0:
                raise ValueError("opacity animation values must remain within 0..1")
            previous = keyframe.timeMs
        return self


class DepthObject(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., min_length=1)
    label: str = Field(..., min_length=1)
    semanticType: SemanticType = Field(..., alias="semanticType")
    extractionQuality: ExtractionQuality = Field("mask", alias="extractionQuality")
    confidence: float = Field(..., ge=0.0, le=1.0)
    bbox: BBox
    assets: ObjectAssets
    depth: ObjectDepthStats
    transform: ObjectTransform = Field(default_factory=ObjectTransform)
    opacity: float = Field(1.0, ge=0.0, le=1.0)
    feather: float = Field(0.0, ge=0.0, le=100.0)
    visible: bool = True
    locked: bool = False
    order: int = Field(..., ge=0)
    animationTracks: list[AnimationTrack] = Field(
        default_factory=list,
        alias="animationTracks",
    )
