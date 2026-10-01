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

The WebGL foundation now includes transform gizmos, alpha-silhouette extrusion, an animated spectral shader, and serializable transform keyframes. It still does **not** claim that full vector mesh reconstruction, Blender rendering, GLB/USDZ export, or device-specific light-field output are complete. Those remain later backend/export batches.

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

## Spatial edit session

The SPATIAL workspace now owns a real editable HoloScene session instead of rebuilding the scene every time the operator changes tabs. Transform edits, authored poses, animation presets and manually scrubbed timeline state are lifted back into the app-level studio scene and restored when CREATE / SPATIAL / VERIFY navigation unmounts and remounts the viewport.

Starting a new Preview from CREATE intentionally creates a fresh scene from the current material/source plan. Normal tab navigation does not reset authored spatial work.

## HoloScene project round-trip

HoloScene JSON is now a real editable project format rather than a one-way diagnostic export. Operators can reopen a previously downloaded HoloScene file and return directly to SPATIAL with its objects, materials, geometry, transforms, camera, environment, timeline, animation presets and authored keyframes restored.

Imports are bounded to 25 MB, parsed locally, checked against the v1 runtime structure, passed through semantic HoloScene validation, and recursively frozen before entering studio state. Invalid JSON, malformed scene shapes, duplicate object IDs and out-of-range keyframes fail with an explicit import message instead of partially mutating the current scene.

## Multi-object scene composition

The SPATIAL workspace now treats HoloScene as a real object stack instead of a single disposable preview. Operators can select, duplicate, hide/show, reorder and remove holographic objects while preserving unique object IDs and a valid scene selection.

Duplicated objects inherit the source geometry, material and animation intent, receive a bounded spatial offset so they are immediately distinguishable, and remain independently editable. Browser rendering and the Blender worker already iterate the HoloScene object array, so multi-object compositions survive JSON, 3D, video, USDZ and light-field export paths rather than flattening back into one preview layer.

## Live material and geometry editing

The selected SPATIAL object can now be edited after scene creation without rebuilding the material plan. HoloForge exposes real HoloScene-backed visibility, material-family, opacity, reflection, emission, metalness, roughness, transmission, IOR, spectral shift, diffraction, shimmer, scanline, thickness, bevel-size and bevel-segment controls.

Material and geometry edits are bounded before entering the renderer contract, persist through studio-tab navigation, update the live Three.js object immediately, and serialize into the same HoloScene submitted to Blender exports. Raster source faces now honor the edited object opacity instead of remaining visually opaque over the holographic mesh.

## Live scene controls

The SPATIAL workspace now exposes real scene-level controls backed by HoloScene state rather than visual-only UI. Operators can change the stage background, toggle the floor grid, tune ambient/key/rim light intensity, adjust perspective field of view, edit camera position/target coordinates, and jump between bounded FRONT / HERO / CLOSE camera presets.

These edits are immutable scene updates and persist through the app-level spatial session, so the same environment and camera state is serialized into HoloScene JSON and submitted to the production render backend.

## Export and deployment profiles

HoloForge exposes explicit export capabilities instead of presenting every desired format as if the Canva iframe can create it locally.

Current capability state:

- **HoloScene JSON** — client-ready. Downloads the complete authored scene contract, including transform state, camera, material metadata, timeline and keyframes.
- **GLB / glTF** — real headless-Blender exports with authored geometry, transforms, materials, camera state and animation/keyframe conversion.
- **USDZ** — real Blender-generated USDZ package for the `ios-ar` profile. The first shipping contract is static while GLB/glTF/video remain the qualified animation paths.
- **PNG Still** — real transparent render of the currently authored timeline frame, with direct insertion back into Canva.
- **WebM Alpha** — real transparent VP9 output assembled from Blender-rendered RGBA frames.
- **MP4 / PNG Sequence** — real Blender-worker render outputs.
- **Light-field Quilt** — real multi-view PNG quilt output. The generic compatibility profile renders 45 views in a 5×9 quilt over a 40° camera cone at 3600×3600, while custom bounded quilt layouts can be submitted explicitly.

Every format has a declared MIME type, extension, execution boundary and animation capability. A quilt is multi-view display content, not a claim that one optical calibration works for every physical display. Device-specific lenticular/light-field calibration and interlacing remain the responsibility of the target display runtime or a later device adapter.

This boundary is deliberate: HoloForge will not create fake GLB, USDZ, WebM or quilt files by renaming JSON or a preview image.

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

## HQ export geometry

The browser editor and the Blender export worker now share the same source-geometry intent.

For transparent raster logos/graphics, the production worker analyzes the source alpha channel and exports an actually extruded silhouette mesh rather than a rectangular block. Multiple disconnected visible contour components can remain part of the exported silhouette. The original transparent source face is retained over the holographic mesh so the exported asset preserves the uploaded graphic's identity.

Opaque sources deliberately remain a holographic plate fallback until a later semantic/vision geometry pipeline can justify a different mesh. This keeps the exported geometry honest instead of fabricating 3D structure from a flat opaque image.

## Render/export backend

HoloForge has its own authenticated FastAPI render boundary under `backend/`.

The Canva bundle obtains a fresh Canva user token and submits a validated HoloScene/export request to the backend. Export jobs and artifacts are isolated by Canva `userId` + `brandId`, are bounded by TTL/capacity controls, and require authentication for status and download.

Current backend behavior:

- HoloScene JSON is always a real server-side artifact;
- GLB, glTF, USDZ, transparent PNG still, transparent VP9 WebM, MP4, PNG-sequence and light-field quilt routes are implemented through the headless Blender worker when `BLENDER_BIN` is configured;
- Blender absence fails closed and those formats are not advertised by `/health`;
- transparent WebM is rendered as RGBA PNG frames and encoded with FFmpeg/libvpx-vp9, with the production smoke extracting the encoded alpha plane;
- light-field quilts freeze the authored scene at the selected timeline time, render discrete camera views across the requested cone, and assemble those views into one quilt PNG;
- HoloScene materials are normalized through the spectral renderer before Blender receives them, so exported foil/iridescent/pearl/neon materials retain angle-reactive spectrum behavior instead of flattening to one RGB value;
- transparent raster sources can be alpha-traced and extruded into real silhouette geometry, while unsuitable opaque sources fall back honestly to a plate;
- USDZ is generated directly by Blender's native USD archive exporter and returned through the authenticated artifact boundary;
- Canva temporary image URLs are materialized in the browser and embedded before submission, so the server does not fetch arbitrary remote source URLs.

The normal API container intentionally stays lightweight. Production rendering uses the dedicated Blender image.

### Render current scene into Canva

The SPATIAL export panel now includes **PNG Still**. It freezes the HoloScene at the current timeline position, renders the full authored camera, lighting, multi-object composition, geometry and materials through Blender, and inserts the resulting transparent PNG directly into the active Canva design.

This is intentionally different from the CREATE-tab forge route: CREATE can produce a lightweight static Canva-safe treatment from the original material plan, while PNG Still captures the edited SPATIAL scene after transforms, duplicated objects, camera changes, material edits and lighting changes.

### Production Blender image

`backend/Dockerfile.render` pins Blender **4.5.14 LTS**, downloads the official Linux x64 archive plus Blender's matching SHA-256 manifest, verifies the archive before extraction, and exposes the same FastAPI service with `BLENDER_BIN=/opt/blender/blender`.

Use:

```bash
cd apps/holoforge-canva/backend
docker compose -f docker-compose.render.yml up --build
```

The render image enables `glb`, `gltf`, `usdz`, `webm-alpha`, `mp4`, `png-sequence` and `lightfield-quilt` in `GET /health`. The normal lightweight backend remains useful for API/schema/auth testing and scene JSON exports.

The **HoloForge Render Image** workflow performs the production-image build for render-worker pull requests or explicit manual dispatch. Its smoke proves a real GLB, a structurally valid USDZ package, a transparent VP9 WebM with recoverable alpha, and a bounded 3×3 / 9-view quilt path so CI verifies multi-view rendering without paying the full cost of the production 45-view default.

## Development

    npm install --ignore-scripts
    npm run typecheck
    npm run test
    npm run start

Production:

    npm run build

Upload the generated JavaScript bundle for this app to its own HoloForge record in the Canva Developer Portal. Do not register this build as DepthPop.

The standalone `preview/index.html` is only a browser UI preview. Canva asset reads/writes, selected-image binding and real forging happen in the production `app.js` inside Canva.
