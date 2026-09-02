from __future__ import annotations

import runpy
from pathlib import Path
from typing import Any

import pytest

from archive_verifier import cli, materializer

ROOT = Path(__file__).resolve().parents[1]


def test_package_module_entrypoint_propagates_exit_code(monkeypatch: Any) -> None:
    monkeypatch.setattr(cli, "main", lambda: 7)

    with pytest.raises(SystemExit) as exc_info:
        runpy.run_module("archive_verifier", run_name="__main__")

    assert exc_info.value.code == 7


def test_compatibility_script_entrypoint_propagates_exit_code(monkeypatch: Any) -> None:
    monkeypatch.setattr(cli, "main", lambda: 9)

    with pytest.raises(SystemExit) as exc_info:
        runpy.run_path(str(ROOT / "scripts" / "verify_legacy_archive.py"), run_name="__main__")

    assert exc_info.value.code == 9


def test_materializer_script_entrypoint_propagates_exit_code(monkeypatch: Any) -> None:
    monkeypatch.setattr(materializer, "main", lambda: 11)

    with pytest.raises(SystemExit) as exc_info:
        runpy.run_path(str(ROOT / "scripts" / "materialize_v115.py"), run_name="__main__")

    assert exc_info.value.code == 11
