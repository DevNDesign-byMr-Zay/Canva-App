# Standalone Canva frontend coverage evidence

The maintained products are `apps/holoforge-canva` and `apps/depthpop-canva`, not the compatibility `canva-app` directory.

Run after a clean `npm ci --ignore-scripts` in **each** app root:

```bash
npm run typecheck
npm test
npm run test:coverage
npm run build
```

The blocking `standalone-frontend-coverage` GitHub Actions matrix job performs the locked install and measures all maintained `src/**/*.{ts,tsx}` files, including unexecuted UI and 3D modules. The initial app-wide floors are based on a full-source V8 baseline:

| App | Measured statements / branches / functions / lines | Enforced minimums |
| --- | --- | --- |
| HoloForge | 40.53% / 44.74% / 36.09% / 41.67% | 40% / 44% / 35% / 41% |
| DepthPop | 53.79% / 58.67% / 55% / 55.96% | 53% / 58% / 54% / 55% |

Previously covered critical modules retain stricter per-module floors of 70% lines, statements and functions, and 60% branches:

- HoloForge: material contract and Canva capability matrix.
- DepthPop: deterministic animation interpolation.

**Scope limitation:** These app-wide floors expose current gaps, particularly untested HoloForge viewport components and export UI. They do not assert 70% full-application coverage. WebGL canvases, backend providers and export flows still require separate integration/contract/browser tests. Raise the floors with direct TSX/WebGL tests; never exclude source modules simply to make a threshold pass.

The `verify:fresh` path includes these coverage checks in addition to both independent backend test suites. Live FAL inference and Blender render smoke are opt-in / environment-dependent and should not be required for routine unit verification.

Lockfiles are committed for both standalone applications, their Python backends, and the compatibility app; `tests/js/standalone-app-lockfiles.test.mjs` checks the independent app manifests and dependency locks.
