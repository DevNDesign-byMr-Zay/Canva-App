# DepthPop — standalone Canva app

DepthPop is its own Canva Design Editor app, separate from HoloForge.

The visible interface is reconstructed from the maintained Drive v115 source file roaryv246_v115_depthpop_modeldrawer_FINALFIX.html. The Canva app keeps the original four visible controls and defaults:

- Depth Strength: 0.32, range 0.05–0.75
- Depth Blur: 35%, range 0–100
- Depth Fidelity: 0.95, range 0.05–1.00
- Steps: 28, range 8–50

The older Fast/Balanced/Cinematic substitution is removed because it was not identical to the Drive v115 UI.

Runtime flow:

    selected Canva raster image
      -> getTemporaryUrl()
      -> immediate browser fetch of the full-size raster
      -> authenticated multipart upload to the DepthPop backend
      -> Depth Anything v2 depth map
      -> local depth-aware lens blur
      -> short-lived public HTTPS render URL
      -> Canva private derived asset upload with parentRef
      -> await asset.whenUploaded()
      -> selected image ref replacement
      -> draft.save()

The frontend marks the derived asset as app_generated because AI is used to compute the depth map. FAL_KEY remains server-side only.

Development:

    cp .env.template .env
    npm install --ignore-scripts
    npm run typecheck
    npm run test
    npm run start

The backend is under backend/. Deploy it to a public HTTPS origin and set CANVA_BACKEND_HOST to that origin before building the Canva app.

The exact Drive source HTML and the historical DepthPop router are retained byte-for-byte under reference/drive-source for provenance. The router is stored as a .txt artifact because it is historical code, not the production server.
