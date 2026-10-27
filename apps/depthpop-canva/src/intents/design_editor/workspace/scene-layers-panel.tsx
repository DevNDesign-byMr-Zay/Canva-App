import React from "react";
import type { Dispatch, SetStateAction } from "react";
import type { DepthObject, DepthScene } from "../scene/depth-scene";
import type { DepthPopApiClient } from "../api/depthpop-api";
import type { SceneAction, SceneState } from "./scene-reducer";

export interface SceneLayersPanelProps {
  scene: DepthScene;
  apiClient?: DepthPopApiClient | null;
  mergeSelection: Set<string>;
  setMergeSelection: Dispatch<SetStateAction<Set<string>>>;
  isObjectBusy: boolean;
  handleMerge: () => void;
  sortedObjects: DepthObject[];
  state: SceneState;
  dispatch: Dispatch<SceneAction>;
  resolveUrl: (url: string) => string;
}

export function SceneLayersPanel({
  scene,
  apiClient,
  mergeSelection,
  setMergeSelection,
  isObjectBusy,
  handleMerge,
  sortedObjects,
  state,
  dispatch,
  resolveUrl,
}: SceneLayersPanelProps) {
  return (
    <section className="dp-layers-panel">
      <div className="dp-section-heading">
        <h3>SCENE OBJECTS ({scene.objects.length})</h3>
        <button
          type="button"
          className="dp-btn-small"
          disabled={!apiClient || mergeSelection.size < 2 || isObjectBusy}
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
              (object.id === state.selectedObjectId ? " is-active" : "")
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
  );
}
