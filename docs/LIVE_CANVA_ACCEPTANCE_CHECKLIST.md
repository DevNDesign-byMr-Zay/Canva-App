# Live Canva Standalone Apps Acceptance Checklist

This document details the step-by-step browser acceptance checklist for validating both standalone Canva applications (**DepthPop** and **HoloForge**) in a live Canva Developer Portal environment.

---

## 1. DepthPop Live Acceptance Checklist

### Prerequisites & Setup
- [ ] Standalone DepthPop Canva app created in Canva Developer Portal.
- [ ] Backend deployed with `ENVIRONMENT=production`, `DEPTHPOP_REPOSITORY_BACKEND=sqlite`, and `FAL_KEY` populated.
- [ ] HTTPS backend URL specified in Canva App settings.

### Execution Steps
1. **Source Selection & Binding**
   - [ ] Open DepthPop inside Canva Design Editor.
   - [ ] Select an existing design canvas image or upload a local raster file.
2. **Provider Processing & Scene Construction**
   - [ ] Trigger processing and verify Florence-2 object detection.
   - [ ] Verify SAM 3 segmentation masks for detected objects.
   - [ ] Verify Depth Anything V2 canonical depth map generation.
   - [ ] Verify FAL inpainting reconstructed background plate.
3. **Spatial WebGL Canvas Interaction**
   - [ ] Confirm scene renders inside the real Three.js / React Three Fiber `<Canvas>`.
   - [ ] Select individual object planes directly inside the WebGL viewport.
   - [ ] Perform direct transform manipulations (Translation X/Y/Z, Rotation, Scale).
   - [ ] Test camera controls (Orbit, Pan, Zoom, Reset, FOV adjustment).
4. **4D Animation & Keyframe Studio**
   - [ ] Scrub timeline to different timestamps.
   - [ ] Add and modify transform keyframes across timeline properties.
   - [ ] Test animation playback loop (`Play`, `Pause`, `Stop`).
   - [ ] Apply each motion preset: `PARALLAX`, `CAMERA PUSH`, `FLOAT`, `ORBIT`, `DEPTH REVEAL`, `RACK FOCUS`.
5. **Object Operations**
   - [ ] Rename an object and verify label persistence.
   - [ ] Duplicate an object and confirm unique ID allocation.
   - [ ] Delete an object and confirm removal from scene.
   - [ ] Merge multiple objects into a combined scene object.
   - [ ] Split an object using live segmentation refinement.
6. **Exports & Canva Integration**
   - [ ] Click `RENDER TO CANVA` and confirm composite image inserts onto active Canva page.
   - [ ] Request and download `scene-json` export ZIP.
   - [ ] Request and download `png-layers` ZIP package.
   - [ ] Request and download valid `glTF` and `GLB` spatial scene files.
   - [ ] Render and download `WebM` and `MP4` video clips.
   - [ ] Test job cancellation on an active video render.
7. **Persistence & Security Isolation**
   - [ ] Restart backend service and verify scene state reloads seamlessly from SQLite database.
   - [ ] Verify cross-user and cross-brand asset access attempts are rejected with 403 Forbidden.

---

## 2. HoloForge Live Acceptance Checklist

### Prerequisites & Setup
- [ ] Standalone HoloForge Canva app created in Canva Developer Portal.
- [ ] Render service deployed with Blender 4.5.x and FFmpeg installed.
- [ ] HTTPS backend URL specified in Canva App settings.

### Execution Steps
1. **Workflow Tabs Navigation**
   - [ ] Open HoloForge inside Canva Design Editor.
   - [ ] Verify narrow sidebar layout navigating through `CREATE`, `SPATIAL`, and `VERIFY` tabs.
2. **Spatial Modeling & Material Editing**
   - [ ] Load source raster image.
   - [ ] Perform direct object transform modifications in 3D viewport.
   - [ ] Edit material properties (roughness, metalness, opacity, spectral effects).
   - [ ] Author custom keyframe tracks and test preset motion effects.
   - [ ] Test object stack management (duplicate, reorder, hide, remove).
3. **Scene Persistence & Reopen**
   - [ ] Save HoloScene project and reopen after browser refresh.
4. **Render Outputs & Exports**
   - [ ] Click `Apply to Canva` and confirm PNG Still renders onto active design canvas.
   - [ ] Request and download 3D spatial models (`GLB`, `glTF`, `USDZ`).
   - [ ] Render and download animated clips (`WebM Alpha`, `MP4`, `PNG Sequence`).
   - [ ] Render and download Light-field `Quilt` image.
5. **Persistence & Security Isolation**
   - [ ] Restart backend render service and verify completed job artifacts remain downloadable.
   - [ ] Verify unauthorized artifact access attempts are rejected.
