# VÆLON runtime boundary

The runtime optimization surface is an advisory computation layer. It accepts explicit, versioned problem inputs and returns explicit solver metadata and outputs.

## Rules

- Historical replay and provenance data remain read-only.
- Optimization code does not mutate authenticated historical bytes.
- Providers are selected through a small adapter boundary rather than hard-coded cloud integrations.
- A deterministic local reference remains available for comparison.
- Quantum or quantum-inspired execution is experimental until it demonstrates measurable benefit against the reference.
- Provider metadata should include backend identity, algorithm, version, seed/configuration, objective, and runtime where available.
- No credentials, remote execution, or network dependency belong in the reference runtime path.

This boundary keeps computation useful without making optimization an implicit source of application truth.
