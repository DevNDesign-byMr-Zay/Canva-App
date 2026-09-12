const EXPORT_SCHEMA = 'canva.holographic-export.v1';

export function exportHolographicScene(scene, { format = 'json', target = 'simulator' } = {}) {
  if (!scene || scene.schema !== 'holo.scene.v1') throw new TypeError('A holo.scene.v1 scene is required.');
  if (format !== 'json') throw new TypeError(`Unsupported holographic export format: ${format}`);
  if (typeof target !== 'string' || !target.trim()) throw new TypeError('A holographic export target is required.');

  const payload = Object.freeze({
    schema: EXPORT_SCHEMA,
    sourceSchema: scene.schema,
    target,
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
