# Independent Canva apps

This repository contains two independent Canva Design Editor applications:

- `apps/holoforge-canva/` — HoloForge holographic material and spatial design studio.
- `apps/depthpop-canva/` — DepthPop object-aware spatial image editor with an authenticated production backend.

Each app has its own package metadata, Canva manifest, source entrypoint, tests, production build, preview, and Developer Portal deployment boundary. Neither production app uses the historical runtime product switcher or the `__MRZAY_CANVA_PRODUCT__` global.

The older `canva-app/` directory remains only for compatibility and historical release continuity. New product development belongs under the two independent app roots above.

## Current product boundaries

### HoloForge

HoloForge owns:

- SOURCE → CREATE → SPATIAL → VERIFY;
- React Three Fiber / Three.js spatial authoring;
- holographic materials and source geometry;
- object/camera/material editing;
- keyframed animation;
- HoloScene JSON round-trip;
- authenticated Blender-backed PNG, GLB/glTF, USDZ, WebM/MP4, PNG-sequence and light-field exports.

### DepthPop

DepthPop owns:

- selected Canva raster or local raster input;
- authenticated Florence-2 detection, SAM segmentation, Depth Anything V2 depth and optional inpainting;
- canonical DepthScene v1 persistence;
- React Three Fiber / Three.js object-scene editing;
- X/Y/Z transforms, camera controls and 4D keyframe animation;
- rename/duplicate/delete/merge/split object operations;
- Render to Canva;
- portable scene JSON, PNG-layer ZIP, glTF/GLB and WebM/MP4 exports.

## Complete handoff artifacts

The `Separate Canva apps` workflow produces exactly two final handoff ZIPs:

- `HoloForge-Canva-App.zip`
- `DepthPop-Canva-App.zip`

Each handoff archive contains a root-level `app.js`, its own Canva manifest, app documentation/source needed for handoff, and the matching backend runtime where applicable.

The final ZIPs deliberately exclude:

- `node_modules`;
- Git metadata;
- credentials and populated `.env` files;
- SQLite databases;
- generated user assets or render artifacts;
- historical authenticated ROARY/ÆTHER app material;
- `apps/depthpop-canva/reference/drive-source/` provenance.

Historical source/provenance remains repository-only.

Inside Canva Developer Portal, upload only the root-level `app.js` from the matching handoff ZIP. Backend services are deployed separately and connected through the app's production environment configuration.
