from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any


@dataclass(frozen=True, slots=True)
class ScanResult:
    identity_hits: tuple[str, ...]
    credential_hits: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class VerificationReport:
    payload_parts: int
    base64_chars: int
    archive_bytes: int
    archive_sha256: str
    manifest_occurrences: int
    unique_source_names: int
    html_occurrences: int
    distinct_states: int
    duplicate_occurrences: int
    manifest_hash_mismatches: int
    identity_hits: tuple[str, ...]
    credential_hits: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
