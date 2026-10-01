from __future__ import annotations

from dataclasses import dataclass
from math import hypot


@dataclass(frozen=True)
class Point2:
    x: float
    y: float


@dataclass(frozen=True)
class Edge:
    start: Point2
    end: Point2


def _key(point: Point2) -> tuple[float, float]:
    return (point.x, point.y)


def signed_area(points: list[Point2] | tuple[Point2, ...]) -> float:
    if len(points) < 3:
        return 0.0
    area = 0.0
    for index, current in enumerate(points):
        nxt = points[(index + 1) % len(points)]
        area += current.x * nxt.y - nxt.x * current.y
    return area / 2.0


def _distance(point: Point2, start: Point2, end: Point2) -> float:
    dx = end.x - start.x
    dy = end.y - start.y
    if dx == 0 and dy == 0:
        return hypot(point.x - start.x, point.y - start.y)
    numerator = abs(
        dy * point.x
        - dx * point.y
        + end.x * start.y
        - end.y * start.x
    )
    return numerator / hypot(dx, dy)


def _simplify_open(points: list[Point2], epsilon: float) -> list[Point2]:
    if len(points) <= 2:
        return list(points)

    start = points[0]
    end = points[-1]
    max_distance = 0.0
    split_index = 0

    for index in range(1, len(points) - 1):
        distance = _distance(points[index], start, end)
        if distance > max_distance:
            split_index = index
            max_distance = distance

    if max_distance <= epsilon:
        return [start, end]

    left = _simplify_open(points[: split_index + 1], epsilon)
    right = _simplify_open(points[split_index:], epsilon)
    return left[:-1] + right


def simplify_closed_contour(
    points: list[Point2] | tuple[Point2, ...],
    epsilon: float = 0.8,
) -> list[Point2]:
    if len(points) <= 4:
        return list(points)
    opened = list(points) + [points[0]]
    simplified = _simplify_open(opened, epsilon)
    if simplified and simplified[-1] == simplified[0]:
        simplified.pop()
    return simplified if len(simplified) >= 3 else list(points)


def _boundary_edges(mask: bytes | bytearray | list[int], width: int, height: int) -> list[Edge]:
    def opaque(x: int, y: int) -> bool:
        return (
            0 <= x < width
            and 0 <= y < height
            and int(mask[y * width + x]) > 0
        )

    edges: list[Edge] = []
    for y in range(height):
        for x in range(width):
            if not opaque(x, y):
                continue
            if not opaque(x, y - 1):
                edges.append(Edge(Point2(x, y), Point2(x + 1, y)))
            if not opaque(x + 1, y):
                edges.append(Edge(Point2(x + 1, y), Point2(x + 1, y + 1)))
            if not opaque(x, y + 1):
                edges.append(Edge(Point2(x + 1, y + 1), Point2(x, y + 1)))
            if not opaque(x - 1, y):
                edges.append(Edge(Point2(x, y + 1), Point2(x, y)))
    return edges


def _direction(edge: Edge) -> Point2:
    return Point2(edge.end.x - edge.start.x, edge.end.y - edge.start.y)


def _turn_score(previous: Edge, candidate: Edge) -> int:
    a = _direction(previous)
    b = _direction(candidate)
    cross = a.x * b.y - a.y * b.x
    dot = a.x * b.x + a.y * b.y
    if cross > 0:
        return 0
    if dot > 0:
        return 1
    if cross < 0:
        return 2
    return 3


def trace_alpha_contours(
    mask: bytes | bytearray | list[int],
    width: int,
    height: int,
) -> list[list[Point2]]:
    if width <= 0 or height <= 0 or len(mask) != width * height:
        raise ValueError("alpha mask dimensions are invalid")

    edges = _boundary_edges(mask, width, height)
    outgoing: dict[tuple[float, float], list[int]] = {}
    for index, edge in enumerate(edges):
        outgoing.setdefault(_key(edge.start), []).append(index)

    used: set[int] = set()
    contours: list[list[Point2]] = []

    for start_index in range(len(edges)):
        if start_index in used:
            continue

        contour: list[Point2] = []
        current_index = start_index
        guard = 0

        while current_index not in used and guard <= len(edges) + 2:
            guard += 1
            used.add(current_index)
            current = edges[current_index]
            contour.append(current.start)

            candidates = [
                index
                for index in outgoing.get(_key(current.end), [])
                if index not in used
            ]
            if not candidates:
                break
            candidates.sort(
                key=lambda index: _turn_score(current, edges[index])
            )
            current_index = candidates[0]

        if len(contour) >= 3 and abs(signed_area(contour)) >= 1.0:
            contours.append(contour)

    contours.sort(key=lambda contour: abs(signed_area(contour)), reverse=True)
    return contours


def useful_contours(
    mask: bytes | bytearray | list[int],
    width: int,
    height: int,
    *,
    epsilon: float = 1.0,
    max_contours: int = 32,
    minimum_relative_area: float = 0.002,
) -> list[list[Point2]]:
    contours = trace_alpha_contours(mask, width, height)
    if not contours:
        return []
    largest = abs(signed_area(contours[0]))
    minimum_area = max(2.0, largest * minimum_relative_area)

    useful: list[list[Point2]] = []
    for contour in contours:
        if abs(signed_area(contour)) < minimum_area:
            continue
        simplified = simplify_closed_contour(contour, epsilon)
        if len(simplified) >= 3:
            useful.append(simplified)
        if len(useful) >= max_contours:
            break
    return useful


def normalize_contours(
    contours: list[list[Point2]],
    width: int,
    height: int,
    *,
    target_width: float = 2.3,
) -> list[list[Point2]]:
    if width <= 0 or height <= 0:
        raise ValueError("source dimensions must be positive")
    target_height = target_width * (height / width)
    return [
        [
            Point2(
                x=(point.x / width - 0.5) * target_width,
                y=(0.5 - point.y / height) * target_height,
            )
            for point in contour
        ]
        for contour in contours
    ]
