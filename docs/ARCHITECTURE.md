# Architecture

## Purpose

`Canva-App` contains two deliberately separate concerns:

1. **Historical provenance** — authenticated, deidentified legacy HTML source occurrences and recovery metadata.
2. **Maintained verification application** — executable Python code that reconstructs the archived payload, validates provenance, enforces deidentification/security rules, and emits a typed verification report.

The maintained application does not pretend that missing historical React/TypeScript source exists. Historical artifacts are inputs to the verifier, not the verifier's implementation.

## Layer map

```text
CLI / module entrypoints
        |
        v
archive_verifier.cli
        |
        v
archive_verifier.service
   |        |        |
   v        v        v
config    models   scanner
   \        |        /
    \       |       /
     structured errors
            |
            v
     JSON logging boundary
```

### Command boundary

`archive_verifier.cli` owns process-facing behavior. It translates a successful `VerificationReport` into a structured success event and converts expected verification/configuration failures into a non-zero exit code. Domain functions do not terminate the process.

### Configuration boundary

`archive_verifier.config.VerificationConfig` contains filesystem locations, authenticated archive expectations, identity rules, and credential-pattern rules. Its `__post_init__` method rejects internally inconsistent configuration before archive work begins.

### Domain/service layer

`archive_verifier.service` performs the verification pipeline:

1. discover the expected payload parts;
2. read and concatenate Base64 payload text;
3. decode the archive;
4. validate byte count and archive SHA-256;
5. parse and validate required manifest columns;
6. validate occurrence and unique-source counts;
7. open the xz/tar archive;
8. reconcile manifest rows with HTML members;
9. validate each sanitized content SHA-256;
10. run identity and credential scans;
11. calculate distinct-state and duplicate-occurrence counts;
12. return a typed immutable report.

### Scanner layer

`archive_verifier.scanner` is intentionally isolated from archive traversal. It accepts text and policy inputs and returns a `ScanResult`; this makes privacy/security rules independently testable.

### Models

`archive_verifier.models` contains immutable dataclasses for scan and verification results. The CLI serializes report data without coupling the service layer to presentation logic.

### Error model

Expected integrity or safety failures raise `ArchiveVerificationError`. Invalid configuration raises `ValueError`. Filesystem/CSV/tar/Base64 implementation errors are translated at the relevant boundary instead of leaking arbitrary internal exceptions to the process interface.

The service layer never uses `print()` or `SystemExit` for domain control flow.

## Data integrity invariants

Production configuration currently asserts the authenticated archive properties documented in the root README, including the payload-part count, reconstructed archive byte count and SHA-256, manifest occurrence count, distinct/duplicate state accounting, sanitized content hashes, and zero identity/credential scan hits.

Tests use generated miniature archives rather than the production payload wherever possible. This keeps failure-path tests deterministic while the dedicated CI archive-verification job validates the full authenticated 84-occurrence archive.

## Quality boundaries

The maintained Python surface is subject to:

- pytest behavioral and failure-path tests;
- branch coverage with a 90% minimum;
- Ruff lint and security-oriented rules;
- strict mypy type checking;
- `pip check` and pip-audit;
- CodeQL Python analysis;
- reproducible dependency resolution through `requirements.lock.txt`;
- containerized verification through the root Dockerfile.

## Historical-source policy

Files under `legacy-html/` and provenance records are not bulk reformatted, deduplicated, or rewritten simply to satisfy maintained-code style metrics. A historical source file becomes part of the maintained executable surface only through an explicit, reviewable promotion with corresponding tests and documentation.
