# Repository Scope

## Project type

This repository is **application and developer tooling**, centered on two standalone Canva Design Editor products plus the verification/runtime code that supports their maintained and authenticated lineage.

The machine-readable `.repo-class.json` file declares `application-tooling` as the primary project class, identifies HoloForge and DepthPop as the primary maintained products, and explicitly excludes infrastructure-as-code classification. Docker, Compose and GitHub Actions are packaging, runtime-reproduction and verification assets; they are not the product.

## Primary maintained products

1. `apps/holoforge-canva/` — **HoloForge**, a standalone Canva Design Editor application with real React Three Fiber / Three.js spatial authoring, HoloScene persistence, animation, material/geometry controls and an authenticated Blender/FFmpeg render backend.
2. `apps/depthpop-canva/` — **DepthPop**, a standalone Canva Design Editor application with real WebGL object-scene editing, authenticated FastAPI processing, Florence-2/SAM-3/Depth Anything V2/FAL provider adapters, persistent scene/export storage and production render/export paths.

## Supporting maintained application/tooling surfaces

3. `canva-app/` — the older trusted TypeScript/React Design Editor integration retained for compatibility and release-history continuity. New standalone product development targets the two `apps/*-canva/` roots above.
4. `archive_verifier/` and `scripts/` — typed Python application tooling that reconstructs, verifies and materializes authenticated source.
5. `runtime/`, `src/` and `tests/js/` — maintained JavaScript runtime adapters and presentation contracts.
6. `backend/` — the trusted review-context service used by the maintained integration path.
7. `app/authenticated-v115/` and historical archive/reference trees — authenticated provenance/application history retained for deterministic verification, not the current standalone Canva deliverables.

## What this repository is not

The project is not an infrastructure-as-code repository. It does not provision cloud infrastructure, manage remote state, declare Kubernetes resources, or expose Terraform/Helm/Pulumi/Ansible infrastructure authority.

Dockerfiles and Compose files reproduce application runtimes, persistence mounts and smoke-test environments. GitHub Actions run tests, security analysis, package verification, real renderer smoke tests and release-readiness checks.

## Verification contract

A fresh clone can prove the maintained root surfaces with:

```bash
make verify-fresh
```

Repository CI additionally verifies the two standalone Canva products independently, including:

- HoloForge frontend/backend tests and production Blender/FFmpeg render smoke;
- DepthPop frontend/backend tests, persistence/export behavior and deployment readiness;
- independent handoff-package integrity;
- root Node and Python coverage/security gates;
- CodeQL JavaScript/TypeScript and Python analysis;
- fresh-clone and container verification.

The optional DepthPop paid-provider smoke is manual-only and bounded. It is not part of routine CI and cannot run without explicit one-shot authorization.

See `README.md`, `CANVA_APPS_START_HERE.md`, `docs/PRODUCTION_DEPLOYMENT.md` and `docs/ARCHITECTURE.md` for the detailed product, trust and deployment boundaries.
