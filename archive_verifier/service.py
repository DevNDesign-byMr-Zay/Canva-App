from __future__ import annotations

import base64
import binascii
import csv
import hashlib
import io
import tarfile
from pathlib import Path

from archive_verifier.config import VerificationConfig
from archive_verifier.errors import ArchiveVerificationError
from archive_verifier.models import VerificationReport
from archive_verifier.scanner import scan_text

_REQUIRED_MANIFEST_COLUMNS = {
    "occurrence",
    "source_filename_sha256",
    "repository_filename",
    "sanitized_sha256",
}
_HEX_DIGITS = frozenset("0123456789abcdef")
_ALLOWED_ARCHIVE_METADATA_FILES = frozenset({"manifest.json"})


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise ArchiveVerificationError(message)


def _validate_manifest_row(row: dict[str, str], row_number: int) -> None:
    for column in _REQUIRED_MANIFEST_COLUMNS:
        value = row.get(column)
        _require(
            value is not None,
            f"manifest row {row_number} {column} must not be empty",
        )

    occurrence_text = row["occurrence"].strip()
    try:
        occurrence = int(occurrence_text)
    except ValueError as exc:
        raise ArchiveVerificationError(
            f"manifest row {row_number} occurrence must be a positive integer"
        ) from exc
    _require(
        occurrence > 0 and str(occurrence) == occurrence_text,
        f"manifest row {row_number} occurrence must be a positive integer",
    )

    repository_filename = row["repository_filename"].strip()
    _require(
        bool(repository_filename),
        f"manifest row {row_number} repository_filename must not be empty",
    )
    _require(
        Path(repository_filename).name == repository_filename,
        f"manifest row {row_number} repository_filename must be a basename",
    )

    for column in ("source_filename_sha256", "sanitized_sha256"):
        digest = row[column].strip().lower()
        _require(
            len(digest) == 64 and set(digest).issubset(_HEX_DIGITS),
            f"manifest row {row_number} {column} must be a SHA-256 hex digest",
        )


def _validate_occurrence_sequence(rows: list[dict[str, str]]) -> None:
    occurrences = [int(row["occurrence"]) for row in rows]
    _require(
        len(set(occurrences)) == len(occurrences),
        "manifest occurrence values must be unique",
    )
    _require(
        occurrences == list(range(1, len(rows) + 1)),
        "manifest occurrence values must be sequential starting at 1",
    )


def _validate_repository_filename_uniqueness(rows: list[dict[str, str]]) -> None:
    filenames = [row["repository_filename"].strip() for row in rows]
    _require(
        len(set(filenames)) == len(filenames),
        "manifest repository_filename values must be unique",
    )


def discover_payload_parts(config: VerificationConfig) -> list[Path]:
    parts = sorted(config.payload_dir.glob("part-*.b64"))
    _require(
        len(parts) == config.expected_payload_parts,
        f"expected {config.expected_payload_parts} payload parts, found {len(parts)}",
    )
    return parts


def read_payload_text(parts: list[Path]) -> str:
    try:
        return "".join(part.read_text(encoding="utf-8").strip() for part in parts)
    except OSError as exc:
        error_type = exc.__class__.__name__
        raise ArchiveVerificationError(f"unable to read payload part: {error_type}") from exc


def decode_archive(payload_text: str) -> bytes:
    try:
        return base64.b64decode(payload_text, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ArchiveVerificationError("base64 decode failed") from exc


def read_manifest(path: Path) -> list[dict[str, str]]:
    try:
        with path.open(newline="", encoding="utf-8") as handle:
            reader = csv.DictReader(handle)
            columns = set(reader.fieldnames or ())
            _require(
                _REQUIRED_MANIFEST_COLUMNS.issubset(columns),
                "manifest is missing required columns",
            )
            rows = list(reader)
            for row_number, row in enumerate(rows, start=2):
                _validate_manifest_row(row, row_number)
            return rows
    except OSError as exc:
        error_type = exc.__class__.__name__
        raise ArchiveVerificationError(f"unable to read manifest: {error_type}") from exc
    except csv.Error as exc:
        raise ArchiveVerificationError("manifest CSV parse failed") from exc


def verify_archive(config: VerificationConfig) -> VerificationReport:
    parts = discover_payload_parts(config)
    payload_text = read_payload_text(parts)
    _require(
        len(payload_text) == config.expected_b64_chars,
        f"expected {config.expected_b64_chars} base64 chars, got {len(payload_text)}",
    )

    archive = decode_archive(payload_text)
    archive_sha256 = hashlib.sha256(archive).hexdigest()
    _require(
        len(archive) == config.expected_archive_bytes,
        f"archive byte count {len(archive)} != {config.expected_archive_bytes}",
    )
    _require(
        archive_sha256 == config.expected_archive_sha256,
        f"archive SHA mismatch; expected {config.expected_archive_sha256}",
    )

    rows = read_manifest(config.manifest_path)
    _require(
        len(rows) == config.expected_occurrences,
        f"manifest occurrence count {len(rows)} != {config.expected_occurrences}",
    )
    _validate_occurrence_sequence(rows)
    _validate_repository_filename_uniqueness(rows)

    unique_sources = {row["source_filename_sha256"] for row in rows}
    _require(
        len(unique_sources) == config.expected_unique_source_names,
        "unique source-name hash count does not match expected value",
    )

    try:
        archive_handle = tarfile.open(fileobj=io.BytesIO(archive), mode="r:xz")
    except (tarfile.ReadError, EOFError, OSError) as exc:
        raise ArchiveVerificationError("xz/tar open failed") from exc

    with archive_handle as tar_handle:
        file_members = [member for member in tar_handle.getmembers() if member.isfile()]
        unexpected_files = [
            member.name
            for member in file_members
            if not member.name.lower().endswith(".html")
            and member.name not in _ALLOWED_ARCHIVE_METADATA_FILES
        ]
        _require(
            not unexpected_files,
            "archive contains unmanifested regular files: " + ", ".join(unexpected_files),
        )

        html_members = [
            member for member in file_members if member.name.lower().endswith(".html")
        ]
        _require(
            len(html_members) == config.expected_occurrences,
            f"HTML occurrence count {len(html_members)} != {config.expected_occurrences}",
        )

        by_basename = {Path(member.name).name: member for member in html_members}
        _require(
            len(by_basename) == config.expected_occurrences,
            "archive HTML basenames are not unique",
        )

        actual_hashes: dict[str, str] = {}
        mismatches: list[tuple[str, str, str]] = []
        identity_hits: list[str] = []
        credential_hits: list[str] = []

        for row in rows:
            name = row["repository_filename"]
            member = by_basename.get(name)
            if member is None:
                raise ArchiveVerificationError(f"manifest file missing from archive: {name}")
            extracted = tar_handle.extractfile(member)
            if extracted is None:
                raise ArchiveVerificationError(f"unable to read archive member: {name}")
            data = extracted.read()
            digest = hashlib.sha256(data).hexdigest()
            actual_hashes[name] = digest
            if digest != row["sanitized_sha256"]:
                mismatches.append((name, row["sanitized_sha256"], digest))

            result = scan_text(
                name=name,
                text=data.decode("utf-8", errors="ignore"),
                banned_literals=config.banned_literals,
                credential_patterns=config.credential_patterns,
            )
            identity_hits.extend(result.identity_hits)
            credential_hits.extend(result.credential_hits)

    distinct_states = len(set(actual_hashes.values()))
    duplicate_occurrences = len(actual_hashes) - distinct_states
    _require(
        distinct_states == config.expected_distinct_states,
        f"distinct states {distinct_states} != {config.expected_distinct_states}",
    )
    _require(
        duplicate_occurrences == config.expected_duplicate_occurrences,
        "duplicate occurrence count does not match expected value",
    )
    _require(not identity_hits, "identity/branding scan hits: " + ", ".join(identity_hits))
    _require(not credential_hits, "credential scan hits: " + ", ".join(credential_hits))
    _require(not mismatches, f"manifest has {len(mismatches)} sanitized SHA mismatch(es)")

    return VerificationReport(
        payload_parts=len(parts),
        base64_chars=len(payload_text),
        archive_bytes=len(archive),
        archive_sha256=archive_sha256,
        manifest_occurrences=len(rows),
        unique_source_names=len(unique_sources),
        html_occurrences=len(html_members),
        distinct_states=distinct_states,
        duplicate_occurrences=duplicate_occurrences,
        manifest_hash_mismatches=len(mismatches),
        identity_hits=tuple(identity_hits),
        credential_hits=tuple(credential_hits),
    )
