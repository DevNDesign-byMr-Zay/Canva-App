import type {
  AnimationTrack,
  DepthObject,
  DepthScene,
} from "../scene/depth-scene";

export type MotionPresetName =
  | "PARALLAX"
  | "CAMERA_PUSH"
  | "FLOAT"
  | "ORBIT"
  | "DEPTH_REVEAL"
  | "RACK_FOCUS";

function replaceTracks(
  object: DepthObject,
  properties: AnimationTrack["property"][],
  tracks: AnimationTrack[],
): DepthObject {
  const blocked = new Set(properties);
  return {
    ...object,
    animationTracks: object.animationTracks
      .filter((track) => !blocked.has(track.property))
      .concat(tracks),
  };
}

function track(
  objectId: string,
  property: AnimationTrack["property"],
  keyframes: AnimationTrack["keyframes"],
): AnimationTrack {
  return {
    id: `${objectId}-preset-${property.replace(".", "-")}`,
    property,
    keyframes,
  };
}

export function applyMotionPreset(
  scene: DepthScene,
  preset: MotionPresetName,
): DepthScene {
  const durationMs = Math.max(1000, scene.timeline.durationMs || 3000);
  const midpoint = Math.round(durationMs / 2);
  const quarter = Math.round(durationMs / 4);
  const threeQuarter = Math.round((durationMs * 3) / 4);

  const objects = scene.objects.map((object, index) => {
    if (object.locked) return object;

    const x = object.transform.position.x;
    const y = object.transform.position.y;
    const z = object.transform.position.z;
    const offset = Math.min(0.12, 0.025 * (index + 1));

    if (preset === "PARALLAX") {
      return replaceTracks(
        object,
        ["position.x"],
        [
          track(object.id, "position.x", [
            {
              timeMs: 0,
              value: x - offset,
              easing: "ease-in-out",
            },
            {
              timeMs: durationMs,
              value: x + offset,
              easing: "ease-in-out",
            },
          ]),
        ],
      );
    }

    if (preset === "CAMERA_PUSH") {
      const depthOffset = 0.35 + Math.min(0.65, Math.abs(z) * 0.15);
      return replaceTracks(
        object,
        ["position.z", "scale.x", "scale.y"],
        [
          track(object.id, "position.z", [
            { timeMs: 0, value: z, easing: "ease-in-out" },
            {
              timeMs: durationMs,
              value: z + depthOffset,
              easing: "ease-in-out",
            },
          ]),
          track(object.id, "scale.x", [
            {
              timeMs: 0,
              value: object.transform.scale.x,
              easing: "ease-in-out",
            },
            {
              timeMs: durationMs,
              value: object.transform.scale.x * 1.06,
              easing: "ease-in-out",
            },
          ]),
          track(object.id, "scale.y", [
            {
              timeMs: 0,
              value: object.transform.scale.y,
              easing: "ease-in-out",
            },
            {
              timeMs: durationMs,
              value: object.transform.scale.y * 1.06,
              easing: "ease-in-out",
            },
          ]),
        ],
      );
    }

    if (preset === "FLOAT") {
      return replaceTracks(
        object,
        ["position.y"],
        [
          track(object.id, "position.y", [
            { timeMs: 0, value: y, easing: "ease-in-out" },
            {
              timeMs: midpoint,
              value: y - 0.05,
              easing: "ease-in-out",
            },
            {
              timeMs: durationMs,
              value: y,
              easing: "ease-in-out",
            },
          ]),
        ],
      );
    }

    if (preset === "ORBIT") {
      const radius = 0.035 + Math.min(0.04, index * 0.005);
      return replaceTracks(
        object,
        ["position.x", "position.y", "rotation.z"],
        [
          track(object.id, "position.x", [
            { timeMs: 0, value: x + radius, easing: "linear" },
            { timeMs: quarter, value: x, easing: "linear" },
            { timeMs: midpoint, value: x - radius, easing: "linear" },
            { timeMs: threeQuarter, value: x, easing: "linear" },
            {
              timeMs: durationMs,
              value: x + radius,
              easing: "linear",
            },
          ]),
          track(object.id, "position.y", [
            { timeMs: 0, value: y, easing: "linear" },
            {
              timeMs: quarter,
              value: y - radius,
              easing: "linear",
            },
            { timeMs: midpoint, value: y, easing: "linear" },
            {
              timeMs: threeQuarter,
              value: y + radius,
              easing: "linear",
            },
            { timeMs: durationMs, value: y, easing: "linear" },
          ]),
          track(object.id, "rotation.z", [
            {
              timeMs: 0,
              value: object.transform.rotation.z,
              easing: "linear",
            },
            {
              timeMs: durationMs,
              value: object.transform.rotation.z + 360,
              easing: "linear",
            },
          ]),
        ],
      );
    }

    if (preset === "DEPTH_REVEAL") {
      return replaceTracks(
        object,
        ["position.z", "opacity"],
        [
          track(object.id, "position.z", [
            {
              timeMs: 0,
              value: z - 0.5,
              easing: "ease-out",
            },
            {
              timeMs: durationMs,
              value: z,
              easing: "ease-out",
            },
          ]),
          track(object.id, "opacity", [
            { timeMs: 0, value: 0, easing: "ease-out" },
            {
              timeMs: Math.max(1, Math.round(durationMs * 0.4)),
              value: object.opacity,
              easing: "ease-out",
            },
            {
              timeMs: durationMs,
              value: object.opacity,
              easing: "linear",
            },
          ]),
        ],
      );
    }

    // DepthScene v1 does not yet expose an animatable focal-distance field.
    // RACK_FOCUS therefore authors a truthful depth-emphasis animation using
    // supported opacity + Z tracks instead of pretending a nonexistent camera
    // focus parameter exists.
    const normalizedDepth = Math.max(0, Math.min(1, object.depth.median));
    const focusOpacity = 0.3 + normalizedDepth * 0.7;
    return replaceTracks(
      object,
      ["opacity", "position.z"],
      [
        track(object.id, "opacity", [
          {
            timeMs: 0,
            value: Math.max(0.2, 1 - normalizedDepth * 0.65),
            easing: "ease-in-out",
          },
          {
            timeMs: midpoint,
            value: focusOpacity,
            easing: "ease-in-out",
          },
          {
            timeMs: durationMs,
            value: object.opacity,
            easing: "ease-in-out",
          },
        ]),
        track(object.id, "position.z", [
          { timeMs: 0, value: z - 0.08, easing: "ease-in-out" },
          {
            timeMs: midpoint,
            value: z + normalizedDepth * 0.12,
            easing: "ease-in-out",
          },
          {
            timeMs: durationMs,
            value: z,
            easing: "ease-in-out",
          },
        ]),
      ],
    );
  });

  return {
    ...scene,
    timeline: {
      ...scene.timeline,
      durationMs,
      currentTimeMs: Math.min(scene.timeline.currentTimeMs, durationMs),
    },
    objects,
    updatedAt: new Date().toISOString(),
  };
}
