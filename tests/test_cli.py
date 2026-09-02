from __future__ import annotations

import logging
from typing import Any

from archive_verifier import cli
from archive_verifier.errors import ArchiveVerificationError
from archive_verifier.models import VerificationReport


def _report() -> VerificationReport:
    return VerificationReport(
        payload_parts=2,
        base64_chars=100,
        archive_bytes=75,
        archive_sha256="a" * 64,
        manifest_occurrences=2,
        unique_source_names=2,
        html_occurrences=2,
        distinct_states=2,
        duplicate_occurrences=0,
        manifest_hash_mismatches=0,
        identity_hits=(),
        credential_hits=(),
    )


def test_cli_returns_zero_and_logs_success(monkeypatch: Any, caplog: Any) -> None:
    monkeypatch.setattr(cli, "verify_archive", lambda _config: _report())
    caplog.set_level(logging.INFO, logger="canva_archive_verifier")

    assert cli.main() == 0


def test_cli_returns_one_when_verification_fails(monkeypatch: Any) -> None:
    def fail(_config: object) -> VerificationReport:
        raise ArchiveVerificationError("fixture failed")

    monkeypatch.setattr(cli, "verify_archive", fail)

    assert cli.main() == 1
