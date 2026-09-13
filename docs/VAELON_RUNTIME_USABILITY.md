# VÆLON runtime usability boundary

The maintained runtime should feel predictable before it feels clever.

For message actions, the runtime now supports an injected feedback seam with three explicit states:

- `pending` — the action has started and may take time.
- `success` — the requested action completed.
- `error` — the action failed and the host can explain that the user can retry.

The feedback adapter is intentionally renderer-agnostic. A host can map these events to a toast, inline status, accessible live region, or another existing UI surface without changing the authenticated runtime adapter.

Action failures are returned to the caller as part of the handled result rather than disappearing silently. This preserves the existing event boundary while making failure observable to the UI.

The optimization/measurement surfaces remain separate from user interaction. They provide bounded computation evidence and do not mutate replay or provenance state.

## Usability acceptance checklist

Before treating the maintained runtime as ready for broader use, verify:

1. Every primary message action gives visible or accessible completion feedback.
2. Failed copy/share/export operations expose a retryable error state.
3. Regeneration, double-check, and report actions expose a pending state while submission is in progress.
4. Like/dislike remains mutually exclusive.
5. Branching preserves the selected user/assistant exchange without modifying historical authenticated bytes.
6. Runtime optimization remains advisory and independently testable.
7. `npm test` passes on a fresh Node 22+ checkout.
8. CI is green before merging the feature branch.

No authenticated historical application bytes are rewritten by this usability layer.
