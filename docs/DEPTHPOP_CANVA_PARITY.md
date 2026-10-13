# DepthPop → Canva production contract

DepthPop's current Canva product keeps the verified control vocabulary and visual identity recovered from the maintained Drive v115 build, but the production implementation is no longer a flat compatibility panel.

Historical source used for provenance:

`roaryv246_v115_depthpop_modeldrawer_FINALFIX.html`

The historical source is evidence for the original control language and visual direction. The maintained production app lives under:

`apps/depthpop-canva/`

and uses a typed **DepthScene v1** object-scene architecture.

## Sidebar and visual continuity

The standalone Canva app keeps the narrow-sidebar design language established by the maintained v115 surface:

- near-black glass base;
- purple illumination and accents;
- layered-square DepthPop identity;
- compact Canva-safe controls;
- no horizontal page overflow.

The production workspace now separates the editing flow into **SCENE**, **ANIMATE**, and **EXPORT** around a real WebGL viewport rather than recreating the historical ROARY modal shell.

## Source controls

The maintained source controls still preserve the verified ranges and quality mapping:

| Control | Production value/range |
| --- | --- |
| Depth Strength | default 0.32; 0.05–0.75 |
| Depth Blur | default 35; 0–100 |
| Depth Fidelity | default 0.95; 0.05–1.00 |
| Render Quality — Fast | 14 inference steps |
| Render Quality — Balanced | 22 inference steps |
| Render Quality — Cinematic | 34 inference steps |

The raw inference-step count remains an implementation detail behind the named quality modes.

## Authenticated processing boundary

Production processing is handled by the standalone authenticated FastAPI backend.

The primary path is:

1. selected Canva raster or local PNG/JPEG/WebP;
2. Florence-2 object detection;
3. SAM 3 instance segmentation;
4. Depth Anything V2 canonical depth;
5. optional FAL inpainting for reconstructed background;
6. protected scene-owned assets;
7. canonical DepthScene v1;
8. React Three Fiber / Three.js spatial editing;
9. persisted 4D animation and object operations;
10. Render to Canva or production export.

The browser never receives provider secrets. Every v1 scene, job, asset and artifact route requires a verified Canva user token and preserves exact user + brand ownership.

## Spatial editing contract

The production editor supports:

- reconstructed plate rendered in WebGL;
- independently selectable transparent object planes;
- X/Y/Z translation;
- rotation and scale;
- Drei transform gizmos;
- object visibility and locking;
- layer ordering;
- orbit, pan and zoom;
- persisted perspective camera position, target and field of view;
- WebGL context-loss recovery;
- precision controls for authored transforms.

The old CSS pseudo-3D stage is not the canonical renderer.

## 4D animation contract

DepthScene stores typed animation tracks for:

- position X/Y/Z;
- rotation X/Y/Z;
- scale X/Y/Z;
- opacity.

The Canva workspace supports play/pause/stop, timeline scrubbing, duration/FPS controls, keyframe add/update/delete and explicit easing.

Current serializable motion presets:

- Parallax
- Camera Push
- Float
- Orbit
- Depth Reveal
- Rack Focus depth-emphasis

DepthScene v1 does not expose an animatable optical focal-distance property. Rack Focus therefore uses supported opacity + Z depth-emphasis rather than claiming physical depth-of-field control.

## Object operations

The production backend and UI support:

- rename;
- duplicate;
- delete;
- merge;
- split / provider-backed re-segmentation.

Server operations return the canonical updated scene. Local dirty camera/transform/keyframe edits are persisted before server mutations so newer authored work cannot be overwritten by an older server snapshot.

## Output paths

DepthPop supports two distinct completion routes:

### Render to Canva

The current authored scene is composited and inserted/replaced in the active Canva design through the maintained authenticated Canva path.

### Production export

Asynchronous owner-scoped export jobs produce:

- portable DepthScene JSON;
- PNG layer ZIP;
- glTF 2.0;
- GLB 2.0;
- WebM;
- MP4.

Video exports evaluate the saved timeline frame-by-frame and use FFmpeg. Export jobs are bounded by concurrency, pixels, duration, frame count and artifact size.

## Package boundary

The final `DepthPop-Canva-App.zip` contains the standalone app handoff and matching backend deployment material.

It deliberately excludes:

- historical ROARY/ÆTHER application material;
- `apps/depthpop-canva/reference/drive-source/`;
- credentials or populated `.env` files;
- SQLite databases;
- generated user assets/artifacts;
- Git metadata;
- `node_modules`.

Inside Canva Developer Portal, upload only the root-level `app.js` from the DepthPop handoff package. Deploy the backend separately.
