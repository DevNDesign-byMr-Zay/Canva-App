import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createAuthenticatedV115MessageRecord,
  snapshotAuthenticatedV115Attachments,
} from '../../runtime/v115-authenticated-message-record.mjs';

test('snapshots only authenticated v115 attachment metadata fields', () => {
  const file = { name: 'brief.pdf', type: 'application/pdf', size: 2048, data: 'private-bytes' };

  assert.deepEqual(snapshotAuthenticatedV115Attachments([file]), [
    { name: 'brief.pdf', type: 'application/pdf', size: 2048 },
  ]);
});

test('persists the authenticated user role/content/attachments shape', () => {
  const attachments = [{ name: 'brief.pdf', type: 'application/pdf', size: 2048 }];

  assert.deepEqual(createAuthenticatedV115MessageRecord('user', 'Review this', { attachments }), {
    role: 'user',
    content: 'Review this',
    attachments,
  });
});

test('persists authenticated assistant sources with null engine fallback', () => {
  const sources = [{ title: 'Source', url: 'https://example.test' }];

  assert.deepEqual(createAuthenticatedV115MessageRecord('assistant', 'Done', { sources }), {
    role: 'assistant',
    content: 'Done',
    sources,
    engine: null,
  });
});

test('does not invent optional persisted fields when they are absent', () => {
  assert.deepEqual(createAuthenticatedV115MessageRecord('assistant', 'Done'), {
    role: 'assistant',
    content: 'Done',
  });
});

test('rejects roles outside the authenticated v115 user/assistant boundary', () => {
  assert.throws(() => createAuthenticatedV115MessageRecord('system', 'hidden'), /role must be/);
  assert.throws(() => snapshotAuthenticatedV115Attachments({}), /attachments must be an array/);
});
