# DepthPop Production Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish DepthPop as a standalone production Canva Design Editor app with a real WebGL spatial editor, typed 4D animation, restart-safe persistence, portable projects, truthful render/export paths, and Canva still/video application.

**Architecture:** Keep the existing authenticated AI decomposition backend as the source of DepthScene assets, then make the DepthScene JSON contract the single shared boundary between browser authoring, persistence, and rendering. The browser becomes a true React Three Fiber editor; the backend gains SQLite metadata + owned disk assets and a bounded Blender renderer for video/GLB while retaining the fast Python compositor for still PNGs.

**Tech Stack:** React 19, TypeScript 5.9, Three.js 0.186, React Three Fiber 9, drei 10, Canva Developers SDK, FastAPI/Pydantic/Pillow/NumPy, Python 3.12 stdlib sqlite3, Blender 4.5.14 LTS, FFmpeg available in the render image, Vitest, pytest, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-04-depthpop-production-completion-design.md`

## Global Constraints

- Work only on DepthPop production code plus shared package/CI guards required to verify DepthPop.
- Do not change HoloForge product behavior.
- Preserve `DepthScene.schemaVersion: 1` unless a breaking migration becomes unavoidable; this plan does not require one.
- Maintain exact Canva ownership boundary: verified `userId + brandId`.
- Keep `FAL_KEY` server-side only.
- Production CORS must explicitly allow the Canva app origin; no wildcard production CORS.
- Visible final Drive parity is Depth Strength, Depth Blur, Depth Fidelity, and Render Quality with Fast/Balanced/Cinematic = 14/22/34 steps.
- Provider depth measurements remain truthful; Depth Strength changes authored Z spread, not measured provider depth.
- Florence-2 and SAM 3 do not receive invented inference-step parameters.
- The WebGL viewport is the real editor, not a background image or CSS pseudo-3D layer.
- GLB is a real layered textured spatial scene, not claimed volumetric reconstruction.
- PNG still must render the exact authored `timeline.currentTimeMs`.
- MP4 is the Canva video insertion format; WebM remains an authenticated export.
- No secrets, runtime SQLite databases, generated render workspaces, or provenance ROARY shell files in the handoff ZIP.
- Use TDD for every production change.

## Review Focus

- A scene with an expired/missing owned cutout asset must fail with a bounded recovery message, not leak authorization or silently render a broken plane; Task 5 and Task 9 test this.
- A user rapidly dragging a transform gizmo while the timeline is paused must persist canonical scene coordinates without camera/orbit controls fighting the gizmo; Task 5 tests this.
- A backend restart during a processing/rendering job must not leave the job permanently "processing"; Task 3 and Task 9 test recovery.
- A project containing malicious remote asset URLs or oversized embedded data must be rejected before any browser/backend fetch; Task 8 tests this.
- A WebGL context loss during authored playback must preserve scene, camera, selection, and time and restore without duplicating textures/listeners; Task 5 tests this.

---

### Task 1: Canonical DepthScene Settings and Typed Animation Contract

**Files:**
- Modify: `apps/depthpop-canva/src/intents/design_editor/scene/depth-scene.ts`
- Modify: `apps/depthpop-canva/src/intents/design_editor/scene/depth-scene.test.ts`
- Modify: `apps/depthpop-canva/backend/models/object.py`
- Modify: `apps/depthpop-canva/backend/models/scene.py`
- Create: `apps/depthpop-canva/backend/test_animation_models.py`
- Modify: `apps/depthpop-canva/src/depthpop/depthpop-model.ts`
- Modify: `apps/depthpop-canva/src/depthpop/depthpop-model.test.ts`

**Interfaces:**
- Produces: `DepthPopSceneSettings`, `AnimationProperty`, `AnimationEasing`, `AnimationKeyframe`, `AnimationTrack`, and Pydantic equivalents.
- Produces: `DepthScene.settings` with normalized `depthStrength`, `depthBlur`, `depthFidelity`, `renderQuality`, and `numInferenceSteps`.
- Consumes: existing `DepthScene`, `DepthObject`, `TimelineConfig`.

- [ ] **Step 1: Write failing TypeScript tests**
  - Assert Fast/Balanced/Cinematic normalize to 14/22/34.
  - Assert `isDepthScene` rejects unsupported animation properties, duplicate keyframe times, non-finite values, opacity values outside 0..1, and keyframes beyond duration.
  - Assert a valid scene with typed position/rotation/scale/opacity tracks passes.

- [ ] **Step 2: Verify TypeScript tests fail**
  Run: `cd apps/depthpop-canva && npm test -- src/depthpop/depthpop-model.test.ts src/intents/design_editor/scene/depth-scene.test.ts`
  Expected: FAIL because typed tracks/settings validation do not exist.

- [ ] **Step 3: Write failing Python tests**
  - `test_animation_models_reject_duplicate_times`
  - `test_animation_models_reject_unsupported_property`
  - `test_animation_models_reject_keyframe_after_timeline`
  - `test_scene_settings_preserve_provider_truth_and_quality_mapping`

- [ ] **Step 4: Verify Python tests fail**
  Run: `cd apps/depthpop-canva/backend && python -m pytest -q test_animation_models.py`
  Expected: FAIL because typed models/settings do not exist.

- [ ] **Step 5: Implement the shared schema**
  - Add typed TS animation contracts and strict runtime validators.
  - Add Pydantic `AnimationKeyframe` / `AnimationTrack` models with unique/sorted time validation.
  - Add `DepthPopSceneSettings` to scene model.
  - Replace `animationTracks: unknown[]` / `list[Any]`.
  - Keep JSON field names camelCase.

- [ ] **Step 6: Run focused tests**
  Run TypeScript and Python commands from Steps 2 and 4.
  Expected: PASS.

- [ ] **Step 7: Run app/backend suites**
  Run:
  - `cd apps/depthpop-canva && npm test`
  - `cd apps/depthpop-canva/backend && python -m pytest -q`
  Expected: all pass.

- [ ] **Step 8: Commit**
  `feat(depthpop): type scene settings and animation contract`

---

### Task 2: Make Drive-Parity Controls Affect Scene Creation Truthfully

**Files:**
- Modify: `apps/depthpop-canva/src/intents/design_editor/app.tsx`
- Modify: `apps/depthpop-canva/src/intents/design_editor/api/depthpop-api.ts`
- Modify: `apps/depthpop-canva/src/intents/design_editor/api/depthpop-api.test.ts`
- Modify: `apps/depthpop-canva/src/intents/design_editor/api/scene-runner.ts`
- Modify: `apps/depthpop-canva/src/intents/design_editor/api/scene-runner.test.ts`
- Modify: `apps/depthpop-canva/backend/api/scenes.py`
- Modify: `apps/depthpop-canva/backend/services/scene_builder.py`
- Modify: `apps/depthpop-canva/backend/services/inpainting.py`
- Modify: `apps/depthpop-canva/backend/test_v1_scenes.py`
- Modify: `apps/depthpop-canva/backend/test_app.py`
- Modify: `apps/depthpop-canva/src/intents/design_editor/app.css`

**Interfaces:**
- Consumes: Task 1 `DepthPopSceneSettings`.
- Produces: `CreateSceneOptions.settings`.
- Produces backend form fields `depth_strength`, `depth_blur`, `depth_fidelity`, `render_quality`.
- Produces deterministic initial transform mapping based on measured provider depth + authored settings.

- [ ] **Step 1: Write failing frontend API tests**
  Assert scene creation sends the exact four settings and 14/22/34 mapping without sending invented steps to Florence/SAM-specific client code.

- [ ] **Step 2: Verify frontend tests fail**
  Run: `cd apps/depthpop-canva && npm test -- src/intents/design_editor/api/depthpop-api.test.ts src/intents/design_editor/api/scene-runner.test.ts`
  Expected: FAIL because settings are not in the scene request contract.

- [ ] **Step 3: Write failing backend tests**
  Assert:
  - invalid quality is 422;
  - settings are normalized;
  - Fast => standard depth + 14-step inpaint;
  - Balanced => high depth + 22-step inpaint;
  - Cinematic => high depth + 34-step inpaint;
  - measured object depth stats remain unchanged when Depth Strength changes;
  - authored object Z spread changes with Depth Strength.

- [ ] **Step 4: Verify backend tests fail**
  Run: `cd apps/depthpop-canva/backend && python -m pytest -q test_v1_scenes.py test_app.py`
  Expected: targeted new assertions fail.

- [ ] **Step 5: Implement control panel state and request mapping**
  Use final visible Drive runtime controls:
  - strength 0.05..0.75 default 0.32;
  - blur 0..100 default 35;
  - fidelity 0.05..1 default 0.95;
  - Fast/Balanced/Cinematic 14/22/34.
  Keep raw steps hidden as execution detail.

- [ ] **Step 6: Implement backend mapping**
  Persist normalized settings into the scene and pass only valid provider-specific quality inputs to each provider.

- [ ] **Step 7: Run focused and full suites**
  Expected: all frontend and backend tests pass.

- [ ] **Step 8: Commit**
  `feat(depthpop): wire authored controls into scene creation`

---

### Task 3: Restart-Safe SQLite Metadata and Owned Disk Assets

**Files:**
- Create: `apps/depthpop-canva/backend/persistence/__init__.py`
- Create: `apps/depthpop-canva/backend/persistence/contracts.py`
- Create: `apps/depthpop-canva/backend/persistence/memory_repository.py`
- Create: `apps/depthpop-canva/backend/persistence/sqlite_repository.py`
- Create: `apps/depthpop-canva/backend/persistence/asset_store.py`
- Modify: `apps/depthpop-canva/backend/services/persistence.py`
- Modify: `apps/depthpop-canva/backend/app.py`
- Modify: `apps/depthpop-canva/backend/api/assets.py`
- Modify: `apps/depthpop-canva/backend/api/jobs.py`
- Modify: `apps/depthpop-canva/backend/api/scenes.py`
- Create: `apps/depthpop-canva/backend/test_sqlite_persistence.py`
- Create: `apps/depthpop-canva/backend/test_asset_store.py`
- Modify: `apps/depthpop-canva/backend/.env.example`
- Modify: `apps/depthpop-canva/backend/README.md`

**Interfaces:**
- Produces: repository methods matching current async `save_scene/get_scene/update_job_stage/get_job/get_asset` usage.
- Produces: `AssetStore.save/read/delete_scene_assets`.
- Consumes: Task 1 canonical models.

- [ ] **Step 1: Write failing SQLite reopen/ownership/recovery tests**
  Assert:
  - saved scene survives repository re-instantiation;
  - user/brand mismatch returns no resource;
  - completed job survives reopen;
  - stale queued/processing job becomes deterministic error/recoverable after restart;
  - TTL cleanup deletes metadata and owned files.

- [ ] **Step 2: Verify persistence tests fail**
  Run: `cd apps/depthpop-canva/backend && python -m pytest -q test_sqlite_persistence.py test_asset_store.py`
  Expected: FAIL because durable repositories do not exist.

- [ ] **Step 3: Write failing filesystem safety tests**
  Assert `../`/symlink/external resolved paths cannot be deleted and only paths below `DEPTHPOP_ASSET_ROOT` are removed.

- [ ] **Step 4: Implement repository contracts and SQLite backend**
  Use stdlib `sqlite3`; serialize canonical Pydantic JSON; keep schema initialization idempotent.

- [ ] **Step 5: Implement disk asset store**
  Asset IDs remain opaque; metadata stores path + mime + owner + scene; all path resolution fails closed.

- [ ] **Step 6: Add environment selection and exact production CORS**
  - `DEPTHPOP_REPOSITORY_BACKEND=memory|sqlite`
  - `DEPTHPOP_DATABASE_PATH=/data/depthpop/depthpop.sqlite3`
  - `DEPTHPOP_ASSET_ROOT=/data/depthpop/assets`
  - derive the production Canva frontend origin from lowercase `CANVA_APP_ID`;
  - allow only that origin plus explicitly configured local-development origins;
  - add tests proving an arbitrary origin does not receive an allow-origin header.

- [ ] **Step 7: Run persistence/CORS tests, then full backend suite**
  Expected: all pass.

- [ ] **Step 8: Commit**
  `feat(depthpop): add durable scene and asset persistence`

---

### Task 4: Add the WebGL Coordinate Adapter and Dependencies

**Files:**
- Modify: `apps/depthpop-canva/package.json`
- Create: `apps/depthpop-canva/src/intents/design_editor/viewport/scene-coordinates.ts`
- Create: `apps/depthpop-canva/src/intents/design_editor/viewport/scene-coordinates.test.ts`
- Create: `apps/depthpop-canva/src/intents/design_editor/viewport/depth-texture-cache.ts`
- Create: `apps/depthpop-canva/src/intents/design_editor/viewport/depth-texture-cache.test.ts`

**Interfaces:**
- Produces: `depthObjectToWorld(object, scene): WorldTransform`.
- Produces: `worldTransformToDepthObject(world, object, scene): ObjectTransform`.
- Produces: `bboxToWorldSize(bbox, scene): {width,height}`.
- Produces: bounded authenticated blob-URL texture cache with explicit revoke.

- [ ] **Step 1: Write failing coordinate tests**
  Pin aspect-ratio behavior, normalized X/Y origin, near/far Z mapping, degree/radian boundary, inverse round trip, and non-square image cases.

- [ ] **Step 2: Verify tests fail**
  Run: `cd apps/depthpop-canva && npm test -- src/intents/design_editor/viewport/scene-coordinates.test.ts`
  Expected: FAIL because adapter does not exist.

- [ ] **Step 3: Write failing texture-cache tests**
  Assert same owned URL deduplicates fetch, revocation occurs once, and missing/failed asset returns bounded error without cross-origin auth.

- [ ] **Step 4: Add `three`, `@react-three/fiber`, `@react-three/drei` versions aligned with HoloForge and implement adapters**
  Keep scene storage normalized and renderer conversion isolated here.

- [ ] **Step 5: Run focused and full frontend suites**
  Expected: all pass.

- [ ] **Step 6: Commit**
  `feat(depthpop): add canonical WebGL scene adapters`

---

### Task 5: Replace CSS 2.5D Stage with the Real WebGL Editor

**Files:**
- Create: `apps/depthpop-canva/src/intents/design_editor/viewport/DepthViewport.tsx`
- Create: `apps/depthpop-canva/src/intents/design_editor/viewport/DepthSceneView.tsx`
- Create: `apps/depthpop-canva/src/intents/design_editor/viewport/DepthObjectView.tsx`
- Create: `apps/depthpop-canva/src/intents/design_editor/viewport/DepthCamera.tsx`
- Create: `apps/depthpop-canva/src/intents/design_editor/viewport/DepthTransformControls.tsx`
- Create: `apps/depthpop-canva/src/intents/design_editor/viewport/webgl-recovery.ts`
- Create: `apps/depthpop-canva/src/intents/design_editor/viewport/webgl-recovery.test.ts`
- Modify: `apps/depthpop-canva/src/intents/design_editor/workspace/scene-workspace.tsx`
- Modify: `apps/depthpop-canva/src/intents/design_editor/workspace/scene-workspace.test.tsx`
- Modify: `apps/depthpop-canva/src/intents/design_editor/app.css`

**Interfaces:**
- Consumes: Task 4 coordinate + texture adapters.
- Consumes/Produces canonical reducer actions from `scene-reducer.ts`.
- Produces: `DepthViewport({scene, selectedObjectId, dispatch, apiClient})`.

- [ ] **Step 1: Write failing workspace tests**
  Assert the production workspace renders the WebGL viewport component contract and no longer renders object cutouts through CSS `translate3d`/z-index as its canonical stage.

- [ ] **Step 2: Write failing WebGL recovery tests**
  Assert context loss snapshots playing state but preserves canonical scene/camera/selection/time; restore resumes only if previously playing and does not register duplicate listeners.

- [ ] **Step 3: Verify focused tests fail**
  Run: `cd apps/depthpop-canva && npm test -- src/intents/design_editor/workspace/scene-workspace.test.tsx src/intents/design_editor/viewport/webgl-recovery.test.ts`

- [ ] **Step 4: Implement real R3F viewport**
  - PerspectiveCamera from scene state.
  - reconstructed plate at scene back.
  - transparent cutout planes from owned asset blob URLs.
  - OrbitControls with pan/zoom/orbit.
  - TransformControls with move/rotate/scale.
  - disable orbit while gizmo active.
  - pointer selection.
  - canonical commit only at controlled transform events.
  - attach explicit `webglcontextlost` / `webglcontextrestored` handlers to the renderer canvas;
  - visible WebGL recovery state.

- [ ] **Step 5: Add review-focus regression test**
  Simulate transform start/commit while paused and assert time/camera do not change and canonical transform is committed exactly once.

- [ ] **Step 6: Run frontend suite and typecheck**
  Run:
  - `npm test`
  - `npm run typecheck`
  Expected: pass.

- [ ] **Step 7: Commit**
  `feat(depthpop): replace pseudo-3d stage with WebGL editor`

---

### Task 6: Complete Object Stack, Camera, and Inspector Operations

**Files:**
- Modify: `apps/depthpop-canva/src/intents/design_editor/workspace/scene-reducer.ts`
- Modify: `apps/depthpop-canva/src/intents/design_editor/workspace/scene-reducer.test.ts`
- Create: `apps/depthpop-canva/src/intents/design_editor/workspace/ObjectStackPanel.tsx`
- Create: `apps/depthpop-canva/src/intents/design_editor/workspace/ObjectInspector.tsx`
- Create: `apps/depthpop-canva/src/intents/design_editor/workspace/CameraInspector.tsx`
- Modify: `apps/depthpop-canva/src/intents/design_editor/workspace/scene-workspace.tsx`
- Modify: `apps/depthpop-canva/src/intents/design_editor/api/depthpop-api.ts`
- Modify: `apps/depthpop-canva/backend/api/scenes.py`
- Modify: `apps/depthpop-canva/backend/test_scene_api_mutation.py`

**Interfaces:**
- Produces reducer actions `RENAME_OBJECT` and `SET_UNIFORM_SCALE` plus existing reorder/visibility/lock/reset.
- Extends scene PATCH object entries with optional `label`.
- Produces `DepthPopApiClient.duplicateSceneObject(sceneId, objectId)` and `deleteSceneObject(sceneId, objectId)`.
- Produces backend `POST /api/v1/scenes/{scene_id}/objects/{object_id}/duplicate` and `DELETE /api/v1/scenes/{scene_id}/objects/{object_id}`.
- Duplicate reuses only the source object's already-owned scene assets, creates a server-generated object ID, and assigns the next unique order; delete never accepts arbitrary asset URLs.

- [ ] **Step 1: Write failing reducer tests**
  Assert rename, lock protection, reset, reorder uniqueness, uniform scale, and selection repair when a server-returned scene no longer contains the selected object.

- [ ] **Step 2: Verify reducer tests fail**

- [ ] **Step 3: Write failing API mutation tests**
  Assert:
  - exact-owner duplicate creates a new server ID and next unique order while reusing only same-scene owned assets;
  - exact-owner delete removes the object and compacts order deterministically;
  - wrong user/brand receives 404;
  - unknown object receives 404;
  - locked objects cannot be duplicated/deleted unless explicitly unlocked first;
  - label PATCH is bounded and rejects empty/oversized values;
  - forged asset URLs cannot enter through these operations.

- [ ] **Step 4: Verify backend mutation tests fail**

- [ ] **Step 5: Implement reducer, inspector panels, API client methods, label PATCH, and dedicated duplicate/delete endpoints**

- [ ] **Step 6: Run focused + full frontend/backend suites**

- [ ] **Step 7: Commit**
  `feat(depthpop): complete scene object and camera authoring`

---

### Task 7: Build the Real 4D Timeline, Keyframes, and Presets

**Files:**
- Create: `apps/depthpop-canva/src/intents/design_editor/animation/keyframe-model.ts`
- Create: `apps/depthpop-canva/src/intents/design_editor/animation/keyframe-model.test.ts`
- Create: `apps/depthpop-canva/src/intents/design_editor/animation/presets.ts`
- Create: `apps/depthpop-canva/src/intents/design_editor/animation/presets.test.ts`
- Create: `apps/depthpop-canva/src/intents/design_editor/animation/AnimationPanel.tsx`
- Modify: `apps/depthpop-canva/src/intents/design_editor/workspace/scene-reducer.ts`
- Modify: `apps/depthpop-canva/src/intents/design_editor/workspace/scene-reducer.test.ts`
- Modify: `apps/depthpop-canva/src/intents/design_editor/viewport/DepthObjectView.tsx`
- Modify: `apps/depthpop-canva/src/intents/design_editor/viewport/DepthCamera.tsx`
- Modify: `apps/depthpop-canva/src/intents/design_editor/workspace/scene-workspace.tsx`

**Interfaces:**
- Produces: `sampleAnimationTracks(tracks,timeMs)`.
- Produces: `upsertKeyframe`, `removeKeyframe`, `applyMotionPreset`.
- Presets: `parallax-drift`, `camera-push`, `depth-reveal`, `focus-pull`, `orbit`.

- [ ] **Step 1: Write failing interpolation tests**
  Assert linear/ease-in/ease-out/ease-in-out, exact boundary values, right-keyframe easing rule, and stable single-keyframe behavior.

- [ ] **Step 2: Verify interpolation tests fail**

- [ ] **Step 3: Write failing preset tests**
  Assert each preset creates editable typed tracks within duration and never mutates measured `object.depth`.

- [ ] **Step 4: Verify preset tests fail**

- [ ] **Step 5: Implement timeline reducer actions and playback**
  Include play/pause/scrub/loop/duration/fps and deterministic sampling at `currentTimeMs`.

- [ ] **Step 6: Render sampled object/camera state in WebGL**
  Paused scenes must still evaluate exact current time.

- [ ] **Step 7: Run frontend suite + typecheck**

- [ ] **Step 8: Commit**
  `feat(depthpop): add authored 4d timeline and keyframes`

---

### Task 8: Portable .depthscene.json Project Save and Reopen

**Files:**
- Create: `apps/depthpop-canva/src/intents/design_editor/project/project-export.ts`
- Create: `apps/depthpop-canva/src/intents/design_editor/project/project-export.test.ts`
- Create: `apps/depthpop-canva/src/intents/design_editor/project/project-import.ts`
- Create: `apps/depthpop-canva/src/intents/design_editor/project/project-import.test.ts`
- Create: `apps/depthpop-canva/src/intents/design_editor/project/ProjectControls.tsx`
- Modify: `apps/depthpop-canva/src/intents/design_editor/workspace/scene-workspace.tsx`
- Modify: `apps/depthpop-canva/src/intents/design_editor/api/depthpop-api.ts`
- Modify: `apps/depthpop-canva/backend/api/scenes.py`
- Create: `apps/depthpop-canva/backend/test_project_import.py`

**Interfaces:**
- Produces: `buildPortableDepthScene(scene, resolveAsset): Promise<PortableDepthScene>`.
- Produces: `parsePortableDepthScene(text): DepthScene`.
- Produces API method `importPortableScene(project, signal?): Promise<DepthScene>`.
- Produces backend `POST /api/v1/scenes/import`, which materializes embedded assets into the authenticated owner asset store and returns a new canonical owned DepthScene.
- Portable assets are data URLs only with bounded MIME and total byte size.

- [ ] **Step 1: Write failing export/import round-trip tests**
  Assert scene settings, transforms, camera, timeline, animation, and embedded assets round-trip.

- [ ] **Step 2: Write failing security/size tests**
  Reject `http://`, `https://`, `file://`, malformed data URLs, unsupported MIME, duplicate IDs, non-finite numeric values, and total project bytes above the configured cap.

- [ ] **Step 3: Write failing backend import tests**
  Assert the import route:
  - requires verified Canva ownership;
  - rejects remote URLs and malformed/oversized data URLs;
  - materializes source/cutout/mask/thumbnail/plate/depth-map assets into the owner asset store;
  - generates a new server scene ID instead of trusting the imported ID;
  - preserves settings, transforms, camera, timeline, and typed tracks;
  - returns a scene that can immediately PATCH and render after reopen.

- [ ] **Step 4: Verify frontend/backend project tests fail**

- [ ] **Step 5: Implement portable materialization/import**
  Frontend reuses authenticated `fetchAssetBlobUrl` when exporting and revokes temporary object URLs after serialization. Reopen parses locally for bounded feedback, then posts the validated project to `/api/v1/scenes/import` so further save/render operations use fresh owned server assets.

- [ ] **Step 6: Run frontend + backend suites and typecheck**

- [ ] **Step 7: Commit**
  `feat(depthpop): add portable depthscene projects`

---

### Task 9: Add Bounded DepthPop Export Service and Blender Renderer

**Files:**
- Create: `apps/depthpop-canva/backend/export_models.py`
- Create: `apps/depthpop-canva/backend/export_repositories.py`
- Create: `apps/depthpop-canva/backend/export_renderers.py`
- Create: `apps/depthpop-canva/backend/export_service.py`
- Create: `apps/depthpop-canva/backend/api/exports.py`
- Create: `apps/depthpop-canva/backend/blender_worker.py`
- Create: `apps/depthpop-canva/backend/render_smoke.py`
- Create: `apps/depthpop-canva/backend/test_export_models.py`
- Create: `apps/depthpop-canva/backend/test_export_service.py`
- Create: `apps/depthpop-canva/backend/test_renderers.py`
- Modify: `apps/depthpop-canva/backend/app.py`
- Create: `apps/depthpop-canva/backend/Dockerfile.render`
- Create: `apps/depthpop-canva/backend/docker-compose.render.yml`
- Modify: `apps/depthpop-canva/backend/.env.example`

**Interfaces:**
- Formats: `png-still`, `depthscene-json`, `glb`, `webm`, `mp4`.
- Produces authenticated export submit/status/artifact endpoints.
- PNG may use the existing compositor for fast stills; Blender handles GLB/video.
- Blender worker receives only validated owned local asset paths + canonical scene JSON.

- [ ] **Step 1: Write failing export model/resource bound tests**
  Pin max dimensions, max pixels/frame, max rendered frames, max project bytes, timeout, concurrency, format/MIME map, and currentTimeMs semantics.

- [ ] **Step 2: Verify tests fail**

- [ ] **Step 3: Write failing lifecycle/restart tests**
  Assert incomplete render job recovery, artifact ownership, full workspace cleanup, outside-root deletion protection, and missing owned asset error.

- [ ] **Step 4: Implement export service + repository**
  Reuse Task 3 persistence architecture; do not create a second incompatible ownership model.

- [ ] **Step 5: Write failing Blender smoke/unit fixtures**
  Assert:
  - PNG signature and dimensions;
  - GLB magic `glTF` and non-empty mesh nodes;
  - MP4 playable container signature;
  - WebM EBML signature;
  - sampled transform at exact current time appears in generated Blender scene/fixture expectations.

- [ ] **Step 6: Implement Blender worker**
  Build the reconstructed plate + textured transparent cutout planes, map normalized transforms to Blender coordinates, author transform keyframes, render camera, and package real formats.

- [ ] **Step 7: Add bounded async concurrency and timeout**
  `DEPTHPOP_MAX_RENDER_CONCURRENCY` default 2, clamped 1..8; semaphore must release on failure.

- [ ] **Step 8: Run backend suite**
  Expected: all pass without Blender-only smoke when Blender unavailable.

- [ ] **Step 9: Run production render smoke in render image**
  Expected: PNG/GLB/MP4/WebM artifacts structurally validate.

- [ ] **Step 10: Commit**
  `feat(depthpop): add production scene export renderer`

---

### Task 10: Canva Still and Video Apply Paths

**Files:**
- Create: `apps/depthpop-canva/src/intents/design_editor/export/export-contract.ts`
- Create: `apps/depthpop-canva/src/intents/design_editor/export/export-contract.test.ts`
- Create: `apps/depthpop-canva/src/intents/design_editor/export/export-client.ts`
- Create: `apps/depthpop-canva/src/intents/design_editor/export/export-client.test.ts`
- Create: `apps/depthpop-canva/src/intents/design_editor/export/ExportPanel.tsx`
- Create: `apps/depthpop-canva/src/intents/design_editor/export/canva-apply.ts`
- Create: `apps/depthpop-canva/src/intents/design_editor/export/canva-apply.test.ts`
- Modify: `apps/depthpop-canva/src/intents/design_editor/workspace/scene-workspace.tsx`
- Modify: `apps/depthpop-canva/src/intents/design_editor/app.tsx`

**Interfaces:**
- Consumes Task 9 export endpoints.
- Produces `applyPngToCanva` and `applyMp4ToCanva`.
- Uses Canva `upload` + supported design insertion APIs.

- [ ] **Step 1: Write failing still apply tests**
  Assert same-source selected image replacement retains `parentRef`, uses `aiDisclosure: "app_generated"`, and fallback inserts a new image if the original selection changed.

- [ ] **Step 2: Write failing MP4 apply tests**
  Assert video upload uses `type: "video"`, `mimeType: "video/mp4"`, a thumbnail, truthful AI disclosure, and only inserts when feature support allows.

- [ ] **Step 3: Verify tests fail**

- [ ] **Step 4: Implement authenticated export client + Canva application**
  WebM/GLB/project remain downloadable authenticated exports; MP4 gets Canva insertion action.

- [ ] **Step 5: Run frontend suite + typecheck + build**

- [ ] **Step 6: Commit**
  `feat(depthpop): apply still and video exports to Canva`

---

### Task 11: Documentation, Preview, Packaging, CI, and Production Gates

**Files:**
- Modify: `apps/depthpop-canva/README.md`
- Modify: `apps/depthpop-canva/reference/DRIVE_SOURCE.md`
- Modify: `docs/DEPTHPOP_CANVA_PARITY.md`
- Modify: `apps/depthpop-canva/preview/index.html`
- Modify: `scripts/verify-standalone-canva-apps.mjs`
- Modify: `scripts/package-independent-canva-apps.mjs`
- Modify: `.github/workflows/separate-canva-apps.yml`
- Create: `.github/workflows/depthpop-render-image.yml`

**Interfaces:**
- Consumes all prior tasks.
- Produces final handoff ZIP and CI gates.

- [ ] **Step 1: Write/extend packaging guard assertions first**
  Require DepthPop markers for WebGL, typed animation, portable projects, export contract, and render backend; reject runtime database/artifact/workspace leakage.

- [ ] **Step 2: Verify packaging guard fails on pre-change package**

- [ ] **Step 3: Update preview/documentation and public-app UI compliance**
  Explicitly document raw Steps vs final visible named quality patch and production deployment/persistent-volume requirements.
  Keep user-facing copy inside the existing Canva i18n provider/message system; do not add new hard-coded production strings outside the current app localization pattern.

- [ ] **Step 4: Add DepthPop render-image workflow**
  Pin Blender 4.5.14 and run real render smoke.

- [ ] **Step 5: Run final local verification**
  Run:
  - `cd apps/depthpop-canva && npm install --ignore-scripts`
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
  - `cd backend && python -m compileall -q . && python -m pytest -q`
  - repo-root `node scripts/verify-standalone-canva-apps.mjs`
  - package script into a temp artifact directory and inspect ZIP exclusions.
  Expected: all green.

- [ ] **Step 6: Run GitHub workflow verification**
  Required green:
  - Separate Canva apps
  - depthpop frontend matrix job
  - depthpop backend
  - package-independent-apps
  - DepthPop Render Image
  - repository engineering/ci
  - repository ci
  - CodeQL

- [ ] **Step 7: Commit**
  `chore(depthpop): finalize packaging and production verification`

---

## Final Whole-Branch Verification

After Task 11:

1. Diff branch against the spec line by line.
2. Run the full frontend/backend/package suites again from the final HEAD.
3. Check no secrets or runtime databases/artifacts are tracked.
4. Check DepthPop package contains no HoloForge runtime or historical ROARY shell.
5. Check the generated app bundle does not contain `FAL_KEY` or provider credentials.
6. Check current main has not moved; if it has, rebase/rebuild safely before integration.
7. Perform a fresh code-review pass against base main → final HEAD.
8. Fix Critical/Important findings with RED→GREEN regression tests.
9. Record Minor findings as deferred rather than silently expanding scope.
10. Use `superpowers:finishing-a-development-branch` and let the user choose merge/PR/keep.
