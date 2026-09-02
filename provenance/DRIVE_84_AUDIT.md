# Drive 84-file audit

## Status

**PASS — 84/84 historical source occurrences represented; missing 0**

Audit basis: authenticated Google Drive `dump 1` Depthpop HTML source set, represented in this private repository as a deidentified, losslessly reconstructable code archive plus occurrence manifest.

## Expected Drive corpus

- Physical Drive source occurrences: **84**
- Unique Drive filenames: **82**
- Distinct byte-level code states: **68**
- Duplicate source occurrences: **16**
- Version span: **v24 through v115**
- Source type: HTML single-file application builds
- Source folder ID: `1WmC_Lv9-NHH7FzQHS7nmH8geoJoJz_UL`

The 84-occurrence count preserves repeated/copy occurrences in provenance. Byte-identical source states may be storage-deduplicated, but every authenticated source occurrence remains represented in `provenance/DRIVE_84_MANIFEST.csv`.

## Repository representation

- Canonical archive transport: `legacy-html/archive/payload/`
- Reconstruction instructions: `legacy-html/archive/RECONSTRUCT.md`
- Occurrence manifest: `provenance/DRIVE_84_MANIFEST.csv`
- Verification script: `scripts/verify_legacy_archive.py`
- GitHub Actions workflow: `.github/workflows/verify-legacy.yml`

Canonical reconstructed archive facts:

- Base64 characters: **460656**
- Archive bytes: **345492**
- Archive SHA-256: `7d22f60d202201c282c19925d397f274d90bd0796da00fd6ebca5f72dd074ae5`
- HTML occurrences after extraction: **84**
- Manifest occurrences: **84**
- Unique source-name hashes: **82**
- Distinct sanitized states: **68**
- Duplicate occurrences: **16**
- Manifest hash mismatches: **0**
- Missing historical occurrences: **0**

## Verification evidence

GitHub Actions run **33658644649** on commit `2f4a0d8ca84dc5d28fb63ac1c4708105e3280fe2` completed successfully. The verifier reported:

`PASS: legacy archive is reconstructable, deidentified, and represents 84/84 occurrences with missing=0`

The same run verified the expected archive SHA-256, 84 extracted HTML occurrences, 84 manifest occurrences, 82 unique source-name hashes, 68 distinct states, 16 duplicate occurrences, and zero manifest hash mismatches.

## Cleanup / closure

Temporary archive transport directories used during staged upload have been removed from the canonical `legacy-html/archive/` tree. The remaining archive branch contains the canonical payload plus reconstruction instructions.

The historical Drive gate is therefore closed. Per repository source-of-truth policy, later exact project-chat-generated React/JSX and TypeScript Canva application artifacts may now be imported under `app/` when their exact historical file bodies are recoverable. Chat-only evidence remains provenance and must not be reconstructed or presented as original source.
