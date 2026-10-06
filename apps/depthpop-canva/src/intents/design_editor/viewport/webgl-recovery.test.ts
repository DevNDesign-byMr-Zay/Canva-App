// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import {
  bindWebGLRecovery,
  type WebGLRecoverySnapshot,
} from "./webgl-recovery";

function snapshot(overrides: Partial<WebGLRecoverySnapshot> = {}): WebGLRecoverySnapshot {
  return {
    sceneId: "scene-webgl",
    selectedObjectId: "person-01",
    currentTimeMs: 550,
    camera: {
      position: { x: 1, y: 2, z: 5 },
      target: { x: 0, y: 0, z: 0 },
      fov: 52,
    },
    wasPlaying: true,
    ...overrides,
  };
}

describe("WebGL recovery binding", () => {
  it("preserves canonical authored state across context loss and restore", () => {
    const target = document.createElement("canvas");
    const authored = snapshot();
    const onLost = vi.fn();
    const onRestored = vi.fn();

    bindWebGLRecovery(target, () => authored, { onLost, onRestored });

    const lost = new Event("webglcontextlost", { cancelable: true });
    target.dispatchEvent(lost);
    target.dispatchEvent(new Event("webglcontextrestored"));

    expect(lost.defaultPrevented).toBe(true);
    expect(onLost).toHaveBeenCalledOnce();
    expect(onLost).toHaveBeenCalledWith(authored);
    expect(onRestored).toHaveBeenCalledOnce();
    expect(onRestored).toHaveBeenCalledWith(authored);
  });

  it("does not register duplicate listeners for the same canvas", () => {
    const target = document.createElement("canvas");
    const onLost = vi.fn();
    const onRestored = vi.fn();
    const getSnapshot = () => snapshot();

    const firstCleanup = bindWebGLRecovery(target, getSnapshot, {
      onLost,
      onRestored,
    });
    const secondCleanup = bindWebGLRecovery(target, getSnapshot, {
      onLost,
      onRestored,
    });

    target.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    target.dispatchEvent(new Event("webglcontextrestored"));

    expect(onLost).toHaveBeenCalledTimes(1);
    expect(onRestored).toHaveBeenCalledTimes(1);

    secondCleanup();
    firstCleanup();
  });

  it("restores the paused state without requesting playback", () => {
    const target = document.createElement("canvas");
    const paused = snapshot({ wasPlaying: false, currentTimeMs: 777 });
    const onRestored = vi.fn();

    bindWebGLRecovery(target, () => paused, {
      onLost: vi.fn(),
      onRestored,
    });

    target.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
    target.dispatchEvent(new Event("webglcontextrestored"));

    expect(onRestored).toHaveBeenCalledWith(
      expect.objectContaining({ wasPlaying: false, currentTimeMs: 777 }),
    );
  });
});
