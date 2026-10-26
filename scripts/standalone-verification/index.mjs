import fs from "node:fs";
import path from "node:path";
import { APPS } from "./apps.mjs";
import { verifyLayout } from "./verify-layout.mjs";
import { verifyServices } from "./verify-services.mjs";
import { verifyHoloForge } from "./verify-holoforge.mjs";
import { verifyHandoff } from "./verify-handoff.mjs";

export function verifyStandaloneApps(root = process.cwd()) {
  const failures = [];
  const context = {
    root, APPS,
    full: (appRoot, relative) => path.join(root, appRoot, relative),
    readText: file => fs.readFileSync(file, "utf8"),
    fail: message => failures.push(message),
  };
  for (const verify of [verifyLayout, verifyServices, verifyHoloForge, verifyHandoff]) {
    verify(context);
  }
  return failures;
}
