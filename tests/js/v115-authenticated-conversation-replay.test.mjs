import test from 'node:test';
import assert from 'node:assert/strict';

import { replayAuthenticatedV115Conversation } from '../../runtime/v115-authenticated-conversation-replay.mjs';

test('replay helper requires a records array', () => {
  assert.throws(() => replayAuthenticatedV115Conversation(null), /records must be an array/);
});
