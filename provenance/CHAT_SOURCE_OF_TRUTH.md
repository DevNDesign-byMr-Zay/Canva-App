# Project-chat source of truth

The application was created and iterated in the ROARYbyMr. Zay project chats. This document records only development facts recoverable from that chat history. It is intentionally separate from physical-file recovery so that chat-only evidence is not misrepresented as an original binary.

## Confirmed chronology

### Historical single-file Depthpop lineage

Drive contains 84 physical HTML source artifacts explicitly named for Depthpop, spanning v24 through v115. These are treated as the recoverable historical single-file application lineage. The version names document successive work on panel/layout behavior, live and instant previews, blob handling, depth fidelity, downloads, quality presets, progress UI, model selection, hover behavior, and the model drawer.

### 2026-03-14 — packaged Canva application

Project chat created `roary-depthpop-canva-complete.zip` containing the exact uploaded JSX, a Canvas V2 frontend, Backend V2, a legacy backend, setup files, and logo/image assets under `frontend/assets/`.

A later same-day package, `roary-depthpop-canva-clean-assets.zip`, superseded the asset bundle and reduced the retained assets to the logo image and a base64 logo representation.

The same project-chat package map identified:

- project root: the local `roary-canva/roary-depthpop` application directory
- frontend source of truth: `frontend/depthpop_canva_app_draft_v2_canvas.jsx`
- frontend reference: `frontend/depthpop_canva_app_draft_v_3_uploaded_exact.jsx`
- backend source of truth: `backend/depthpop_canva_backend_v2.ts`

Local personal filesystem prefixes are intentionally omitted from this repository.

### 2026-03-14 — Backend V3

A later chat created a `Depthpop Canva Backend V3` revision using Groq configuration and Llama 4 Scout, with `GROQ_API_KEY` supplied through environment configuration and health reporting updated for the Groq-backed vision path. This superseded the earlier V2 vision configuration.

### 2026-03-15 — backend replacement package

Project chat created `roary-depthpop-backend-replace.zip` with replacement files:

- `backend/src/server.ts`
- `package.json`
- `tsconfig.json`

The backend added image resize/compression, normalized model-provided bounds, and an `analysis.regions` output for image-specific regions.

### 2026-03-19 — local depth provider

The local depth provider was confirmed running on port 5152 using Depth Anything V2 Small via Hugging Face. The application backend was configured to select the local depth provider through environment configuration and consume it from the backend service rather than hardcoding credentials or endpoints into frontend code.

### 2026-03-24 — object-aware grouped depth rendering

The frontend auto-analyzed uploaded images, requested object/group polygons with object detections enabled, preferred object/vision regions when available, and rendered separate clipped grouped pieces for foreground, midground, and background manipulation. The backend generated object regions and assigned depth grouping.

The intended UX was Canva-style: an uploaded image should yield visible grouped foreground/midground/background objects that remain user-adjustable in the depth map.

### 2026-03-25 — rotation/perspective superseding patch

The project-chat artifact `depthpop_rotation_perspective_fix.zip` contained `DepthpopCanvaAppDraftV2.jsx` and `server.ts` and was the superseding patch at that point.

Confirmed implementation changes:

- normalized shortest-path easing for rotation
- pointer capture and cleanup for interaction stability
- preview propagation of `rotationY`, `perspective`, `layerReach`, `activeLayer`, and `previewVariants`
- backend camera targets and sequential generation
- generation constraint: perspective/depth changes must not add, remove, duplicate, or otherwise alter scene elements

### 2026-04-05 — exact-subject region and grouping fixes

The backend `server.ts` received a parse fix for the `buildExactSubjectRegions(...)` call. Subsequent output included `depthScore`, cleaner semantic regions, `layerHints`, and `groupedRegions`; the frontend initialized layers from detected regions and sent detected region IDs back to the backend.

The local backend package was identified as `roary-depthpop-canva-backend@0.3.0`, with development running through `tsx watch src/server.ts`.

### 2026-04-23 — restored breakdown / generation build

The latest rebuild at that point restored the stable full-body breakdown, forced the subject to Midground, retained generation-side depth-pop changes, and preserved the established animation, stage, and UI paths.

Exact chat-generated filenames remained:

- `server.ts`
- `DepthpopCanvaAppDraftV2.jsx`

### 2026-04-27 — layer-match generation revision

Project chat generated `ROARY_DEPTHPOP_LAYER_MATCH_GPT_v5.zip` containing:

- `DepthpopCanvaAppDraftV2.jsx`
- `server.ts`

This revision aligned previews to the same depth-layer positions and rotation, locked colors, and defaulted one generation path toward `openai/gpt-image-2/edit`.

### 2026-04-27 — pixel-lock revision

Project chat generated `ROARY_DEPTHPOP_PIXEL_LOCK_v6.zip`, again with `DepthpopCanvaAppDraftV2.jsx` and `server.ts`.

Confirmed changes:

- restored the Z-Image / Kontext direction
- added pixel-lock previews using original source pixels
- disabled model polish by default

A follow-up `ROARY_DEPTHPOP_PIXEL_LOCK_v6_1_MASKBOUNDS_FIX.zip` fixed a duplicate `maskBounds` defect and superseded the original v6 package.

## Recovery rule

When an exact chat-generated file can be physically recovered, it belongs under `app/` with a provenance entry. When only chat history survives, the implementation fact remains here and is **not** silently regenerated and labeled as historical source.

## Scope boundary

This archive is for the Canva Depthpop application. Unrelated product subsystems, later general-purpose UI experiments, and proprietary visualization work are not imported merely because they share a legacy product name.
