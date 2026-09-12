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

function setup({ wireRestoredGeneratedImageCard } = {}) {
  const actions = [];
  const persisted = [];
  const rewired = [];
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
    ...(wireRestoredGeneratedImageCard
      ? { wireRestoredGeneratedImageCard }
      : {
          wireRestoredGeneratedImageCard(message) {
            rewired.push(message);
          },
        }),
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

  return { renderers, chatInner, actions, persisted, rewired };
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

test('restored generated-image detection trims persisted content before matching', () => {
  const state = setup();

  const handle = state.renderers.renderPersistedAssistantMessage(
    { role: 'assistant', content: '\n  Generated image for:\n\n**Trimmed skyline**' },
    { chatInner: state.chatInner },
  );

  assert.equal(handle.message.className, 'msg assistant image-only-msg');
  assert.deepEqual(state.actions, []);
  assert.deepEqual(state.persisted, []);
});

test('restored assistant replay rewires generated-image cards after image-only classification', () => {
  let seenClassName = null;
  const state = setup({
    wireRestoredGeneratedImageCard(message) {
      seenClassName = message.className;
    },
  });

  const handle = state.renderers.renderPersistedAssistantMessage(
    { role: 'assistant', content: 'Generated image for:\n\n**Rewired skyline**' },
    { chatInner: state.chatInner },
  );

  assert.equal(seenClassName, 'msg assistant image-only-msg');
  assert.equal(handle.message.className, 'msg assistant image-only-msg');
  assert.deepEqual(state.persisted, []);
});

test('restored generated-image helper failures do not abort replay', () => {
  const state = setup({
    wireRestoredGeneratedImageCard() {
      throw new Error('card helper failed');
    },
  });

  const handle = state.renderers.renderPersistedAssistantMessage(
    { role: 'assistant', content: 'Generated image for:\n\n**Still restored**' },
    { chatInner: state.chatInner },
  );

  assert.equal(handle.message.rendered, 'Generated image for:\n\n**Still restored**');
  assert.equal(state.chatInner.children.at(-1), handle.wrap);
  assert.deepEqual(state.persisted, []);
});

test('ordinary restored assistant messages keep actions and skip generated-image rewiring', () => {
  const state = setup();

  const handle = state.renderers.renderPersistedAssistantMessage(
    { role: 'assistant', content: 'Regular assistant response' },
    { chatInner: state.chatInner },
  );

  assert.equal(handle.message.className, 'msg assistant');
  assert.equal(state.actions.length, 1);
  assert.equal(state.actions[0][2], true);
  assert.deepEqual(state.rewired, []);
});

test('live assistant content that resembles the restored image marker stays on the live path', () => {
  const state = setup();

  const handle = state.renderers.beginAssistantMessage({ chatInner: state.chatInner });
  state.renderers.appendAssistantDelta(handle, 'Generated image for:\n\n**Live skyline**');

  assert.equal(handle.message.className, 'msg assistant');
  assert.deepEqual(state.rewired, []);
  assert.equal(state.persisted.length, 1);
  assert.equal(state.persisted[0].role, 'assistant');
});
