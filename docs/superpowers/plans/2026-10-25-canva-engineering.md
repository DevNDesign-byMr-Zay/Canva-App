# Canva engineering implementation plan

> Execute inline with Superpowers executing-plans and test-driven-development.

**Goal:** Close verified bootstrap, maintenance, isolation, modularity and diagnostic gaps while preserving both independent applications.
**Baseline:** main 9aef85f5fb62d135a141f6399358208e11b7a3bd; PRs 266–268 already merged.
**Architecture:** Keep independent backend environments and app distributions. Extract cohesive internal modules and preserve import/CLI contracts. Add diagnostics locally to each backend so neither distribution depends on the other.
**Spec:** User-supplied Pasted text(8).txt, batches A–F; no merges or releases.
**Constraints:** Preserve archives, public contracts, UI, authentication and coverage/security thresholds; no paid provider requests.
**Review focus:** Windows subprocess paths; accidental external inference; lost packaged modules; altered animation/glTF outputs; diagnostics leaking payloads or exception messages.

## Task 1 — Reproducible bootstrap and maintenance (A, D, F)
- [ ] Test executable command planning, isolated venv paths and failure propagation.
- [ ] Add cross-platform complete bootstrap runner; wire Makefile and uncached CI; document PowerShell.
- [ ] Extend Dependabot across all maintained npm/pip graphs and root vulnerability audit.
- [ ] Verify root tests, runner tests, actual installation/build/package commands; open focused PR.

## Task 2 — Cohesive modules (B)
- [ ] Add animation/output compatibility regression tests before extraction.
- [ ] Extract DepthPop animation and glTF handling; HoloForge materials, geometry and animation; split standalone verifier by responsibility.
- [ ] Run backend suites and verifier positive/negative-path tests; verify distribution includes modules; open focused PR.

## Task 3 — Provider isolation (C)
- [ ] Reproduce default tests requiring network or provider credentials.
- [ ] Add test-only network/inference guards and deterministic provider fixtures; preserve explicit manual smoke.
- [ ] Run both backend suites without credentials, verify manual workflow lock installation; open focused PR.

## Task 4 — Safe operational diagnostics (E, F)
- [ ] Add request/job failure tests for JSON records, correlation, classification and non-disclosure.
- [ ] Add backend-local diagnostic middleware and safe job logging without altering auth/HTTP contracts.
- [ ] Run backend suites, packaging, final integration checks and independent review; open focused PR.

## Evidence
Record actual outcomes and limitations in PR descriptions and final engineering report. No external score claimed.
