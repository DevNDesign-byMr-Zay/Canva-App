from __future__ import annotations

import json
import sys
from dataclasses import asdict, dataclass
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

DEFAULT_APP_PATH = Path("app/authenticated-v115/index.html")
EXPECTED_TITLE = "R.O.A.R.Y Studio"
REQUIRED_EXTERNAL_SCRIPTS = frozenset(
    {
        "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.min.js",
        "https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js",
        "https://cdn.jsdelivr.net/npm/marked/marked.min.js",
        "https://cdn.jsdelivr.net/npm/dompurify@3.1.5/dist/purify.min.js",
        "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js",
    }
)


class RuntimeContractError(ValueError):
    """Raised when the authenticated application no longer satisfies its runtime shell contract."""


@dataclass(frozen=True, slots=True)
class RuntimeContractReport:
    title: str
    external_scripts: tuple[str, ...]
    local_asset_refs: tuple[str, ...]
    missing_local_assets: tuple[str, ...]

    @property
    def core_ready(self) -> bool:
        return self.title == EXPECTED_TITLE and REQUIRED_EXTERNAL_SCRIPTS.issubset(
            self.external_scripts
        )


class _RuntimeShellParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._in_title = False
        self._title_parts: list[str] = []
        self.script_sources: list[str] = []
        self.asset_refs: list[str] = []

    @staticmethod
    def _attrs(attrs: list[tuple[str, str | None]]) -> dict[str, str]:
        return {key: value for key, value in attrs if value is not None}

    @staticmethod
    def _is_local_reference(value: str) -> bool:
        lowered = value.lower()
        return not (
            lowered.startswith(("http://", "https://", "data:", "javascript:", "mailto:"))
            or value.startswith("#")
        )

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = self._attrs(attrs)
        if tag == "title":
            self._in_title = True
            return

        if tag == "script":
            source = values.get("src")
            if source:
                self.script_sources.append(source)
                if self._is_local_reference(source):
                    self.asset_refs.append(source)
            return

        if tag == "link":
            href = values.get("href")
            if href and self._is_local_reference(href):
                self.asset_refs.append(href)

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self._title_parts.append(data)

    @property
    def title(self) -> str:
        return "".join(self._title_parts).strip()


def _local_path(root: Path, reference: str) -> Path:
    parsed = urlsplit(reference)
    relative = unquote(parsed.path).lstrip("/")
    return root / relative


def inspect_runtime_contract(
    path: Path = DEFAULT_APP_PATH,
    *,
    asset_root: Path | None = None,
) -> RuntimeContractReport:
    try:
        html = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise RuntimeContractError(f"unable to read authenticated application: {path}") from exc

    parser = _RuntimeShellParser()
    parser.feed(html)
    parser.close()

    root = path.parent if asset_root is None else asset_root
    local_refs = tuple(sorted(set(parser.asset_refs)))
    missing = tuple(sorted(ref for ref in local_refs if not _local_path(root, ref).is_file()))
    external_scripts = tuple(
        sorted(
            {
                source
                for source in parser.script_sources
                if source.startswith(("http://", "https://"))
            }
        )
    )
    return RuntimeContractReport(
        title=parser.title,
        external_scripts=external_scripts,
        local_asset_refs=local_refs,
        missing_local_assets=missing,
    )


def verify_runtime_contract(path: Path = DEFAULT_APP_PATH) -> RuntimeContractReport:
    report = inspect_runtime_contract(path)
    if report.title != EXPECTED_TITLE:
        raise RuntimeContractError(
            f"authenticated app title drift: expected {EXPECTED_TITLE!r}, got {report.title!r}"
        )

    missing_scripts = sorted(REQUIRED_EXTERNAL_SCRIPTS - set(report.external_scripts))
    if missing_scripts:
        raise RuntimeContractError(
            f"authenticated app is missing runtime scripts: {missing_scripts}"
        )

    return report


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if len(args) > 1:
        raise SystemExit("usage: python -m archive_verifier.runtime_contract [index.html]")
    path = Path(args[0]) if args else DEFAULT_APP_PATH
    report = verify_runtime_contract(path)
    print(json.dumps(asdict(report), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
