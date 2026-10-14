#!/usr/bin/env node
// Browser-level smoke for unhosted HTML shipped with each independent Canva app.
// This never sends API calls or requires Canva authentication.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptsDir, "..");
const chrome = process.env.CHROME_BIN || "chromium";
const assertionsUrl = pathToFileURL(join(scriptsDir, "ui-preview-browser-assertions.js")).href;

for (const app of ["holoforge-canva", "depthpop-canva"]) {
  const directory = join(root, "apps", app, "preview");
  const original = await readFile(join(directory, "index.html"), "utf8");
  assert.ok(original.includes("</body>"), app + ": missing complete HTML preview");
  const temporaryFile = join(directory, ".canva-browser-smoke-" + process.pid + ".html");
  try {
    await writeFile(temporaryFile,
      original.replace("</body>", '<script src="' + assertionsUrl + '"></script>\n</body>'),
    );
    const result = spawnSync(chrome, [
      "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
      "--allow-file-access-from-files", "--disable-background-networking",
      "--virtual-time-budget=4500", "--dump-dom", pathToFileURL(temporaryFile).href,
    ], { encoding: "utf8", timeout: 30_000, maxBuffer: 2_000_000 });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, app + ": Chrome failed: " + result.stderr?.slice(-900));
    const match = result.stdout.match(/data-canva-browser-smoke="(PASS|FAIL)"/);
    assert.ok(match, app + ": browser assertions did not finish: " + result.stdout.slice(-500));
    const error = result.stdout.match(/data-canva-browser-error="([^"]*)"/)?.[1] || "UI regression";
    assert.equal(match[1], "PASS", app + ": " + error);
    console.log(app + ": live local-file preview, branding, image upload, controls and navigation verified");
  } finally {
    await rm(temporaryFile, { force: true });
  }
}
