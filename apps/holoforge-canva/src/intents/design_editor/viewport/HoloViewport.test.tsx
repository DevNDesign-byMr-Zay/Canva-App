// @vitest-environment jsdom

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@react-three/fiber", () => ({ Canvas: () => null }));
vi.mock("@react-three/drei", () => ({ OrbitControls: () => null }));
vi.mock("./HoloCamera", () => ({ HoloCamera: () => null }));
vi.mock("./HoloScene", () => ({ HoloScene: () => null }));
vi.mock("./StageEnvironment", () => ({ StageEnvironment: () => null }));
vi.mock("../export/ExportPanel", () => ({ ExportPanel: () => null }));

import { createEffectPlan } from "../holographic/effect-plan";
import { createHoloScene } from "../scene/holo-scene";
import { HoloViewport } from "./HoloViewport";

let root: Root | null = null;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = null;
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("plays continuously, pauses, resumes a seek and cancels on unmount", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  vi.spyOn(performance, "now").mockReturnValue(1000);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callbacks.set(++nextFrame, callback);
    return nextFrame;
  });
  const cancel = vi.fn((frame: number) => callbacks.delete(frame));
  vi.stubGlobal("cancelAnimationFrame", cancel);
  const initial = createHoloScene(
    createEffectPlan({
      creationType: "holo_text",
      presetId: "prism-foil",
      sourceText: "Playback fixture",
    }),
  );
  const scene = {
    ...initial,
    timeline: {
      ...initial.timeline,
      durationMs: 1000,
      currentTimeMs: 200,
      playing: false,
    },
  };
  const onSceneChange = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  const mountedRoot = createRoot(container);
  root = mountedRoot;
  act(() => {
    mountedRoot.render(
      <HoloViewport scene={scene} onSceneChange={onSceneChange} />,
    );
  });
  const timeline = container.querySelector<HTMLInputElement>(
    '[aria-label="HoloForge timeline"]',
  )!;
  const clickButton = (name: string) => {
    const button = Array.from(container.querySelectorAll("button")).find(
      (candidate) => candidate.textContent?.trim() === name,
    );
    expect(button).toBeDefined();
    act(() => button!.click());
  };
  const step = (now: number) => {
    const [frame, callback] = [...callbacks.entries()][0]!;
    callbacks.delete(frame);
    act(() => callback(now));
  };

  expect(timeline.value).toBe("200");
  clickButton("PLAY FX");
  step(1100);
  expect(timeline.value).toBe("300");
  step(1200);
  expect(timeline.value).toBe("400");
  expect(cancel).not.toHaveBeenCalled();
  clickButton("PAUSE FX");
  expect(callbacks.size).toBe(0);
  expect(onSceneChange).toHaveBeenLastCalledWith(
    expect.objectContaining({
      timeline: expect.objectContaining({
        currentTimeMs: 400,
        playing: false,
      }),
    }),
  );
  const setValue = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!;
  act(() => {
    setValue.call(timeline, "600");
    timeline.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(timeline.value).toBe("600");
  vi.spyOn(performance, "now").mockReturnValue(2000);
  clickButton("PLAY FX");
  step(2100);
  expect(timeline.value).toBe("700");
  act(() => mountedRoot.unmount());
  root = null;
  expect(callbacks.size).toBe(0);
});
