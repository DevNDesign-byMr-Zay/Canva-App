from __future__ import annotations

import hashlib
from pathlib import Path

from archive_verifier.materializer import (
    TARGET_BASENAME,
    TARGET_SHA256,
    extract_authenticated_v115,
    materialize,
    provenance_text,
    write_provenance,
)


def test_extract_authenticated_v115_matches_manifest_sha() -> None:
    data = extract_authenticated_v115()
    assert len(data) > 100_000
    assert hashlib.sha256(data).hexdigest() == TARGET_SHA256
    assert b"<html" in data.lower()


def test_materialize_writes_exact_authenticated_bytes(tmp_path: Path) -> None:
    output = materialize(tmp_path / "app" / "index.html")
    assert output.exists()
    assert hashlib.sha256(output.read_bytes()).hexdigest() == TARGET_SHA256


def test_provenance_identifies_exact_source_and_sha(tmp_path: Path) -> None:
    text = provenance_text()
    assert TARGET_BASENAME in text
    assert TARGET_SHA256 in text
    path = write_provenance(tmp_path / "PROVENANCE.md")
    assert path.read_text(encoding="utf-8") == text
