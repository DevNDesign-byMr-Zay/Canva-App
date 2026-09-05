from __future__ import annotations

import hashlib
from dataclasses import replace
from pathlib import Path

import pytest

from archive_verifier.config import VerificationConfig
from archive_verifier.errors import ArchiveVerificationError
from archive_verifier.materializer import (
    AUTHENTICATED_V115,
    TARGET_BASENAME,
    TARGET_OCCURRENCE,
    TARGET_SHA256,
    TARGET_SOURCE_FILENAME_SHA256,
    AuthenticatedV115Identity,
    extract_authenticated_v115,
    materialize,
    provenance_text,
    validate_target_manifest,
    write_provenance,
)

_MANIFEST_HEADER = (
    "occurrence,source_filename_sha256,repository_filename,sanitized_sha256\n"
)


def _manifest_config(path: Path) -> VerificationConfig:
    return replace(VerificationConfig.production(), manifest_path=path)


def _target_row(
    *,
    source_filename_sha256: str = TARGET_SOURCE_FILENAME_SHA256,
    filename: str = TARGET_BASENAME,
    sha256: str = TARGET_SHA256,
) -> str:
    return f"{TARGET_OCCURRENCE},{source_filename_sha256},{filename},{sha256}\n"


def _write_manifest(path: Path, *rows: str) -> None:
    path.write_text(_MANIFEST_HEADER + "".join(rows), encoding="utf-8")


def test_target_manifest_accepts_exact_authenticated_mapping(tmp_path: Path) -> None:
    path = tmp_path / "manifest.csv"
    _write_manifest(path, _target_row())
    validate_target_manifest(_manifest_config(path))


@pytest.mark.parametrize(
    ("row", "message"),
    [
        (_target_row(source_filename_sha256="a" * 64), "source-name hash"),
        (_target_row(filename="drifted.html"), "filename"),
        (_target_row(sha256="b" * 64), "SHA"),
    ],
)
def test_target_manifest_rejects_mapping_drift(
    tmp_path: Path,
    row: str,
    message: str,
) -> None:
    path = tmp_path / "manifest.csv"
    _write_manifest(path, row)
    with pytest.raises(ArchiveVerificationError, match=message):
        validate_target_manifest(_manifest_config(path))


def test_target_manifest_rejects_duplicate_occurrence(tmp_path: Path) -> None:
    path = tmp_path / "manifest.csv"
    row = _target_row()
    _write_manifest(path, row, row)
    with pytest.raises(ArchiveVerificationError, match="found 2"):
        validate_target_manifest(_manifest_config(path))


def test_authenticated_identity_matches_tara_full_tuple() -> None:
    assert AUTHENTICATED_V115 == AuthenticatedV115Identity(
        occurrence=TARGET_OCCURRENCE,
        source_filename_sha256=TARGET_SOURCE_FILENAME_SHA256,
        repository_filename=TARGET_BASENAME,
        sanitized_sha256=TARGET_SHA256,
    )


def test_authenticated_identity_fingerprint_binds_full_tuple() -> None:
    expected = hashlib.sha256(
        (
            f"occurrence={TARGET_OCCURRENCE}\n"
            f"source_filename_sha256={TARGET_SOURCE_FILENAME_SHA256}\n"
            f"repository_filename={TARGET_BASENAME}\n"
            f"sanitized_sha256={TARGET_SHA256}"
        ).encode("utf-8")
    ).hexdigest()
    assert AUTHENTICATED_V115.fingerprint() == expected
    drifted = replace(AUTHENTICATED_V115, repository_filename="drifted.html")
    assert drifted.fingerprint() != expected


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
    assert TARGET_SOURCE_FILENAME_SHA256 in text
    assert TARGET_SHA256 in text
    assert f"Manifest occurrence: `{TARGET_OCCURRENCE}`" in text
    assert AUTHENTICATED_V115.fingerprint() in text
    path = write_provenance(tmp_path / "PROVENANCE.md")
    assert path.read_text(encoding="utf-8") == text
