import { buildScenarioEnvelope, computeObjectiveGap } from './holoforge-scenario-contract.mjs';

const SNAPSHOT_FINGERPRINT = 'a'.repeat(64);

function scenario({
  id,
  label,
  summary,
  objectiveId,
  direction = 'maximize',
  hard = [],
  soft = [],
  candidateScore,
  baselineScore,
  changedElementIds,
  layout,
  delta,
  tradeoffs = [],
  seed,
}) {
  return buildScenarioEnvelope({
    scenarioId: id,
    source: {
      designId: 'design-holoforge-demo',
      snapshotId: 'snapshot-v1',
      pageIds: ['page-1'],
      snapshotFingerprint: SNAPSHOT_FINGERPRINT,
    },
    intent: {
      summary,
      objectiveId,
      objectiveDirection: direction,
    },
    constraints: {
      hard,
      soft,
    },
    candidate: {
      layout,
      changedElementIds,
      delta,
    },
    evidence: {
      backend: 'vaelon',
      algorithm: 'deterministic-candidate-v1',
      seed,
      status: 'complete',
      objectiveScore: candidateScore,
      baseline: {
        backend: 'classical-reference',
        algorithm: 'exact-reference-v1',
        objectiveScore: baselineScore,
      },
      objectiveGap: computeObjectiveGap({
        direction,
        candidateScore,
        baselineScore,
      }),
      durationMs: 12,
      hardConstraintsPassed: true,
      warnings: [],
    },
    interpretation: {
      producer: 'auren',
      label,
      summary,
      tradeoffs,
    },
    presentation: {
      advisoryOnly: true,
      autoApply: false,
      target: 'web-dashboard',
    },
  });
}

export const HOLOFORGE_SOURCE_FINGERPRINT = SNAPSHOT_FINGERPRINT;

export const hierarchyScenario = scenario({
  id: 'hierarchy-first',
  label: 'Hierarchy Focus',
  summary: 'Increase headline dominance while preserving locked brand marks.',
  objectiveId: 'hierarchy-balance-v1',
  hard: [
    { id: 'lock-logo', type: 'locked-element', elementId: 'logo-1' },
    { id: 'keep-title-visible', type: 'visibility', elementId: 'headline-1' },
  ],
  soft: [{ id: 'reduce-clutter', type: 'spacing-preference', weight: 0.4 }],
  candidateScore: 0.92,
  baselineScore: 0.95,
  changedElementIds: ['headline-1', 'body-1'],
  layout: {
    elements: {
      'logo-1': { x: 40, y: 40, z: 0, locked: true },
      'headline-1': { x: 120, y: 130, z: 20, scale: 1.15 },
      'body-1': { x: 120, y: 270, z: 10, scale: 1 },
    },
  },
  delta: {
    'headline-1': { y: -18, scale: 0.15 },
    'body-1': { y: 24 },
  },
  tradeoffs: ['Slightly increases vertical separation to improve hierarchy.'],
  seed: 'hierarchy-seed-001',
});

export const spacingScenario = scenario({
  id: 'spacing-balance',
  label: 'Spatial Balance',
  summary: 'Improve spacing rhythm and edge balance with minimal movement.',
  objectiveId: 'spacing-balance-v1',
  hard: [{ id: 'stay-on-page', type: 'bounds', pageId: 'page-1' }],
  soft: [{ id: 'minimize-motion', type: 'movement-penalty', weight: 0.7 }],
  candidateScore: 84,
  baselineScore: 86,
  changedElementIds: ['card-1', 'card-2'],
  layout: {
    elements: {
      'card-1': { x: 80, y: 190, z: 10 },
      'card-2': { x: 420, y: 190, z: 10 },
    },
  },
  delta: {
    'card-1': { x: -12 },
    'card-2': { x: 12 },
  },
  tradeoffs: ['Preserves content order while increasing lateral balance.'],
  seed: 'spacing-seed-001',
});

export const lockedBrandScenario = scenario({
  id: 'locked-brand',
  label: 'Brand-Safe Reflow',
  summary: 'Reflow supporting content without moving protected brand elements.',
  objectiveId: 'brand-safe-reflow-v1',
  hard: [
    { id: 'lock-logo', type: 'locked-element', elementId: 'logo-1' },
    { id: 'lock-color-block', type: 'locked-element', elementId: 'brand-block-1' },
  ],
  soft: [{ id: 'balance-supporting-copy', type: 'spacing-preference', weight: 0.5 }],
  candidateScore: 0.88,
  baselineScore: 0.9,
  changedElementIds: ['caption-1', 'caption-2'],
  layout: {
    elements: {
      'logo-1': { x: 40, y: 40, z: 0, locked: true },
      'brand-block-1': { x: 40, y: 420, z: 0, locked: true },
      'caption-1': { x: 160, y: 210, z: 8 },
      'caption-2': { x: 160, y: 280, z: 8 },
    },
  },
  delta: {
    'caption-1': { y: -10 },
    'caption-2': { y: 14 },
  },
  tradeoffs: ['Keeps protected brand geometry fixed while rebalancing support copy.'],
  seed: 'brand-seed-001',
});

export const holoforgeScenarioFixtures = Object.freeze([
  hierarchyScenario,
  spacingScenario,
  lockedBrandScenario,
]);
