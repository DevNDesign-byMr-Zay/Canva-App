# VÆLON optimization boundary

This repository can host small, deterministic optimization experiments that operate on maintained runtime data without modifying authenticated historical bytes.

The first reference primitive is intentionally simple: an exact binary baseline for independent linear objectives. It provides a stable interface and measurable objective value that future combinatorial, quantum-inspired, or hardware-backed experiments can compare against.

## Boundary

- Optimization consumes explicit inputs and returns explicit results.
- The authenticated archive and provenance records remain read-only.
- No credentials, network calls, or quantum-provider SDKs are required.
- Any future quantum backend should report its provider, algorithm, version, seed/configuration, runtime, and objective so results remain comparable.
- A quantum result is an experiment until it demonstrates measurable benefit against an appropriate classical baseline.
