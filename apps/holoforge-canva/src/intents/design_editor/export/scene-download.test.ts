import { describe, expect, it } from "vitest";
import type { HoloScene } from "../scene/holo-scene";
import { sceneDownloadName } from "./scene-download";

describe("HoloScene download naming", () => {
  it("creates a stable portable scene filename", () => {
    expect(sceneDownloadName({ id: "HF Scene / Gold" } as HoloScene)).toBe(
      "HF-Scene-Gold.holoscene.json",
    );
  });
});
