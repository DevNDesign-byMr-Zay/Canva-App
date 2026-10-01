import { DepthObject, DepthScene } from "../scene/depth-scene";

export type SceneAction =
  | { type: "SELECT_OBJECT"; objectId: string | null }
  | {
      type: "PATCH_TRANSFORM";
      objectId: string;
      transform: Partial<DepthObject["transform"]>;
    }
  | { type: "SET_VISIBILITY"; objectId: string; visible: boolean }
  | { type: "SET_LOCK"; objectId: string; locked: boolean }
  | { type: "SET_OPACITY"; objectId: string; opacity: number }
  | { type: "SET_FEATHER"; objectId: string; feather: number }
  | { type: "MOVE_OBJECT_ORDER"; objectId: string; direction: "up" | "down" }
  | { type: "RESET_OBJECT"; objectId: string }
  | { type: "RESET_SCENE" }
  | { type: "PATCH_CAMERA"; camera: Partial<DepthScene["camera"]> }
  | { type: "SET_TIME"; currentTimeMs: number };

export interface SceneState {
  initialScene: DepthScene;
  currentScene: DepthScene;
  selectedObjectId: string | null;
  parallaxStrength: number;
}

export function sceneReducer(
  state: SceneState,
  action: SceneAction,
): SceneState {
  switch (action.type) {
    case "SELECT_OBJECT":
      return { ...state, selectedObjectId: action.objectId };

    case "PATCH_TRANSFORM": {
      const updatedObjects = state.currentScene.objects.map((obj) => {
        if (obj.id !== action.objectId || obj.locked) return obj;
        return {
          ...obj,
          transform: {
            position: {
              ...obj.transform.position,
              ...(action.transform.position || {}),
            },
            rotation: {
              ...obj.transform.rotation,
              ...(action.transform.rotation || {}),
            },
            scale: {
              ...obj.transform.scale,
              ...(action.transform.scale || {}),
            },
          },
        };
      });
      return {
        ...state,
        currentScene: {
          ...state.currentScene,
          objects: updatedObjects,
          updatedAt: new Date().toISOString(),
        },
      };
    }

    case "SET_VISIBILITY": {
      const updatedObjects = state.currentScene.objects.map((obj) =>
        obj.id === action.objectId ? { ...obj, visible: action.visible } : obj,
      );
      return {
        ...state,
        currentScene: {
          ...state.currentScene,
          objects: updatedObjects,
          updatedAt: new Date().toISOString(),
        },
      };
    }

    case "SET_LOCK": {
      const updatedObjects = state.currentScene.objects.map((obj) =>
        obj.id === action.objectId ? { ...obj, locked: action.locked } : obj,
      );
      return {
        ...state,
        currentScene: {
          ...state.currentScene,
          objects: updatedObjects,
          updatedAt: new Date().toISOString(),
        },
      };
    }

    case "SET_OPACITY": {
      const updatedObjects = state.currentScene.objects.map((obj) => {
        if (obj.id !== action.objectId || obj.locked) return obj;
        return { ...obj, opacity: Math.max(0, Math.min(1, action.opacity)) };
      });
      return {
        ...state,
        currentScene: {
          ...state.currentScene,
          objects: updatedObjects,
          updatedAt: new Date().toISOString(),
        },
      };
    }

    case "SET_FEATHER": {
      const updatedObjects = state.currentScene.objects.map((obj) => {
        if (obj.id !== action.objectId || obj.locked) return obj;
        return { ...obj, feather: Math.max(0, Math.min(100, action.feather)) };
      });
      return {
        ...state,
        currentScene: {
          ...state.currentScene,
          objects: updatedObjects,
          updatedAt: new Date().toISOString(),
        },
      };
    }

    case "MOVE_OBJECT_ORDER": {
      const objects = [...state.currentScene.objects].sort(
        (a, b) => a.order - b.order,
      );
      const idx = objects.findIndex((o) => o.id === action.objectId);
      if (idx < 0) return state;

      const targetIdx = action.direction === "up" ? idx + 1 : idx - 1;
      if (targetIdx < 0 || targetIdx >= objects.length) return state;

      const tempOrder = objects[idx].order;
      objects[idx] = { ...objects[idx], order: objects[targetIdx].order };
      objects[targetIdx] = { ...objects[targetIdx], order: tempOrder };

      return {
        ...state,
        currentScene: {
          ...state.currentScene,
          objects,
          updatedAt: new Date().toISOString(),
        },
      };
    }

    case "RESET_OBJECT": {
      const orig = state.initialScene.objects.find(
        (o) => o.id === action.objectId,
      );
      if (!orig) return state;

      const updatedObjects = state.currentScene.objects.map((o) =>
        o.id === action.objectId ? { ...orig } : o,
      );

      return {
        ...state,
        currentScene: {
          ...state.currentScene,
          objects: updatedObjects,
          updatedAt: new Date().toISOString(),
        },
      };
    }

    case "RESET_SCENE":
      return {
        ...state,
        currentScene: state.initialScene,
        selectedObjectId:
          state.initialScene.objects.length > 0
            ? state.initialScene.objects[0].id
            : null,
      };

    case "PATCH_CAMERA":
      return {
        ...state,
        currentScene: {
          ...state.currentScene,
          camera: { ...state.currentScene.camera, ...action.camera },
          updatedAt: new Date().toISOString(),
        },
      };

    case "SET_TIME":
      return {
        ...state,
        currentScene: {
          ...state.currentScene,
          timeline: {
            ...state.currentScene.timeline,
            currentTimeMs: action.currentTimeMs,
          },
          updatedAt: new Date().toISOString(),
        },
      };

    default:
      return state;
  }
}
