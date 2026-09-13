# VÆLON result boundary

Runtime optimization providers are treated as computation sources, not application truth. Before a result is surfaced, the runtime checks that its decision vector matches the versioned problem and contains only binary values, and that the reported objective is finite.

The normalization helper also creates defensive copies so callers cannot mutate the provider-owned result through the returned structure.

This boundary does not modify historical replay or provenance bytes. It is intentionally local and dependency-free. Future quantum or quantum-inspired providers can use the same contract without gaining implicit authority over replay state.
