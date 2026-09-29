# DepthPop — standalone Canva app

DepthPop is now its own Canva Design Editor app, separate from HoloForge.

The visible interface is reconstructed from the maintained Drive v115 source file roaryv246_v115_depthpop_modeldrawer_FINALFIX.html. The Canva app keeps the original four visible controls and defaults:

- Depth Strength: 0.32, range 0.05–0.75
- Depth Blur: 35%, range 0–100
- Depth Fidelity: 0.95, range 0.05–1.00
- Steps: 28, range 8–50

The old Fast/Balanced/Cinematic substitution has been removed because it was not identical to the Drive v115 UI.

Runtime flow:

    selected Canva raster image
      -> temporary Canva asset URL
      -> authenticated DepthPop backend request
      -> Depth Anything v2 depth map
      -> local depth-aware lens blur
      -> public derived image URL
      -> Canva private asset upload with parentRef
      -> selected image ref replacement
      -> draft.save()

The frontend never receives FAL_KEY. Every backend request uses a fresh Canva user JWT and the backend verifies that JWT against Canva's app JWKS before processing.

Development:

    cp .env.template .env
    npm install --ignore-scripts
    npm run typecheck
    npm run test
    npm run start

The backend is under backend/. Deploy it to a public HTTPS origin and set CANVA_BACKEND_HOST to that origin before building the Canva app.

The exact Drive source HTML and the historical DepthPop router are retained byte-for-byte under reference/drive-source for provenance. The production backend is a smaller hardened service derived from the DepthPop-only path rather than shipping unrelated ROARY tools.
