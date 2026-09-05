from __future__ import annotations

import hashlib
import io
import tarfile
from dataclasses import dataclass
from pathlib import Path

from archive_verifier.config import ROOT, VerificationConfig
from archive_verifier.errors import ArchiveVerificationError
from archive_verifier.service import (
    decode_archive,
    discover_payload_parts,
    read_manifest,
    read_payload_text,
)

TARGET_OCCURRENCE = 44
TARGET_SOURCE_FILENAME_SHA256 = "fcdebfd5ddfa4cef626062e1429d414009ec334bf41e2889817fbf6d5055f810"
TARGET_BASENAME = "aetherv246_v115_depthpop_modeldrawer_FINALFIX.html"
TARGET_SHA256 = "d60ef499cf42c68e06c06cc8906831874aa351ac7d3f9c08cfa5aa4d0ca7e7d1"
OUTPUT_PATH = ROOT / "app" / "authenticated-v115" / "index.html"
PROVENANCE_PATH = ROOT / "app" / "authenticated-v115" / "PROVENANCE.md"


@dataclass(frozen=True, slots=True)
class AuthenticatedV115Identity:
    """Canonical manifest identity for the authenticated v115 application artifact."""

    occurrence: int
    source_filename_sha256: str
    repository_filename: str
    sanitized_sha256: str

    def canonical_text(self) -> str:
        return "\n".join(
            (
                f"occurrence={self.occurrence}",
                f"source_filename_sha256={self.source_filename_sha256}",
                f"repository_filename={self.repository_filename}",
                f"sanitized_sha256={self.sanitized_sha256}",
            )
        )

    def fingerprint(self) -> str:
        return hashlib.sha256(self.canonical_text().encode("utf-8")).hexdigest()


AUTHENTICATED_V115 = AuthenticatedV115Identity(
    occurrence=TARGET_OCCURRENCE,
    source_filename_sha256=TARGET_SOURCE_FILENAME_SHA256,
    repository_filename=TARGET_BASENAME,
    sanitized_sha256=TARGET_SHA256,
)


def validate_target_manifest(config: VerificationConfig) -> None:
    rows = read_manifest(config.manifest_path)
    matches = [row for row in rows if row["occurrence"] == str(AUTHENTICATED_V115.occurrence)]
    if len(matches) != 1:
        raise ArchiveVerificationError(
            f"expected one manifest row for occurrence {AUTHENTICATED_V115.occurrence}, found {len(matches)}"
        )

    target = matches[0]
    if target["source_filename_sha256"] != AUTHENTICATED_V115.source_filename_sha256:
        raise ArchiveVerificationError(
            f"manifest occurrence {AUTHENTICATED_V115.occurrence} source-name hash does not match authenticated v115"
        )
    if target["repository_filename"] != AUTHENTICATED_V115.repository_filename:
        raise ArchiveVerificationError(
            f"manifest occurrence {AUTHENTICATED_V115.occurrence} filename does not match authenticated v115"
        )
    if target["sanitized_sha256"] != AUTHENTICATED_V115.sanitized_sha256:
        raise ArchiveVerificationError(
            f"manifest occurrence {AUTHENTICATED_V115.occurrence} SHA does not match authenticated v115"
        )


def extract_authenticated_v115(config: VerificationConfig | None = None) -> bytes:
    resolved = config or VerificationConfig.production()
    validate_target_manifest(resolved)
    payload = read_payload_text(discover_payload_parts(resolved))
    archive = decode_archive(payload)
    try:
        handle = tarfile.open(fileobj=io.BytesIO(archive), mode="r:xz")
    except (tarfile.ReadError, EOFError, OSError) as exc:
        raise ArchiveVerificationError("unable to open authenticated archive") from exc

    with handle:
        matches = [
            member
            for member in handle.getmembers()
            if member.isfile() and Path(member.name).name == AUTHENTICATED_V115.repository_filename
        ]
        if len(matches) != 1:
            raise ArchiveVerificationError(
                f"expected one authenticated v115 member, found {len(matches)}"
            )
        extracted = handle.extractfile(matches[0])
        if extracted is None:
            raise ArchiveVerificationError("unable to read authenticated v115 member")
        data = extracted.read()

    digest = hashlib.sha256(data).hexdigest()
    if digest != AUTHENTICATED_V115.sanitized_sha256:
        raise ArchiveVerificationError(
            f"v115 SHA mismatch: expected {AUTHENTICATED_V115.sanitized_sha256}, got {digest}"
        )
    return data


def materialize(output_path: Path = OUTPUT_PATH) -> Path:
    data = extract_authenticated_v115()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(data)
    return output_path


def provenance_text() -> str:
    return (
        "# Authenticated v115 application\n\n"
        "This file is deterministically materialized from the repository's authenticated "
        "84-occurrence `.tar.xz` archive. The historical archive remains immutable.\n\n"
        f"- Source member: `{AUTHENTICATED_V115.repository_filename}`\n"
        f"- Source filename SHA-256: `{AUTHENTICATED_V115.source_filename_sha256}`\n"
        f"- Sanitized SHA-256: `{AUTHENTICATED_V115.sanitized_sha256}`\n"
        f"- Manifest occurrence: `{AUTHENTICATED_V115.occurrence}`\n"
        f"- Identity fingerprint: `{AUTHENTICATED_V115.fingerprint()}`\n"
        "- Generated path: `app/authenticated-v115/index.html`\n\n"
        "Run `python scripts/materialize_v115.py` to reconstruct the application source.\n"
    )


def write_provenance(path: Path = PROVENANCE_PATH) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(provenance_text(), encoding="utf-8")
    return path


def main() -> int:
    output = materialize()
    write_provenance()
    print(f"materialized {output.relative_to(ROOT)}")
    return 0
