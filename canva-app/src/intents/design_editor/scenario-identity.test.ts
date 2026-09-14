import { describe, expect, it } from "vitest";

import { hasUniqueChangedElementIds, type HoloForgeScenario } from "./scenario-contract";

function scenarioWith(ids: string[]): HoloForgeScenario {
  return {
    candidate: { changedElementIds: ids },
  } as HoloForgeScenario;
}

describe("scenario changed element identity", () => {
  it("accepts unique ids", () => {
    expect(hasUniqueChangedElementIds(scenarioWith(["element-1", "element-2"]))).toBe(true);
  });

  it("fails closed when an id is repeated", () => {
    expect(hasUniqueChangedElementIds(scenarioWith(["element-1", "element-1"]))).toBe(false);
  });
});
