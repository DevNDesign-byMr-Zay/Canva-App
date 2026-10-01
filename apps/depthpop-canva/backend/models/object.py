from __future__ import annotations

import math
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator

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


class DepthObject(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., min_length=1)
    label: str = Field(..., min_length=1)
    semanticType: SemanticType = Field(..., alias="semanticType")
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
    animationTracks: list[Any] = Field(default_factory=list, alias="animationTracks")
