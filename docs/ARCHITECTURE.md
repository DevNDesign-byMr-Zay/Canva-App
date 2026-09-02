# Architecture

## Purpose

`Canva-App` now contains three deliberately separated layers:

1. **Historical provenance** — the authenticated, deidentified 84-occurrence HTML lineage and recovery metadata.
2. **Authenticated application surface** — the exact v115 final-fix application materialized at `app/authenticated-v115/index.html` from the committed archive.
3. **Maintained verification/materialization application** — typed Python code that reconstructs the archive, validates provenance and safety rules, and proves that the committed v115 application bytes match the authenticated source.

No missing React/TypeScript tree is fabricated. The physical application surface is produced only from authenticated bytes already present in the repository's archive.

## Trust chain

```text
legacy-html/archive/payload/part-*.b64
                |
                v
       authenticated .tar.xz
                |
       archive SHA-256 check
                |
                v
provenance/DRIVE_84_MANIFEST.csv
                |
   occurrence 44 + sanitized SHA
                |
                v
archive_verifier.materializer
                |
                v
app/authenticated-v115/index.html
                |
     git diff determinism gate
```

The materialized v115 source member is `aetherv246_v115_depthpop_modeldrawer_FINALFIX.html`. Its required sanitized SHA-256 is `d60ef499cf42c68e06c06cc8906831874aa351ac7d3f9c08cfa5aa4d0ca7e7d1`.

## Maintained layer map

```text
CLI/module entrypoints
      |              |
      v              v
 verifier CLI   materializer CLI
      |              |
      v              v
 service       materializer
    |  |  |          |
    v  v  v          v
 config models     archive
       scanner       bytes
          \          /
           typed errors
                |
                v
         JSON logging
```

### Verification boundary

`archive_verifier.service` discovers payload parts, reconstructs and hashes the archive, validates manifest structure/counts/hashes, reconciles HTML members, runs identity/credential scans, calculates distinct/duplicate states, and returns a typed immutable report.

### Materialization boundary

`archive_verifier.materializer` has one narrow responsibility: locate exactly one authenticated v115 member, verify its SHA-256 against the manifest-backed constant, and write those exact bytes to the physical `app/` surface. It does not transform, reformat, minify, or reinterpret the application source.

The thin `scripts/materialize_v115.py` entrypoint delegates to the typed package so static analysis, tests, and mypy cover the real implementation rather than a procedural script.

### Configuration and scanner boundaries

`VerificationConfig` owns filesystem locations, authenticated archive expectations, identity rules, and credential-pattern rules. `archive_verifier.scanner` remains isolated from archive traversal and returns typed scan results for independently testable privacy/security behavior.

### Error model

Expected integrity/materialization failures raise `ArchiveVerificationError`; invalid configuration raises `ValueError`. Filesystem, CSV, tar, and Base64 implementation errors are translated at their boundaries. Domain code does not use process termination for control flow.

## Data integrity invariants

Production verification asserts the archive properties documented in the README: payload-part count, Base64 size, reconstructed byte count and SHA, occurrence count, source-name uniqueness, state/duplicate accounting, per-file sanitized hashes, and zero banned identity/credential hits.

Application materialization adds two further invariants:

- the target v115 member must occur exactly once in the authenticated archive;
- the physical `app/authenticated-v115/index.html` must reproduce the authenticated v115 SHA exactly.

CI reruns the materializer and requires `git diff --exit-code -- app/authenticated-v115`, proving the committed application has not drifted from its authenticated archive source.

## Test strategy

Generated miniature archives cover verifier failure paths cheaply and deterministically. Dedicated production-materializer tests additionally exercise the real committed archive to prove exact v115 extraction and SHA matching. Entrypoint tests pin process exit behavior.

The maintained Python surface is subject to:

- pytest behavioral/failure-path tests;
- branch-aware coverage with a 90% repository minimum;
- Ruff lint and security-oriented rules;
- strict mypy;
- `pip check` and pip-audit;
- CodeQL Python analysis;
- reproducible dependencies via `requirements.lock.txt`;
- Docker fresh-clone verification;
- full archive + application determinism verification.

## Historical-source policy

Historical files and provenance records are not bulk reformatted, deduplicated, or rewritten for style metrics. A historical state becomes a physical maintained/inspectable application surface only through explicit SHA-verified materialization. The original archived bytes remain the source of truth.
