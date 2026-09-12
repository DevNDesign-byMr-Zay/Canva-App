import test from 'node:test';
import assert from 'node:assert/strict';

import { replayAuthenticatedV115Conversation } from '../../runtime/v115-authenticated-conversation-replay.mjs';

function target() {
  return {
    children: [],
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    replaceChildren() {
      this.children = [];
    },
  };
}

function rendererSet() {
  const append = (record, { chatInner }) => {
    const handle = { role: record.role, content: record.content };
    chatInner.appendChild(handle);
    return handle;
  };
  return {
    renderPersistedUserMessage: append,
    renderPersistedAssistantMessage: append,
  };
}

test('replaying the same records clears the old tree before rebuilding', () => {
  const chatInner = target();
  const renderers = rendererSet();
  const records = [
    { role: 'user', content: 'hello' },
    { role: 'assistant', content: 'answer' },
  ];

  replayAuthenticatedV115Conversation(records, { chatInner, renderers });
  const firstNodes = [...chatInner.children];
  replayAuthenticatedV115Conversation(records, { chatInner, renderers });

  assert.equal(chatInner.children.length, 2);
  assert.notEqual(chatInner.children[0], firstNodes[0]);
  assert.notEqual(chatInner.children[1], firstNodes[1]);
  assert.deepEqual(chatInner.children.map((entry) => entry.content), ['hello', 'answer']);
});
