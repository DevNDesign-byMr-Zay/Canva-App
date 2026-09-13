# VÆLON streaming lifecycle

The maintained v115 chat adapter treats streaming as a user-facing lifecycle, not only a transport detail.

## Guarantees

- Request inputs are validated before the network call.
- HTTP failures are surfaced with the response detail when available.
- SSE deltas may arrive across arbitrary transport chunks and are reassembled before parsing.
- Malformed or non-delta SSE records do not terminate an otherwise usable stream.
- A `[DONE]` marker is reported explicitly through `doneMarkerSeen`.
- If the connection closes without `[DONE]`, accumulated content is still returned with `doneMarkerSeen: false`, allowing the host to distinguish an incomplete stream from a clean completion.
- The stream reader lock is released on every exit path, including early completion and callback failure.
- The adapter remains renderer-agnostic and does not mutate replay or provenance state.

This boundary is intentionally small: the host decides how pending, success, interruption, retry, and error states are presented to the user.