# DepthPop Canva App

Standalone Canva Design Editor app for DepthPop.

This project is intentionally separate from HoloForge. Its visible control contract is derived from the maintained Drive source:

- `roaryv246_v115_depthpop_modeldrawer_FINALFIX.html`
- Drive file ID: `1PW8b9KIYNAtGKG4IL3_zCsnP4Vbvquo3`
- Source SHA-256: `657d7e38654c4b72a075e5972c75625857a1e1a04dd493fa710f0abd6aa6c4c6`

Visible parity:
- **DEPTHPOP**
- **DEPTH POP**
- “Turn depth into presence — subtle separation, cinematic focus, same scene.”
- Depth Strength: 0.32 default, 0.05–0.75
- Depth Blur: 35% default, 0–100%
- Depth Fidelity: 0.95 default, 0.05–1.00
- Fast / Balanced / Cinematic → 14 / 22 / 34 steps
- **EXECUTE DEPTHPOP**

The raw Drive source's hidden Steps slider remains represented by the three Render Quality presets, matching the maintained v115 UI behavior.

## Canva project contract

- `canva-app.json` lives at this app root.
- Only the Design Editor intent is enrolled.
- Current implementation requests only design-content read permission.
- Desktop UI is constrained to Canva's ~350px side-panel envelope with a 16px inset and no horizontal scrolling.
- Production bundle is generated as `dist/app.js`.
- Upload only `dist/app.js` to the separate DepthPop app record in Canva Developer Portal.

Execution remains fail-closed until the authenticated Canva-compatible image-effect provider is connected; the old ROARY/AETHER runtime is not imported.

## Inspection formats

The app project also carries a non-empty `ui.json` describing the visible product contract. Packaged builds include canonical `canva-app.json`, an identical `app.json` alias for inspection tooling, `ui.json`, and an app-specific root HTML entrypoint that opens the standalone preview.

## Verify

```bash
npm ci --ignore-scripts
npm run typecheck
npm test
npm run test:coverage
npm run build
```

For browser-only visual review, open `preview/index.html`.
