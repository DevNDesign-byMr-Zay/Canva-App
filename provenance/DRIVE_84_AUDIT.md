# Drive 84-file audit

## Status

**FAIL — historical payload not yet committed**

Audit performed against the authenticated Google Drive `dump 1` Depthpop HTML source set.

## Expected Drive corpus

- Physical Drive source occurrences: **84**
- Unique Drive filenames: **82**
- Distinct byte-level code states: **68**
- Duplicate source occurrences: **16**
- Version span: **v24 through v115**
- Source type: HTML single-file application builds
- Source folder ID: `1WmC_Lv9-NHH7FzQHS7nmH8geoJoJz_UL`

The 84-occurrence count includes repeated/copy occurrences. Three Drive objects share the exact filename `roaryv246_v107_depthpop_progressbar_modeldrawer_LLAMA4_MAVERICK_REWIRED.html`; duplicate/copy occurrences must remain represented in provenance even when byte-identical content is deduplicated for storage.

## Repository state at audit

The repository contains the archive policy/README and chat-source chronology, but **no committed `legacy-html` source payload was found** on `main`.

- Expected historical occurrences represented: **84**
- Historical occurrences currently committed: **0**
- Missing historical occurrences: **84**
- Audit result: **FAIL**

## Gate

Per source-of-truth policy, later chat-mined JSX/TypeScript application code must not be treated as the next completed import stage until this 84-occurrence historical payload is represented and verified.

## Required closure

1. Commit deidentified code-bearing copies of the Drive corpus under `legacy-html/` (or a losslessly reconstructable code archive plus occurrence manifest).
2. Preserve all 84 source occurrences in the manifest, including duplicate Drive occurrences.
3. Verify expected 84 / represented 84 / missing 0.
4. Run the identity/credential scan before declaring PASS.
5. Only after PASS, continue importing exact project-chat-generated Canva application source artifacts under `app/`.

No missing application code is to be reconstructed or presented as an original historical artifact.
