# HOLOFORGE Canva integration

HOLOFORGE is a human-facing scenario exploration app for Canva. Its job is to help a person understand plausible design futures and deliberately apply one; it is not an autonomous design authority.

## Product loop

```text
Canva design
   ↓
design snapshot
   ↓
intent + constraints
   ↓
scenario candidates
   ↓
VÆLON / upstream evidence
   ↓
spatial 2.5D comparison
   ↓
human chooses
   ↓
explicit Canva edit
```

## Canva boundary

The Canva app owns the interaction surface, presentation, capability detection, scenario comparison, and explicit user application. Upstream systems own intent interpretation, orchestration, optimization/search, and evidence generation.

The app must never imply that a candidate is authoritative merely because it scores well. Every candidate is advisory until the user explicitly applies it.

## Design Editor principles

- Treat Canva's Design Editor APIs as the write boundary.
- Read only the design information required to explain or compare a scenario.
- Detect supported design/context capabilities before presenting an Apply action.
- Keep unsupported operations visible and understandable rather than silently failing.
- Apply a chosen scenario as one coherent user action wherever the Canva API permits, preserving an intuitive undo experience.
- Keep the primary visualization browser-based and lightweight; AR/VR, projectors, volumetric displays, and physical hardware remain optional adapters.
- Keep secrets and provider credentials out of the client bundle. External computation should use an authenticated service boundary.

## Scenario contract

A scenario contains a stable `scenarioId`, source Canva design reference, user intent, explicit constraints, candidate layout, backend identity, reproducibility seed, objective score, delta from source, duration, and lifecycle status.

The scenario contract is intentionally renderer-neutral. The existing holographic payload adapter remains the integrity boundary for downstream display targets.

## Purposeful UX

The first screen should answer three questions immediately:

1. **What am I optimizing?** — show the user's intent and constraints.
2. **What changed?** — compare the source with one or more candidates and expose measurable deltas.
3. **What happens if I apply it?** — preview the exact design consequence before the user commits.

Avoid novelty UI that does not improve those decisions. Holographic presentation is a visualization technique, not the product goal.

## Non-goals

- No hidden automatic edits.
- No local solver implementation inside the Canva app.
- No physical actuation.
- No mutation of authenticated historical replay bytes.
- No second camera or persistence authority inside the DOM layer.
