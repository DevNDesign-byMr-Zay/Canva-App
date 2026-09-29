import React from "react";
import { Text, Title } from "@canva/app-ui-kit";
import { FormattedMessage } from "react-intl";
import type { ApplyVerificationReceipt } from "../apply-verification";
import type { ApplyAttestation } from "../apply-attestation";

export type ProofCardProps = {
  receipt: ApplyVerificationReceipt;
  attestation: ApplyAttestation;
};

export const ProofCard: React.FC<ProofCardProps> = ({ receipt, attestation }) => (
  <section className="hf-proof-card" aria-labelledby="proof-title">
    <div className="hf-proof-topline">
      <div>
        <div className="hf-card-eyebrow">03 · Verified result</div>
        <div id="proof-title">
          <Title>
            <FormattedMessage defaultMessage="Apply proof sealed" description="Verified result heading." />
          </Title>
        </div>
      </div>
      <span className="hf-proof-seal" aria-hidden="true">✓</span>
    </div>

    <div className="hf-card-copy">
      <Text>
        <FormattedMessage
          defaultMessage="Scenario {id} changed {count, number} element(s) and Canva matched the reviewed expectation."
          description="Verified apply summary."
          values={{ id: receipt.scenarioId, count: receipt.changedElementIds.length }}
        />
      </Text>
    </div>

    <div className="hf-proof-list">
      <div className="hf-proof-row">
        <span className="hf-proof-label">Reviewed target</span>
        <span className="hf-proof-value">{attestation.designId} · {attestation.pageId}</span>
      </div>
      <div className="hf-proof-row">
        <span className="hf-proof-label">Source</span>
        <span className="hf-proof-value">{`${attestation.sourceFingerprint.slice(0, 18)}…`}</span>
      </div>
      <div className="hf-proof-row">
        <span className="hf-proof-label">Expected → result</span>
        <span className="hf-proof-value">
          {`${receipt.expectedFingerprint.slice(0, 12)}…`} → {`${receipt.resultingFingerprint.slice(0, 12)}…`}
        </span>
      </div>
      <div className="hf-proof-row">
        <span className="hf-proof-label">Sealed evidence</span>
        <span className="hf-proof-value">
          {`${receipt.receiptFingerprint.slice(0, 12)}…`} · {`${attestation.attestationFingerprint.slice(0, 12)}…`}
        </span>
      </div>
    </div>
  </section>
);
