import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateConfiguration,
  evaluateRuntime,
  printResults,
  runReadiness,
  summarize,
} from "../../scripts/verify-deployment-readiness.mjs";

function validEnvironment() {
  return {
    ENVIRONMENT: "production",
    DEPTHPOP_CANVA_APP_ID: "depthpop-test-app",
    DEPTHPOP_CANVA_APP_ORIGIN: "https://app-depthpop-test.canva-apps.com",
    DEPTHPOP_PUBLIC_BASE_URL: "https://depthpop.example.test",
    DEPTHPOP_REPOSITORY_BACKEND: "sqlite",
    DEPTHPOP_DATABASE_PATH: "/data/depthpop/depthpop.sqlite3",
    DEPTHPOP_ASSET_ROOT: "/data/depthpop/assets",
    DEPTHPOP_ARTIFACT_ROOT: "/data/depthpop/artifacts",
    DEPTHPOP_ALLOW_BBOX_FALLBACK: "false",
    SEGMENTATION_PROVIDER: "auto",
    DEPTH_PROVIDER: "auto",
    INPAINT_PROVIDER: "auto",
    FAL_KEY: "super-secret-fal-key",
    DEPTHPOP_MAX_EXPORT_CONCURRENCY: "2",
    DEPTHPOP_MAX_EXPORT_PIXELS: "16777216",
    DEPTHPOP_MAX_EXPORT_FRAMES: "3600",
    DEPTHPOP_MAX_EXPORT_DURATION_MS: "120000",
    DEPTHPOP_MAX_EXPORT_ARTIFACT_BYTES: "536870912",

    HOLOFORGE_CANVA_APP_ID: "holoforge-test-app",
    HOLOFORGE_CANVA_APP_ORIGIN: "https://app-holoforge-test.canva-apps.com",
    HOLOFORGE_PUBLIC_BASE_URL: "https://holoforge.example.test",
    HOLOFORGE_REPOSITORY_BACKEND: "sqlite",
    HOLOFORGE_DATABASE_PATH: "/data/holoforge/holoforge.sqlite3",
    HOLOFORGE_ARTIFACT_ROOT: "/data/holoforge/artifacts",
    BLENDER_BIN: "/opt/blender/blender",
    HOLOFORGE_BLENDER_VERSION: "4.5.14",
    HOLOFORGE_RENDER_TIMEOUT_SECONDS: "600",
    HOLOFORGE_MAX_CONCURRENCY: "2",
    HOLOFORGE_MAX_JOBS: "256",
    HOLOFORGE_MAX_ARTIFACTS: "128",
    HOLOFORGE_JOB_TTL_SECONDS: "3600",
    HOLOFORGE_ARTIFACT_TTL_SECONDS: "86400",
  };
}

function passingRuntime() {
  return {
    async writableDirectory() {
      return true;
    },
    async ffmpeg() {
      return { ok: true, detail: "FFmpeg executable responds to -version" };
    },
    async blender(_binary, expectedVersion) {
      return {
        ok: expectedVersion === "4.5.14",
        detail: "Blender 4.5.14 matches the pinned production version",
      };
    },
  };
}

function failures(results, app) {
  return results.filter(
    (item) => item.level === "FAIL" && (!app || item.app === app),
  );
}

test("complete production fixture passes configuration and runtime readiness", async () => {
  const results = await runReadiness({
    env: validEnvironment(),
    runtime: passingRuntime(),
  });
  assert.equal(summarize(results).fail, 0);
});

test("DepthPop missing Canva identity is blocking", () => {
  const env = validEnvironment();
  delete env.DEPTHPOP_CANVA_APP_ID;
  const results = evaluateConfiguration(env);
  assert.ok(
    failures(results, "DepthPop").some((item) => item.key === "CANVA_APP_ID"),
  );
});

test("DepthPop HTTP public URL is blocking", () => {
  const env = validEnvironment();
  env.DEPTHPOP_PUBLIC_BASE_URL = "http://depthpop.example.test";
  const results = evaluateConfiguration(env);
  assert.ok(
    failures(results, "DepthPop").some((item) => item.key === "PUBLIC_BASE_URL"),
  );
});

test("DepthPop bbox fallback cannot be enabled in production", () => {
  const env = validEnvironment();
  env.DEPTHPOP_ALLOW_BBOX_FALLBACK = "true";
  const results = evaluateConfiguration(env);
  assert.ok(
    failures(results, "DepthPop").some(
      (item) => item.key === "DEPTHPOP_ALLOW_BBOX_FALLBACK",
    ),
  );
});

test("DepthPop mock providers are blocking in production", () => {
  const env = validEnvironment();
  env.SEGMENTATION_PROVIDER = "mock";
  env.DEPTH_PROVIDER = "mock";
  env.INPAINT_PROVIDER = "mock";
  const results = evaluateConfiguration(env);
  assert.ok(
    failures(results, "DepthPop").some(
      (item) => item.key === "SEGMENTATION_PROVIDER",
    ),
  );
  assert.ok(
    failures(results, "DepthPop").some((item) => item.key === "DEPTH_PROVIDER"),
  );
  assert.ok(
    failures(results, "DepthPop").some((item) => item.key === "INPAINT_PROVIDER"),
  );
});

test("DepthPop wrong repository backend and missing durable path fail", () => {
  const env = validEnvironment();
  env.DEPTHPOP_REPOSITORY_BACKEND = "memory";
  delete env.DEPTHPOP_ARTIFACT_ROOT;
  const results = evaluateConfiguration(env);
  assert.ok(
    failures(results, "DepthPop").some(
      (item) => item.key === "DEPTHPOP_REPOSITORY_BACKEND",
    ),
  );
  assert.ok(
    failures(results, "DepthPop").some(
      (item) => item.key === "DEPTHPOP_ARTIFACT_ROOT",
    ),
  );
});

test("HoloForge missing Blender contract is blocking", async () => {
  const env = validEnvironment();
  delete env.BLENDER_BIN;
  const config = evaluateConfiguration(env);
  assert.ok(
    failures(config, "HoloForge").some((item) => item.key === "BLENDER_BIN"),
  );

  const runtime = {
    ...passingRuntime(),
    async blender() {
      return { ok: false, detail: "Blender executable is unavailable" };
    },
  };
  const runtimeResults = await evaluateRuntime(env, runtime);
  assert.ok(
    failures(runtimeResults, "HoloForge").some((item) => item.key === "BLENDER"),
  );
});

test("HoloForge version mismatch is blocking", async () => {
  const env = validEnvironment();
  const runtime = {
    ...passingRuntime(),
    async blender() {
      return {
        ok: false,
        detail: "Blender version mismatch: expected 4.5.14, found 4.5.13",
      };
    },
  };
  const results = await evaluateRuntime(env, runtime);
  assert.ok(
    failures(results, "HoloForge").some((item) => item.key === "BLENDER"),
  );
});

test("HoloForge wrong repository backend is blocking", () => {
  const env = validEnvironment();
  env.HOLOFORGE_REPOSITORY_BACKEND = "memory";
  const results = evaluateConfiguration(env);
  assert.ok(
    failures(results, "HoloForge").some(
      (item) => item.key === "HOLOFORGE_REPOSITORY_BACKEND",
    ),
  );
});

test("non-writable persistence paths are blocking", async () => {
  const env = validEnvironment();
  const runtime = {
    ...passingRuntime(),
    async writableDirectory() {
      return false;
    },
  };
  const results = await evaluateRuntime(env, runtime);
  assert.ok(failures(results).length >= 5);
});

test("output never prints secret values", async () => {
  const env = validEnvironment();
  env.FAL_KEY = "FAL-DO-NOT-PRINT-123";
  env.CANVA_APP_ID = "CANVA-DO-NOT-PRINT-456";
  const results = await runReadiness({ env, runtime: passingRuntime() });
  const lines = [];
  printResults(results, (line) => lines.push(String(line)));
  const output = lines.join("\n");
  assert.equal(output.includes(env.FAL_KEY), false);
  assert.equal(output.includes(env.CANVA_APP_ID), false);
});

test("invalid bounded resource values fail closed", () => {
  const env = validEnvironment();
  env.DEPTHPOP_MAX_EXPORT_CONCURRENCY = "0";
  env.HOLOFORGE_RENDER_TIMEOUT_SECONDS = "5";
  const results = evaluateConfiguration(env);
  assert.ok(
    failures(results, "DepthPop").some(
      (item) => item.key === "DEPTHPOP_MAX_EXPORT_CONCURRENCY",
    ),
  );
  assert.ok(
    failures(results, "HoloForge").some(
      (item) => item.key === "HOLOFORGE_RENDER_TIMEOUT_SECONDS",
    ),
  );
});
