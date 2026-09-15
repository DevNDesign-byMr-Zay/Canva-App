import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isSnapshotCurrent,
  resolveCurrentSnapshotFingerprint,
} from '../../prototype/holoforge/snapshot-context.js';

const fixtureFingerprint = 'a'.repeat(64);
const liveFingerprint = 'b'.repeat(64);

const scenario = Object.freeze({ sourceSnapshotFingerprint: fixtureFingerprint });

test('snapshot context prefers a valid host fingerprint over the fixture fallback', () => {
  const documentRoot = { dataset: { sourceSnapshotFingerprint: liveFingerprint } };
  assert.equal(resolveCurrentSnapshotFingerprint({ documentRoot, fallbackFingerprint: fixtureFingerprint }), liveFingerprint);
});

test('snapshot context rejects malformed host identity and safely falls back', () => {
  const documentRoot = { dataset: { sourceSnapshotFingerprint: 'not-a-fingerprint' } };
  assert.equal(resolveCurrentSnapshotFingerprint({ documentRoot, fallbackFingerprint: fixtureFingerprint }), fixtureFingerprint);
  assert.equal(resolveCurrentSnapshotFingerprint({ documentRoot, fallbackFingerprint: 'bad' }), null);
});

test('snapshot comparison is fail-closed for mismatched or malformed identities', () => {
  assert.equal(isSnapshotCurrent(scenario, fixtureFingerprint), true);
  assert.equal(isSnapshotCurrent(scenario, liveFingerprint), false);
  assert.equal(isSnapshotCurrent(scenario, 'bad'), false);
  assert.equal(isSnapshotCurrent({ sourceSnapshotFingerprint: 'bad' }, fixtureFingerprint), false);
});
