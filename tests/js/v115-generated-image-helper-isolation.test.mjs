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
      this.scrollHeight = this.children.length;
      return child;
    },
  };
}

test('a failed restored image-card helper does not poison the next restored message', () => {
  let attempts = 0;
  const wired = [];
  const scroll = element('div');
  const chatInner = element('div');
  scroll.appendChild(chatInner);

  const renderers = createAuthenticatedV115MessageRenderers({
    document: { createElement: (tagName) => element(tagName) },
    renderContent(_role, content, target) {
      target.rendered = content;
    },
    setAvatarSource() {},
    wireRestoredGeneratedImageCard(message) {
      attempts += 1;
      if (attempts === 1) throw new Error('helper failure');
      wired.push(message.rendered);
    },
  });

  renderers.renderPersistedAssistantMessage(
    { role: 'assistant', content: '**Generated image for:** first' },
    { chatInner },
  );
  renderers.renderPersistedAssistantMessage(
    { role: 'assistant', content: '**Generated image for:** second' },
    { chatInner },
  );

  assert.equal(attempts, 2);
  assert.equal(chatInner.children.length, 2);
  assert.deepEqual(wired, ['**Generated image for:** second']);
});
