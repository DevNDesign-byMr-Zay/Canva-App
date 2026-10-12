import { access, constants } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function checkBinary(command) {
  try {
    await execFileAsync("which", [command]);
    return true;
  } catch {
    return false;
  }
}

async function checkWritable(path) {
  try {
    await access(path, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log("=== CANVA STANDALONE APPS DEPLOYMENT READINESS CHECK ===\n");

  let hasErrors = false;

  // DepthPop Checks
  console.log("--- DepthPop Canva App ---");
  const depthpopAppId = process.env.CANVA_APP_ID || process.env.DEPTHPOP_CANVA_APP_ID;
  if (depthpopAppId) {
    console.log("PASS Canva app identity configured");
  } else {
    console.log("WARN Canva app identity (CANVA_APP_ID) not set in environment");
  }

  const depthpopPublicUrl = process.env.PUBLIC_BASE_URL || "http://localhost:8000";
  if (depthpopPublicUrl.startsWith("https://")) {
    console.log("PASS public HTTPS origin configured");
  } else {
    console.log(`WARN public URL (${depthpopPublicUrl}) does not use HTTPS schema`);
  }

  const depthpopRepo = process.env.DEPTHPOP_REPOSITORY_BACKEND || "sqlite";
  if (depthpopRepo === "sqlite") {
    console.log("PASS SQLite persistence configured");
  } else {
    console.log(`WARN repository backend is '${depthpopRepo}' (expected 'sqlite')`);
  }

  const ffmpegPresent = await checkBinary("ffmpeg");
  if (ffmpegPresent) {
    console.log("PASS FFmpeg binary present");
  } else {
    console.log("WARN FFmpeg binary not found on PATH");
  }

  const falKey = process.env.FAL_KEY;
  if (falKey) {
    console.log("PASS live FAL provider key configured");
  } else {
    console.log("WARN FAL_KEY not provided (live provider calls will fail closed in production)");
  }

  console.log("\n--- HoloForge Canva App ---");
  const holoforgeRepo = process.env.HOLOFORGE_REPOSITORY_BACKEND || "sqlite";
  if (holoforgeRepo === "sqlite") {
    console.log("PASS SQLite persistence configured");
  } else {
    console.log(`WARN repository backend is '${holoforgeRepo}' (expected 'sqlite')`);
  }

  const blenderPresent = await checkBinary("blender") || Boolean(process.env.BLENDER_BIN);
  if (blenderPresent) {
    console.log("PASS Blender binary present/configured");
  } else {
    console.log("WARN Blender binary not found on PATH or via BLENDER_BIN");
  }

  console.log("\nDeployment readiness verification finished.");
  if (hasErrors) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal deployment check error:", err);
  process.exit(1);
});
