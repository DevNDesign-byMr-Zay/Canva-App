import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createAuthenticatedV115MessageRecord,
  finalizeAuthenticatedV115AssistantRecord,
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

test('finalizes the existing assistant shell in place with authenticated source metadata', () => {
  const assistant = createAuthenticatedV115MessageRecord('assistant', '');
  const messages = [{ role: 'user', content: 'Question' }, assistant];
  const sources = [{ title: 'Source', url: 'https://example.test' }];
  let persists = 0;

  const result = finalizeAuthenticatedV115AssistantRecord(messages, {
    content: 'Final answer',
    sources,
    engine: 'web',
    persist() {
      persists += 1;
    },
  });

  assert.equal(messages.length, 2);
  assert.equal(result, assistant);
  assert.deepEqual(assistant, {
    role: 'assistant',
    content: 'Final answer',
    sources,
    engine: 'web',
  });
  assert.equal(persists, 1);
});

test('clears stale source metadata when post-stream finalization has no sources', () => {
  const assistant = {
    role: 'assistant',
    content: '',
    sources: [{ title: 'stale' }],
    engine: 'web',
  };

  finalizeAuthenticatedV115AssistantRecord([assistant], {
    content: 'Answer without citations',
    persist() {},
  });

  assert.deepEqual(assistant, { role: 'assistant', content: 'Answer without citations' });
});

test('refuses to mutate a non-assistant last persisted record', () => {
  const messages = [{ role: 'user', content: 'Question' }];
  let persisted = false;

  assert.throws(
    () =>
      finalizeAuthenticatedV115AssistantRecord(messages, {
        content: 'Nope',
        persist() {
          persisted = true;
        },
      }),
    /last persisted message must be assistant/,
  );
  assert.equal(persisted, false);
  assert.deepEqual(messages, [{ role: 'user', content: 'Question' }]);
});

test('rejects roles and finalization inputs outside the authenticated v115 boundary', () => {
  assert.throws(() => createAuthenticatedV115MessageRecord('system', 'hidden'), /role must be/);
  assert.throws(() => snapshotAuthenticatedV115Attachments({}), /attachments must be an array/);
  assert.throws(
    () => finalizeAuthenticatedV115AssistantRecord([], { content: '', persist() {} }),
    /non-empty array/,
  );
});
