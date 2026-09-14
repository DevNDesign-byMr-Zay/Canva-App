import type { CanvaDesignSnapshot } from "./canva-design";
import type { CanonicalCandidateElement, HoloForgeScenario } from "./scenario-contract";

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
  changedFields: Array<"x" | "y" | "width" | "height" | "rotation" | "scale">;
};

function projectTransform(
  element: CanvaDesignSnapshot["elements"][number],
  transform: CanonicalCandidateElement,
): ScenarioElementReview["after"] {
  return {
    top: transform.y ?? element.top,
    left: transform.x ?? element.left,
    width: transform.scale === undefined ? (transform.width ?? element.width) : (transform.width ?? element.width) * transform.scale,
    height: transform.scale === undefined ? (transform.height ?? element.height) : (transform.height ?? element.height) * transform.scale,
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
    if (!element || !transform) return [];

    const changedFields = (Object.keys(transform) as Array<keyof CanonicalCandidateElement>)
      .filter((field): field is "x" | "y" | "width" | "height" | "rotation" | "scale" =>
        ["x", "y", "width", "height", "rotation", "scale"].includes(field));

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
