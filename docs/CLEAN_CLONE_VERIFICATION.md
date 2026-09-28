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
