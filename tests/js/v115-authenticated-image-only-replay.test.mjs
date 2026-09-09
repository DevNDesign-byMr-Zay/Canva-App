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

function setup() {
  const actions = [];
  const persisted = [];
  const scroll = element('div');
  const chatInner = element('div');
  scroll.appendChild(chatInner);

  const renderers = createAuthenticatedV115MessageRenderers({
    document: { createElement: element },
    renderContent(_role, content, target) {
      target.rendered = content;
    },
    setAvatarSource() {},
    mountAssistantActions(root, wrap, restored) {
      actions.push([root, wrap, restored]);
      return { root, wrap, restored };
    },
    deriveSources() {
      return [];
    },
    persistMessage(message) {
      persisted.push(message);
    },
    getPersistedMessages() {
      return persisted;
    },
    persistConversation() {},
  });

  return { renderers, chatInner, actions, persisted };
}

test('restored generated-image assistant messages suppress the normal action row', () => {
  const state = setup();

  const handle = state.renderers.renderPersistedAssistantMessage(
    { role: 'assistant', content: 'Generated image for:\n\n**A moonlit skyline**' },
    { chatInner: state.chatInner },
  );

  assert.equal(handle.message.className, 'msg assistant image-only-msg');
  assert.equal(handle.assistantActions, undefined);
  assert.deepEqual(state.actions, []);
  assert.deepEqual(state.persisted, []);
});

test('restored bold generated-image marker uses the same image-only branch', () => {
  const state = setup();

  const handle = state.renderers.renderPersistedAssistantMessage(
    { role: 'assistant', content: '**Generated image for:** neon poster' },
    { chatInner: state.chatInner },
  );

  assert.equal(handle.message.className, 'msg assistant image-only-msg');
  assert.deepEqual(state.actions, []);
});

test('ordinary restored assistant messages still mount their action row', () => {
  const state = setup();

  const handle = state.renderers.renderPersistedAssistantMessage(
    { role: 'assistant', content: 'Regular assistant response' },
    { chatInner: state.chatInner },
  );

  assert.equal(handle.message.className, 'msg assistant');
  assert.equal(state.actions.length, 1);
  assert.equal(state.actions[0][2], true);
});
