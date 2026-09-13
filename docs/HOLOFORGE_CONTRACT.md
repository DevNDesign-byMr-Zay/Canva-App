# HOLOFORGE Scenario Contract v0

The contract is the first implementation boundary for the separate HOLOFORGE app.

## Required evidence

Every evaluated candidate identifies its backend, algorithm, non-negative seed, objective, delta from the source design, and measured duration. This makes classical and quantum-inspired candidates comparable without granting either method implicit authority.

## Scenario Forking

`forkScenarios()` creates independent candidate records from one source design reference. It is intentionally a pure operation: it does not mutate the source, call external providers, or apply a design.

## Next seam

The next implementation increment should convert a bounded Canva design snapshot into a spatial graph suitable for 2.5D preview and a small binary placement/assignment objective. The solver adapter should consume that objective through the same evidence fields defined here.
