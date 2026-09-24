## Objective
Describe the smallest application/tooling problem this PR solves.

## Scope
- What changed:
- What was intentionally left unchanged:
- Related issue/PR:

## Trust and Apply boundary
- Trusted identity/evidence source:
- Snapshot/page/scenario identity affected:
- Stale or substituted state rejected by this change:
- Explicit user action required:
- Authority explicitly **not** added by this PR:

## Validation
- [ ] Root locked install/audit/test path remains green.
- [ ] Design Editor typecheck, tests, and production build remain green when affected.
- [ ] Focused regression proves the behavior or failure path.
- [ ] Stale/unsupported/tampered context fails closed before mutation.
- [ ] Explicit Apply remains the only mutation authority.
- [ ] CodeQL/security gate passes on the exact head.
- [ ] No secrets, tokens, private identifiers, or customer data were added.
- [ ] Historical authenticated artifacts were not rewritten for cosmetic quality gains.

## Reviewer attack surface
List the stale snapshot, design/page swap, duplicate identity, unsupported transform, replayed provenance, partial-write, or deceptive evidence cases reviewers should try.

## Merge note
If stacked, state merge order and retest plan. Otherwise write `not stacked`.
