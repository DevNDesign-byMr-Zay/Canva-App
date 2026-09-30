# HoloForge — standalone Canva holographic design app

HoloForge is an independent Canva Design Editor app for **designing holographic visual treatments inside Canva**. It does not share a runtime entrypoint, product switcher, or product-lock global with DepthPop.

HoloForge is a digital design tool, not a claim to generate a physical holographic display. Its job is to turn text, logos, graphics and material plates into spectral, depth-aware, holographic-looking Canva content that can be previewed before an explicit forge action.

## Product workflow

The Canva panel follows one deliberate pipeline:

    SOURCE → CREATE → SPATIAL → VERIFY

- **SOURCE** binds either one raster image already selected in Canva or a PNG/JPEG/WebP uploaded through HoloForge.
- **CREATE** selects a creation type, material preset and material parameters.
- **SPATIAL** previews the depth/material intent before committing it.
- **VERIFY** records the actual Canva output route and forge result.

## Creation types

All six visible creation types are functional:

- **Holo Text** — user-entered typography rendered as a re-editable HoloForge app element.
- **Holo Logo** — requires a selected/uploaded raster image and creates a derived holographic Canva asset.
- **Holo Graphic** — works as a standalone editable spectral graphic, or switches to source-bound raster forging when an image is bound.
- **Glass** — re-editable refractive glass app element.
- **Chrome** — re-editable holographic chrome app element.
- **Light FX** — re-editable photonic ring/beam overlay.

Material controls for color shift, depth, reflection, glow, grain, angle and transparency affect the forged static output. Motion mode is intentionally a preview behavior because the committed Canva output is static.

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
