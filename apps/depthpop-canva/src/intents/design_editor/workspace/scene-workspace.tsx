import React from "react";
import { DepthViewport, type TransformMode } from "../viewport/DepthViewport";
import { AnimationPanel } from "./animation-panel";
import { ExportPanel } from "./export-panel";
import { SceneLayersPanel } from "./scene-layers-panel";
import { SceneObjectInspector } from "./scene-object-inspector";
import { SceneCameraPanel } from "./scene-camera-panel";
import {
  useSceneWorkspaceController,
  type SceneWorkspaceProps,
  type WorkspacePanel,
} from "./use-scene-workspace-controller";

export type { SceneWorkspaceProps } from "./use-scene-workspace-controller";

export function SceneWorkspace(props: SceneWorkspaceProps) {
  const {
    state, dispatch, scene, dirty, onExit,
    setIsPlaying, activePanel, setActivePanel, backgroundReconstructionEnabled, degradedObjects,
    assetError, transformMode, setTransformMode, viewportScene, handleViewportTransform,
    apiClient, mergeSelection, setMergeSelection, isObjectBusy, handleMerge,
    sortedObjects, resolveUrl, selectedObject, objectNameDraft, setObjectNameDraft,
    handleRename, handleDuplicate, handleSplit, handleDelete, selectedPoseTimes,
    isPlaying, easing, setEasing, addPose, applyPreset,
    exportFormat, setExportFormat, includeAnimation, setIncludeAnimation, exportFps,
    setExportFps, exportWidth, setExportWidth, exportHeight, setExportHeight,
    exportBusy, exportStatus, startExport, cancelExport, downloadExport,
    onSave, isSaving, isRenderingToCanva, handleSave, onExport,
    handleRenderToCanva, statusMessage,
  } = useSceneWorkspaceController(props);

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
