import React from "react";

import type { HoloObject } from "../scene/holo-scene";

function ObjectThumb({ object }: { object: HoloObject }) {
  const sourceUrl = object.geometry.sourceUrl;
  if (sourceUrl) {
    return (
      <span className="hf-object-thumb">
        <img src={sourceUrl} alt="" />
      </span>
    );
  }

  return (
    <span className="hf-object-thumb is-generated" aria-hidden="true">
      {object.creationType === "holo_text"
        ? "T"
        : object.creationType === "light_fx"
          ? "✦"
          : "◇"}
    </span>
  );
}

export function ObjectStackPanel({
  objects,
  selectedObjectId,
  onSelect,
  onDuplicate,
  onRemove,
  onMove,
  onToggleVisible,
}: {
  objects: readonly HoloObject[];
  selectedObjectId: string | null;
  onSelect: (objectId: string) => void;
  onDuplicate: (objectId: string) => void;
  onRemove: (objectId: string) => void;
  onMove: (objectId: string, direction: "forward" | "backward") => void;
  onToggleVisible: (objectId: string, visible: boolean) => void;
}) {
  return (
    <section className="hf-object-stack" aria-label="HoloForge scene objects">
      <div className="hf-object-stack-head">
        <div>
          <span>03 · OBJECTS</span>
          <strong>SCENE STACK</strong>
        </div>
        <b>{objects.length}</b>
      </div>

      <div className="hf-object-stack-list">
        {objects.map((object, index) => {
          const selected = object.id === selectedObjectId;
          return (
            <div
              key={object.id}
              className={
                "hf-object-stack-row" +
                (selected ? " is-selected" : "") +
                (!object.visible ? " is-hidden" : "")
              }
            >
              <button
                type="button"
                className="hf-object-stack-select"
                aria-pressed={selected}
                onClick={() => onSelect(object.id)}
              >
                <ObjectThumb object={object} />
                <span>
                  <strong>{object.name}</strong>
                  <small>
                    {object.creationType.replaceAll("_", " ").toUpperCase()}
                    {" · "}
                    Z {object.transform.position.z.toFixed(2)}
                  </small>
                </span>
              </button>

              <div className="hf-object-stack-actions">
                <button
                  type="button"
                  title={object.visible ? "Hide object" : "Show object"}
                  aria-label={object.visible ? "Hide object" : "Show object"}
                  onClick={() => onToggleVisible(object.id, !object.visible)}
                >
                  {object.visible ? "●" : "○"}
                </button>
                <button
                  type="button"
                  title="Move object backward"
                  aria-label="Move object backward"
                  disabled={index === 0}
                  onClick={() => onMove(object.id, "backward")}
                >
                  ↓
                </button>
                <button
                  type="button"
                  title="Move object forward"
                  aria-label="Move object forward"
                  disabled={index === objects.length - 1}
                  onClick={() => onMove(object.id, "forward")}
                >
                  ↑
                </button>
                <button
                  type="button"
                  title="Duplicate object"
                  aria-label="Duplicate object"
                  onClick={() => onDuplicate(object.id)}
                >
                  ⧉
                </button>
                <button
                  type="button"
                  title="Remove object"
                  aria-label="Remove object"
                  disabled={objects.length <= 1}
                  onClick={() => onRemove(object.id)}
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p>
        Duplicate a hologram to build layered compositions. Stack order is preserved in HoloScene
        while X/Y/Z still control the real spatial placement.
      </p>
    </section>
  );
}
