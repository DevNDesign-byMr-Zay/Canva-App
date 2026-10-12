# HoloForge holographic design studio for Canva

HoloForge is the standalone Canva Design Editor app for authoring holographic visual treatments, spatial compositions and production render/export outputs.

Canonical maintained source:

`apps/holoforge-canva/`

HoloForge is a digital design tool. It does not claim to actuate physical holographic hardware or provide a universal optical calibration for every display.

## Product workflow

```text
SOURCE
  ↓
CREATE
  ↓
SPATIAL
  ↓
VERIFY
```

- **SOURCE** binds one selected Canva raster image or a local PNG/JPEG/WebP.
- **CREATE** chooses a creation type, material family/preset and authored material parameters.
- **SPATIAL** edits the real HoloScene using React Three Fiber / Three.js.
- **VERIFY** records the actual output route and forge/render result before final insertion/export.

## Creation types

The standalone app supports:

- Holo Text;
- Holo Logo;
- Holo Graphic;
- Glass;
- Chrome;
- Light FX.

Text and app-owned materials remain editable HoloForge content. Raster logo/graphic inputs can use selected/uploaded source imagery and produce derived holographic Canva assets.

## Real spatial editor

The canonical SPATIAL workspace uses:

- `three`;
- `@react-three/fiber`;
- `@react-three/drei`.

It supports:

- direct object selection;
- translate / rotate / scale gizmos;
- numeric X/Y/Z editing;
- orbit, pan and zoom;
- camera controls and presets;
- stage background/grid/light controls;
- material and geometry editing;
- multi-object duplicate/reorder/hide/remove operations;
- authored timeline/keyframe playback;
- persistent scene state across studio tabs.

This is real WebGL scene authoring, not the older 2.5D preview-only contract.

## Source geometry

For transparent raster sources, HoloForge analyzes the alpha channel and derives bounded silhouette geometry.

The browser and Blender worker preserve the same geometry intent:

- suitable transparent sources can become extruded silhouette geometry;
- disconnected visible components can remain represented;
- unsuitable/opaque sources fall back honestly to a holographic plate;
- the source face remains distinct from the spectral shell.

No fake semantic 3D structure is invented for an opaque image.

## Materials

The authored HoloScene supports real material parameters including:

- material family;
- opacity;
- reflection;
- emission;
- metalness;
- roughness;
- transmission;
- IOR;
- spectral shift;
- diffraction;
- shimmer;
- scanline behavior;
- thickness;
- bevel size/segments.

Spectral/iridescent families use an animated shader in the WebGL editor and are normalized into the production Blender renderer for export.

## 4D animation

HoloScene stores serializable authored animation rather than hiding all motion inside the preview renderer.

The studio supports built-in motion presets plus custom keyframes for object transforms. Timeline time is scene data and survives save/reopen.

Browser and Blender rendering share maintained preset-motion/easing contracts so export behavior tracks the authoring surface.

## HoloScene project round-trip

HoloScene JSON is a real project format.

Saved scenes preserve:

- objects;
- source geometry/material metadata;
- transforms;
- camera;
- environment;
- timeline;
- motion presets;
- authored keyframes.

Temporary Canva source URLs are materialized into bounded embedded image data before project download. Imports reject unsupported remote references and invalid scene values before entering studio state.

## Canva output routes

HoloForge supports:

- app-owned Canva elements for supported editable material/graphic routes;
- derived raster assets for source-bound forging;
- PNG Still rendering of the current authored spatial scene back into Canva.

Canva asset/design access remains explicitly user-triggered and uses the app's declared Design Content and private asset permissions.

## Production export backend

The authenticated FastAPI render backend lives under:

`apps/holoforge-canva/backend/`

The production render image uses pinned Blender 4.5 LTS plus FFmpeg.

Current real outputs include:

- HoloScene JSON;
- GLB;
- glTF;
- USDZ;
- transparent PNG Still;
- transparent VP9 WebM;
- MP4;
- PNG Sequence;
- light-field Quilt.

Blender absence fails closed and unsupported render formats are not advertised as ready.

The backend enforces:

- exact Canva user + brand artifact ownership;
- persistent SQLite job/artifact metadata;
- persistent artifact storage;
- restart recovery;
- bounded render concurrency;
- pixel/frame/resource limits;
- streamed SHA-256 hashing;
- safe workspace cleanup beneath the configured artifact root.

## Light-field boundary

The generic light-field export is a real multi-view quilt render. It is not a claim that one quilt layout or optical interlacing profile works for every physical display.

Device-specific calibration/interlacing remains a separate downstream concern.

## Package boundary

The final `HoloForge-Canva-App.zip` is the standalone handoff package.

It excludes credentials, databases, render artifacts, Git metadata, `node_modules`, and historical combined-app material.

Inside Canva Developer Portal, upload only the root-level `app.js` from that package. Deploy the authenticated render backend separately.
