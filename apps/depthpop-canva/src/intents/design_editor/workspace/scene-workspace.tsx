import React, { useEffect, useReducer, useState } from "react";
import { DepthPopApiClient } from "../api/depthpop-api";
import { DepthScene } from "../scene/depth-scene";
import { sceneReducer, SceneState } from "./scene-reducer";

export interface SceneWorkspaceProps {
  initialScene: DepthScene;
  apiClient?: DepthPopApiClient | null;
  onExit?: () => void;
  onSave?: (scene: DepthScene) => Promise<void>;
  onExport?: (scene: DepthScene) => Promise<void>;
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
    selectedObjectId:
      initialScene.objects.length > 0 ? initialScene.objects[0].id : null,
    parallaxStrength: 1.0,
  });

  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [parallaxOffset, setParallaxOffset] = useState<{
    x: number;
    y: number;
  }>({ x: 0, y: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const scene = state.currentScene;
  const selectedObject = scene.objects.find(
    (o) => o.id === state.selectedObjectId,
  );

  // Fetch authenticated scene assets into browser Object URLs
  useEffect(() => {
    let active = true;

    async function loadAssets() {
      if (!apiClient) return;
      const urlMap: Record<string, string> = {};

      try {
        if (scene.reconstructedPlate?.imageUrl) {
          urlMap[scene.reconstructedPlate.imageUrl] =
            await apiClient.fetchAssetBlobUrl(
              scene.reconstructedPlate.imageUrl,
            );
        }

        for (const obj of scene.objects) {
          if (obj.assets.cutoutUrl) {
            urlMap[obj.assets.cutoutUrl] = await apiClient.fetchAssetBlobUrl(
              obj.assets.cutoutUrl,
            );
          }
          if (obj.assets.thumbnailUrl) {
            urlMap[obj.assets.thumbnailUrl] = await apiClient.fetchAssetBlobUrl(
              obj.assets.thumbnailUrl,
            );
          }
        }

        if (active) setAssetUrls((prev) => ({ ...prev, ...urlMap }));
      } catch {
        if (active) setStatusMessage("Note: Loaded default preview assets");
      }
    }

    void loadAssets();

    return () => {
      active = false;
      if (apiClient) apiClient.revokeObjectUrls();
    };
  }, [apiClient, scene.id]);

  const resolveUrl = (rawUrl: string): string => assetUrls[rawUrl] || rawUrl;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width - 0.5;
    const cy = (e.clientY - rect.top) / rect.height - 0.5;
    setParallaxOffset({
      x: cx * 14 * state.parallaxStrength,
      y: cy * 14 * state.parallaxStrength,
    });
  };

  const handleMouseLeave = () => setParallaxOffset({ x: 0, y: 0 });

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    setStatusMessage("Saving scene updates...");
    try {
      await onSave(scene);
      setStatusMessage("Scene saved");
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    if (!onExport) return;
    setIsExporting(true);
    setStatusMessage("Compositing & applying scene to Canva...");
    try {
      await onExport(scene);
      setStatusMessage("Scene applied");
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const sortedObjects = [...scene.objects].sort((a, b) => a.order - b.order);

  return (
    <div className="dp-workspace" data-testid="scene-workspace">
      <header className="dp-ws-header">
        <button type="button" className="dp-btn-text" onClick={onExit}>
          ← Source
        </button>
        <span className="dp-chip">DEPTHSCENE V1</span>
        <button
          type="button"
          className="dp-btn-reset"
          onClick={() => dispatch({ type: "RESET_SCENE" })}
        >
          Reset Scene
        </button>
      </header>

      {/* 2.5D Parallax Stage */}
      <div
        className="dp-stage"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ aspectRatio: `${scene.width} / ${scene.height}` }}
      >
        <img
          src={resolveUrl(scene.reconstructedPlate.imageUrl)}
          alt="Reconstructed Plate"
          className="dp-stage-plate"
          style={{
            transform: `translate(${parallaxOffset.x * 0.2 + scene.camera.position.x}px, ${parallaxOffset.y * 0.2 + scene.camera.position.y}px)`,
          }}
        />

        {sortedObjects.map((obj) => {
          if (!obj.visible) return null;

          const isSelected = obj.id === state.selectedObjectId;
          const zScale = 1 + obj.transform.position.z * 0.2;
          const pxShiftX = parallaxOffset.x * zScale + scene.camera.position.x;
          const pxShiftY = parallaxOffset.y * zScale + scene.camera.position.y;

          // Source BBox placement + Position X/Y offsets
          const leftPct =
            (obj.bbox.x / scene.width) * 100 +
            (obj.transform.position.x -
              (obj.bbox.x + obj.bbox.width / 2) / scene.width) *
              50;
          const topPct =
            (obj.bbox.y / scene.height) * 100 +
            (obj.transform.position.y -
              (obj.bbox.y + obj.bbox.height / 2) / scene.height) *
              50;
          const widthPct = (obj.bbox.width / scene.width) * 100;
          const heightPct = (obj.bbox.height / scene.height) * 100;

          return (
            <div
              key={obj.id}
              className={`dp-stage-object ${isSelected ? "is-selected" : ""}`}
              onClick={() =>
                dispatch({ type: "SELECT_OBJECT", objectId: obj.id })
              }
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                width: `${widthPct}%`,
                height: `${heightPct}%`,
                opacity: obj.opacity,
                filter: obj.feather > 0 ? `blur(${obj.feather}px)` : "none",
                transform: `translate3d(${pxShiftX}px, ${pxShiftY}px, ${obj.transform.position.z * 10}px) scale(${obj.transform.scale.x}) rotate(${obj.transform.rotation.z}deg)`,
                zIndex: obj.order + 10,
              }}
            >
              <img
                src={resolveUrl(obj.assets.cutoutUrl)}
                alt={obj.label}
                className="dp-cutout-img"
              />
              {isSelected && <div className="dp-select-border" />}
            </div>
          );
        })}
      </div>

      {statusMessage && <div className="dp-status-bar">{statusMessage}</div>}

      {/* Layers Panel */}
      <section className="dp-layers-panel">
        <h3>SCENE OBJECTS ({scene.objects.length})</h3>
        <div className="dp-layers-list">
          {sortedObjects.map((obj) => (
            <div
              key={obj.id}
              className={`dp-layer-item ${obj.id === state.selectedObjectId ? "is-active" : ""}`}
              onClick={() =>
                dispatch({ type: "SELECT_OBJECT", objectId: obj.id })
              }
            >
              <img
                src={resolveUrl(obj.assets.thumbnailUrl)}
                alt={obj.label}
                className="dp-thumb"
              />
              <div className="dp-layer-info">
                <strong>{obj.id}</strong>
                <span>
                  {obj.semanticType} • {Math.round(obj.confidence * 100)}%
                </span>
              </div>
              <div className="dp-layer-actions">
                <button
                  type="button"
                  title="Toggle Visibility"
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({
                      type: "SET_VISIBILITY",
                      objectId: obj.id,
                      visible: !obj.visible,
                    });
                  }}
                >
                  {obj.visible ? "👁" : "🙈"}
                </button>
                <button
                  type="button"
                  title="Toggle Lock"
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({
                      type: "SET_LOCK",
                      objectId: obj.id,
                      locked: !obj.locked,
                    });
                  }}
                >
                  {obj.locked ? "🔒" : "🔓"}
                </button>
                <button
                  type="button"
                  title="Move Up"
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({
                      type: "MOVE_OBJECT_ORDER",
                      objectId: obj.id,
                      direction: "up",
                    });
                  }}
                >
                  ▲
                </button>
                <button
                  type="button"
                  title="Move Down"
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({
                      type: "MOVE_OBJECT_ORDER",
                      objectId: obj.id,
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

      {/* Inspector Controls */}
      {selectedObject && (
        <section className="dp-object-inspector">
          <header className="dp-inspector-header">
            <h4>
              {selectedObject.id} {selectedObject.locked && "🔒 (Locked)"}
            </h4>
            <button
              type="button"
              className="dp-btn-small"
              onClick={() =>
                dispatch({ type: "RESET_OBJECT", objectId: selectedObject.id })
              }
            >
              Reset Object
            </button>
          </header>

          <div className="dp-inspector-grid">
            <label>
              Position X (Offset)
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                disabled={selectedObject.locked}
                value={selectedObject.transform.position.x}
                onChange={(e) =>
                  dispatch({
                    type: "PATCH_TRANSFORM",
                    objectId: selectedObject.id,
                    transform: { position: { x: Number(e.target.value) } },
                  })
                }
              />
              <span>{selectedObject.transform.position.x.toFixed(2)}</span>
            </label>

            <label>
              Position Y (Offset)
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                disabled={selectedObject.locked}
                value={selectedObject.transform.position.y}
                onChange={(e) =>
                  dispatch({
                    type: "PATCH_TRANSFORM",
                    objectId: selectedObject.id,
                    transform: { position: { y: Number(e.target.value) } },
                  })
                }
              />
              <span>{selectedObject.transform.position.y.toFixed(2)}</span>
            </label>

            <label>
              Z / Depth Offset
              <input
                type="range"
                min={-2}
                max={2}
                step={0.05}
                disabled={selectedObject.locked}
                value={selectedObject.transform.position.z}
                onChange={(e) =>
                  dispatch({
                    type: "PATCH_TRANSFORM",
                    objectId: selectedObject.id,
                    transform: { position: { z: Number(e.target.value) } },
                  })
                }
              />
              <span>{selectedObject.transform.position.z.toFixed(2)}</span>
            </label>

            <label>
              Scale
              <input
                type="range"
                min={0.2}
                max={3}
                step={0.05}
                disabled={selectedObject.locked}
                value={selectedObject.transform.scale.x}
                onChange={(e) =>
                  dispatch({
                    type: "PATCH_TRANSFORM",
                    objectId: selectedObject.id,
                    transform: {
                      scale: {
                        x: Number(e.target.value),
                        y: Number(e.target.value),
                        z: 1,
                      },
                    },
                  })
                }
              />
              <span>{selectedObject.transform.scale.x.toFixed(2)}x</span>
            </label>

            <label>
              Rotation (°deg)
              <input
                type="range"
                min={-180}
                max={180}
                step={1}
                disabled={selectedObject.locked}
                value={selectedObject.transform.rotation.z}
                onChange={(e) =>
                  dispatch({
                    type: "PATCH_TRANSFORM",
                    objectId: selectedObject.id,
                    transform: { rotation: { z: Number(e.target.value) } },
                  })
                }
              />
              <span>{selectedObject.transform.rotation.z}°</span>
            </label>

            <label>
              Opacity
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                disabled={selectedObject.locked}
                value={selectedObject.opacity}
                onChange={(e) =>
                  dispatch({
                    type: "SET_OPACITY",
                    objectId: selectedObject.id,
                    opacity: Number(e.target.value),
                  })
                }
              />
              <span>{Math.round(selectedObject.opacity * 100)}%</span>
            </label>

            <label>
              Feather Edge
              <input
                type="range"
                min={0}
                max={20}
                step={1}
                disabled={selectedObject.locked}
                value={selectedObject.feather}
                onChange={(e) =>
                  dispatch({
                    type: "SET_FEATHER",
                    objectId: selectedObject.id,
                    feather: Number(e.target.value),
                  })
                }
              />
              <span>{selectedObject.feather}px</span>
            </label>
          </div>
        </section>
      )}

      {/* Camera & Persistence Actions */}
      <footer className="dp-ws-footer">
        {onSave && (
          <button
            type="button"
            className="dp-btn-reset"
            disabled={isSaving}
            onClick={handleSave}
          >
            {isSaving ? "SAVING..." : "SAVE SCENE"}
          </button>
        )}

        {onExport && (
          <button
            type="button"
            className="dp-exec"
            disabled={isExporting}
            onClick={handleExport}
          >
            <span>
              {isExporting ? "COMPOSITING..." : "APPLY FLATTENED SCENE"}
            </span>
          </button>
        )}
      </footer>
    </div>
  );
}
