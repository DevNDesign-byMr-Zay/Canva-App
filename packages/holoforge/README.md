# HOLOFORGE package

The package contains the first independent application seam for HOLOFORGE.

- `scenario-contract.mjs` — Scenario Contract v0 creation and validation.
- `sample-scenario.mjs` — deterministic fixture for consumers and previews.
- `branch-model.mjs` — pure Scenario Forking for independent candidate futures.
- `index.mjs` — public package exports.

## Boundary

The package is observational. It does not call Canva APIs, mutate source designs, select providers, or authorize actions.

## Scenario Forking

`forkScenarios()` creates candidate futures from a source scenario without mutating the source. Each fork receives a stable derived identifier and may carry independent intent, constraints, layout, evidence, and status.

The package is deliberately small so the next seam can be built around a spatial graph and measurable optimization objective rather than a large UI or 3D runtime.
