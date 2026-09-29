# Canva Apps

This repository now maintains **two separate Canva applications**:

1. `holoforge-canva/` — HoloForge CREATE / SPATIAL / VERIFY studio.
2. `depthpop-canva/` — DepthPop depth-effect tool matching the maintained Drive v115 panel.

They have independent manifests, package metadata, source entrypoints, tests, build outputs, and distributable `app.js` bundles. They are not product modes inside one Canva app.

The former `canva-app/` directory is retained temporarily as migration/provenance source only and is excluded from the new two-app distribution pipeline.
