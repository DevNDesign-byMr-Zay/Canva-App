import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";

const MAINTAINED_ROOTS = Object.freeze(["backend", "runtime", "src"]);
const JAVASCRIPT_EXTENSIONS = new Set([".js", ".mjs", ".cjs"]);

async function collectJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectJavaScriptFiles(target)));
    } else if (entry.isFile() && JAVASCRIPT_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(target);
    }
  }

  return files;
}

const files = (
  await Promise.all(MAINTAINED_ROOTS.map((directory) => collectJavaScriptFiles(directory)))
)
  .flat()
  .sort();

if (files.length === 0) {
  throw new Error("No maintained JavaScript files were discovered.");
}

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.status !== 0) {
    process.stderr.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    throw new Error(`Syntax validation failed: ${file}`);
  }
}

process.stdout.write(`Validated JavaScript syntax for ${files.length} maintained files.\n`);
