from __future__ import annotations

import re

from archive_verifier.models import ScanResult


def scan_text(
    *,
    name: str,
    text: str,
    banned_literals: tuple[str, ...],
    credential_patterns: tuple[re.Pattern[str], ...],
) -> ScanResult:
    low = text.lower()
    identity_hits = tuple(f"{name}:{literal}" for literal in banned_literals if literal in low)
    credential_hits = tuple(
        f"{name}:{pattern.pattern}" for pattern in credential_patterns if pattern.search(text)
    )
    return ScanResult(identity_hits=identity_hits, credential_hits=credential_hits)
