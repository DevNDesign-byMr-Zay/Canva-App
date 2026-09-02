from __future__ import annotations

import re

from archive_verifier.scanner import scan_text


def test_scan_text_returns_no_hits_for_safe_content() -> None:
    result = scan_text(
        name="safe.html",
        text="<html>neutral content</html>",
        banned_literals=("private-brand",),
        credential_patterns=(re.compile(r"secret-[A-Z]{4}"),),
    )

    assert result.identity_hits == ()
    assert result.credential_hits == ()


def test_scan_text_detects_banned_literal_case_insensitively() -> None:
    result = scan_text(
        name="identity.html",
        text="PRIVATE-BRAND reference",
        banned_literals=("private-brand",),
        credential_patterns=(),
    )

    assert result.identity_hits == ("identity.html:private-brand",)


def test_scan_text_detects_credential_pattern() -> None:
    result = scan_text(
        name="credential.html",
        text="secret-ABCD",
        banned_literals=(),
        credential_patterns=(re.compile(r"secret-[A-Z]{4}"),),
    )

    assert result.credential_hits == ("credential.html:secret-[A-Z]{4}",)
