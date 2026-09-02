# Historical archive reconstruction

The canonical historical payload is stored in `legacy-html/archive/payload/`.

Concatenate every `part-*.b64` file in lexical order, remove whitespace, and Base64-decode the result to `canva84.tar.xz`:

```bash
cat legacy-html/archive/payload/part-*.b64 | tr -d '\n\r' | base64 -d > /tmp/canva84.tar.xz
sha256sum /tmp/canva84.tar.xz
mkdir -p /tmp/canva84 && tar -xJf /tmp/canva84.tar.xz -C /tmp/canva84
```

Expected Base64 length: `460656` characters.
Expected archive size: `345492` bytes.
Expected archive SHA-256: `7d22f60d202201c282c19925d397f274d90bd0796da00fd6ebca5f72dd074ae5`.
Expected historical HTML occurrences: `84`.

`provenance/DRIVE_84_MANIFEST.csv` records all 84 source occurrences, including duplicate Drive occurrences. `scripts/verify_legacy_archive.py` performs the repository-side integrity, manifest, occurrence-count, deidentification, and credential checks.