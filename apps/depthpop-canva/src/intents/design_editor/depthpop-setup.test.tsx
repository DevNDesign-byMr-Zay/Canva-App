// @vitest-environment jsdom

import React, { useState, type ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DEFAULT_DEPTHPOP_SETTINGS } from "../../depthpop/depthpop-model";
import type { UploadedImageResult } from "./local-image-upload";
import { DepthPopSetup } from "./depthpop-setup";

vi.mock("./local-image-upload", () => ({
  LocalImageUpload: ({
    onUploaded,
  }: {
    onUploaded: (result: UploadedImageResult) => void;
  }) => (
    <button
      onClick={() =>
        onUploaded({
          ref: "local-ref" as UploadedImageResult["ref"],
          fileName: "local.png",
          mimeType: "image/png",
          dataUrl: "data:image/png;base64,test",
        })
      }
    >
      Stage local source
    </button>
  ),
}));

type SetupProps = ComponentProps<typeof DepthPopSetup>;
const makeProps = (): SetupProps => ({
  settings: DEFAULT_DEPTHPOP_SETTINGS,
  setSettings: vi.fn(),
  isBusy: false,
  reset: vi.fn(),
  localSource: null,
  setLocalSource: vi.fn(),
  setError: vi.fn(),
  hasSource: true,
  selectedImageCount: 1,
  progress: 0,
  stage: "idle",
  error: null,
  host: "https://backend.example.test",
  canExecute: true,
  executeScenePipeline: vi.fn(async () => {}),
});

function renderSetup(overrides: Partial<SetupProps> = {}) {
  const props = { ...makeProps(), ...overrides };
  const view = render(<DepthPopSetup {...props} />);
  return { props, ...view };
}

afterEach(cleanup);

it("preserves branding, slider ranges and independent settings updates", () => {
  const initial = { ...DEFAULT_DEPTHPOP_SETTINGS };
  function SettingsHarness() {
    const [settings, setSettings] = useState(initial);
    return (
      <DepthPopSetup
        {...makeProps()}
        settings={settings}
        setSettings={setSettings}
      />
    );
  }
  render(<SettingsHarness />);
  expect(screen.getByRole("heading", { name: "DEPTHPOP" })).toBeDefined();
  expect(
    screen.getByRole("img", { name: "DepthPop layered square depth emblem" }),
  ).toBeDefined();
  const strength = screen.getByRole("slider", {
    name: "Depth Strength",
  }) as HTMLInputElement;
  const blur = screen.getByRole("slider", {
    name: "Depth Blur",
  }) as HTMLInputElement;
  const fidelity = screen.getByRole("slider", {
    name: "Depth Fidelity",
  }) as HTMLInputElement;
  expect([strength.min, strength.max, strength.step]).toEqual([
    "0.05",
    "0.75",
    "0.01",
  ]);
  expect([blur.min, blur.max, blur.step]).toEqual(["0", "100", "1"]);
  expect([fidelity.min, fidelity.max, fidelity.step]).toEqual([
    "0.05",
    "1",
    "0.01",
  ]);
  fireEvent.change(strength, { target: { value: "0.4" } });
  fireEvent.change(blur, { target: { value: "60" } });
  fireEvent.change(fidelity, { target: { value: "0.8" } });
  fireEvent.click(screen.getByRole("button", { name: "Cinematic" }));
  expect(strength.value).toBe("0.4");
  expect(blur.value).toBe("60");
  expect(fidelity.value).toBe("0.8");
  expect(
    screen
      .getByRole("button", { name: "Cinematic" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  expect(initial).toEqual(DEFAULT_DEPTHPOP_SETTINGS);
});

it("preserves execution gating, busy progress and cancellation", () => {
  const { props, rerender } = renderSetup({
    isBusy: true,
    canExecute: false,
    stage: "building_scene",
    progress: 42,
  });
  const execute = screen.getByRole("button", {
    name: "BUILDING DEPTHSCENE…",
  }) as HTMLButtonElement;
  expect(execute.disabled).toBe(true);
  fireEvent.click(execute);
  expect(props.executeScenePipeline).not.toHaveBeenCalled();
  expect(screen.getByText("42%")).toBeDefined();
  fireEvent.click(
    screen.getByRole("button", {
      name: "Cancel current DepthPop run and reset",
    }),
  );
  expect(props.reset).toHaveBeenCalledOnce();
  rerender(<DepthPopSetup {...props} isBusy={false} canExecute={true} />);
  fireEvent.click(screen.getByRole("button", { name: "CREATE DEPTHSCENE" }));
  expect(props.executeScenePipeline).toHaveBeenCalledOnce();
});

it.each([
  [0, "Select an image in Canva or upload one above"],
  [1, "1 raster image selected"],
  [2, "Select one image only"],
])("keeps the %i-image source status truthful", (count, label) => {
  renderSetup({ selectedImageCount: count, hasSource: count === 1 });
  expect(screen.getByText(label)).toBeDefined();
});

it("preserves local-source binding, clearing and visible failures", () => {
  const localSource: UploadedImageResult = {
    ref: "bound-ref" as UploadedImageResult["ref"],
    fileName: "artwork.png",
    mimeType: "image/png",
    dataUrl: "data:image/png;base64,artwork",
  };
  const { props } = renderSetup({
    localSource,
    host: "",
    error: "Pipeline unavailable",
  });
  expect(screen.getByText("artwork.png")).toBeDefined();
  expect(screen.getByText("Pipeline unavailable")).toBeDefined();
  expect(
    screen.getByText("Backend host is not configured for this build."),
  ).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "USE CANVA SELECTION" }));
  expect(props.setLocalSource).toHaveBeenCalledWith(null);
  fireEvent.click(screen.getByRole("button", { name: "Stage local source" }));
  expect(props.setLocalSource).toHaveBeenLastCalledWith(
    expect.objectContaining({ fileName: "local.png" }),
  );
  expect(props.setError).toHaveBeenCalledWith(null);
});
