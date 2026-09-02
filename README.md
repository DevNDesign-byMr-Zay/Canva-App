# Canva Depth Application — Engineering Source Archive

Private, curated source archive for the Canva-oriented depth editing application.

## Source-of-truth policy

The ROARYbyMr. Zay project-chat development record is treated as the canonical chronology because the application was designed, generated, patched, and packaged there. Google Drive is used as the recovery store for the physical source artifacts produced during that work.

Nothing in this repository is labeled as an exact historical source file unless the underlying artifact is physically recoverable. Chat-only evidence is preserved as provenance and feature lineage rather than silently recreated and presented as original code.

## Repository map

- `legacy-html/` — deidentified historical single-file application builds recovered from Drive; the authenticated Depthpop-named lineage contains 84 physical HTML source files spanning v24 through v115.
- `app/` — later Canva application source files recoverable from the project-chat lineage (React/JSX frontend, TypeScript backend, setup/config, and local depth-provider components when exact artifacts are available).
- `provenance/` — chat-grounded chronology, artifact inventory, supersession map, and recovery status.
- `scripts/` — reproducibility and verification utilities.

## Deidentification

Repository-facing copies remove or neutralize personal identifiers, private tokens/credentials, local user paths, and legacy product branding where doing so does not alter the engineering behavior. Third-party technology names are retained when technically relevant.

## Integrity

Historical duplicates are preserved by provenance. Byte-identical copies may be stored once with all authenticated source occurrences recorded in the manifest. No code is fabricated to fill a missing historical artifact.
