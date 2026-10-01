import type { HoloScene } from "../scene/holo-scene";
import { serializeHoloScene } from "./export-contract";

function safeStem(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "holoforge-scene";
}

export function sceneDownloadName(scene: HoloScene): string {
  return safeStem(scene.id) + ".holoscene.json";
}

export function downloadHoloScene(scene: HoloScene): void {
  const blob = new Blob([serializeHoloScene(scene)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = sceneDownloadName(scene);
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.append(anchor);

  try {
    anchor.click();
  } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
