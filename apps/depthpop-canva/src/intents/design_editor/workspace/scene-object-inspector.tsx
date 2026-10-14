import React from "react";
import type { Dispatch, SetStateAction } from "react";
import type { DepthObject } from "../scene/depth-scene";
import type { DepthPopApiClient } from "../api/depthpop-api";
import type { SceneAction } from "./scene-reducer";

export interface SceneObjectInspectorProps {
  selectedObject: DepthObject;
  objectNameDraft: string;
  setObjectNameDraft: Dispatch<SetStateAction<string>>;
  apiClient?: DepthPopApiClient | null;
  isObjectBusy: boolean;
  handleRename: () => void;
  handleDuplicate: () => void;
  handleSplit: () => void;
  handleDelete: () => void;
  dispatch: Dispatch<SceneAction>;
}

export function SceneObjectInspector({
  selectedObject, objectNameDraft, setObjectNameDraft, apiClient,
  isObjectBusy, handleRename, handleDuplicate, handleSplit, handleDelete, dispatch,
}: SceneObjectInspectorProps) {
  return (
    <section className="dp-object-inspector">
      <header className="dp-inspector-header">
        <div className="dp-object-name-editor">
          <span>OBJECT</span>
          <div>
            <input
              aria-label="Object name"
              value={objectNameDraft}
              maxLength={160}
              disabled={!apiClient || isObjectBusy}
              onChange={(event) =>
                setObjectNameDraft(event.currentTarget.value)
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                  handleRename();
                }
              }}
            />
            <button
              type="button"
              className="dp-btn-small"
              disabled={
                !apiClient ||
                isObjectBusy ||
                !objectNameDraft.trim() ||
                objectNameDraft.trim() === selectedObject.label
              }
              onClick={handleRename}
            >
              SAVE NAME
            </button>
          </div>
        </div>
        <div className="dp-inline-actions">
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
  );
}
