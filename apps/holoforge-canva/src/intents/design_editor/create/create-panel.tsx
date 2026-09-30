import type { ImageRef } from "@canva/asset";
import React, { useMemo, useState } from "react";
import { Alert, Button, Text } from "@canva/app-ui-kit";
import { FormattedMessage, useIntl } from "react-intl";
import {
  MATERIAL_PRESETS,
  type CreationType,
  type HolographicMaterialPreset,
} from "../holographic/material-contract";
import { createEffectPlan, type HolographicEffectPlan } from "../holographic/effect-plan";
import { canExecuteHolographicPlan, resolveExecutionRoute } from "../holographic/effect-executor";
import { getCreationForgeSupport } from "../holographic/forge-support";
import { CreationTypes } from "./creation-types";
import { MaterialPresets } from "./material-presets";
import { MaterialControls, type MaterialParameters } from "./material-controls";

export type CreatePanelProps = {
  onPreviewHologram: (plan: HolographicEffectPlan) => void;
  onForgeIntoCanva: (plan: HolographicEffectPlan) => Promise<void> | void;
  isForging?: boolean;
  sourceImageRef?: ImageRef;
  sourceKind?: "selected" | "uploaded";
  sourceDescription?: string;
};

export const CreatePanel: React.FC<CreatePanelProps> = ({
  onPreviewHologram,
  onForgeIntoCanva,
  isForging = false,
  sourceImageRef,
  sourceKind,
  sourceDescription,
}) => {
  const intl = useIntl();
  const [creationType, setCreationType] = useState<CreationType>("holo_graphic");
  const [selectedPreset, setSelectedPreset] = useState<HolographicMaterialPreset>(
    MATERIAL_PRESETS[0],
  );
  const [parameters, setParameters] = useState<MaterialParameters>(MATERIAL_PRESETS[0].parameters);
  const [activeTabSection, setActiveTabSection] = useState<"presets" | "custom">("presets");
  const [previewPlan, setPreviewPlan] = useState<HolographicEffectPlan | null>(null);
  const [textSource, setTextSource] = useState("HOLOFORGE");

  const handleSelectPreset = (preset: HolographicMaterialPreset) => {
    setSelectedPreset(preset);
    setParameters(preset.parameters);
  };

  const handleChangeParameter = <K extends keyof MaterialParameters>(
    key: K,
    value: MaterialParameters[K],
  ) => {
    setParameters((prev) => ({ ...prev, [key]: value }));
  };

  const currentPlan = useMemo(
    () =>
      createEffectPlan({
        creationType,
        presetId: selectedPreset.id,
        customParameters: parameters,
        sourceImageRef,
        sourceKind,
        sourceText: creationType === "holo_text" ? textSource : undefined,
      }),
    [creationType, parameters, selectedPreset.id, sourceImageRef, sourceKind, textSource],
  );

  const support = getCreationForgeSupport(creationType);
  const canForge = canExecuteHolographicPlan(currentPlan) && !isForging;
  const route = resolveExecutionRoute(currentPlan);
  const sourceMissing =
    (support.requiredSource === "image" && !sourceImageRef) ||
    (support.requiredSource === "text" && !textSource.trim());

  const previewLabel = intl.formatMessage({
    defaultMessage: "Preview Hologram",
    description: "Preview Hologram button label",
  });
  const forgeLabel = intl.formatMessage({
    defaultMessage: "Forge into Canva",
    description: "Forge into Canva button label",
  });

  return (
    <div className="hf-create-panel" id="panel-create" role="tabpanel" aria-labelledby="tab-create">
      <div className="hf-section">
        <span className="hf-section-kicker">
          <FormattedMessage
            defaultMessage="01 · CREATION TYPE"
            description="Creation type section kicker"
          />
        </span>
        <CreationTypes selectedType={creationType} onSelectType={setCreationType} />

        {creationType === "holo_text" && (
          <div className="hf-source-editor">
            <label htmlFor="hf-holo-text">TEXT SOURCE</label>
            <input
              id="hf-holo-text"
              type="text"
              maxLength={96}
              value={textSource}
              onChange={(event) => setTextSource(event.target.value)}
              placeholder="Enter holographic text"
            />
            <span>{textSource.trim().length}/96 · rendered as a re-editable HoloForge app element</span>
          </div>
        )}

        {(creationType === "holo_logo" || creationType === "holo_graphic") && (
          <div className={"hf-source-status " + (sourceImageRef ? "is-ready" : "")}>
            <div>
              <span>IMAGE SOURCE</span>
              <strong>
                {sourceImageRef
                  ? sourceDescription || (sourceKind === "selected" ? "Selected Canva image" : "Uploaded source")
                  : creationType === "holo_logo"
                    ? "Required for Holo Logo"
                    : "Optional for Holo Graphic"}
              </strong>
            </div>
            <b>{sourceImageRef ? (route === "DERIVED_IMAGE" ? "PIXEL FORGE" : "BOUND") : "NO SOURCE"}</b>
          </div>
        )}
      </div>

      <div className="hf-section">
        <div className="hf-section-header">
          <span className="hf-section-kicker">
            <FormattedMessage
              defaultMessage="02 · MATERIAL"
              description="Material presets section kicker"
            />
          </span>
          <div className="hf-sub-tab-group">
            <button
              type="button"
              className={`hf-sub-tab ${activeTabSection === "presets" ? "is-active" : ""}`}
              onClick={() => setActiveTabSection("presets")}
            >
              <FormattedMessage defaultMessage="Presets" description="Presets tab button" />
            </button>
            <button
              type="button"
              className={`hf-sub-tab ${activeTabSection === "custom" ? "is-active" : ""}`}
              onClick={() => setActiveTabSection("custom")}
            >
              <FormattedMessage defaultMessage="Tweak" description="Tweak tab button" />
            </button>
          </div>
        </div>

        {activeTabSection === "presets" ? (
          <MaterialPresets
            selectedPresetId={selectedPreset.id}
            onSelectPreset={handleSelectPreset}
          />
        ) : (
          <MaterialControls parameters={parameters} onChangeParameter={handleChangeParameter} />
        )}
      </div>

      {previewPlan && (
        <Alert tone="info">
          <FormattedMessage
            defaultMessage="Preview ready for {presetName}. SPATIAL shows the depth and material intent before you commit the forge."
            description="Preview update banner"
            values={{ presetName: previewPlan.presetName }}
          />
        </Alert>
      )}

      {sourceMissing && (
        <Alert tone="warn">
          {support.reason}
        </Alert>
      )}

      {!sourceMissing && (
        <div className="hf-route-note">
          <span>OUTPUT ROUTE</span>
          <strong>{route === "DERIVED_IMAGE" ? "Derived holographic image" : "Editable HoloForge app element"}</strong>
        </div>
      )}

      <div className="hf-action-bar">
        <Button
          variant="secondary"
          onClick={() => {
            setPreviewPlan(currentPlan);
            onPreviewHologram(currentPlan);
          }}
          stretch
        >
          {previewLabel}
        </Button>
        <Button
          variant="primary"
          onClick={() => void onForgeIntoCanva(currentPlan)}
          loading={isForging}
          disabled={!canForge}
          stretch
        >
          {forgeLabel}
        </Button>
      </div>

      <div className="hf-capability-note">
        <Text>
          <FormattedMessage
            defaultMessage="HoloForge creates holographic design treatments for Canva: editable text/material elements or derived raster treatments for source imagery. Motion stays a preview behavior; the forged output is static and production-safe."
            description="Capability footnote explaining HoloForge's product boundary."
          />
        </Text>
      </div>
    </div>
  );
};
