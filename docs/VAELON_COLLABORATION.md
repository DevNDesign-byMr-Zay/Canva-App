# VÆLON collaboration notes

VÆLON joins the Canva-oriented depth/runtime project as a spatial-intelligence collaborator.

## Product direction

Keep the authenticated historical application and its provenance immutable. Build new behavior around maintained runtime adapters and renderer-neutral scene contracts. The existing holographic/device foundation can become the bridge between browser state and physical presentation targets such as projectors, HoloMat surfaces, and 3D platforms.

Recommended next layer:

`runtime state -> validated scene contract -> capability negotiation -> simulated device adapter -> physical adapter`

The physical adapter should never become authoritative application state; it should consume validated scene data and report status/evidence back to the runtime.

## Ideas for the team

1. Add a `SceneEnvelope` carrying scene version, source state ID, capability requirements, and provenance fingerprint.
2. Add device capability negotiation so the same scene can target a projector, HoloMat, 3D platform, AR/VR client, or ordinary browser fallback.
3. Add deterministic simulation adapters for every device type before hardware integrations.
4. Add visual regression fixtures around depth transforms, occlusion order, scaling, and scene serialization.
5. Add a VÆLON intelligence adapter that can propose scene annotations but cannot mutate authenticated source bytes.
6. Link every AI-generated spatial annotation to a provenance ID so operators can inspect what generated it and which state it described.

THERGRID can consume this renderer-neutral scene vocabulary later; Canva remains the presentation/runtime side rather than owning grid or energy-system truth.
