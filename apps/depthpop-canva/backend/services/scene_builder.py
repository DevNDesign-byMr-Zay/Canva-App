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


class SceneBuilderService:
    def __init__(
        self,
        segmentation_service: SegmentationService | None = None,
        depth_service: DepthService | None = None,
        inpainting_service: InpaintingService | None = None,
    ):
        self.seg_service = segmentation_service or SegmentationService()
        self.depth_service = depth_service or DepthService()
        self.inpaint_service = inpainting_service or InpaintingService()

    async def build_scene(
        self,
        image_bytes: bytes,
        source_asset_id: str,
        url_builder: Callable[[bytes, str], str],
        max_objects: int = 24,
        segmentation_mode: str = "auto",
        depth_quality: str = "high",
        inpaint: bool = True,
        stage_reporter: StageReporter | None = None,
    ) -> DepthScene:
        # 1. Decoding
        if stage_reporter:
            await stage_reporter("decoding", 0.10)

        with Image.open(io.BytesIO(image_bytes)) as img:
            width, height = img.size

        # 2. Segmenting objects
        if stage_reporter:
            await stage_reporter("segmenting_objects", 0.25)
        segmented_objs = await self.seg_service.segment_objects(image_bytes, max_objects=max_objects)

        # 3. Estimating depth
        if stage_reporter:
            await stage_reporter("estimating_depth", 0.50)
        depth_map = await self.depth_service.estimate_depth(image_bytes)

        # 4. Extracting objects
        if stage_reporter:
            await stage_reporter("extracting_objects", 0.70)

        raw_objects: list[DepthObject] = []
        id_counts: dict[str, int] = {}

        for seg_obj in segmented_objs[:max_objects]:
            slug = seg_obj.label.lower().replace(" ", "_").strip() or "object"
            count = id_counts.get(slug, 0) + 1
            id_counts[slug] = count

            obj = build_depth_object(
                seg_obj=seg_obj,
                source_image=image_bytes,
                depth_array=depth_map.depth_array,
                url_builder=url_builder,
                index=count,
            )
            raw_objects.append(obj)

        # ID Uniqueness
        seen_ids: set[str] = set()
        final_objects: list[DepthObject] = []
        for obj in raw_objects:
            new_id = obj.id
            collision_counter = 1
            while new_id in seen_ids:
                parts = obj.id.rsplit("_", 1)
                base = parts[0] if len(parts) > 1 else obj.id
                new_id = f"{base}_{collision_counter + 1:02d}"
                collision_counter += 1
            seen_ids.add(new_id)
            if new_id != obj.id:
                obj = obj.model_copy(update={"id": new_id})
            final_objects.append(obj)

        # Order by measured depth
        final_objects.sort(key=lambda o: o.depth.median, reverse=True)
        for idx, obj in enumerate(final_objects):
            obj.order = idx

        # 5. Reconstructing plate
        if stage_reporter:
            await stage_reporter("reconstructing_plate", 0.85)

        if inpaint and final_objects:
            union_mask = np.zeros((height, width), dtype=bool)
            for seg_obj in segmented_objs:
                if seg_obj.mask_array is not None and seg_obj.mask_array.shape == (height, width):
                    union_mask |= seg_obj.mask_array

            union_mask_img = Image.fromarray((union_mask * 255).astype(np.uint8), mode="L")
            u_buf = io.BytesIO()
            union_mask_img.save(u_buf, format="PNG")

            plate_bytes = await self.inpaint_service.inpaint_plate(image_bytes, u_buf.getvalue())
            plate_url = url_builder(plate_bytes, "image/png")
        else:
            plate_url = url_builder(image_bytes, "image/png")

        depth_map_url = depth_map.provider_url or url_builder(depth_map.raw_depth, "image/png")

        # 6. Building scene
        if stage_reporter:
            await stage_reporter("building_scene", 0.95)

        scene_id = f"scene_{uuid.uuid4().hex[:12]}"
        now_str = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        scene = DepthScene(
            schemaVersion=1,
            id=scene_id,
            sourceAssetId=source_asset_id,
            width=width,
            height=height,
            objects=final_objects,
            reconstructedPlate=ReconstructedPlate(
                imageUrl=plate_url,
                depthMapUrl=depth_map_url,
            ),
            camera=CameraConfig(),
            timeline=TimelineConfig(),
            createdAt=now_str,
            updatedAt=now_str,
        )

        return scene
