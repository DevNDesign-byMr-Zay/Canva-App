# DepthPop Drive source provenance

The standalone Canva app is based on the maintained Drive v115 interface:

- roaryv246_v115_depthpop_modeldrawer_FINALFIX.html
- Drive file ID: 1PW8b9KIYNAtGKG4IL3_zCsnP4Vbvquo3

The associated DepthPop router preserved here is:

- roary_router_5055_SEARCH_FIXED_v261_depthpop_progress_v3.py
- Drive file ID: 1nDTMiYuC4dAIJ1m_wSUaB3RQ8ixhEJYR

Both files are stored byte-for-byte under drive-source so the new Canva implementation can be audited against the actual working lineage rather than a rewritten description.

The historical router is not used directly in production. During recovery it was found to contain unrelated ROARY endpoints and stale progress references outside the isolated DepthPop path. backend/app.py keeps the DepthPop algorithm and provider boundary while removing unrelated tools, accepting no client-supplied provider keys, validating Canva JWTs, and adding safe public image fetching for the Canva Selection API workflow.

Visible v115 control contract:
- Depth Strength (subject pop): default 0.32, 0.05–0.75, step 0.01
- Depth Blur (background softness): default 35, 0–100, step 1
- Depth Fidelity (depth-map accuracy): default 0.95, 0.05–1.00, step 0.01
- Steps (quality vs speed): default 28, 8–50, step 1
- action: EXECUTE DEPTHPOP

The previous Canva adaptation that substituted Fast/Balanced/Cinematic presets is superseded by this exact four-control contract.
