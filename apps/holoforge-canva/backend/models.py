from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

ExportFormat = Literal[
    "scene-json",
    "glb",
    "gltf",
    "usdz",
    "webm-alpha",
    "mp4",
    "png-sequence",
    "lightfield-quilt",
]
ExportProfile = Literal[
    "scene-authoring",
    "generic-3d",
    "ios-ar",
    "transparent-video",
    "image-sequence",
    "lightfield-quilt",
    "custom",
]
AnimationProperty = Literal["position", "rotation", "scale"]
Easing = Literal["linear", "ease-in", "ease-out", "ease-in-out"]
JobStatus = Literal["queued", "validating", "rendering", "packaging", "complete", "error"]


class Vec3(BaseModel):
    model_config = ConfigDict(extra="forbid")
    x: float
    y: float
    z: float


class SceneTransform(BaseModel):
    model_config = ConfigDict(extra="forbid")
    position: Vec3
    rotation: Vec3
    scale: Vec3

    @field_validator("scale")
    @classmethod
    def positive_scale(cls, value: Vec3) -> Vec3:
        if value.x <= 0 or value.y <= 0 or value.z <= 0:
            raise ValueError("scale components must be positive")
        return value


class HoloKeyframe(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, max_length=160)
    timeMs: int = Field(ge=0)
    value: Vec3
    easing: Easing


class HoloAnimationTrack(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, max_length=160)
    property: AnimationProperty
    keyframes: list[HoloKeyframe] = Field(default_factory=list)

    @field_validator("keyframes")
    @classmethod
    def ordered_keyframes(cls, value: list[HoloKeyframe]) -> list[HoloKeyframe]:
        times = [item.timeMs for item in value]
        if times != sorted(times):
            raise ValueError("keyframes must be sorted by time")
        if len(times) != len(set(times)):
            raise ValueError("keyframe times must be unique within a track")
        return value


class GeometrySpec(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["extruded-shape", "plane", "text", "mesh"]
    sourceUrl: str | None = None
    thickness: float = Field(ge=0, le=20)
    bevelSize: float = Field(ge=0, le=10)
    bevelSegments: int = Field(ge=0, le=32)
    meshUrl: str | None = None


class MaterialSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")
    family: Literal["iridescent", "glass", "foil", "metal", "pearl", "neon", "crystal"]
    baseColor: str = Field(min_length=1, max_length=128)
    opacity: float = Field(ge=0, le=1)
    metalness: float = Field(ge=0, le=1)
    roughness: float = Field(ge=0, le=1)
    transmission: float = Field(ge=0, le=1)
    ior: float = Field(gt=0, le=5)
    emissionColor: str = Field(min_length=1, max_length=128)
    emissionStrength: float = Field(ge=0, le=20)
    spectralShift: float = Field(ge=0, le=100)
    diffraction: float = Field(ge=0, le=2)
    scanlineStrength: float = Field(ge=0, le=2)
    shimmerStrength: float = Field(ge=0, le=2)
    reflectionStrength: float = Field(ge=0, le=100)


class HoloObject(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, max_length=160)
    name: str = Field(min_length=1, max_length=256)
    creationType: Literal["holo_text", "holo_logo", "holo_graphic", "glass", "chrome", "light_fx"]
    geometry: GeometrySpec
    material: MaterialSpec
    transform: SceneTransform
    animationPreset: Literal["static", "turntable", "shimmer", "sweep", "pulse", "orbit", "custom"]
    animationTracks: list[HoloAnimationTrack] = Field(default_factory=list)
    sourceText: str | None = Field(default=None, max_length=96)
    visible: bool = True


class HoloSource(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["raster", "vector", "text", "canva", "generated"]
    assetId: str | None = Field(default=None, max_length=512)
    previewUrl: str | None = None
    text: str | None = Field(default=None, max_length=96)

    @field_validator("previewUrl")
    @classmethod
    def safe_preview_url(cls, value: str | None) -> str | None:
        if value is None:
            return value
        # The first backend contract accepts embedded image data only. Remote Canva
        # temporary URLs must be uploaded explicitly in a later asset-manifest batch
        # rather than fetched server-side.
        if not value.startswith("data:image/"):
            raise ValueError("previewUrl must be an embedded image data URL")
        if len(value) > 20 * 1024 * 1024:
            raise ValueError("previewUrl exceeds the 20 MB encoded source limit")
        return value


class HoloEnvironment(BaseModel):
    model_config = ConfigDict(extra="forbid")
    background: str = Field(min_length=1, max_length=128)
    ambientIntensity: float = Field(ge=0, le=20)
    keyLightIntensity: float = Field(ge=0, le=20)
    rimLightIntensity: float = Field(ge=0, le=20)
    floorGrid: bool


class HoloCamera(BaseModel):
    model_config = ConfigDict(extra="forbid")
    position: Vec3
    target: Vec3
    fov: float = Field(gt=0, lt=180)
    near: float = Field(gt=0)
    far: float = Field(gt=0)

    @model_validator(mode="after")
    def validate_clip_range(self) -> "HoloCamera":
        if self.far <= self.near:
            raise ValueError("camera far plane must be greater than near plane")
        return self


class HoloTimeline(BaseModel):
    model_config = ConfigDict(extra="forbid")
    durationMs: int = Field(gt=0, le=60 * 60 * 1000)
    fps: int = Field(gt=0, le=120)
    currentTimeMs: int = Field(ge=0)
    playing: bool

    @model_validator(mode="after")
    def current_time_in_range(self) -> "HoloTimeline":
        if self.currentTimeMs > self.durationMs:
            raise ValueError("timeline currentTimeMs exceeds durationMs")
        return self


class HoloScene(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schemaVersion: Literal[1]
    id: str = Field(min_length=1, max_length=200)
    source: HoloSource
    objects: list[HoloObject] = Field(min_length=1, max_length=128)
    environment: HoloEnvironment
    camera: HoloCamera
    timeline: HoloTimeline
    exportProfile: Literal["generic-3d", "transparent-video", "lightfield-quilt", "custom"] | None = None

    @model_validator(mode="after")
    def validate_scene(self) -> "HoloScene":
        ids = [item.id for item in self.objects]
        if len(ids) != len(set(ids)):
            raise ValueError("HoloScene object IDs must be unique")
        for item in self.objects:
            for track in item.animationTracks:
                for keyframe in track.keyframes:
                    if keyframe.timeMs > self.timeline.durationMs:
                        raise ValueError("keyframe lies outside HoloScene timeline")
        return self


class Resolution(BaseModel):
    model_config = ConfigDict(extra="forbid")
    width: int = Field(ge=64, le=8192)
    height: int = Field(ge=64, le=8192)


class QuiltOptions(BaseModel):
    model_config = ConfigDict(extra="forbid")
    columns: int = Field(ge=1, le=32)
    rows: int = Field(ge=1, le=32)
    views: int = Field(ge=1, le=1024)
    viewAspect: float = Field(gt=0, le=10)

    @model_validator(mode="after")
    def fit_views(self) -> "QuiltOptions":
        if self.views > self.columns * self.rows:
            raise ValueError("quilt views exceed available tiles")
        return self


class HoloExportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schemaVersion: Literal[1]
    sceneId: str = Field(min_length=1, max_length=200)
    format: ExportFormat
    profile: ExportProfile
    includeAnimation: bool
    resolution: Resolution
    transparentBackground: bool
    quilt: QuiltOptions | None = None

    @model_validator(mode="after")
    def validate_format_profile(self) -> "HoloExportRequest":
        expected = {
            "scene-json": "scene-authoring",
            "glb": "generic-3d",
            "gltf": "generic-3d",
            "usdz": "ios-ar",
            "webm-alpha": "transparent-video",
            "mp4": "transparent-video",
            "png-sequence": "image-sequence",
            "lightfield-quilt": "lightfield-quilt",
        }[self.format]
        if self.profile != expected:
            raise ValueError(f"{self.format} requires profile {expected}")
        if self.format == "lightfield-quilt" and self.quilt is None:
            raise ValueError("lightfield-quilt requires quilt options")
        if self.format != "lightfield-quilt" and self.quilt is not None:
            raise ValueError("quilt options are only valid for lightfield-quilt")
        return self


class ExportSubmission(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scene: HoloScene
    request: HoloExportRequest

    @model_validator(mode="after")
    def matching_scene(self) -> "ExportSubmission":
        if self.scene.id != self.request.sceneId:
            raise ValueError("export request sceneId does not match scene")
        return self


class ExportJob(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    exportId: str
    userId: str
    brandId: str
    status: JobStatus
    stage: str
    percent: int = Field(ge=0, le=100)
    message: str
    error: str | None = None
    createdAt: str
    updatedAt: str


class ExportArtifact(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    userId: str
    brandId: str
    format: ExportFormat
    profile: ExportProfile
    fileName: str
    mimeType: str
    path: str
    sizeBytes: int = Field(ge=0)
    createdAt: str
    expiresAt: str


class CreateExportResponse(BaseModel):
    jobId: str
    exportId: str
    status: JobStatus


class ExportStatusResponse(BaseModel):
    exportId: str
    status: JobStatus
    downloadUrl: str | None = None
    fileName: str | None = None
    mimeType: str | None = None
    sizeBytes: int | None = None
    expiresAt: str | None = None
    error: str | None = None


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id(prefix: str) -> str:
    return prefix + "_" + uuid4().hex
