#!/usr/bin/env python3
"""Reproduce the public-pixel projection oracle from pinned original functions.

No game engine or solver is imported. AST extraction selects complete, unmodified
function definitions from the three copied source files. The reference executes
the original components(), perceive(), canonical(), digest() and grounding
functions with their stdlib dependencies. It validates only public projection,
not archive loading, full Python application startup or action authorization.

Usage: python scripts/export-public-observer-reference.py [--check]
"""
from __future__ import annotations

import argparse
import ast
from collections.abc import Mapping
import hashlib
import json
import math
from pathlib import Path
import time


ROOT = Path(__file__).resolve().parents[1]
COMMIT = "786dcf51ca57773d8e3a8948ce9ea3655e7baf8e"
REFERENCE = ROOT / "reference" / "v7" / COMMIT / "public-observer"
FIXTURE = ROOT / "tests" / "fixtures" / "public-observer-python.json"
SOURCES = {
    "geometric_observer.py": {
        "repository_path": "agents/yf_arc3_v6/laya_proto/geometric_observer.py",
        "git_blob_sha1": "d5f7e263f7602be4bc7988e3a49b4078081936b2",
        "functions": ["components"],
    },
    "kernel.py": {
        "repository_path": "agents/yf_arc3_v7/kernel.py",
        "git_blob_sha1": "649c0bc26872b8b80ef9936632b87fcd58d7652d",
        "functions": ["json_default", "canonical", "digest", "empty_argument_bindings"],
    },
    "public_observer.py": {
        "repository_path": "agents/yf_arc3_v7/public_observer.py",
        "git_blob_sha1": "108e511217685eafacde921fece809f88540a35e",
        "functions": ["perceive"],
    },
}


def reference_namespace():
    namespace = {"math": math, "hashlib": hashlib, "json": json, "time": time, "Mapping": Mapping}
    manifest = {}
    for filename, spec in SOURCES.items():
        path = REFERENCE / filename
        data = path.read_bytes()
        blob = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
        if blob != spec["git_blob_sha1"]:
            raise ValueError("Original source changed: " + filename)
        tree = ast.parse(data.decode("utf-8"), filename=str(path))
        definitions = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in spec["functions"]]
        if {node.name for node in definitions} != set(spec["functions"]):
            raise ValueError("Missing original function in " + filename)
        selected = ast.Module(body=definitions, type_ignores=[])
        exec(compile(selected, str(path), "exec"), namespace)
        manifest[filename] = {**spec, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)}
    return namespace, manifest


def make_fixture():
    namespace, manifest = reference_namespace()
    interface = json.loads((REFERENCE.parent / "knowledge.drm.json").read_text(encoding="utf-8"))["public_interface"]
    cases = [
        ("background-is-observed", [[0]], [1, 5, 6, 7], "NOT_FINISHED", 0),
        ("diagonals-are-separate", [[1, 0], [0, 1]], [3, 4], "NOT_FINISHED", 0),
        ("ring-is-not-rectangular", [[1, 1, 1], [1, 0, 1], [1, 1, 1]], [1, 2, 3, 4, 5, 6, 7], "NOT_FINISHED", 0),
        ("rectangular-stripes", [[0, 0, 1, 1, 2, 2], [0, 0, 1, 1, 2, 2]], [5, 2, 1], "NOT_FINISHED", 1),
        ("irregular-islands", [[0, 0, 0, 0, 0, 0, 0], [0, 1, 0, 2, 2, 0, 3], [0, 1, 1, 2, 0, 0, 3], [0, 0, 0, 2, 2, 0, 0]], [0, 1, 6, 7], "NOT_FINISHED", 0),
        ("equal-counts-vertical", [[1, 0], [1, 0]], [1, 2], "NOT_FINISHED", 0),
        ("equal-counts-horizontal", [[1, 1], [0, 0]], [1, 2], "NOT_FINISHED", 0),
        ("complete-palette", [list(range(16)), list(range(16))], [4, 3], "NOT_FINISHED", 0),
        ("maximum-checkerboard", [[15 if (x + y) % 2 else 0 for x in range(64)] for y in range(64)], [6], "NOT_FINISHED", 0),
        ("public-terminal-state", [[3] * 8 for _ in range(8)], [], "WIN", 6),
    ]
    output = []
    for index, (name, rows, actions, state, completed) in enumerate(cases):
        scope = "public-observer-reference:" + name
        frame = {"rows": rows, "sha256": namespace["digest"](rows), "metadata": {
            "available_action_refs": ["ACTION" + str(action) for action in actions],
            "state": state, "levels_completed": completed,
        }}
        perceived = namespace["perceive"](frame, index, scope, interface)
        observation = perceived["observation"]
        output.append({"id": name,
            "input": {"frame": rows, "availableActionIds": actions, "state": state, "levelsCompleted": completed},
            "identity": {"id": observation["id"], "scope": scope},
            "expected": observation})
    return {"schema": "logos-engine.public-observer.python-reference.v1",
        "provenance": {"repository": "yannick-fontan-1981/ARC-AGI-3-Yannick-Fontan", "commit": COMMIT,
                       "execution": "Original function definitions selected by AST without body changes; stdlib dependencies only.",
                       "scope": "Eight public V7 facts and advertised command vocabulary; excludes archive transport and hidden game state.",
                       "sources": manifest},
        "cases": output}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    fixture = make_fixture()
    if args.check:
        previous = json.loads(FIXTURE.read_text(encoding="utf-8"))
        if previous != fixture:
            raise AssertionError("Public observer projection changed from the pinned Python reference")
        print(f"Verified {len(fixture['cases'])} public-observer Python reference cases.")
    else:
        FIXTURE.parent.mkdir(parents=True, exist_ok=True)
        FIXTURE.write_text(json.dumps(fixture, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")
        print(f"Exported {len(fixture['cases'])} public-observer Python reference cases.")


if __name__ == "__main__":
    main()
