from __future__ import annotations

from dataclasses import replace
from typing import Any, Callable

import pytest


def test_config_rejects_non_positive_counts(build_archive: Callable[..., Any]) -> None:
    built = build_archive()

    with pytest.raises(ValueError, match="expected_payload_parts"):
        replace(built.config, expected_payload_parts=0)


def test_config_rejects_invalid_sha_length(build_archive: Callable[..., Any]) -> None:
    built = build_archive()

    with pytest.raises(ValueError, match="64-character"):
        replace(built.config, expected_archive_sha256="abc")


def test_config_rejects_inconsistent_state_accounting(build_archive: Callable[..., Any]) -> None:
    built = build_archive()

    with pytest.raises(ValueError, match="distinct states plus duplicate occurrences"):
        replace(built.config, expected_duplicate_occurrences=1)
