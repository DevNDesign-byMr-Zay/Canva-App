# VÆLON validated provider boundary

The maintained runtime can wrap an optimization provider with `createValidatedProvider` before consuming its output.

The wrapper centralizes the existing binary-result checks and returns defensive copies. It does not mutate historical replay data, provenance bytes, or application state.

This gives future quantum or quantum-inspired providers a stable admission boundary: their outputs must satisfy the same deterministic runtime contract as the local reference implementation.