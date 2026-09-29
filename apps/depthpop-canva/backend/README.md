# DepthPop backend

This is the production backend for the standalone DepthPop Canva app.

It performs four jobs:

1. verifies the fresh Canva user JWT against the JWKS for CANVA_APP_ID;
2. immediately downloads the temporary selected-image URL supplied by Canva;
3. gets a Depth Anything v2 depth map through fal.ai and performs the DepthPop depth-aware lens-blur render locally;
4. exposes the derived PNG briefly so Canva can import it as a private asset and replace the selected image reference.

The FAL key is server-side only. The browser never receives it.

Configuration:

    CANVA_APP_ID=<DepthPop Canva app id>
    CANVA_APP_ORIGIN=<allowed Canva app iframe origin>
    FAL_KEY=<server-side fal key>
    PUBLIC_BASE_URL=https://your-public-depthpop-backend.example
    PORT=8081

Local start:

    python -m venv .venv
    .venv/bin/pip install -r requirements.txt
    .venv/bin/uvicorn app:app --host 0.0.0.0 --port 8081 --reload

Windows PowerShell equivalent:

    py -m venv .venv
    .\.venv\Scripts\python -m pip install -r requirements.txt
    .\.venv\Scripts\python -m uvicorn app:app --host 0.0.0.0 --port 8081 --reload

For Canva testing, expose the backend over public HTTPS and set CANVA_BACKEND_HOST in the frontend app environment to that origin.

Security boundaries:
- requests require a valid Canva user JWT;
- CANVA_APP_ID is enforced as the JWT audience;
- source images must use HTTPS and resolve only to public IPs;
- redirects are revalidated to reduce SSRF risk;
- selected inputs are limited to 50 MB;
- FAL_KEY is never accepted from request headers or frontend payloads;
- generated image cache entries expire after 15 minutes.

The exact historical Drive router remains under ../reference/drive-source. It is preserved as provenance, not imported as production runtime code.
