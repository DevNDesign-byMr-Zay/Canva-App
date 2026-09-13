# VÆLON runtime measurement boundary

Runtime optimization can be measured without becoming part of replay truth. The measurement helper validates provider output first, then records provider identity, problem shape, solver metadata, objective, decisions, and elapsed duration.

The clock is injectable for deterministic tests. Measurement is observational: it does not write historical provenance, alter replay state, or authorize downstream behavior.

Future quantum or quantum-inspired providers should use the same boundary so their performance and objective quality can be compared against the maintained classical reference.
