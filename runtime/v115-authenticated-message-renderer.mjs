function requireFunction(value, name) {
  if (typeof value !== 'function') throw new TypeError(`${name} must be a function`);
  return value;
}

function roleClass(role) {
  return role === 'user' ? 'user' : 'assistant';
}

/**
 * Maintained renderer adapter for the mechanically authenticated v115 main-chat
 * message boundary (`Mn` in the preserved artifact).
 *
 * The adapter preserves only the DOM structure that is directly evidenced by
 * v115: `.msg-wrap`, `.msg-avatar`, role-specific avatar/message classes, and
 * append-under-`#chatInner` ordering. Historical helpers for markdown/content
 * rendering, avatar resolution, attachments, action rows, and persistence stay
 * injected so this maintained surface does not invent their behavior.
 */
export function createAuthenticatedV115MessageRenderers({
  document: documentRef = globalThis.document,
  renderContent,
  setAvatarSource,
  mountAttachments,
  mountAssistantActions,
  persistMessage,
} = {}) {
  if (!documentRef || typeof documentRef.createElement !== 'function') {
    throw new TypeError('document.createElement must be available');
  }
  requireFunction(renderContent, 'renderContent');
  requireFunction(setAvatarSource, 'setAvatarSource');

  if (mountAttachments !== undefined) requireFunction(mountAttachments, 'mountAttachments');
  if (mountAssistantActions !== undefined) {
    requireFunction(mountAssistantActions, 'mountAssistantActions');
  }
  if (persistMessage !== undefined) requireFunction(persistMessage, 'persistMessage');

  function createMessage(chatInner, role, content = '', metadata = {}) {
    if (!chatInner || typeof chatInner.appendChild !== 'function') {
      throw new TypeError('chatInner must support appendChild');
    }

    const normalizedRole = roleClass(role);
    const wrap = documentRef.createElement('div');
    wrap.className = `msg-wrap ${normalizedRole}`;

    const avatar = documentRef.createElement('div');
    avatar.className = `msg-avatar msg-avatar-${normalizedRole}`;
    const image = documentRef.createElement('img');
    setAvatarSource(image, normalizedRole);
    avatar.appendChild(image);

    const message = documentRef.createElement('div');
    message.className = `msg ${normalizedRole}`;
    renderContent(normalizedRole, content, message);

    wrap.appendChild(avatar);
    wrap.appendChild(message);
    chatInner.appendChild(wrap);

    if (normalizedRole === 'user' && metadata.attachments?.length && mountAttachments) {
      mountAttachments(chatInner, message, metadata.attachments);
    }
    if (normalizedRole === 'assistant' && mountAssistantActions) {
      mountAssistantActions(chatInner, wrap, false);
    }

    const scrollContainer = chatInner.parentElement;
    if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;

    return { wrap, avatar, image, message, role: normalizedRole, content };
  }

  return {
    renderUserMessage(prompt, { chatInner }) {
      const handle = createMessage(chatInner, 'user', prompt);
      persistMessage?.({ role: 'user', content: prompt });
      return handle;
    },

    beginAssistantMessage({ chatInner }) {
      return createMessage(chatInner, 'assistant', '');
    },

    appendAssistantDelta(handle, delta) {
      if (!handle?.message || handle.role !== 'assistant') {
        throw new TypeError('assistant message handle is required');
      }
      handle.content += String(delta ?? '');
      renderContent('assistant', handle.content, handle.message);
    },

    finishAssistantMessage(handle, result = {}) {
      if (!handle?.message || handle.role !== 'assistant') {
        throw new TypeError('assistant message handle is required');
      }
      const content = typeof result.content === 'string' ? result.content : handle.content;
      handle.content = content;
      renderContent('assistant', content, handle.message);
      persistMessage?.({ role: 'assistant', content });
      return handle;
    },

    renderError(error, context = {}) {
      const handle = context.assistantHandle;
      if (!handle?.message || handle.role !== 'assistant') return;
      if (context.streamedContent) {
        handle.content = context.streamedContent;
        renderContent('assistant', handle.content, handle.message);
      }
      handle.error = error;
    },
  };
}
