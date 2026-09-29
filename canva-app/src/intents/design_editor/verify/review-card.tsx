import React from "react";
import { Alert, Button, Text, Title } from "@canva/app-ui-kit";
import { FormattedMessage, useIntl } from "react-intl";
import type { HoloForgeScenario } from "../scenario-contract";
import type { ScenarioElementReview } from "../scenario-review";

export type ReviewCardProps = {
  reviewScenario: HoloForgeScenario | null;
  review: readonly ScenarioElementReview[];
  hasSnapshot: boolean;
  scenarioVerified: boolean;
  readyToApply: boolean;
  isApplying: boolean;
  isReading: boolean;
  onApply: () => void;
};

export const ReviewCard: React.FC<ReviewCardProps> = ({
  reviewScenario,
  review,
  hasSnapshot,
  scenarioVerified,
  readyToApply,
  isApplying,
  isReading,
  onApply,
}) => {
  const intl = useIntl();
  const applyLabel = intl.formatMessage({
    defaultMessage: "Apply scenario changes",
    description: "Primary action button to apply scenario changes.",
  });

  if (!reviewScenario) {
    return (
      <section className="hf-card" aria-labelledby="waiting-title">
        <div className="hf-card-eyebrow">02 · Scenario review</div>
        <div id="waiting-title">
          <Title>
            <FormattedMessage
              defaultMessage="Waiting for a candidate"
              description="Heading while waiting for an upstream verified scenario."
            />
          </Title>
        </div>
        <div className="hf-card-copy">
          <Alert tone="info">
            <FormattedMessage
              defaultMessage="HoloForge won't invent or silently apply a layout. Verify uses trusted upstream scenarios only."
              description="Explains the verified-scenario boundary."
            />
          </Alert>
        </div>
      </section>
    );
  }

  return (
    <section className="hf-card" aria-labelledby="review-title">
      <div className="hf-card-header">
        <div>
          <div className="hf-card-eyebrow">02 · Scenario review</div>
          <div id="review-title">
            <Title>
              <FormattedMessage
                defaultMessage="Review changes"
                description="Scenario review heading."
              />
            </Title>
          </div>
        </div>
        <span className={`hf-state-pill ${scenarioVerified ? "is-ready" : "is-locked"}`}>
          {scenarioVerified ? "Verified" : "Checking"}
        </span>
      </div>

      <div className="hf-card-copy">
        <span className="hf-data-label">Scenario</span>
        <span className="hf-code">{reviewScenario.scenarioId}</span>
      </div>

      {hasSnapshot ? (
        <>
          <div className="hf-change-list">
            {review.map(({ elementId, before, after, changedFields }) => (
              <article className="hf-change-item" key={elementId}>
                <div className="hf-change-topline">
                  <span className="hf-change-id">{elementId}</span>
                  <span className="hf-field-pill">{changedFields.join(" · ")}</span>
                </div>
                <div className="hf-change-values">
                  <span>
                    {before.left}×{before.top} · {before.width}×{before.height}
                  </span>
                  <span className="hf-arrow">↓</span>
                  <span>
                    {after.left}×{after.top} · {after.width}×{after.height}
                  </span>
                </div>
              </article>
            ))}
          </div>
          {review.length === 0 && (
            <div className="hf-empty">
              <Text>No reviewable Canva element mapping was found for this candidate.</Text>
            </div>
          )}
        </>
      ) : (
        <div className="hf-empty">
          <Text>Capture the current design to unlock a verified element-by-element review.</Text>
        </div>
      )}

      <div className="hf-apply-zone">
        <Button
          variant="primary"
          onClick={onApply}
          loading={isApplying}
          disabled={!readyToApply || isReading}
          stretch
        >
          {applyLabel}
        </Button>
        {!readyToApply && (
          <div className="hf-lock-note">
            <Text>
              Apply stays locked until provenance and the current Canva snapshot are verified.
            </Text>
          </div>
        )}
      </div>
    </section>
  );
};
