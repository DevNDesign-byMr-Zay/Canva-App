# VÆLON runtime provider registry

The runtime optimization surface can host multiple local providers behind one small registry. Provider names are explicit and callers resolve them deliberately; there is no implicit fallback that could silently change a replay result.

A provider must expose `solve(problem)`. Provider output remains advisory and should be wrapped in the optimization receipt when it is surfaced to the runtime.

The registry is intentionally dependency-free. A future quantum or quantum-inspired implementation can be registered without changing the caller contract, but it should remain experimental until its output is compared against an appropriate classical reference.
