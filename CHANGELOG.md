# Changelog

All notable maintained-surface changes to this repository are documented here.

## Unreleased — pre-rescore detector hardening

### Fixed

- Canva UI packaging now places the production `app.js` at the ZIP root instead of hiding it under `app/`, preventing users from mistaking the whole ZIP for Canva's JavaScript upload.
- Added `START-HERE.html` plus a standalone `preview/index.html` UI preview for HoloForge and DepthPop, so the interface can be opened locally without Canva while the real app remains the compiled `app.js`.
- CI now syntax-checks the generated `app.js` and verifies both HTML preview entrypoints before retaining or releasing the package.
- Packaging now fails on empty files, malformed JSON, incomplete bundles, or missing UI assets; every ZIP includes `app.json`, canonical `canva-app.json`, dedicated `HOLOFORGE.html` / `DEPTHPOP.html` entrypoints, and a SHA-256 `PACKAGE_MANIFEST.json` inventory.
- HoloForge and DepthPop now use separate Canva projects while each preserves the real Canva sidebar envelope: 350px maximum desktop width, 16px internal margins, mobile full-width behavior, and no horizontal scrolling.


### Added

- Rebuilt **DepthPop** from the maintained Drive v115 surface: black/purple glass panel, layered-square tool icon, exact title/chip/description, Depth Strength (0.05–0.75), Depth Blur (0–100%), Depth Fidelity (0.05–1.00), and Fast/Balanced/Cinematic quality mapped to 14/22/34 steps. Drive source SHA-256 `657d7e38654c4b72a075e5972c75625857a1e1a04dd493fa710f0abd6aa6c4c6`. Execution remains fail-closed until an authenticated image-effect provider is configured.
- Split HoloForge and DepthPop into independent Canva Design Editor projects with separate manifests, entrypoints, tests, production bundles, HTML previews, and ZIP artifacts.
- Added a two-app packaging pipeline that produces `holoforge-canva-app.zip` and `depthpop-canva-app.zip` independently and rejects cross-product UI/source leakage.

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
