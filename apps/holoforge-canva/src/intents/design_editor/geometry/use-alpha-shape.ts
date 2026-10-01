import { useEffect, useMemo, useState } from "react";
import { Shape } from "three";

import {
  normalizeContours,
  usefulAlphaContours,
  type Point2,
} from "./alpha-contour";

export type AlphaShapeResult = Readonly<{
  shape: Shape | null;
  shapes: readonly Shape[];
  width: number;
  height: number;
  status: "idle" | "loading" | "ready" | "fallback" | "error";
}>;

const EMPTY: AlphaShapeResult = Object.freeze({
  shape: null,
  shapes: Object.freeze([]),
  width: 2.3,
  height: 1.45,
  status: "idle",
});

function contourToShape(contour: readonly Point2[]): Shape | null {
  if (contour.length < 3) return null;
  const shape = new Shape();
  shape.moveTo(contour[0]!.x, contour[0]!.y);
  for (let index = 1; index < contour.length; index += 1) {
    shape.lineTo(contour[index]!.x, contour[index]!.y);
  }
  shape.closePath();
  return shape;
}

export function useAlphaShape(url?: string): AlphaShapeResult {
  const [result, setResult] = useState<AlphaShapeResult>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    if (!url) {
      setResult(EMPTY);
      return () => {
        cancelled = true;
      };
    }

    setResult(Object.freeze({ ...EMPTY, status: "loading" }));

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (cancelled) return;

      try {
        const sourceWidth = image.naturalWidth || image.width;
        const sourceHeight = image.naturalHeight || image.height;
        const maxSide = 160;
        const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
        const width = Math.max(2, Math.round(sourceWidth * scale));
        const height = Math.max(2, Math.round(sourceHeight * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("Canvas alpha analysis is unavailable.");

        context.clearRect(0, 0, width, height);
        context.drawImage(image, 0, 0, width, height);
        const pixels = context.getImageData(0, 0, width, height).data;
        const mask = new Uint8Array(width * height);
        let opaque = 0;

        for (let index = 0; index < mask.length; index += 1) {
          const alpha = pixels[index * 4 + 3] ?? 0;
          if (alpha >= 24) {
            mask[index] = 1;
            opaque += 1;
          }
        }

        const coverage = opaque / mask.length;
        const targetWidth = 2.3;
        const targetHeight = targetWidth * (sourceHeight / Math.max(1, sourceWidth));

        if (coverage >= 0.985 || coverage <= 0.002) {
          setResult(
            Object.freeze({
              shape: null,
              shapes: Object.freeze([]),
              width: targetWidth,
              height: targetHeight,
              status: "fallback",
            }),
          );
          return;
        }

        const contours = usefulAlphaContours(mask, width, height, 1.15, 32, 0.002);
        const normalized = normalizeContours(contours, width, height, targetWidth);
        const shapes = Object.freeze(
          normalized
            .map((contour) => contourToShape(contour))
            .filter((shape): shape is Shape => shape !== null),
        );
        const shape = shapes[0] ?? null;

        setResult(
          Object.freeze({
            shape,
            shapes,
            width: targetWidth,
            height: targetHeight,
            status: shapes.length ? "ready" : "fallback",
          }),
        );
      } catch {
        setResult(Object.freeze({ ...EMPTY, status: "error" }));
      }
    };

    image.onerror = () => {
      if (!cancelled) setResult(Object.freeze({ ...EMPTY, status: "error" }));
    };
    image.src = url;

    return () => {
      cancelled = true;
    };
  }, [url]);

  return useMemo(() => result, [result]);
}
