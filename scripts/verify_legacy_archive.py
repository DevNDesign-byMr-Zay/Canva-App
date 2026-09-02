#!/usr/bin/env python3
from __future__ import annotations

import importlib
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def main() -> int:
    cli = importlib.import_module("archive_verifier.cli")
    return cli.main()


if __name__ == "__main__":
    raise SystemExit(main())
