#!/usr/bin/env python3
from __future__ import annotations

import base64
import csv
import hashlib
import io
import re
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAYLOAD = ROOT / "legacy-html" / "archive" / "payload"
MANIFEST = ROOT / "provenance" / "DRIVE_84_MANIFEST.csv"
EXPECTED_PAYLOAD_PARTS = 45
EXPECTED_B64_CHARS = 460656
EXPECTED_ARCHIVE_BYTES = 345492
EXPECTED_ARCHIVE_SHA256 = "7d22f60d202201c282c19925d397f274d90bd0796da00fd6ebca5f72dd074ae5"
EXPECTED_OCCURRENCES = 84
EXPECTED_UNIQUE_SOURCE_NAMES = 82
EXPECTED_DISTINCT_STATES = 68
EXPECTED_DUPLICATE_OCCURRENCES = 16

BANNED_LITERALS = (
    "roary",
    "mr. zay",
    "mr zay",
    "devnddesign-bymr-zay",
)
CREDENTIAL_PATTERNS = (
    re.compile(r"sk-[A-Za-z0-9_-]{20,}"),
    re.compile(r"AIza[0-9A-Za-z_-]{20,}"),
    re.compile(r"hf_[A-Za-z0-9]{20,}"),
    re.compile(r"github_pat_[A-Za-z0-9_]{20,}"),
    re.compile(r"gh[pousr]_[A-Za-z0-9]{20,}"),
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
)


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    raise SystemExit(1)


def main() -> None:
    parts = sorted(PAYLOAD.glob("part-*.b64"))
    if len(parts) != EXPECTED_PAYLOAD_PARTS:
        fail(f"expected {EXPECTED_PAYLOAD_PARTS} payload parts, found {len(parts)}")

    b64_text = "".join(p.read_text(encoding="utf-8").strip() for p in parts)
    print(f"payload_parts={len(parts)}")
    print(f"base64_chars={len(b64_text)}")
    if len(b64_text) != EXPECTED_B64_CHARS:
        fail(f"expected {EXPECTED_B64_CHARS} base64 chars, got {len(b64_text)}")

    try:
        archive = base64.b64decode(b64_text, validate=True)
    except Exception as exc:
        fail(f"base64 decode failed: {exc}")

    archive_sha = hashlib.sha256(archive).hexdigest()
    print(f"archive_bytes={len(archive)}")
    print(f"archive_sha256={archive_sha}")
    if len(archive) != EXPECTED_ARCHIVE_BYTES:
        fail(f"archive byte count {len(archive)} != {EXPECTED_ARCHIVE_BYTES}")
    if archive_sha != EXPECTED_ARCHIVE_SHA256:
        fail(f"archive SHA mismatch; expected {EXPECTED_ARCHIVE_SHA256}")

    with MANIFEST.open(newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    print(f"manifest_occurrences={len(rows)}")
    if len(rows) != EXPECTED_OCCURRENCES:
        fail(f"manifest occurrence count {len(rows)} != {EXPECTED_OCCURRENCES}")

    unique_sources = {row["source_filename_sha256"] for row in rows}
    print(f"unique_source_names={len(unique_sources)}")
    if len(unique_sources) != EXPECTED_UNIQUE_SOURCE_NAMES:
        fail(f"unique source-name hashes {len(unique_sources)} != {EXPECTED_UNIQUE_SOURCE_NAMES}")

    try:
        tf = tarfile.open(fileobj=io.BytesIO(archive), mode="r:xz")
    except Exception as exc:
        fail(f"xz/tar open failed: {exc}")

    html_members = [m for m in tf.getmembers() if m.isfile() and m.name.lower().endswith(".html")]
    print(f"html_occurrences={len(html_members)}")
    if len(html_members) != EXPECTED_OCCURRENCES:
        fail(f"HTML occurrence count {len(html_members)} != {EXPECTED_OCCURRENCES}")

    by_basename = {Path(m.name).name: m for m in html_members}
    if len(by_basename) != EXPECTED_OCCURRENCES:
        fail("archive HTML basenames are not unique")

    actual_hashes: dict[str, str] = {}
    mismatches: list[tuple[str, str, str]] = []
    identity_hits: list[str] = []
    credential_hits: list[str] = []

    for row in rows:
        name = row["repository_filename"]
        member = by_basename.get(name)
        if member is None:
            fail(f"manifest file missing from archive: {name}")
        extracted = tf.extractfile(member)
        if extracted is None:
            fail(f"unable to read archive member: {name}")
        data = extracted.read()
        digest = hashlib.sha256(data).hexdigest()
        actual_hashes[name] = digest
        if digest != row["sanitized_sha256"]:
            mismatches.append((name, row["sanitized_sha256"], digest))

        text = data.decode("utf-8", errors="ignore")
        low = text.lower()
        for literal in BANNED_LITERALS:
            if literal in low:
                identity_hits.append(f"{name}:{literal}")
        for pattern in CREDENTIAL_PATTERNS:
            if pattern.search(text):
                credential_hits.append(f"{name}:{pattern.pattern}")

    distinct_states = len(set(actual_hashes.values()))
    duplicate_occurrences = len(actual_hashes) - distinct_states
    print(f"distinct_states={distinct_states}")
    print(f"duplicate_occurrences={duplicate_occurrences}")
    print(f"manifest_hash_mismatches={len(mismatches)}")

    if distinct_states != EXPECTED_DISTINCT_STATES:
        fail(f"distinct states {distinct_states} != {EXPECTED_DISTINCT_STATES}")
    if duplicate_occurrences != EXPECTED_DUPLICATE_OCCURRENCES:
        fail(f"duplicate occurrences {duplicate_occurrences} != {EXPECTED_DUPLICATE_OCCURRENCES}")
    if identity_hits:
        fail("identity/branding scan hits: " + ", ".join(identity_hits))
    if credential_hits:
        fail("credential scan hits: " + ", ".join(credential_hits))
    if mismatches:
        for name, expected, actual in mismatches:
            print(f"MISMATCH {name} expected={expected} actual={actual}")
        fail(f"manifest has {len(mismatches)} sanitized SHA mismatch(es)")

    print("PASS: legacy archive is reconstructable, deidentified, and represents 84/84 occurrences with missing=0")


if __name__ == "__main__":
    main()
