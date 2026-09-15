# HOLOFORGE

HOLOFORGE is a separate Canva-app direction for spatial scenario intelligence. It does not extend or alter the maintained interaction runtime.

## v0 architecture

```text
design snapshot
  -> intent + constraints
  -> scenario candidates
  -> VÆLON evidence
  -> spatial preview
  -> explicit user apply
```

The first implementation seam is the **Scenario Contract v0** in `packages/holoforge/scenario-contract.mjs`.

A scenario is deliberately portable and inspectable. It carries a stable identity, source design reference, intent, constraints, candidate layout, computation evidence, and lifecycle status.

### Responsibility boundaries

- **HOLOFORGE / Canva:** visualize candidates and apply only the scenario explicitly selected by the human.
- **AUREN:** interpret bounded intent, establish constraints, orchestrate candidates, and compare them.
- **VÆLON:** perform reproducible optimization/search and provide bounded evidence.
- **Classical reference:** establish a correctness and measurement baseline.
- **Quantum-inspired / future quantum providers:** remain interchangeable candidate methods behind the evidence boundary.
- **THERGRID:** may consume spatial/audit artifacts later; it is not a dependency for the first app slice.

## First experiment

Start with a small binary placement/assignment problem. Compare an exact/classical result with a deterministic quantum-inspired candidate and report the objective delta. No candidate changes the source design automatically.

## Spatial direction

The initial visual layer is browser-compatible 2.5D: depth, links/relationships, branch comparison, and original-versus-candidate inspection. WebXR or specialized spatial hardware can become adapters later rather than prerequisites.
