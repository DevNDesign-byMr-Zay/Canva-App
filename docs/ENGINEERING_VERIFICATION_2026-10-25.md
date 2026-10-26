# Canva-App engineering verification — October 25, 2026

## Scope and provenance

Starting main: `9aef85f5fb62d135a141f6399358208e11b7a3bd`.
Combined locally verified changeset: `36896fbc661a0f420479b073c3982f889f8f30d6`.
This combines the independently authored changes without merging a PR into main.
No production release or paid provider smoke was invoked. No reassessment was
performed, so the supplied DataFactor score remains the only reported score.

The supplied assessment was 69/100. PRs #266, #267 and #268 were already merged
before this assignment: standalone dependency locks, a modular DepthPop frontend,
real Chrome preview smoke, independent backend audits and a patched pytest floor.
Those are baseline improvements, not work newly claimed here.

## Pull requests and implementation commits

| PR | Scope | Core GitHub changesets |
|---|---|---|
| [269](https://github.com/DevNDesign-byMr-Zay/Canva-App/pull/269) | Bootstrap, maintenance, dependency repairs, package hygiene | `68c46a1174f9ffd33b4972c36f6fa4b1931e8168`, `d08b57db7778a7c54ef43efec7aa5770417ea033` |
| [270](https://github.com/DevNDesign-byMr-Zay/Canva-App/pull/270) | Blender/export/verifier modularization and regressions | `90ca058274968cbe6d655562bcb4bcfbac2d01cd`, `b1d1bd6ebf4032db224f0a912c8895a6daece470` |
| [271](https://github.com/DevNDesign-byMr-Zay/Canva-App/pull/271) | Isolated provider tests and safe operational diagnostics | `7acaf7a19971f142ee6d5509ba14e4bfded94fb1` |

All PRs target main and remain subject to owner approval. Feature branches inherit
PR 269's shared CI/security foundation so their checks run against repaired
baseline dependencies. Review and merge order is 269, 270, 271. The authoritative
ending GitHub SHAs and current workflow statuses are shown on each PR; subsequent
verification/report commits do not rewrite these implementation commits.

## Implemented improvements

- Complete cross-platform bootstrap runner creates separate root, HoloForge and
  DepthPop virtual environments; uses committed locks; verifies root/editor,
  standalone frontends/backends, browser previews, independent package integrity
  and ZIP assembly. Uncached fresh-clone CI includes both products. PowerShell
  setup is documented. Windows-only uvloop exclusion is expressed in the locks.
- Backend packaging now filters bytecode, caches, local credentials, runtime data
  and symlinks. A real fresh-clone run reproduced the old cache-copy failure after
  pytest; packaging now succeeds after compilation/tests without removing caches.
- All four npm and three Python graphs have scheduled maintenance coverage.
  Root Python security auditing now checks vulnerabilities, not just consistency.
- Audit-driven patches update certifi to 2026.10.19, root filelock to 4.2.1 and both
  backends to Pillow 13.0.0 after reviewing removals and running image/render tests.
  Frontend development graphs have targeted fixes including UUID, body-parser,
  fast-uri, redirect/editor/proxy/shell/source-map and Vitest dependencies.
- Blender worker reduced from 883 to 492 lines; materials, image/silhouette
  geometry and object animation have explicit module/context boundaries.
- DepthPop export facade reduced from 774 to 219 lines; authored animation,
  assets, glTF/GLB serialization and limits are cohesive internal modules.
- Standalone verifier reduced from 798 to a 15-line CLI delegating to focused
  modules, with damaged-runtime tests and preserved product/packaging guards.
- Fixed an existing unsupported geometry keyword and a missing extracted color
  import found during verification. Added backend-wide undefined-name CI lint.
- Routine backend pytest removes inherited FAL keys and blocks DNS, Internet
  sockets (including connect_ex) and unmocked FAL calls/uploads. Existing provider
  contract tests run with deterministic boundaries. Manual live smoke remains
  explicitly authorized and uses the committed dependency lock.
- Both backends emit allowlisted JSON diagnostics with request/job correlation,
  operational stage, exception class/category and bounded frame metadata.
  Exception messages, headers, bodies, raw URLs, user identity and locals are
  omitted. Safe generic job/API errors replace raw exception strings.
- Request IDs cover CORS preflight, are browser-readable and propagate into
  background jobs. A complete background boundary consumes secondary persistence
  or cleanup exceptions instead of leaking raw asyncio exception chains.

## Verification evidence

| Check | Executed outcome |
|---|---|
| Root Node baseline | 191 tests pass; coverage below existing gates on Node 24: 87.89% lines / 79.92% branches |
| Combined root Node | 223 passed; 90.94% lines / 80.12% branches / 94.67% functions; original 90/80/90 gates retained |
| Root Python | 63 passed; combined branch coverage 92%; original 90% gate retained |
| Root Python lint/types | Ruff and strict mypy pass |
| Backend undefined names | Ruff F821 passes across both complete backend trees; extracted modules also checked with Ruff E/F |
| HoloForge backend combined | 57 passed |
| DepthPop backend combined | 142 passed; 2 explicitly gated smoke tests skipped |
| HoloForge frontend | Typecheck passes; 89 tests pass after patched lock installation |
| DepthPop frontend | Typecheck passes; 81 tests pass after patched lock installation |
| Compatibility editor | Formatting/typecheck pass; 146 tests pass; coverage 88.11% lines / 80.24% branches / 83.33% functions / 81.87% statements |
| Python graphs | All three pip checks pass; pip-audit reports no known vulnerabilities in all three patched locks |
| npm production graphs | Root and standalone production audits pass; compatibility production audit passes in GitHub CI |
| npm development graphs | All three frontend graphs pass the narrowed reviewed vendor boundary; remaining advisory described below |
| Export compatibility | GLB/glTF byte hashes match pre-refactor main for authored fixture; existing format, ownership and persistence suites pass |
| Local package/ZIP checks | Both independent packages pass identity and handoff integrity; separate ZIPs pass CRC and required-entry checks |
| Release/deployment | Release-readiness, maintained JS syntax and deterministic deployment fixture pass |
| Authenticated archive | 84 occurrences, 68 distinct states, zero manifest mismatches and zero credential/identity hits; SHA256 `7d22f60d202201c282c19925d397f274d90bd0796da00fd6ebca5f72dd074ae5` preserved |
| Foundation hosted CI | All six workflows succeed at d08b57d, including clean clone, Compose, production app builds, independent packages, Chrome previews, CodeQL and HoloForge render image |
| Refactored Blender hosted CI | Real GLB/USDZ/PNG/alpha WebM/quilt render-image workflow succeeds at b1d1bd6 |

Representative hosted runs: [foundation CI](https://github.com/DevNDesign-byMr-Zay/Canva-App/actions/runs/40256376542),
[foundation CodeQL](https://github.com/DevNDesign-byMr-Zay/Canva-App/actions/runs/40256376478),
[independent apps](https://github.com/DevNDesign-byMr-Zay/Canva-App/actions/runs/40256376459),
[refactored Blender render](https://github.com/DevNDesign-byMr-Zay/Canva-App/actions/runs/40256643072).

## Independent review and decisions

Two independent review passes covered backend safety and the integrated
bootstrap/refactor/package/audit changes. Important findings were corrected with
regression checks: CORS ordering/exposure, socket connect_ex, unobserved secondary
background failures, native Windows path suffix assertions and Blender color
helper binding. No unresolved Critical/Important findings remain in their scopes.

Decisions: keep independent diagnostic modules in each backend so handoffs do not
need a shared runtime; preserve public export facades; use separate feature PRs
with a shared verified security/CI foundation; keep existing coverage thresholds.
The bootstrap command handles installation/tests/builds/packages; dependency
security audits are separate blocking CI jobs and explicit local audit commands.

## Remaining limitations and maintenance

- The vendor's existing unfixable high-severity node-forge advisory
  GHSA-86w9-cpqp-85rv remains in development tooling, with app-scripts as its
  meta-vulnerability. The exception was narrowed from thirteen package names to
  this exact advisory, unchanged severity, no available fix and dev-only lock
  nodes. Production audits remain separately blocking. Remove the exception when
  the vendor publishes a fix; do not add new identities to it.
- Native Windows execution was not available. Linux command-plan tests exercise
  Windows command selection and use native path separators; this is not a Windows
  runtime certification. A real PowerShell/Windows runner remains useful follow-up.
- Paid live FAL processing and real Canva-authenticated interactions were not
  invoked. Provider mocks prove contracts and isolation, not real inference.
- Two local DepthPop smoke tests remain skipped by explicit configuration. Hosted
  browser/render/container checks provide their own evidence; no skipped test is
  counted as passed.
- The container here has no Docker or local Chrome binary. Those checks were
  verified through the existing hosted workflows. A local Canva build operation
  was blocked by automatic approval review over Sentry telemetry; it was not
  retried. Hosted workflow outcomes are reported separately.
- Existing FastAPI TestClient deprecation and Pydantic fixture serialization
  warnings remain. Neither was hidden by weakening gates.
- Several other large application modules remain candidates for future cohesive
  refactoring; this change prioritized the three assessment-named files.

## Assessment-category evidence

| Category | Observable improvement |
|---|---|
| Architecture/robustness | Cohesive modules, explicit worker context, complete safe background boundary |
| Tests | Preserved coverage gates, adversarial request tests, golden exports, provider/network guards and failure-path regression tests |
| Code cleanliness | Smaller worker/export/verifier modules, unused extraction imports removed, undefined-name CI lint |
| Documentation/onboarding | Exact independent install/verify/PowerShell commands, packaging and diagnostics guides |
| Security | Patched audited graphs, credential-safe logs/responses and narrower vendor exception |
| Dependency health | All maintained manifests scheduled; three Python locks and all frontend development graphs checked |
| CI/CD | Complete uncached product verification, browser/package/container/render evidence |
| History/maintenance | Focused real commits and PRs; historical commits, archives and fingerprints retained |

No external score is predicted or guaranteed. Reassessment should use the merged,
verified repository after the owner approves integration.
