import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AUTHENTICATED_V115_MESSAGE_ACTIONS,
  AUTHENTICATED_V115_MORE_ACTIONS,
  createAuthenticatedV115MessageActions,
} from '../../runtime/v115-authenticated-message-actions.mjs';

function classList(initial = []) {
  const values = new Set(initial);
  return {
    add: (value) => values.add(value),
    remove: (value) => values.delete(value),
    toggle(value) {
      if (values.has(value)) {
        values.delete(value);
        return false;
      }
      values.add(value);
      return true;
    },
    contains: (value) => values.has(value),
  };
}

function createActions(overrides = {}) {
  return createAuthenticatedV115MessageActions({
    clipboardWrite: async () => {},
    schedule: (callback) => callback(),
    getPreviousUserText: () => 'original user prompt',
    setPrompt: () => {},
    submit: async () => {},
    ...overrides,
  });
}

test('authenticated action surface is limited to the promoted gn behavior', () => {
  assert.deepEqual(AUTHENTICATED_V115_MESSAGE_ACTIONS, [
    'copy',
    'share',
    'like',
    'dislike',
    'regen',
  ]);
  assert.deepEqual(AUTHENTICATED_V115_MORE_ACTIONS, ['doublecheck', 'report']);
});

test('copy writes the assistant text and uses the authenticated transient state', async () => {
  const writes = [];
  const transitions = [];
  const button = { classList: classList() };
  const actions = createActions({
    clipboardWrite: async (text) => writes.push(text),
    schedule: (callback, delay) => {
      transitions.push({ delay, active: button.classList.contains('is-on') });
      callback();
    },
  });

  const result = await actions.perform({ action: 'copy', text: 'answer', button });

  assert.deepEqual(writes, ['answer']);
  assert.deepEqual(transitions, [{ delay: 900, active: true }]);
  assert.equal(button.classList.contains('is-on'), false);
  assert.deepEqual(result, { handled: true, action: 'copy' });
});

test('share uses native share and falls back to clipboard when unavailable', async () => {
  const shares = [];
  const writes = [];
  const native = createActions({
    share: async (payload) => shares.push(payload),
    clipboardWrite: async (text) => writes.push(text),
  });

  await native.perform({ action: 'share', text: 'native answer' });
  assert.deepEqual(shares, [{ text: 'native answer' }]);
  assert.deepEqual(writes, []);

  const fallback = createActions({ clipboardWrite: async (text) => writes.push(text) });
  await fallback.perform({
    action: 'share',
    text: 'fallback answer',
    button: { classList: classList() },
  });
  assert.deepEqual(writes, ['fallback answer']);
});

test('copy contains clipboard rejection without applying transient UI state', async () => {
  const button = { classList: classList() };
  const actions = createActions({
    clipboardWrite: async () => {
      throw new Error('clipboard denied');
    },
  });

  const result = await actions.perform({ action: 'copy', text: 'answer', button });

  assert.deepEqual(result, { handled: true, action: 'copy' });
  assert.equal(button.classList.contains('is-on'), false);
});

test('share contains native and fallback browser-action rejections', async () => {
  const native = createActions({
    share: async () => {
      throw new Error('share cancelled');
    },
  });
  await assert.doesNotReject(() => native.perform({ action: 'share', text: 'answer' }));

  const button = { classList: classList() };
  const fallback = createActions({
    clipboardWrite: async () => {
      throw new Error('clipboard denied');
    },
  });
  const result = await fallback.perform({ action: 'share', text: 'answer', button });

  assert.deepEqual(result, { handled: true, action: 'share' });
  assert.equal(button.classList.contains('is-on'), false);
});

test('like and dislike remain mutually exclusive within the action row', async () => {
  const like = { classList: classList() };
  const dislike = { classList: classList(['is-on']) };
  const row = {
    querySelector(selector) {
      return selector.includes('dislike') ? dislike : like;
    },
  };
  const actions = createActions();

  await actions.perform({ action: 'like', button: like, row });
  assert.equal(like.classList.contains('is-on'), true);
  assert.equal(dislike.classList.contains('is-on'), false);
});

test('regen restores the preceding user prompt and reuses the existing submit path', async () => {
  const prompts = [];
  let submissions = 0;
  const wrap = { id: 'assistant-wrap' };
  const actions = createActions({
    getPreviousUserText: (candidate) => {
      assert.equal(candidate, wrap);
      return 'retry this prompt';
    },
    setPrompt: (prompt) => prompts.push(prompt),
    submit: async () => {
      submissions += 1;
    },
  });

  const result = await actions.perform({ action: 'regen', wrap });
  assert.deepEqual(prompts, ['retry this prompt']);
  assert.equal(submissions, 1);
  assert.equal(result.submitted, true);
});

test('double-check seeds the authenticated cross-reference prompt and submits', async () => {
  const prompts = [];
  let submissions = 0;
  const actions = createActions({
    setPrompt: (prompt) => prompts.push(prompt),
    submit: async () => {
      submissions += 1;
    },
  });

  const result = await actions.performMore({
    action: 'doublecheck',
    text: 'original assistant answer',
  });

  assert.equal(
    prompts[0],
    'Double-check the previous response for accuracy. If anything is off, correct it and cite sources when possible.\n\nResponse to check:\noriginal assistant answer',
  );
  assert.equal(submissions, 1);
  assert.equal(result.handled, true);
  assert.equal(result.submitted, true);
});

test('report seeds the authenticated issue prompt and reuses submit', async () => {
  const prompts = [];
  let submissions = 0;
  const actions = createActions({
    setPrompt: (prompt) => prompts.push(prompt),
    submit: async () => {
      submissions += 1;
    },
  });

  const result = await actions.performMore({
    action: 'report',
    text: 'original assistant answer',
  });

  assert.equal(
    prompts[0],
    'Report: I think there may be an issue with the previous response.\n\nDescribe the issue briefly and suggest a fix.\n\nResponse:\noriginal assistant answer',
  );
  assert.equal(submissions, 1);
  assert.equal(result.handled, true);
  assert.equal(result.submitted, true);
});

test('delegated click resolves the authenticated action row and assistant text', async () => {
  const writes = [];
  const assistant = { innerText: ' streamed assistant answer ' };
  const wrap = {
    classList: classList(['msg-wrap']),
    querySelector: (selector) => (selector === '.msg.assistant' ? assistant : null),
  };
  const row = { previousElementSibling: wrap };
  const button = {
    dataset: { act: 'copy' },
    classList: classList(),
    closest: (selector) => (selector === '.msg-actions-row' ? row : null),
  };
  let stopped = false;
  const actions = createActions({ clipboardWrite: async (text) => writes.push(text) });

  const result = await actions.handleClick({
    target: { closest: (selector) => (selector === '.act-btn' ? button : null) },
    stopPropagation: () => {
      stopped = true;
    },
  });

  assert.equal(stopped, true);
  assert.deepEqual(writes, ['streamed assistant answer']);
  assert.equal(result.handled, true);
});

test('delegated More click promotes only authenticated prompt items', async () => {
  const prompts = [];
  let submissions = 0;
  const assistant = { textContent: 'answer to verify' };
  const wrap = {
    classList: classList(['msg-wrap']),
    querySelector: (selector) => (selector === '.msg.assistant' ? assistant : null),
  };
  const row = { previousElementSibling: wrap };
  const item = {
    dataset: { item: 'report' },
    closest: (selector) => (selector === '.msg-actions-row' ? row : null),
  };
  const actions = createActions({
    setPrompt: (prompt) => prompts.push(prompt),
    submit: async () => {
      submissions += 1;
    },
  });

  const result = await actions.handleClick({
    target: {
      closest(selector) {
        if (selector === '.act-item') return item;
        return null;
      },
    },
    stopPropagation() {},
  });

  assert.equal(result.action, 'report');
  assert.equal(submissions, 1);
  assert.match(prompts[0], /Response:\nanswer to verify$/);
  assert.deepEqual(
    await actions.performMore({ action: 'export', text: 'nope' }),
    { handled: false },
  );
});
