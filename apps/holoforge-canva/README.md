# HoloForge — standalone Canva holographic design app

HoloForge is an independent Canva Design Editor app for **designing holographic visual treatments inside Canva**. It does not share a runtime entrypoint, product switcher, or product-lock global with DepthPop.

HoloForge is a digital design tool, not a claim to generate a physical holographic display. Its job is to turn text, logos, graphics and material plates into spectral, depth-aware, holographic-looking Canva content that can be previewed before an explicit forge action.

## Product workflow

The Canva panel follows one deliberate pipeline:

    SOURCE → CREATE → SPATIAL → VERIFY

- **SOURCE** binds either one raster image already selected in Canva or a PNG/JPEG/WebP uploaded through HoloForge.
- **CREATE** selects a creation type, material preset and material parameters.
- **SPATIAL** is a real Three.js / React Three Fiber WebGL scene with orbit, pan, zoom, object selection, translate/rotate/scale gizmos, numeric transform editing, playback, auto-orbit, and timeline scrubbing.
- **VERIFY** records the actual Canva output route and forge result.

## Creation types

All six visible creation types are functional:

- **Holo Text** — user-entered typography rendered as a re-editable HoloForge app element.
- **Holo Logo** — requires a selected/uploaded raster image and creates a derived holographic Canva asset.
- **Holo Graphic** — works as a standalone editable spectral graphic, or switches to source-bound raster forging when an image is bound.
- **Glass** — re-editable refractive glass app element.
- **Chrome** — re-editable holographic chrome app element.
- **Light FX** — re-editable photonic ring/beam overlay.

Material controls for color shift, depth, reflection, glow, grain, angle and transparency now normalize into a versioned `HoloScene` and drive real WebGL material/geometry state. Motion remains preview-time scene behavior until the later animation/export backend batch.

## WebGL scene foundation

HoloForge now keeps a versioned scene contract under `src/intents/design_editor/scene/`.

The current SPATIAL editor uses:

- `three`
- `@react-three/fiber`
- `@react-three/drei`

The production Canva app renders this scene inside its normal app iframe. Canva remains responsible for asset access and design insertion; HoloForge owns the 3D scene, camera, environment, materials, and timeline state.

The WebGL foundation now includes transform gizmos, alpha-silhouette extrusion, an animated spectral shader, and serializable transform keyframes. The server-side render lane now covers Blender-backed GLB/glTF, transparent VP9 WebM, MP4, PNG-sequence, and generic multi-view quilt rendering. Full vector mesh reconstruction, USDZ conversion, and device-specific optical calibration remain later batches.

## Object manipulation and source geometry

The current WebGL editor now separates the object's authored transform from its preview animation. This is important because moving, rotating, or scaling the object must not fight the shimmer/sweep/pulse animation loop.

A selected hologram exposes:

- world-space move controls;
- local rotation and scale controls;
- a compact numeric X/Y/Z inspector;
- orbit controls that temporarily disable while the object gizmo is being dragged.

For uploaded transparent raster sources, HoloForge analyzes the alpha channel in the browser, traces the largest silhouette contour, simplifies it, normalizes it into scene space, and uses that contour as an extruded 3D shell. Fully opaque or technically unsuitable inputs intentionally fall back to a rectangular holographic plate instead of inventing fake geometry.

Iridescent, foil, and neon material families now use a dedicated animated spectral shader with view-angle Fresnel response, spectral color shift, diffraction, scan-line modulation, shimmer, reflection contribution, and time-driven emission. Glass/crystal/metal families continue through the physical-material path.

This remains a client-side authoring foundation. High-quality production mesh reconstruction and export rendering remain separate backend batches.

## 4D animation authoring

HoloForge now treats time as scene data instead of only playing decorative CSS/WebGL motion presets.

Each `HoloObject` can carry serializable transform animation tracks for:

- position;
- rotation;
- scale.

The SPATIAL studio supports built-in motion presets plus a **CUSTOM** mode. In custom mode, the user can scrub the timeline, move/rotate/scale the object, and add a synchronized transform pose at the current time. HoloForge stores those values as keyframes in the scene contract and interpolates between them with explicit easing.

The timeline playback loop updates scene time rather than hiding animation state inside the renderer. That makes the authored motion suitable for later conversion into GLB animation clips, Blender keyframes, or rendered video without reverse-engineering the preview.

## Export and deployment profiles

HoloForge now exposes explicit export capabilities instead of presenting every desired format as if the Canva iframe can already create it.

Current capability state:

- **HoloScene JSON** — client-ready. Downloads the complete authored scene contract, including transform state, camera, material metadata, timeline and keyframes.
- **GLB / glTF** — real Blender-worker exports with authored transforms, camera state, materials, and animation/keyframe conversion.
- **USDZ** — contract remains defined but disabled until a real USD/USDZ conversion lane is implemented.
- **WebM Alpha** — real transparent VP9 output assembled from Blender-rendered RGBA frames.
- **MP4 / PNG Sequence** — real Blender-worker render outputs.
- **Light-field Quilt** — real multi-view PNG quilt output. The default compatibility profile is 45 views in a 5×9 quilt over a 40° camera cone at 3600×3600, while custom bounded quilt layouts can be submitted explicitly.

Every format has a declared MIME type, extension, execution boundary, animation capability, and readiness boundary. A quilt is treated as multi-view display content, not as a claim that one pixel-interlacing calibration fits every physical display. Device-specific optical calibration/interlacing remains the responsibility of the target display runtime or a later device adapter.

This boundary is deliberate: HoloForge will not create fake GLB, USDZ, WebM, or quilt files by renaming JSON or a preview image.
## Image source behavior

HoloForge can use either:

1. exactly one raster image selected in the Canva design; or
2. a local PNG/JPEG/WebP chosen or dropped into the HoloForge panel.

The local picker is bound to a native file-input label rather than a programmatic click on a hidden input. This keeps the browser/Canva iframe file chooser directly user-triggered.

Uploaded source images are staged in the user's private Canva asset library and are **not** inserted raw into the design when they are being used as a HoloForge source. The derived holographic result is uploaded with the original source ref as `parentRef` and then inserted into the design.

## Canva permissions

The manifest requires:

- `canva:design:content:read`
- `canva:design:content:write`
- `canva:asset:private:read`
- `canva:asset:private:write`

Private asset read is required so HoloForge can resolve an image already selected in Canva and create a derived treatment from it.

## Render/export backend

HoloForge now has its own authenticated FastAPI render boundary under `backend/`.

The Canva bundle obtains a fresh Canva user token and submits a validated HoloScene/export request to the backend. Export jobs and artifacts are isolated by Canva `userId` + `brandId`, are bounded by TTL/capacity controls, and require authentication for status and download.

Current backend behavior:

- HoloScene JSON is always a real server-side artifact;
- GLB, glTF, transparent VP9 WebM, MP4, PNG-sequence, and light-field quilt routes are implemented through the headless Blender worker when `BLENDER_BIN` is configured;
- Blender absence fails closed and those formats are not advertised by `/health`;
- alpha-WebM is rendered as transparent RGBA PNG frames and encoded with FFmpeg/libvpx-vp9; the production smoke decodes and extracts the resulting alpha plane;
- light-field quilt output renders one discrete camera view per tile, sweeps those views across the requested view cone, preserves the bottom-left-to-top-right view ordering, and assembles the finished quilt PNG with FFmpeg;
- USDZ remains disabled until a dedicated converter generates an actual USDZ artifact;
- Canva temporary image URLs are materialized in the browser and embedded before submission, so the server does not fetch arbitrary remote source URLs.

The normal API container intentionally does not bundle Blender yet. A production renderer can point `BLENDER_BIN` at an installed Blender binary or later move the worker into a dedicated render container without changing the API contract.

### Production Blender image

`backend/Dockerfile.render` is the render-capable deployment image. It pins Blender **4.5.14 LTS**, downloads the official Linux x64 archive plus Blender's matching SHA-256 manifest, verifies the archive before extraction, and exposes the same FastAPI service with `BLENDER_BIN=/opt/blender/blender`.

Use:

```bash
cd apps/holoforge-canva/backend
docker compose -f docker-compose.render.yml up --build
```

The render image enables `glb`, `gltf`, `webm-alpha`, `mp4`, `png-sequence`, and `lightfield-quilt` in `GET /health`. The normal lightweight backend image remains useful for API/schema/auth testing and scene JSON exports.

The **HoloForge Render Image** workflow performs the expensive production-image build only for render-worker pull requests or an explicit manual dispatch. Its smoke generates a real GLB, transparent VP9 WebM, and a 45-view 5×9 quilt PNG; it verifies the WebM alpha plane, final quilt dimensions, and exact view count.

## Development

    npm install --ignore-scripts
    npm run typecheck
    npm run test
    npm run start

Production:

    npm run build

Upload the generated JavaScript bundle for this app to its own HoloForge record in the Canva Developer Portal. Do not register this build as DepthPop.

The standalone `preview/index.html` is only a browser UI preview. Canva asset reads/writes, selected-image binding and real forging happen in the production `app.js` inside Canva.
