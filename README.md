# Canva Depth Archive & Runtime Verification Tooling

This repository preserves a deidentified historical Canva-oriented depth-editing application archive, a **runnable typed verification package**, a **maintained JavaScript runtime-adapter surface**, and a **physically materialized authenticated application build** recovered from that archive.

This is application/developer tooling, **not infrastructure-as-code**. The repository does not contain or claim Terraform, Kubernetes, Helm, Pulumi, cloud-state management, or infrastructure provisioning modules. Its maintained engineering surfaces are the Python archive verifier/materializer and the Node.js runtime adapters/tests described below.

The repository intentionally distinguishes between **historical source provenance**, **maintained verification code**, **maintained runtime adapters**, and **authenticated application source**. No missing React/TypeScript tree or other source is fabricated merely to make the archive look more complete.

## What is executable and inspectable today

The maintained Python package is `archive_verifier/`, with:

- `config.py` — validated verification configuration and authenticated production expectations.
- `models.py` — typed scan and verification result models.
- `scanner.py` — isolated identity/branding and credential-pattern scanning.
- `service.py` — payload discovery, Base64 decoding, manifest validation, archive reconstruction, hashing, duplicate-state accounting, and safety enforcement.
- `materializer.py` — deterministic extraction and SHA verification for the authenticated v115 application state.
- `logging_config.py` — structured JSON logging.
- `cli.py` / `__main__.py` — command boundary and exit-code handling.
- `scripts/verify_legacy_archive.py` and `scripts/materialize_v115.py` — thin compatibility entrypoints.

The maintained JavaScript surface lives under `runtime/` and is exercised by `tests/js/*.test.mjs`. It preserves mechanically authenticated v115 runtime boundaries such as the streaming chat request adapter, UI-to-AI bridge, authenticated DOM binding, message rendering/persistence, assistant finalization, and browser message actions. It is deliberately isolated from the immutable historical HTML so runtime behavior can be tested without rewriting provenance bytes.

The Node.js surface is an ordinary zero-runtime-dependency package:

```bash
npm ci
npm test
```

`package.json` defines the Node 22+ test surface and `package-lock.json` locks it reproducibly. CI installs from that lockfile, runs `npm audit`, and executes the maintained runtime suite through the standard `npm test` entrypoint.

The authenticated application is physically present at:

```text
app/authenticated-v115/index.html
```

It is the exact sanitized bytes of manifest occurrence 44, `aetherv246_v115_depthpop_modeldrawer_FINALFIX.html`, with SHA-256:

```text
d60ef499cf42c68e06c06cc8906831874aa351ac7d3f9c08cfa5aa4d0ca7e7d1
```

The committed application file is approximately 571 KB. `app/authenticated-v115/PROVENANCE.md` records its source identity, and `python scripts/materialize_v115.py` deterministically reconstructs it from the committed authenticated archive.

See `docs/ARCHITECTURE.md` for the layer map, domain boundaries, failure model, quality boundaries, and historical-source policy.

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
- Node.js 22+
- Git
- GNU Make is optional

```bash
git clone https://github.com/DevNDesign-byMr-Zay/Canva-App.git
cd Canva-App
python -m venv .venv
python -m pip install -r requirements.lock.txt
npm ci
```

Or install the Python verifier toolchain with:

```bash
make setup
```

The verifier itself uses only the Python standard library. Development dependencies are pinned for pytest, coverage, Ruff, mypy, and pip-audit. The maintained Node runtime adapters currently have zero third-party runtime or development dependencies; the committed npm lockfile still makes the fresh-clone contract explicit and machine-verifiable.

## Verify and materialize

Verify the full archive:

```bash
python -m archive_verifier
```

Reconstruct the authenticated latest application state:

```bash
python scripts/materialize_v115.py
```

The materializer refuses to accept a source whose SHA does not match the authenticated manifest value.

## Tests and coverage

Run the Python verifier suite:

```bash
make test
```

Run the maintained JavaScript runtime suite:

```bash
npm test
```

The pytest suite covers real behavior and failure paths including:

- successful archive reconstruction
- duplicate-state accounting
- missing payload parts
- invalid Base64
- archive and manifest SHA mismatches
- missing manifest columns and members
- banned identity/branding and credential signatures
- configuration validation
- CLI success/failure behavior
- exact authenticated v115 extraction and SHA verification
- deterministic v115 materialization and provenance generation

Branch coverage is enforced in CI with a repository floor of **90%** for maintained Python code. The Node runtime suite uses Node's built-in test runner and built-in test coverage so it can execute from a fresh clone without an inferred test framework.

## Lint, type-check, and dependency audit

```bash
make lint
make typecheck
make audit
```

The Python quality toolchain uses Ruff, strict mypy, `pip check`, and pip-audit. Run the complete local Python quality path with:

```bash
make check
```

The Node package has no third-party dependencies today; `npm audit` remains part of CI so future dependency additions are automatically included in the audit boundary.

## CI/CD

`.github/workflows/verify-legacy.yml` runs on pushes, pull requests, a weekly schedule, and manual dispatch. Its independent gates cover:

1. Python tests + branch coverage
2. reproducible `npm ci` + `npm audit` + `npm test` for the maintained v115 runtime adapters
3. Ruff + strict mypy
4. Python dependency graph + vulnerability audit
5. authenticated 84-occurrence archive verification and deterministic v115 reconstruction
6. Docker fresh-clone image build + execution

`.github/workflows/materialize-v115.yml` independently reconstructs the authenticated v115 application and commits the deterministic physical application surface when required. A separate CodeQL workflow performs static security analysis. Dependabot tracks Python and GitHub Actions dependencies.

## Docker

```bash
docker build -t canva-archive-verifier .
docker run --rm canva-archive-verifier
```

The container verifies the authenticated archive, runs pytest, enforces coverage, and exits non-zero on failure. CI builds and runs this exact verifier path. The Node runtime has its own independent fresh-clone install/test gate in CI rather than being hidden inside the verifier image.

## Environment and secrets

No runtime credentials, API keys, cloud authentication, or environment variables are required to verify or materialize this repository. `.env.example` documents that intentionally empty verifier environment. Credentials must never be committed.

Runtime adapters that model authenticated historical request boundaries accept credentials/network implementations through explicit injected interfaces; tests do not require or embed production credentials.

## Deidentification policy

Repository-facing historical copies remove or neutralize personal identifiers, private tokens/credentials, local user paths, and legacy product branding where doing so does not alter engineering behavior. Third-party technology names are retained when technically relevant.

The scanner enforces banned identity literals and credential signatures while the manifest verifies sanitized artifacts by SHA-256.

## Development policy

New behavior should land in focused commits with tests that prove it. Do not bulk-rewrite authenticated historical files, manufacture missing source, or fabricate old commits, contributors, dates, tags, releases, or infrastructure artifacts to influence repository-history or classification scoring.

See `docs/ARCHITECTURE.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `app/authenticated-v115/PROVENANCE.md`, and `provenance/` for the engineering and recovery audit trail.
