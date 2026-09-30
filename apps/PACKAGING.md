# Standalone Canva app packages

The `.github/workflows/separate-canva-apps.yml` workflow produces two complete distributable ZIP artifacts after the frontend and backend verification jobs pass:

- `holoforge-canva-app.zip`
- `depthpop-canva-app.zip`

Each archive contains the complete standalone app root, including source, `canva-app.json`, the human-openable `preview/index.html`, and the compiled `dist/app.js`. The DepthPop archive also contains the authenticated FastAPI backend, backend tests and Dockerfile, plus the exact Drive UI/backend provenance files used during reconstruction.

Packaging fails if any included file is zero bytes or if a required runtime/UI/backend file is missing. Every ZIP also contains a generated `PACKAGE_MANIFEST.json` with per-file byte counts and SHA-256 values. The workflow publishes a sibling `SHA256SUMS.txt` for the two final ZIPs and validates both archives with `unzip -t` before upload.

These ZIPs are CI artifacts rather than committed binary blobs, keeping the Git history readable while still making each complete app downloadable from a successful workflow run.
