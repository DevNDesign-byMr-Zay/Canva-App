import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] || ".artifacts/independent-canva-apps");
const apps = [
  { name: "holoforge-canva", other: "depthpop-canva" },
  { name: "depthpop-canva", other: "holoforge-canva" },
];

const forbiddenDirs = new Set([
  "reference",
  "node_modules",
  ".git",
  ".venv",
  "venv",
  "coverage",
  "__pycache__",
  ".pytest_cache",
  "artifacts",
  "artifact",
  "outputs",
  "output",
  "tmp",
  "temp",
]);

const forbiddenExt = new Set([
  ".sqlite",
  ".sqlite3",
  ".db",
  ".pyc",
  ".log",
]);

function walk(directory, base = directory) {
  const out = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(base, absolute).split(path.sep).join("/");
    out.push({ absolute, relative, entry });
    if (entry.isDirectory()) out.push(...walk(absolute, base));
  }
  return out;
}

function isForbiddenEnv(name) {
  if (!name.startsWith(".env")) return false;
  return ![".env.example", ".env.template"].includes(name);
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

for (const app of apps) {
  const appRoot = path.join(root, app.name);
  if (!fs.existsSync(appRoot)) {
    fail(`Missing assembled app directory: ${appRoot}`);
    continue;
  }

  const entries = walk(appRoot);
  for (const item of entries) {
    const parts = item.relative.split("/");
    if (parts.some((part) => forbiddenDirs.has(part))) {
      fail(`${app.name}: forbidden directory in handoff: ${item.relative}`);
    }

    if (item.entry.isFile()) {
      const basename = path.basename(item.relative);
      if (isForbiddenEnv(basename)) {
        fail(`${app.name}: populated/local env file in handoff: ${item.relative}`);
      }
      if (forbiddenExt.has(path.extname(basename).toLowerCase())) {
        fail(`${app.name}: persistence/cache file in handoff: ${item.relative}`);
      }
    }

    if (parts.includes(app.other)) {
      fail(`${app.name}: cross-product source leaked into handoff: ${item.relative}`);
    }

    if (
      item.relative === "canva-app" ||
      item.relative.startsWith("canva-app/") ||
      item.relative === "app/authenticated-v115" ||
      item.relative.startsWith("app/authenticated-v115/")
    ) {
      fail(`${app.name}: historical compatibility surface leaked: ${item.relative}`);
    }
  }

  for (const required of [
    "app.js",
    "canva-app.json",
    "START-HERE.html",
    "preview/index.html",
    "backend/app.py",
  ]) {
    const target = path.join(appRoot, ...required.split("/"));
    if (!fs.existsSync(target) || fs.statSync(target).size <= 0) {
      fail(`${app.name}: required handoff file missing or empty: ${required}`);
    }
  }
}

if (process.exitCode) {
  console.error("Standalone Canva handoff integrity verification failed.");
} else {
  console.log("Standalone Canva handoff integrity verification passed.");
}
