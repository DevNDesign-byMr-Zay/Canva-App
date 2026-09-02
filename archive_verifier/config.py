from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

BANNED_LITERALS = (
    "roary",
    "mr. zay",
    "mr zay",
    "devnddesign-bymr-zay",
)

CREDENTIAL_PATTERNS = (
    re.compile(r"sk-[A-Za-z0-9_-]{20,}"),
    re.compile(r"AIza[0-9A-Za-z_-]{20,}"),
    re.compile(r"hf_[A-Za-z0-9]{20,}"),
    re.compile(r"github_pat_[A-Za-z0-9_]{20,}"),
    re.compile(r"gh[pousr]_[A-Za-z0-9]{20,}"),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
)


@dataclass(frozen=True, slots=True)
class VerificationConfig:
    payload_dir: Path
    manifest_path: Path
    expected_payload_parts: int
    expected_b64_chars: int
    expected_archive_bytes: int
    expected_archive_sha256: str
    expected_occurrences: int
    expected_unique_source_names: int
    expected_distinct_states: int
    expected_duplicate_occurrences: int
    banned_literals: tuple[str, ...] = BANNED_LITERALS
    credential_patterns: tuple[re.Pattern[str], ...] = CREDENTIAL_PATTERNS

    def __post_init__(self) -> None:
        positive_fields = {
            "expected_payload_parts": self.expected_payload_parts,
            "expected_b64_chars": self.expected_b64_chars,
            "expected_archive_bytes": self.expected_archive_bytes,
            "expected_occurrences": self.expected_occurrences,
            "expected_unique_source_names": self.expected_unique_source_names,
            "expected_distinct_states": self.expected_distinct_states,
        }
        for name, value in positive_fields.items():
            if value <= 0:
                raise ValueError(f"{name} must be greater than zero")
        if self.expected_duplicate_occurrences < 0:
            raise ValueError("expected_duplicate_occurrences must be non-negative")
        if len(self.expected_archive_sha256) != 64:
            raise ValueError("expected_archive_sha256 must be a 64-character SHA-256 digest")
        if self.expected_distinct_states + self.expected_duplicate_occurrences != self.expected_occurrences:
            raise ValueError("distinct states plus duplicate occurrences must equal expected occurrences")

    @classmethod
    def production(cls) -> "VerificationConfig":
        return cls(
            payload_dir=ROOT / "legacy-html" / "archive" / "payload",
            manifest_path=ROOT / "provenance" / "DRIVE_84_MANIFEST.csv",
            expected_payload_parts=45,
            expected_b64_chars=460656,
            expected_archive_bytes=345492,
            expected_archive_sha256="7d22f60d202201c282c19925d397f274d90bd0796da00fd6ebca5f72dd074ae5",
            expected_occurrences=84,
            expected_unique_source_names=82,
            expected_distinct_states=68,
            expected_duplicate_occurrences=16,
        )
