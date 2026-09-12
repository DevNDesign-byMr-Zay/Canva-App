import assert from 'node:assert/strict';
import test from 'node:test';
import { createCss3dMountAdapter } from '../../src/holographic/mount.mjs';
import { HOLO_RENDER_SCHEMA } from '../../src/holographic/renderer.mjs';

function node() {
  return {
    style: {},
    children: [],
    parentNode: null,
    setAttribute() {},
    appendChild(child) {
      if (child.parentNode) child.parentNode.removeChild(child);
      child.parentNode = this;
      this.children.push(child);
    },
    removeChild(child) {
      this.children = this.children.filter((item) => item !== child);
      child.parentNode = null;
    },
    replaceChildren(...children) {
      for (const child of [...this.children]) this.removeChild(child);
      for (const child of children) this.appendChild(child);
    },
    remove() {
      if (this.parentNode) this.parentNode.removeChild(this);
    },
  };
}

const document = { createElement: node };
const model = (ids) => ({
  schema: HOLO_RENDER_SCHEMA,
  sceneId: 'demo',
  viewportStyle: {},
  cameraStyle: {},
  layers: ids.map((id) => ({ id, attributes: {}, style: {} })),
});

test('keeps keyed layers stable across render updates', () => {
  const root = node();
  const adapter = createCss3dMountAdapter({ document });
  adapter.render(root, model(['a', 'b']));
  const originalB = root.children[0].children[1];
  const receipt = adapter.render(root, model(['b', 'c']));
  assert.equal(root.children[0].children[0], originalB);
  assert.deepEqual(receipt.reused, ['b']);
  assert.deepEqual(receipt.created, ['c']);
  assert.deepEqual(receipt.removed, ['a']);
});
