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
import { evaluateTrackValue } from "../animation/interpolation";
import {
  applyMotionPreset,
  type MotionPresetName,
} from "../animation/motion-presets";
import type {
  AnimationEasing,
  AnimationProperty,
  AnimationTrack,
  DepthObject,
  DepthScene,
  ObjectTransform,
} from "../scene/depth-scene";
import {
  DepthViewport,
  type TransformMode,
} from "../viewport/DepthViewport";
import { sceneReducer } from "./scene-reducer";

export interface SceneWorkspaceProps {
  initialScene: DepthScene;
  apiClient?: DepthPopApiClient | null;
  onExit?: () => void;
  onSave?: (scene: DepthScene) => Promise<DepthScene>;
  onExport?: (scene: DepthScene) => Promise<void>;
  backgroundReconstructionEnabled?: boolean;
}

type WorkspacePanel = "SCENE" | "ANIMATE" | "EXPORT";

const MOTION_PRESETS: MotionPresetName[] = [
  "PARALLAX",
  "CAMERA_PUSH",
  "FLOAT",
  "ORBIT",
  "DEPTH_REVEAL",
  "RACK_FOCUS",
];

const ANIMATION_PROPERTIES: AnimationProperty[] = [
  "position.x",
  "position.y",
  "position.z",
  "rotation.x",
  "rotation.y",
  "rotation.z",
  "scale.x",
  "scale.y",
  "scale.z",
  "opacity",
];

function isInlineImageUrl(url: string): boolean {
  return url.startsWith("data:") || url.startsWith("blob:");
}

function animationValue(
  object: DepthObject,
  property: AnimationProperty,
): number {
  switch (property) {
    case "position.x":
      return object.transform.position.x;
    case "position.y":
      return object.transform.position.y;
    case "position.z":
      return object.transform.position.z;
    case "rotation.x":
      return object.transform.rotation.x;
    case "rotation.y":
      return object.transform.rotation.y;
    case "rotation.z":
      return object.transform.rotation.z;
    case "scale.x":
      return object.transform.scale.x;
    case "scale.y":
      return object.transform.scale.y;
    case "scale.z":
      return object.transform.scale.z;
    case "opacity":
      return object.opacity;
  }
}

function sampledAnimationValue(
  object: DepthObject,
  property: AnimationProperty,
  timeMs: number,
): number {
  const fallback = animationValue(object, property);
  const track = object.animationTracks.find(
    (candidate) => candidate.property === property,
  );
  return track
    ? evaluateTrackValue(track, timeMs, fallback)
    : fallback;
}

function upsertPose(
  object: DepthObject,
  timeMs: number,
  easing: AnimationEasing,
  values?: Partial<Record<AnimationProperty, number>>,
): AnimationTrack[] {
  return ANIMATION_PROPERTIES.map((property) => {
    const existing = object.animationTracks.find(
      (track) => track.property === property,
    );
    const value =
      values?.[property] ??
      sampledAnimationValue(object, property, timeMs);
    let keyframes = existing ? [...existing.keyframes] : [];

    if (!existing && timeMs > 0) {
      keyframes.push({
        timeMs: 0,
        value: animationValue(object, property),
        easing: "linear",
      });
    }

    const index = keyframes.findIndex(
      (keyframe) => keyframe.timeMs === timeMs,
    );
    const nextKeyframe = { timeMs, value, easing };
    if (index >= 0) {
      keyframes[index] = nextKeyframe;
    } else {
      keyframes.push(nextKeyframe);
    }
    keyframes.sort((left, right) => left.timeMs - right.timeMs);

    return {
      id: existing?.id ?? `${object.id}-track-${property.replace(".", "-")}`,
      property,
      keyframes,
    };
  });
}

function removePose(
  tracks: AnimationTrack[],
  timeMs: number,
): AnimationTrack[] {
  return tracks
    .map((track) => ({
      ...track,
      keyframes: track.keyframes.filter(
        (keyframe) => keyframe.timeMs !== timeMs,
      ),
    }))
    .filter((track) => track.keyframes.length > 0);
}

function poseTimes(object: DepthObject): number[] {
  return [
    ...new Set(
      object.animationTracks.flatMap((track) =>
        track.keyframes.map((keyframe) => keyframe.timeMs),
      ),
    ),
  ].sort((left, right) => left - right);
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
            const resolved = await client.fetchAssetBlobUrl(
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
    setIsObjectBusy(true);
    setStatusMessage(pending);
    try {
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
    const nextLabel = window.prompt(
      "Object name",
      selectedObject.label,
    )?.trim();
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
          <section className="dp-layers-panel">
            <div className="dp-section-heading">
              <h3>SCENE OBJECTS ({scene.objects.length})</h3>
              <button
                type="button"
                className="dp-btn-small"
                disabled={
                  !apiClient ||
                  mergeSelection.size < 2 ||
                  isObjectBusy
                }
                onClick={handleMerge}
              >
                MERGE {mergeSelection.size > 1 ? mergeSelection.size : ""}
              </button>
            </div>
            <div className="dp-layers-list">
              {sortedObjects.map((object) => (
                <div
                  key={object.id}
                  className={
                    "dp-layer-item" +
                    (object.id === state.selectedObjectId
                      ? " is-active"
                      : "")
                  }
                  onClick={() =>
                    dispatch({
                      type: "SELECT_OBJECT",
                      objectId: object.id,
                    })
                  }
                >
                  <input
                    className="dp-merge-check"
                    type="checkbox"
                    aria-label={`Select ${object.label} for merge`}
                    checked={mergeSelection.has(object.id)}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      const checked = event.currentTarget.checked;
                      setMergeSelection((current) => {
                        const next = new Set(current);
                        if (checked) next.add(object.id);
                        else next.delete(object.id);
                        return next;
                      });
                    }}
                  />
                  {resolveUrl(object.assets.thumbnailUrl) ? (
                    <img
                      src={resolveUrl(object.assets.thumbnailUrl)}
                      alt=""
                      className="dp-thumb"
                    />
                  ) : (
                    <div className="dp-thumb dp-thumb-placeholder" />
                  )}
                  <div className="dp-layer-info">
                    <strong>{object.label}</strong>
                    <span>
                      {object.semanticType} ·{" "}
                      {Math.round(object.confidence * 100)}%
                      {object.extractionQuality === "bbox_fallback"
                        ? " · BBOX FALLBACK"
                        : ""}
                    </span>
                  </div>
                  <div className="dp-layer-actions">
                    <button
                      type="button"
                      title={object.visible ? "Hide object" : "Show object"}
                      onClick={(event) => {
                        event.stopPropagation();
                        dispatch({
                          type: "SET_VISIBILITY",
                          objectId: object.id,
                          visible: !object.visible,
                        });
                      }}
                    >
                      {object.visible ? "◉" : "○"}
                    </button>
                    <button
                      type="button"
                      title={object.locked ? "Unlock object" : "Lock object"}
                      onClick={(event) => {
                        event.stopPropagation();
                        dispatch({
                          type: "SET_LOCK",
                          objectId: object.id,
                          locked: !object.locked,
                        });
                      }}
                    >
                      {object.locked ? "▣" : "▢"}
                    </button>
                    <button
                      type="button"
                      title="Move layer forward"
                      disabled={object.locked}
                      onClick={(event) => {
                        event.stopPropagation();
                        dispatch({
                          type: "MOVE_OBJECT_ORDER",
                          objectId: object.id,
                          direction: "up",
                        });
                      }}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      title="Move layer backward"
                      disabled={object.locked}
                      onClick={(event) => {
                        event.stopPropagation();
                        dispatch({
                          type: "MOVE_OBJECT_ORDER",
                          objectId: object.id,
                          direction: "down",
                        });
                      }}
                    >
                      ▼
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {selectedObject && (
            <section className="dp-object-inspector">
              <header className="dp-inspector-header">
                <div>
                  <span>OBJECT</span>
                  <h4>{selectedObject.label}</h4>
                </div>
                <div className="dp-inline-actions">
                  <button
                    type="button"
                    className="dp-btn-small"
                    disabled={!apiClient || isObjectBusy}
                    onClick={handleRename}
                  >
                    RENAME
                  </button>
                  <button
                    type="button"
                    className="dp-btn-small"
                    disabled={!apiClient || isObjectBusy}
                    onClick={handleDuplicate}
                  >
                    DUPLICATE
                  </button>
                  <button
                    type="button"
                    className="dp-btn-small"
                    disabled={
                      !apiClient ||
                      isObjectBusy ||
                      selectedObject.locked
                    }
                    onClick={handleSplit}
                  >
                    SPLIT
                  </button>
                  <button
                    type="button"
                    className="dp-btn-small dp-danger"
                    disabled={
                      !apiClient ||
                      isObjectBusy ||
                      selectedObject.locked
                    }
                    onClick={handleDelete}
                  >
                    DELETE
                  </button>
                </div>
              </header>

              <div className="dp-inspector-grid">
                <label>
                  X
                  <input
                    type="range"
                    aria-label="X position"
                    min={0}
                    max={1}
                    step={0.005}
                    disabled={selectedObject.locked}
                    value={selectedObject.transform.position.x}
                    onChange={(event) =>
                      dispatch({
                        type: "PATCH_TRANSFORM",
                        objectId: selectedObject.id,
                        transform: {
                          position: {
                            x: Number(event.currentTarget.value),
                          },
                        },
                      })
                    }
                  />
                  <span>
                    {selectedObject.transform.position.x.toFixed(3)}
                  </span>
                </label>
                <label>
                  Y
                  <input
                    type="range"
                    aria-label="Y position"
                    min={0}
                    max={1}
                    step={0.005}
                    disabled={selectedObject.locked}
                    value={selectedObject.transform.position.y}
                    onChange={(event) =>
                      dispatch({
                        type: "PATCH_TRANSFORM",
                        objectId: selectedObject.id,
                        transform: {
                          position: {
                            y: Number(event.currentTarget.value),
                          },
                        },
                      })
                    }
                  />
                  <span>
                    {selectedObject.transform.position.y.toFixed(3)}
                  </span>
                </label>
                <label>
                  Z / DEPTH
                  <input
                    type="range"
                    aria-label="Z depth"
                    min={-2}
                    max={2}
                    step={0.025}
                    disabled={selectedObject.locked}
                    value={selectedObject.transform.position.z}
                    onChange={(event) =>
                      dispatch({
                        type: "PATCH_TRANSFORM",
                        objectId: selectedObject.id,
                        transform: {
                          position: {
                            z: Number(event.currentTarget.value),
                          },
                        },
                      })
                    }
                  />
                  <span>
                    {selectedObject.transform.position.z.toFixed(2)}
                  </span>
                </label>
                <label>
                  SCALE
                  <input
                    type="range"
                    aria-label="Object scale"
                    min={0.1}
                    max={3}
                    step={0.025}
                    disabled={selectedObject.locked}
                    value={selectedObject.transform.scale.x}
                    onChange={(event) => {
                      const value = Number(event.currentTarget.value);
                      dispatch({
                        type: "PATCH_TRANSFORM",
                        objectId: selectedObject.id,
                        transform: {
                          scale: { x: value, y: value, z: value },
                        },
                      });
                    }}
                  />
                  <span>
                    {selectedObject.transform.scale.x.toFixed(2)}×
                  </span>
                </label>
                <label>
                  ROTATION Z
                  <input
                    type="range"
                    aria-label="Object rotation"
                    min={-180}
                    max={180}
                    step={1}
                    disabled={selectedObject.locked}
                    value={selectedObject.transform.rotation.z}
                    onChange={(event) =>
                      dispatch({
                        type: "PATCH_TRANSFORM",
                        objectId: selectedObject.id,
                        transform: {
                          rotation: {
                            z: Number(event.currentTarget.value),
                          },
                        },
                      })
                    }
                  />
                  <span>
                    {selectedObject.transform.rotation.z.toFixed(0)}°
                  </span>
                </label>
                <label>
                  OPACITY
                  <input
                    type="range"
                    aria-label="Object opacity"
                    min={0}
                    max={1}
                    step={0.025}
                    disabled={selectedObject.locked}
                    value={selectedObject.opacity}
                    onChange={(event) =>
                      dispatch({
                        type: "SET_OPACITY",
                        objectId: selectedObject.id,
                        opacity: Number(event.currentTarget.value),
                      })
                    }
                  />
                  <span>{Math.round(selectedObject.opacity * 100)}%</span>
                </label>
                <label>
                  FEATHER
                  <input
                    type="range"
                    aria-label="Object feather"
                    min={0}
                    max={20}
                    step={0.5}
                    disabled={selectedObject.locked}
                    value={selectedObject.feather}
                    onChange={(event) =>
                      dispatch({
                        type: "SET_FEATHER",
                        objectId: selectedObject.id,
                        feather: Number(event.currentTarget.value),
                      })
                    }
                  />
                  <span>{selectedObject.feather.toFixed(1)} px</span>
                </label>
              </div>
            </section>
          )}

          <section className="dp-camera-panel">
            <div className="dp-camera-heading">
              <div>
                <span>VIEW</span>
                <strong>3D CAMERA</strong>
              </div>
              <button
                type="button"
                className="dp-btn-small"
                onClick={() =>
                  dispatch({
                    type: "PATCH_CAMERA",
                    camera: state.initialScene.camera,
                  })
                }
              >
                RESET CAMERA
              </button>
            </div>
            <div className="dp-inspector-grid">
              <label>
                CAMERA X
                <input
                  type="range"
                  aria-label="Camera X"
                  min={-5}
                  max={5}
                  step={0.05}
                  value={scene.camera.position.x}
                  onChange={(event) =>
                    dispatch({
                      type: "PATCH_CAMERA",
                      camera: {
                        position: {
                          ...scene.camera.position,
                          x: Number(event.currentTarget.value),
                        },
                      },
                    })
                  }
                />
                <span>{scene.camera.position.x.toFixed(2)}</span>
              </label>
              <label>
                CAMERA Y
                <input
                  type="range"
                  aria-label="Camera Y"
                  min={-5}
                  max={5}
                  step={0.05}
                  value={scene.camera.position.y}
                  onChange={(event) =>
                    dispatch({
                      type: "PATCH_CAMERA",
                      camera: {
                        position: {
                          ...scene.camera.position,
                          y: Number(event.currentTarget.value),
                        },
                      },
                    })
                  }
                />
                <span>{scene.camera.position.y.toFixed(2)}</span>
              </label>
              <label>
                CAMERA Z
                <input
                  type="range"
                  aria-label="Camera Z"
                  min={0.5}
                  max={12}
                  step={0.05}
                  value={scene.camera.position.z}
                  onChange={(event) =>
                    dispatch({
                      type: "PATCH_CAMERA",
                      camera: {
                        position: {
                          ...scene.camera.position,
                          z: Number(event.currentTarget.value),
                        },
                      },
                    })
                  }
                />
                <span>{scene.camera.position.z.toFixed(2)}</span>
              </label>
              <label>
                FIELD OF VIEW
                <input
                  type="range"
                  aria-label="Field of view"
                  min={20}
                  max={100}
                  step={1}
                  value={scene.camera.fov}
                  onChange={(event) =>
                    dispatch({
                      type: "PATCH_CAMERA",
                      camera: {
                        fov: Number(event.currentTarget.value),
                      },
                    })
                  }
                />
                <span>{scene.camera.fov.toFixed(0)}°</span>
              </label>
            </div>
            <p className="dp-help">
              Drag empty space to orbit · wheel/pinch to zoom · right-drag
              to pan. Camera navigation is persisted to the scene.
            </p>
          </section>
        </>
      )}

      {activePanel === "ANIMATE" && (
        <section className="dp-animation-panel">
          <div className="dp-section-heading">
            <div>
              <span>4D TIMELINE</span>
              <h3>
                {selectedObject
                  ? selectedObject.label
                  : "SELECT AN OBJECT"}
              </h3>
            </div>
            <div className="dp-playback-actions">
              <button
                type="button"
                className="dp-btn-small"
                disabled={scene.timeline.durationMs <= 0}
                onClick={() => setIsPlaying((value) => !value)}
              >
                {isPlaying ? "PAUSE" : "PLAY"}
              </button>
              <button
                type="button"
                className="dp-btn-small"
                onClick={() => {
                  setIsPlaying(false);
                  dispatch({ type: "SET_TIME", currentTimeMs: 0 });
                }}
              >
                STOP
              </button>
            </div>
          </div>

          <div className="dp-timeline-settings">
            <label>
              DURATION
              <input
                type="number"
                min={1}
                max={120}
                step={0.5}
                value={Math.max(1, scene.timeline.durationMs / 1000)}
                onChange={(event) => {
                  setIsPlaying(false);
                  dispatch({
                    type: "PATCH_TIMELINE",
                    timeline: {
                      durationMs:
                        Math.max(
                          1,
                          Number(event.currentTarget.value),
                        ) * 1000,
                    },
                  });
                }}
              />
              <span>s</span>
            </label>
            <label>
              FPS
              <input
                type="number"
                min={1}
                max={60}
                step={1}
                value={scene.timeline.fps}
                onChange={(event) =>
                  dispatch({
                    type: "PATCH_TIMELINE",
                    timeline: {
                      fps: Number(event.currentTarget.value),
                    },
                  })
                }
              />
            </label>
            <label>
              EASING
              <select
                value={easing}
                onChange={(event) =>
                  setEasing(
                    event.currentTarget.value as AnimationEasing,
                  )
                }
              >
                <option value="linear">LINEAR</option>
                <option value="ease-in">EASE IN</option>
                <option value="ease-out">EASE OUT</option>
                <option value="ease-in-out">EASE IN/OUT</option>
              </select>
            </label>
          </div>

          <label className="dp-timeline-scrubber">
            <span>TIME</span>
            <input
              type="range"
              aria-label="Timeline time"
              min={0}
              max={Math.max(1, scene.timeline.durationMs)}
              step={Math.max(1, Math.round(1000 / scene.timeline.fps))}
              value={scene.timeline.currentTimeMs}
              onChange={(event) => {
                setIsPlaying(false);
                dispatch({
                  type: "SET_TIME",
                  currentTimeMs: Number(event.currentTarget.value),
                });
              }}
            />
            <strong>
              {(scene.timeline.currentTimeMs / 1000).toFixed(2)} /{" "}
              {(scene.timeline.durationMs / 1000).toFixed(2)}s
            </strong>
          </label>

          <div className="dp-pose-actions">
            <button
              type="button"
              className="dp-exec"
              disabled={!selectedObject}
              onClick={() => addPose()}
            >
              ADD / UPDATE KEYFRAME
            </button>
            <button
              type="button"
              className="dp-btn-reset"
              disabled={
                !selectedObject ||
                !selectedPoseTimes.includes(
                  scene.timeline.currentTimeMs,
                )
              }
              onClick={() => {
                if (!selectedObject) return;
                dispatch({
                  type: "SET_ANIMATION_TRACKS",
                  objectId: selectedObject.id,
                  tracks: removePose(
                    selectedObject.animationTracks,
                    scene.timeline.currentTimeMs,
                  ),
                });
              }}
            >
              DELETE KEYFRAME
            </button>
          </div>

          {selectedObject && (
            <div className="dp-keyframe-strip">
              {selectedPoseTimes.length === 0 ? (
                <span className="dp-muted">No keyframes yet.</span>
              ) : (
                selectedPoseTimes.map((timeMs) => (
                  <button
                    key={timeMs}
                    type="button"
                    className={
                      timeMs === scene.timeline.currentTimeMs
                        ? "is-active"
                        : ""
                    }
                    onClick={() => {
                      setIsPlaying(false);
                      dispatch({
                        type: "SET_TIME",
                        currentTimeMs: timeMs,
                      });
                    }}
                  >
                    {(timeMs / 1000).toFixed(2)}s
                  </button>
                ))
              )}
            </div>
          )}

          <div className="dp-motion-presets">
            <span>MOTION PRESETS</span>
            <div className="dp-preset-grid">
              {MOTION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => applyPreset(preset)}
                >
                  {preset.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          <p className="dp-help">
            Move the playhead, transform the selected object in the WebGL
            viewport, then add/update a keyframe. Transform gizmo commits
            automatically write the pose at the current time when the
            timeline is active.
          </p>
        </section>
      )}

      {activePanel === "EXPORT" && (
        <section className="dp-export-panel">
          <div className="dp-section-heading">
            <div>
              <span>DELIVERABLE</span>
              <h3>PRODUCTION EXPORT</h3>
            </div>
          </div>

          <label className="dp-field">
            FORMAT
            <select
              value={exportFormat}
              onChange={(event) =>
                setExportFormat(
                  event.currentTarget
                    .value as DepthPopExportRequest["format"],
                )
              }
            >
              <option value="scene-json">PORTABLE SCENE JSON</option>
              <option value="png-layers">PNG LAYERS ZIP</option>
              <option value="gltf">GLTF</option>
              <option value="glb">GLB</option>
              <option value="webm">WEBM</option>
              <option value="mp4">MP4</option>
            </select>
          </label>

          <label className="dp-check-field">
            <input
              type="checkbox"
              checked={includeAnimation}
              onChange={(event) =>
                setIncludeAnimation(event.currentTarget.checked)
              }
            />
            INCLUDE AUTHORED ANIMATION
          </label>

          {(exportFormat === "mp4" || exportFormat === "webm") && (
            <label className="dp-field">
              VIDEO FPS
              <input
                type="number"
                min={1}
                max={60}
                value={exportFps}
                onChange={(event) =>
                  setExportFps(
                    Math.max(
                      1,
                      Math.min(
                        60,
                        Number(event.currentTarget.value),
                      ),
                    ),
                  )
                }
              />
            </label>
          )}

          <button
            type="button"
            className="dp-exec"
            disabled={!apiClient || exportBusy}
            onClick={() => void startExport()}
          >
            {exportBusy ? "EXPORTING…" : "START EXPORT"}
          </button>

          {exportStatus && (
            <div className="dp-export-status" role="status">
              <div>
                <strong>{exportStatus.status.toUpperCase()}</strong>
                <span>{exportStatus.stage}</span>
              </div>
              <progress
                max={1}
                value={Math.max(
                  0,
                  Math.min(1, exportStatus.progress ?? 0),
                )}
              />
              {exportStatus.error && (
                <p className="dp-error">{exportStatus.error}</p>
              )}
              <div className="dp-inline-actions">
                {(exportStatus.status === "queued" ||
                  exportStatus.status === "processing") && (
                  <button
                    type="button"
                    className="dp-btn-small"
                    onClick={() => void cancelExport()}
                  >
                    CANCEL
                  </button>
                )}
                {exportStatus.status === "complete" &&
                  exportStatus.downloadUrl && (
                    <button
                      type="button"
                      className="dp-btn-small"
                      onClick={() => void downloadExport()}
                    >
                      DOWNLOAD
                    </button>
                  )}
              </div>
            </div>
          )}

          <p className="dp-help">
            Scene JSON and PNG layers preserve project assets; glTF/GLB
            preserve spatial transforms and transform animation; WebM/MP4
            render the authored timeline through the backend job system.
          </p>
        </section>
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
