# DepthPop Drive source provenance

The standalone Canva app is based on the maintained Drive v115 interface:

- roaryv246_v115_depthpop_modeldrawer_FINALFIX.html
- Drive file ID: 1PW8b9KIYNAtGKG4IL3_zCsnP4Vbvquo3

The associated historical DepthPop router is preserved byte-for-byte as:

- roary_router_5055_SEARCH_FIXED_v261_depthpop_progress_v3.py.txt
- Drive file ID: 1nDTMiYuC4dAIJ1m_wSUaB3RQ8ixhEJYR

The .txt suffix is deliberate: the router is provenance, not live application code, and should not be scanned or imported as a production Python service.

The production backend in ../../backend/app.py keeps the DepthPop-specific provider and depth-aware rendering behavior while removing unrelated ROARY endpoints, browser-supplied provider keys, permissive CORS, and user-controlled server-side URL fetching.

Visible v115 control contract:
- Depth Strength (subject pop): default 0.32, 0.05–0.75, step 0.01
- Depth Blur (background softness): default 35, 0–100, step 1
- Depth Fidelity (depth-map accuracy): default 0.95, 0.05–1.00, step 0.01
- Steps (quality vs speed): default 28, 8–50, step 1
- action: EXECUTE DEPTHPOP

The previous Canva adaptation that substituted Fast/Balanced/Cinematic presets is superseded by this exact four-control contract.


## Packaging boundary

These Drive files are **provenance only**. They are not part of the user-facing DepthPop Canva handoff ZIP.

The historical v115 HTML contains the complete ROARY Studio shell (including Media Library, Conversations, New Chat, and the composer) because DepthPop originally lived as a tool inside that application. The standalone Canva app extracts only the DepthPop-specific visual/control contract and processing behavior.

If a Canva preview shows the ROARY/ÆTHER shell, the wrong artifact has been opened or uploaded. The correct DepthPop Canva runtime is the root-level `app.js` from the generated `DepthPop-Canva-App.zip`.
