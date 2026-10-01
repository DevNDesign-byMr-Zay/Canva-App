import {
  removePoseAtTime,
  upsertTransformPose,
} from "../animation/keyframe-model";
import type {
  HoloAnimationPreset,
  HoloScene,
  HoloTimeline,
  SceneTransform,
} from "./holo-scene";
import { patchHoloObject } from "./holo-object";

export type HoloSceneState = Readonly<{
  scene: HoloScene;
  selectedObjectId: string | null;
}>;

export type HoloSceneAction =
  | Readonly<{ type: "replace_scene"; scene: HoloScene }>
  | Readonly<{ type: "select_object"; objectId: string | null }>
  | Readonly<{
      type: "patch_transform";
      objectId: string;
      transform: Partial<{
        position: Partial<SceneTransform["position"]>;
        rotation: Partial<SceneTransform["rotation"]>;
        scale: Partial<SceneTransform["scale"]>;
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

function replaceTimeline(scene: HoloScene, timeline: HoloTimeline): HoloScene {
  return Object.freeze({ ...scene, timeline });
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
