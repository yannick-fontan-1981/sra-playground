#!/usr/bin/env python3
"""Verify a Sites application tar against the pinned lot-7 build inventory.

The archive is never extracted. The only output is a new receipt outside the
checkout. Run after packaging and outside an exclusive performance window.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys
import tarfile

PINNED_INVENTORY_SHA256 = "b82afd24480b9203e8406ffb81ce737ed5080d53056e24a3317dfd352b885d71"
PINNED_WORKER_SHA256 = "531a5a14739622b50a92b10ffd8daa4dbec9b6a3a3e1314c5dd34949765ac6f1"
DEFAULT_INVENTORY = "docs/migration/lot7b-evidence/followup-recovery/coordination/validated-build-and-object-inventory.json"
CHUNK = 1024 * 1024


def require(condition, message):
    if not condition:
        raise ValueError(message)


def identity(info):
    return (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns)


def fingerprint(path):
    """Hash a regular file and reject replacement or mutation during reading."""
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(descriptor, "rb") as stream:
        before = os.fstat(stream.fileno())
        require(stat.S_ISREG(before.st_mode), f"Not a regular file: {path}")
        digest, size = hashlib.sha256(), 0
        for chunk in iter(lambda: stream.read(CHUNK), b""):
            digest.update(chunk)
            size += len(chunk)
        require(identity(before) == identity(os.fstat(stream.fileno())), f"File changed while read: {path}")
    require(identity(before) == identity(path.lstat()), f"File replaced while read: {path}")
    return {"sha256": digest.hexdigest(), "bytes": size}


def safe_name(name, directory=False):
    require(isinstance(name, str) and name and "\\" not in name and "\x00" not in name,
            f"Invalid member path: {name!r}")
    candidate = name[:-1] if directory and name.endswith("/") else name
    require(not candidate.startswith("/") and all(part not in ("", ".", "..") for part in candidate.split("/")),
            f"Noncanonical or traversing member path: {name!r}")
    require(not any(ord(char) < 32 for char in candidate), f"Control character in member path: {name!r}")
    return candidate


def file_pin(row, name):
    require(isinstance(row, dict) and isinstance(row.get("bytes"), int) and not isinstance(row["bytes"], bool)
            and row["bytes"] >= 0 and re.fullmatch(r"[0-9a-f]{64}", str(row.get("sha256", ""))),
            f"Malformed inventory fingerprint: {name}")
    return {"sha256": row["sha256"], "bytes": row["bytes"]}


def current_files(checkout, expected_dist):
    """Reject links/special files and compare the exact current dist file set."""
    dist = checkout / "dist"
    require(stat.S_ISDIR(dist.lstat().st_mode), "dist must be a real directory")
    files, directories = {}, {"dist"}
    for parent, subdirs, names in os.walk(dist, followlinks=False):
        subdirs.sort()
        names.sort()
        for name in subdirs:
            path = Path(parent) / name
            require(stat.S_ISDIR(path.lstat().st_mode), f"Link or special directory: {path}")
            directories.add(path.relative_to(checkout).as_posix())
        for name in names:
            path = Path(parent) / name
            require(stat.S_ISREG(path.lstat().st_mode), f"Link or special file: {path}")
            files[path.relative_to(checkout).as_posix()] = path
    require(set(files) == set(expected_dist),
            "Current dist paths differ from inventory: " + json.dumps({
                "missing": sorted(set(expected_dist) - set(files)), "extra": sorted(set(files) - set(expected_dist))}))
    require(stat.S_ISDIR((checkout / ".openai").lstat().st_mode), ".openai must be a real directory")
    observed = {name: fingerprint(path) for name, path in sorted(files.items())}
    observed["dist/.openai/hosting.json"] = fingerprint(checkout / ".openai/hosting.json")
    directories.add("dist/.openai")
    return observed, directories


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkout", required=True, type=Path)
    parser.add_argument("--inventory", type=Path, help="Default: the pinned coordination inventory inside checkout")
    parser.add_argument("--archive", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path, help="New JSON receipt outside checkout; never overwritten")
    parser.add_argument("--performance-lock", type=Path, default=Path("/workspace/shared/sra-coordination/performance.lock"))
    args = parser.parse_args()
    checkout = args.checkout.resolve(strict=True)
    output = args.output.resolve(strict=False)
    inventory = args.inventory.resolve(strict=True) if args.inventory else checkout / DEFAULT_INVENTORY
    archive = args.archive.absolute()
    require(checkout.is_dir(), "Checkout is not a directory")
    require(not output.is_relative_to(checkout), "Receipt must be outside checkout")
    require(not output.exists() and not output.is_symlink(), "Receipt already exists; choose a new output path")
    require(output not in (archive.resolve(strict=False), inventory.resolve(strict=True), Path(__file__).resolve()),
            "Receipt collides with an input or the verifier")
    require(not archive.resolve(strict=True).is_relative_to(checkout), "Application archive must be outside checkout")
    started = datetime.now(timezone.utc).isoformat()
    receipt = {
        "schema": "logos-engine.followup-application-tar-verification.v1", "startedAt": started, "status": "failed",
        "checkout": str(checkout), "inventoryPath": str(inventory), "archivePath": str(archive),
        "expectedInventorySha256": PINNED_INVENTORY_SHA256,
        "expectedRegularMemberCount": 75, "expectedRegularMemberBytes": 29929130,
        "qualification": "Read-only byte verification. No extraction, build, packaging, test, game, replay, benchmark, Git write, push or publication.",
        "onlyWrittenArtifact": str(output),
    }
    exit_code = 1
    try:
        # Do not wait behind ABBA: an exclusive owner makes this invocation fail
        # before any payload is hashed. The lock file must already exist.
        with args.performance_lock.open("rb") as lock:
            fcntl.flock(lock, fcntl.LOCK_SH | fcntl.LOCK_NB)
            receipt["performanceLock"] = {"path": str(args.performance_lock), "mode": "shared_nonblocking", "acquired": True}
            inventory_before = fingerprint(inventory)
            receipt["inventory"] = inventory_before
            receipt["inventorySha256"] = inventory_before["sha256"]
            require(inventory_before["sha256"] == PINNED_INVENTORY_SHA256, "Inventory differs from the independently pinned receipt")
            data = json.loads(inventory.read_text())
            require(data["status"] == "passed", "Inventory did not pass")
            publish = data["publishFiles"]
            expected_dist = {}
            for name, row in publish["distFiles"].items():
                require(safe_name(name) == name and name.startswith("dist/"), f"Invalid dist inventory path: {name}")
                expected_dist[name] = file_pin(row, name)
            require(len(expected_dist) == publish["distRegularFileCount"] == 74, "Inventory must pin exactly 74 dist files")
            require(publish["hosting"]["path"] == ".openai/hosting.json", "Unexpected source hosting path")
            require("dist/.openai/hosting.json" not in expected_dist, "Hosting path collides with a dist member")
            expected = dict(expected_dist)
            expected["dist/.openai/hosting.json"] = file_pin(publish["hosting"], ".openai/hosting.json")
            require(len(expected) == publish["totalRegularFileCount"] == 75, "Inventory must pin exactly 75 application files")
            require(sum(row["bytes"] for row in expected.values()) == publish["totalBytes"] == 29929130, "Inventory byte count differs")
            worker = data["nativeAgentWorker"]["expected"]
            require(worker["sha256"] == PINNED_WORKER_SHA256 and expected.get(worker["path"]) == file_pin(worker, worker["path"]),
                    "Native worker does not match the pinned build")

            current_before, allowed_directories = current_files(checkout, expected_dist)
            require(current_before == expected, "Current dist or source hosting bytes differ from the pinned build")
            archive_before = fingerprint(archive)
            receipt["archive"] = archive_before
            receipt["archiveSha256"] = archive_before["sha256"]
            members, directory_members, seen_paths, total_members = {}, [], set(), 0
            with tarfile.open(archive, mode="r:gz") as bundle:
                for member in bundle:
                    total_members += 1
                    name = safe_name(member.name, directory=member.isdir())
                    require(name == "dist" or name.startswith("dist/"), f"Member lies outside dist: {name}")
                    require(name not in seen_paths, f"Duplicate member path: {name}")
                    seen_paths.add(name)
                    require(not member.linkname, f"Link target is forbidden: {name}")
                    require(member.sparse is None and not any(key.startswith("GNU.sparse") for key in member.pax_headers),
                            f"Sparse member is forbidden: {name}")
                    if member.isdir():
                        require(member.size == 0 and name in allowed_directories, f"Unexpected directory member: {name}")
                        directory_members.append(name)
                        continue
                    require(member.type in (tarfile.REGTYPE, tarfile.AREGTYPE), f"Link or special member is forbidden: {name}")
                    require(name in expected, f"Unexpected regular member: {name}")
                    require(member.size == expected[name]["bytes"], f"Member byte count differs: {name}")
                    stream = bundle.extractfile(member)
                    require(stream is not None, f"Unreadable member: {name}")
                    digest, size = hashlib.sha256(), 0
                    with stream:
                        for chunk in iter(lambda: stream.read(CHUNK), b""):
                            size += len(chunk)
                            require(size <= expected[name]["bytes"], f"Oversized member stream: {name}")
                            digest.update(chunk)
                    members[name] = {"sha256": digest.hexdigest(), "bytes": size}
                    require(members[name] == expected[name], f"Member content differs: {name}")
                # Inspect everything after the last declared member. A second
                # tar hidden behind the end markers must not evade the exact
                # member-set comparison. GNU tar's final record padding is at
                # most 10 KiB and contains at least two zero header blocks.
                end_offset = bundle.offset
                bundle.fileobj.seek(end_offset)
                padding = bundle.fileobj.read(10241)
                require(1024 <= len(padding) <= 10240 and not any(padding), "Invalid or nonzero trailing tar data")
                require((end_offset + len(padding)) % 512 == 0, "Tar padding is not block aligned")
                require(bundle.fileobj.read(1) == b"", "Data follows the final tar padding")
            require(set(members) == set(expected), "Missing regular members: " + json.dumps(sorted(set(expected) - set(members))))
            current_after, directories_after = current_files(checkout, expected_dist)
            require(current_after == current_before and directories_after == allowed_directories, "Current build changed during verification")
            require(fingerprint(archive) == archive_before, "Archive changed during verification")
            require(fingerprint(inventory) == inventory_before, "Inventory changed during verification")
            receipt.update({
                "status": "passed", "regularMemberCount": len(members), "totalMemberCount": total_members,
                "regularMemberBytes": sum(row["bytes"] for row in members.values()),
                "exactRegularPathSet": True, "allMemberBytesAndSha256MatchInventory": True,
                "allCurrentDistAndHostingBytesMatchInventory": True, "inputsUnchangedDuringVerification": True,
                "forbiddenMembers": [], "missingFiles": [], "extraFiles": [],
                "hostingMapping": {"source": ".openai/hosting.json", "archive": "dist/.openai/hosting.json", "byteExact": True},
                "nativeWorker": worker, "regularMembers": dict(sorted(members.items())),
                "directoryMembers": sorted(directory_members),
                "tarEndPaddingBytes": len(padding), "expandedTarBytes": end_offset + len(padding),
                "verifier": {"path": str(Path(__file__).resolve()), **fingerprint(Path(__file__).resolve())},
                "packageFormat": "Sites 1.1.6 packages a dist-rooted tar.gz and stages source hosting at dist/.openai/hosting.json. The source manifest already uses the normalized dist directory; no hosting-byte exemption is applied.",
            })
            exit_code = 0
    except Exception as error:
        receipt["failure"] = {"type": type(error).__name__, "message": str(error)}
    receipt["finishedAt"] = datetime.now(timezone.utc).isoformat()
    output.parent.mkdir(parents=True, exist_ok=True)
    require(not output.parent.resolve().is_relative_to(checkout), "Receipt parent resolved inside checkout")
    descriptor = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, "w") as stream:
        json.dump(receipt, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
    print(json.dumps({"status": receipt["status"], "receipt": str(output),
                      "regularMemberCount": receipt.get("regularMemberCount"),
                      "inventorySha256": receipt.get("inventorySha256"), "archiveSha256": receipt.get("archiveSha256"),
                      "failure": receipt.get("failure")}, ensure_ascii=False))
    return exit_code


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError) as error:
        print(f"Verifier could not start or write its receipt: {error}", file=sys.stderr)
        raise SystemExit(2)
