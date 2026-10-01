# HoloForge render/export backend

This service is the server-side boundary for heavyweight HoloForge exports.

## Current real capabilities

- authenticated Canva-user export submission;
- strict server-side validation of HoloScene schema v1;
- per-user/per-brand job and artifact ownership;
- bounded TTL-backed job/artifact repositories;
- actual server-side HoloScene JSON artifacts;
- Blender adapter contract for GLB, glTF, transparent VP9 WebM, MP4, and PNG-sequence exports;
- fail-closed behavior when Blender is not configured;
- authenticated artifact status and download endpoints.

The service does not pretend that USDZ or light-field quilt generation are complete. Those require dedicated conversion/device adapters and remain unavailable until implemented. Transparent WebM is now a real worker output: Blender renders RGBA frames and FFmpeg/libvpx-vp9 encodes them with an alpha plane.

## API

- `GET /health`
- `POST /api/v1/exports`
- `GET /api/v1/jobs/{jobId}`
- `GET /api/v1/exports/{exportId}`
- `GET /api/v1/exports/{exportId}/download`

All `/api/v1/*` routes require a fresh Canva user JWT.

## Blender

Set `BLENDER_BIN` to an installed Blender binary. The backend never bundles a fake renderer. If Blender is absent, only `scene-json` is reported as supported.

The dedicated worker lives in `blender_worker.py` and is invoked with a temporary validated job payload. Production deployment can later split this worker into a separate GPU/render container without changing the API contract.


## Production render image

The lightweight `Dockerfile` intentionally starts without Blender and therefore reports only `scene-json` as available.

For a render-capable deployment use:

```bash
docker compose -f docker-compose.render.yml up --build
```

`Dockerfile.render` pins Blender 4.5.14 LTS, retrieves the official Linux x64 archive and matching SHA-256 manifest from Blender's release service, verifies the archive, and exposes it as:

```text
BLENDER_BIN=/opt/blender/blender
```

The render-capable health response will advertise:

```text
scene-json
glb
gltf
webm-alpha
mp4
png-sequence
```

Run an isolated real-GLB worker smoke inside the image with:

```bash
python render_smoke.py
```

This smoke invokes Blender headlessly, requires a non-empty `.glb`, renders a transparent VP9 `.webm`, verifies the VP9 stream, and extracts a real alpha plane from the encoded WebM with FFmpeg.
