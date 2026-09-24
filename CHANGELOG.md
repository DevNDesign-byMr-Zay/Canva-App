# Changelog

All notable maintained-surface changes to this repository are documented here.

## Unreleased — pre-rescore detector hardening

### Added

- A conventional root `ci.yml` exposing root Node tests, Python tests/lint/typecheck, and Design Editor typecheck/test/build.
- Explicit Python verification-tool metadata plus exact lock-parity verification.
- A coverage-scope boundary that keeps CI-only parity tooling outside application coverage while still running it as a mandatory gate.

### Changed

- Current root application candidate: `1.1.2`. The `v1.1.1` release is the latest hosted milestone; this candidate is not published until the gated manual release workflow publishes it.

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
