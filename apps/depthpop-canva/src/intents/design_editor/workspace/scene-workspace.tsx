import React, {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";

import {
  type DepthPopExportRequest,
  type DepthPopExportStatus,
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
  DepthObject,
  DepthScene,
  ObjectTransform,
} from "../scene/depth-scene";
import {
  DepthViewport,
  type TransformMode,
} from "../viewport/DepthViewport";
import { sceneReducer } from "./scene-reducer";
import { AnimationPanel } from "./animation-panel";
import { ExportPanel } from "./export-panel";
import { SceneLayersPanel } from "./scene-layers-panel";
import { SceneObjectInspector } from "./scene-object-inspector";
import { SceneCameraPanel } from "./scene-camera-panel";

export interface SceneWorkspaceProps {
  initialScene: DepthScene;
  apiClient?: DepthPopApiClient | null;
  onExit?: () => void;
  onSave?: (scene: DepthScene) => Promise<DepthScene>;
  onExport?: (scene: DepthScene) => Promise<void>;
  backgroundReconstructionEnabled?: boolean;
}

type WorkspacePanel = "SCENE" | "ANIMATE" | "EXPORT";

function isInlineImageUrl(url: string): boolean {
  return url.startsWith("data:") || url.startsWith("blob:");
}

function exportExtension(format: DepthPopExportRequest["format"]): string {
  if (format === "scene-json") return "depthscene.json";
  if (format === "png-layers") return "zip";
  return format;
}

export function SceneWorkspace({
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
  const [activePanel, setActivePanel] =
    useState<WorkspacePanel>("SCENE");
  const [transformMode, setTransformMode] =
    useState<TransformMode>("translate");
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [assetError, setAssetError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRenderingToCanva, setIsRenderingToCanva] = useState(false);
  const [isObjectBusy, setIsObjectBusy] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [easing, setEasing] =
    useState<AnimationEasing>("ease-in-out");
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
  const [exportStatus, setExportStatus] =
    useState<DepthPopExportStatus | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(
    null,
  );
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
    const anchor =
      performance.now() - scene.timeline.currentTimeMs;

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
  }, [
    isPlaying,
    scene.timeline.durationMs,
  ]);

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
        cause instanceof Error
          ? cause.message
          : "DepthScene save failed.",
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
        cause instanceof Error
          ? cause.message
          : "DepthScene render failed.",
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
      () =>
        apiClient.renameObject(
          scene.id,
          selectedObject.id,
          nextLabel,
        ),
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
      () =>
        apiClient.splitObject(
          scene.id,
          selectedObject.id,
          4,
          "auto",
        ),
      "Re-segmenting selected object…",
    );
  };

  const handleMerge = () => {
    if (!apiClient || mergeSelection.size < 2) return;
    void runObjectOperation(
      () =>
        apiClient.mergeObjects(
          scene.id,
          [...mergeSelection],
          "Merged Object",
        ),
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
      tracks: upsertPose(
        object,
        scene.timeline.currentTimeMs,
        easing,
        {
          "position.x": transform.position.x,
          "position.y": transform.position.y,
          "position.z": transform.position.z,
          "rotation.x": transform.rotation.x,
          "rotation.y": transform.rotation.y,
          "rotation.z": transform.rotation.z,
          "scale.x": transform.scale.x,
          "scale.y": transform.scale.y,
          "scale.z": transform.scale.z,
        },
      ),
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

  const startExport = async () => {
    if (!apiClient) return;
    setExportBusy(true);
    setExportStatus(null);
    setStatusMessage(`Starting ${exportFormat} export…`);

    try {
      if (onSave && dirty) {
        const saved = await onSave(scene);
        dispatch({ type: "COMMIT_SCENE", scene: saved });
      }

      const created = await apiClient.createExportJob(scene.id, {
        format: exportFormat,
        includeAnimation,
        fps:
          exportFormat === "mp4" || exportFormat === "webm"
            ? exportFps
            : undefined,
        resolution:
          exportFormat === "mp4" || exportFormat === "webm"
            ? {
                width: exportWidth,
                height: exportHeight,
              }
            : undefined,
      });

      let current = await apiClient.getExportStatus(created.jobId);
      setExportStatus(current);
      while (
        current.status === "queued" ||
        current.status === "processing"
      ) {
        await new Promise((resolve) => window.setTimeout(resolve, 700));
        current = await apiClient.getExportStatus(created.jobId);
        setExportStatus(current);
      }

      if (current.status === "complete") {
        setStatusMessage(`${exportFormat} export ready.`);
      } else if (current.status === "cancelled") {
        setStatusMessage("Export cancelled.");
      } else {
        setStatusMessage(current.error || "Export failed.");
      }
    } catch (cause) {
      setStatusMessage(
        cause instanceof Error ? cause.message : "Export failed.",
      );
    } finally {
      setExportBusy(false);
    }
  };

  const cancelExport = async () => {
    if (!apiClient || !exportStatus) return;
    try {
      const cancelled = await apiClient.cancelExportJob(
        exportStatus.jobId,
      );
      setExportStatus(cancelled);
      setStatusMessage("Export cancellation requested.");
    } catch (cause) {
      setStatusMessage(
        cause instanceof Error
          ? cause.message
          : "Could not cancel export.",
      );
    }
  };

  const downloadExport = async () => {
    if (!apiClient || !exportStatus?.downloadUrl) return;
    try {
      const blob = await apiClient.downloadArtifactBlob(
        exportStatus.downloadUrl,
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `depthpop-${scene.id}.${exportExtension(exportFormat)}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setStatusMessage(
        cause instanceof Error
          ? cause.message
          : "Could not download export.",
      );
    }
  };

  const selectedPoseTimes = selectedObject
    ? poseTimes(selectedObject)
    : [];

  return (
    <div className="dp-workspace" data-testid="scene-workspace">
      <header className="dp-ws-header">
        <button type="button" className="dp-btn-text" onClick={onExit}>
          ← SOURCE
        </button>
        <span className="dp-chip">DEPTHSCENE V1</span>
        <button
          type="button"
          className="dp-btn-reset"
          onClick={() => {
            setIsPlaying(false);
            dispatch({ type: "RESET_SCENE" });
          }}
          disabled={!dirty}
        >
          RESET
        </button>
      </header>

      <nav className="dp-workspace-tabs" aria-label="DepthPop workspace">
        {(["SCENE", "ANIMATE", "EXPORT"] as WorkspacePanel[]).map(
          (panel) => (
            <button
              key={panel}
              type="button"
              className={activePanel === panel ? "is-active" : ""}
              onClick={() => setActivePanel(panel)}
            >
              {panel}
            </button>
          ),
        )}
      </nav>

      {!backgroundReconstructionEnabled && (
        <div className="dp-scene-warning" role="status">
          Background reconstruction is unavailable. Moving an extracted
          object can reveal source pixels behind it.
        </div>
      )}
      {degradedObjects.length > 0 && (
        <div className="dp-scene-warning" role="status">
          {degradedObjects.length} object
          {degradedObjects.length === 1 ? "" : "s"} use bounding-box
          fallback extraction.
        </div>
      )}
      {assetError && (
        <div className="dp-error" role="alert">
          {assetError}
        </div>
      )}

      <div className="dp-transform-toolbar" aria-label="3D transform tools">
        {(["translate", "rotate", "scale"] as TransformMode[]).map(
          (mode) => (
            <button
              key={mode}
              type="button"
              className={transformMode === mode ? "is-active" : ""}
              onClick={() => {
                setTransformMode(mode);
                setIsPlaying(false);
              }}
            >
              {mode.toUpperCase()}
            </button>
          ),
        )}
        <span className="dp-webgl-badge">WEBGL LIVE</span>
      </div>

      <div
        className="dp-stage"
        style={{ aspectRatio: `${scene.width} / ${scene.height}` }}
      >
        <DepthViewport
          scene={viewportScene}
          selectedObjectId={state.selectedObjectId}
          transformMode={transformMode}
          onSelectObject={(id) =>
            dispatch({ type: "SELECT_OBJECT", objectId: id })
          }
          onUpdateTransform={handleViewportTransform}
          onUpdateCamera={(camera) =>
            dispatch({ type: "PATCH_CAMERA", camera })
          }
          onTransformingChange={(active) => {
            if (active) setIsPlaying(false);
          }}
        />
      </div>

      {activePanel === "SCENE" && (
        <>
          <SceneLayersPanel
            scene={scene}
            apiClient={apiClient}
            mergeSelection={mergeSelection}
            setMergeSelection={setMergeSelection}
            isObjectBusy={isObjectBusy}
            handleMerge={handleMerge}
            sortedObjects={sortedObjects}
            state={state}
            dispatch={dispatch}
            resolveUrl={resolveUrl}
          />
          {selectedObject && (
            <SceneObjectInspector
              selectedObject={selectedObject}
              objectNameDraft={objectNameDraft}
              setObjectNameDraft={setObjectNameDraft}
              apiClient={apiClient}
              isObjectBusy={isObjectBusy}
              handleRename={handleRename}
              handleDuplicate={handleDuplicate}
              handleSplit={handleSplit}
              handleDelete={handleDelete}
              dispatch={dispatch}
            />
          )}
          <SceneCameraPanel scene={scene} state={state} dispatch={dispatch} />
        </>
      )}

      {activePanel === "ANIMATE" && (
        <AnimationPanel
          scene={scene}
          selectedObject={selectedObject}
          selectedPoseTimes={selectedPoseTimes}
          isPlaying={isPlaying}
          setIsPlaying={setIsPlaying}
          dispatch={dispatch}
          easing={easing}
          setEasing={setEasing}
          addPose={addPose}
          applyPreset={applyPreset}
        />
      )}

      {activePanel === "EXPORT" && (
        <ExportPanel
          apiClient={apiClient}
          exportFormat={exportFormat}
          setExportFormat={setExportFormat}
          includeAnimation={includeAnimation}
          setIncludeAnimation={setIncludeAnimation}
          exportFps={exportFps}
          setExportFps={setExportFps}
          exportWidth={exportWidth}
          setExportWidth={setExportWidth}
          exportHeight={exportHeight}
          setExportHeight={setExportHeight}
          exportBusy={exportBusy}
          exportStatus={exportStatus}
          startExport={startExport}
          cancelExport={cancelExport}
          downloadExport={downloadExport}
        />
      )}

      <footer className="dp-ws-footer">
        {onSave && (
          <button
            type="button"
            className="dp-btn-reset"
            disabled={
              !dirty ||
              isSaving ||
              isRenderingToCanva ||
              exportBusy
            }
            onClick={() => void handleSave()}
          >
            {isSaving ? "SAVING…" : dirty ? "SAVE SCENE" : "SAVED"}
          </button>
        )}
        {onExport && (
          <button
            type="button"
            className="dp-exec"
            disabled={
              isRenderingToCanva ||
              isSaving ||
              exportBusy
            }
            onClick={() => void handleRenderToCanva()}
          >
            <span>
              {isRenderingToCanva
                ? "RENDERING…"
                : "RENDER TO CANVA"}
            </span>
          </button>
        )}
      </footer>

      {statusMessage && (
        <div className="dp-workspace-status" role="status">
          {statusMessage}
        </div>
      )}
    </div>
  );
}
