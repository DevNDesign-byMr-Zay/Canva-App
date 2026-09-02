from __future__ import annotations

import base64
import csv
import hashlib
import io
import tarfile
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import pytest

from archive_verifier.config import VerificationConfig


@dataclass(frozen=True, slots=True)
class BuiltArchive:
    config: VerificationConfig
    payload_dir: Path
    manifest_path: Path


@pytest.fixture
def build_archive(tmp_path: Path) -> Callable[..., BuiltArchive]:
    def _build(
        files: dict[str, bytes] | None = None,
        *,
        payload_parts: int = 2,
    ) -> BuiltArchive:
        source_files = files or {
            "state-a.html": b"<html><body>alpha</body></html>",
            "state-b.html": b"<html><body>beta</body></html>",
        }
        payload_dir = tmp_path / "payload"
        payload_dir.mkdir(parents=True, exist_ok=True)
        manifest_path = tmp_path / "manifest.csv"

        buffer = io.BytesIO()
        with tarfile.open(fileobj=buffer, mode="w:xz") as archive:
            for name, data in source_files.items():
                info = tarfile.TarInfo(name=name)
                info.size = len(data)
                archive.addfile(info, io.BytesIO(data))
        archive_bytes = buffer.getvalue()
        encoded = base64.b64encode(archive_bytes).decode("ascii")

        chunk_size = (len(encoded) + payload_parts - 1) // payload_parts
        chunks = [encoded[index : index + chunk_size] for index in range(0, len(encoded), chunk_size)]
        for index, chunk in enumerate(chunks, start=1):
            (payload_dir / f"part-{index:03d}.b64").write_text(chunk, encoding="utf-8")

        with manifest_path.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(
                handle,
                fieldnames=(
                    "occurrence",
                    "source_filename_sha256",
                    "repository_filename",
                    "sanitized_sha256",
                ),
            )
            writer.writeheader()
            for occurrence, (name, data) in enumerate(source_files.items(), start=1):
                writer.writerow(
                    {
                        "occurrence": occurrence,
                        "source_filename_sha256": hashlib.sha256(
                            f"source:{name}".encode("utf-8")
                        ).hexdigest(),
                        "repository_filename": name,
                        "sanitized_sha256": hashlib.sha256(data).hexdigest(),
                    }
                )

        distinct_states = len({hashlib.sha256(data).hexdigest() for data in source_files.values()})
        occurrences = len(source_files)
        config = VerificationConfig(
            payload_dir=payload_dir,
            manifest_path=manifest_path,
            expected_payload_parts=len(chunks),
            expected_b64_chars=len(encoded),
            expected_archive_bytes=len(archive_bytes),
            expected_archive_sha256=hashlib.sha256(archive_bytes).hexdigest(),
            expected_occurrences=occurrences,
            expected_unique_source_names=occurrences,
            expected_distinct_states=distinct_states,
            expected_duplicate_occurrences=occurrences - distinct_states,
        )
        return BuiltArchive(config=config, payload_dir=payload_dir, manifest_path=manifest_path)

    return _build
