import test from 'node:test';
import assert from 'node:assert/strict';

import { snapshotAuthenticatedV115Attachments } from '../../runtime/v115-authenticated-message-record.mjs';

test('rejects a malformed attachment entry before producing a partial snapshot', () => {
  assert.throws(
    () => snapshotAuthenticatedV115Attachments([
      { name: 'brief.pdf', type: 'application/pdf', size: 2048 },
      null,
    ]),
    /attachments\[1\] must be an object/,
  );
});

test('rejects array attachment entries instead of treating them as metadata objects', () => {
  assert.throws(
    () => snapshotAuthenticatedV115Attachments([
      { name: 'brief.pdf', type: 'application/pdf', size: 2048 },
      [],
    ]),
    /attachments\[1\] must be an object/,
  );
});
