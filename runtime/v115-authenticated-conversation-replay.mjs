function requireFunction(value, name) {
  if (typeof value !== 'function') throw new TypeError(`${name} must be a function`);
  return value;
}

function resetChatInner(chatInner) {
  if (!chatInner || typeof chatInner.appendChild !== 'function') {
    throw new TypeError('chatInner must support appendChild');
  }

  if (typeof chatInner.replaceChildren === 'function') {
    chatInner.replaceChildren();
    return;
  }

  if ('innerHTML' in chatInner) {
    chatInner.innerHTML = '';
    return;
  }

  throw new TypeError('chatInner must support replaceChildren() or innerHTML reset');
}

/**
 * Maintained conversation-level replay boundary for authenticated v115.
 *
 * The preserved Bn() path clears #chatInner before rebuilding persisted
 * messages. Keeping that reset at the replay boundary avoids duplicate DOM and
 * duplicate helper registration without inventing per-node idempotence state.
 * Individual message behavior remains delegated to the maintained renderers.
 */
export function replayAuthenticatedV115Conversation(
  records,
  { chatInner, renderers } = {},
) {
  if (!Array.isArray(records)) throw new TypeError('records must be an array');
  if (!renderers || typeof renderers !== 'object' || Array.isArray(renderers)) {
    throw new TypeError('renderers must be an object');
  }

  const renderPersistedUserMessage = requireFunction(
    renderers.renderPersistedUserMessage,
    'renderers.renderPersistedUserMessage',
  );
  const renderPersistedAssistantMessage = requireFunction(
    renderers.renderPersistedAssistantMessage,
    'renderers.renderPersistedAssistantMessage',
  );

  for (const [index, record] of records.entries()) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      throw new TypeError(`records[${index}] must be an object`);
    }

    if (record.role !== 'user' && record.role !== 'assistant') {
      throw new TypeError(`records[${index}].role must be user or assistant`);
    }
  }

  resetChatInner(chatInner);

  const handles = [];
  for (const record of records) {
    if (record.role === 'user') {
      handles.push(renderPersistedUserMessage(record, { chatInner }));
      continue;
    }
    handles.push(renderPersistedAssistantMessage(record, { chatInner }));
  }

  return handles;
}
