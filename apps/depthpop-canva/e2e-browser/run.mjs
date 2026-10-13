import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn, execFileSync } from "node:child_process";

const appRoot = path.resolve(process.cwd());
const resultRoot = path.join(appRoot, "e2e-live-results");
await fs.mkdir(resultRoot, { recursive: true });

function chromeExecutable() {
  const command =
    "command -v google-chrome || command -v google-chrome-stable || command -v chromium || command -v chromium-browser";
  const value = execFileSync("bash", ["-lc", command], { encoding: "utf8" }).trim();
  if (!value) throw new Error("No Chrome/Chromium executable was found on the runner.");
  return value;
}

async function waitForJson(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError || new Error("Timed out waiting for Chrome DevTools.");
}

function createCdp(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();

  const ready = new Promise((resolve, reject) => {
    socket.addEventListener("open", () => resolve());
    socket.addEventListener("error", (event) => reject(event));
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id) {
      const waiter = pending.get(message.id);
      if (!waiter) return;
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message));
      else waiter.resolve(message.result);
      return;
    }
    const waiters = listeners.get(message.method) || [];
    listeners.delete(message.method);
    for (const resolve of waiters) resolve(message.params);
  });

  function send(method, params = {}) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  function once(method) {
    return new Promise((resolve) => {
      const waiters = listeners.get(method) || [];
      waiters.push(resolve);
      listeners.set(method, waiters);
    });
  }

  return { socket, ready, send, once };
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description ||
        result.exceptionDetails.text ||
        "Browser evaluation failed",
    );
  }
  return result.result?.value;
}

async function poll(cdp, expression, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let lastValue;
  while (Date.now() < deadline) {
    lastValue = await evaluate(cdp, expression);
    if (lastValue) return lastValue;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${label}. Last value: ${JSON.stringify(lastValue)}`);
}

async function capture(cdp, fileName) {
  const shot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: true,
  });
  await fs.writeFile(path.join(resultRoot, fileName), Buffer.from(shot.data, "base64"));
}

const chromePath = chromeExecutable();
const profileDir = await fs.mkdtemp(path.join(os.tmpdir(), "depthpop-chrome-"));
const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--remote-debugging-port=9222",
    `--user-data-dir=${profileDir}`,
    "--use-angle=swiftshader",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "ignore"] },
);

let cdp;
try {
  await waitForJson("http://127.0.0.1:9222/json/version");

  const targetResponse = await fetch(
    "http://127.0.0.1:9222/json/new?http%3A%2F%2F127.0.0.1%3A4173%2Fe2e-browser%2Findex.html",
    { method: "PUT" },
  );
  if (!targetResponse.ok) {
    throw new Error(`Could not create Chrome target: HTTP ${targetResponse.status}`);
  }
  const target = await targetResponse.json();
  cdp = createCdp(target.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 420,
    height: 1200,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await poll(
    cdp,
    "document.readyState === 'complete' && !!document.querySelector('input[type=file]')",
    20_000,
    "DepthPop UI boot",
  );

  await evaluate(
    cdp,
    `(async () => {
      const response = await fetch('/e2e-fixture.png');
      if (!response.ok) throw new Error('fixture fetch failed');
      const blob = await response.blob();
      const file = new File([blob], 'depthpop-ui-e2e.png', { type: 'image/png' });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      const input = document.querySelector('input[type="file"]');
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()`,
  );

  await poll(
    cdp,
    "document.body.innerText.includes('uploaded and ready as a DepthPop source')",
    20_000,
    "local source upload",
  );

  await evaluate(
    cdp,
    `(() => {
      const button = [...document.querySelectorAll('button')].find(
        (item) => item.textContent?.trim() === 'Fast'
      );
      if (!button) throw new Error('Fast quality button missing');
      button.click();
      return true;
    })()`,
  );

  await capture(cdp, "ui-before-execute.png");

  await evaluate(
    cdp,
    `(() => {
      const button = [...document.querySelectorAll('button')].find(
        (item) => item.textContent?.includes('CREATE DEPTHSCENE')
      );
      if (!button) throw new Error('CREATE DEPTHSCENE button missing');
      if (button.disabled) throw new Error('CREATE DEPTHSCENE button is disabled');
      button.click();
      return true;
    })()`,
  );

  const outcome = await poll(
    cdp,
    `(() => {
      if (document.querySelector('[data-testid="scene-workspace"]')) {
        return { kind: 'scene' };
      }
      const error = document.querySelector('.dp-error');
      if (error?.textContent?.trim()) {
        return { kind: 'error', message: error.textContent.trim() };
      }
      return false;
    })()`,
    240_000,
    "provider-backed scene or visible UI error",
  );

  if (outcome.kind !== "scene") {
    throw new Error("DepthPop UI reported an error: " + String(outcome.message || "unknown UI error"));
  }

  const scene = await poll(
    cdp,
    "window.__DEPTHPOP_E2E_SCENE__ || false",
    10_000,
    "captured DepthScene",
  );

  if (!Array.isArray(scene.objects) || scene.objects.length < 1) {
    throw new Error("Provider-backed DepthScene contained no editable objects.");
  }
  if (scene.objects.some((object) => object.extractionQuality === "bbox_fallback")) {
    throw new Error("Live UI E2E unexpectedly used bbox fallback.");
  }
  if (scene.settings?.renderQuality !== "fast") {
    throw new Error("The UI Fast quality selection did not reach backend scene settings.");
  }

  await capture(cdp, "ui-depthscene-workspace.png");
  await fs.writeFile(
    path.join(resultRoot, "scene.json"),
    JSON.stringify(scene, null, 2) + "\n",
    "utf8",
  );

  const assets = [
    ["reconstructed-plate.png", scene.reconstructedPlate?.imageUrl],
    ["depth-map.png", scene.reconstructedPlate?.depthMapUrl],
    ["first-object-cutout.png", scene.objects[0]?.assets?.cutoutUrl],
    ["first-object-mask.png", scene.objects[0]?.assets?.maskUrl],
    ["first-object-thumbnail.png", scene.objects[0]?.assets?.thumbnailUrl],
  ];

  for (const [name, url] of assets) {
    if (!url) continue;
    const response = await fetch(url, {
      headers: { Authorization: "Bearer e2e-token" },
    });
    if (!response.ok) {
      throw new Error(`Failed to download ${name}: HTTP ${response.status}`);
    }
    await fs.writeFile(
      path.join(resultRoot, name),
      Buffer.from(await response.arrayBuffer()),
    );
  }

  const summary = {
    id: scene.id,
    width: scene.width,
    height: scene.height,
    objectCount: scene.objects.length,
    settings: scene.settings,
    objects: scene.objects.map((object) => ({
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
} catch (error) {
  if (cdp) {
    try {
      await capture(cdp, "ui-failure.png");
    } catch {}
  }
  throw error;
} finally {
  if (cdp?.socket) cdp.socket.close();
  chrome.kill("SIGTERM");
  await fs.rm(profileDir, { recursive: true, force: true });
}
