# Architecture

## Purpose

`Canva-App` now contains two primary standalone Canva products plus supporting compatibility, provenance and verification layers:

1. **HoloForge** — `apps/holoforge-canva/`, a standalone React/TypeScript Canva Design Editor app with real React Three Fiber / Three.js spatial authoring and an authenticated Blender/FFmpeg render backend.
2. **DepthPop** — `apps/depthpop-canva/`, a standalone React/TypeScript Canva Design Editor app with real WebGL object-scene editing and an authenticated FastAPI processing/export backend.
3. **Trusted compatibility application** — `canva-app/` plus `backend/`, retained for the older reviewed Design Editor integration and release-history continuity.
4. **Historical provenance** — the authenticated, deidentified 84-occurrence HTML lineage and recovery metadata, including the exact v115 final-fix application materialized at `app/authenticated-v115/index.html`.
5. **Verification/materialization tooling** — typed Python code that reconstructs the archive, validates provenance and safety rules, and proves that authenticated application bytes match their committed source.
6. **Maintained runtime/presentation adapters** — renderer-neutral JavaScript contracts under `runtime/` and `src/` that support verified integration and historical continuity.

Docker, Compose and GitHub Actions reproduce and verify these application runtimes. They do not make the repository infrastructure-as-code.

No missing historical source is fabricated. Current standalone product code is maintained directly under the two `apps/*-canva/` roots, while historical material remains provenance.

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
 occurrence 44 + source-name hash
        + sanitized SHA
                |
                v
archive_verifier.materializer
                |
                v
app/authenticated-v115/index.html
                |
     git diff determinism gate
```

The materialized v115 source member is `aetherv246_v115_depthpop_modeldrawer_FINALFIX.html`. Its authenticated source-filename SHA-256 is `fcdebfd5ddfa4cef626062e1429d414009ec334bf41e2889817fbf6d5055f810`, and its required sanitized SHA-256 is `d60ef499cf42c68e06c06cc8906831874aa351ac7d3f9c08cfa5aa4d0ca7e7d1`.

The materializer validates the manifest mapping before archive extraction. Occurrence `44` must exist exactly once and its `source_filename_sha256`, `repository_filename`, and `sanitized_sha256` values must all match the authenticated v115 constants. This keeps the documented provenance edge and the executable materialization path aligned.

## Maintained layer map

```text
apps/holoforge-canva/                apps/depthpop-canva/
        |                                     |
        v                                     v
 React/R3F/Three authoring            React/R3F/Three editing
        |                                     |
        v                                     v
 authenticated render backend         authenticated processing backend
 Blender + FFmpeg                     FAL adapters + FFmpeg + persistence
        |                                     |
        +----------------+--------------------+
                         |
                         v
              standalone Canva handoffs

canva-app/ + backend/          runtime/ + src/
        |                            |
        v                            v
 trusted compatibility path     maintained adapters
        \                            /
         +------------+-------------+
                      |
                      v
             verification / evidence

archive_verifier/ + scripts/
        |
        v
 authenticated provenance + deterministic materialization
```

### Verification boundary

`archive_verifier.service` discovers payload parts, reconstructs and hashes the archive, validates manifest structure/counts/hashes, reconciles HTML members, runs identity/credential scans, calculates distinct/duplicate states, and returns a typed immutable report.

### Materialization boundary

`archive_verifier.materializer` has one narrow responsibility: validate the full occurrence-44 manifest identity, locate exactly one authenticated v115 member, verify its SHA-256 against the manifest-backed constant, and write those exact bytes to the physical `app/` surface. It does not transform, reformat, minify, or reinterpret the application source.

The thin `scripts/materialize_v115.py` entrypoint delegates to the typed package so static analysis, tests, and mypy cover the real implementation rather than a procedural script.

### Holographic presentation boundary

`src/holographic-scene-adapter.mjs` is downstream of validated scene/result evidence. It requires the versioned scene contract, explicit identity and provenance references, and a supported presentation target. Its payload fingerprint is calculated over the canonical payload and revalidated at the boundary so content tampering cannot silently pass as the original presentation payload.

The adapter explicitly marks its output as non-authoritative and non-actuating. Presentation concerns such as browser controls, renderer-neutral interaction state, CSS3D mounting, reduced-motion behavior, and display-profile execution planning belong downstream of this boundary. They must not become a second source of camera authority, mutate authenticated historical bytes, persist transient viewport state into chat history, or introduce physical-display actuation without an explicit safety-boundary change.

### Configuration and scanner boundaries

`VerificationConfig` owns filesystem locations, authenticated archive expectations, identity rules, and credential-pattern rules. `archive_verifier.scanner` remains isolated from archive traversal and returns typed scan results for independently testable privacy/security behavior.

### Error model

Expected integrity/materialization failures raise `ArchiveVerificationError`; invalid configuration raises `ValueError`. Filesystem, CSV, tar, and Base64 implementation errors are translated at their boundaries. Domain code does not use process termination for control flow.

## Data integrity invariants

Production verification asserts the archive properties documented in the README: payload-part count, Base64 size, reconstructed byte count and SHA, occurrence count, source-name uniqueness, state/duplicate accounting, per-file sanitized hashes, and zero banned identity/credential hits.

Application materialization adds three further invariants:

- manifest occurrence `44` must exist exactly once and map to the authenticated v115 source-name hash, repository filename, and sanitized SHA;
- the target v115 member must occur exactly once in the authenticated archive;
- the physical `app/authenticated-v115/index.html` must reproduce the authenticated v115 SHA exactly.

The holographic presentation boundary adds its own invariants:

- scene version and target must be supported before projection;
- snapshot, scene identity, and provenance references must be non-empty;
- payload fingerprints must match the canonical payload contents;
- safety flags must remain explicitly non-authoritative and non-actuating.

CI reruns the materializer and requires `git diff --exit-code -- app/authenticated-v115`, proving the committed application and generated provenance metadata have not drifted from their authenticated archive source.

## Test strategy

Generated miniature archives cover verifier failure paths cheaply and deterministically. Dedicated materializer tests cover source-name, filename, and sanitized-SHA mapping drift and additionally exercise the real committed archive to prove exact v115 extraction and SHA matching. Entrypoint tests pin process exit behavior.

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

The maintained JavaScript surface uses Node's built-in test runner. Holographic adapter tests cover deterministic projection, target rejection, identity/provenance validation, payload preservation, safety flags, fingerprint shape, and fingerprint/content integrity.

## Historical-source policy

Historical files and provenance records are not bulk reformatted, deduplicated, or rewritten for style metrics. A historical state becomes a physical maintained/inspectable application surface only through explicit SHA-verified materialization. The original archived bytes remain the source of truth.
