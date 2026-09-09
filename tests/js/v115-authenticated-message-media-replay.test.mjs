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
  const media = [];
  const persisted = [];
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
      return { root, wrap, restored };
    },
    mountAssistantMedia(actionRow, payload) {
      media.push([actionRow, payload]);
    },
    persistMessage(message) {
      persisted.push(message);
    },
    getPersistedMessages() {
      return persisted;
    },
    persistConversation() {},
  });

  return { renderers, chatInner, media, persisted };
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
