import test from 'node:test';
import assert from 'node:assert/strict';

import { createAuthenticatedV115MessageRenderers } from '../../runtime/v115-authenticated-message-renderer.mjs';

function element(tagName) {
  return {
    tagName,
    className: '',
    children: [],
    parentElement: null,
    scrollTop: 0,
    scrollHeight: 0,
    appendChild(child) {
      child.parentElement = this;
      this.children.push(child);
      this.scrollHeight = this.children.length * 10;
      return child;
    },
  };
}

function documentRef() {
  return {
    createElement(tagName) {
      return element(tagName);
    },
  };
}

function setup(wireRestoredGeneratedImageCard) {
  const chatInner = element('div');
  let calls = 0;
  const renderers = createAuthenticatedV115MessageRenderers({
    document: documentRef(),
    renderContent(role, content, target) {
      target.rendered = content;
    },
    setAvatarSource() {},
    wireRestoredGeneratedImageCard(message) {
      calls += 1;
      wireRestoredGeneratedImageCard(message, calls);
    },
  });
  return { chatInner, renderers, get calls() { return calls; } };
}

test('restored generated-image helper failure does not poison the next replayed message', () => {
  const state = setup((message, calls) => {
    if (calls === 1) throw new Error('stale image helper');
    message.rewired = true;
  });

  const first = state.renderers.renderPersistedAssistantMessage(
    { role: 'assistant', content: 'Generated image for: first' },
    { chatInner: state.chatInner },
  );
  const second = state.renderers.renderPersistedAssistantMessage(
    { role: 'assistant', content: 'Generated image for: second' },
    { chatInner: state.chatInner },
  );

  assert.equal(first.message.className, 'msg assistant image-only-msg');
  assert.equal(first.message.rewired, undefined);
  assert.equal(second.message.className, 'msg assistant image-only-msg');
  assert.equal(second.message.rewired, true);
  assert.equal(state.calls, 2);
  assert.equal(state.chatInner.children.length, 2);
});
