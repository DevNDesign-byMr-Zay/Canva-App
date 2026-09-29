import React, { useMemo, useState } from "react";
import { Alert, Button, Text } from "@canva/app-ui-kit";
import { FormattedMessage, useIntl } from "react-intl";
import {
  MATERIAL_PRESETS,
  type CreationType,
  type HolographicMaterialPreset,
} from "../holographic/material-contract";
import { createEffectPlan, type HolographicEffectPlan } from "../holographic/effect-plan";
import { canExecuteHolographicPlan } from "../holographic/effect-executor";
import { getCreationForgeSupport } from "../holographic/forge-support";
import { CreationTypes } from "./creation-types";
import { MaterialPresets } from "./material-presets";
import { MaterialControls, type MaterialParameters } from "./material-controls";

export type CreatePanelProps = {
  onPreviewHologram: (plan: HolographicEffectPlan) => void;
  onForgeIntoCanva: (plan: HolographicEffectPlan) => Promise<void> | void;
  isForging?: boolean;
};

export const CreatePanel: React.FC<CreatePanelProps> = ({
  onPreviewHologram,
  onForgeIntoCanva,
  isForging = false,
}) => {
  const intl = useIntl();
  const [creationType, setCreationType] = useState<CreationType>("holo_graphic");
  const [selectedPreset, setSelectedPreset] = useState<HolographicMaterialPreset>(
    MATERIAL_PRESETS[0],
  );
  const [parameters, setParameters] = useState<MaterialParameters>(MATERIAL_PRESETS[0].parameters);
  const [activeTabSection, setActiveTabSection] = useState<"presets" | "custom">("presets");
  const [previewPlan, setPreviewPlan] = useState<HolographicEffectPlan | null>(null);

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
      }),
    [creationType, parameters, selectedPreset.id],
  );
  const support = getCreationForgeSupport(creationType);
  const canForge = canExecuteHolographicPlan(currentPlan) && !isForging;

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
            defaultMessage="Preview ready for {presetName}. SPATIAL shows the 2.5D design comparison; depth and motion remain preview-only."
            description="Preview update banner"
            values={{ presetName: previewPlan.presetName }}
          />
        </Alert>
      )}

      {!support.forgeable && (
        <Alert tone="warn">
          <FormattedMessage
            defaultMessage="{reason} You can still preview this creation type."
            description="Explains why a creation type cannot yet be forged into Canva."
            values={{ reason: support.reason }}
          />
        </Alert>
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
            defaultMessage="Forgeable materials create editable HoloForge app elements in Canva. Position changes use Canva-native editing; depth and motion stay preview-only."
            description="Capability footnote explaining native vs app-owned effects."
          />
        </Text>
      </div>
    </div>
  );
};
