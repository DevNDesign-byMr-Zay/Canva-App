# Canva element identity seam

HoloForge needs one distinction to stay explicit: **Canva element identity** and **snapshot-local adapter identity** are not the same authority.

## Current adapter behavior

The Canva snapshot adapter assigns deterministic ordinal keys (`element-1`, `element-2`, …) while reading the current absolute page. Those keys are an app-local bridge for one reviewed snapshot. They are not persistent Canva IDs and must not become a second historical identity authority.

The canonical scenario contract owns `candidate.changedElementIds`. Before a scenario can apply, the Canva gate requires every changed ID to resolve against the exact reviewed snapshot, verifies the snapshot contents still match their trusted fingerprint, and builds one reviewed element binding used by the write path. That binding is exposed through a runtime read-only view.

The apply session then recomputes the live fingerprint before writing. An element reorder, geometry change, duplicate identity, or other snapshot drift therefore fails closed rather than silently redirecting a change to another element.

## Receipt lineage

Post-apply evidence is tied to the same trust chain. Receipt validation can bind the receipt to the canonical scenario and, when the reviewed snapshot is available, to the exact reviewed snapshot and projected post-state. A receipt from another scenario, source snapshot, page, changed-element scope, or expected post-state must not be reusable just because its individual fingerprint is otherwise valid.

## Integration requirement

When upstream integration provides scenario identities, it must establish a deterministic mapping between the canonical scenario's changed-element identities and the reviewed snapshot representation **before** the write gate. The Canva app must not guess that mapping from visual similarity, coordinates, labels, text, or geometry at apply time.

If Canva exposes a suitable stable element identity in a future supported contract, the adapter can adopt it through an explicit contract revision. Until then, ordinal mapping remains intentionally scoped to one reviewed snapshot.

## Non-goals

- Do not add a second persistent element database to the Canva app.
- Do not infer identity from geometry, text, labels, or coordinates.
- Do not silently remap a scenario when the reviewed or live snapshot differs.
- Do not weaken snapshot, scenario, or receipt provenance checks to make an identity mismatch applyable.
- Do not introduce auto-apply, retry loops, solver authority, or physical actuation through this identity seam.

The maintained trust chain is:

`current Canva snapshot → reviewed snapshot fingerprint → canonical scenario identity mapping → human review → exact live snapshot re-check → explicit apply → scenario/snapshot-bound post-apply verification`
