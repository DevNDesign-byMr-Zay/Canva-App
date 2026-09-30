# Independent Canva apps

This repository now contains two independent Canva Design Editor applications:

- apps/holoforge-canva — HoloForge holographic material studio, designed from scratch for Canva.
- apps/depthpop-canva — DepthPop image effect, rebuilt from the maintained Drive v115 interface and wired to a production backend.

Each app has its own package metadata, Canva manifest, source entrypoint, build, UI preview, and Developer Portal deployment boundary. Neither app uses the old runtime product switcher or the __MRZAY_CANVA_PRODUCT__ global.

The pre-existing canva-app directory remains in place for compatibility and historical release continuity while the two independent apps are validated. New product development should target apps/holoforge-canva and apps/depthpop-canva.


## Complete package artifacts

The `Separate Canva apps` workflow now produces **two separate complete artifacts**, one for HoloForge and one for DepthPop. Each artifact opens locally through `START-HERE.html` and contains a root-level `app.js` for the matching Canva Developer Portal app.

The HoloForge package contains its compiled bundle, manifest, browser preview, and maintained UI/source files. The DepthPop package additionally contains the complete authenticated FastAPI backend, backend tests, Dockerfile, dependency list, blank environment template, and exact Drive source provenance. Neither artifact contains `node_modules`, credentials, or the combined legacy product switcher.
