# Live Canva acceptance checklist

Run this checklist against the exact final `main` SHA and the matching GitHub Actions handoff artifacts.

Do not record PASS from repository CI alone. These are live Canva/hosting checks.

## DepthPop

### Portal and deployment

- [ ] Separate DepthPop Canva Developer Portal app exists.
- [ ] App ID matches the backend `CANVA_APP_ID`.
- [ ] Exact HTTPS app origin is configured.
- [ ] Backend is deployed over HTTPS.
- [ ] `npm run deployment:check` passes inside the production runtime.
- [ ] `/data/depthpop` survives service restart.
- [ ] Real FAL secret is configured in the backend only.

### Source and processing

- [ ] Select a raster in Canva.
- [ ] Supported local upload works.
- [ ] Real Florence-2 detection runs.
- [ ] Real SAM segmentation produces object masks.
- [ ] Real Depth Anything V2 depth is produced.
- [ ] FAL inpainting produces the reconstructed plate when requested.
- [ ] Production never silently uses mock providers.
- [ ] Production never silently uses bbox fallback.

### WebGL scene

- [ ] Real React Three Fiber/Three.js scene renders.
- [ ] Reconstructed plate renders.
- [ ] Independent object planes render.
- [ ] Direct object selection works.
- [ ] Translate X/Y/Z works.
- [ ] Rotate works.
- [ ] Scale works.
- [ ] Transform gizmos work.
- [ ] Locked object cannot be manipulated.
- [ ] Hide/show works.
- [ ] Layer ordering works.
- [ ] Orbit/pan/zoom works.
- [ ] Camera changes persist after save/reopen.

### Object operations

- [ ] Rename.
- [ ] Duplicate.
- [ ] Delete.
- [ ] Merge.
- [ ] Split/re-segment through the real provider path.

### Animation

- [ ] Duration/FPS editing.
- [ ] Add/update/delete keyframe.
- [ ] Easing.
- [ ] Play/pause/stop/scrub.
- [ ] PARALLAX.
- [ ] CAMERA PUSH.
- [ ] FLOAT.
- [ ] ORBIT.
- [ ] DEPTH REVEAL.
- [ ] RACK FOCUS depth-emphasis.

### Canva and export

- [ ] Render to Canva inserts the authored result correctly.
- [ ] Portable `scene-json` downloads as JSON.
- [ ] `png-layers` downloads as ZIP.
- [ ] glTF downloads and parses.
- [ ] GLB downloads and parses.
- [ ] WebM renders and downloads.
- [ ] MP4 renders and downloads.
- [ ] Video FPS/resolution controls affect output.
- [ ] An in-progress export can be cancelled.
- [ ] Completed artifact download requires authentication.

### Persistence and ownership

- [ ] Restart backend.
- [ ] Saved scene survives.
- [ ] Retained unexpired export survives.
- [ ] Different Canva user cannot read the scene/artifact.
- [ ] Different brand cannot read the scene/artifact.

## HoloForge

### Portal and deployment

- [ ] Separate HoloForge Canva Developer Portal app exists.
- [ ] App ID matches the backend `CANVA_APP_ID`.
- [ ] Exact HTTPS app origin is configured.
- [ ] Render backend is deployed over HTTPS.
- [ ] `npm run deployment:check` passes inside the production environment.
- [ ] Blender reports 4.5.14.
- [ ] FFmpeg is available.
- [ ] `/data/holoforge` survives service restart.

### Source and Create

- [ ] Selected Canva raster works.
- [ ] Supported local upload works.
- [ ] Holo Text.
- [ ] Holo Logo.
- [ ] Holo Graphic.
- [ ] Glass.
- [ ] Chrome.
- [ ] Light FX.
- [ ] Material presets and authored values update visibly.

### Spatial editor

- [ ] Real WebGL scene.
- [ ] Direct selection.
- [ ] Translate/rotate/scale.
- [ ] X/Y/Z controls.
- [ ] Orbit/pan/zoom.
- [ ] Camera controls.
- [ ] Duplicate.
- [ ] Reorder.
- [ ] Hide/show.
- [ ] Remove.
- [ ] Multi-object composition.
- [ ] Material editing.
- [ ] Geometry editing.

### Geometry truthfulness

- [ ] Transparent PNG exercises silhouette/extrusion path.
- [ ] Disconnected alpha components remain represented where applicable.
- [ ] Opaque/unsuitable raster uses truthful plate fallback.
- [ ] No fake semantic 3D geometry is invented for an opaque raster.

### Animation/project

- [ ] Custom keyframes.
- [ ] Playback.
- [ ] Save HoloScene JSON.
- [ ] Re-import HoloScene.
- [ ] Objects/materials/camera/timeline/keyframes survive round-trip.

### Canva and export

- [ ] PNG Still applies to Canva.
- [ ] GLB.
- [ ] glTF.
- [ ] USDZ.
- [ ] transparent VP9 WebM.
- [ ] H.264 MP4.
- [ ] PNG Sequence.
- [ ] Light-field Quilt.
- [ ] Outputs are structurally valid, not renamed placeholders.

### Persistence and ownership

- [ ] Restart render backend.
- [ ] Retained completed artifact survives.
- [ ] Incomplete render recovers truthfully.
- [ ] Different Canva user cannot download artifact.
- [ ] Different brand cannot download artifact.

## Responsive/error acceptance for both apps

- [ ] Standard sidebar width.
- [ ] Narrow sidebar width.
- [ ] Internal scrolling.
- [ ] No horizontal overflow.
- [ ] WebGL viewport resizes.
- [ ] Timeline/export controls remain reachable.
- [ ] Backend unavailable state is truthful.
- [ ] Provider/render service unavailable state is truthful.
- [ ] Invalid upload state is truthful.
- [ ] Expired artifact state is truthful.

## Final report

Record:

- exact final main SHA;
- exact Actions artifact names;
- Canva app configured/blocked status for each product;
- backend ready/degraded/blocked status for each product;
- pass/fail by checklist section;
- persistence/restart result;
- authorization/ownership result;
- external blockers;
- repository defects found;
- final recommendation: **READY TO RELEASE** or **NOT READY TO RELEASE**.
