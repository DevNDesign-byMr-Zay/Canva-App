# HoloForge render/export backend

This service is the server-side boundary for heavyweight HoloForge exports.

## Current real capabilities

- authenticated Canva-user export submission;
- strict server-side validation of HoloScene schema v1;
- per-user/per-brand job and artifact ownership;
- bounded TTL-backed job/artifact repositories;
- actual server-side HoloScene JSON artifacts;
- Blender adapter contract for GLB, glTF, USDZ, transparent static PNG, transparent VP9 WebM, MP4, PNG-sequence, and multi-view light-field quilt exports;
- fail-closed behavior when Blender is not configured;
- authenticated artifact status and download endpoints.

The service does not pretend that USDZ or light-field quilt generation are complete. Those require dedicated conversion/device adapters and remain unavailable until implemented. Transparent WebM is now a real worker output: Blender renders RGBA frames and FFmpeg/libvpx-vp9 encodes them with an alpha plane.

## API

- `GET /health`
- `POST /api/v1/exports`
- `GET /api/v1/jobs/{jobId}`
- `GET /api/v1/exports/{exportId}`
- `GET /api/v1/exports/{exportId}/download`

All `/api/v1/*` routes require a fresh Canva user JWT.

## Blender

Set `BLENDER_BIN` to an installed Blender binary. The backend never bundles a fake renderer. If Blender is absent, only `scene-json` is reported as supported.

The dedicated worker lives in `blender_worker.py` and is invoked with a temporary validated job payload. Production deployment can later split this worker into a separate GPU/render container without changing the API contract.


## Spectral material parity

The production Blender worker now maps HoloScene material families through a normalized spectral profile before rendering. Foil, iridescent, pearl, neon and sufficiently diffractive materials receive a view-angle-driven spectrum ramp instead of collapsing to a single flat RGB value.

The worker also normalizes family-specific metallic, roughness, transmission, IOR, coat and emission behavior so the server render more closely follows the live Three.js studio while remaining deterministic. Glass/crystal prioritize transmission; foil/metal prioritize reflection; neon prioritizes emission. Renderer values are clamped before they reach Blender.

The pure-Python `spectral_material.py` contract is independently tested, and any change to it triggers the heavyweight Blender render smoke.

## Raster source geometry

Transparent PNG/WebP source graphics are no longer automatically exported as rectangular slabs.

For raster sources, the Blender worker now:

1. downsamples a copy of the decoded image for bounded alpha analysis;
2. creates an alpha mask;
3. traces disconnected visible contours;
4. removes tiny components and simplifies the remaining contours;
5. normalizes those contours into HoloForge scene coordinates;
6. creates a filled 2D Blender curve from the contours;
7. extrudes/bevels the curve into 3D geometry;
8. converts it to a mesh and applies the HoloForge material;
9. places the original transparent source texture on the front surface for visual identity.

The worker records `holoforge_geometry=alpha-extruded` on successful silhouette geometry.

Fully opaque images (including typical JPEG sources), nearly empty alpha images, or images whose contour analysis cannot produce useful geometry deliberately use `holoforge_geometry=plate-fallback`. HoloForge does not invent a silhouette where the source provides no meaningful transparency boundary.

The contour engine lives in `source_geometry.py` and has pure-Python tests, so contour behavior can be validated without launching Blender.

## Production render image

The lightweight `Dockerfile` intentionally starts without Blender and therefore reports only `scene-json` as available.

For a render-capable deployment use:

```bash
docker compose -f docker-compose.render.yml up --build
```

`Dockerfile.render` pins Blender 4.5.14 LTS, retrieves the official Linux x64 archive and matching SHA-256 manifest from Blender's release service, verifies the archive, and exposes it as:

```text
BLENDER_BIN=/opt/blender/blender
```

The render-capable health response will advertise:

```text
scene-json
glb
gltf
usdz
png-still
webm-alpha
mp4
png-sequence
lightfield-quilt
```

Run an isolated real-GLB worker smoke inside the image with:

```bash
python render_smoke.py
```

This smoke invokes Blender headlessly, requires a non-empty `.glb`, renders a transparent VP9 `.webm`, verifies the VP9 stream, and extracts a real alpha plane from the encoded WebM with FFmpeg.


## Light-field quilt contract

The v1 renderer accepts a bounded quilt layout containing `columns`, `rows`, `views`, `viewAspect`, and `viewConeDegrees`.

The Canva client defaults to a generic 45-view 5×9 profile over a 40° camera cone at 3600×3600. The backend also accepts compatible custom layouts when:

- `views == columns * rows`;
- output width and height divide evenly by the requested grid;
- declared `viewAspect` matches the actual tile geometry;
- the quilt is rendered as a still multi-view frame (`includeAnimation=false`).

The worker freezes the authored HoloScene at the selected timeline time, renders discrete camera views across the requested cone, then assembles them into one PNG quilt. This is real multi-view source content. Display-specific lenticular/light-field interlacing and calibration remain outside the generic HoloForge contract.


## USDZ export contract

HoloForge uses Blender's native USD archive exporter for the `ios-ar` profile. The worker writes a real `.usdz` file rather than renaming a ZIP or JSON artifact.

The production smoke verifies that:

- the result is a readable ZIP package;
- the first package entry is a native USD layer;
- package members use zero ZIP compression, as required by the USDZ container specification;
- the package is non-empty and returned through the same authenticated artifact boundary as the other render formats.

The first shipping contract is static USDZ. HoloScene animation stays available in GLB/glTF/video outputs until the USDZ animation lane is explicitly qualified across Apple-compatible consumers.


## Static PNG / Canva insertion

The `png-still` / `still-image` profile renders the HoloScene at its authored `timeline.currentTimeMs` instead of rendering the full animation. The worker writes a real PNG at the requested resolution and honors `transparentBackground`, making the result suitable for Canva compositing.

The production smoke opens the rendered PNG with Pillow, verifies the requested dimensions, requires RGBA output, and confirms that the alpha channel contains meaningful transparency rather than an opaque placeholder.

The Canva-side export adapter downloads the completed artifact through the authenticated export boundary, uploads it to the operator's Canva asset library, waits for upload completion, and inserts the rendered image into the active design.
