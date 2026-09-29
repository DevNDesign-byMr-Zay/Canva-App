# Independent Canva apps

This repository now contains two independent Canva Design Editor applications:

- apps/holoforge-canva — HoloForge holographic material studio, designed from scratch for Canva.
- apps/depthpop-canva — DepthPop image effect, rebuilt from the maintained Drive v115 interface and wired to a production backend.

Each app has its own package metadata, Canva manifest, source entrypoint, build, UI preview, and Developer Portal deployment boundary. Neither app uses the old runtime product switcher or the __MRZAY_CANVA_PRODUCT__ global.

The pre-existing canva-app directory remains in place for compatibility and historical release continuity while the two independent apps are validated. New product development should target apps/holoforge-canva and apps/depthpop-canva.
