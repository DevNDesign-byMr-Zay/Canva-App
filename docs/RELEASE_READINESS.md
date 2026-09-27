# Release Readiness

This repository treats a release as a verified application milestone, not a tag-only event.

## Required state

Before a semantic release is published from `main`, the exact commit must pass:

- root reproducible install and dependency audit;
- Python verifier install, tests, lint, type checks, dependency audit, and authenticated archive verification;
- Design Editor locked install, dependency audit, TypeScript type check, coverage-gated Vitest suite (90% lines, 80% branches, 90% functions, 85% statements), and production build;
- trusted backend/review-context tests proving design, page, snapshot, and provenance identity fail closed;
- explicit-user-Apply safety checks with no automatic mutation authority;
- Docker fresh-checkout verification;
- CodeQL for JavaScript/TypeScript and Python;
- `npm run verify:release`.

The manual release workflow then reruns the full fresh verification path and creates a release evidence bundle containing root and Design Editor CycloneDX SBOMs, a Python dependency snapshot, the exact commit SHA, a machine-readable release manifest, and SHA-256 checksums.

## Version discipline

The root `package.json` version is the GitHub release version source of truth. The Python verifier (`1.0.0`) and private Design Editor package (`0.1.0`) have independent versions; do not synchronize them without a distributable-level reason. The requested release tag must equal `v<package version>`.

Do not backdate or manufacture releases. A new version should correspond to a real application, security, reliability, compatibility, or reproducibility milestone.

## Authority boundary

Release status does not alter application authority. HoloForge remains a reviewer-facing application surface: trusted scenario identity is verified before presentation, and Canva mutation occurs only after the user's explicit Apply action. A release must never introduce silent auto-apply or infer missing trusted design/page identity.

## Publication

The repository's `release/github` workflow is manual-only and must run from `main`. A green release-readiness check means the commit is eligible to publish; it does not itself claim that a hosted release exists.

## Evidence binding

The release workflow checks the latest completed push runs for conventional CI,
engineering CI, and both-language CodeQL on the exact main SHA. Missing, pending,
or unsuccessful evidence blocks publication. It then reruns the fresh verification
and no-cache container path. Conventional CI separately retains zero-cache clone
logs and Design Editor coverage artifacts. These are execution evidence, while
`verify:release` is a static repository-contract check; it cannot replace them.

`GET /health` reports the root package version, service status, and uptime. This is
a local/deployed backend endpoint, not proof of an existing public deployment.
The repository has no configured homepage; no production adoption is claimed.
