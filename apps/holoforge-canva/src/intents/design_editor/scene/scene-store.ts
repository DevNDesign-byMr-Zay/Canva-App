import {
  removePoseAtTime,
  upsertTransformPose,
} from "../animation/keyframe-model";
import type {
  HoloAnimationPreset,
  HoloCamera,
  HoloEnvironment,
  HoloScene,
  HoloTimeline,
  SceneTransform,
} from "./holo-scene";
import { patchHoloObject, type HoloObjectPatch } from "./holo-object";

export type HoloSceneState = Readonly<{
  scene: HoloScene;
  selectedObjectId: string | null;
}>;

export type HoloSceneAction =
  | Readonly<{ type: "replace_scene"; scene: HoloScene }>
  | Readonly<{ type: "select_object"; objectId: string | null }>
  | Readonly<{ type: "duplicate_object"; objectId: string }>
  | Readonly<{ type: "remove_object"; objectId: string }>
  | Readonly<{
      type: "move_object";
      objectId: string;
      direction: "forward" | "backward";
    }>
  | Readonly<{
      type: "patch_object";
      objectId: string;
      patch: HoloObjectPatch;
    }>
  | Readonly<{
      type: "patch_transform";
      objectId: string;
      transform: Partial<{
        position: Partial<SceneTransform["position"]>;
        rotation: Partial<SceneTransform["rotation"]>;
        scale: Partial<SceneTransform["scale"]>;
      }>;
    }>
  | Readonly<{ type: "patch_environment"; environment: Partial<HoloEnvironment> }>
  | Readonly<{
      type: "patch_camera";
      camera: Partial<{
        position: Partial<HoloCamera["position"]>;
        target: Partial<HoloCamera["target"]>;
        fov: number;
        near: number;
        far: number;
      }>;
    }>
  | Readonly<{ type: "set_time"; currentTimeMs: number }>
  | Readonly<{ type: "set_playing"; playing: boolean }>
  | Readonly<{
      type: "set_animation_preset";
      objectId: string;
      preset: HoloAnimationPreset;
    }>
  | Readonly<{
      type: "upsert_transform_pose";
      objectId: string;
      timeMs: number;
    }>
  | Readonly<{
      type: "remove_transform_pose";
      objectId: string;
      timeMs: number;
    }>
  | Readonly<{ type: "clear_animation"; objectId: string }>;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function replaceTimeline(scene: HoloScene, timeline: HoloTimeline): HoloScene {
  return Object.freeze({ ...scene, timeline });
}

function duplicateObjectId(scene: HoloScene, sourceId: string): string {
  const ids = new Set(scene.objects.map((object) => object.id));
  let index = 1;
  while (index < 1000) {
    const candidate = `${sourceId}-copy-${String(index).padStart(2, "0")}`;
    if (!ids.has(candidate)) return candidate;
    index += 1;
  }
  return `${sourceId}-copy-${Date.now()}`;
}

export function createHoloSceneState(scene: HoloScene): HoloSceneState {
  return Object.freeze({
    scene,
    selectedObjectId: scene.objects[0]?.id ?? null,
  });
}

export function holoSceneReducer(
  state: HoloSceneState,
  action: HoloSceneAction,
): HoloSceneState {
  switch (action.type) {
    case "replace_scene": {
      const selectedObjectId =
        state.selectedObjectId &&
        action.scene.objects.some((object) => object.id === state.selectedObjectId)
          ? state.selectedObjectId
          : action.scene.objects[0]?.id ?? null;
      return Object.freeze({ scene: action.scene, selectedObjectId });
    }

    case "select_object":
      return Object.freeze({ ...state, selectedObjectId: action.objectId });

    case "duplicate_object": {
      const sourceIndex = state.scene.objects.findIndex(
        (object) => object.id === action.objectId,
      );
      if (sourceIndex < 0) return state;

      const source = state.scene.objects[sourceIndex]!;
      const duplicateId = duplicateObjectId(state.scene, source.id);
      const duplicate = Object.freeze({
        ...source,
        id: duplicateId,
        name: source.name + " COPY",
        transform: Object.freeze({
          position: Object.freeze({
            x: source.transform.position.x + 0.18,
            y: source.transform.position.y - 0.12,
            z: source.transform.position.z + 0.03,
          }),
          rotation: source.transform.rotation,
          scale: source.transform.scale,
        }),
      });
      const objects = [
        ...state.scene.objects.slice(0, sourceIndex + 1),
        duplicate,
        ...state.scene.objects.slice(sourceIndex + 1),
      ];
      return Object.freeze({
        scene: Object.freeze({
          ...state.scene,
          objects: Object.freeze(objects),
        }),
        selectedObjectId: duplicateId,
      });
    }

    case "remove_object": {
      if (state.scene.objects.length <= 1) return state;
      const sourceIndex = state.scene.objects.findIndex(
        (object) => object.id === action.objectId,
      );
      if (sourceIndex < 0) return state;

      const objects = state.scene.objects.filter(
        (object) => object.id !== action.objectId,
      );
      const nextSelected =
        state.selectedObjectId === action.objectId
          ? objects[Math.min(sourceIndex, objects.length - 1)]?.id ?? null
          : state.selectedObjectId;

      return Object.freeze({
        scene: Object.freeze({
          ...state.scene,
          objects: Object.freeze(objects),
        }),
        selectedObjectId: nextSelected,
      });
    }

    case "move_object": {
      const sourceIndex = state.scene.objects.findIndex(
        (object) => object.id === action.objectId,
      );
      if (sourceIndex < 0) return state;
      const targetIndex =
        action.direction === "forward"
          ? sourceIndex + 1
          : sourceIndex - 1;
      if (targetIndex < 0 || targetIndex >= state.scene.objects.length) {
        return state;
      }

      const objects = [...state.scene.objects];
      const [source] = objects.splice(sourceIndex, 1);
      if (!source) return state;
      objects.splice(targetIndex, 0, source);

      return Object.freeze({
        ...state,
        scene: Object.freeze({
          ...state.scene,
          objects: Object.freeze(objects),
        }),
      });
    }

    case "patch_object": {
      const objects = state.scene.objects.map((object) =>
        object.id === action.objectId
          ? patchHoloObject(object, action.patch)
          : object,
      );
      return Object.freeze({
        ...state,
        scene: Object.freeze({ ...state.scene, objects: Object.freeze(objects) }),
      });
    }

    case "patch_transform": {
      const objects = state.scene.objects.map((object) =>
        object.id === action.objectId
          ? patchHoloObject(object, { transform: action.transform })
          : object,
      );
      return Object.freeze({
        ...state,
        scene: Object.freeze({ ...state.scene, objects: Object.freeze(objects) }),
      });
    }

    case "patch_environment": {
      const current = state.scene.environment;
      const next = Object.freeze({
        ...current,
        ...action.environment,
        ambientIntensity:
          action.environment.ambientIntensity === undefined
            ? current.ambientIntensity
            : clamp(action.environment.ambientIntensity, 0, 5),
        keyLightIntensity:
          action.environment.keyLightIntensity === undefined
            ? current.keyLightIntensity
            : clamp(action.environment.keyLightIntensity, 0, 8),
        rimLightIntensity:
          action.environment.rimLightIntensity === undefined
            ? current.rimLightIntensity
            : clamp(action.environment.rimLightIntensity, 0, 8),
      });
      return Object.freeze({
        ...state,
        scene: Object.freeze({ ...state.scene, environment: next }),
      });
    }

    case "patch_camera": {
      const current = state.scene.camera;
      const requestedNear =
        action.camera.near === undefined
          ? current.near
          : clamp(action.camera.near, 0.001, 10);
      const requestedFar =
        action.camera.far === undefined
          ? current.far
          : clamp(action.camera.far, requestedNear + 0.01, 10000);
      const next = Object.freeze({
        ...current,
        ...action.camera,
        position: Object.freeze({
          ...current.position,
          ...action.camera.position,
        }),
        target: Object.freeze({
          ...current.target,
          ...action.camera.target,
        }),
        fov:
          action.camera.fov === undefined
            ? current.fov
            : clamp(action.camera.fov, 15, 110),
        near: requestedNear,
        far: requestedFar,
      });
      return Object.freeze({
        ...state,
        scene: Object.freeze({ ...state.scene, camera: next }),
      });
    }

    case "set_time": {
      const clamped = Math.max(
        0,
        Math.min(state.scene.timeline.durationMs, action.currentTimeMs),
      );
      return Object.freeze({
        ...state,
        scene: replaceTimeline(
          state.scene,
          Object.freeze({ ...state.scene.timeline, currentTimeMs: clamped }),
        ),
      });
    }

    case "set_playing":
      return Object.freeze({
        ...state,
        scene: replaceTimeline(
          state.scene,
          Object.freeze({ ...state.scene.timeline, playing: action.playing }),
        ),
      });

    case "set_animation_preset": {
      const objects = state.scene.objects.map((object) =>
        object.id === action.objectId
          ? Object.freeze({ ...object, animationPreset: action.preset })
          : object,
      );
      return Object.freeze({
        ...state,
        scene: Object.freeze({ ...state.scene, objects: Object.freeze(objects) }),
      });
    }

    case "upsert_transform_pose": {
      const objects = state.scene.objects.map((object) =>
        object.id === action.objectId
          ? Object.freeze({
              ...object,
              animationPreset: "custom" as const,
              animationTracks: upsertTransformPose(
                object.animationTracks,
                object.transform,
                action.timeMs,
              ),
            })
          : object,
      );
      return Object.freeze({
        ...state,
        scene: Object.freeze({ ...state.scene, objects: Object.freeze(objects) }),
      });
    }

    case "remove_transform_pose": {
      const objects = state.scene.objects.map((object) =>
        object.id === action.objectId
          ? Object.freeze({
              ...object,
              animationTracks: removePoseAtTime(
                object.animationTracks,
                action.timeMs,
              ),
            })
          : object,
      );
      return Object.freeze({
        ...state,
        scene: Object.freeze({ ...state.scene, objects: Object.freeze(objects) }),
      });
    }

    case "clear_animation": {
      const objects = state.scene.objects.map((object) =>
        object.id === action.objectId
          ? Object.freeze({
              ...object,
              animationPreset: "static" as const,
              animationTracks: Object.freeze([]),
            })
          : object,
      );
      return Object.freeze({
        ...state,
        scene: Object.freeze({ ...state.scene, objects: Object.freeze(objects) }),
      });
    }

    default:
      return state;
  }
}
