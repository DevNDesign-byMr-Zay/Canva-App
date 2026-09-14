import type { CanvaDesignSnapshot } from "./canva-design";
import {
  isCanvaWritableTransform,
  type CanonicalCandidateElement,
  type HoloForgeScenario,
} from "./scenario-contract";

export type ScenarioElementReview = {
  elementId: string;
  before: {
    top: number;
    left: number;
    width: number;
    height: number;
    rotation: number;
  };
  after: {
    top: number;
    left: number;
    width: number;
    height: number;
    rotation: number;
  };
  changedFields: Array<"x" | "y" | "rotation">;
};

function projectTransform(
  element: CanvaDesignSnapshot["elements"][number],
  transform: CanonicalCandidateElement,
): ScenarioElementReview["after"] {
  return {
    top: transform.y ?? element.top,
    left: transform.x ?? element.left,
    width: element.width,
    height: element.height,
    rotation: transform.rotation ?? element.rotation,
  };
}

export function buildScenarioReview(
  scenario: HoloForgeScenario,
  snapshot: CanvaDesignSnapshot,
): ScenarioElementReview[] {
  const elements = new Map(snapshot.elements.map((element) => [element.id, element]));

  return scenario.candidate.changedElementIds.flatMap((elementId) => {
    const element = elements.get(elementId);
    const transform = scenario.candidate.layout.elements[elementId];
    if (!element || !transform || !isCanvaWritableTransform(transform)) return [];

    const changedFields = (Object.keys(transform) as Array<keyof CanonicalCandidateElement>)
      .filter((field): field is "x" | "y" | "rotation" =>
        ["x", "y", "rotation"].includes(field));

    return [{
      elementId,
      before: {
        top: element.top,
        left: element.left,
        width: element.width,
        height: element.height,
        rotation: element.rotation,
      },
      after: projectTransform(element, transform),
      changedFields,
    }];
  });
}
