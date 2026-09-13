import test from 'node:test';
import assert from 'node:assert/strict';

import { snapshotAuthenticatedV115Attachments } from '../../runtime/v115-authenticated-message-record.mjs';

test('rejects null and array attachment entries before reading metadata', () => {
  assert.throws(
    () => snapshotAuthenticatedV115Attachments([null]),
    /attachments\[0\] must be an object/,
  );
  assert.throws(
    () => snapshotAuthenticatedV115Attachments([['not-an-attachment']]),
    /attachments\[0\] must be an object/,
  );
});
