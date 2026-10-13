# DepthPop — four-model live provider smoke verification

**Result:** PASS — one full live `suite=all` run, with production GitHub Actions credential injection.

**Date:** October 13, 2026 (UTC)
**Branch:** `main`
**Source commit:** `9ec30cc4e616a7b621db764d0f3ed05d4cfc2cbd`
**Workflow run:** [38352025451](https://github.com/DevNDesign-byMr-Zay/Canva-App/actions/runs/38352025451)
**Job:** `live-provider-smoke` — conclusion: `success`
**Inputs:** `suite=all`; `confirm_paid_usage=RUN_ONCE`
**Result artifact:** `depthpop-live-provider-smoke-38352025451` (GitHub Actions artifact ID `11790698778`; expires 2026-10-27)
**Artifact SHA-256:** `0c178bb36fe8209d91c344d5f0a914d68ba117e2241244e21a5343f8dacc4eee` (GitHub artifact digest)

## Test fixture and privacy

The input is the 128 × 128 programmatically generated **cosmetics bottle** from `apps/depthpop-canva/backend/live_provider_smoke.py`. It has a cap, a container, and a colored label; **no face, portrait, or human subject**. It is not a Canva user's photograph. The smoke script does not persist the fixture or publish its image bytes.

## Verified live execution sequence

| Order | Provider | Validated result |
| --- | --- | --- |
| 1 | `fal-ai/florence-2-large/object-detection` | `ok: true`, one detection, response schema validated |
| 2 | `fal-ai/sam-3/image` | `ok: true`, one PNG mask of 128 × 128; `promptSource: florence-2` |
| 3 | `fal-ai/image-preprocessors/depth-anything/v2` | `ok: true`, normalized canonical PNG depth map of 128 × 128; `disparity_high_is_near`; standard quality |
| 4 | `fal-ai/object-removal/mask` | `ok: true`, PNG reconstructed plate of 128 × 128; `model: best_quality`, `maskExpansion: 20`, `sourceMask: sam-3` |

The Actions log prints success for all four stages. The last stage started at **05:34:10Z** and passed its output-validation contract at **05:35:26Z**. The workflow's `paidCallsMaximum` was **4** and its top-level report contained `ok: true`, `suite: all`.

**Important distinction:** This verifies live model invocation, API contract compatibility, real intermediate mask handoff, and valid output dimensions on the bounded synthetic fixture. It does **not** prove full-resolution quality, perfect visual object removal on arbitrary imagery, or installation inside a live Canva editor. Those remain separate live Canva acceptance checks.

## Reproducibility and rescore evidence

- Open the [passing workflow run](https://github.com/DevNDesign-byMr-Zay/Canva-App/actions/runs/38352025451) to review the stage-by-stage job logs.
- Download the `depthpop-live-provider-smoke-38352025451` JSON artifact while retained (14 days).
- Keep the explicit paid workflow opt-in and current private secret mapping; **never store the provider key in this file, test fixtures, logs or frontend**.
- The workflow does not add portrait imagery or person-shaped fixtures.
- Rescoring is a separate action; this document records verified results only.
