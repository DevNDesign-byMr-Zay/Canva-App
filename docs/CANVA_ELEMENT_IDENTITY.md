# Canva element identity seam

HoloForge currently needs one important distinction to stay explicit: **Canva element identity** and **snapshot-local adapter identity** are not the same authority.

## Current adapter behavior

The Canva snapshot adapter assigns deterministic ordinal keys (`element-1`, `element-2`, …) while reading the current absolute page. Those keys are an app-local bridge for the current snapshot. They are not presented as persistent Canva IDs and must not become a second historical identity authority.

The canonical scenario contract still owns `candidate.changedElementIds`. The Canva gate accepts a scenario only when every changed ID resolves against the reviewed snapshot and the source snapshot fingerprint matches exactly. The apply session repeats the live fingerprint check before writing, so an element reorder or other snapshot mutation fails closed rather than silently redirecting a change to another element.

## Integration requirement

When the real upstream integration is wired, it must establish a deterministic mapping between the canonical scenario's changed-element identities and the snapshot representation **before** the scenario reaches the write gate. The Canva app should not guess that mapping from visual similarity, coordinates, labels, or array position at apply time.

If upstream can provide a stable Canva-backed identity, the adapter can adopt that identity in a future contract revision. Until that identity is explicitly part of the canonical contract, the current ordinal mapping remains intentionally scoped to one reviewed snapshot.

The reviewed-snapshot binding fails closed on blank or duplicate changed IDs and on duplicate IDs inside the reviewed snapshot. Ambiguous identity sets are rejected instead of being normalized through `Map` key replacement.

## Non-goals

- Do not add a second persistent element database to the Canva app.
- Do not infer identity from geometry or text.
- Do not silently remap a scenario when the current snapshot differs.
- Do not weaken the source fingerprint requirement to make an identity mismatch applyable.

This keeps the trust chain intact:

`current Canva snapshot → canonical scenario identity mapping → human review → exact snapshot re-check → explicit apply → post-apply verification`
