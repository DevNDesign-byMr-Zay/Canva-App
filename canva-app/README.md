# HoloForge + DepthPop Canva App

This directory is the maintained Canva Apps SDK surface for **HoloForge** and **DepthPop**. It is intentionally separate from the repository's historical authenticated archive and Node-based archive verification tooling.

The runtime opens a compact product switcher: HoloForge exposes CREATE → SPATIAL → VERIFY, while DepthPop exposes a dedicated depth/focus/bokeh interface. The old AETHER/ROARY HTML shell is not imported by this Canva UI.

## Open the package correctly

Canva does **not** use an HTML entrypoint for the production app bundle. The Developer Portal expects the compiled JavaScript bundle, `app.js`, which Canva runs inside its own iframe. Uploading the ZIP itself as the JavaScript bundle can produce a syntax error because Canva would be trying to parse ZIP bytes as JavaScript.

The clean package now makes the two paths explicit:

- **To preview the UI locally:** open `START-HERE.html` or `preview/index.html`.
- **To install/update the Canva app:** upload the root-level `app.js` in **Developer Portal → Inside Canva → Code upload → JavaScript bundle**.
- Do **not** upload the ZIP, `START-HERE.html`, or `preview/index.html` as the Canva JavaScript bundle.

The local HTML preview is standalone and does not call Canva APIs. It mirrors the HoloForge and DepthPop interface for visual inspection. The real Canva UI remains the React/TypeScript app compiled into `app.js`.

## Clean distribution package

The repository intentionally keeps historical recovery material for provenance, but that material does **not** belong in the Canva app ZIP. After a production build, package the maintained UI only:

```bash
npm --prefix canva-app run build
npm run package:canva-ui
```

The release workflow then zips `.artifacts/canva-ui/` as `canva-app-ui.zip`. The root of that ZIP contains `app.js`, `messages_en.json`, `canva-app.json`, `START-HERE.html`, `UPLOAD-TO-CANVA.txt`, this README, and a package note. The `preview/` directory contains the standalone HTML/CSS/JavaScript UI preview. It explicitly rejects `app/authenticated-v115/`, `legacy-html/`, `provenance/`, archive verifier code, SBOMs, and release metadata.

DepthPop's production UI is present now, but its destructive/apply action remains fail-closed until an authenticated image-effect provider is configured. This prevents the legacy AETHER runtime from being used as a hidden execution path.

## Product contract

`Canva design → current snapshot → upstream scenario → spatial/evidence comparison → explicit apply → verified result`

The Canva app owns:

- Design Editor intent registration.
- Canva-native UI and localization providers.
- Current-design snapshotting.
- Context/capability detection.
- Stale-snapshot protection.
- Explicit, user-triggered write-back.
- Post-apply verification of the expected live state.

The Canva app does **not** own:

- Scenario generation or optimization.
- A second scenario/evidence schema.
- Autonomous edits or retry loops.
- Persistence authority for historical artifacts.
- Physical actuation or holographic control.

## Canva compatibility decisions

- Uses the current Design Editor intent pattern with `prepareDesignEditor`.
- Uses `AppUiProvider` and `AppI18nProvider` rather than custom editor chrome.
- Uses the current supported `@canva/design` APIs in this slice.
- Uses `useFeatureSupport` so the app can fail gracefully when design editing is unavailable in the current Canva context.
- Reads the current page through `openDesign({ type: "current_page" })` and checks for an absolute page with stable dimensions.
- Applies all selected element changes inside one `openDesign` session and calls `sync()` once, producing one coherent Canva undo action.
- Re-reads the live page after that sync inside the same design session and refuses to report success unless the resulting fingerprint equals the reviewed expected post-state.
- Refuses to apply a scenario when the source snapshot fingerprint is stale, evidence is incomplete, hard constraints failed, provenance fingerprints are missing, the scenario is not advisory-only, the target is unsupported, or a requested transform is outside the stable Canva write set.

## Design identity trust boundary

`getDesignMetadata()` is used here for presentation metadata such as the design title; it is **not** treated as the source of truth for a design ID.

A write-capable scenario must arrive with a design identity that has been trusted by the upstream integration. The browser snapshot accepts that identity through `readCurrentDesignSnapshot({ trustedDesignId })`; without it, the snapshot remains useful for read/preview work but `canApplyScenario()` fails closed.

The Canva Design Token is the intended bridge for backend identity verification. The browser must not decode or verify the token itself. The integration should send the signed token to its backend, let the backend verify it and obtain the design ID, then provide that trusted identity alongside the canonical upstream scenario. This keeps authentication/authorization and scenario provenance out of the Canva UI layer.

## Spatial scenario comparison

The Design Editor package now includes a pure read-only spatial scenario view model. It projects the reviewed Canva snapshot into two deterministic depth layers: source at depth 0 and candidate at depth 1. The model carries the exact baseline score, candidate score, objective gap, interpretation, and canonical scenario provenance into a SHA-256 view fingerprint.

The comparison layer refuses source-design/page/snapshot drift, incomplete or failed hard-constraint evidence, non-advisory scenarios, incomplete Canva element mappings, and tampered canonical provenance. Locked elements that are not part of the candidate remain unchanged between branches. The view model never writes to Canva; the existing explicit Apply boundary remains the only mutation path.

## Scenario boundary

The app consumes the canonical HoloForge scenario envelope maintained outside this Canva-specific package. The envelope must provide source identity, snapshot provenance, candidate layout, evidence, and preview/apply safety gates.

The browser-side gate intentionally does not generate or mutate scenario evidence. It checks the minimum conditions required before a user-selected scenario can reach Canva's write API. Full scenario provenance validation remains the upstream contract authority.

## Post-apply verification receipt

A successful Canva `sync()` is not treated as proof by itself. The write boundary first projects an expected post-state from the reviewed snapshot using only the supported writable transform set (`x`, `y`, and `rotation`). After the single user-triggered `sync()`, the live page is fingerprinted again and must exactly match that expected state.

When it does, the app creates an immutable version-1 verification receipt containing:

- scenario identity and canonical scenario fingerprint;
- reviewed source fingerprint;
- expected and resulting post-state fingerprints;
- the unique changed-element identities;
- a deterministic receipt fingerprint;
- explicit safety markers proving user-triggered apply, no auto-apply, non-authoritative behavior, and no physical actuation.

The receipt is evidence of the observed state transition, not a replacement for the upstream scenario contract. A postcondition mismatch clears the success state and requires a fresh read/review; there is no silent retry.

## Local development

```bash
cd canva-app
npm ci --ignore-scripts
npm start
```

The development server is intended to be previewed from the Canva editor, not by navigating directly to localhost. Create/configure the Canva app in the Developer Portal and point its Development URL at the local server.

For production builds:

```bash
npm run build
```

The current Canva starter kit and documentation are the source of truth for CLI/build behavior and supported SDK versions.

## Trusted review-context mount

The production Design Editor mount obtains a fresh Canva design token with `getDesignToken()` and a fresh Canva user token with `auth.getCanvaUserToken()`, then sends both through the existing trusted review-context client to `${BACKEND_HOST}/review-context`. Token contents are never decoded or trusted in browser code.

Only backend-verified scenario/design/page context is passed into `App`. If the backend is missing, rejects the request, returns invalid context, or returns mismatched identity, the mount resolves to no trusted scenario and the Apply path remains locked. Every refresh uses fresh token calls; tokens are not cached as identity proof.

The Canva CLI resolves `BACKEND_HOST` from `CANVA_BACKEND_HOST`. Copy `canva-app/.env.template` to `canva-app/.env` for local preview and point that value at the trusted review-context backend. Keep the production host in deployment configuration rather than hard-coding a URL in the app source.

