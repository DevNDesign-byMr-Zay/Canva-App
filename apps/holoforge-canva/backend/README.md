# HoloForge render/export backend

This service is the server-side boundary for heavyweight HoloForge exports.

## Current real capabilities

- authenticated Canva-user export submission;
- strict server-side validation of HoloScene schema v1;
- per-user/per-brand job and artifact ownership;
- bounded TTL-backed job/artifact repositories;
- actual server-side HoloScene JSON artifacts;
- Blender adapter contract for GLB, glTF, transparent VP9 WebM, MP4, PNG-sequence, and multi-view light-field quilt exports;
- fail-closed behavior when Blender is not configured;
- authenticated artifact status and download endpoints.

The service does not pretend that USDZ generation is complete. USDZ remains unavailable until a real converter exists. Transparent WebM is a real worker output: Blender renders RGBA frames and FFmpeg/libvpx-vp9 encodes them with an alpha plane. Light-field quilt is also a real worker output: Blender renders one camera view per quilt tile and FFmpeg assembles those views into a single quilt PNG.

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
lightfield-quilt
```

Run an isolated real-GLB worker smoke inside the image with:

```bash
python render_smoke.py
```

This smoke invokes Blender headlessly, requires a non-empty `.glb`, renders a transparent VP9 `.webm`, verifies the VP9 stream and alpha plane, then renders a 45-view 5×9 quilt and verifies both its final dimensions and the 45 discrete source views.


## Light-field quilt contract

The v1 quilt renderer accepts a bounded quilt layout:

```json
{
  "columns": 5,
  "rows": 9,
  "views": 45,
  "viewAspect": 1.8,
  "viewConeDegrees": 40
}
```

The Canva client uses that 45-view profile as its generic default at 3600×3600. The backend also accepts compatible custom layouts when:

- `views == columns * rows`;
- output width/height divide evenly by the requested grid;
- declared `viewAspect` matches the actual tile geometry;
- `viewConeDegrees` stays inside the server bounds;
- v1 is requested as a still quilt rather than an animated quilt.

The worker rotates the authored camera around the scene target across the requested horizontal view cone, renders every discrete view, and assembles the PNG in the canonical left-to-right / bottom-to-top view order. The filename carries a `_qs{columns}x{rows}a{aspect}` quilt suffix.

This produces the multi-view content. It intentionally does not hard-code a physical display's lenticular/interlacing calibration; that belongs to the target display runtime or a future device-specific adapter.
