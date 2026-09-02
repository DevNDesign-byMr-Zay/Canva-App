from __future__ import annotations

from archive_verifier.config import VerificationConfig
from archive_verifier.errors import ArchiveVerificationError
from archive_verifier.logging_config import get_logger
from archive_verifier.service import verify_archive

LOGGER = get_logger("canva_archive_verifier")


def main() -> int:
    try:
        report = verify_archive(VerificationConfig.production())
    except (ArchiveVerificationError, ValueError) as exc:
        LOGGER.error(
            "archive verification failed",
            extra={"event": "archive_verification_failed", "reason": str(exc)},
        )
        return 1

    LOGGER.info(
        "archive verification passed",
        extra={"event": "archive_verification_passed", "report": report.to_dict()},
    )
    return 0
