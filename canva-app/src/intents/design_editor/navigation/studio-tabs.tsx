import React from "react";
import { FormattedMessage } from "react-intl";

export type StudioTab = "create" | "spatial" | "verify";

export type StudioTabsProps = {
  activeTab: StudioTab;
  onSelectTab: (tab: StudioTab) => void;
};

export const StudioTabs: React.FC<StudioTabsProps> = ({ activeTab, onSelectTab }) => {
  return (
    <nav className="hf-tabs-nav" aria-label="HoloForge Studio Navigation">
      <div className="hf-tabs-list" role="tablist">
        <button
          type="button"
          role="tab"
          id="tab-create"
          aria-selected={activeTab === "create"}
          aria-controls="panel-create"
          className={`hf-tab-btn ${activeTab === "create" ? "is-active" : ""}`}
          onClick={() => onSelectTab("create")}
        >
          <FormattedMessage
            defaultMessage="CREATE"
            description="Create tab title in HoloForge navigation."
          />
        </button>

        <button
          type="button"
          role="tab"
          id="tab-spatial"
          aria-selected={activeTab === "spatial"}
          aria-controls="panel-spatial"
          className={`hf-tab-btn ${activeTab === "spatial" ? "is-active" : ""}`}
          onClick={() => onSelectTab("spatial")}
        >
          <FormattedMessage
            defaultMessage="SPATIAL"
            description="Spatial tab title in HoloForge navigation."
          />
        </button>

        <button
          type="button"
          role="tab"
          id="tab-verify"
          aria-selected={activeTab === "verify"}
          aria-controls="panel-verify"
          className={`hf-tab-btn ${activeTab === "verify" ? "is-active" : ""}`}
          onClick={() => onSelectTab("verify")}
        >
          <FormattedMessage
            defaultMessage="VERIFY"
            description="Verify tab title in HoloForge navigation."
          />
        </button>
      </div>
    </nav>
  );
};
