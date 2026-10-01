from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field

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


class BBox(BaseModel):
    x: float
    y: float
    width: float
    height: float


class ObjectAssets(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    cutoutUrl: str = Field(..., alias="cutoutUrl")
    maskUrl: str = Field(..., alias="maskUrl")
    thumbnailUrl: str = Field(..., alias="thumbnailUrl")


class ObjectDepthStats(BaseModel):
    mean: float
    median: float
    min: float
    max: float


class ObjectTransform(BaseModel):
    position: Vector3 = Field(default_factory=Vector3)
    rotation: Vector3 = Field(default_factory=Vector3)
    scale: Vector3 = Field(default_factory=lambda: Vector3(x=1.0, y=1.0, z=1.0))


class DepthObject(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    label: str
    semanticType: SemanticType = Field(..., alias="semanticType")
    confidence: float
    bbox: BBox
    assets: ObjectAssets
    depth: ObjectDepthStats
    transform: ObjectTransform = Field(default_factory=ObjectTransform)
    opacity: float = 1.0
    feather: float = 0.0
    visible: bool = True
    locked: bool = False
    order: int
    animationTracks: list[Any] = Field(default_factory=list, alias="animationTracks")
