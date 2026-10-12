# DepthPop — standalone Canva spatial editor

DepthPop is an independent Canva Design Editor app. It converts a selected raster image into an object-aware **DepthScene**, then lets the user edit that scene in real 3D space, animate it over time, render the authored composition back into Canva, or export portable production assets.

DepthPop and HoloForge remain separate products and packages.

## Production workflow

```text
Canva/local raster
  -> Florence-2 object detection
  -> SAM 3 instance masks
  -> Depth Anything V2 canonical depth
  -> protected cutouts / masks / thumbnails
  -> optional reconstructed background plate
  -> DepthScene v1
  -> React Three Fiber spatial editor
  -> X / Y / Z / rotation / scale / camera
  -> 4D timeline + keyframes + motion presets
  -> save / render to Canva / production export
```

The maintained source controls are still respected during scene creation:

- Depth Strength: 0.05–0.75
- Depth Blur: 0–100
- Depth Fidelity: 0.05–1.00
- Render Quality: Fast / Balanced / Cinematic

## Real WebGL editor

The canonical scene editor uses:

- `three`
- `@react-three/fiber`
- `@react-three/drei`

The reconstructed plate is rendered as a rear scene plane. Each segmented object is rendered as an independently selectable transparent textured plane positioned in 3D using its authored bbox and X/Y/Z transform.

The editor supports:

- direct selection in the scene;
- translate / rotate / scale transform gizmos;
- locked-object protection;
- orbit / pan / zoom;
- persisted perspective camera position, target, and FOV;
- authenticated Blob URLs for protected scene textures;
- WebGL context-loss recovery;
- precision sliders for exact values.

The old CSS pseudo-3D stage is not the production renderer.

## 4D animation

DepthScene v1 stores typed animation tracks for:

- position X/Y/Z;
- rotation X/Y/Z;
- scale X/Y/Z;
- opacity.

The Animate workspace provides:

- play / pause / stop;
- timeline scrubbing;
- duration and FPS controls;
- add/update keyframe;
- delete keyframe;
- easing selection;
- clickable pose times;
- live animation sampling in the WebGL viewport.

Motion presets currently author serializable scene tracks for:

- Parallax
- Camera Push spatial motion
- Float
- Orbit
- Depth Reveal
- Rack Focus depth-emphasis

DepthScene v1 does not expose an animatable optical focal-distance property. Rack Focus therefore uses supported opacity + Z depth-emphasis tracks rather than pretending a nonexistent focus parameter exists.

## Object operations

When connected to the production backend, the Scene workspace exposes real server-backed:

- rename;
- duplicate;
- delete;
- merge;
- split / re-segment.

Split uses the configured segmentation provider against the original owned source image. It is not simulated in the browser.

## Export

The Export workspace uses authenticated asynchronous backend jobs for:

- portable DepthScene JSON;
- PNG layer ZIP;
- glTF;
- GLB;
- WebM;
- MP4.

WebM/MP4 support authored FPS and output resolution controls.

The existing **RENDER TO CANVA** action remains separate from file export and applies the current authored scene back into the Canva design.

## Protected assets and auth

Generated scene media is owner-scoped to the verified Canva user + brand. The frontend fetches protected assets with the Canva bearer token and converts them to local Blob URLs before handing them to Three.js. Provider credentials such as `FAL_KEY` remain server-side only.

## Development

```bash
cp .env.template .env
npm install --ignore-scripts
npm run typecheck
npm run test
npm run build
npm run start
```

The backend lives under `backend/`. For a production deployment, configure a public HTTPS backend origin, persistent SQLite/asset/artifact volumes, and the required server-side providers.

Historical Drive source material remains under `reference/drive-source` for provenance only and is excluded from the user-facing package.
