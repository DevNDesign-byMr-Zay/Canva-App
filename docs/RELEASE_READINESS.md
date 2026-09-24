# Release Readiness

This repository treats a release as a verified application milestone, not a tag-only event.

## Required state

Before a semantic release is published from `main`, the exact commit must pass:

- root reproducible install and dependency audit;
- Python verifier install, tests, lint, type checks, dependency audit, and authenticated archive verification;
- Design Editor locked install, dependency audit, TypeScript type check, Vitest suite, and production build;
- trusted backend/review-context tests proving design, page, snapshot, and provenance identity fail closed;
- explicit-user-Apply safety checks with no automatic mutation authority;
- Docker fresh-checkout verification;
- CodeQL for JavaScript/TypeScript and Python;
- `npm run verify:release`.

The manual release workflow then reruns the full fresh verification path and creates a release evidence bundle containing root and Design Editor CycloneDX SBOMs, a Python dependency snapshot, the exact commit SHA, a machine-readable release manifest, and SHA-256 checksums.

## Version discipline

The root `package.json` version is the release version source of truth. The requested release tag must equal `v<package version>`.

Do not backdate or manufacture releases. A new version should correspond to a real application, security, reliability, compatibility, or reproducibility milestone.

## Authority boundary

Release status does not alter application authority. HoloForge remains a reviewer-facing application surface: trusted scenario identity is verified before presentation, and Canva mutation occurs only after the user's explicit Apply action. A release must never introduce silent auto-apply or infer missing trusted design/page identity.

## Publication

The repository's `release/github` workflow is manual-only and must run from `main`. A green release-readiness check means the commit is eligible to publish; it does not itself claim that a hosted release exists.
