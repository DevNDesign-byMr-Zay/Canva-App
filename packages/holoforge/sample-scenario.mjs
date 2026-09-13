import { createScenario } from './scenario-contract.mjs';

/** Deterministic fixture for contract consumers and future spatial previews. */
export const SAMPLE_SCENARIO = createScenario({
  scenarioId: 'sample-balanced-001',
  sourceDesignRef: 'design:sample/page:1',
  intent: 'reduce spatial collisions while preserving hierarchy',
  constraints: ['preserve-title-proximity', 'no-overlap'],
  layout: {
    depth: 2,
    placements: [
      { id: 'title', x: 0.2, y: 0.2, z: 0 },
      { id: 'body', x: 0.2, y: 0.48, z: 1 },
      { id: 'cta', x: 0.72, y: 0.72, z: 0 },
    ],
  },
  backend: 'holoforge-classical-reference-v0',
  algorithm: 'exact-binary-placement',
  seed: 7,
  objective: 3,
  deltaFromSource: -2,
  durationMs: 4,
  status: 'evaluated',
});
