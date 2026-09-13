import { validateDisplayProfile } from './display-profiles.mjs';

const EXPORT_SCHEMA = 'canva.holographic-export.v1';

export function exportHolographicScene(scene, { format = 'json', target = 'simulator', displayProfile = 'simulator' } = {}) {
  if (!scene || scene.schema !== 'holo.scene.v1') throw new TypeError('A holo.scene.v1 scene is required.');
  if (format !== 'json') throw new TypeError(`Unsupported holographic export format: ${format}`);
  const normalizedTarget = typeof target === 'string' ? target.trim() : '';
  if (!normalizedTarget) throw new TypeError('A holographic export target is required.');
  const profile = validateDisplayProfile({ target: normalizedTarget, displayProfile });

  const payload = Object.freeze({
    schema: EXPORT_SCHEMA,
    sourceSchema: scene.schema,
    target: normalizedTarget,
    displayProfile: profile.id,
    displayProfileSchema: profile.schema,
    capabilities: profile.capabilities,
    scene,
  });

  return Object.freeze({
    format,
    mimeType: 'application/json',
    filename: `${scene.id}.holo.json`,
    payload,
    content: JSON.stringify(payload),
  });
}
