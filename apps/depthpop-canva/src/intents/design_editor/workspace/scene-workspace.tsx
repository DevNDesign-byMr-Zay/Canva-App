import React, { useEffect, useMemo, useReducer, useState } from "react";
import { DepthPopApiClient } from "../api/depthpop-api";
import { DepthScene } from "../scene/depth-scene";
import { sceneReducer } from "./scene-reducer";

export interface SceneWorkspaceProps {
  initialScene: DepthScene;
  apiClient?: DepthPopApiClient | null;
  onExit?: () => void;
  onSave?: (scene: DepthScene) => Promise<DepthScene>;
  onExport?: (scene: DepthScene) => Promise<void>;
}

function isInlineImageUrl(url: string): boolean {
  return url.startsWith("data:") || url.startsWith("blob:");
}

export function SceneWorkspace({
  initialScene,
  apiClient,
  onExit,
  onSave,
  onExport,
}: SceneWorkspaceProps) {
  const [state, dispatch] = useReducer(sceneReducer, {
    initialScene,
    currentScene: initialScene,
    selectedObjectId: initialScene.objects[0]?.id ?? null,
    parallaxStrength: 1,
  });
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [assetError, setAssetError] = useState<string | null>(null);
  const [parallaxOffset, setParallaxOffset] = useState({ x: 0, y: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const scene = state.currentScene;
  const selectedObject = scene.objects.find(
    (object) => object.id === state.selectedObjectId,
  );
  const sortedObjects = useMemo(
    () => [...scene.objects].sort((a, b) => a.order - b.order),
    [scene.objects],
  );
  const degradedObjects = scene.objects.filter(
    (object) => object.extractionQuality === "bbox_fallback",
  );
  const dirty = scene.updatedAt !== state.initialScene.updatedAt;
  const fovScale = Math.max(0.55, Math.min(2.2, 50 / scene.camera.fov));

  useEffect(() => {
    if (!apiClient) return;

    const controller = new AbortController();
    const createdUrls = new Set<string>();
    let active = true;

    const rawUrls = new Set<string>([
      scene.reconstructedPlate.imageUrl,
      ...scene.objects.flatMap((object) => [
        object.assets.cutoutUrl,
        object.assets.thumbnailUrl,
      ]),
    ]);

    async function loadAssets() {
      const next: Record<string, string> = {};
      try {
        await Promise.all(
          [...rawUrls].map(async (rawUrl) => {
            if (!rawUrl) return;
            if (isInlineImageUrl(rawUrl)) {
              next[rawUrl] = rawUrl;
              return;
            }
            const resolved = await apiClient.fetchAssetBlobUrl(
              rawUrl,
              controller.signal,
            );
            next[rawUrl] = resolved;
            if (resolved.startsWith("blob:")) createdUrls.add(resolved);
          }),
        );
        if (active) {
          setAssetUrls(next);
          setAssetError(null);
        }
      } catch (cause) {
        if (!controller.signal.aborted && active) {
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
  }, [apiClient, scene.id]);

  const resolveUrl = (rawUrl: string): string => {
    if (isInlineImageUrl(rawUrl)) return rawUrl;
    return assetUrls[rawUrl] ?? "";
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    setParallaxOffset({
      x: x * 14 * state.parallaxStrength,
      y: y * 14 * state.parallaxStrength,
    });
  };

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

  const handleExport = async () => {
    if (!onExport) return;
    setIsExporting(true);
    setStatusMessage("Rendering the authored scene to Canva…");
    try {
      await onExport(scene);
      setStatusMessage("Rendered scene applied to Canva.");
    } catch (cause) {
      setStatusMessage(
        cause instanceof Error ? cause.message : "DepthScene render failed.",
      );
    } finally {
      setIsExporting(false);
    }
  };

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
          onClick={() => dispatch({ type: "RESET_SCENE" })}
          disabled={!dirty}
        >
          RESET SCENE
        </button>
      </header>

      {degradedObjects.length > 0 && (
        <div className="dp-scene-warning" role="status">
          {degradedObjects.length} object
          {degradedObjects.length === 1 ? "" : "s"} use
          bounding-box fallback extraction. Refine with caution.
        </div>
      )}
      {assetError && (
        <div className="dp-error" role="alert">
          {assetError}
        </div>
      )}

      <div
        className="dp-stage"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setParallaxOffset({ x: 0, y: 0 })}
        style={{ aspectRatio: `${scene.width} / ${scene.height}` }}
      >
        <div
          className="dp-stage-camera"
          style={{
            transform: `translate(${scene.camera.position.x}px, ${scene.camera.position.y}px) scale(${fovScale})`,
          }}
        >
          {resolveUrl(scene.reconstructedPlate.imageUrl) ? (
            <img
              src={resolveUrl(scene.reconstructedPlate.imageUrl)}
              alt="DepthScene reconstructed plate"
              className="dp-stage-plate"
            />
          ) : (
            <div className="dp-stage-placeholder">LOADING PLATE…</div>
          )}

          {sortedObjects.map((object) => {
            if (!object.visible) return null;

            const cutoutUrl = resolveUrl(object.assets.cutoutUrl);
            const selected = object.id === state.selectedObjectId;
            const zFactor = Math.max(
              0.25,
              Math.min(2.5, 1 + object.transform.position.z * 0.2),
            );
            const parallaxX = parallaxOffset.x * zFactor;
            const parallaxY = parallaxOffset.y * zFactor;
            const widthPct = (object.bbox.width / scene.width) * 100;
            const heightPct = (object.bbox.height / scene.height) * 100;
            const sourceImageWidthPct =
              (scene.width / object.bbox.width) * 100;
            const sourceImageHeightPct =
              (scene.height / object.bbox.height) * 100;
            const sourceImageLeftPct =
              (-object.bbox.x / object.bbox.width) * 100;
            const sourceImageTopPct =
              (-object.bbox.y / object.bbox.height) * 100;

            return (
              <button
                key={object.id}
                type="button"
                className={
                  "dp-stage-object" + (selected ? " is-selected" : "")
                }
                aria-label={`Select ${object.label}`}
                onClick={() =>
                  dispatch({ type: "SELECT_OBJECT", objectId: object.id })
                }
                style={{
                  left: `${object.transform.position.x * 100}%`,
                  top: `${object.transform.position.y * 100}%`,
                  width: `${widthPct}%`,
                  height: `${heightPct}%`,
                  opacity: object.opacity,
                  filter:
                    object.feather > 0
                      ? `blur(${Math.min(object.feather, 20)}px)`
                      : "none",
                  transform: `translate(-50%, -50%) translate3d(${parallaxX}px, ${parallaxY}px, 0) scale(${object.transform.scale.x}, ${object.transform.scale.y}) rotate(${object.transform.rotation.z}deg)`,
                  zIndex: object.order + 10,
                  overflow: "hidden",
                }}
              >
                {cutoutUrl ? (
                  <img
                    src={cutoutUrl}
                    alt=""
                    aria-hidden="true"
                    className="dp-cutout-img"
                    style={{
                      width: `${sourceImageWidthPct}%`,
                      height: `${sourceImageHeightPct}%`,
                      left: `${sourceImageLeftPct}%`,
                      top: `${sourceImageTopPct}%`,
                    }}
                  />
                ) : (
                  <span className="dp-object-placeholder">…</span>
                )}
                {selected && <span className="dp-select-border" />}
              </button>
            );
          })}
        </div>
      </div>

      {statusMessage && (
        <div className="dp-status-bar" aria-live="polite">
          {statusMessage}
        </div>
      )}

      <section className="dp-layers-panel">
        <h3>SCENE OBJECTS ({scene.objects.length})</h3>
        <div className="dp-layers-list">
          {sortedObjects.map((object) => (
            <div
              key={object.id}
              className={
                "dp-layer-item" +
                (object.id === state.selectedObjectId ? " is-active" : "")
              }
              onClick={() =>
                dispatch({ type: "SELECT_OBJECT", objectId: object.id })
              }
            >
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
                  {object.semanticType} · {Math.round(object.confidence * 100)}%
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
            <button
              type="button"
              className="dp-btn-small"
              disabled={selectedObject.locked}
              onClick={() =>
                dispatch({
                  type: "RESET_OBJECT",
                  objectId: selectedObject.id,
                })
              }
            >
              RESET
            </button>
          </header>

          <div className="dp-inspector-grid">
            <label>
              X
              <input
                type="range"
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
                      position: { x: Number(event.currentTarget.value) },
                    },
                  })
                }
              />
              <span>{selectedObject.transform.position.x.toFixed(3)}</span>
            </label>
            <label>
              Y
              <input
                type="range"
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
                      position: { y: Number(event.currentTarget.value) },
                    },
                  })
                }
              />
              <span>{selectedObject.transform.position.y.toFixed(3)}</span>
            </label>
            <label>
              Z / DEPTH
              <input
                type="range"
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
                      position: { z: Number(event.currentTarget.value) },
                    },
                  })
                }
              />
              <span>{selectedObject.transform.position.z.toFixed(2)}</span>
            </label>
            <label>
              SCALE
              <input
                type="range"
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
                    transform: { scale: { x: value, y: value, z: 1 } },
                  });
                }}
              />
              <span>{selectedObject.transform.scale.x.toFixed(2)}×</span>
            </label>
            <label>
              ROTATION
              <input
                type="range"
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
                      rotation: { z: Number(event.currentTarget.value) },
                    },
                  })
                }
              />
              <span>{selectedObject.transform.rotation.z.toFixed(0)}°</span>
            </label>
            <label>
              OPACITY
              <input
                type="range"
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
            <strong>PARALLAX + CAMERA</strong>
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
            PARALLAX
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={state.parallaxStrength}
              onChange={(event) =>
                dispatch({
                  type: "SET_PARALLAX_STRENGTH",
                  value: Number(event.currentTarget.value),
                })
              }
            />
            <span>{state.parallaxStrength.toFixed(2)}</span>
          </label>
          <label>
            CAMERA X
            <input
              type="range"
              min={-40}
              max={40}
              step={1}
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
            <span>{scene.camera.position.x.toFixed(0)}</span>
          </label>
          <label>
            CAMERA Y
            <input
              type="range"
              min={-40}
              max={40}
              step={1}
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
            <span>{scene.camera.position.y.toFixed(0)}</span>
          </label>
          <label>
            FIELD OF VIEW
            <input
              type="range"
              min={20}
              max={100}
              step={1}
              value={scene.camera.fov}
              onChange={(event) =>
                dispatch({
                  type: "PATCH_CAMERA",
                  camera: { fov: Number(event.currentTarget.value) },
                })
              }
            />
            <span>{scene.camera.fov.toFixed(0)}°</span>
          </label>
        </div>
      </section>

      {scene.timeline.durationMs > 0 && (
        <section className="dp-timeline-panel">
          <label>
            TIME
            <input
              type="range"
              min={0}
              max={scene.timeline.durationMs}
              step={Math.max(1, Math.round(1000 / scene.timeline.fps))}
              value={scene.timeline.currentTimeMs}
              onChange={(event) =>
                dispatch({
                  type: "SET_TIME",
                  currentTimeMs: Number(event.currentTarget.value),
                })
              }
            />
            <span>
              {(scene.timeline.currentTimeMs / 1000).toFixed(2)} s
            </span>
          </label>
        </section>
      )}

      <footer className="dp-ws-footer">
        {onSave && (
          <button
            type="button"
            className="dp-btn-reset"
            disabled={!dirty || isSaving || isExporting}
            onClick={() => void handleSave()}
          >
            {isSaving ? "SAVING…" : dirty ? "SAVE SCENE" : "SAVED"}
          </button>
        )}
        {onExport && (
          <button
            type="button"
            className="dp-exec"
            disabled={isExporting || isSaving}
            onClick={() => void handleExport()}
          >
            <span>
              {isExporting ? "RENDERING…" : "RENDER TO CANVA"}
            </span>
          </button>
        )}
      </footer>
    </div>
  );
}
