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


## Built-in test image upload

HoloForge includes an **UPLOAD TEST IMAGE** control in the production Canva panel. It accepts PNG, JPEG, and WebP files up to 7 MB, converts the file to a Canva-supported data URL, uploads it to the user's private media library, waits for the upload to complete, and adds it to the current design with `addElementAtPoint`.

Required permissions are declared in `canva-app.json`: design content write plus private asset write. The packaged `src/assets/holoforge-logo.svg` is also retained, while the runtime header embeds the same logo geometry so it cannot break because of a missing external URL.

The standalone `preview/index.html` has its own local file picker for visual testing outside Canva. That preview never uploads to Canva; the production `app.js` does.
