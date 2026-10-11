import React, { useState, useEffect } from "react";
import type { DepthScene, DepthObject } from "../scene/depth-scene";
import { bindWebGLRecovery } from "./webgl-recovery";

export interface DepthViewportProps {
  scene: DepthScene;
  selectedObjectId: string | null;
  onSelectObject?: (id: string | null) => void;
  onUpdateTransform?: (
    objectId: string,
    transform: DepthObject["transform"],
  ) => void;
  isFallback?: boolean;
}

export function DepthViewport({
  scene,
  selectedObjectId,
  onSelectObject,
  isFallback = false,
}: DepthViewportProps) {
  const [hasContextError, setHasContextError] = useState(false);

  useEffect(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      '[data-testid="depth-webgl-canvas"]',
    );
    if (!canvas) return;

    return bindWebGLRecovery(
      canvas,
      () => ({
        sceneId: scene.id,
        selectedObjectId,
        currentTimeMs: scene.timeline.currentTimeMs,
        camera: scene.camera,
        wasPlaying: false,
      }),
      {
        onLost: () => setHasContextError(true),
        onRestored: () => setHasContextError(false),
      },
    );
  }, [scene.id, scene.camera, scene.timeline.currentTimeMs, selectedObjectId]);

  if (isFallback || hasContextError) {
    return (
      <div
        data-testid="depth-webgl-viewport"
        className="dp-webgl-viewport fallback"
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          background: "#111",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ color: "#aaa", textAlign: "center", padding: "16px" }}>
          <p>Spatial WebGL viewport is unavailable or restored.</p>
          <p style={{ fontSize: "12px", opacity: 0.8 }}>
            Editing coordinates in Precision Inspector remains active.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="depth-webgl-viewport"
      className="dp-webgl-viewport"
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        background: "#1a1a1a",
        overflow: "hidden",
      }}
    >
      <canvas
        data-testid="depth-webgl-canvas"
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      {/* 3D Scene Overlay & Objects */}
      <div
        className="dp-webgl-scene-objects"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
        }}
      >
        {scene.objects
          .filter((obj) => obj.visible)
          .map((obj) => {
            const isSelected = obj.id === selectedObjectId;
            const cutoutUrl = obj.assets?.cutoutUrl;
            return (
              <div
                key={obj.id}
                data-testid={`webgl-object-${obj.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectObject?.(obj.id);
                }}
                style={{
                  position: "absolute",
                  left: `${obj.transform.position.x * 100}%`,
                  top: `${obj.transform.position.y * 100}%`,
                  transform: `translate(-50%, -50%) rotate(${obj.transform.rotation.z}deg) scale(${obj.transform.scale.x})`,
                  opacity: obj.opacity,
                  outline: isSelected ? "2px solid #00c4cc" : "none",
                  pointerEvents: "auto",
                  cursor: obj.locked ? "not-allowed" : "pointer",
                }}
              >
                {cutoutUrl && (
                  <img
                    src={cutoutUrl}
                    alt={obj.label}
                    style={{
                      maxHeight: "200px",
                      display: "block",
                      userSelect: "none",
                    }}
                  />
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}
