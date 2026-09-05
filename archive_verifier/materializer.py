from __future__ import annotations

import hashlib
import io
import tarfile
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
TARGET_BASENAME = "aetherv246_v115_depthpop_modeldrawer_FINALFIX.html"
TARGET_SHA256 = "d60ef499cf42c68e06c06cc8906831874aa351ac7d3f9c08cfa5aa4d0ca7e7d1"
OUTPUT_PATH = ROOT / "app" / "authenticated-v115" / "index.html"
PROVENANCE_PATH = ROOT / "app" / "authenticated-v115" / "PROVENANCE.md"


def validate_target_manifest(config: VerificationConfig) -> None:
    rows = read_manifest(config.manifest_path)
    matches = [row for row in rows if row["occurrence"] == str(TARGET_OCCURRENCE)]
    if len(matches) != 1:
        raise ArchiveVerificationError(
            f"expected one manifest row for occurrence {TARGET_OCCURRENCE}, found {len(matches)}"
        )

    target = matches[0]
    if target["repository_filename"] != TARGET_BASENAME:
        raise ArchiveVerificationError(
            f"manifest occurrence {TARGET_OCCURRENCE} filename does not match authenticated v115"
        )
    if target["sanitized_sha256"] != TARGET_SHA256:
        raise ArchiveVerificationError(
            f"manifest occurrence {TARGET_OCCURRENCE} SHA does not match authenticated v115"
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
            if member.isfile() and Path(member.name).name == TARGET_BASENAME
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
    if digest != TARGET_SHA256:
        raise ArchiveVerificationError(
            f"v115 SHA mismatch: expected {TARGET_SHA256}, got {digest}"
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
        f"- Source member: `{TARGET_BASENAME}`\n"
        f"- Sanitized SHA-256: `{TARGET_SHA256}`\n"
        f"- Manifest occurrence: `{TARGET_OCCURRENCE}`\n"
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
