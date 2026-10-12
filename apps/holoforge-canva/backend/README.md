# HoloForge Render Backend

This service is the server-side boundary for heavyweight HoloForge exports.

It provides:

- a clean REST API for job queueing and polling;
- strict Canva JWT authentication and ownership checks;
- headless Blender worker rendering;
- fail-closed behavior when Blender is not configured;
- authenticated artifact status and download endpoints.

USDZ and generic light-field quilt generation are implemented worker outputs. USDZ uses Blender's native archive exporter, while light-field quilts render discrete camera views and assemble them into a real quilt PNG. Device-specific optical interlacing/calibration remains outside the generic HoloForge contract. Transparent WebM is also a real worker output: Blender renders RGBA frames and FFmpeg/libvpx-vp9 encodes them with an alpha plane.

## Production Persistence Architecture

HoloForge supports persistent durable storage for jobs and artifacts using SQLite:

- `HOLOFORGE_REPOSITORY_BACKEND=sqlite` (or `memory` for isolated test environments)
- `HOLOFORGE_DATABASE_PATH=/data/holoforge/holoforge.sqlite3`
- `HOLOFORGE_ARTIFACT_ROOT=/data/holoforge/artifacts`

The first production deployment profile is a persistent single-service/render-worker deployment.
Production deployments MUST mount persistent volume storage for both the database path and render artifact root.

On service startup, HoloForge recovers stale jobs left in `queued` or `rendering` states during a service restart, transitioning them to terminal `failed` status with a truthful error message.

## Production Resource Bounds & Lifecycle

The backend bounds heavyweight rendering in three places:

- `HOLOFORGE_MAX_CONCURRENCY` limits simultaneous Blender jobs (default `2`, hard-clamped to `1..8`);
- export requests are limited to 16,777,216 output pixels per rendered frame, covering the generic 3600×3600 light-field quilt profile;
- raster animation formats (WebM, MP4, PNG sequence) are limited to 3,600 rendered frames per job (3D formats GLB/glTF are exempt);
- immediate insertion-time capacity eviction for `HOLOFORGE_MAX_JOBS` and `HOLOFORGE_MAX_ARTIFACTS`.

Artifact hashing streams files in chunks instead of reading large video/sequence artifacts fully into memory. When an artifact expires, is evicted, or disappears unexpectedly, HoloForge removes the complete per-export workspace—including temporary frames, job payloads, view renders and manifests—while refusing to delete paths outside `HOLOFORGE_ARTIFACT_ROOT`.
