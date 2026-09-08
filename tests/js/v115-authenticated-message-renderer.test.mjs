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

function setup() {
  const renders = [];
  const avatars = [];
  const attachments = [];
  const actions = [];
  const persisted = [];
  let conversationPersists = 0;
  const scroll = element('div');
  const chatInner = element('div');
  scroll.appendChild(chatInner);

  const renderers = createAuthenticatedV115MessageRenderers({
    document: documentRef(),
    renderContent(role, content, target) {
      target.rendered = content;
      renders.push([role, content]);
    },
    setAvatarSource(image, role) {
      image.avatarRole = role;
      avatars.push(role);
    },
    mountAttachments(root, message, items) {
      attachments.push([root, message, items]);
    },
    mountAssistantActions(root, wrap, restored) {
      actions.push([root, wrap, restored]);
    },
    persistMessage(message) {
      persisted.push(message);
    },
    getPersistedMessages() {
      return persisted;
    },
    persistConversation() {
      conversationPersists += 1;
    },
  });

  return {
    renderers,
    chatInner,
    scroll,
    renders,
    avatars,
    attachments,
    actions,
    persisted,
    get conversationPersists() {
      return conversationPersists;
    },
  };
}

test('creates the authenticated v115 user message DOM shell in exact role order', () => {
  const { renderers, chatInner, persisted, avatars } = setup();

  const handle = renderers.renderUserMessage('Build ROARY', { chatInner });

  assert.equal(handle.wrap.className, 'msg-wrap user');
  assert.equal(handle.avatar.className, 'msg-avatar msg-avatar-user');
  assert.equal(handle.message.className, 'msg user');
  assert.deepEqual(handle.wrap.children, [handle.avatar, handle.message]);
  assert.equal(handle.avatar.children[0], handle.image);
  assert.equal(chatInner.children[0], handle.wrap);
  assert.equal(handle.message.rendered, 'Build ROARY');
  assert.deepEqual(avatars, ['user']);
  assert.deepEqual(persisted, [{ role: 'user', content: 'Build ROARY' }]);
});

test('streams assistant deltas and finalizes the same persisted assistant shell', () => {
  const state = setup();
  const { renderers, chatInner, persisted, actions } = state;

  const handle = renderers.beginAssistantMessage({ chatInner });
  assert.deepEqual(persisted, []);

  renderers.appendAssistantDelta(handle, 'RO');
  assert.deepEqual(persisted, [{ role: 'assistant', content: '' }]);
  const persistedShell = persisted[0];
  assert.equal(handle.persistedRecord, persistedShell);

  renderers.appendAssistantDelta(handle, 'ARY');
  renderers.finishAssistantMessage(handle, {
    content: 'ROARY',
    sources: [{ title: 'Runtime evidence' }],
    engine: 'authenticated-v115',
  });

  assert.equal(handle.wrap.className, 'msg-wrap assistant');
  assert.equal(handle.avatar.className, 'msg-avatar msg-avatar-assistant');
  assert.equal(handle.message.className, 'msg assistant');
  assert.equal(handle.message.rendered, 'ROARY');
  assert.equal(actions.length, 1);
  assert.equal(actions[0][2], false);
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0], persistedShell);
  assert.deepEqual(persisted[0], {
    role: 'assistant',
    content: 'ROARY',
    sources: [{ title: 'Runtime evidence' }],
    engine: 'authenticated-v115',
  });
  assert.equal(state.conversationPersists, 1);
});

test('successful empty response still persists and finalizes an assistant shell', () => {
  const state = setup();
  const { renderers, chatInner, persisted } = state;
  const handle = renderers.beginAssistantMessage({ chatInner });

  renderers.finishAssistantMessage(handle, { content: '' });

  assert.deepEqual(persisted, [{ role: 'assistant', content: '' }]);
  assert.equal(state.conversationPersists, 1);
});

test('pre-stream failure does not persist an empty assistant shell', () => {
  const state = setup();
  const { renderers, chatInner, persisted } = state;
  const handle = renderers.beginAssistantMessage({ chatInner });
  const error = new Error('request rejected');

  renderers.renderError(error, { assistantHandle: handle, streamedContent: '' });

  assert.deepEqual(persisted, []);
  assert.equal(state.conversationPersists, 0);
  assert.equal(handle.error, error);
});

test('fails closed if another persisted record displaces the authenticated assistant shell', () => {
  const state = setup();
  const { renderers, chatInner, persisted } = state;
  const handle = renderers.beginAssistantMessage({ chatInner });
  renderers.appendAssistantDelta(handle, 'RO');
  persisted.push({ role: 'user', content: 'unexpected write' });

  assert.throws(
    () => renderers.finishAssistantMessage(handle, { content: 'ROARY' }),
    /persisted assistant shell must remain the last message/,
  );
  assert.equal(state.conversationPersists, 0);
});

test('preserves partial assistant output when the request fails', () => {
  const { renderers, chatInner } = setup();
  const handle = renderers.beginAssistantMessage({ chatInner });

  renderers.appendAssistantDelta(handle, 'partial');
  const error = new Error('runtime unavailable');
  renderers.renderError(error, { assistantHandle: handle, streamedContent: 'partial' });

  assert.equal(handle.content, 'partial');
  assert.equal(handle.message.rendered, 'partial');
  assert.equal(handle.error, error);
});

test('keeps historical helper behavior injected instead of fabricating it', () => {
  assert.throws(
    () => createAuthenticatedV115MessageRenderers({ document: documentRef() }),
    /renderContent must be a function/,
  );
});
