# Standalone Canva production deployment

This repository ships two independent Canva Design Editor apps:

- **DepthPop**
- **HoloForge**

Repository CI can prove that the code, packages, storage contracts, and deployment configuration are structurally ready. It cannot prove that Canva Developer Portal, external hosting, persistent volumes, or external provider credentials have been configured. Those remain live deployment tasks.

## Deployment readiness commands

From the repository root:

```bash
npm run deployment:check
```

This performs the real local/runtime production probe. It fails non-zero on blocking production configuration or runtime problems.

For deterministic CI only:

```bash
npm run deployment:check:ci
```

The CI fixture does **not** replace the real production check.

## DepthPop production contract

Required production environment:

```text
ENVIRONMENT=production
CANVA_APP_ID=<DepthPop Canva app id>
CANVA_APP_ORIGIN=https://...
PUBLIC_BASE_URL=https://...

FAL_KEY=<secret>

SEGMENTATION_PROVIDER=auto
DEPTH_PROVIDER=auto
INPAINT_PROVIDER=auto
DEPTHPOP_ALLOW_BBOX_FALLBACK=false

DEPTHPOP_REPOSITORY_BACKEND=sqlite
DEPTHPOP_DATABASE_PATH=/data/depthpop/depthpop.sqlite3
DEPTHPOP_ASSET_ROOT=/data/depthpop/assets
DEPTHPOP_ARTIFACT_ROOT=/data/depthpop/artifacts

DEPTHPOP_MAX_EXPORT_CONCURRENCY=2
DEPTHPOP_MAX_EXPORT_PIXELS=16777216
DEPTHPOP_MAX_EXPORT_FRAMES=3600
DEPTHPOP_MAX_EXPORT_DURATION_MS=120000
DEPTHPOP_MAX_EXPORT_ARTIFACT_BYTES=536870912
```

The whole `/data/depthpop` directory must be mounted to persistent storage.

Do not put `FAL_KEY` in the Canva bundle.

The production DepthPop image includes FFmpeg. Run the real readiness check in the deployed container to verify the binary and writable storage.

## HoloForge production contract

Required production environment:

```text
ENVIRONMENT=production
CANVA_APP_ID=<HoloForge Canva app id>
CANVA_APP_ORIGIN=https://...
PUBLIC_BASE_URL=https://...

BLENDER_BIN=/opt/blender/blender
HOLOFORGE_BLENDER_VERSION=4.5.14

HOLOFORGE_REPOSITORY_BACKEND=sqlite
HOLOFORGE_DATABASE_PATH=/data/holoforge/holoforge.sqlite3
HOLOFORGE_ARTIFACT_ROOT=/data/holoforge/artifacts

HOLOFORGE_RENDER_TIMEOUT_SECONDS=600
HOLOFORGE_MAX_CONCURRENCY=2
HOLOFORGE_MAX_JOBS=256
HOLOFORGE_MAX_ARTIFACTS=128
HOLOFORGE_JOB_TTL_SECONDS=3600
HOLOFORGE_ARTIFACT_TTL_SECONDS=86400
```

The whole `/data/holoforge` directory must be mounted to persistent storage.

The maintained production render image pins Blender **4.5.14** and installs FFmpeg. The deployment readiness validator probes both binaries and fails if Blender does not report the pinned version.

## Production Compose reference

`docker-compose.production.yml` is the maintained topology example for both services.

It deliberately contains environment placeholders rather than credentials.

Validate it with:

```bash
DEPTHPOP_CANVA_APP_ID=... \
DEPTHPOP_CANVA_APP_ORIGIN=https://... \
DEPTHPOP_PUBLIC_BASE_URL=https://... \
HOLOFORGE_CANVA_APP_ID=... \
HOLOFORGE_CANVA_APP_ORIGIN=https://... \
HOLOFORGE_PUBLIC_BASE_URL=https://... \
FAL_KEY=... \
docker compose -f docker-compose.production.yml config --quiet
```

## Canva Developer Portal

Create/configure **two separate Canva applications**.

For each app:

1. configure the correct Canva app ID and exact HTTPS origin;
2. enable only the Design Editor/private-asset/design-content permissions required by that product;
3. deploy the matching backend separately;
4. upload only the root-level `app.js` from that product's final handoff package.

Do not upload backend source or the ZIP itself into a JavaScript upload field.

## Final handoff packages

The `Separate Canva apps` workflow produces:

- `HoloForge-Canva-App-<SHA>`
- `DepthPop-Canva-App-<SHA>`

The ZIP gates reject historical reference trees, populated `.env` files, databases, caches, generated artifacts, Git metadata, virtual environments, and cross-product source leakage.

## External configuration still required

Repository readiness does not provide these values:

### DepthPop

- production Canva app ID;
- production Canva app origin;
- public HTTPS backend URL;
- `FAL_KEY`;
- persistent `/data/depthpop` volume.

### HoloForge

- production Canva app ID;
- production Canva app origin;
- public HTTPS render-service URL;
- persistent `/data/holoforge` volume;
- a deployment target capable of running the Blender production image.

## Release rule

Do not declare **READY TO RELEASE** until both apps pass the live browser checklist in `docs/LIVE_CANVA_ACCEPTANCE_CHECKLIST.md`.

Repository green means **repository ready for deployment**, not **production deployed**.
