// @vitest-environment jsdom

import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@react-three/fiber", () => ({ Canvas: () => null }));
vi.mock("@react-three/drei", () => ({ OrbitControls: () => null }));
vi.mock("./HoloCamera", () => ({ HoloCamera: () => null }));
vi.mock("./HoloScene", () => ({ HoloScene: () => null }));
vi.mock("./StageEnvironment", () => ({ StageEnvironment: () => null }));

import { createEffectPlan } from "../holographic/effect-plan";
import { createHoloScene } from "../scene/holo-scene";
import { HoloViewport } from "./HoloViewport";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("plays continuously, pauses, resumes a seek and cancels on unmount", () => {
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  vi.spyOn(performance, "now").mockReturnValue(1000);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callbacks.set(++nextFrame, callback);
    return nextFrame;
  });
  const cancel = vi.fn((frame: number) => callbacks.delete(frame));
  vi.stubGlobal("cancelAnimationFrame", cancel);
  const scene = createHoloScene(
    createEffectPlan({
      creationType: "holo_text",
      presetId: "prism-foil",
      sourceText: "Playback fixture",
    }),
  );
  scene.timeline = {
    ...scene.timeline,
    durationMs: 1000,
    currentTimeMs: 200,
    playing: false,
  };
  const onSceneChange = vi.fn();
  const { unmount } = render(
    <HoloViewport scene={scene} onSceneChange={onSceneChange} />,
  );
  const timeline = screen.getByLabelText(
    "HoloForge timeline",
  ) as HTMLInputElement;
  const step = (now: number) => {
    const [frame, callback] = [...callbacks.entries()][0]!;
    callbacks.delete(frame);
    act(() => callback(now));
  };

  expect(timeline.value).toBe("200");
  fireEvent.click(screen.getByRole("button", { name: "PLAY FX" }));
  step(1100);
  expect(timeline.value).toBe("300");
  step(1200);
  expect(timeline.value).toBe("400");
  expect(cancel).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "PAUSE FX" }));
  expect(callbacks.size).toBe(0);
  expect(onSceneChange).toHaveBeenLastCalledWith(
    expect.objectContaining({
      timeline: expect.objectContaining({
        currentTimeMs: 400,
        playing: false,
      }),
    }),
  );
  fireEvent.change(timeline, { target: { value: "600" } });
  vi.spyOn(performance, "now").mockReturnValue(2000);
  fireEvent.click(screen.getByRole("button", { name: "PLAY FX" }));
  step(2100);
  expect(timeline.value).toBe("700");
  unmount();
  expect(callbacks.size).toBe(0);
});
