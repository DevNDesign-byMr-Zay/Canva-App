from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

import pytest

from archive_verifier.materializer import provenance_record
from archive_verifier.provenance_integrity import (
    ProvenanceIntegrityError,
    main,
    validate_provenance_record,
    verify_generated_artifact,
    verify_provenance_file,
)


def _write_record(path: Path, record: object) -> None:
    path.write_text(json.dumps(record, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _write_generated_artifact(root: Path, data: bytes) -> Path:
    path = root / "app" / "authenticated-v115" / "index.html"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return path


def test_accepts_generated_authenticated_v115_provenance(tmp_path: Path) -> None:
    record = provenance_record()
    assert validate_provenance_record(record) == record

    repository_artifact = Path("app/authenticated-v115/index.html").read_bytes()
    _write_generated_artifact(tmp_path, repository_artifact)
    path = tmp_path / "PROVENANCE.json"
    _write_record(path, record)
    assert verify_provenance_file(path, tmp_path) == record


def test_cli_accepts_committed_authenticated_v115_provenance() -> None:
    assert main([]) == 0


def test_rejects_stale_identity_fingerprint() -> None:
    record = deepcopy(provenance_record())
    identity = record["identity"]
    assert isinstance(identity, dict)
    identity["repository_filename"] = "drifted.html"

    with pytest.raises(ProvenanceIntegrityError, match="stale provenance fingerprint"):
        validate_provenance_record(record)


@pytest.mark.parametrize(
    ("field", "value", "message"),
    [
        ("schema_version", 2, "unsupported provenance schema version"),
        ("generated_path", "app/other/index.html", "generated_path"),
        ("historical_archive_mutated", True, "mutation flag"),
    ],
)
def test_rejects_provenance_contract_drift(field: str, value: object, message: str) -> None:
    record = deepcopy(provenance_record())
    record[field] = value

    with pytest.raises(ProvenanceIntegrityError, match=message):
        validate_provenance_record(record)


def test_rejects_schema_key_drift_and_non_object_records() -> None:
    record = deepcopy(provenance_record())
    record["unexpected"] = True
    with pytest.raises(ProvenanceIntegrityError, match="keys do not match schema"):
        validate_provenance_record(record)

    with pytest.raises(ProvenanceIntegrityError, match="provenance must be an object"):
        validate_provenance_record([])


def test_rejects_invalid_identity_shapes_and_hashes() -> None:
    record = deepcopy(provenance_record())
    identity = record["identity"]
    assert isinstance(identity, dict)
    identity["occurrence"] = 0
    with pytest.raises(ProvenanceIntegrityError, match="positive integer"):
        validate_provenance_record(record)

    record = deepcopy(provenance_record())
    identity = record["identity"]
    assert isinstance(identity, dict)
    identity["repository_filename"] = "nested/v115.html"
    with pytest.raises(ProvenanceIntegrityError, match="repository_filename"):
        validate_provenance_record(record)

    record = deepcopy(provenance_record())
    identity = record["identity"]
    assert isinstance(identity, dict)
    identity["sanitized_sha256"] = "not-a-sha"
    with pytest.raises(ProvenanceIntegrityError, match="64-character SHA-256"):
        validate_provenance_record(record)


def test_rejects_generated_artifact_byte_drift(tmp_path: Path) -> None:
    record = provenance_record()
    _write_generated_artifact(tmp_path, b"drifted authenticated app")

    with pytest.raises(ProvenanceIntegrityError, match="generated artifact SHA mismatch"):
        verify_generated_artifact(record, tmp_path)


def test_rejects_missing_generated_artifact(tmp_path: Path) -> None:
    record = provenance_record()
    with pytest.raises(ProvenanceIntegrityError, match="unable to read generated artifact"):
        verify_generated_artifact(record, tmp_path)


def test_rejects_unreadable_json_and_cli_overflow(tmp_path: Path) -> None:
    path = tmp_path / "PROVENANCE.json"
    path.write_text("{not-json", encoding="utf-8")
    with pytest.raises(ProvenanceIntegrityError, match="unable to read provenance JSON"):
        verify_provenance_file(path, tmp_path)

    with pytest.raises(SystemExit, match="usage"):
        main(["one.json", "two.json"])
