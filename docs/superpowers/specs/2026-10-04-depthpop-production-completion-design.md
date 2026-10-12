# DepthPop production completion design

Date: 2026-10-04
Repository: `DevNDesign-byMr-Zay/Canva-App`
Branch: `feat/depthpop-final-production-v1`
Base main: `72d0fdcca60d6b1dc8b13257d8106234c8243d94`

## Intent

Finish DepthPop as a production-grade, standalone Canva Design Editor app rather than leaving the current object-aware scene pipeline attached to a DOM/CSS 2.5D editor.

The finished product must preserve the maintained ROARY DepthPop identity while adding a real WebGL spatial editor, authored time/animation, durable scene persistence, secure Canva integration, and truthful export paths.

DepthPop remains independent from HoloForge. HoloForge may be used as an implementation reference for renderer patterns, but DepthPop must not import HoloForge product code or require its runtime.

## Grounded sources

### Maintained Google Drive source

The canonical maintained UI source is:

- `roaryv246_v115_depthpop_modeldrawer_FINALFIX.html`
- Drive file ID: `1PW8b9KIYNAtGKG4IL3_zCsnP4Vbvquo3`

The source contains the original four raw controls:

- Depth Strength: default 0.32, range 0.05-0.75, step 0.01
- Depth Blur: default 35, range 0-100, step 1
- Depth Fidelity: default 0.95, range 0.05-1.00, step 0.01
- Steps: range 8-50

The same maintained file also contains the later runtime patch `roary-depthpop-quality-ui-js-v1`, which hides the raw Steps slider and exposes:

- Fast -> 14 steps
- Balanced -> 22 steps
- Cinematic -> 34 steps

Because that patch executes in the maintained file after the raw control is created, this design treats the visible final runtime as three continuous DepthPop controls plus the named Render Quality control. The raw step value remains part of the execution contract but not a primary visible control.

The maintained product copy remains:

> Turn depth into presence — subtle separation, cinematic focus, same scene.

### Current Canva documentation verified during design

Current Canva documentation confirms:

- Design Editor is the intended app intent for tools that work alongside the Canva design surface.
- `openDesign` is the current design editing primitive and its sessions expire after one minute.
- design edits require an explicit `sync()`.
- element layering is collection order rather than a CSS-like z-index.
- Canva app frontends and custom backends are different origins, so backend CORS must explicitly allow the app origin.
- Canva user JWTs must be verified on the backend; user/team ownership must be enforced.
- assets may be uploaded and then inserted into the design through supported SDK APIs.

Reference URLs:

- https://www.canva.dev/docs/apps/intents/design-editor/
- https://www.canva.dev/docs/apps/design-editing/
- https://www.canva.dev/docs/apps/feature-examples/asset-upload/
- https://www.canva.dev/docs/apps/cross-origin-resource-sharing/
- https://www.canva.dev/docs/apps/verifying-jwts/
- https://www.canva.dev/docs/apps/security-guidelines/

### Current fal.ai provider contracts verified during design

The current production provider lane remains valid:

- `fal-ai/florence-2-large/object-detection`
- `fal-ai/sam-3/image`
- `fal-ai/image-preprocessors/depth-anything/v2`
- `fal-ai/inpaint`

fal.ai documentation explicitly requires keeping `FAL_KEY` server-side for browser applications.

The current SAM 3 API supports box prompts, multiple masks, confidence scores, and mask metadata. The current inpainting contract states that black mask pixels are preserved and white mask pixels are inpainted, which matches DepthPop's reconstructed-plate semantics.

## Current main state

Current main already provides a strong backend foundation:

- verified Canva user JWT boundary;
- exact user + brand ownership checks;
- Florence-2 object detection;
- SAM 3 segmentation;
- Depth Anything v2 depth estimation;
- inpainted/reconstructed background plate;
- protected scene-owned generated assets;
- canonical near-high depth polarity;
- bounded job/scene/asset lifecycles;
- scene PATCH;
- PNG composite endpoint;
- selected Canva image replacement or new Canva insertion;
- local PNG/JPEG/WebP source support.

The main gaps are:

1. the editor is still a DOM/CSS composition rather than a real WebGL scene;
2. `animationTracks` is untyped and the timeline does not actually evaluate authored motion;
3. scene/job/asset repositories are process-memory stores;
4. scene output is primarily flattened PNG;
5. there is no durable project round-trip;
6. scene editing lacks some object operations and a true 3D camera/object interaction model;
7. current documentation conflicts on whether raw Steps or named quality presets are the visible final source behavior.

## Product architecture

DepthPop will be completed in four independently testable layers:

```
CANVA SOURCE / LOCAL SOURCE
          |
          v
DEPTHPOP AI DECOMPOSITION
Florence -> SAM3 -> Depth -> Inpaint
          |
          v
DEPTHSCENE PROJECT MODEL
objects + plate + camera + timeline + tracks
          |
          +----------------------+
          |                      |
          v                      v
WEBGL 4D EDITOR            EXPORT / CANVA APPLY
R3F + Three.js             PNG / video / GLB / JSON
```

The AI decomposition pipeline remains server-side. The scene authoring experience remains browser-side. Heavy rendered exports remain server-side.

## 1. Source and control panel

The source panel keeps the compact dark/glass DepthPop visual language.

Visible pre-process controls:

- Depth Strength
- Depth Blur
- Depth Fidelity
- Render Quality
  - Fast
  - Balanced
  - Cinematic

The quality values map to 14 / 22 / 34 inference steps.

The primary action stays product-specific and direct:

`CREATE DEPTHSCENE`

The settings are no longer dead compatibility state. They are sent into the scene creation request as an explicit authored intent contract:

```
depth_strength
depth_blur
depth_fidelity
render_quality
```

The backend normalizes them and records the normalized values in the scene so project round-trip and export remain deterministic.

The first production mapping is:

- Depth Strength -> initial object Z spread and parallax amplitude only; it must not fabricate provider depth values.
- Depth Blur -> authored scene depth-of-field/plate blur intent used by preview and render/export.
- Depth Fidelity -> how strongly initial object placement/order follows measured provider depth versus bounded smoothing; measured provider depth remains stored unchanged.
- Fast -> Depth Anything standard preprocessing plus a 14-step inpaint reconstruction budget.
- Balanced -> Depth Anything high preprocessing plus a 22-step inpaint reconstruction budget.
- Cinematic -> Depth Anything high preprocessing plus a 34-step inpaint reconstruction budget.

Florence-2 and SAM 3 remain provider-contract driven and do not receive invented "steps" parameters.

The legacy flat `/api/depthpop` route remains compatibility-only and is not silently invoked by the object-scene workflow.

## 2. DepthScene model

Keep `schemaVersion: 1` if the existing JSON shape can be extended compatibly. Do not create v2 unless a migration-breaking field is truly necessary.

The existing normalized object storage remains authoritative:

- object X/Y remain normalized to source dimensions;
- object Z remains a normalized authored depth offset;
- rotation remains stored in degrees;
- scale remains unitless;
- camera remains serializable scene state.

Add typed animation contracts.

### Animation track

Each object may contain zero or more tracks:

```ts
type AnimationProperty =
  | "position.x"
  | "position.y"
  | "position.z"
  | "rotation.x"
  | "rotation.y"
  | "rotation.z"
  | "scale.x"
  | "scale.y"
  | "scale.z"
  | "opacity";

type Easing = "linear" | "ease-in" | "ease-out" | "ease-in-out";

type AnimationKeyframe = {
  timeMs: number;
  value: number;
  easing: Easing;
};

type AnimationTrack = {
  id: string;
  property: AnimationProperty;
  keyframes: AnimationKeyframe[];
};
```

Backend Pydantic models mirror the same contract and reject:

- duplicate track IDs;
- unsupported properties;
- non-finite values;
- out-of-range opacity;
- keyframes outside timeline duration;
- unsorted/duplicate keyframe times.

## 3. Real WebGL spatial editor

Replace the CSS image stacking stage with a real Three.js scene using:

- `three`
- `@react-three/fiber`
- `@react-three/drei`

The WebGL editor is the actual scene authoring surface, not a decorative background.

### Scene mapping

Create one tested coordinate adapter that converts DepthScene storage into world coordinates.

The adapter must:

- preserve source aspect ratio;
- place the reconstructed plate at the back of the scene;
- place each cutout on a textured plane using its source-space bounding box;
- convert normalized X/Y to deterministic world positions;
- convert object depth + authored Z into world Z;
- convert degree rotations to radians only at the renderer boundary;
- preserve object opacity;
- keep transparent cutout edges transparent.

The inverse adapter converts gizmo movement back into canonical normalized scene values.

### Interaction

Support:

- object click/select;
- orbit;
- pan;
- zoom;
- translate gizmo;
- rotate gizmo;
- scale gizmo;
- numeric X/Y/Z;
- numeric rotation X/Y/Z;
- uniform scale;
- visibility;
- lock;
- opacity;
- feather preview;
- layer reorder;
- reset object;
- reset scene.

The existing Canva sidebar must stay compact. High-frequency controls live close to the viewport, while advanced numeric properties may collapse into an inspector section.

### Camera

Use a real PerspectiveCamera.

Persist:

- position;
- target;
- FOV.

Camera state must survive tab/editor rerenders and project round-trip.

## 4. 4D timeline and motion

Time is scene data.

The timeline must actually evaluate the authored scene at `currentTimeMs`.

Support:

- play/pause;
- scrub;
- loop;
- duration;
- FPS;
- add/update/remove keyframes;
- deterministic interpolation.

Built-in presets should create editable tracks rather than hidden render-only motion.

Initial presets:

- Parallax Drift
- Camera Push
- Depth Reveal
- Focus Pull
- Orbit

Preset output becomes ordinary typed keyframes so the user can continue editing after applying a preset.

The paused viewport must display the exact authored `currentTimeMs` state.

## 5. Object operations

Complete the scene stack with:

- rename;
- duplicate;
- delete;
- reorder;
- visibility;
- lock;
- reset.

Do not implement fake semantic "split" or "merge" controls unless backed by a real provider operation.

A later re-segmentation action may call SAM 3 with new box/point prompts, but it is not required for the first final production pass unless the API and UI are completed together.

## 6. Portable DepthScene project

Add project save/reopen independent of temporary Canva URLs.

Export:

- `.depthscene.json`

Before download, protected/temporary image references must be materialized into a portable project representation.

Preferred bounded format:

- JSON metadata plus embedded data URLs for source-derived raster assets when total project size is within a safe cap.

If the portable project would exceed the cap, fail clearly rather than producing a broken project.

Import validation must reject:

- arbitrary remote URLs;
- unsupported MIME types;
- duplicate object IDs;
- invalid animation tracks;
- unsafe numeric values;
- oversized projects.

## 7. Production persistence

The current in-memory repositories are not restart-safe.

Introduce repository interfaces with two backends:

- `memory` for deterministic tests;
- `sqlite` for production metadata.

Persist:

- jobs;
- scenes;
- asset metadata.

Store binary scene assets on disk under a bounded application data root.

Suggested environment:

```
DEPTHPOP_REPOSITORY_BACKEND=sqlite
DEPTHPOP_DATABASE_PATH=/data/depthpop/depthpop.sqlite3
DEPTHPOP_ASSET_ROOT=/data/depthpop/assets
```

Every resource remains scoped to:

- Canva `userId`;
- Canva `brandId`.

On restart:

- completed scenes remain available until TTL expiry;
- stale processing jobs are marked failed/recoverable instead of remaining permanently processing;
- orphaned asset metadata/files are cleaned safely.

Filesystem deletion must use resolved-path ancestry checks and must never delete outside `DEPTHPOP_ASSET_ROOT`.

## 8. Export system

DepthPop export is a separate capability from HoloForge and must remain truthful.

### Required outputs

1. PNG still
   - current flattened scene;
   - respects current timeline position.

2. DepthScene JSON
   - portable project format.

3. WebM / MP4 parallax animation
   - real rendered timeline;
   - camera and object keyframes evaluated.

4. GLB
   - reconstructed as a layered 2.5D/3D scene made of textured cutout planes plus reconstructed plate;
   - camera included;
   - animated transforms included when present.

Do not claim volumetric reconstruction. GLB is a real spatial layered scene, not inferred full hidden geometry.

### Renderer

Use a dedicated DepthPop Blender render worker, following the proven HoloForge deployment pattern but not importing HoloForge product code.

The worker receives a validated DepthScene payload plus owned asset files and produces bounded artifacts.

Add:

- `Dockerfile.render`;
- render smoke;
- dedicated render-image workflow if repository CI conventions support it.

### Resource limits

Server-side before Blender starts:

- max render width/height;
- max pixels/frame;
- max rendered frames;
- max project bytes;
- max concurrent Blender jobs;
- timeout.

No user-controlled shell command strings.

## 9. Canva output behavior

PNG still remains the safest default Canva application path.

For still output:

- save latest scene;
- render exact `currentTimeMs`;
- upload to Canva as a derived private asset;
- preserve `parentRef` when there is a source asset;
- use `aiDisclosure: "app_generated"`;
- replace the original selected source only if it is still the same selected source;
- otherwise insert the rendered result as a new element.

Current Canva documentation explicitly supports uploading `type: "video"` assets and inserting video elements with `addElementAtPoint` / `addElementAtCursor`.

For MP4 output:

- upload the authenticated generated MP4 to Canva as `type: "video"`;
- provide a generated still thumbnail;
- mark AI disclosure truthfully;
- insert it as a video element when the current design supports video insertion;
- if the current design surface does not support insertion, keep the authenticated export available and explain the limitation instead of claiming success.

WebM remains an authenticated export format because Canva's documented production example uses MP4 for video insertion.

## 10. Security

Preserve and extend the current security boundary.

Required:

- FAL key stays server-side;
- Canva JWT is verified only on the backend;
- CORS allowlist is exact to the Canva app origin plus explicit local-development origins;
- all scene/job/asset/export lookups require exact user + brand ownership;
- provider media downloads remain allowlisted;
- no arbitrary URL fetch endpoint;
- no browser-supplied provider key;
- no secrets in logs;
- no secrets in repo;
- no broad `Access-Control-Allow-Origin: *` in production;
- render subprocesses use argument arrays;
- filesystem cleanup cannot escape owned roots.

## 11. WebGL failure recovery

Handle:

- `webglcontextlost`;
- `webglcontextrestored`.

On loss:

- prevent the browser from destroying canonical authored state;
- show a compact recovery status;
- pause animation rendering.

On restore:

- recreate textures/materials from already-resolved owned assets;
- restore camera;
- restore selected object;
- restore timeline position;
- resume only if the scene was playing before loss.

No fake screenshot fallback.

## 12. Documentation cleanup

Unify conflicting DepthPop parity documentation.

The maintained Drive file itself contains both the raw Steps control and a later patch that hides it and exposes Fast/Balanced/Cinematic.

Documentation should explicitly distinguish:

- raw execution parameter;
- final visible runtime control.

Update:

- `apps/depthpop-canva/README.md`;
- `apps/depthpop-canva/reference/DRIVE_SOURCE.md`;
- `docs/DEPTHPOP_CANVA_PARITY.md`.

Do not modify the preserved Drive source file.

## 13. Tests

### Frontend

Add tests for:

- scene/world coordinate conversion;
- inverse gizmo conversion;
- object selection;
- translate/rotate/scale reducer updates;
- camera persistence;
- typed animation validation;
- keyframe interpolation;
- easing;
- timeline pause/scrub/play;
- preset-to-keyframe generation;
- portable project validation;
- WebGL context-loss state preservation;
- Canva apply fallback behavior.

### Backend

Add tests for:

- typed animation models;
- persistent SQLite reopen;
- user/brand isolation;
- disk asset ownership;
- safe path cleanup;
- TTL cleanup;
- restart recovery;
- render input bounds;
- export ownership;
- exact current-time render;
- GLB structural validity;
- video smoke;
- provider fail-closed behavior.

## 14. CI and packaging

The standalone DepthPop package must remain independent.

Package must include:

- compiled app bundle;
- manifest;
- preview;
- runtime documentation;
- backend source required for deployment.

Package must exclude:

- HoloForge runtime;
- ROARY shell;
- ÆTHERGRID runtime;
- preserved provenance files when the handoff rules already exclude them;
- secrets;
- `.env`;
- SQLite runtime database;
- generated assets;
- render workspaces;
- caches.

Required green verification:

- frontend tests;
- TypeScript;
- backend tests;
- repository lint/format gates;
- standalone package audit;
- normal CI;
- engineering CI;
- CodeQL;
- separate-app verification;
- DepthPop render-image smoke when added.

## 15. Definition of done

DepthPop is complete when a real Canva user can:

1. select a Canva raster image or choose a local supported raster;
2. choose the maintained DepthPop controls;
3. run the real provider pipeline;
4. receive a real object-aware DepthScene;
5. manipulate extracted objects in a true WebGL viewport;
6. orbit/pan/zoom the scene;
7. author and preview time-based motion;
8. save and reopen the project;
9. survive backend restart without losing valid persisted scene metadata/assets;
10. export a still, a real animation, a real layered GLB, and a portable project;
11. render the exact authored current scene back into Canva;
12. do all of the above without exposing provider secrets or crossing user/team ownership boundaries.

## Non-goals

- full volumetric neural reconstruction from a single raster;
- fake mesh generation for hidden object surfaces;
- device-specific holographic display calibration;
- merging DepthPop and HoloForge into one Canva app;
- adding unrelated infrastructure solely for repository scoring;
- changing the preserved Google Drive provenance source.
