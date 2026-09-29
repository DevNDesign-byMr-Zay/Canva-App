import React from "react";
import { Button, Text, Title } from "@canva/app-ui-kit";
import { FormattedMessage, useIntl } from "react-intl";
import type { CanvaDesignSnapshot } from "../canva-design";

export type SnapshotCardProps = {
  snapshot: CanvaDesignSnapshot | null;
  onRefresh: () => void;
  isLoading: boolean;
  isApplying: boolean;
};

export const SnapshotCard: React.FC<SnapshotCardProps> = ({
  snapshot,
  onRefresh,
  isLoading,
  isApplying,
}) => {
  const intl = useIntl();
  const readLabel = intl.formatMessage({
    defaultMessage: "Read current design",
    description: "Action button to capture current Canva snapshot.",
  });

  return (
    <section className="hf-card" aria-labelledby="snapshot-title">
      <div className="hf-card-header">
        <div>
          <div className="hf-card-eyebrow">
            <FormattedMessage defaultMessage="01 · Current design" description="Snapshot workflow step." />
          </div>
          <div id="snapshot-title">
            <Title>
              <FormattedMessage defaultMessage="Capture state" description="Heading for reading current Canva state." />
            </Title>
          </div>
        </div>
        <span className={`hf-state-pill ${snapshot ? "is-ready" : "is-locked"}`}>
          {snapshot ? "Ready" : "Required"}
        </span>
      </div>

      <div className="hf-card-actions">
        <Button
          variant="secondary"
          onClick={onRefresh}
          loading={isLoading}
          disabled={isApplying}
          stretch
        >
          {readLabel}
        </Button>
      </div>

      {snapshot ? (
        <div className="hf-snapshot-meta">
          <div className="hf-metric">
            <span className="hf-metric-value">{snapshot.elements.length}</span>
            <span className="hf-metric-label">Elements</span>
          </div>
          <div className="hf-fingerprint">
            <span className="hf-data-label">Snapshot fingerprint</span>
            <span className="hf-code">{`${snapshot.fingerprint.slice(0, 18)}…`}</span>
          </div>
        </div>
      ) : (
        <div className="hf-empty">
          <Text>
            <FormattedMessage
              defaultMessage="No snapshot yet. Read the current design before reviewing a candidate."
              description="Empty state before a design snapshot is captured."
            />
          </Text>
        </div>
      )}
    </section>
  );
};
