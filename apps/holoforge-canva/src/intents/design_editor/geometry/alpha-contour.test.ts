import { describe, expect, it } from "vitest";

import {
  largestAlphaContour,
  normalizeContour,
  traceAlphaContours,
} from "./alpha-contour";

describe("alpha contour extraction", () => {
  it("extracts one closed object from an opaque block", () => {
    const mask = new Uint8Array([
      0,0,0,0,0,
      0,1,1,1,0,
      0,1,1,1,0,
      0,1,1,1,0,
      0,0,0,0,0,
    ]);

    const contours = traceAlphaContours(mask, 5, 5);
    expect(contours).toHaveLength(1);
    expect(contours[0]!.length).toBeGreaterThanOrEqual(4);
  });

  it("keeps the largest disconnected silhouette", () => {
    const mask = new Uint8Array([
      1,0,0,0,0,0,
      0,0,1,1,1,0,
      0,0,1,1,1,0,
      0,0,1,1,1,0,
    ]);

    const contour = largestAlphaContour(mask, 6, 4, 0);
    expect(contour.length).toBeGreaterThanOrEqual(4);
    const xs = contour.map((point) => point.x);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(2);
  });

  it("normalizes the contour around the scene origin while preserving aspect", () => {
    const normalized = normalizeContour(
      [
        {x:0,y:0},
        {x:4,y:0},
        {x:4,y:2},
        {x:0,y:2},
      ],
      4,
      2,
      2,
    );

    expect(normalized[0]).toEqual({x:-1,y:0.5});
    expect(normalized[2]).toEqual({x:1,y:-0.5});
  });

  it("rejects inconsistent mask dimensions", () => {
    expect(() => traceAlphaContours(new Uint8Array([1, 1]), 2, 2)).toThrow(
      /dimensions/i,
    );
  });
});
