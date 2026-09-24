# Repository Scope

## Project type

This repository is **application and developer tooling**, centered on a Canva Design Editor application and the verification/runtime code that supports its authenticated historical lineage.

The machine-readable `.repo-class.json` file declares `application-tooling` as the primary project class, records the maintained product surfaces, and explicitly excludes infrastructure-as-code classification. This hint exists so automated repository analysis does not mistake Docker or CI support files for the product itself.

The maintained product surfaces are:

1. `canva-app/` — the real TypeScript/React Canva Design Editor application, including trusted design identity, scenario review, explicit apply, and post-apply verification.
2. `archive_verifier/` and `scripts/` — typed Python application tooling that reconstructs, verifies, and materializes authenticated source.
3. `runtime/`, `src/`, and `tests/js/` — maintained JavaScript runtime adapters and presentation contracts.
4. `backend/` — the trusted review-context service used by the application integration path.
5. `app/authenticated-v115/` — the deterministic physical application state materialized from authenticated historical bytes.

Historical HTML/archive material is provenance, not the maintained application boundary.

## What this repository is not

The project is not an infrastructure-as-code repository. Docker and GitHub Actions exist to verify fresh-clone reproducibility, tests, security checks, deterministic materialization, and the production Canva application build. They do not define the product as managed infrastructure.

Infrastructure deployment frameworks, cluster manifests, and cloud-resource provisioning are outside the maintained scope unless a future product requirement explicitly introduces them through a reviewed architectural change.

## Verification contract

A fresh clone must be able to prove every maintained surface with:

```bash
make verify-fresh
```

That command performs locked installs and verifies:

- Python lint, strict type checking, coverage, dependency audit, and archive verification;
- root Node runtime tests;
- Design Editor production dependency audit;
- the reviewed upstream development-tool advisory boundary;
- Design Editor TypeScript type checking;
- Design Editor Vitest coverage; and
- a production Design Editor build.

CI keeps these concerns in independent jobs for clearer failure isolation, while `make verify-fresh` gives reviewers and contributors one local command that exercises the complete maintained project.

See `README.md` and `docs/ARCHITECTURE.md` for the detailed layer map and trust boundaries.
