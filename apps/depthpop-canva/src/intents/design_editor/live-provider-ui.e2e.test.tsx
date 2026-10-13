// @vitest-environment jsdom

import React from "react";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const shared = vi.hoisted(() => ({
  capturedScene: null as any,
  upload: vi.fn(),
  addElementAtPoint: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock("@canva/app-hooks", () => ({
  useSelection: () => ({
    count: 0,
    read: vi.fn(async () => ({ contents: [] })),
  }),
}));

vi.mock("@canva/asset", () => ({
  upload: shared.upload,
  getTemporaryUrl: vi.fn(),
}));

vi.mock("@canva/design", () => ({
  addElementAtPoint: shared.addElementAtPoint,
}));

vi.mock("@canva/user", () => ({
  auth: {
    getCanvaUserToken: shared.getToken,
  },
}));

vi.mock("./workspace/scene-workspace", () => ({
  SceneWorkspace: ({ initialScene }: { initialScene: any }) => {
    shared.capturedScene = initialScene;
    return (
      <section data-testid="live-scene-workspace">
        <strong>LIVE DEPTHSCENE READY</strong>
        <span data-testid="scene-id">{initialScene.id}</span>
        <span data-testid="object-count">{initialScene.objects.length}</span>
        {initialScene.objects.map((object: any) => (
          <div key={object.id} data-testid="scene-object">
            {object.label} · {Math.round(object.confidence * 100)}%
          </div>
        ))}
      </section>
    );
  },
}));

vi.stubGlobal("BACKEND_HOST", "http://127.0.0.1:8081");

import { App } from "./app";

const fixtureBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAIAAABMXPacAAAB3UlEQVR42u3dMU4CQRSAYRipPAE11nZWJJ6BxsIb2HkYO29gYcMlvAC1vSewM7EwsQCK3bAw7818f0kQdt/HTABJdr5c3c1Ur2IEAAAIAAABACAAAAQAgC7XIulxf749Hd548/ia7kTmub6MOzr31BKlvemPuqcVcN6Bxl8KpeHpp1gKpeHppzDwNhTA+V+8kRdBaX76wQ1sQQAANL//RN6FrAAAAAQAgAD0WZSvo3fr5d4t18+baZ/i+2W7d8vtx1f1E18EHP2Fn7ouQ+l2+kGOoYQ988MdY9r9J4hBify6m8pgyOPUMigdrvpQRxX9bejpi2DarawFgLEvtFMmOPZvL78Icvwy7m+Ooz4ZBH/hp/wkPHymWaY/S/fb0P/JHl0NieaeFSD1rNNvQU0GAAAAAQAgAAAEAIAAABAAAAIAQAAACAAAAQAgAAAEAIAAABAAAAIAQAAACAAAAQAgAAAEAIAAABAAAAIAIAAABAAAAKAA==" ;

function pngFile(): File {
  const bytes = Uint8Array.from(atob(fixtureBase64), (char) => char.charCodeAt(0));
  return new File([bytes], "depthpop-ui-e2e.png", { type: "image/png" });
}

async function fetchAsset(url: string): Promise<Uint8Array> {
  const response = await fetch(url, {
    headers: { Authorization: "Bearer e2e-token" },
  });
  if (!response.ok) {
    throw new Error(`asset fetch failed: ${response.status} ${url}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

async function saveResultAssets(scene: any): Promise<void> {
  const root = path.resolve(process.cwd(), "e2e-live-results");
  await fs.mkdir(root, { recursive: true });

  await fs.writeFile(
    path.join(root, "scene.json"),
    JSON.stringify(scene, null, 2) + "\n",
    "utf8",
  );
  await fs.writeFile(
    path.join(root, "ui-dom.html"),
    document.documentElement.outerHTML,
    "utf8",
  );

  const outputs: Array<[string, string | undefined]> = [
    ["reconstructed-plate.png", scene.reconstructedPlate?.imageUrl],
    ["depth-map.png", scene.reconstructedPlate?.depthMapUrl],
    ["first-object-cutout.png", scene.objects?.[0]?.assets?.cutoutUrl],
    ["first-object-mask.png", scene.objects?.[0]?.assets?.maskUrl],
    ["first-object-thumbnail.png", scene.objects?.[0]?.assets?.thumbnailUrl],
  ];

  for (const [name, url] of outputs) {
    if (!url) continue;
    const bytes = await fetchAsset(url);
    await fs.writeFile(path.join(root, name), bytes);
    console.log(
      `DEPTHPOP_UI_IMAGE:${name}:${Buffer.from(bytes).toString("base64")}`,
    );
  }

  console.log(
    "DEPTHPOP_UI_SCENE:" +
      JSON.stringify({
        id: scene.id,
        width: scene.width,
        height: scene.height,
        objectCount: scene.objects.length,
        objects: scene.objects.map((object: any) => ({
          id: object.id,
          label: object.label,
          semanticType: object.semanticType,
          confidence: object.confidence,
          extractionQuality: object.extractionQuality,
          bbox: object.bbox,
          depth: object.depth,
        })),
        settings: scene.settings,
      }),
  );
}

describe("DepthPop live provider UI E2E", () => {
  beforeAll(() => {
    if (process.env.DEPTHPOP_LIVE_UI_E2E !== "1") {
      throw new Error("DEPTHPOP_LIVE_UI_E2E=1 is required for this paid one-shot test.");
    }

    shared.upload.mockImplementation(async () => ({
      ref: "ui-e2e-source-ref",
      whenUploaded: async () => undefined,
    }));
    shared.addElementAtPoint.mockResolvedValue(undefined);
    shared.getToken.mockResolvedValue("e2e-token");
  });

  afterAll(() => cleanup());

  it(
    "uploads through the real React UI and builds a real provider-backed DepthScene",
    async () => {
      render(<App />);

      const fileInput = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement | null;
      expect(fileInput).toBeTruthy();

      fireEvent.change(fileInput!, {
        target: { files: [pngFile()] },
      });

      await screen.findByText(
        /uploaded and ready as a DepthPop source/i,
        {},
        { timeout: 15_000 },
      );

      const fastButton = screen.getByRole("button", { name: "Fast" });
      fireEvent.click(fastButton);

      const execute = screen.getByRole("button", {
        name: /CREATE DEPTHSCENE/i,
      });
      expect(execute.hasAttribute("disabled")).toBe(false);

      fireEvent.click(execute);

      await screen.findByTestId(
        "live-scene-workspace",
        {},
        { timeout: 240_000 },
      );

      expect(screen.getByText("LIVE DEPTHSCENE READY")).toBeTruthy();
      expect(shared.capturedScene).toBeTruthy();
      expect(shared.capturedScene.objects.length).toBeGreaterThan(0);
      expect(shared.capturedScene.reconstructedPlate.imageUrl).toContain(
        "/api/v1/assets/",
      );
      expect(shared.capturedScene.reconstructedPlate.depthMapUrl).toContain(
        "/api/v1/assets/",
      );
      expect(shared.capturedScene.settings.renderQuality).toBe("fast");
      expect(shared.capturedScene.settings.numInferenceSteps).toBe(14);
      expect(
        shared.capturedScene.objects.every(
          (object: any) => object.extractionQuality !== "bbox_fallback",
        ),
      ).toBe(true);

      await saveResultAssets(shared.capturedScene);

      await waitFor(() => {
        expect(screen.getAllByTestId("scene-object").length).toBeGreaterThan(0);
      });
    },
    300_000,
  );
});
