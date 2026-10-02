import {
  DepthObject,
  DepthScene,
  Vector3,
} from "../scene/depth-scene";

export type TransformPatch = Readonly<{
  position?: Partial<Vector3>;
  rotation?: Partial<Vector3>;
  scale?: Partial<Vector3>;
}>;

export type SceneAction =
  | { type: "SELECT_OBJECT"; objectId: string | null }
  | {
      type: "PATCH_TRANSFORM";
      objectId: string;
      transform: TransformPatch;
    }
  | { type: "SET_VISIBILITY"; objectId: string; visible: boolean }
  | { type: "SET_LOCK"; objectId: string; locked: boolean }
  | { type: "SET_OPACITY"; objectId: string; opacity: number }
  | { type: "SET_FEATHER"; objectId: string; feather: number }
  | { type: "MOVE_OBJECT_ORDER"; objectId: string; direction: "up" | "down" }
  | { type: "RESET_OBJECT"; objectId: string }
  | { type: "RESET_SCENE" }
  | { type: "COMMIT_SCENE"; scene: DepthScene }
  | { type: "PATCH_CAMERA"; camera: Partial<DepthScene["camera"]> }
  | { type: "SET_TIME"; currentTimeMs: number }
  | { type: "SET_PARALLAX_STRENGTH"; value: number };

export interface SceneState {
  initialScene: DepthScene;
  currentScene: DepthScene;
  selectedObjectId: string | null;
  parallaxStrength: number;
}

function changedScene(
  scene: DepthScene,
  objects: DepthObject[] = scene.objects,
): DepthScene {
  return {
    ...scene,
    objects,
    updatedAt: new Date().toISOString(),
  };
}

export function sceneReducer(
  state: SceneState,
  action: SceneAction,
): SceneState {
  switch (action.type) {
    case "SELECT_OBJECT":
      return { ...state, selectedObjectId: action.objectId };

    case "PATCH_TRANSFORM": {
      const objects = state.currentScene.objects.map((object) => {
        if (object.id !== action.objectId || object.locked) return object;
        return {
          ...object,
          transform: {
            position: {
              ...object.transform.position,
              ...action.transform.position,
            },
            rotation: {
              ...object.transform.rotation,
              ...action.transform.rotation,
            },
            scale: {
              ...object.transform.scale,
              ...action.transform.scale,
            },
          },
        };
      });
      return {
        ...state,
        currentScene: changedScene(state.currentScene, objects),
      };
    }

    case "SET_VISIBILITY": {
      const objects = state.currentScene.objects.map((object) =>
        object.id === action.objectId
          ? { ...object, visible: action.visible }
          : object,
      );
      return {
        ...state,
        currentScene: changedScene(state.currentScene, objects),
      };
    }

    case "SET_LOCK": {
      const objects = state.currentScene.objects.map((object) =>
        object.id === action.objectId
          ? { ...object, locked: action.locked }
          : object,
      );
      return {
        ...state,
        currentScene: changedScene(state.currentScene, objects),
      };
    }

    case "SET_OPACITY": {
      const objects = state.currentScene.objects.map((object) => {
        if (object.id !== action.objectId || object.locked) return object;
        return {
          ...object,
          opacity: Math.max(0, Math.min(1, action.opacity)),
        };
      });
      return {
        ...state,
        currentScene: changedScene(state.currentScene, objects),
      };
    }

    case "SET_FEATHER": {
      const objects = state.currentScene.objects.map((object) => {
        if (object.id !== action.objectId || object.locked) return object;
        return {
          ...object,
          feather: Math.max(0, Math.min(100, action.feather)),
        };
      });
      return {
        ...state,
        currentScene: changedScene(state.currentScene, objects),
      };
    }

    case "MOVE_OBJECT_ORDER": {
      const objects = [...state.currentScene.objects].sort(
        (a, b) => a.order - b.order,
      );
      const index = objects.findIndex((object) => object.id === action.objectId);
      if (index < 0 || objects[index]?.locked) return state;

      const targetIndex =
        action.direction === "up" ? index + 1 : index - 1;
      if (targetIndex < 0 || targetIndex >= objects.length) return state;

      const current = objects[index]!;
      const target = objects[targetIndex]!;
      objects[index] = { ...current, order: target.order };
      objects[targetIndex] = { ...target, order: current.order };

      return {
        ...state,
        currentScene: changedScene(state.currentScene, objects),
      };
    }

    case "RESET_OBJECT": {
      const original = state.initialScene.objects.find(
        (object) => object.id === action.objectId,
      );
      if (!original) return state;

      const objects = state.currentScene.objects.map((object) =>
        object.id === action.objectId ? original : object,
      );

      return {
        ...state,
        currentScene: changedScene(state.currentScene, objects),
      };
    }

    case "RESET_SCENE":
      return {
        ...state,
        currentScene: state.initialScene,
        selectedObjectId:
          state.initialScene.objects[0]?.id ?? null,
      };

    case "COMMIT_SCENE":
      return {
        ...state,
        initialScene: action.scene,
        currentScene: action.scene,
        selectedObjectId:
          action.scene.objects.some(
            (object) => object.id === state.selectedObjectId,
          )
            ? state.selectedObjectId
            : action.scene.objects[0]?.id ?? null,
      };

    case "PATCH_CAMERA":
      return {
        ...state,
        currentScene: {
          ...state.currentScene,
          camera: {
            ...state.currentScene.camera,
            ...action.camera,
          },
          updatedAt: new Date().toISOString(),
        },
      };

    case "SET_TIME": {
      const duration = state.currentScene.timeline.durationMs;
      const currentTimeMs = Math.max(
        0,
        Math.min(duration, action.currentTimeMs),
      );
      return {
        ...state,
        currentScene: {
          ...state.currentScene,
          timeline: {
            ...state.currentScene.timeline,
            currentTimeMs,
          },
          updatedAt: new Date().toISOString(),
        },
      };
    }

    case "SET_PARALLAX_STRENGTH":
      return {
        ...state,
        parallaxStrength: Math.max(0, Math.min(2, action.value)),
      };

    default:
      return state;
  }
}
