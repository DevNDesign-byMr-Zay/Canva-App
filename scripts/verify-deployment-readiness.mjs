import { access, mkdir, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const DEPTHPOP_PATHS = Object.freeze({
  database: "/data/depthpop/depthpop.sqlite3",
  assets: "/data/depthpop/assets",
  artifacts: "/data/depthpop/artifacts",
});

const HOLOFORGE_PATHS = Object.freeze({
  database: "/data/holoforge/holoforge.sqlite3",
  artifacts: "/data/holoforge/artifacts",
});

const DEFAULT_BLENDER_VERSION = "4.5.14";

function value(env, appPrefix, name) {
  return String(env[`${appPrefix}_${name}`] ?? env[name] ?? "").trim();
}

function isTrue(raw) {
  return /^(1|true|yes|on)$/i.test(String(raw ?? "").trim());
}

function parsePositiveInt(raw, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!/^\d+$/.test(String(raw ?? "").trim())) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max
    ? parsed
    : null;
}

function isHttpsUrl(raw) {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function result(app, level, key, message) {
  return Object.freeze({ app, level, key, message });
}

function pushRequired(results, app, key, present, label) {
  results.push(
    result(
      app,
      present ? "PASS" : "FAIL",
      key,
      present ? `${label} configured` : `${label} is required`,
    ),
  );
}

function pushHttps(results, app, key, raw, label) {
  results.push(
    result(
      app,
      isHttpsUrl(raw) ? "PASS" : "FAIL",
      key,
      isHttpsUrl(raw)
        ? `${label} uses HTTPS`
        : `${label} must be a valid HTTPS URL`,
    ),
  );
}

function pushPositiveInt(results, app, env, key, options = {}) {
  const parsed = parsePositiveInt(env[key], options);
  results.push(
    result(
      app,
      parsed === null ? "FAIL" : "PASS",
      key,
      parsed === null
        ? `${key} must be an integer in the supported range`
        : `${key} is bounded`,
    ),
  );
}

function pushExactPath(results, app, env, key, expected) {
  const raw = String(env[key] ?? "").trim();
  const absolute = raw ? path.isAbsolute(raw) : false;
  const allowCustom = isTrue(env.DEPLOYMENT_ALLOW_CUSTOM_PERSISTENCE_PATHS);
  const exact = raw === expected;
  const ok = absolute && (exact || allowCustom);
  results.push(
    result(
      app,
      ok ? "PASS" : "FAIL",
      key,
      ok
        ? `${key} uses an absolute durable path`
        : `${key} must be ${expected} (or explicitly allow a custom absolute durable path)`,
    ),
  );
}

export function evaluateConfiguration(env = process.env) {
  const results = [];

  const depthEnv = value(env, "DEPTHPOP", "ENVIRONMENT");
  results.push(
    result(
      "DepthPop",
      depthEnv === "production" ? "PASS" : "FAIL",
      "ENVIRONMENT",
      depthEnv === "production"
        ? "production environment selected"
        : "ENVIRONMENT must be production",
    ),
  );

  const depthAppId = value(env, "DEPTHPOP", "CANVA_APP_ID");
  const depthOrigin = value(env, "DEPTHPOP", "CANVA_APP_ORIGIN");
  const depthPublic = value(env, "DEPTHPOP", "PUBLIC_BASE_URL");
  pushRequired(results, "DepthPop", "CANVA_APP_ID", Boolean(depthAppId), "Canva app identity");
  pushHttps(results, "DepthPop", "CANVA_APP_ORIGIN", depthOrigin, "Canva app origin");
  pushHttps(results, "DepthPop", "PUBLIC_BASE_URL", depthPublic, "public backend URL");

  const repoBackend = String(env.DEPTHPOP_REPOSITORY_BACKEND ?? "").trim().toLowerCase();
  results.push(
    result(
      "DepthPop",
      repoBackend === "sqlite" ? "PASS" : "FAIL",
      "DEPTHPOP_REPOSITORY_BACKEND",
      repoBackend === "sqlite"
        ? "SQLite persistence selected"
        : "DEPTHPOP_REPOSITORY_BACKEND must be sqlite in production",
    ),
  );

  pushExactPath(results, "DepthPop", env, "DEPTHPOP_DATABASE_PATH", DEPTHPOP_PATHS.database);
  pushExactPath(results, "DepthPop", env, "DEPTHPOP_ASSET_ROOT", DEPTHPOP_PATHS.assets);
  pushExactPath(results, "DepthPop", env, "DEPTHPOP_ARTIFACT_ROOT", DEPTHPOP_PATHS.artifacts);

  const bboxFallback = String(env.DEPTHPOP_ALLOW_BBOX_FALLBACK ?? "").trim().toLowerCase();
  results.push(
    result(
      "DepthPop",
      bboxFallback === "false" || bboxFallback === "0" ? "PASS" : "FAIL",
      "DEPTHPOP_ALLOW_BBOX_FALLBACK",
      bboxFallback === "false" || bboxFallback === "0"
        ? "bbox fallback disabled for production"
        : "DEPTHPOP_ALLOW_BBOX_FALLBACK must be false in production",
    ),
  );

  for (const key of ["SEGMENTATION_PROVIDER", "DEPTH_PROVIDER", "INPAINT_PROVIDER"]) {
    const provider = String(env[key] ?? "").trim().toLowerCase();
    const ok = provider === "auto" || provider === "fal";
    results.push(
      result(
        "DepthPop",
        ok ? "PASS" : "FAIL",
        key,
        ok
          ? `${key} selects a production provider path`
          : `${key} must be auto or fal; mock/empty providers are not production-safe`,
      ),
    );
  }

  pushRequired(results, "DepthPop", "FAL_KEY", Boolean(String(env.FAL_KEY ?? "").trim()), "FAL provider secret");

  pushPositiveInt(results, "DepthPop", env, "DEPTHPOP_MAX_EXPORT_CONCURRENCY", { min: 1, max: 4 });
  pushPositiveInt(results, "DepthPop", env, "DEPTHPOP_MAX_EXPORT_PIXELS", { min: 1 });
  pushPositiveInt(results, "DepthPop", env, "DEPTHPOP_MAX_EXPORT_FRAMES", { min: 1 });
  pushPositiveInt(results, "DepthPop", env, "DEPTHPOP_MAX_EXPORT_DURATION_MS", { min: 1 });
  pushPositiveInt(results, "DepthPop", env, "DEPTHPOP_MAX_EXPORT_ARTIFACT_BYTES", { min: 1024 * 1024 });

  const holoEnv = value(env, "HOLOFORGE", "ENVIRONMENT");
  results.push(
    result(
      "HoloForge",
      holoEnv === "production" ? "PASS" : "FAIL",
      "ENVIRONMENT",
      holoEnv === "production"
        ? "production environment selected"
        : "ENVIRONMENT must be production",
    ),
  );

  const holoAppId = value(env, "HOLOFORGE", "CANVA_APP_ID");
  const holoOrigin = value(env, "HOLOFORGE", "CANVA_APP_ORIGIN");
  const holoPublic = value(env, "HOLOFORGE", "PUBLIC_BASE_URL");
  pushRequired(results, "HoloForge", "CANVA_APP_ID", Boolean(holoAppId), "Canva app identity");
  pushHttps(results, "HoloForge", "CANVA_APP_ORIGIN", holoOrigin, "Canva app origin");
  pushHttps(results, "HoloForge", "PUBLIC_BASE_URL", holoPublic, "public render-service URL");

  const holoRepo = String(env.HOLOFORGE_REPOSITORY_BACKEND ?? "").trim().toLowerCase();
  results.push(
    result(
      "HoloForge",
      holoRepo === "sqlite" ? "PASS" : "FAIL",
      "HOLOFORGE_REPOSITORY_BACKEND",
      holoRepo === "sqlite"
        ? "SQLite persistence selected"
        : "HOLOFORGE_REPOSITORY_BACKEND must be sqlite in production",
    ),
  );

  pushExactPath(results, "HoloForge", env, "HOLOFORGE_DATABASE_PATH", HOLOFORGE_PATHS.database);
  pushExactPath(results, "HoloForge", env, "HOLOFORGE_ARTIFACT_ROOT", HOLOFORGE_PATHS.artifacts);

  pushRequired(results, "HoloForge", "BLENDER_BIN", Boolean(String(env.BLENDER_BIN ?? "").trim()), "Blender binary path");
  pushRequired(
    results,
    "HoloForge",
    "HOLOFORGE_BLENDER_VERSION",
    Boolean(String(env.HOLOFORGE_BLENDER_VERSION ?? "").trim()),
    "Blender version contract",
  );

  pushPositiveInt(results, "HoloForge", env, "HOLOFORGE_RENDER_TIMEOUT_SECONDS", { min: 30 });
  pushPositiveInt(results, "HoloForge", env, "HOLOFORGE_MAX_CONCURRENCY", { min: 1, max: 8 });
  pushPositiveInt(results, "HoloForge", env, "HOLOFORGE_MAX_JOBS", { min: 8 });
  pushPositiveInt(results, "HoloForge", env, "HOLOFORGE_MAX_ARTIFACTS", { min: 4 });
  pushPositiveInt(results, "HoloForge", env, "HOLOFORGE_JOB_TTL_SECONDS", { min: 60 });
  pushPositiveInt(results, "HoloForge", env, "HOLOFORGE_ARTIFACT_TTL_SECONDS", { min: 60 });

  return results;
}

async function resolveExecutable(command) {
  if (!command) return null;
  if (command.includes("/") || command.includes("\\")) {
    try {
      await access(command, constants.X_OK);
      return path.resolve(command);
    } catch {
      return null;
    }
  }
  try {
    const { stdout } = await execFileAsync("which", [command], { timeout: 5000 });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function probeWritableDirectory(directory) {
  if (!path.isAbsolute(directory)) return false;
  const token = `.deployment-check-${process.pid}-${Date.now()}`;
  const probe = path.join(directory, token);
  try {
    await mkdir(directory, { recursive: true });
    await writeFile(probe, "ok", { flag: "wx" });
    await rm(probe, { force: true });
    return true;
  } catch {
    await rm(probe, { force: true }).catch(() => {});
    return false;
  }
}

export function createRealRuntime() {
  return {
    async writableDirectory(directory) {
      return probeWritableDirectory(directory);
    },
    async ffmpeg() {
      const executable = await resolveExecutable("ffmpeg");
      if (!executable) return { ok: false, detail: "FFmpeg executable is unavailable" };
      try {
        const { stdout, stderr } = await execFileAsync(executable, ["-version"], { timeout: 10000 });
        const output = `${stdout}\n${stderr}`;
        return { ok: /ffmpeg version/i.test(output), detail: "FFmpeg executable responds to -version" };
      } catch {
        return { ok: false, detail: "FFmpeg executable failed its version probe" };
      }
    },
    async blender(binary, expectedVersion) {
      const executable = await resolveExecutable(binary || "blender");
      if (!executable) return { ok: false, detail: "Blender executable is unavailable" };
      try {
        const { stdout, stderr } = await execFileAsync(
          executable,
          ["--background", "--version"],
          { timeout: 20000 },
        );
        const output = `${stdout}\n${stderr}`;
        const match = output.match(/Blender\s+(\d+\.\d+\.\d+)/i);
        if (!match) return { ok: false, detail: "Blender version could not be parsed" };
        const actual = match[1];
        return {
          ok: actual === expectedVersion,
          detail:
            actual === expectedVersion
              ? `Blender ${actual} matches the pinned production version`
              : `Blender version mismatch: expected ${expectedVersion}, found ${actual}`,
        };
      } catch {
        return { ok: false, detail: "Blender executable failed its version probe" };
      }
    },
  };
}

function directoryForDatabase(filePath) {
  return path.dirname(filePath);
}

export async function evaluateRuntime(env = process.env, runtime = createRealRuntime()) {
  const results = [];

  const depthDb = String(env.DEPTHPOP_DATABASE_PATH ?? "");
  const depthAssets = String(env.DEPTHPOP_ASSET_ROOT ?? "");
  const depthArtifacts = String(env.DEPTHPOP_ARTIFACT_ROOT ?? "");
  for (const [key, directory] of [
    ["DEPTHPOP_DATABASE_PATH", directoryForDatabase(depthDb)],
    ["DEPTHPOP_ASSET_ROOT", depthAssets],
    ["DEPTHPOP_ARTIFACT_ROOT", depthArtifacts],
  ]) {
    const ok = Boolean(directory) && (await runtime.writableDirectory(directory));
    results.push(
      result(
        "DepthPop",
        ok ? "PASS" : "FAIL",
        `${key}:writable`,
        ok ? `${key} storage is writable` : `${key} storage is not writable`,
      ),
    );
  }

  const depthFfmpeg = await runtime.ffmpeg();
  results.push(
    result("DepthPop", depthFfmpeg.ok ? "PASS" : "FAIL", "FFMPEG", depthFfmpeg.detail),
  );

  const holoDb = String(env.HOLOFORGE_DATABASE_PATH ?? "");
  const holoArtifacts = String(env.HOLOFORGE_ARTIFACT_ROOT ?? "");
  for (const [key, directory] of [
    ["HOLOFORGE_DATABASE_PATH", directoryForDatabase(holoDb)],
    ["HOLOFORGE_ARTIFACT_ROOT", holoArtifacts],
  ]) {
    const ok = Boolean(directory) && (await runtime.writableDirectory(directory));
    results.push(
      result(
        "HoloForge",
        ok ? "PASS" : "FAIL",
        `${key}:writable`,
        ok ? `${key} storage is writable` : `${key} storage is not writable`,
      ),
    );
  }

  const holoFfmpeg = await runtime.ffmpeg();
  results.push(
    result("HoloForge", holoFfmpeg.ok ? "PASS" : "FAIL", "FFMPEG", holoFfmpeg.detail),
  );

  const expectedVersion =
    String(env.HOLOFORGE_BLENDER_VERSION ?? "").trim() || DEFAULT_BLENDER_VERSION;
  const blender = await runtime.blender(String(env.BLENDER_BIN ?? "").trim(), expectedVersion);
  results.push(
    result("HoloForge", blender.ok ? "PASS" : "FAIL", "BLENDER", blender.detail),
  );

  return results;
}

export function summarize(results) {
  return {
    pass: results.filter((item) => item.level === "PASS").length,
    warn: results.filter((item) => item.level === "WARN").length,
    fail: results.filter((item) => item.level === "FAIL").length,
  };
}

export function printResults(results, logger = console.log) {
  for (const app of ["DepthPop", "HoloForge"]) {
    logger(`--- ${app} ---`);
    for (const item of results.filter((candidate) => candidate.app === app)) {
      logger(`${item.level} ${item.key}: ${item.message}`);
    }
    logger("");
  }
  const totals = summarize(results);
  logger(`Deployment readiness: ${totals.pass} PASS / ${totals.warn} WARN / ${totals.fail} FAIL`);
}

function ciFixtureEnvironment() {
  return {
    ENVIRONMENT: "production",
    DEPTHPOP_CANVA_APP_ID: "ci-depthpop-app",
    DEPTHPOP_CANVA_APP_ORIGIN: "https://app-ci-depthpop.canva-apps.com",
    DEPTHPOP_PUBLIC_BASE_URL: "https://depthpop.invalid.example",
    DEPTHPOP_REPOSITORY_BACKEND: "sqlite",
    DEPTHPOP_DATABASE_PATH: DEPTHPOP_PATHS.database,
    DEPTHPOP_ASSET_ROOT: DEPTHPOP_PATHS.assets,
    DEPTHPOP_ARTIFACT_ROOT: DEPTHPOP_PATHS.artifacts,
    DEPTHPOP_ALLOW_BBOX_FALLBACK: "false",
    SEGMENTATION_PROVIDER: "auto",
    DEPTH_PROVIDER: "auto",
    INPAINT_PROVIDER: "auto",
    FAL_KEY: "ci-redacted-placeholder",
    DEPTHPOP_MAX_EXPORT_CONCURRENCY: "2",
    DEPTHPOP_MAX_EXPORT_PIXELS: "16777216",
    DEPTHPOP_MAX_EXPORT_FRAMES: "3600",
    DEPTHPOP_MAX_EXPORT_DURATION_MS: "120000",
    DEPTHPOP_MAX_EXPORT_ARTIFACT_BYTES: "536870912",
    HOLOFORGE_CANVA_APP_ID: "ci-holoforge-app",
    HOLOFORGE_CANVA_APP_ORIGIN: "https://app-ci-holoforge.canva-apps.com",
    HOLOFORGE_PUBLIC_BASE_URL: "https://holoforge.invalid.example",
    HOLOFORGE_REPOSITORY_BACKEND: "sqlite",
    HOLOFORGE_DATABASE_PATH: HOLOFORGE_PATHS.database,
    HOLOFORGE_ARTIFACT_ROOT: HOLOFORGE_PATHS.artifacts,
    BLENDER_BIN: "/opt/blender/blender",
    HOLOFORGE_BLENDER_VERSION: DEFAULT_BLENDER_VERSION,
    HOLOFORGE_RENDER_TIMEOUT_SECONDS: "600",
    HOLOFORGE_MAX_CONCURRENCY: "2",
    HOLOFORGE_MAX_JOBS: "256",
    HOLOFORGE_MAX_ARTIFACTS: "128",
    HOLOFORGE_JOB_TTL_SECONDS: "3600",
    HOLOFORGE_ARTIFACT_TTL_SECONDS: "86400",
  };
}

function ciFixtureRuntime() {
  return {
    async writableDirectory() {
      return true;
    },
    async ffmpeg() {
      return { ok: true, detail: "CI fixture FFmpeg probe passed" };
    },
    async blender(_binary, expectedVersion) {
      return {
        ok: expectedVersion === DEFAULT_BLENDER_VERSION,
        detail: `CI fixture Blender ${DEFAULT_BLENDER_VERSION} matches the pinned production version`,
      };
    },
  };
}

export async function runReadiness({ env = process.env, runtime = createRealRuntime() } = {}) {
  const configuration = evaluateConfiguration(env);
  const runtimeResults = await evaluateRuntime(env, runtime);
  return [...configuration, ...runtimeResults];
}

async function main() {
  const fixture = process.argv.includes("--ci-fixture");
  const env = fixture ? ciFixtureEnvironment() : process.env;
  const runtime = fixture ? ciFixtureRuntime() : createRealRuntime();
  const results = await runReadiness({ env, runtime });
  printResults(results);
  if (summarize(results).fail > 0) {
    process.exitCode = 1;
  }
}

const executedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (executedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("Deployment readiness check failed unexpectedly.");
    if (process.env.DEBUG_DEPLOYMENT_CHECK === "1") {
      console.error(error);
    }
    process.exitCode = 1;
  });
}
