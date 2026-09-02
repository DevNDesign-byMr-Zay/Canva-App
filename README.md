# Canva Depth Application — Engineering Source Archive

This repository preserves a deidentified historical Canva-oriented depth-editing application archive and now includes a **runnable, typed engineering verification package** for reconstructing, validating, and safety-scanning that archive from a fresh clone.

The repository intentionally distinguishes between **historical source provenance** and **maintained executable code**. No missing application source is fabricated merely to make the archive look more complete.

## What is executable today

The maintained Python application is `archive_verifier/`, a layered archive-integrity service with:

- `config.py` — validated verification configuration and authenticated production expectations.
- `models.py` — typed scan and verification result models.
- `scanner.py` — isolated identity/branding and credential-pattern scanning.
- `service.py` — payload discovery, Base64 decoding, manifest validation, archive reconstruction, hashing, duplicate-state accounting, and safety enforcement.
- `logging_config.py` — structured JSON logging.
- `cli.py` / `__main__.py` — command boundary and exit-code handling.
- `scripts/verify_legacy_archive.py` — backward-compatible thin CLI wrapper.

See `docs/ARCHITECTURE.md` for the layer map, domain boundaries, failure model, quality boundaries, and historical-source policy.

The historical application material remains under `legacy-html/`. The previously documented `app/` React/TypeScript tree is **not currently present as authenticated physical source in this repository**. If exact recoverable application source is added later, it should be introduced incrementally with its own package manifest, lockfile, tests, and CI checks.

## Archive scope and provenance

The authenticated legacy lineage contains **84 physical HTML source occurrences** spanning the recovered Depthpop development history. Provenance metadata records source-name hashes, repository filenames, sanitized content hashes, duplicate-state relationships, and recovery status.

Current production verification asserts:

- 45 Base64 payload parts
- 460,656 Base64 characters
- 345,492 reconstructed archive bytes
- authenticated archive SHA-256 `7d22f60d202201c282c19925d397f274d90bd0796da00fd6ebca5f72dd074ae5`
- 84 manifest occurrences
- 82 unique source-name hashes
- 68 distinct sanitized source states
- 16 duplicate occurrences
- zero missing archive members
- zero sanitized hash mismatches
- zero banned identity/branding hits
- zero credential-pattern hits

Historical duplicates are preserved as provenance rather than silently discarded.

## Fresh-clone setup

Requirements:

- Python 3.12+
- Git
- GNU Make is optional

```bash
git clone https://github.com/DevNDesign-byMr-Zay/Canva-App.git
cd Canva-App
python -m venv .venv
```

Activate the environment, then install the committed locked toolchain:

```bash
python -m pip install -r requirements.lock.txt
```

Or:

```bash
make setup
```

The verifier itself uses only the Python standard library. Development dependencies are pinned for pytest, coverage, Ruff, mypy, and pip-audit.

## Verify the authenticated archive

```bash
python -m archive_verifier
```

The legacy entrypoint remains supported:

```bash
python scripts/verify_legacy_archive.py
```

Successful verification emits a structured JSON log event and exits `0`. Any integrity, manifest, identity, credential, or reconstruction failure emits a structured failure event and exits non-zero.

## Tests and coverage

```bash
make test
```

The pytest suite builds miniature `.tar.xz` + Base64 payload fixtures and covers real behavior and failure paths, including:

- successful reconstruction
- duplicate-state accounting
- missing payload parts
- invalid Base64
- archive SHA mismatch
- manifest SHA mismatch
- missing manifest columns
- missing archive members
- banned identity/branding detection
- credential-pattern detection
- configuration validation
- CLI success and failure exit behavior

Branch coverage is enforced in CI with a repository floor of **90%** for the maintained Python verification package.

## Lint, type-check, and dependency audit

```bash
make lint
make typecheck
make audit
```

The quality toolchain uses:

- Ruff for lint/security-oriented static rules
- mypy in strict mode for the maintained package and CLI wrapper
- `pip check` for installed dependency consistency
- pip-audit for current Python vulnerability advisories

Run everything, including archive verification, with:

```bash
make check
```

## CI/CD

`.github/workflows/verify-legacy.yml` is a Drive-independent engineering pipeline that runs on every push, pull request, weekly schedule, and manual dispatch. It contains independent jobs for:

1. tests + branch coverage
2. Ruff + mypy static analysis
3. dependency graph + vulnerability audit
4. authenticated 84-occurrence archive verification

A separate CodeQL workflow performs Python static security analysis. Dependabot tracks Python and GitHub Actions dependencies.

## Docker

The repository includes a reproducible Python 3.12 container path:

```bash
docker build -t canva-archive-verifier .
docker run --rm canva-archive-verifier
```

The container verifies the authenticated archive, runs the pytest suite, checks the enforced coverage threshold, and exits non-zero on failure.

## Environment and secrets

No runtime environment variables, credentials, API keys, or cloud authentication are required to verify this repository. `.env.example` documents that intentionally empty runtime environment. Credentials must never be committed.

## Deidentification policy

Repository-facing historical copies remove or neutralize personal identifiers, private tokens/credentials, local user paths, and legacy product branding where doing so does not alter engineering behavior. Third-party technology names are retained when technically relevant.

The maintained scanner enforces banned identity literals and common credential signatures while the manifest verifies each sanitized source artifact by SHA-256.

## Development policy

New behavior should land in focused commits with the tests that prove it. Do not bulk-rewrite authenticated historical files for style purposes, do not manufacture missing source, and do not fabricate old commits, contributors, dates, tags, or releases to influence repository-history scoring.

See `docs/ARCHITECTURE.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, and the files under `provenance/` for the development and recovery audit trail.
