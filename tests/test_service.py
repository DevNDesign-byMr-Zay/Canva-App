from __future__ import annotations

import csv
from dataclasses import replace
from pathlib import Path
from typing import Any, Callable

import pytest

from archive_verifier.errors import ArchiveVerificationError
from archive_verifier.service import decode_archive, read_manifest, verify_archive


def test_verify_archive_happy_path(build_archive: Callable[..., Any]) -> None:
    built = build_archive()
    report = verify_archive(built.config)

    assert report.payload_parts == 2
    assert report.manifest_occurrences == 2
    assert report.distinct_states == 2
    assert report.duplicate_occurrences == 0
    assert report.manifest_hash_mismatches == 0
    assert report.identity_hits == ()
    assert report.credential_hits == ()


def test_duplicate_states_are_counted(build_archive: Callable[..., Any]) -> None:
    content = b"<html><body>same-state</body></html>"
    built = build_archive({"one.html": content, "two.html": content})

    report = verify_archive(built.config)

    assert report.distinct_states == 1
    assert report.duplicate_occurrences == 1


def test_missing_payload_part_fails(build_archive: Callable[..., Any]) -> None:
    built = build_archive()
    next(built.payload_dir.glob("part-*.b64")).unlink()

    with pytest.raises(ArchiveVerificationError, match="payload parts"):
        verify_archive(built.config)


def test_invalid_base64_fails(build_archive: Callable[..., Any]) -> None:
    built = build_archive()
    part = next(built.payload_dir.glob("part-*.b64"))
    text = part.read_text(encoding="utf-8")
    part.write_text("!" + text[1:], encoding="utf-8")

    with pytest.raises(ArchiveVerificationError, match="base64 decode failed"):
        verify_archive(built.config)


def test_archive_sha_mismatch_fails(build_archive: Callable[..., Any]) -> None:
    built = build_archive()
    config = replace(built.config, expected_archive_sha256="0" * 64)

    with pytest.raises(ArchiveVerificationError, match="archive SHA mismatch"):
        verify_archive(config)


def test_manifest_hash_mismatch_fails(build_archive: Callable[..., Any]) -> None:
    built = build_archive()
    rows = _read_rows(built.manifest_path)
    rows[0]["sanitized_sha256"] = "0" * 64
    _write_rows(built.manifest_path, rows)

    with pytest.raises(ArchiveVerificationError, match="sanitized SHA mismatch"):
        verify_archive(built.config)


def test_identity_literal_fails(build_archive: Callable[..., Any]) -> None:
    built = build_archive(
        {
            "safe.html": b"<html>safe</html>",
            "identity.html": b"<html>ROARY legacy marker</html>",
        }
    )

    with pytest.raises(ArchiveVerificationError, match="identity/branding scan hits"):
        verify_archive(built.config)


def test_credential_pattern_fails(build_archive: Callable[..., Any]) -> None:
    built = build_archive(
        {
            "safe.html": b"<html>safe</html>",
            "credential.html": b"<html>sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ123456</html>",
        }
    )

    with pytest.raises(ArchiveVerificationError, match="credential scan hits"):
        verify_archive(built.config)


def test_manifest_missing_required_column_fails(build_archive: Callable[..., Any]) -> None:
    built = build_archive()
    built.manifest_path.write_text("occurrence,repository_filename\n1,state-a.html\n", encoding="utf-8")

    with pytest.raises(ArchiveVerificationError, match="missing required columns"):
        read_manifest(built.manifest_path)


def test_manifest_referencing_missing_member_fails(build_archive: Callable[..., Any]) -> None:
    built = build_archive()
    rows = _read_rows(built.manifest_path)
    rows[0]["repository_filename"] = "missing.html"
    _write_rows(built.manifest_path, rows)

    with pytest.raises(ArchiveVerificationError, match="missing from archive"):
        verify_archive(built.config)


def test_decode_archive_rejects_invalid_data() -> None:
    with pytest.raises(ArchiveVerificationError, match="base64 decode failed"):
        decode_archive("%%%")


def _read_rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def _write_rows(path: Path, rows: list[dict[str, str]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
