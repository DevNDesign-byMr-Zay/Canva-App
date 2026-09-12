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
  const media = [];
  const persisted = [];
  const rewired = [];
  const scroll = element('div');
  const chatInner = element('div');
  scroll.appendChild(chatInner);

  const renderers = createAuthenticatedV115MessageRenderers({
    document: {
      createElement(tagName) {
        return element(tagName);
      },
    },
    renderContent(_role, content, target) {
      target.rendered = content;
    },
    setAvatarSource() {},
    mountAssistantActions(root, wrap, restored) {
      const actionRow = { root, wrap, restored };
      actions.push(actionRow);
      return actionRow;
    },
    mountAssistantMedia(actionRow, payload) {
      media.push([actionRow, payload]);
    },
    wireRestoredGeneratedImageCard(message) {
      rewired.push(message);
    },
    persistMessage(message) {
      persisted.push(message);
    },
    getPersistedMessages() {
      return persisted;
    },
    persistConversation() {},
  });

  return { renderers, chatInner, actions, media, persisted, rewired };
}

test('replays structured persisted v115 assistant media without re-persisting', () => {
  const state = setup();
  const stored = {
    role: 'assistant',
    content: 'Media answer',
    media: {
      images: [{ url: 'https://example.test/image.png' }],
      videos: [{ url: 'https://example.test/video.mp4' }],
    },
    images: [{ url: 'https://example.test/legacy.png' }],
  };

  state.renderers.renderPersistedAssistantMessage(stored, { chatInner: state.chatInner });

  assert.deepEqual(state.persisted, []);
  assert.equal(state.media.length, 1);
  assert.deepEqual(state.media[0][1], stored.media);
});

test('replays legacy persisted v115 images when structured media is absent', () => {
  const state = setup();
  const legacyImages = [{ url: 'https://example.test/legacy.png' }];

  state.renderers.renderPersistedAssistantMessage(
    { role: 'assistant', content: 'Legacy media', images: legacyImages },
    { chatInner: state.chatInner },
  );

  assert.deepEqual(state.persisted, []);
  assert.equal(state.media.length, 1);
  assert.deepEqual(state.media[0][1], { images: legacyImages, videos: [] });
});

test('structured empty media does not fall through to legacy images', () => {
  const state = setup();

  state.renderers.renderPersistedAssistantMessage(
    {
      role: 'assistant',
      content: 'Empty structured media',
      media: { images: [], videos: [] },
      images: [{ url: 'https://example.test/legacy.png' }],
    },
    { chatInner: state.chatInner },
  );

  assert.deepEqual(state.persisted, []);
  assert.deepEqual(state.media, []);
});

test('preserves v115 legacy fallback when media object has no structured arrays', () => {
  const state = setup();
  const legacyImages = [{ url: 'https://example.test/preserved-fallback.png' }];

  state.renderers.renderPersistedAssistantMessage(
    {
      role: 'assistant',
      content: 'Preserved empty media-object fallback',
      media: {},
      images: legacyImages,
    },
    { chatInner: state.chatInner },
  );

  assert.deepEqual(state.persisted, []);
  assert.equal(state.media.length, 1);
  assert.deepEqual(state.media[0][1], { images: legacyImages, videos: [] });
  assert.deepEqual(state.rewired, []);
});

test('restored text with multiple images stays on the normal mixed-media replay path', () => {
  const state = setup();
  const stored = {
    role: 'assistant',
    content: 'Two generated options with comparison notes.',
    media: {
      images: [
        { url: 'https://example.test/first.png' },
        { url: 'https://example.test/second.png' },
      ],
      videos: [],
    },
  };

  const handle = state.renderers.renderPersistedAssistantMessage(stored, {
    chatInner: state.chatInner,
  });

  assert.equal(handle.message.className, 'msg assistant');
  assert.equal(state.actions.length, 1);
  assert.equal(state.actions[0].restored, true);
  assert.equal(state.media.length, 1);
  assert.deepEqual(state.media[0][1], stored.media);
  assert.deepEqual(state.rewired, []);
  assert.deepEqual(state.persisted, []);
});
