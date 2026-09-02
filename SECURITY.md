# Security Policy

## Supported surface

Security maintenance applies to the executable `archive_verifier/` package, `scripts/` CLI compatibility layer, dependency manifests, and CI workflows. Historical HTML artifacts are provenance material and are not silently rewritten as part of routine dependency or style maintenance.

## Reporting

Do not open a public issue containing credentials, private keys, personal identifiers, or sensitive client/customer information. Report sensitive findings privately to the repository owner.

## Automated controls

The repository uses credential-pattern and identity scans during authenticated archive verification, pip-audit for dependency advisories, Ruff security-oriented rules, strict mypy checks, Dependabot, and CodeQL Python analysis.

Any change to deidentification or credential-detection behavior should include a regression test covering the relevant failure path.
