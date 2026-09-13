# VÆLON measurement-to-receipt bridge

`createReceiptFromMeasurement()` is the narrow handoff between runtime optimization measurement and the existing optimization receipt shape.

The bridge first validates the measurement contract, then materializes a fresh receipt. It does not alter replay data, authenticated historical bytes, or application state.

This keeps measurement and provenance concerns separate while giving diagnostics a stable receipt representation. The bridge is intentionally provider-neutral and dependency-free.
