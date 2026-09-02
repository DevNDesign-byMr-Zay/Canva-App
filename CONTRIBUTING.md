# Contributing

## Scope

Treat `legacy-html/` and `provenance/` as authenticated historical material. Do not bulk-reformat, rename, deduplicate, or regenerate those artifacts solely to satisfy quality tooling.

Maintained executable code lives in `archive_verifier/`, with the compatibility entrypoint in `scripts/` and tests in `tests/`.

## Development workflow

1. Create one focused change at a time.
2. Add or update tests in the same change when behavior changes.
3. Run `make check` before pushing.
4. Keep generated dependency locks reproducible and committed.
5. Update `CHANGELOG.md` for meaningful maintained-surface changes.

## Required local checks

```bash
make setup
make check
```

That runs Ruff, strict mypy, pytest with the enforced coverage floor, dependency consistency/audit checks, and the authenticated archive verifier.

## Security and deidentification

Never commit credentials, private keys, personal identifiers, client/customer records, or local machine paths. Changes to identity/credential scanning rules must include regression tests.

## Provenance rules

Do not manufacture missing historical source or present derived/reconstructed code as an exact original artifact. Do not fabricate historical commits, authors, dates, tags, or releases. Legitimate future work should be committed incrementally under the actual contributor identity.
