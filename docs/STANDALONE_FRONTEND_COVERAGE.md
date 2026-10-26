# Standalone Canva frontend coverage evidence

The maintained products are `apps/holoforge-canva` and `apps/depthpop-canva`, not the compatibility `canva-app` directory.

Run after a clean `npm ci --ignore-scripts` in **each** app root:

```bash
npm run typecheck
npm test
npm run test:coverage
npm run build
```

The blocking `standalone-frontend-coverage` GitHub Actions matrix job performs the locked install and enforces the following **initial critical-module** thresholds: 70% lines, 70% statements, 70% functions and 60% branches.

- HoloForge: material contract and Canva capability matrix.
- DepthPop: deterministic animation interpolation.

**Scope limitation:** This is not a 70% full-application coverage claim. WebGL canvases, app UI, backend providers and export flows require separate integration/contract/browser tests. Expand the include set and add direct TSX/WebGL tests as the coverage baseline improves; never exclude previously covered modules simply to make a threshold pass.

The `verify:fresh` path includes these coverage checks in addition to both independent backend test suites. Live FAL inference and Blender render smoke are opt-in / environment-dependent and should not be required for routine unit verification.

Lockfiles are committed for both standalone applications, their Python backends, and the compatibility app; `tests/js/standalone-app-lockfiles.test.mjs` checks the independent app manifests and dependency locks.
