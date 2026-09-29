import React from "react";
import { Rows } from "@canva/app-ui-kit";
import type { CanvaDesignSnapshot } from "../canva-design";
import type { HoloForgeScenario } from "../scenario-contract";
import type { ScenarioElementReview } from "../scenario-review";
import type { ApplyVerificationReceipt } from "../apply-verification";
import type { ApplyAttestation } from "../apply-attestation";
import { SnapshotCard } from "./snapshot-card";
import { ReviewCard } from "./review-card";
import { ProofCard } from "./proof-card";

export type VerifyPanelProps = {
  snapshot: CanvaDesignSnapshot | null;
  reviewScenario: HoloForgeScenario | null;
  review: readonly ScenarioElementReview[];
  scenarioVerified: boolean;
  readyToApply: boolean;
  isReading: boolean;
  isApplying: boolean;
  receipt: ApplyVerificationReceipt | null;
  attestation: ApplyAttestation | null;
  onRefresh: () => void;
  onApply: () => void;
};

export const VerifyPanel: React.FC<VerifyPanelProps> = ({
  snapshot,
  reviewScenario,
  review,
  scenarioVerified,
  readyToApply,
  isReading,
  isApplying,
  receipt,
  attestation,
  onRefresh,
  onApply,
}) => (
  <div className="hf-verify-panel" id="panel-verify" role="tabpanel" aria-labelledby="tab-verify">
    <Rows spacing="2u">
      <SnapshotCard
        snapshot={snapshot}
        onRefresh={onRefresh}
        isLoading={isReading}
        isApplying={isApplying}
      />
      <ReviewCard
        reviewScenario={reviewScenario}
        review={review}
        hasSnapshot={Boolean(snapshot)}
        scenarioVerified={scenarioVerified}
        readyToApply={readyToApply}
        isApplying={isApplying}
        isReading={isReading}
        onApply={onApply}
      />
      {receipt && attestation && <ProofCard receipt={receipt} attestation={attestation} />}
    </Rows>
  </div>
);
