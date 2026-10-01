export type Point2 = Readonly<{ x: number; y: number }>;

type Edge = Readonly<{ from: Point2; to: Point2 }>;

const key = (point: Point2) => point.x + "," + point.y;

function signedArea(points: readonly Point2[]): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    area += current.x * next.y - next.x * current.y;
  }
  return area / 2;
}

function perpendicularDistance(point: Point2, start: Point2, end: Point2): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }
  const numerator = Math.abs(
    dy * point.x - dx * point.y + end.x * start.y - end.y * start.x,
  );
  return numerator / Math.hypot(dx, dy);
}

function simplifyOpen(points: readonly Point2[], epsilon: number): Point2[] {
  if (points.length <= 2) return [...points];

  let maxDistance = 0;
  let splitIndex = 0;
  const start = points[0]!;
  const end = points[points.length - 1]!;

  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = perpendicularDistance(points[index]!, start, end);
    if (distance > maxDistance) {
      splitIndex = index;
      maxDistance = distance;
    }
  }

  if (maxDistance <= epsilon) return [start, end];

  const left = simplifyOpen(points.slice(0, splitIndex + 1), epsilon);
  const right = simplifyOpen(points.slice(splitIndex), epsilon);
  return [...left.slice(0, -1), ...right];
}

export function simplifyClosedContour(
  points: readonly Point2[],
  epsilon = 0.8,
): readonly Point2[] {
  if (points.length <= 4) return Object.freeze([...points]);
  const open = [...points, points[0]!];
  const simplified = simplifyOpen(open, epsilon);
  simplified.pop();
  return Object.freeze(simplified.length >= 3 ? simplified : [...points]);
}

function boundaryEdges(
  mask: Uint8Array,
  width: number,
  height: number,
): readonly Edge[] {
  const edges: Edge[] = [];
  const isOpaque = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] > 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isOpaque(x, y)) continue;

      if (!isOpaque(x, y - 1)) {
        edges.push({ from: { x, y }, to: { x: x + 1, y } });
      }
      if (!isOpaque(x + 1, y)) {
        edges.push({ from: { x: x + 1, y }, to: { x: x + 1, y: y + 1 } });
      }
      if (!isOpaque(x, y + 1)) {
        edges.push({ from: { x: x + 1, y: y + 1 }, to: { x, y: y + 1 } });
      }
      if (!isOpaque(x - 1, y)) {
        edges.push({ from: { x, y: y + 1 }, to: { x, y } });
      }
    }
  }
  return Object.freeze(edges);
}

function edgeDirection(edge: Edge): Point2 {
  return { x: edge.to.x - edge.from.x, y: edge.to.y - edge.from.y };
}

function turnScore(previous: Edge, candidate: Edge): number {
  const a = edgeDirection(previous);
  const b = edgeDirection(candidate);
  const cross = a.x * b.y - a.y * b.x;
  const dot = a.x * b.x + a.y * b.y;
  if (cross > 0) return 0;
  if (dot > 0) return 1;
  if (cross < 0) return 2;
  return 3;
}

export function traceAlphaContours(
  mask: Uint8Array,
  width: number,
  height: number,
): readonly (readonly Point2[])[] {
  if (width <= 0 || height <= 0 || mask.length !== width * height) {
    throw new Error("Alpha mask dimensions are invalid.");
  }

  const edges = [...boundaryEdges(mask, width, height)];
  const outgoing = new Map<string, number[]>();
  edges.forEach((edge, index) => {
    const edgeKey = key(edge.from);
    const bucket = outgoing.get(edgeKey) ?? [];
    bucket.push(index);
    outgoing.set(edgeKey, bucket);
  });

  const used = new Set<number>();
  const contours: Point2[][] = [];

  for (let startIndex = 0; startIndex < edges.length; startIndex += 1) {
    if (used.has(startIndex)) continue;

    const contour: Point2[] = [];
    let currentIndex = startIndex;
    let guard = 0;

    while (!used.has(currentIndex) && guard <= edges.length + 2) {
      guard += 1;
      used.add(currentIndex);
      const current = edges[currentIndex]!;
      contour.push(current.from);

      const candidates = (outgoing.get(key(current.to)) ?? []).filter(
        (index) => !used.has(index),
      );
      if (!candidates.length) break;

      candidates.sort(
        (left, right) =>
          turnScore(current, edges[left]!) - turnScore(current, edges[right]!),
      );
      currentIndex = candidates[0]!;
    }

    if (contour.length >= 3 && Math.abs(signedArea(contour)) >= 1) {
      contours.push(contour);
    }
  }

  return Object.freeze(
    contours
      .sort((a, b) => Math.abs(signedArea(b)) - Math.abs(signedArea(a)))
      .map((contour) => Object.freeze(contour)),
  );
}

export function usefulAlphaContours(
  mask: Uint8Array,
  width: number,
  height: number,
  epsilon = 1.15,
  maxContours = 32,
  minimumRelativeArea = 0.002,
): readonly (readonly Point2[])[] {
  const contours = traceAlphaContours(mask, width, height);
  if (!contours.length) return Object.freeze([]);

  const largest = Math.abs(signedArea(contours[0]!));
  const minimumArea = Math.max(2, largest * minimumRelativeArea);
  const useful: (readonly Point2[])[] = [];

  for (const contour of contours) {
    if (Math.abs(signedArea(contour)) < minimumArea) continue;
    const simplified = simplifyClosedContour(contour, epsilon);
    if (simplified.length >= 3) useful.push(simplified);
    if (useful.length >= maxContours) break;
  }

  return Object.freeze(useful);
}

export function largestAlphaContour(
  mask: Uint8Array,
  width: number,
  height: number,
  epsilon = 0.8,
): readonly Point2[] {
  const contour = traceAlphaContours(mask, width, height)[0];
  if (!contour) return Object.freeze([]);
  return simplifyClosedContour(contour, epsilon);
}

export function normalizeContour(
  contour: readonly Point2[],
  width: number,
  height: number,
  targetWidth = 2.3,
): readonly Point2[] {
  if (!contour.length) return Object.freeze([]);
  const aspect = height / Math.max(1, width);
  const targetHeight = targetWidth * aspect;

  return Object.freeze(
    contour.map((point) =>
      Object.freeze({
        x: (point.x / width - 0.5) * targetWidth,
        y: (0.5 - point.y / height) * targetHeight,
      }),
    ),
  );
}


export function normalizeContours(
  contours: readonly (readonly Point2[])[],
  width: number,
  height: number,
  targetWidth = 2.3,
): readonly (readonly Point2[])[] {
  if (width <= 0 || height <= 0) {
    throw new Error("Source dimensions must be positive.");
  }

  return Object.freeze(
    contours.map((contour) =>
      normalizeContour(contour, width, height, targetWidth),
    ),
  );
}
