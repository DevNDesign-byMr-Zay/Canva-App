# Clean-Clone Verification Evidence

This document records the exact clean-clone setup and execution path for static analysis scanners and human reviewers.

## Reproducible Clean-Clone Environment Path

To verify this repository from a clean environment without residual cached artifacts:

1. **Clean environment state**:
   ```bash
   rm -rf .venv node_modules canva-app/node_modules
   ```

2. **System Requirements**:
   - Python 3.12+
   - Node.js 22+

3. **Pinned Lockfile Installation & Verification Command**:
   ```bash
   make verify-fresh
   ```

## Executed Step Summary in `make verify-fresh`

1. **Python Dependencies**:
   - Installed strictly from pinned root `requirements.lock.txt`.
   - Dependency graph checked with `python -m pip check`.
   - Security audited with `pip-audit -r requirements.lock.txt`.
   - Python linting via `ruff check archive_verifier scripts tests`.
   - Python strict type checking via `mypy archive_verifier scripts`.
   - Python unit testing & 90%+ coverage gate via `coverage run -m pytest -q`.

2. **Root Node.js Runtime Adapters**:
   - Installed strictly from `package-lock.json` via `npm ci --ignore-scripts`.
   - Audit run via `npm audit --audit-level=moderate`.
   - Syntax and lint checked via `npm run lint`.
   - Test suite & coverage gate via `npm test`.

3. **Canva Design Editor Application (`canva-app/`)**:
   - Installed strictly from `canva-app/package-lock.json` via `npm --prefix canva-app ci --ignore-scripts`.
   - Audit run via `npm --prefix canva-app audit --omit=dev --audit-level=moderate`.
   - Formatting and linting checked via `npm --prefix canva-app run lint`.
   - TypeScript strict type checking via `npm --prefix canva-app run typecheck`.
   - Vitest test suite and >=80% branch coverage gate via `npm --prefix canva-app run test:coverage`.
   - Production Canva app build via `npm --prefix canva-app run build`.

4. **Authenticated Archive Materialization & Verification**:
   - Authenticated legacy archive verified via `python -m archive_verifier`.

## CI Proof

The exact same clean-clone steps are executed non-cached in the GitHub Actions `fresh-clone-smoke` job in `.github/workflows/ci.yml`.

## Complete independent applications (HoloForge and DepthPop)

`npm run verify:fresh` is the cross-platform entrypoint for the entire maintained
repository. It creates separate Python environments under `.venv/` for root tooling
and each backend, installs committed locks, and stops at the first failing command
with its label and working directory. No activation or Make installation is needed.
Node 22/24, Python 3.12, and Chrome/Chromium are required. Network access is needed
for dependency installation, audits and the pinned Canva CLI build tool; routine
backend tests do not require a provider key or paid inference.

```powershell
# From the repository root, in PowerShell (no administrator installation required).
$env:PYTHON = "python"
$env:CHROME_BIN = "C:\Program Files\Google\Chrome\Application\chrome.exe"
npm run verify:fresh
```

```bash
export CHROME_BIN="$(command -v chromium || command -v google-chrome)"
npm run verify:fresh
```

`node scripts/verify-fresh-clone.mjs --standalone` runs both independent frontend
installs, typechecks, tests and production builds, each backend's locked install,
`pip check`, compilation and tests, standalone contract checks, browser preview
regression checks, independent packaging and handoff integrity checks. It also
creates `.artifacts/fresh-clone/holoforge-canva.zip` and `depthpop-canva.zip`.
`make verify-fresh` adds this same standalone path after root/editor checks.

The uncached `fresh-clone-smoke` CI job executes this standalone path as well as
root/editor verification. Container build/health checks remain in `container-smoke`
and `separate-canva-apps.yml`; they require Docker and do not run inside a Windows
HTML preview. Real Blender render checks remain separate from Python unit tests.

If a step fails, use its printed working directory and command from
`scripts/verify-fresh-clone.mjs` to reproduce it. Recreate only the affected `.venv/`
subdirectory when changing Python versions. Do not combine the backend environments
or loosen a lock/coverage gate to work around an installation failure.

## Dependency maintenance

Dependabot covers all four npm manifests and all three Python dependency graphs.
Review updates against the corresponding committed lock, tests and app builds.
Root `dependency-audit` runs both `pip check` (consistency) and `pip-audit`
(vulnerabilities); app backend locks are audited independently. Updating a
`requirements.txt` range alone is insufficient: regenerate its complete Python 3.12
lock in a clean environment and commit both, then run that backend suite and audit.

### Packaging after verification

Backend source packaging excludes Python bytecode, test caches, virtual
environments, populated environment files, symlinks and runtime data. This matters
because tests and compilation create caches even in a clean clone. Source modules,
backend tests, pinned locks and blank environment examples remain in each handoff.
The integrity gate still rejects any excluded material that reaches a package.

### Reviewed vendor development advisory

Production npm audits remain blocking. Development audits now reject every
fixable advisory and every new advisory identity. The sole retained vendor
exception is the previously reviewed, unfixable high-severity node-forge
GHSA-86w9-cpqp-85rv in Canva build tooling (and its app-scripts meta-vulnerability).
It must stay dev-only, have no available fix, and remain high rather than critical.
All three frontend graphs use the patched UUID override; other reported vulnerable
development packages were updated within supported dependency ranges. Do not run
an exposed development server. Remove the exception when the vendor supplies a fix.

The `npm run verify:fresh` runner covers locked installation, testing, builds,
previews and packaging. Dependency vulnerability audits run as separate blocking
CI jobs; local audits can be run explicitly using the documented Make targets.
