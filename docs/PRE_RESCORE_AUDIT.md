# Application scorer-recovery audit — 2026-09-27 UTC

## Baseline and decision

Audited live main: `38bcaed63b93950fea26ba4dc254c2ea09759f92`.
Latest supplied assessment: **48.6**, dated **2026-09-25 15:24 EDT**
(`CanvaApp 2.pdf`). The other supplied PDF is the earlier **55.1** assessment at
15:16 EDT. The external report does not identify its scanned commit, so its
bundle must not be assumed to equal current main merely because the dates align.

**Do not rescore unchanged main as if the proposed fixes were merged.** This
audit separates baseline facts from PR changes. No release is authorized by this
report. Merge the reviewed fixes, require successful checks on that exact main
SHA, and request application/tooling classification for the next assessment.
No numerical score increase is guaranteed.

## Root cause

The report itself acknowledges that it classified an application/tooling project
as infrastructure. Its IaC dimension scored 10/100 for missing Terraform,
Kubernetes, Helm, Pulumi, and Ansible despite explicitly acknowledging those are
not the project's architecture. This is a classification failure, not evidence
that the product needs cloud-provisioning modules.

The empty GitHub description/topics and archive-first README made first-pass
orientation harder. They are plausible contributing signals, not a proven
explanation of the external classifier's implementation. A local
`.repo-class.json` already declares application tooling, but external scanners
need not honor this custom file.

Real engineering gaps also exist: the Design Editor had no measurable coverage
gate, root JavaScript had no lint gate, the fresh verification command omitted
root audit/release/lock-parity checks, and the changelog's latest-release statement
was stale. These are addressed by concrete tests, executable gates, and accurate
documentation rather than fake infrastructure or activity.

## Every assessment criticism compared with baseline main

| Assessment dimension / criticism | Status on audited main | Evidence and disposition |
| --- | --- | --- |
| IaC quality 10: no Terraform/K8s/Helm/Pulumi/Ansible | MISCLASSIFIED | React/TS editor, Node backend/adapters, and Python verification are actual products. No IaC added. |
| Add modules, remote state, terraform CI, plans, tfsec/checkov | NO LONGER APPLICABLE | All four implementation suggestions depend on an intended infrastructure product that does not exist. |
| Docs/onboarding 58: missing IaC onboarding | MISCLASSIFIED | README, CONTRIBUTING, architecture, package scripts, and Compose document the actual application. PR clarifies entrypoints first. |
| No devcontainer / multi-step environment setup | STILL VALID | No devcontainer is supplied. `make verify-fresh` and containers are supported; adding an editor-specific devcontainer remains optional, not proof of correctness. |
| Architecture 60: health endpoint reported absent | MISCLASSIFIED | `GET /health` exists in `backend/review-context-service.mjs`; tests verify status, uptime, and root package version. Baseline container CI probes it. |
| Backend should be testable without live Canva accounts | PARTIAL | Existing tests inject token-verifier and upstream seams and use loopback HTTP; no account is needed. A full egress-blocking harness is not present. New editor tests also use host/SDK seams, not live accounts. |
| Add a separately named integration test and upstream fixture server | PARTIAL | Real HTTP backend tests already exist in `tests/js/review-context-service.test.mjs`; the exact suggested filenames are not requirements. Existing fetch injection tests prove raw JWTs are not forwarded. A full live upstream/SDK deployment test remains absent. |
| Structured logger not recognized; add Pino/Winston | MISCLASSIFIED | `backend/logging.mjs` emits bounded JSON; Python uses standard logging. Existing `backend-logging.test.mjs` asserts structured output. A vendor library is not necessary to make those logs structured. |
| Add optional Sentry/OpenTelemetry error sink | PARTIAL | `backend/error-reporting.mjs` exposes an isolated `onError` seam; a concrete deployment exporter is not bundled. Deployment-specific monitoring remains a real operational follow-up. |
| Add JSON logging smoke tests | RESOLVED | Tests already verify log structure and sanitization on current main. |
| Security 60: input-validation patterns reported empty | MISCLASSIFIED | The same report acknowledges `requireText`/`requireHttpUrl`; backend also checks origin, body limits, trusted design/page identity, and upstream response shape. Existing negative tests exercise these. |
| CI/CD 70: conventional jobs and security scanning | RESOLVED | `.github/workflows/ci.yml` already exposes Node, Python, editor; separate CodeQL runs both languages. This dimension already recognizes those signals. |
| Dependency health 55: Python lockfile absent from bundle | MISCLASSIFIED | Root `requirements.lock.txt` is committed, pins 38 distributions, and CI installs it. The bundle/scanner missed it. |
| Generate a Python lock, install it, check graph, add parity script | RESOLVED | Those mechanisms exist: `requirements.lock.txt`, `pip check`, `scripts/verify_python_lock.py`, and engineering CI. PR additionally includes parity in `make check`. |
| Dependabot present but freshness incomplete | PARTIAL | Baseline updates pip and Actions but omits both npm packages. PR adds weekly npm monitoring. Available SDK patches/major upgrades still require compatibility review. |
| History/maintenance 45: 11-day concentrated history | STILL VALID | The report's snapshot cannot demonstrate sustained maintenance. No artificial commits, users, releases, or adoption claims are created to compensate. |
| Code cleanliness 55: root JS lint not run | STILL VALID | Baseline performs syntax and tests but no static lint. PR adds ESLint recommended rules and CI/local lint entrypoints, fixing two harmless lint findings. |

## Additional requested audit findings

| Area | Baseline finding | Proposed correction or remaining limitation |
| --- | --- | --- |
| Repository About | Description null, topics empty, homepage null | Recommended exact values below; About metadata cannot be changed by the available connector operations. No public deployment URL is invented. |
| Root hierarchy / src / app / tests | Real source already exists; no relocation needed | README now links actual editor entrypoints, backend, runtime, Python CLI, tests, and historical materialized app in its opening section. |
| Package metadata | Root private Node 1.1.2; Python verifier 1.0.0; private editor 0.1.0 | Preserve all version numbers; add repository/documentation metadata and explain independent surfaces. |
| Design Editor coverage | `vitest run`, 99 tests, no configured coverage provider or threshold | Add all-source V8 coverage, 31 UI/SDK/entrypoint tests, LCOV/JSON artifacts, and 90/80/90/85 line/branch/function/statement thresholds. No production files excluded. |
| Full editor baseline measurement | 72.45% lines, 68.11% branches, 81.04% functions, 68.32% statements | Domain-only tests hid untested UI, entrypoints, and SDK transaction orchestration. New tests exercise those boundaries. |
| Fresh clone / zero cache | Locked installs exist, but default caches and incomplete combined gates | CI clones into a new directory, uses a fresh venv and empty npm cache, disables pip caching, and retains commit-bound logs; `make verify-fresh` includes missing gates. |
| Containers | Baseline image uses Bookworm Python 3.11 despite declared Python >=3.12 | Move to Node 22 Trixie with an explicit Python >=3.12 assertion; no-cache build and verifier/backend health test in CI. Image is not an editor deployment. |
| Release workflow | Manual main-only tag guard exists; exact-main CodeQL success was documentary rather than enforced | Require latest successful push CI/engineering/CodeQL runs on exact main before fresh verification and publication; execute container verification rather than just building. |
| Stale versions | Changelog says latest release is v1.1.1 | GitHub confirms v1.1.2 published 2026-09-25 at the audited SHA. Correct release history; keep new work unreleased. |
| Public health/version | Backend health version derives from root package | Local and CI health probes are evidence of implementation, not production uptime. No configured public URL exists to independently probe. |
| Authenticated provenance | Reconstruction and committed HTML hashes pass | No archive bytes, manifests, authenticated materialized source, or provenance authority changed. |
| Historical app completeness | Runtime-contract output reports two missing local icon/logo assets and external CDN references | Preserve authenticated bytes; historical materialization is not a complete offline production deployment. Do not fabricate recovery evidence or replace its identity. |
| Repository governance | Main reports unprotected; repository rulesets list is empty | Consider required CI and CodeQL checks before merge. The PR/release workflows do not prevent an administrator from bypassing merge discipline. |

## Execution evidence

Fresh local baseline: Node **24.19.0**, Python **3.12.14**, root/editor installs
with separate empty npm caches, Python locked install with `--no-cache-dir` in a
new virtual environment. No live Canva account or upstream deployment was used.

| Check | Baseline / revised local evidence |
| --- | --- |
| Root release contract, syntax, lint, tests | Revised checks pass; **172 tests**; **91.12% lines, 80.06% branches, 95.81% functions**. Existing 90/80/90 gates retained. |
| Design Editor tests | **130 tests in 21 files**; **92.42% lines, 81.94% branches, 98.03% functions, 85.68% statements** with all TS/TSX source included. |
| Design Editor typecheck / formatting | Pass; tests type-check under the same TypeScript configuration. |
| Design Editor build | Pass using supported `CANVA_CLI_DISABLE_TELEMETRY=true`; generated app bundle ~1.22 MB, 23 extracted messages. |
| Python | **63 tests**, **92% combined statement/branch coverage**, Ruff pass, strict mypy pass on 15 files, five declared tool requirements match 38 locked distributions. |
| Dependency audits | Root full audit and editor production audit: zero vulnerabilities. Python: no known vulnerabilities. Editor full graph retains exactly four reviewed moderate records in the existing Canva development-tool chain; not a clean full-graph audit. |
| Provenance | 45 payload parts, 84 occurrences, 68 distinct states, zero missing archive members/hash mismatches/identity or credential hits. Materialization produces no diff. |
| Root package version / health | Health defaults to root 1.1.2 and is covered by real loopback HTTP tests; independent Python/editor versions preserved. |

The first revised CI run found an npm 10 / npm 11 lockfile compatibility gap
(missing nested `@noble/hashes` entries). The lock was repaired with npm
10.9.8 and a clean npm 10 install passed; a passing local npm 11 install alone is
not accepted as proof. The repaired quality-gate candidate passed conventional CI, full engineering CI, Node 24 editor verification, and both CodeQL languages. PR checks, not this prose, determine candidate readiness.

Baseline exact-main hosted evidence:

- [Conventional CI](https://github.com/DevNDesign-byMr-Zay/Canva-App/actions/runs/36170846492): successful.
- [Engineering CI, including containers and provenance](https://github.com/DevNDesign-byMr-Zay/Canva-App/actions/runs/36170846415): successful.
- [Both-language CodeQL](https://github.com/DevNDesign-byMr-Zay/Canva-App/actions/runs/36170846274): successful.
- [v1.1.2 release execution](https://github.com/DevNDesign-byMr-Zay/Canva-App/actions/runs/36172831351): successful.

Candidate changes are reviewed in [PR #189](https://github.com/DevNDesign-byMr-Zay/Canva-App/pull/189).
Quality-gate candidate `6afded4d024932f8231a009cc6da731f210aaaed` passed:

- [Conventional CI including zero-cache verification](https://github.com/DevNDesign-byMr-Zay/Canva-App/actions/runs/36288264507).
- [Engineering CI and no-cache containers](https://github.com/DevNDesign-byMr-Zay/Canva-App/actions/runs/36288264515).
- [Node 24 editor](https://github.com/DevNDesign-byMr-Zay/Canva-App/actions/runs/36288264601).
- [Both-language CodeQL](https://github.com/DevNDesign-byMr-Zay/Canva-App/actions/runs/36288264475).

The cold-clone PR job tested merge candidate
`369802a8d8edccef046e837995df2753c6bb58f9`, using Node **22.23.2** and Python
**3.12.14**. Root coverage on Node 22 was **96.07% lines / 86.82% branches /
93.65% functions**; the local Node 24 figures above differ with runtime
instrumentation. Both pass the unchanged floors. A controlled negative editor
run with a 100% line requirement failed as expected, proving the configured
coverage gate is executable rather than a documentation-only claim.

A successful candidate run does not certify a later merge commit; exact-main
checks must run after merge. Successful CodeQL analysis is not a claim that no
security alert or vulnerability can exist.

## Recommended GitHub About metadata

Description:

> React/TypeScript Canva Design Editor app, Node.js trusted review backend and runtime adapters, with Python authenticated archive reconstruction and provenance verification.

Topics: `canva-app`, `react`, `typescript`, `nodejs`, `python`, `design-editor`,
`developer-tools`, `provenance`, `application-security`.

These describe real maintained code. Do not use IaC topics or invent a production
homepage. The connected repository tools expose metadata reads and PR/file writes,
but no repository-description/topics update operation; applying these values
requires an authorized browser fallback or repository Settings/About access.

## Remaining legitimate limitations and pre-rescore checklist

1. Merge only after both focused PRs pass all required checks; rerun/review exact
   resulting main CI, zero-cache verification, container health, and CodeQL.
2. Apply the real repository description/topics and request correction of the
   external classification. Rewording cannot guarantee the scorer will comply.
3. Retain the reviewed development advisory exception until upstream supplies a
   compatible fix; root/production/Python audits remain independently blocking.
4. Root branch coverage is only 0.06 points above its current floor. Do not lower
   the floor. Editor per-file branch gaps remain despite its aggregate gate.
5. Live Canva-host acceptance, a deployed upstream service, full backend egress
   isolation, production monitoring/export, adoption, and sustained maintenance
   are not established by mocked tests or CI. No such claims are made.
6. The Python pins are exact but not hash-locked; GitHub Actions use version tags
   rather than immutable commit SHAs. Those are further supply-chain hardening
   opportunities, not reasons to fabricate unrelated infrastructure.
7. A devcontainer is optional and absent; historical HTML's missing assets/CDN
   dependencies remain explicitly separate from the maintained editor.

**Baseline rescore status: NOT READY to claim recovery.** The original SHA lacks
the fixes above. After integration, evaluate the resulting main SHA against all
required CI, zero-cache, container, and CodeQL checks. GitHub About metadata and
external classification correction remain separate follow-ups. No new release
was published by this audit.
