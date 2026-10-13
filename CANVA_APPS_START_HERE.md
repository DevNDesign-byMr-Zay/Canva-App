# Canva apps — start here

This repository contains historical ROARY/ÆTHER source only for provenance. **That historical shell is not a Canva app deliverable.**

## The only two Canva apps

### HoloForge
Source root:

```text
apps/holoforge-canva/
```

Final handoff artifact:

```text
HoloForge-Canva-App.zip
```

Inside Canva Developer Portal, upload **only the root-level `app.js` from that HoloForge package**.

### DepthPop
Source root:

```text
apps/depthpop-canva/
```

Final handoff artifact:

```text
DepthPop-Canva-App.zip
```

Inside Canva Developer Portal, upload **only the root-level `app.js` from that DepthPop package**.

DepthPop retains the verified v115 control vocabulary as provenance, but the production app is now the typed DepthScene/WebGL object-scene editor with authenticated processing, 4D animation, object operations, Render to Canva, and production export. The full historical ROARY/ÆTHER Studio shell and Drive reference tree are source evidence only and are intentionally excluded from the deliverable ZIP.

## Never upload or open these as the Canva app

Do not use any file under:

```text
app/authenticated-v115/
apps/depthpop-canva/reference/
canva-app/
```

Those paths are repository history/compatibility/provenance surfaces. They are not either production Canva app.

If a Canva preview shows **Media Library**, **Conversations**, **New Chat**, **R.O.A.R.Y Studio**, **AETHER**, or **ÆTHER**, the wrong artifact is loaded. Stop and replace the uploaded JavaScript bundle with the correct root-level `app.js` from the dedicated HoloForge or DepthPop handoff package.


## Backend deployment boundary

The Canva Developer Portal upload is the root-level `app.js` only. The included backend directories are deployment handoff material, not JavaScript to upload into Canva.

- DepthPop's FastAPI backend is deployed separately with its Canva app identity, HTTPS public base URL, server-side provider credentials, and persistent database/asset/artifact volumes.
- HoloForge's authenticated render backend is deployed separately with its Canva app identity, persistent database/artifact storage, and the production Blender/FFmpeg render runtime.

Never embed backend secrets into either Canva bundle.
