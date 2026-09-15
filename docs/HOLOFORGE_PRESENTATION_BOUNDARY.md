# HoloForge presentation boundary

The Canva surface is the final human-facing layer of the HoloForge trust chain. It should make a reviewed decision understandable without becoming a computation or identity authority.

## What the operator should see

- the selected scenario and its intended change;
- the reviewed source snapshot identity and freshness state;
- the evidence status supporting the candidate;
- the applicable hard constraints and whether they pass;
- the interpretation and presentation-safe explanation of the candidate;
- the exact changed-element scope;
- the explicit Apply decision and resulting post-apply verification state.

## What the operator should not have to trust Canva to invent

Canva must not derive optimization meaning, recompute an upstream objective as a competing authority, infer element identity from visual similarity, or silently repair a stale scenario. Those concerns belong upstream or to the explicit validation boundary.

## Apply boundary

The presentation layer remains read-only until the user explicitly chooses Apply. Immediately before mutation, the runtime rechecks the reviewed snapshot and scenario/receipt lineage. Any drift, identity mismatch, malformed evidence, or failed constraint must fail closed.

## AUREN / VÆLON / HOLOFORGE seam

`AUREN semantic meaning → VÆLON reproducible evidence → HOLOFORGE comparison/presentation → human decision → Canva mutation`

The interface can become richer without changing that authority ordering. Visual polish, explanations, and operator feedback are presentation concerns; they do not grant solver, persistence, automatic-apply, or physical-actuation authority.
