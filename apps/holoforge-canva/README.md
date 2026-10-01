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

The WebGL foundation deliberately does **not** claim that full SVG/alpha contour extrusion, custom diffraction shaders, Blender rendering, GLB/USDZ export, or device-specific light-field output are complete. Those are later geometry/material/export batches.

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

## Development

    npm install --ignore-scripts
    npm run typecheck
    npm run test
    npm run start

Production:

    npm run build

Upload the generated JavaScript bundle for this app to its own HoloForge record in the Canva Developer Portal. Do not register this build as DepthPop.

The standalone `preview/index.html` is only a browser UI preview. Canva asset reads/writes, selected-image binding and real forging happen in the production `app.js` inside Canva.
