# Holographic interoperability

The Canva integration treats AI output as a scene-planning input, not a hardware command.

## Flow

`AI model output -> validated scene -> Canva payload -> payload validation -> deterministic fingerprint -> operator-advisory view`

The payload preserves Canva element identity, semantic role, styling, animation, interaction intent, and spatial position so downstream renderers can remain renderer-neutral without discarding editable design semantics.

## Evidence boundary

Every payload is tied to a snapshot, scene identity, and provenance reference. Payload validation must succeed before downstream presentation or operator-view construction.

## Safety boundary

The integration remains non-authoritative and non-actuating. Operator views are advisory and presentation-only. Any future device adapter must validate its own renderer contract rather than treating Canva payloads as execution authority.

## Next collaboration targets

- Add a tested AI-scene -> payload -> operator-view round trip.
- Map preserved Canva interaction semantics into renderer-neutral interaction targets.
- Keep scene fingerprints stable across serialization and key-order changes.
- Add adversarial coverage for provenance, payload, and semantic tampering.
