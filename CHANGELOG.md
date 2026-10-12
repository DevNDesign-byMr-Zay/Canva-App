# Changelog

All notable maintained-surface changes to this repository are documented here.

## 2026-10-12 — standalone Canva production completion

### HoloForge

- Finalized the standalone React Three Fiber / Three.js spatial authoring workflow, persistent HoloScene editing, multi-object composition, material/geometry controls and 4D keyframe animation.
- Added the authenticated durable render backend with persistent SQLite metadata, restart recovery, bounded Blender rendering and owner-scoped artifacts.
- Qualified real PNG Still, GLB/glTF, USDZ, transparent WebM, MP4, PNG Sequence and light-field Quilt outputs.
- Consolidated render-parity and artifact-lifecycle work into the canonical production implementation merged through PR #251.

### DepthPop

- Replaced the flat compatibility experience with the canonical DepthScene v1 object-scene architecture and real React Three Fiber / Three.js spatial editor.
- Added direct X/Y/Z, rotation/scale gizmos, persisted camera controls, WebGL recovery, 4D timeline/keyframes and serializable motion presets.
- Added authenticated server-backed rename, duplicate, delete, merge and provider-backed split/re-segmentation.
- Added durable scene/export persistence and real portable scene JSON, PNG-layer ZIP, glTF/GLB and WebM/MP4 export jobs.
- Preserved Render to Canva as a separate authenticated output path.
- Completed the production frontend/backend integration through PR #257 and follow-up frontend completion PR #258.

### Packaging and repository cleanup

- Final handoff artifacts are exactly `HoloForge-Canva-App.zip` and `DepthPop-Canva-App.zip`.
- Historical ROARY/ÆTHER material and DepthPop Drive provenance remain repository-only and are excluded from final handoff ZIPs.
- Closed superseded open PRs #206, #213, #246 and #247 after verifying their maintained work was replaced or consolidated on current `main`.
- Current standalone package audits reject credentials, databases, generated artifacts, cross-product source leakage and historical reference trees.

## Historical pre-separation work — superseded by standalone production apps

### Fixed

- Canva UI packaging now places the production `app.js` at the ZIP root instead of hiding it under `app/`, preventing users from mistaking the whole ZIP for Canva's JavaScript upload.
- Added `START-HERE.html` plus a standalone `preview/index.html` UI preview for HoloForge and DepthPop, so the interface can be opened locally without Canva while the real app remains the compiled `app.js`.
- CI now syntax-checks the generated `app.js` and verifies both HTML preview entrypoints before retaining or releasing the package.
- Packaging now fails on empty files, malformed JSON, incomplete bundles, or missing UI assets; the combined review ZIP includes `app.json`, canonical `canva-app.json`, full `HOLOFORGE.html` / `DEPTHPOP.html` UI documents, and a SHA-256 `PACKAGE_MANIFEST.json` inventory.
- Added separate `holoforge-canva-app.zip` and `depthpop-canva-app.zip` distributions. Each contains a product-locked `app.js`, valid JSON manifests, `ui.json`, full `app.html` / `index.html` UI, emitted assets, instructions, and its own checksum inventory.
- HoloForge and DepthPop now share the real Canva sidebar envelope: 350px maximum desktop width, 16px internal margins, mobile full-width behavior, and no horizontal scrolling. The standalone HTML preview uses the same dimensions instead of a desktop mock device.


### Added

- Rebuilt **DepthPop** from the maintained Drive v115 surface: black/purple glass panel, layered-square tool icon, exact title/chip/description, Depth Strength (0.05–0.75), Depth Blur (0–100%), Depth Fidelity (0.05–1.00), and Fast/Balanced/Cinematic quality mapped to 14/22/34 steps. Execution remains fail-closed until an authenticated image-effect provider is configured.
- HoloForge/DepthPop product switcher so the maintained Canva app exposes the real product UIs rather than the historical AETHER/ROARY shell.
- Clean `canva-app-ui.zip` packaging in CI/releases. The UI package explicitly excludes authenticated historical HTML, legacy archive payloads, provenance corpora, verifier code, SBOMs, and release metadata.

- A conventional root `ci.yml` exposing root Node tests, Python tests/lint/typecheck, and Design Editor typecheck/test/build.
- Explicit Python verification-tool metadata plus exact lock-parity verification.
- A coverage-scope boundary that keeps CI-only parity tooling outside application coverage while still running it as a mandatory gate.
- A real Vitest V8 configuration with blocking 80% statements/branches/functions/lines thresholds and release-readiness protection for scanner-visible coverage/fresh-clone jobs.

### Changed

- Current root application candidate: `1.1.3`. The `v1.1.2` release is the latest hosted milestone; this candidate is not published until the gated manual release workflow publishes it.

## 1.1.1 — 2026-09-24

- Published as `v1.1.1` on 2026-09-24 through the gated manual release workflow.

### Added

- Canonical root `docker-compose.yml` discovery and a complete backend/CI environment example.
- Reusable structured backend JSON logging plus versioned/uptime-aware `GET /health` metadata.
- Retained Python coverage XML and maintained-runtime V8 coverage as 30-day workflow artifacts.
- Release-readiness enforcement for the application-tooling classification and fresh-clone detection signals.

## 1.1.0 — 2026-09-24

- Published as `v1.1.0` on 2026-09-24 through the gated manual release workflow.

### Added

- A measured HoloForge placement experiment with exact classical reference, deterministic VÆLON candidate evidence, observational objective-gap reporting, and a canonical bridge into the existing spatial preview and explicit Apply boundary.
- A deterministic read-only HoloForge spatial scenario view that compares source and candidate geometry as separate depth layers, binds the view to canonical provenance, and carries measured classical-baseline/candidate objective evidence without adding mutation authority.
- A real Canva Design Editor workspace with locked SDK dependencies, TypeScript verification, Vitest coverage, and production build gates.
- A trusted server-side review-context boundary using Canva's official middleware to verify fresh user and design tokens before canonical scenario context reaches the browser.
- Explicit source-design, page, snapshot, provenance, and post-apply verification boundaries so stale or substituted context fails closed before mutation.
- Root-level `npm run app:verify` orchestration for a reproducible Design Editor install, production dependency audit, typecheck, tests, and build.
- Release-readiness export integrity checks that prove every maintained root subpath resolves to a real repository module before a release can be considered ready.

### Changed

- The Design Editor path remains explicit-user-Apply only; scenario/evidence generation and identity authority stay outside the browser mutation layer.
- Fresh-clone documentation now uses locked installs consistently and describes the root backend dependency boundary accurately.
- Automated Python lock refreshes now report repository PR-creation restrictions without turning a successfully verified lock refresh into a failed maintenance run.

### Verification

- Release readiness now requires the security policy, contribution guide, review ownership, and pull-request validation template alongside application quality gates.
- Gated releases now attach root and Design Editor CycloneDX SBOMs, a Python dependency snapshot, exact commit evidence, and SHA-256 checksums.
- Release evidence now includes a machine-readable manifest binding the requested tag, package version, and exact commit SHA.
- Manual release evidence is checksum-verified and retained as a workflow artifact before GitHub publication so failed publication does not discard the verified bundle.
- Root-level `npm run verify:release` now checks the coherent maintained release surface before any real semantic tag is cut, without claiming a hosted release.
- Root runtime/backend, Python verifier, Design Editor workspace, Docker verifier, and CodeQL remain separate blocking quality/security lanes.
- Published as a verified hosted release with the gated release workflow and attached evidence bundle.

## 1.0.0 — 2026-09-02

### Added

- Typed `archive_verifier` package with separate configuration, models, scanning, service, logging, and CLI layers.
- Structured JSON verification logging and typed `ArchiveVerificationError` failures.
- Pytest fixture-driven coverage for successful reconstruction, duplicate accounting, malformed payloads, SHA mismatches, manifest failures, identity leakage, credential leakage, configuration validation, and CLI exit behavior.
- Python project metadata, strict Ruff and mypy configuration, coverage enforcement, and pinned development dependencies.
- Multi-job CI for tests, coverage, lint, type checking, dependency audit, and authenticated archive verification.
- Dockerfile and Makefile for reproducible fresh-clone validation.

### Changed

- `scripts/verify_legacy_archive.py` is now a backward-compatible thin entrypoint rather than a monolithic verifier.
- README now accurately distinguishes authenticated historical application artifacts from the maintained executable verifier.

### Integrity policy

Historical source artifacts are not rewritten or deduplicated merely to improve repository-quality heuristics. Missing application source is not reconstructed and presented as original code. Repository history is allowed to develop through legitimate future work rather than fabricated dates, contributors, tags, or releases.
