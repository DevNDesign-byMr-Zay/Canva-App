from __future__ import annotations

import re
import tomllib
from pathlib import Path

from packaging.requirements import Requirement
from packaging.utils import canonicalize_name
from packaging.version import Version

ROOT = Path(__file__).resolve().parents[1]
PYPROJECT = ROOT / "pyproject.toml"
LOCKFILE = ROOT / "requirements.lock.txt"
LOCK_PATTERN = re.compile(r"^([A-Za-z0-9_.-]+)==([^\s#]+)$")


def declared_requirements() -> list[Requirement]:
    data = tomllib.loads(PYPROJECT.read_text(encoding="utf-8"))
    project = data.get("project", {})
    raw = list(project.get("dependencies", []))
    for group in project.get("optional-dependencies", {}).values():
        raw.extend(group)
    return [Requirement(item) for item in raw]


def locked_versions() -> dict[str, Version]:
    locked: dict[str, Version] = {}
    for line_number, raw_line in enumerate(
        LOCKFILE.read_text(encoding="utf-8").splitlines(),
        start=1,
    ):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        match = LOCK_PATTERN.fullmatch(line)
        if not match:
            raise SystemExit(
                f"{LOCKFILE.name}:{line_number}: expected exact name==version pin: {line}"
            )
        name, version_text = match.groups()
        canonical = canonicalize_name(name)
        if canonical in locked:
            raise SystemExit(f"{LOCKFILE.name}: duplicate locked distribution: {canonical}")
        locked[canonical] = Version(version_text)
    return locked


def main() -> None:
    declared = declared_requirements()
    locked = locked_versions()
    missing: list[str] = []
    incompatible: list[str] = []

    for requirement in declared:
        name = canonicalize_name(requirement.name)
        version = locked.get(name)
        if version is None:
            missing.append(requirement.name)
        elif requirement.specifier and version not in requirement.specifier:
            incompatible.append(f"{requirement} -> {version}")

    if missing or incompatible:
        parts = []
        if missing:
            parts.append("missing exact pins: " + ", ".join(sorted(missing)))
        if incompatible:
            parts.append("pins outside declared ranges: " + "; ".join(sorted(incompatible)))
        raise SystemExit("Python toolchain parity failed: " + " | ".join(parts))

    print(
        f"Python toolchain parity verified for {len(declared)} declared requirements "
        f"against {len(locked)} exact locked distributions."
    )


if __name__ == "__main__":
    main()
