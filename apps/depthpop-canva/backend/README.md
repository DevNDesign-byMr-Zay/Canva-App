# DepthPop backend

DepthPop is the production backend for the standalone DepthPop Canva app.

The primary product path is the authenticated **DepthScene v1** object-scene API. The historical flat DepthPop render remains available for compatibility, but the Canva app now creates an editable object-aware scene, persists edits, renders the authored composition, and applies the resulting PNG back into Canva.

## Primary DepthScene API

    POST  /api/v1/scenes
    GET   /api/v1/jobs/{jobId}
    GET   /api/v1/scenes/{sceneId}
    PATCH /api/v1/scenes/{sceneId}
    POST  /api/v1/scenes/{sceneId}/composite
    GET   /api/v1/assets/{assetId}

Every v1 route requires a verified Canva user JWT. Scene, job, and generated-asset access is scoped to the exact Canva user and brand.

The primary production flow is:

1. Canva supplies a selected raster or the user supplies a local PNG/JPEG/WebP.
2. The Canva app sends the actual image bytes to the authenticated scene API.
3. Florence-2 detects scene objects through fal.ai.
4. SAM 3 creates object masks from structured box prompts.
5. Depth Anything V2 produces relative disparity. The provider adapter converts it to the canonical DepthPop convention: **0.0 = far, 1.0 = near**.
6. Object cutouts, masks, thumbnails, canonical depth, and the source are stored as random, scene-owned protected assets.
7. When requested, fal.ai inpainting reconstructs the plate using the union foreground mask; white mask pixels are regenerated and black pixels are preserved.
8. The backend returns a canonical DepthScene v1 with editable X/Y/Z, scale, rotation, opacity, feather, visibility, lock, layer order, camera, and timeline state.
9. PATCH persists only the editable scene fields.
10. /composite renders the latest persisted authored scene to raw PNG bytes.
11. The Canva client uploads that PNG as a derived asset and replaces the original selected source when it is still selected; otherwise it inserts the render as a new element.

## Production providers

Current production integrations:

- object detection: fal-ai/florence-2-large/object-detection
- segmentation: fal-ai/sam-3/image
- depth: fal-ai/image-preprocessors/depth-anything/v2
- background reconstruction: fal-ai/inpaint
- inpainting base model: diffusers/stable-diffusion-xl-1.0-inpainting-0.1

Provider selection fails closed in production. Mock providers are available only in tests or explicit non-production local development.

DEPTHPOP_ALLOW_BBOX_FALLBACK=false is the recommended production setting. When explicitly enabled, any rectangular fallback is surfaced in the scene as extractionQuality=bbox_fallback instead of being presented as a real SAM mask.

Depth quality is real and bounded:

- standard: source preprocessing is capped at a 768 px maximum edge;
- high: source preprocessing is capped at a 1536 px maximum edge.

Regardless of provider output resolution, canonical depth is resized back to the exact source dimensions before masks index into it.

## Restart-safe persistence

DepthPop supports two repository backends:

- `memory` for deterministic tests and explicit local development;
- `sqlite` for the production single-service profile.

Production should mount persistent storage and configure:

    DEPTHPOP_REPOSITORY_BACKEND=sqlite
    DEPTHPOP_DATABASE_PATH=/data/depthpop/depthpop.sqlite3
    DEPTHPOP_ASSET_ROOT=/data/depthpop/assets

Scene/job metadata is stored in SQLite while binary scene assets are stored beneath the owned asset root. On restart, completed scenes/jobs remain available until TTL expiry and incomplete queued/processing jobs are recovered to a truthful terminal error instead of remaining stuck forever.

This SQLite profile is intentionally scoped to a persistent single-service deployment. It does not claim distributed multi-writer rendering; a future PostgreSQL/object-storage adapter can implement the same repository contracts without changing DepthScene/API contracts.

## Protected asset lifecycle

Generated scene media does not use the public compatibility cache.

Each scene asset has an opaque random resource ID, scene ID, Canva user ID, Canva brand ID, MIME type, size, creation time, and SHA-256 integrity digest. The digest is not the resource ID. Identical bytes owned by two users still receive different resource IDs.

When a scene expires or is capacity-evicted, its assets are synchronously removed. Job, scene, and asset repositories all enforce bounded capacity at insertion time.

## Compatibility route

The historical single-image DepthPop render remains available as:

    POST /api/depthpop
    POST /tool/depth_pop
    POST /tool/depthpop
    POST /tool/enhance
    GET  /tool/progress/{progress_id}

That path remains isolated from the primary object-scene workflow.

## Configuration

See .env.example.

Required production values:

    CANVA_APP_ID=<DepthPop Canva app id>
    CANVA_APP_ORIGIN=<optional explicit allowed Canva app iframe origin>
    DEPTHPOP_DEV_ORIGINS=http://localhost:8080
    FAL_KEY=<server-side fal key>
    PUBLIC_BASE_URL=https://your-public-depthpop-backend.example
    ENVIRONMENT=production
    SEGMENTATION_PROVIDER=auto
    DEPTH_PROVIDER=auto
    INPAINT_PROVIDER=auto
    DEPTHPOP_ALLOW_BBOX_FALLBACK=false
    DEPTHPOP_REPOSITORY_BACKEND=sqlite
    DEPTHPOP_DATABASE_PATH=/data/depthpop/depthpop.sqlite3
    DEPTHPOP_ASSET_ROOT=/data/depthpop/assets

PUBLIC_BASE_URL should be the same backend origin configured by the Canva app. Protected scene assets reject cross-origin bearer-token delivery in the client.

The FAL key is server-side only. The browser never receives it and the backend never accepts provider keys from request headers.

## Local verification

Linux/macOS:

    python -m venv .venv
    .venv/bin/pip install -r requirements.txt
    .venv/bin/pytest -q
    .venv/bin/uvicorn app:app --host 0.0.0.0 --port 8081 --reload

Windows PowerShell:

    py -m venv .venv
    .\.venv\Scripts\python -m pip install -r requirements.txt
    .\.venv\Scripts\python -m pytest -q
    .\.venv\Scripts\python -m uvicorn app:app --host 0.0.0.0 --port 8081 --reload

For Canva testing, expose the backend over public HTTPS and set the frontend backend host to that exact origin.

## Security boundaries

- all v1 requests require a valid Canva user JWT;
- production CORS is restricted to the derived lowercase Canva app origin plus explicitly configured development origins; arbitrary origins are not authorized;
- CANVA_APP_ID is enforced as JWT audience;
- source image bytes are uploaded by the client rather than fetched from an arbitrary user-controlled URL;
- accepted source inputs are PNG, JPEG, and WebP, capped at 50 MB;
- provider downloads are restricted to fixed fal.media HTTPS origins and redirects are rejected;
- scene assets are private, no-store, and owner-scoped;
- mock AI providers are disabled in production;
- provider errors remain visible instead of silently falling back to fake production output;
- FAL_KEY is never returned to the frontend.

The historical Drive router remains under ../reference/drive-source as provenance only and is excluded from the handoff ZIP.
