# HoloForge Canva App

Standalone Canva Design Editor app for HoloForge.

This is intentionally a separate Canva application from DepthPop. It contains only the HoloForge CREATE → SPATIAL → VERIFY workflow, holographic material controls, Canva-native/app-owned forging paths, and verified explicit Apply flow.

## Canva project contract

- `canva-app.json` lives at this app root.
- `src/index.tsx` synchronously registers the Design Editor intent with `prepareDesignEditor`.
- Desktop UI is constrained to Canva's ~350px editor side-panel envelope and remains responsive on narrow/mobile panels.
- Production bundle is generated as `dist/app.js`.
- Upload only `dist/app.js` to the HoloForge app record in Canva Developer Portal.

## Verify

```bash
npm ci --ignore-scripts
npm run typecheck
npm test
npm run test:coverage
npm run build
```

For a local browser-only visual reference, open `preview/index.html`. The preview does not call Canva APIs.
