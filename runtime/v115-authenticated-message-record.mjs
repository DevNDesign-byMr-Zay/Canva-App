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
