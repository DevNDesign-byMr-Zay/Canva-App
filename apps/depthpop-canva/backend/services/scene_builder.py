from __future__ import annotations

import io
import time
import uuid
from typing import Awaitable, Callable

import numpy as np
from PIL import Image

from models.object import DepthObject
from models.scene import (
    CameraConfig,
    DepthScene,
    ReconstructedPlate,
    TimelineConfig,
)
from services.depth import DepthService
from services.inpainting import InpaintingService
from services.object_builder import build_depth_object
from services.segmentation import SegmentationService

StageReporter = Callable[[str, float], Awaitable[None]]
AssetUrlBuilder = Callable[[bytes, str], str]


class SceneBuilderService:
    def __init__(
        self,
        segmentation_service: SegmentationService | None = None,
        depth_service: DepthService | None = None,
        inpainting_service: InpaintingService | None = None,
    ):
        self.segmentation_service = (
            segmentation_service or SegmentationService()
        )
        self.depth_service = depth_service or DepthService()
        self.inpainting_service = (
            inpainting_service or InpaintingService()
        )

    async def build_scene(
        self,
        image_bytes: bytes,
        source_asset_id: str,
        url_builder: AssetUrlBuilder,
        max_objects: int = 24,
        segmentation_mode: str = "auto",
        depth_quality: str = "high",
        inpaint: bool = True,
        stage_reporter: StageReporter | None = None,
        scene_id: str | None = None,
    ) -> DepthScene:
        if stage_reporter:
            await stage_reporter("decoding", 0.10)

        with Image.open(io.BytesIO(image_bytes)) as image:
            width, height = image.size
            source_png = io.BytesIO()
            image.convert("RGBA").save(
                source_png,
                format="PNG",
                optimize=True,
            )
            source_png_bytes = source_png.getvalue()

        if stage_reporter:
            await stage_reporter("segmenting_objects", 0.25)
        segmented = await self.segmentation_service.segment_objects(
            image_bytes,
            max_objects=max_objects,
            mode=segmentation_mode,
        )

        if stage_reporter:
            await stage_reporter("estimating_depth", 0.50)
        depth_map = await self.depth_service.estimate_depth(
            image_bytes,
            quality=depth_quality,
        )
        if depth_map.depth_array.shape != (height, width):
            raise ValueError(
                "canonical depth dimensions do not match source image"
            )

        if stage_reporter:
            await stage_reporter("extracting_objects", 0.70)

        raw_objects: list[DepthObject] = []
        label_counts: dict[str, int] = {}
        for segmented_object in segmented[:max_objects]:
            slug = (
                "".join(
                    char if char.isalnum() else "_"
                    for char in segmented_object.label.lower()
                ).strip("_")
                or "object"
            )
            count = label_counts.get(slug, 0) + 1
            label_counts[slug] = count
            raw_objects.append(
                build_depth_object(
                    seg_obj=segmented_object,
                    source_image=image_bytes,
                    depth_array=depth_map.depth_array,
                    url_builder=url_builder,
                    index=count,
                )
            )

        seen_ids: set[str] = set()
        objects: list[DepthObject] = []
        for obj in raw_objects:
            candidate = obj.id
            suffix = 2
            while candidate in seen_ids:
                base = obj.id.rsplit("_", 1)[0]
                candidate = f"{base}_{suffix:02d}"
                suffix += 1
            seen_ids.add(candidate)
            objects.append(
                obj
                if candidate == obj.id
                else obj.model_copy(update={"id": candidate})
            )

        # Back-to-front ordering: canonical 0 is far, 1 is near.
        objects.sort(key=lambda item: item.depth.median)
        for order, obj in enumerate(objects):
            obj.order = order

        if stage_reporter:
            await stage_reporter("reconstructing_plate", 0.85)

        if inpaint and objects:
            union_mask = np.zeros((height, width), dtype=bool)
            for segmented_object in segmented:
                if segmented_object.mask_array is None:
                    continue
                mask_array = np.asarray(
                    segmented_object.mask_array,
                    dtype=bool,
                )
                if mask_array.shape != (height, width):
                    mask_image = Image.fromarray(
                        (mask_array * 255).astype(np.uint8),
                        mode="L",
                    ).resize(
                        (width, height),
                        Image.Resampling.NEAREST,
                    )
                    mask_array = np.asarray(mask_image) > 127
                union_mask |= mask_array

            union_image = Image.fromarray(
                (union_mask * 255).astype(np.uint8),
                mode="L",
            )
            union_buffer = io.BytesIO()
            union_image.save(union_buffer, format="PNG")
            plate_bytes = await self.inpainting_service.inpaint_plate(
                image_bytes,
                union_buffer.getvalue(),
            )
        else:
            plate_bytes = source_png_bytes

        plate_url = url_builder(plate_bytes, "image/png")
        depth_map_url = url_builder(
            depth_map.canonical_depth,
            "image/png",
        )

        if stage_reporter:
            await stage_reporter("building_scene", 0.95)

        now_string = time.strftime(
            "%Y-%m-%dT%H:%M:%SZ",
            time.gmtime(),
        )
        return DepthScene(
            schemaVersion=1,
            id=scene_id or f"scene_{uuid.uuid4().hex[:12]}",
            sourceAssetId=source_asset_id,
            width=width,
            height=height,
            objects=objects,
            reconstructedPlate=ReconstructedPlate(
                imageUrl=plate_url,
                depthMapUrl=depth_map_url,
            ),
            camera=CameraConfig(),
            timeline=TimelineConfig(),
            createdAt=now_string,
            updatedAt=now_string,
        )
