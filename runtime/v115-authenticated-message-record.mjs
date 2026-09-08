function requireRole(role) {
  if (role !== 'user' && role !== 'assistant') {
    throw new TypeError('role must be user or assistant');
  }
  return role;
}

/**
 * Snapshot the exact attachment metadata shape used by the authenticated v115
 * submit path before a user message is persisted. File bytes stay outside the
 * conversation record.
 */
export function snapshotAuthenticatedV115Attachments(attachments = []) {
  if (!Array.isArray(attachments)) throw new TypeError('attachments must be an array');
  return attachments.map((attachment = {}) => ({
    name: attachment.name,
    type: attachment.type,
    size: attachment.size,
  }));
}

/**
 * Build the mechanically authenticated v115 persisted message shape from `Mn`:
 * `{ role, content }`, optional `attachments`, and optional `sources + engine`.
 *
 * Values are preserved rather than normalized so maintained code cannot invent
 * historical semantics that are not present in the v115 artifact.
 */
export function createAuthenticatedV115MessageRecord(role, content, metadata = {}) {
  requireRole(role);
  const record = { role, content };

  if (metadata.attachments) record.attachments = metadata.attachments;
  if (metadata.sources) {
    record.sources = metadata.sources;
    record.engine = metadata.engine || null;
  }

  return record;
}

/**
 * Reproduce the authenticated v115 post-stream persistence boundary. The live
 * artifact first persists an empty assistant shell, then mutates that same last
 * assistant record after streaming completes before persisting the conversation.
 *
 * Source discovery remains external to this adapter: callers pass only source
 * metadata and engine values they can mechanically establish.
 */
export function finalizeAuthenticatedV115AssistantRecord(
  messages,
  { content, sources = [], engine = null, persist } = {},
) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new TypeError('messages must be a non-empty array');
  }
  if (typeof content !== 'string') throw new TypeError('content must be a string');
  if (!Array.isArray(sources)) throw new TypeError('sources must be an array');
  if (typeof persist !== 'function') throw new TypeError('persist must be a function');

  const record = messages[messages.length - 1];
  if (!record || record.role !== 'assistant') {
    throw new Error('last persisted message must be assistant');
  }

  record.content = content;
  if (sources.length) {
    record.sources = sources;
    record.engine = engine;
  } else {
    delete record.sources;
    delete record.engine;
  }

  persist();
  return record;
}
