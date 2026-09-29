# DepthPop → Canva parity contract

DepthPop's Canva surface is intentionally derived from the maintained Drive build:

`roaryv246_v115_depthpop_modeldrawer_FINALFIX.html`

The Canva app does **not** import the full historical ROARY/AETHER application. Instead, it preserves the current DepthPop product identity, visual language, visible controls, parameter ranges, and quality mapping inside Canva's Design Editor sidebar.

## Sidebar geometry

The Canva app uses one shared sidebar envelope for both HoloForge and DepthPop:

- desktop outer app width: **350px maximum**;
- app inset: **16px** on each side;
- usable product width at the normal desktop panel size: **318px**;
- no horizontal scrolling;
- mobile: full available width while retaining the 16px inset.

This geometry is enforced in both the compiled React UI and the standalone HTML preview.

## DepthPop visual parity

The Canva DepthPop surface keeps the maintained v115 tool-panel direction:

- near-black glass base;
- purple radial illumination;
- purple translucent border;
- 26px panel radius;
- centered layered-square DepthPop glyph;
- `DEPTHPOP` title;
- `DEPTH POP` chip;
- copy: “Turn depth into presence — subtle separation, cinematic focus, same scene.”

The original standalone ROARY panel could reach roughly 340px. Inside Canva the same composition is adapted to the 318px usable width rather than reproducing the entire ROARY image-modal chrome.

## Control parity

| Control | Canva value/range | v115 source behavior |
| --- | --- | --- |
| Depth Strength (subject pop) | default 0.32; 0.05–0.75; step 0.01 | same |
| Depth Blur (background softness) | default 35%; 0–100; step 1 | same |
| Depth Fidelity (depth-map accuracy) | default 0.95; 0.05–1.00; step 0.01 | same |
| Render Quality — Fast | 14 inference steps | same preset mapping |
| Render Quality — Balanced | 22 inference steps | same preset mapping |
| Render Quality — Cinematic | 34 inference steps | same preset mapping |

The raw inference-steps slider remains an implementation detail, matching the v115 quality-preset patch that hides the raw slider and exposes named quality modes instead.

## Execution boundary

The visible action remains **EXECUTE DEPTHPOP**.

The Drive build can call the local ROARY image-tool routes. The Canva app does not silently reuse those localhost routes. Until an authenticated Canva-compatible image-effect provider is configured, execution stays disabled. This preserves UI/parameter parity without creating an untrusted hidden write path.

## Files that must stay synchronized

- `src/intents/design_editor/depthpop/depthpop-model.ts`
- `src/intents/design_editor/depthpop/depthpop-panel.tsx`
- `src/intents/design_editor/app.css`
- `src/assets/depthpop-logo.svg`
- `preview/index.html`
- `preview/styles.css`
- `preview/preview.js`

Release readiness checks the key labels, ranges, quality mappings, 350px sidebar envelope, 16px inset, and standalone preview parity so the production bundle and review HTML cannot drift apart unnoticed.
