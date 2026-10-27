import { useEffect, useMemo, useReducer, useRef, useState } from "react";

import {
  type DepthPopExportRequest,
  DepthPopApiClient,
} from "../api/depthpop-api";
import { poseTimes, upsertPose } from "../animation/pose-utils";
import {
  applyMotionPreset,
  type MotionPresetName,
} from "../animation/motion-presets";
import type {
  AnimationEasing,
  AnimationProperty,
  DepthScene,
  ObjectTransform,
} from "../scene/depth-scene";
import type { TransformMode } from "../viewport/DepthViewport";
import { sceneReducer } from "./scene-reducer";
import { useSceneExports } from "./use-scene-exports";

export interface SceneWorkspaceProps {
  initialScene: DepthScene;
  apiClient?: DepthPopApiClient | null;
  onExit?: () => void;
  onSave?: (scene: DepthScene) => Promise<DepthScene>;
  onExport?: (scene: DepthScene) => Promise<void>;
  backgroundReconstructionEnabled?: boolean;
}

export type WorkspacePanel = "SCENE" | "ANIMATE" | "EXPORT";

function isInlineImageUrl(url: string): boolean {
  return url.startsWith("data:") || url.startsWith("blob:");
}

export function useSceneWorkspaceController({
  initialScene,
  apiClient,
  onExit,
  onSave,
  onExport,
  backgroundReconstructionEnabled = false,
}: SceneWorkspaceProps) {
  const [state, dispatch] = useReducer(sceneReducer, {
    initialScene,
    currentScene: initialScene,
    selectedObjectId: initialScene.objects[0]?.id ?? null,
    parallaxStrength: 1,
  });
  const [activePanel, setActivePanel] = useState<WorkspacePanel>("SCENE");
  const [transformMode, setTransformMode] =
    useState<TransformMode>("translate");
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [assetError, setAssetError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRenderingToCanva, setIsRenderingToCanva] = useState(false);
  const [isObjectBusy, setIsObjectBusy] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [easing, setEasing] = useState<AnimationEasing>("ease-in-out");
  const [mergeSelection, setMergeSelection] = useState<Set<string>>(
    () => new Set(),
  );
  const [exportFormat, setExportFormat] =
    useState<DepthPopExportRequest["format"]>("glb");
  const [includeAnimation, setIncludeAnimation] = useState(true);
  const [exportFps, setExportFps] = useState(30);
  const [exportWidth, setExportWidth] = useState(1920);
  const [exportHeight, setExportHeight] = useState(1080);
  const [objectNameDraft, setObjectNameDraft] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const playbackFrame = useRef(0);
  const playbackLastPaint = useRef(0);

  const scene = state.currentScene;
  const selectedObject = scene.objects.find(
    (object) => object.id === state.selectedObjectId,
  );
  const sortedObjects = useMemo(
    () => [...scene.objects].sort((left, right) => left.order - right.order),
    [scene.objects],
  );
  const degradedObjects = scene.objects.filter(
    (object) => object.extractionQuality === "bbox_fallback",
  );
  const dirty = scene.updatedAt !== state.initialScene.updatedAt;

  const {
    exportStatus,
    exportBusy,
    startExport,
    cancelExport,
    downloadExport,
  } = useSceneExports({
    apiClient,
    scene,
    onSave,
    dirty,
    dispatch,
    exportFormat,
    includeAnimation,
    exportFps,
    exportWidth,
    exportHeight,
    setStatusMessage,
  });

  const assetKey = useMemo(
    () =>
      [
        scene.reconstructedPlate.imageUrl,
        scene.reconstructedPlate.depthMapUrl,
        ...scene.objects.flatMap((object) => [
          object.assets.cutoutUrl,
          object.assets.maskUrl,
          object.assets.thumbnailUrl,
        ]),
      ].join("|"),
    [scene.reconstructedPlate, scene.objects],
  );

  useEffect(() => {
    const client = apiClient;
    if (!client) return;
    const requiredClient: DepthPopApiClient = client;

    const controller = new AbortController();
    const createdUrls = new Set<string>();
    let active = true;
    const rawUrls = new Set(
      assetKey.split("|").filter((candidate) => candidate.length > 0),
    );

    async function loadAssets() {
      const next: Record<string, string> = {};
      try {
        await Promise.all(
          [...rawUrls].map(async (rawUrl) => {
            if (isInlineImageUrl(rawUrl)) {
              next[rawUrl] = rawUrl;
              return;
            }
            const resolved = await requiredClient.fetchAssetBlobUrl(
              rawUrl,
              controller.signal,
            );
            next[rawUrl] = resolved;
            if (resolved.startsWith("blob:")) {
              createdUrls.add(resolved);
            }
          }),
        );
        if (active) {
          setAssetUrls(next);
          setAssetError(null);
        }
      } catch (cause) {
        for (const url of createdUrls) URL.revokeObjectURL(url);
        createdUrls.clear();
        if (!controller.signal.aborted && active) {
          setAssetUrls({});
          setAssetError(
            cause instanceof Error
              ? cause.message
              : "DepthPop could not load one or more authenticated scene assets.",
          );
        }
      }
    }

    void loadAssets();

    return () => {
      active = false;
      controller.abort();
      for (const url of createdUrls) URL.revokeObjectURL(url);
    };
  }, [apiClient, assetKey]);

  useEffect(() => {
    if (!isPlaying || scene.timeline.durationMs <= 0) return;

    const duration = Math.max(1, scene.timeline.durationMs);
    const anchor = performance.now() - scene.timeline.currentTimeMs;

    const tick = (now: number) => {
      if (now - playbackLastPaint.current >= 32) {
        dispatch({
          type: "SET_TIME",
          currentTimeMs: Math.round((now - anchor) % duration),
        });
        playbackLastPaint.current = now;
      }
      playbackFrame.current = requestAnimationFrame(tick);
    };

    playbackFrame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(playbackFrame.current);
  }, [isPlaying, scene.timeline.durationMs]);

  useEffect(() => {
    setObjectNameDraft(selectedObject?.label ?? "");
  }, [selectedObject?.id, selectedObject?.label]);

  useEffect(() => {
    setMergeSelection((current) => {
      const ids = new Set(scene.objects.map((object) => object.id));
      return new Set([...current].filter((id) => ids.has(id)));
    });
  }, [scene.objects]);

  const resolveUrl = (rawUrl: string): string => {
    if (isInlineImageUrl(rawUrl)) return rawUrl;
    return assetUrls[rawUrl] ?? "";
  };

  const viewportScene = useMemo<DepthScene>(
    () => ({
      ...scene,
      reconstructedPlate: {
        ...scene.reconstructedPlate,
        imageUrl: resolveUrl(scene.reconstructedPlate.imageUrl),
        depthMapUrl: resolveUrl(scene.reconstructedPlate.depthMapUrl),
      },
      objects: scene.objects.map((object) => ({
        ...object,
        assets: {
          ...object.assets,
          cutoutUrl: resolveUrl(object.assets.cutoutUrl),
          maskUrl: resolveUrl(object.assets.maskUrl),
          thumbnailUrl: resolveUrl(object.assets.thumbnailUrl),
        },
      })),
    }),
    [scene, assetUrls],
  );

  const handleSave = async () => {
    if (!onSave || !dirty) return;
    setIsSaving(true);
    setStatusMessage("Saving DepthScene…");
    try {
      const saved = await onSave(scene);
      dispatch({ type: "COMMIT_SCENE", scene: saved });
      setStatusMessage("Scene saved.");
    } catch (cause) {
      setStatusMessage(
        cause instanceof Error ? cause.message : "DepthScene save failed.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleRenderToCanva = async () => {
    if (!onExport) return;
    setIsRenderingToCanva(true);
    setStatusMessage("Rendering the authored scene to Canva…");
    try {
      if (onSave && dirty) {
        const saved = await onSave(scene);
        dispatch({ type: "COMMIT_SCENE", scene: saved });
        await onExport(saved);
      } else {
        await onExport(scene);
      }
      setStatusMessage("Rendered scene applied to Canva.");
    } catch (cause) {
      setStatusMessage(
        cause instanceof Error ? cause.message : "DepthScene render failed.",
      );
    } finally {
      setIsRenderingToCanva(false);
    }
  };

  const commitServerScene = (updated: DepthScene) => {
    dispatch({ type: "COMMIT_SCENE", scene: updated });
    setStatusMessage("Scene updated.");
  };

  const runObjectOperation = async (
    operation: () => Promise<DepthScene>,
    pending: string,
  ) => {
    if (!apiClient) return;
    setIsObjectBusy(true);
    setStatusMessage(pending);
    try {
      // Object endpoints operate on the durable server scene. Persist any
      // local transform/keyframe/camera edits first so a duplicate, merge,
      // split or delete cannot replace them with an older server snapshot.
      if (dirty) {
        const saved = onSave
          ? await onSave(scene)
          : await apiClient.patchScene(scene.id, scene);
        dispatch({ type: "COMMIT_SCENE", scene: saved });
      }
      commitServerScene(await operation());
    } catch (cause) {
      setStatusMessage(
        cause instanceof Error
          ? cause.message
          : "DepthPop object operation failed.",
      );
    } finally {
      setIsObjectBusy(false);
    }
  };

  const handleRename = () => {
    if (!apiClient || !selectedObject) return;
    const nextLabel = objectNameDraft.trim();
    if (!nextLabel || nextLabel === selectedObject.label) return;
    void runObjectOperation(
      () => apiClient.renameObject(scene.id, selectedObject.id, nextLabel),
      "Renaming object…",
    );
  };

  const handleDuplicate = () => {
    if (!apiClient || !selectedObject) return;
    void runObjectOperation(
      () => apiClient.duplicateObject(scene.id, selectedObject.id),
      "Duplicating object…",
    );
  };

  const handleDelete = () => {
    if (!apiClient || !selectedObject || selectedObject.locked) return;
    if (!window.confirm(`Delete "${selectedObject.label}" from this scene?`)) {
      return;
    }
    void runObjectOperation(
      () => apiClient.deleteObject(scene.id, selectedObject.id),
      "Deleting object…",
    );
  };

  const handleSplit = () => {
    if (!apiClient || !selectedObject || selectedObject.locked) return;
    void runObjectOperation(
      () => apiClient.splitObject(scene.id, selectedObject.id, 4, "auto"),
      "Re-segmenting selected object…",
    );
  };

  const handleMerge = () => {
    if (!apiClient || mergeSelection.size < 2) return;
    void runObjectOperation(
      () =>
        apiClient.mergeObjects(scene.id, [...mergeSelection], "Merged Object"),
      "Merging selected objects…",
    ).then(() => setMergeSelection(new Set()));
  };

  const addPose = (
    explicitValues?: Partial<Record<AnimationProperty, number>>,
  ) => {
    if (!selectedObject) return;
    const durationMs = Math.max(1000, scene.timeline.durationMs || 3000);
    if (scene.timeline.durationMs !== durationMs) {
      dispatch({
        type: "PATCH_TIMELINE",
        timeline: { durationMs },
      });
    }
    dispatch({
      type: "SET_ANIMATION_TRACKS",
      objectId: selectedObject.id,
      tracks: upsertPose(
        selectedObject,
        Math.min(scene.timeline.currentTimeMs, durationMs),
        easing,
        explicitValues,
      ),
    });
    setStatusMessage(
      `Pose saved at ${(scene.timeline.currentTimeMs / 1000).toFixed(2)}s.`,
    );
  };

  const handleViewportTransform = (
    objectId: string,
    transform: ObjectTransform,
  ) => {
    setIsPlaying(false);
    dispatch({
      type: "PATCH_TRANSFORM",
      objectId,
      transform,
    });

    const object = scene.objects.find((candidate) => candidate.id === objectId);
    if (!object || scene.timeline.durationMs <= 0) return;

    dispatch({
      type: "SET_ANIMATION_TRACKS",
      objectId,
      tracks: upsertPose(object, scene.timeline.currentTimeMs, easing, {
        "position.x": transform.position.x,
        "position.y": transform.position.y,
        "position.z": transform.position.z,
        "rotation.x": transform.rotation.x,
        "rotation.y": transform.rotation.y,
        "rotation.z": transform.rotation.z,
        "scale.x": transform.scale.x,
        "scale.y": transform.scale.y,
        "scale.z": transform.scale.z,
      }),
    });
  };

  const applyPreset = (preset: MotionPresetName) => {
    setIsPlaying(false);
    dispatch({
      type: "REPLACE_CURRENT_SCENE",
      scene: applyMotionPreset(scene, preset),
    });
    setActivePanel("ANIMATE");
    setStatusMessage(`${preset.replace("_", " ")} motion applied.`);
  };

  const selectedPoseTimes = selectedObject ? poseTimes(selectedObject) : [];

  return {
    state,
    dispatch,
    scene,
    dirty,
    onExit,
    setIsPlaying,
    activePanel,
    setActivePanel,
    backgroundReconstructionEnabled,
    degradedObjects,
    assetError,
    transformMode,
    setTransformMode,
    viewportScene,
    handleViewportTransform,
    apiClient,
    mergeSelection,
    setMergeSelection,
    isObjectBusy,
    handleMerge,
    sortedObjects,
    resolveUrl,
    selectedObject,
    objectNameDraft,
    setObjectNameDraft,
    handleRename,
    handleDuplicate,
    handleSplit,
    handleDelete,
    selectedPoseTimes,
    isPlaying,
    easing,
    setEasing,
    addPose,
    applyPreset,
    exportFormat,
    setExportFormat,
    includeAnimation,
    setIncludeAnimation,
    exportFps,
    setExportFps,
    exportWidth,
    setExportWidth,
    exportHeight,
    setExportHeight,
    exportBusy,
    exportStatus,
    startExport,
    cancelExport,
    downloadExport,
    onSave,
    isSaving,
    isRenderingToCanva,
    handleSave,
    onExport,
    handleRenderToCanva,
    statusMessage,
  };
}
