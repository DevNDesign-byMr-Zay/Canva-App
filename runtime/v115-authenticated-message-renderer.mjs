import {
  createAuthenticatedV115MessageRecord,
  finalizeAuthenticatedV115AssistantRecord,
} from './v115-authenticated-message-record.mjs';

function requireFunction(value, name) {
  if (typeof value !== 'function') throw new TypeError(`${name} must be a function`);
  return value;
}

function roleClass(role) {
  return role === 'user' ? 'user' : 'assistant';
}

function isRestoredImageOnlyAssistant(content, metadata) {
  if (metadata.restored !== true || typeof content !== 'string') return false;
  const trimmed = content.trim();
  return trimmed.startsWith('Generated image for:')
    || trimmed.startsWith('**Generated image for:**');
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
  mountAssistantSources,
  mountAssistantMedia,
  deriveAttachments,
  deriveSources,
  persistMessage,
  getPersistedMessages,
  persistConversation,
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
  if (mountAssistantSources !== undefined) {
    requireFunction(mountAssistantSources, 'mountAssistantSources');
  }
  if (mountAssistantMedia !== undefined) {
    requireFunction(mountAssistantMedia, 'mountAssistantMedia');
  }
  if (deriveAttachments !== undefined) requireFunction(deriveAttachments, 'deriveAttachments');
  if (deriveSources !== undefined) requireFunction(deriveSources, 'deriveSources');
  if (persistMessage !== undefined) requireFunction(persistMessage, 'persistMessage');
  if (getPersistedMessages !== undefined) {
    requireFunction(getPersistedMessages, 'getPersistedMessages');
  }
  if (persistConversation !== undefined) {
    requireFunction(persistConversation, 'persistConversation');
  }

  const usesAuthenticatedAssistantFinalization =
    getPersistedMessages !== undefined || persistConversation !== undefined;
  if (usesAuthenticatedAssistantFinalization) {
    requireFunction(persistMessage, 'persistMessage');
    requireFunction(getPersistedMessages, 'getPersistedMessages');
    requireFunction(persistConversation, 'persistConversation');
  }

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

    const imageOnlyAssistant = normalizedRole === 'assistant'
      && isRestoredImageOnlyAssistant(content, metadata);
    if (imageOnlyAssistant) message.className += ' image-only-msg';

    wrap.appendChild(avatar);
    wrap.appendChild(message);
    chatInner.appendChild(wrap);

    if (normalizedRole === 'user' && metadata.attachments?.length && mountAttachments) {
      mountAttachments(chatInner, message, metadata.attachments);
    }

    let assistantActions;
    if (normalizedRole === 'assistant' && !imageOnlyAssistant && mountAssistantActions) {
      assistantActions = mountAssistantActions(chatInner, wrap, metadata.restored === true);
      if (metadata.sources?.length && assistantActions && mountAssistantSources) {
        mountAssistantSources(assistantActions, metadata.sources, metadata.engine);
      }
      if (
        assistantActions
        && mountAssistantMedia
        && (metadata.media?.images?.length || metadata.media?.videos?.length)
      ) {
        mountAssistantMedia(assistantActions, metadata.media);
      }
    }

    const scrollContainer = chatInner.parentElement;
    if (scrollContainer) scrollContainer.scrollTop = scrollContainer.scrollHeight;

    return { wrap, avatar, image, message, role: normalizedRole, content, assistantActions };
  }

  function ensurePersistedAssistantShell(handle) {
    if (!usesAuthenticatedAssistantFinalization || handle.persistedRecord) return;
    const record = createAuthenticatedV115MessageRecord('assistant', '');
    persistMessage(record);
    handle.persistedRecord = record;
  }

  return {
    renderUserMessage(prompt, { chatInner, attachments } = {}) {
      const metadata = attachments ? { attachments } : {};
      const handle = createMessage(chatInner, 'user', prompt, metadata);
      persistMessage?.(createAuthenticatedV115MessageRecord('user', prompt, metadata));
      return handle;
    },

    renderPersistedUserMessage(record, { chatInner } = {}) {
      if (!record || record.role !== 'user' || typeof record.content !== 'string') {
        throw new TypeError('persisted user message record is required');
      }
      const attachments = Array.isArray(record.attachments)
        ? record.attachments
        : deriveAttachments?.(record.content);
      if (attachments !== undefined && !Array.isArray(attachments)) {
        throw new TypeError('deriveAttachments must return an array');
      }
      return createMessage(
        chatInner,
        'user',
        record.content,
        attachments?.length ? { attachments } : {},
      );
    },

    renderPersistedAssistantMessage(record, { chatInner } = {}) {
      if (!record || record.role !== 'assistant' || typeof record.content !== 'string') {
        throw new TypeError('persisted assistant message record is required');
      }
      const storedSources = Array.isArray(record.sources) && record.sources.length
        ? record.sources
        : null;
      const sources = storedSources || deriveSources?.(record.content);
      if (sources !== undefined && !Array.isArray(sources)) {
        throw new TypeError('deriveSources must return an array');
      }
      const engine = record.engine || (storedSources ? 'web' : 'cited');

      let media;
      if (
        record.media
        && (Array.isArray(record.media.images) || Array.isArray(record.media.videos))
      ) {
        media = {
          images: Array.isArray(record.media.images) ? record.media.images : [],
          videos: Array.isArray(record.media.videos) ? record.media.videos : [],
        };
      } else if (Array.isArray(record.images) && record.images.length) {
        media = { images: record.images, videos: [] };
      }

      return createMessage(chatInner, 'assistant', record.content, {
        restored: true,
        ...(sources?.length ? { sources, engine } : {}),
        ...(media ? { media } : {}),
      });
    },

    beginAssistantMessage({ chatInner }) {
      return createMessage(chatInner, 'assistant', '');
    },

    appendAssistantDelta(handle, delta) {
      if (!handle?.message || handle.role !== 'assistant') {
        throw new TypeError('assistant message handle is required');
      }
      ensurePersistedAssistantShell(handle);
      handle.content += String(delta ?? '');
      renderContent('assistant', handle.content, handle.message);
    },

    finishAssistantMessage(handle, result = {}) {
      if (!handle?.message || handle.role !== 'assistant') {
        throw new TypeError('assistant message handle is required');
      }
      ensurePersistedAssistantShell(handle);
      const content = typeof result.content === 'string' ? result.content : handle.content;
      handle.content = content;
      renderContent('assistant', content, handle.message);

      if (usesAuthenticatedAssistantFinalization) {
        const messages = getPersistedMessages();
        if (!Array.isArray(messages)) {
          throw new TypeError('getPersistedMessages must return an array');
        }
        if (messages[messages.length - 1] !== handle.persistedRecord) {
          throw new Error('persisted assistant shell must remain the last message');
        }
        handle.persistedRecord = finalizeAuthenticatedV115AssistantRecord(messages, {
          content,
          sources: Array.isArray(result.sources) ? result.sources : [],
          engine: result.engine ?? null,
          persist: persistConversation,
        });
      } else {
        persistMessage?.(
          createAuthenticatedV115MessageRecord('assistant', content, {
            ...(result.sources ? { sources: result.sources } : {}),
            ...(result.engine ? { engine: result.engine } : {}),
          }),
        );
      }
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
