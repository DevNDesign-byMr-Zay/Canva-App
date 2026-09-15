# HOLOFORGE Scenario Contract v1

## Purpose

This contract is the handoff boundary between AUREN's semantic scenario planning, VÆLON's bounded computation evidence, and HOLOFORGE's presentation/apply surface.

A scenario may be previewed only when this envelope validates. A scenario may be applied only after the same validated envelope is explicitly selected by the user.

## Envelope

```json
{
  "contractVersion": 1,
  "scenarioId": "scenario-001",
  "source": {
    "designId": "design-123",
    "snapshotId": "snapshot-abc",
    "pageIds": ["page-1"],
    "snapshotFingerprint": "sha256-hex"
  },
  "intent": {
    "summary": "Improve hierarchy while preserving locked elements",
    "objectiveId": "hierarchy-balance-v1",
    "objectiveDirection": "maximize"
  },
  "constraints": {
    "hard": [],
    "soft": []
  },
  "candidate": {
    "layout": {},
    "changedElementIds": [],
    "delta": {}
  },
  "evidence": {
    "backend": "vaelon",
    "algorithm": "deterministic-candidate-v1",
    "seed": "seed-001",
    "status": "complete",
    "objectiveScore": 0,
    "baseline": {
      "backend": "classical-reference",
      "algorithm": "exact-reference-v1",
      "objectiveScore": 0
    },
    "objectiveGap": 0,
    "durationMs": 0,
    "hardConstraintsPassed": true,
    "warnings": []
  },
  "interpretation": {
    "producer": "auren",
    "label": "Balanced hierarchy",
    "summary": "",
    "tradeoffs": []
  },
  "presentation": {
    "advisoryOnly": true,
    "autoApply": false,
    "target": "web-dashboard"
  },
  "provenance": {
    "scenarioFingerprint": "sha256-hex"
  }
}
```

## Required invariants

### Source identity

- `source.designId` and `source.snapshotId` are required non-empty strings.
- `source.snapshotFingerprint` must identify the exact source snapshot used by planning/computation.
- A candidate generated from one snapshot must never be silently rebound to another snapshot.

### Intent ownership

- `intent.summary` describes the human-facing goal.
- `intent.objectiveId` identifies the measurable objective used for comparison.
- AUREN may derive or explain this objective, but the evidence section must report the objective actually measured by VÆLON/reference computation.

### Constraints

- Hard constraints are pass/fail requirements.
- Soft constraints may contribute to ranking or score but cannot be represented as hard guarantees.
- `evidence.hardConstraintsPassed` must be true before preview/apply is enabled.

### Candidate

- `candidate.layout` contains the normalized candidate representation required by HOLOFORGE preview.
- `candidate.changedElementIds` is explicit; the UI must not infer mutation scope solely from visuals.
- `candidate.delta` records the source-to-candidate difference in a deterministic representation.

### Evidence

- `backend`, `algorithm`, and `seed` are required.
- `status` must be `complete` before a candidate can be previewed or selected.
- `objectiveScore` is the measured candidate score.
- `baseline.objectiveScore` is the measured classical-reference score for the same normalized problem.
- `objectiveGap` must be derived consistently from candidate vs baseline using the declared objective direction.
- `durationMs` is measurement evidence, not a promise of future performance.
- warnings must remain visible to HOLOFORGE.

### Interpretation

- Interpretation is semantic/explanatory output, not computation evidence.
- HOLOFORGE may visually emphasize the AUREN summary/tradeoffs, but it must not merge them into the measured evidence fields.

### Presentation safety

For v1:
- `advisoryOnly` must be `true`;
- `autoApply` must be `false`;
- initial target must be `web-dashboard`;
- future spatial targets must preserve the same evidence/provenance boundary.

### Provenance

- `scenarioFingerprint` is computed from the canonical scenario envelope excluding the fingerprint field itself.
- any material change to source identity, objective, constraints, candidate, evidence, interpretation, or presentation changes the fingerprint;
- invalid/tampered fingerprints fail closed.

## UI gating

### Preview enabled when

- contract version is supported;
- source identity is complete;
- evidence status is complete;
- hard constraints passed;
- baseline evidence exists;
- provenance fingerprint validates;
- presentation is advisory-only.

### Apply enabled when

All preview conditions pass, plus:
- user selected the scenario explicitly;
- current Canva source still matches `source.snapshotFingerprint` or a fresh reconciliation step succeeds;
- user sees affected-element/page scope;
- user activates the explicit apply action.

### Apply blocked when

- source snapshot changed;
- evidence/provenance is invalid;
- any hard constraint failed;
- computation is incomplete;
- unsupported target/contract version;
- scenario is advisory-only but no explicit apply action occurred.

## Objective gap convention

For a maximization objective:

`objectiveGap = baseline.objectiveScore - evidence.objectiveScore`

For a minimization objective:

`objectiveGap = evidence.objectiveScore - baseline.objectiveScore`

A value of `0` means the candidate matches the classical reference for the measured objective. Positive values mean the candidate is worse than the reference under the declared direction. Negative values must not be described as superiority until the baseline/problem equivalence and measurement pipeline are independently verified.

## First fixture set

AUREN should provide at least three semantic intent fixtures:
1. hierarchy-first layout;
2. spacing/balance-first layout;
3. locked-brand-elements layout.

VÆLON should provide, for each fixture:
1. exact/classical evidence;
2. deterministic candidate evidence;
3. one hard-constraint failure case;
4. one tampered provenance case.

HOLOFORGE should prove:
1. valid candidates render in Scenario Lab and Holo Stage;
2. failed constraints are blocked;
3. tampered provenance is blocked;
4. evidence and interpretation are visually distinct;
5. source/candidate comparison is read-only until explicit apply.
