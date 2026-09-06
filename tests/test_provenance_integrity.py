from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

import pytest

from archive_verifier.materializer import provenance_record
from archive_verifier.provenance_integrity import (
    ProvenanceIntegrityError,
    validate_provenance_record,
    verify_provenance_file,
)


def test_accepts_generated_authenticated_v115_provenance(tmp_path: Path) -> None:
    record = provenance_record()
    assert validate_provenance_record(record) == record

    path = tmp_path / "PROVENANCE.json"
    path.write_text(json.dumps(record, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    assert verify_provenance_file(path) == record


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
