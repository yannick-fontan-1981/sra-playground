#!/usr/bin/env python3
"""Lossless transport of large v52 JSON evidence; no game or validation is run.

--pack creates a fresh manifest and deterministic gzip files without changing
the originals. With no mode, restore missing originals atomically per file and retain
identical existing originals. --verify checks compressed and decompressed
hashes, including when originals are absent. --roundtrip creates a separate
storage proof using an initially empty temporary root. --root is a repository
root, not the evidence directory. All byte streams are processed in 1 MiB chunks.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
import tempfile


EVIDENCE = "docs/migration/native-campaigns-v52"
MANIFEST = EVIDENCE + "/evidence-storage.json"
PROOF = EVIDENCE + "/evidence-storage-verification.json"
SCRIPT = "scripts/restore-v52-evidence.py"
SCHEMA = "logos-engine.v52.evidence-storage.v1"
PROOF_SCHEMA = "logos-engine.v52.evidence-storage-verification.v1"
THRESHOLD = 1024 * 1024
CHUNK = 1024 * 1024
COMPRESSION = {"format": "gzip", "level": 9, "mtime": 0, "filename": ""}


class StorageError(Exception):
    pass


def require(condition: bool, message: str) -> None:
    if not condition:
        raise StorageError(message)


def relative_path(root: Path, name: str, *, create_parent: bool = False) -> Path:
    require(isinstance(name, str), "Invalid relative path type")
    parsed = PurePosixPath(name)
    require(not parsed.is_absolute() and parsed.as_posix() == name
            and all(part not in ("", ".", "..") for part in parsed.parts)
            and "\\" not in name, "Invalid relative path: " + name)
    path = root.joinpath(*parsed.parts)
    for parent in [path, *path.parents]:
        if parent == root:
            break
        require(not parent.is_symlink(), "Refusing symlink: " + str(parent))
    if create_parent:
        path.parent.mkdir(parents=True, exist_ok=True)
    return path


def fingerprint(path: Path) -> dict:
    require(path.is_file() and not path.is_symlink(), "Missing regular file: " + str(path))
    digest, size = hashlib.sha256(), 0
    with path.open("rb") as stream:
        while data := stream.read(CHUNK):
            digest.update(data)
            size += len(data)
    return {"sha256": digest.hexdigest(), "bytes": size}


def file_record(root: Path, path: Path) -> dict:
    return {"path": path.relative_to(root).as_posix(), **fingerprint(path)}


def encode(value: dict) -> bytes:
    return (json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n").encode("utf-8")


def checked_fingerprint(root: Path, record: dict) -> dict:
    actual = fingerprint(relative_path(root, record["path"]))
    require(actual == {"sha256": record["sha256"], "bytes": record["bytes"]},
            "File fingerprint differs: " + record["path"])
    return actual


def temporary_file(destination: Path) -> tuple[int, Path]:
    descriptor, name = tempfile.mkstemp(prefix="." + destination.name + ".storage-", dir=destination.parent)
    return descriptor, Path(name)


def install_absent(temporary: Path, destination: Path) -> None:
    """A hard-link publication is atomic and fails if any destination exists."""
    try:
        os.link(temporary, destination, follow_symlinks=False)
    except FileExistsError as exc:
        raise StorageError("Refusing to overwrite existing path: " + str(destination)) from exc
    temporary.unlink()


def write_absent(root: Path, name: str, data: bytes) -> None:
    destination = relative_path(root, name, create_parent=True)
    require(not destination.exists(), "Refusing to overwrite existing path: " + name)
    descriptor, temporary = temporary_file(destination)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        install_absent(temporary, destination)
    finally:
        temporary.unlink(missing_ok=True)


def evidence_inventory(root: Path) -> list[dict]:
    folder = relative_path(root, EVIDENCE)
    require(folder.is_dir(), "Missing evidence directory: " + str(folder))
    rows = []
    for path in sorted(folder.rglob("*"), key=lambda item: item.relative_to(root).as_posix()):
        require(not path.is_symlink(), "Refusing symlink in evidence: " + str(path))
        if path.is_file():
            rows.append(file_record(root, path))
    return rows


def validate_record(record: dict) -> None:
    require(isinstance(record, dict) and set(record) == {"path", "sha256", "bytes"}, "Invalid file record")
    require(isinstance(record["path"], str) and record["path"].startswith(EVIDENCE + "/"), "File outside v52 evidence")
    require(isinstance(record["sha256"], str) and re.fullmatch("[0-9a-f]{64}", record["sha256"]) is not None,
            "Invalid SHA-256")
    require(type(record["bytes"]) is int and record["bytes"] >= 0, "Invalid file size")


def load_manifest(root: Path) -> dict:
    with relative_path(root, MANIFEST).open("rb") as stream:
        value = json.load(stream)
    require(isinstance(value, dict), "Storage manifest must be a JSON object")
    require(value.get("schema") == SCHEMA and value.get("evidenceDirectory") == EVIDENCE,
            "Unsupported storage manifest")
    require(value.get("selection") == {"suffix": ".json", "strictlyLargerThanBytes": THRESHOLD}
            and value.get("compression") == COMPRESSION, "Storage contract changed")
    rows = value.get("files")
    require(isinstance(rows, list) and rows, "Empty or invalid file manifest")
    paths = []
    for row in rows:
        require(isinstance(row, dict) and set(row) == {"original", "gzip"}, "Invalid stored file entry")
        for record in row.values():
            validate_record(record)
            relative_path(root, record["path"])
        original, compressed = row["original"], row["gzip"]
        require(original["path"].endswith(".json") and original["bytes"] > THRESHOLD,
                "Original does not match the size selection")
        require(compressed["path"] == original["path"] + ".gz", "Gzip path differs from original path")
        paths.append(original["path"])
    require(paths == sorted(set(paths)), "Original paths must be sorted and unique")
    require(value.get("totals") == {"files": len(rows), "originalBytes": sum(row["original"]["bytes"] for row in rows),
            "gzipBytes": sum(row["gzip"]["bytes"] for row in rows)}, "Manifest totals disagree")
    previous = value.get("preservedEvidenceFiles")
    require(isinstance(previous, list), "Missing preexisting evidence inventory")
    prior_paths = []
    for record in previous:
        validate_record(record)
        relative_path(root, record["path"])
        prior_paths.append(record["path"])
    require(prior_paths == sorted(set(prior_paths)), "Preexisting paths must be sorted and unique")
    selected = [record for record in previous if record["path"].endswith(".json") and record["bytes"] > THRESHOLD]
    require(selected == [row["original"] for row in rows], "Manifest selection does not equal the original inventory")
    return value


def decode_gzip(root: Path, row: dict, output=None) -> dict:
    compressed, expected = row["gzip"], row["original"]
    checked_fingerprint(root, compressed)
    path = relative_path(root, compressed["path"])
    with path.open("rb") as stream:
        header = stream.read(10)
    require(len(header) == 10 and header[:4] == b"\x1f\x8b\x08\x00" and header[4:8] == b"\x00" * 4,
            "Gzip is not the declared filename-free mtime-zero encoding: " + compressed["path"])
    digest, size = hashlib.sha256(), 0
    with gzip.open(path, "rb") as stream:
        while data := stream.read(CHUNK):
            size += len(data)
            require(size <= expected["bytes"], "Decoded content exceeds declared size: " + expected["path"])
            digest.update(data)
            if output is not None:
                output.write(data)
    actual = {"sha256": digest.hexdigest(), "bytes": size}
    require(actual == {"sha256": expected["sha256"], "bytes": expected["bytes"]},
            "Decoded content fingerprint differs: " + expected["path"])
    return actual


def existing_originals(root: Path, manifest: dict) -> set[str]:
    present = set()
    for row in manifest["files"]:
        record = row["original"]
        path = relative_path(root, record["path"])
        if path.exists():
            require(fingerprint(path) == {"sha256": record["sha256"], "bytes": record["bytes"]},
                    "Refusing divergent existing original: " + record["path"])
            present.add(record["path"])
    return present


def verify(root: Path, manifest: dict) -> dict:
    present = existing_originals(root, manifest)
    for row in manifest["files"]:
        decode_gzip(root, row)
    return {"status": "passed", "mode": "verify", "files": len(manifest["files"]),
            "presentOriginals": len(present), "absentOriginals": len(manifest["files"]) - len(present),
            "compressedAndDecodedFingerprintsVerified": True, "originalsWritten": 0}


def restore(root: Path, manifest: dict) -> dict:
    present, staged = existing_originals(root, manifest), []
    try:
        # Stage and verify every missing original before publishing any of them.
        for row in manifest["files"]:
            destination = relative_path(root, row["original"]["path"], create_parent=True)
            if row["original"]["path"] in present:
                decode_gzip(root, row)
                continue
            descriptor, temporary = temporary_file(destination)
            staged.append((temporary, destination))
            with os.fdopen(descriptor, "wb") as output:
                decode_gzip(root, row, output)
                output.flush()
                os.fsync(output.fileno())
        for temporary, destination in staged:
            install_absent(temporary, destination)
        return {"status": "passed", "mode": "restore", "files": len(manifest["files"]),
                "restoredOriginals": len(staged), "retainedIdenticalOriginals": len(present),
                "compressedAndDecodedFingerprintsVerified": True, "overwrittenOriginals": 0,
                "atomicPublication": "per_file_no_overwrite"}
    finally:
        for temporary, _ in staged:
            temporary.unlink(missing_ok=True)


def pack(root: Path) -> dict:
    require(not relative_path(root, MANIFEST).exists(), "Manifest already exists; --pack requires a fresh package")
    require(not relative_path(root, PROOF).exists(), "Storage proof already exists; --pack requires a fresh package")
    previous = evidence_inventory(root)
    selected = [row for row in previous if row["path"].endswith(".json") and row["bytes"] > THRESHOLD]
    require(selected, "No JSON exceeds the declared threshold")
    for record in selected:
        require(not relative_path(root, record["path"] + ".gz").exists(),
                "Refusing existing gzip destination: " + record["path"] + ".gz")
    rows, staged, published = [], [], []
    try:
        for record in selected:
            source = relative_path(root, record["path"])
            destination = relative_path(root, record["path"] + ".gz")
            descriptor, temporary = temporary_file(destination)
            staged.append((temporary, destination))
            digest, size = hashlib.sha256(), 0
            with source.open("rb") as input_stream, os.fdopen(descriptor, "wb") as raw:
                with gzip.GzipFile(filename="", mode="wb", compresslevel=9, fileobj=raw, mtime=0) as output:
                    while data := input_stream.read(CHUNK):
                        digest.update(data)
                        size += len(data)
                        output.write(data)
                raw.flush()
                os.fsync(raw.fileno())
            require({"sha256": digest.hexdigest(), "bytes": size} == {"sha256": record["sha256"], "bytes": record["bytes"]},
                    "Original changed during compression: " + record["path"])
            rows.append({"original": record, "gzip": {"path": destination.relative_to(root).as_posix(), **fingerprint(temporary)}})
        for record in previous:
            checked_fingerprint(root, record)
        value = {"schema": SCHEMA, "evidenceDirectory": EVIDENCE,
                 "selection": {"suffix": ".json", "strictlyLargerThanBytes": THRESHOLD}, "compression": COMPRESSION,
                 "files": rows, "totals": {"files": len(rows), "originalBytes": sum(row["original"]["bytes"] for row in rows),
                 "gzipBytes": sum(row["gzip"]["bytes"] for row in rows)}, "preservedEvidenceFiles": previous,
                 "generator": {"path": SCRIPT, **fingerprint(Path(__file__).resolve())},
                 "qualification": "Storage only. Original evidence bytes, paths, success and failure claims remain unchanged. Restore before using historical validators; no game, native agent or test suite is run."}
        for temporary, destination in staged:
            install_absent(temporary, destination)
            published.append(destination)
        write_absent(root, MANIFEST, encode(value))
        return {"status": "passed", "mode": "pack", **value["totals"], "preexistingEvidenceFilesUnchanged": len(previous),
                "originalsChangedOrRemoved": 0, "manifest": MANIFEST}
    except Exception:
        # Only outputs created by this invocation are eligible for rollback.
        if not relative_path(root, MANIFEST).exists():
            for path in published:
                path.unlink(missing_ok=True)
        raise
    finally:
        for temporary, _ in staged:
            temporary.unlink(missing_ok=True)


def invoke(script: Path, root: Path, *arguments: str, expect_success: bool = True) -> dict:
    result = subprocess.run([sys.executable, str(script), "--root", str(root), *arguments],
                            capture_output=True, text=True)
    require((result.returncode == 0) == expect_success, "Unexpected storage command result: " + result.stdout + result.stderr)
    return {"arguments": ["--root", "<temporary-root>", *arguments], "exitCode": result.returncode,
            "result": json.loads(result.stdout) if result.returncode == 0 else None,
            "error": result.stderr.strip() if result.returncode else None}


def same_bytes(first: Path, second: Path) -> bool:
    with first.open("rb") as left, second.open("rb") as right:
        while True:
            a, b = left.read(CHUNK), right.read(CHUNK)
            if a != b:
                return False
            if not a:
                return True


def roundtrip(root: Path, manifest: dict) -> dict:
    require(not relative_path(root, PROOF).exists(), "Storage verification proof exists; refusing overwrite")
    require(len(existing_originals(root, manifest)) == len(manifest["files"]), "Roundtrip proof requires every original")
    for record in manifest["preservedEvidenceFiles"]:
        checked_fingerprint(root, record)
    original_verification = verify(root, manifest)
    script, records = Path(__file__).resolve(), []
    manifest_bytes = relative_path(root, MANIFEST).read_bytes()
    require(fingerprint(script) == {"sha256": manifest["generator"]["sha256"], "bytes": manifest["generator"]["bytes"]},
            "Generator changed after packing")
    with tempfile.TemporaryDirectory(prefix="sra-v52-storage-roundtrip-") as name:
        temporary_root = Path(name)
        require(not list(temporary_root.iterdir()), "Roundtrip root did not start empty")
        for relative in [MANIFEST, *[row["gzip"]["path"] for row in manifest["files"]]]:
            destination = relative_path(temporary_root, relative, create_parent=True)
            shutil.copyfile(relative_path(root, relative), destination)
        packed_only = invoke(script, temporary_root, "--verify")
        require(packed_only["result"]["presentOriginals"] == 0, "An original was copied into the roundtrip root")
        # Keep the compressed SHA correct while falsifying the decoded SHA.
        altered = json.loads(manifest_bytes)
        altered["files"][0]["original"]["sha256"] = "0" * 64
        target_name = altered["files"][0]["original"]["path"]
        next(row for row in altered["preservedEvidenceFiles"] if row["path"] == target_name)["sha256"] = "0" * 64
        relative_path(temporary_root, MANIFEST).write_bytes(encode(altered))
        bad_decoded_hash = invoke(script, temporary_root, "--verify", expect_success=False)
        require("Decoded content fingerprint differs" in bad_decoded_hash["error"], "Decoded fingerprint check was not exercised")
        relative_path(temporary_root, MANIFEST).write_bytes(manifest_bytes)
        restored = invoke(script, temporary_root)
        require(restored["result"]["restoredOriginals"] == len(manifest["files"]), "Roundtrip did not restore every original")
        restored_verification = invoke(script, temporary_root, "--verify")
        stamps = {}
        for row in manifest["files"]:
            record = row["original"]
            source, destination = relative_path(root, record["path"]), relative_path(temporary_root, record["path"])
            equal = same_bytes(source, destination)
            require(equal, "Restored bytes differ: " + record["path"])
            stat = destination.stat()
            stamps[record["path"]] = (stat.st_ino, stat.st_mtime_ns, stat.st_size)
            records.append({**record, "restored": fingerprint(destination), "byteForByteEqual": equal})
        repeated = invoke(script, temporary_root)
        require(repeated["result"]["restoredOriginals"] == 0, "Identical original was restored again")
        for relative, stamp in stamps.items():
            stat = relative_path(temporary_root, relative).stat()
            require((stat.st_ino, stat.st_mtime_ns, stat.st_size) == stamp, "Identical original was rewritten")
        fresh_pack_refusal = invoke(script, temporary_root, "--pack", expect_success=False)
        require("Manifest already exists" in fresh_pack_refusal["error"], "Fresh-pack refusal was not exercised")
        conflict = relative_path(temporary_root, manifest["files"][0]["original"]["path"])
        conflict.write_bytes(b"Deliberate conflict in the disposable roundtrip root.\n")
        conflict_before = fingerprint(conflict)
        conflict_refusal = invoke(script, temporary_root, expect_success=False)
        require("Refusing divergent existing original" in conflict_refusal["error"]
                and fingerprint(conflict) == conflict_before, "Conflicting original was not preserved")
    for record in manifest["preservedEvidenceFiles"]:
        checked_fingerprint(root, record)
    require(relative_path(root, MANIFEST).read_bytes() == manifest_bytes, "Manifest changed during roundtrip")
    proof = {"schema": PROOF_SCHEMA, "status": "passed", "manifest": file_record(root, relative_path(root, MANIFEST)),
             "generator": {"path": SCRIPT, **fingerprint(script)}, "totals": manifest["totals"],
             "streamingChunkBytes": CHUNK, "originalVerification": original_verification,
             "roundtrip": {"rootInitiallyEmpty": True, "copiedOriginals": 0, "copiedGzipFiles": len(manifest["files"]),
             "packedOnlyVerification": packed_only, "restoration": restored, "restoredVerification": restored_verification,
             "identicalOriginalsRetainedWithoutRewrite": repeated, "files": records, "temporaryRootRemoved": True},
             "negativeCases": {"decodedHashMismatchRejected": bad_decoded_hash, "freshPackOverwriteRejected": fresh_pack_refusal,
             "divergentOriginalRejectedAndPreserved": conflict_refusal},
             "preexistingEvidenceFiles": manifest["preservedEvidenceFiles"],
             "allPreexistingEvidenceFilesUnchanged": True, "originalsChangedOrRemoved": 0,
             "validationReceipt": file_record(root, relative_path(root, EVIDENCE + "/attempt9/validation.json")),
             "gameRuns": 0, "nativeAgentRuns": 0, "testSuiteRuns": 0,
             "qualification": "Byte transport only: all original evidence is unchanged, including failures and the prior release validation. Every stored JSON was restored from gzip in an initially empty temporary root and compared byte for byte. The deliberate conflict and manifest mutations occurred only inside that disposable root."}
    write_absent(root, PROOF, encode(proof))
    return {"status": "passed", "mode": "roundtrip", **manifest["totals"],
            "restoredByteIdenticalFiles": len(records), "preexistingEvidenceFilesUnchanged": len(manifest["preservedEvidenceFiles"]),
            "negativeCasesPassed": len(proof["negativeCases"]), "proof": PROOF}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1], help="repository root (may be an empty temporary directory)")
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--pack", action="store_true", help="create fresh gzip files and manifest; retain all originals")
    modes.add_argument("--verify", action="store_true", help="read-only compressed/decoded verification; missing originals are reported")
    modes.add_argument("--roundtrip", action="store_true", help="write a fresh proof after a complete isolated restore and refusal checks")
    args = parser.parse_args()
    root = args.root.resolve()
    require(root.is_dir(), "Root must be an existing directory")
    if args.pack:
        result = pack(root)
    else:
        manifest = load_manifest(root)
        result = roundtrip(root, manifest) if args.roundtrip else verify(root, manifest) if args.verify else restore(root, manifest)
    print(json.dumps(result, ensure_ascii=False, allow_nan=False), flush=True)


if __name__ == "__main__":
    try:
        main()
    except (StorageError, OSError, ValueError, KeyError, TypeError) as exc:
        print("evidence storage: " + str(exc), file=sys.stderr, flush=True)
        raise SystemExit(1)
