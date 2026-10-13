import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";

const appRoot = path.resolve(process.cwd());
const resultRoot = path.join(appRoot, "e2e-live-results");
const fixturePath = path.join(appRoot, "e2e-fixture.png");
await fs.mkdir(resultRoot, { recursive: true });

let capturedScene = null;
const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-gl=swiftshader",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--disable-gpu-sandbox",
  ],
});

try {
  const page = await browser.newPage({
    viewport: { width: 420, height: 1200 },
    deviceScaleFactor: 1,
  });

  page.on("console", (message) => {
    console.log("BROWSER_CONSOLE:", message.type(), message.text());
  });
  page.on("pageerror", (error) => {
    console.error("BROWSER_PAGE_ERROR:", error.message);
  });
  page.on("response", async (response) => {
    const url = response.url();
    if (
      response.request().method() === "GET" &&
      /\/api\/v1\/scenes\/scene_[^/]+$/.test(url) &&
      response.ok()
    ) {
      try {
        capturedScene = await response.json();
      } catch {
        // The E2E assertion below will fail if a valid scene never appears.
      }
    }
  });

  await page.goto("http://127.0.0.1:4173/e2e-browser/index.html", {
    waitUntil: "networkidle",
  });

  await page.locator('input[type="file"]').setInputFiles(fixturePath);
  await page
    .getByText(/uploaded and ready as a DepthPop source/i)
    .waitFor({ state: "visible", timeout: 20_000 });

  await page.getByRole("button", { name: "Fast" }).click();
  const execute = page.getByRole("button", { name: /CREATE DEPTHSCENE/i });
  await execute.waitFor({ state: "visible" });
  if (await execute.isDisabled()) {
    throw new Error("CREATE DEPTHSCENE remained disabled after local upload.");
  }

  await page.screenshot({
    path: path.join(resultRoot, "ui-before-execute.png"),
    fullPage: true,
  });

  await execute.click();

  const outcome = await page.waitForFunction(
    () => {
      const workspace = document.querySelector(
        '[data-testid="scene-workspace"]',
      );
      if (workspace) return { kind: "scene" };
      const error = document.querySelector(".dp-error");
      if (error?.textContent?.trim()) {
        return { kind: "error", message: error.textContent.trim() };
      }
      return false;
    },
    undefined,
    { timeout: 240_000 },
  );
  const outcomeValue = await outcome.jsonValue();
  if (outcomeValue?.kind !== "scene") {
    throw new Error(
      "DepthPop UI reported an error: " +
        String(outcomeValue?.message || "unknown UI error"),
    );
  }

  await page
    .locator('[data-testid="scene-workspace"]')
    .waitFor({ state: "visible", timeout: 10_000 });

  if (!capturedScene) {
    throw new Error("The UI reached the workspace without a captured DepthScene.");
  }

  if (!Array.isArray(capturedScene.objects) || capturedScene.objects.length < 1) {
    throw new Error("Provider-backed DepthScene contained no editable objects.");
  }

  if (
    capturedScene.objects.some(
      (object) => object.extractionQuality === "bbox_fallback",
    )
  ) {
    throw new Error("Live UI E2E unexpectedly used bbox fallback.");
  }

  if (capturedScene.settings?.renderQuality !== "fast") {
    throw new Error(
      "The UI Fast quality selection did not reach the backend scene settings.",
    );
  }

  await page.screenshot({
    path: path.join(resultRoot, "ui-depthscene-workspace.png"),
    fullPage: true,
  });

  await fs.writeFile(
    path.join(resultRoot, "scene.json"),
    JSON.stringify(capturedScene, null, 2) + "\n",
    "utf8",
  );

  const assets = [
    ["reconstructed-plate.png", capturedScene.reconstructedPlate?.imageUrl],
    ["depth-map.png", capturedScene.reconstructedPlate?.depthMapUrl],
    ["first-object-cutout.png", capturedScene.objects[0]?.assets?.cutoutUrl],
    ["first-object-mask.png", capturedScene.objects[0]?.assets?.maskUrl],
    ["first-object-thumbnail.png", capturedScene.objects[0]?.assets?.thumbnailUrl],
  ];

  for (const [name, url] of assets) {
    if (!url) continue;
    const response = await fetch(url, {
      headers: { Authorization: "Bearer e2e-token" },
    });
    if (!response.ok) {
      throw new Error(`Failed to download ${name}: HTTP ${response.status}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(path.join(resultRoot, name), bytes);
  }

  const summary = {
    id: capturedScene.id,
    width: capturedScene.width,
    height: capturedScene.height,
    objectCount: capturedScene.objects.length,
    settings: capturedScene.settings,
    objects: capturedScene.objects.map((object) => ({
      id: object.id,
      label: object.label,
      semanticType: object.semanticType,
      confidence: object.confidence,
      extractionQuality: object.extractionQuality,
      bbox: object.bbox,
      depth: object.depth,
    })),
  };
  await fs.writeFile(
    path.join(resultRoot, "summary.json"),
    JSON.stringify(summary, null, 2) + "\n",
    "utf8",
  );

  console.log("DEPTHPOP_UI_E2E_PASS", JSON.stringify(summary));
} finally {
  await browser.close();
}
