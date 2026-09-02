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


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise ArchiveVerificationError(message)


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
        raise ArchiveVerificationError(f"unable to read payload part: {exc.__class__.__name__}") from exc


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
            return list(reader)
    except OSError as exc:
        raise ArchiveVerificationError(f"unable to read manifest: {exc.__class__.__name__}") from exc
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
        html_members = [
            member
            for member in tar_handle.getmembers()
            if member.isfile() and member.name.lower().endswith(".html")
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
            _require(member is not None, f"manifest file missing from archive: {name}")
            extracted = tar_handle.extractfile(member)
            _require(extracted is not None, f"unable to read archive member: {name}")
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
