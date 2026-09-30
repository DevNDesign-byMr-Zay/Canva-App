# DepthPop backend

This is the production backend for the standalone DepthPop Canva app.

The production flow is:

1. the Canva frontend reads the single selected image;
2. Canva's temporary asset URL is downloaded immediately inside the app iframe;
3. the actual raster bytes are sent to this backend as authenticated multipart data;
4. the backend verifies the fresh Canva user JWT against the JWKS for CANVA_APP_ID;
5. Depth Anything v2 produces the depth map through fal.ai;
6. the maintained DepthPop depth-aware lens-blur algorithm renders the result locally;
7. a short-lived HTTPS output URL is returned;
8. Canva imports that render as a private derived asset with parentRef, waits for upload completion, replaces the selected image ref, and saves the selection draft.

The FAL key is server-side only. The browser never receives it and this backend does not accept provider keys from request headers.

Configuration:

    CANVA_APP_ID=<DepthPop Canva app id>
    CANVA_APP_ORIGIN=<allowed Canva app iframe origin>
    FAL_KEY=<server-side fal key>
    PUBLIC_BASE_URL=https://your-public-depthpop-backend.example
    PORT=8081

Local start:

    python -m venv .venv
    .venv/bin/pip install -r requirements.txt
    .venv/bin/pytest -q
    .venv/bin/uvicorn app:app --host 0.0.0.0 --port 8081 --reload

Windows PowerShell:

    py -m venv .venv
    .\.venv\Scripts\python -m pip install -r requirements.txt
    .\.venv\Scripts\python -m pytest -q
    .\.venv\Scripts\python -m uvicorn app:app --host 0.0.0.0 --port 8081 --reload

For Canva testing, expose the backend over public HTTPS and set CANVA_BACKEND_HOST in the frontend app environment to that origin.

Security boundaries:
- requests require a valid Canva user JWT;
- CANVA_APP_ID is enforced as the JWT audience;
- selected image bytes are downloaded client-side from Canva's temporary asset URL instead of asking the backend to fetch a user-controlled URL;
- accepted inputs are PNG, JPEG, or WebP and limited to 50 MB;
- depth-map downloads are restricted to fixed fal.media origins and never follow redirects;
- FAL_KEY is never accepted from request headers or frontend payloads;
- generated image cache entries expire after 15 minutes.

The exact historical Drive router remains under ../reference/drive-source as a .txt provenance artifact so source scanners do not mistake archived historical code for a live server.
