# Canva two-app architecture

HoloForge and DepthPop are separate Canva applications.

| App | Project | Canva bundle | Intent | Current permissions |
| --- | --- | --- | --- | --- |
| HoloForge | `apps/holoforge-canva/` | `dist/app.js` | Design Editor | design content read + write |
| DepthPop | `apps/depthpop-canva/` | `dist/app.js` | Design Editor | design content read |

## Product boundaries

### HoloForge

HoloForge retains the approved CREATE → SPATIAL → VERIFY Canva sidebar experience, holographic materials, preview flow, app-owned forging path, and explicit verified Apply boundary. No DepthPop selector, controls, source, or branding is included in its standalone build.

### DepthPop

DepthPop is derived from the maintained Drive source `roaryv246_v115_depthpop_modeldrawer_FINALFIX.html` (Drive ID `1PW8b9KIYNAtGKG4IL3_zCsnP4Vbvquo3`, SHA-256 `657d7e38654c4b72a075e5972c75625857a1e1a04dd493fa710f0abd6aa6c4c6`).

The Canva UI preserves the maintained product copy and parameter contract while adapting the panel to Canva's editor-side layout. It does not import the AETHER/ROARY shell or HoloForge source.

## Distribution

Run both production builds, then:

```bash
node scripts/assemble-canva-apps.mjs
```

This produces two independent package directories:

- `.artifacts/canva-apps/holoforge/`
- `.artifacts/canva-apps/depthpop/`

CI zips them separately. Each ZIP contains exactly one root-level `app.js` and one app-specific HTML preview.
