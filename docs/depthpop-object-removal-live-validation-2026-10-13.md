# DepthPop live fal verification — October 13, 2026

This note records bounded integration tests; do not commit provider credentials or private image payloads.

## Verified successful stages
- Florence-2 object detection: returned usable product detection, alongside one incorrect toothbrush classification.
- SAM-3 image segmentation: returned a product mask at **0.98046875 confidence**.
- Depth Anything V2: returned a grayscale depth map at source dimensions.
- **Mask-guided product removal:** `fal-ai/object-removal/mask`, request `01a133a5-a98a-72c1-9b47-0e06e30e8945`, completed with a **447 × 447 PNG** and a visibly removed foreground lip-gloss bottle. The open-space shelving and reflective bowl remained visible.

## Verified unsuccessful stages
- `fal-ai/inpaint` / SDXL: returned images with a retained or distorted foreground product, and the GitHub paid smoke run timed out on this endpoint.
- GitHub inpaint-only run `38348718546`: HTTP 504 after uploading inputs successfully. The repository secret named `FAL` was accessible, but the legacy model request timed out.
- `fal-ai/flux-pro/v1/fill`, request `01a133a1-3ff7-7611-b94e-cd3dbee9a650`: the call completed but retained a cosmetic bottle, so **visual removal failed**.

## Production changes
- Replace `fal-ai/inpaint` with `fal-ai/object-removal/mask` for automatic plate reconstruction.
- Continue using image and mask uploads to fal's media service. Pass only `image_url`, `mask_url`, `model=best_quality`, and `mask_expansion=20`.
- Parse the verified `images[0].url` output contract and protect source pixels outside the edit mask.
- Run Florence → SAM → Depth → dedicated object removal in the explicit paid smoke.
- **Do not equate response HTTP 200 with visually acceptable output**; both automatic and human visual quality review are needed.

The product-photo test used a Canva thumbnail, not a full-resolution raster export. A full-resolution live Canva acceptance pass and authenticated export round-trip remain separate gates.
