# Changelog

All notable maintained-surface changes to this repository are documented here.

## 1.0.0 — 2026-09-02

### Added

- Typed `archive_verifier` package with separate configuration, models, scanning, service, logging, and CLI layers.
- Structured JSON verification logging and typed `ArchiveVerificationError` failures.
- Pytest fixture-driven coverage for successful reconstruction, duplicate accounting, malformed payloads, SHA mismatches, manifest failures, identity leakage, credential leakage, configuration validation, and CLI exit behavior.
- Python project metadata, strict Ruff and mypy configuration, coverage enforcement, and pinned development dependencies.
- Multi-job CI for tests, coverage, lint, type checking, dependency audit, and authenticated archive verification.
- Dockerfile and Makefile for reproducible fresh-clone validation.

### Changed

- `scripts/verify_legacy_archive.py` is now a backward-compatible thin entrypoint rather than a monolithic verifier.
- README now accurately distinguishes authenticated historical application artifacts from the maintained executable verifier.

### Integrity policy

Historical source artifacts are not rewritten or deduplicated merely to improve repository-quality heuristics. Missing application source is not reconstructed and presented as original code. Repository history is allowed to develop through legitimate future work rather than fabricated dates, contributors, tags, or releases.
