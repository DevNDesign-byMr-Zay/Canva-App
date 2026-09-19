# Security Policy

## Supported surface

Security maintenance applies to the executable `archive_verifier/` package, `scripts/` CLI compatibility layer, dependency manifests, and CI workflows. Historical HTML artifacts are provenance material and are not silently rewritten as part of routine dependency or style maintenance.

## Reporting

Do not open a public issue containing credentials, private keys, personal identifiers, or sensitive client/customer information. Report sensitive findings privately to the repository owner.

## Automated controls

The repository uses credential-pattern and identity scans during authenticated archive verification, pip-audit for Python dependency advisories, npm audit for both Node package surfaces, Ruff security-oriented rules, strict mypy checks, Dependabot, and CodeQL analysis.

The real `canva-app/` package has two npm audit boundaries. Production dependencies are always enforced with `npm audit --omit=dev --audit-level=moderate`. The full development graph is also inspected. Its current upstream Canva build-tool chain contains the reviewed transitive `uuid` advisory `GHSA-w5hq-g745-h8pq`; npm reports no fix through the pinned Canva build tooling. CI accepts only that exact four-package moderate-severity development chain and fails if the package set, severity, advisory source, directness, or fixability changes. A newly available fix must be adopted instead of extending the exception.

Any change to deidentification, credential detection, dependency-audit policy, or trusted runtime boundaries should include a regression test covering the relevant failure path.
