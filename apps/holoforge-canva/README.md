# HoloForge — standalone Canva app

HoloForge is an independent Canva Design Editor app. It does not share a runtime entrypoint, product switcher, or product-lock global with DepthPop.

The interface is purpose-built for Canva's narrow panel: CREATE builds a material plan, SPATIAL previews the holographic intent, and VERIFY records the result of an explicit Forge action.

Supported creation types Holo Graphic, Glass, Chrome, and Light FX use Canva app elements and remain editable by HoloForge. Holo Text and Holo Logo remain preview-only until trusted source bindings are implemented.

Development:

    npm install --ignore-scripts
    npm run typecheck
    npm run test
    npm run start

Production:

    npm run build

Upload the generated JavaScript bundle for this app to its own HoloForge record in the Canva Developer Portal. Do not register this build as DepthPop.
