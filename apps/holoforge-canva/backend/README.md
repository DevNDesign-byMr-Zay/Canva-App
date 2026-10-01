# HoloForge render/export backend

This service is the server-side boundary for heavyweight HoloForge exports.

## Current real capabilities

- authenticated Canva-user export submission;
- strict server-side validation of HoloScene schema v1;
- per-user/per-brand job and artifact ownership;
- bounded TTL-backed job/artifact repositories;
- actual server-side HoloScene JSON artifacts;
- Blender adapter contract for GLB, glTF, MP4, and PNG-sequence exports;
- fail-closed behavior when Blender is not configured;
- authenticated artifact status and download endpoints.

The service does not pretend that USDZ, alpha-WebM, or light-field quilt generation are complete. Those require dedicated conversion/device adapters and remain unavailable until implemented.

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
