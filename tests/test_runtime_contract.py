from __future__ import annotations

from pathlib import Path

import pytest

from archive_verifier.runtime_contract import (
    DEFAULT_APP_PATH,
    EXPECTED_TITLE,
    REQUIRED_EXTERNAL_SCRIPTS,
    RuntimeContractError,
    inspect_runtime_contract,
    verify_runtime_contract,
)


def _write_html(path: Path, *, title: str = EXPECTED_TITLE, scripts: tuple[str, ...] = ()) -> Path:
    script_tags = "".join(f'<script src="{source}"></script>' for source in scripts)
    path.write_text(
        f"<!doctype html><html><head><title>{title}</title>{script_tags}</head><body></body></html>",
        encoding="utf-8",
    )
    return path


def test_authenticated_v115_satisfies_core_runtime_contract() -> None:
    report = verify_runtime_contract(DEFAULT_APP_PATH)

    assert report.core_ready is True
    assert set(REQUIRED_EXTERNAL_SCRIPTS).issubset(report.external_scripts)
    assert "R.O.A.R.Y LOGO.png" in report.local_asset_refs


def test_runtime_contract_rejects_missing_required_script(tmp_path: Path) -> None:
    scripts = tuple(sorted(REQUIRED_EXTERNAL_SCRIPTS))[1:]
    path = _write_html(tmp_path / "index.html", scripts=scripts)

    with pytest.raises(RuntimeContractError, match="missing runtime scripts"):
        verify_runtime_contract(path)


def test_runtime_contract_rejects_title_drift(tmp_path: Path) -> None:
    path = _write_html(
        tmp_path / "index.html",
        title="Drifted Studio",
        scripts=tuple(REQUIRED_EXTERNAL_SCRIPTS),
    )

    with pytest.raises(RuntimeContractError, match="title drift"):
        verify_runtime_contract(path)


def test_runtime_report_tracks_missing_local_assets_without_failing_core_shell(tmp_path: Path) -> None:
    scripts = tuple(REQUIRED_EXTERNAL_SCRIPTS)
    path = _write_html(tmp_path / "index.html", scripts=scripts)
    path.write_text(
        path.read_text(encoding="utf-8").replace(
            "</head>", '<link rel="icon" href="missing-icon.png"></head>'
        ),
        encoding="utf-8",
    )

    report = inspect_runtime_contract(path)

    assert report.core_ready is True
    assert report.local_asset_refs == ("missing-icon.png",)
    assert report.missing_local_assets == ("missing-icon.png",)
