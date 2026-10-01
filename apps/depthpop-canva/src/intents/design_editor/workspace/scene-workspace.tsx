import React, { useState } from "react";
import { DepthObject, DepthScene } from "../scene/depth-scene";

export interface SceneWorkspaceProps {
  initialScene: DepthScene;
  onExit?: () => void;
  onExport?: (scene: DepthScene) => void;
}

export function SceneWorkspace({
  initialScene,
  onExit,
  onExport,
}: SceneWorkspaceProps) {
  const [scene, setScene] = useState<DepthScene>(initialScene);
  const [selectedObjId, setSelectedObjId] = useState<string | null>(
    initialScene.objects.length > 0 ? initialScene.objects[0].id : null,
  );
  const [parallax, setParallax] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  const selectedObject = scene.objects.find((o) => o.id === selectedObjId);

  // Parallax interaction on mouse move over stage
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width - 0.5;
    const cy = (e.clientY - rect.top) / rect.height - 0.5;
    setParallax({ x: cx * 12, y: cy * 12 });
  };

  const handleMouseLeave = () => {
    setParallax({ x: 0, y: 0 });
  };

  // Immutable Object Update Helper
  const updateObject = (
    objId: string,
    updater: (prev: DepthObject) => DepthObject,
  ) => {
    setScene((prevScene) => {
      const updatedObjects = prevScene.objects.map((obj) => {
        if (obj.id !== objId) return obj;
        if (obj.locked) return obj; // Reject edits if object is locked
        return updater(obj);
      });
      return {
        ...prevScene,
        objects: updatedObjects,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const toggleLock = (objId: string) => {
    setScene((prevScene) => {
      const updatedObjects = prevScene.objects.map((obj) => {
        if (obj.id !== objId) return obj;
        return { ...obj, locked: !obj.locked };
      });
      return {
        ...prevScene,
        objects: updatedObjects,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const toggleVisibility = (objId: string) => {
    setScene((prevScene) => {
      const updatedObjects = prevScene.objects.map((obj) => {
        if (obj.id !== objId) return obj;
        return { ...obj, visible: !obj.visible };
      });
      return {
        ...prevScene,
        objects: updatedObjects,
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const moveOrder = (objId: string, direction: "up" | "down") => {
    setScene((prevScene) => {
      const objects = [...prevScene.objects].sort((a, b) => a.order - b.order);
      const idx = objects.findIndex((o) => o.id === objId);
      if (idx < 0) return prevScene;

      const targetIdx = direction === "up" ? idx + 1 : idx - 1;
      if (targetIdx < 0 || targetIdx >= objects.length) return prevScene;

      // Swap orders
      const tempOrder = objects[idx].order;
      objects[idx].order = objects[targetIdx].order;
      objects[targetIdx].order = tempOrder;

      return { ...prevScene, objects, updatedAt: new Date().toISOString() };
    });
  };

  const resetObject = (objId: string) => {
    const orig = initialScene.objects.find((o) => o.id === objId);
    if (!orig) return;
    setScene((prevScene) => ({
      ...prevScene,
      objects: prevScene.objects.map((o) => (o.id === objId ? { ...orig } : o)),
    }));
  };

  const resetScene = () => {
    setScene(initialScene);
    if (initialScene.objects.length > 0) {
      setSelectedObjId(initialScene.objects[0].id);
    }
  };

  const sortedObjects = [...scene.objects].sort((a, b) => a.order - b.order);

  return (
    <div className="dp-workspace" data-testid="scene-workspace">
      <header className="dp-ws-header">
        <button type="button" className="dp-btn-text" onClick={onExit}>
          ← Back to Source
        </button>
        <span className="dp-chip">DEPTHSCENE V1</span>
        <button type="button" className="dp-btn-reset" onClick={resetScene}>
          Reset Scene
        </button>
      </header>

      {/* 2.5D Interactive Parallax Stage */}
      <div
        className="dp-stage"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ aspectRatio: `${scene.width} / ${scene.height}` }}
      >
        {/* Reconstructed Back Plate */}
        <img
          src={scene.reconstructedPlate.imageUrl}
          alt="Reconstructed Plate"
          className="dp-stage-plate"
          style={{
            transform: `translate(${parallax.x * 0.2}px, ${parallax.y * 0.2}px)`,
          }}
        />

        {/* Extracted Depth Objects */}
        {sortedObjects.map((obj) => {
          if (!obj.visible) return null;

          const isSelected = obj.id === selectedObjId;
          const zOffset = obj.transform.position.z * 10;
          const pxShiftX = parallax.x * (1 + obj.transform.position.z);
          const pxShiftY = parallax.y * (1 + obj.transform.position.z);

          const leftPct = (obj.bbox.x / scene.width) * 100;
          const topPct = (obj.bbox.y / scene.height) * 100;
          const widthPct = (obj.bbox.width / scene.width) * 100;
          const heightPct = (obj.bbox.height / scene.height) * 100;

          return (
            <div
              key={obj.id}
              className={`dp-stage-object ${isSelected ? "is-selected" : ""}`}
              onClick={() => setSelectedObjId(obj.id)}
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                width: `${widthPct}%`,
                height: `${heightPct}%`,
                opacity: obj.opacity,
                filter: obj.feather > 0 ? `blur(${obj.feather}px)` : "none",
                transform: `translate(${pxShiftX}px, ${pxShiftY}px) scale(${obj.transform.scale.x}) rotate(${obj.transform.rotation.z}deg)`,
                zIndex: obj.order + 10,
              }}
            >
              <img
                src={obj.assets.cutoutUrl}
                alt={obj.label}
                className="dp-cutout-img"
              />
              {isSelected && <div className="dp-select-border" />}
            </div>
          );
        })}
      </div>

      {/* Layers List */}
      <section className="dp-layers-panel">
        <h3>SCENE OBJECTS ({scene.objects.length})</h3>
        <div className="dp-layers-list">
          {sortedObjects.map((obj) => (
            <div
              key={obj.id}
              className={`dp-layer-item ${obj.id === selectedObjId ? "is-active" : ""}`}
              onClick={() => setSelectedObjId(obj.id)}
            >
              <img
                src={obj.assets.thumbnailUrl}
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
                    toggleVisibility(obj.id);
                  }}
                >
                  {obj.visible ? "👁" : "🙈"}
                </button>

                <button
                  type="button"
                  title="Toggle Lock"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLock(obj.id);
                  }}
                >
                  {obj.locked ? "🔒" : "🔓"}
                </button>

                <button
                  type="button"
                  title="Move Up"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveOrder(obj.id, "up");
                  }}
                >
                  ▲
                </button>
                <button
                  type="button"
                  title="Move Down"
                  onClick={(e) => {
                    e.stopPropagation();
                    moveOrder(obj.id, "down");
                  }}
                >
                  ▼
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Property Controls for Selected Object */}
      {selectedObject && (
        <section className="dp-object-inspector">
          <header className="dp-inspector-header">
            <h4>
              {selectedObject.id} {selectedObject.locked && "🔒 (Locked)"}
            </h4>
            <button
              type="button"
              className="dp-btn-small"
              onClick={() => resetObject(selectedObject.id)}
            >
              Reset Object
            </button>
          </header>

          <div className="dp-inspector-grid">
            <label>
              Z / Depth Offset
              <input
                type="range"
                min={-2}
                max={2}
                step={0.05}
                disabled={selectedObject.locked}
                value={selectedObject.transform.position.z}
                onChange={(e) => {
                  const zVal = Number(e.target.value);
                  updateObject(selectedObject.id, (o) => ({
                    ...o,
                    transform: {
                      ...o.transform,
                      position: { ...o.transform.position, z: zVal },
                    },
                  }));
                }}
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
                onChange={(e) => {
                  const sVal = Number(e.target.value);
                  updateObject(selectedObject.id, (o) => ({
                    ...o,
                    transform: {
                      ...o.transform,
                      scale: { x: sVal, y: sVal, z: sVal },
                    },
                  }));
                }}
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
                onChange={(e) => {
                  const rVal = Number(e.target.value);
                  updateObject(selectedObject.id, (o) => ({
                    ...o,
                    transform: {
                      ...o.transform,
                      rotation: { ...o.transform.rotation, z: rVal },
                    },
                  }));
                }}
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
                onChange={(e) => {
                  const opVal = Number(e.target.value);
                  updateObject(selectedObject.id, (o) => ({
                    ...o,
                    opacity: opVal,
                  }));
                }}
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
                onChange={(e) => {
                  const fVal = Number(e.target.value);
                  updateObject(selectedObject.id, (o) => ({
                    ...o,
                    feather: fVal,
                  }));
                }}
              />
              <span>{selectedObject.feather}px</span>
            </label>
          </div>
        </section>
      )}

      {onExport && (
        <button
          type="button"
          className="dp-exec"
          onClick={() => onExport(scene)}
        >
          <span>EXPORT DEPTHSCENE TO CANVA</span>
        </button>
      )}
    </div>
  );
}
