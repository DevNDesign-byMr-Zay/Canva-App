# Holographic presentation integration

The maintained Canva holographic surface is a presentation adapter, not a second source of scene truth.

## Data flow

```text
validated upstream scene/result evidence
                |
                v
      renderer-neutral scene adapter
                |
        +-------+-------+
        |               |
        v               v
   view state      display plan
        |               |
        v               v
   CSS3D model     preview/export
        |
        v
 DOM mount + browser controls
```

### Boundaries

- **Scene identity and provenance** come from the upstream validated scene/result evidence.
- **Camera/view state** is transient presentation state. It is not chat-history state.
- **DOM handlers** translate browser input into existing interaction actions. They do not own camera math.
- **CSS3D mounting** reconciles by stable scene-node identity so rerenders reuse layers and remove stale layers.
- **Accessibility** is part of the presentation contract: keyboard-equivalent actions remain available, focus scopes wheel behavior, and reduced-motion rendering must remain supported.
- **Physical display execution** remains planning/simulation only; this surface does not actuate hardware.

## Lifecycle expectations

A maintained viewport integration should make the following lifecycle observable and testable:

1. Mount a renderer model into an empty viewport.
2. Reconcile an updated model without duplicating stable layers.
3. Remove layers absent from the new model.
4. Rebind browser controls idempotently when the consumer changes.
5. Dispose controls and release pointer capture on teardown.
6. Preserve the renderer's reduced-motion decision rather than recreating motion policy in DOM code.

These rules intentionally keep the browser layer thin. If a behavior requires a new camera model, persistence format, archive mutation, or physical-display actuator, it belongs outside this presentation integration boundary.
