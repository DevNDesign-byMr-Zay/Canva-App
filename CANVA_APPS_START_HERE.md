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

DepthPop reproduces the DepthPop-specific v115 Drive control surface and processing contract. The full historical ROARY/ÆTHER Studio shell is source evidence only and is intentionally excluded from the deliverable ZIP.

## Never upload or open these as the Canva app

Do not use any file under:

```text
app/authenticated-v115/
apps/depthpop-canva/reference/
canva-app/
```

Those paths are repository history/compatibility/provenance surfaces. They are not either production Canva app.

If a Canva preview shows **Media Library**, **Conversations**, **New Chat**, **R.O.A.R.Y Studio**, **AETHER**, or **ÆTHER**, the wrong artifact is loaded. Stop and replace the uploaded JavaScript bundle with the correct root-level `app.js` from the dedicated HoloForge or DepthPop handoff package.
