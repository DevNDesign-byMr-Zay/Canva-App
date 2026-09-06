from __future__ import annotations

import hashlib
import json
import re
import sys
from collections.abc import Mapping, Sequence
from pathlib import Path

PROVENANCE_SCHEMA_VERSION = 1
EXPECTED_GENERATED_PATH = "app/authenticated-v115/index.html"
DEFAULT_PROVENANCE_PATH = Path("app/authenticated-v115/PROVENANCE.json")
_SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")


class ProvenanceIntegrityError(ValueError):
    """Raised when authenticated-v115 provenance is malformed or internally inconsistent."""


def _require_mapping(value: object, label: str) -> Mapping[str, object]:
    if not isinstance(value, Mapping):
        raise ProvenanceIntegrityError(f"{label} must be an object")
    return value


def _require_exact_keys(record: Mapping[str, object], expected: set[str], label: str) -> None:
    actual = set(record)
    if actual != expected:
        missing = sorted(expected - actual)
        unexpected = sorted(actual - expected)
        raise ProvenanceIntegrityError(
            f"{label} keys do not match schema: missing={missing}, unexpected={unexpected}"
        )


def _require_sha256(value: object, label: str) -> str:
    if not isinstance(value, str) or _SHA256_PATTERN.fullmatch(value) is None:
        raise ProvenanceIntegrityError(f"{label} must be a lowercase 64-character SHA-256")
    return value


def _canonical_identity_text(identity: Mapping[str, object]) -> str:
    occurrence = identity["occurrence"]
    source_filename_sha256 = identity["source_filename_sha256"]
    repository_filename = identity["repository_filename"]
    sanitized_sha256 = identity["sanitized_sha256"]
    return "\n".join(
        (
            f"occurrence={occurrence}",
            f"source_filename_sha256={source_filename_sha256}",
            f"repository_filename={repository_filename}",
            f"sanitized_sha256={sanitized_sha256}",
        )
    )


def validate_provenance_record(record: object) -> Mapping[str, object]:
    """Validate schema and independently recompute the authenticated identity fingerprint."""
    provenance = _require_mapping(record, "provenance")
    _require_exact_keys(
        provenance,
        {"schema_version", "identity", "generated_path", "historical_archive_mutated"},
        "provenance",
    )

    if provenance["schema_version"] != PROVENANCE_SCHEMA_VERSION:
        raise ProvenanceIntegrityError(
            f"unsupported provenance schema version: {provenance['schema_version']}"
        )
    if provenance["generated_path"] != EXPECTED_GENERATED_PATH:
        raise ProvenanceIntegrityError("generated_path does not identify authenticated v115 output")
    if provenance["historical_archive_mutated"] is not False:
        raise ProvenanceIntegrityError("historical archive mutation flag must remain false")

    identity = _require_mapping(provenance["identity"], "identity")
    _require_exact_keys(
        identity,
        {
            "occurrence",
            "source_filename_sha256",
            "repository_filename",
            "sanitized_sha256",
            "fingerprint",
        },
        "identity",
    )

    occurrence = identity["occurrence"]
    if isinstance(occurrence, bool) or not isinstance(occurrence, int) or occurrence < 1:
        raise ProvenanceIntegrityError("identity occurrence must be a positive integer")

    repository_filename = identity["repository_filename"]
    if (
        not isinstance(repository_filename, str)
        or not repository_filename
        or Path(repository_filename).name != repository_filename
    ):
        raise ProvenanceIntegrityError("repository_filename must be one repository basename")

    _require_sha256(identity["source_filename_sha256"], "source_filename_sha256")
    _require_sha256(identity["sanitized_sha256"], "sanitized_sha256")
    fingerprint = _require_sha256(identity["fingerprint"], "fingerprint")

    expected_fingerprint = hashlib.sha256(_canonical_identity_text(identity).encode()).hexdigest()
    if fingerprint != expected_fingerprint:
        raise ProvenanceIntegrityError(
            f"stale provenance fingerprint: expected {expected_fingerprint}, got {fingerprint}"
        )

    return provenance


def verify_provenance_file(path: Path = DEFAULT_PROVENANCE_PATH) -> Mapping[str, object]:
    try:
        record = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ProvenanceIntegrityError(f"unable to read provenance JSON: {exc}") from exc
    return validate_provenance_record(record)


def main(argv: Sequence[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if len(args) > 1:
        raise SystemExit("usage: python -m archive_verifier.provenance_integrity [PROVENANCE.json]")
    path = Path(args[0]) if args else DEFAULT_PROVENANCE_PATH
    verify_provenance_file(path)
    print(f"verified authenticated v115 provenance: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
