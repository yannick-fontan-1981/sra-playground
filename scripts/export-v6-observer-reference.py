"""Export native-observer goldens by executing the pinned, unchanged V6/V5 files.

Python is a creator-side reference only. The delivered observer runs TypeScript.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys
from types import SimpleNamespace


COMMIT = "786dcf51ca57773d8e3a8948ce9ea3655e7baf8e"
SITE = Path(__file__).resolve().parents[1]


def plain(value):
    if isinstance(value, dict):
        return {str(key): plain(item) for key, item in value.items()}
    if isinstance(value, (set, frozenset)):
        return [plain(item) for item in sorted(value)]
    if isinstance(value, (list, tuple)):
        return [plain(item) for item in value]
    return value


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", type=Path, default=SITE / "reference/v6" / COMMIT / "source")
    parser.add_argument("--output", type=Path, default=SITE / "tests/fixtures/v6-observer-reference.json")
    args = parser.parse_args()
    root = args.source_root.resolve()
    manifest = json.loads((SITE / "reference/v6" / COMMIT / "manifest.json").read_text())
    sources = ("agents/yf_arc3_v6/laya_proto/geometric_observer.py",
               "agents/yf_arc3_v6/laya_proto/neutral_observer.py",
               "agents/yf_arc3_v6/laya_proto/observed_input_domain.py",
               "agents/yf_arc3_v6/laya_proto/common_multiscale_constraints.py",
               "agents/yf_arc3_v5/capabilities/components.py",
               "agents/yf_arc3_v5/capabilities/contracts.py",
               "agents/yf_arc3_v5/logos/types.py")
    hashes = {}
    for name in sources:
        digest = hashlib.sha256((root / name).read_bytes()).hexdigest()
        if digest != manifest["files"][name]["sha256"]:
            raise ValueError("Reference source changed: " + name)
        hashes[name] = digest
    sys.path[:0] = [str(root), str(root / "agents/yf_arc3_v6/laya_proto")]
    from geometric_observer import components, correspondences, transitions
    from neutral_observer import measure
    from observed_input_domain import ObservedInputDomain
    from common_multiscale_constraints import rows_digest
    from agents.yf_arc3_v5.capabilities.components import detect_components
    from agents.yf_arc3_v5.capabilities.contracts import ComponentExtractionInput, FrameGrid

    matrices = [
        ("irregular_repeated", [[0, 0, 0, 0, 0, 0, 0], [0, 1, 1, 0, 2, 2, 0], [0, 1, 0, 0, 0, 2, 0],
                                [0, 0, 0, 0, 0, 0, 0], [0, 1, 1, 0, 1, 1, 0], [0, 1, 0, 0, 1, 0, 0]]),
        ("diagonal_connectivity", [[1, 0, 2], [0, 1, 0], [2, 0, 1]]),
        ("centroid_hole", [[1, 1, 1, 1, 1], [1, 0, 0, 0, 1], [1, 0, 2, 0, 1], [1, 0, 0, 0, 1], [1, 1, 1, 1, 1]]),
        ("scaled_components", [[v for v in row for _ in range(2)] for row in [[0, 1, 1, 0], [0, 1, 0, 0], [0, 0, 2, 2]] for _ in range(2)]),
    ]
    cases = []
    for name, rows in matrices:
        frame_hash = hashlib.sha256(json.dumps(rows, separators=(",", ":")).encode()).hexdigest()[:16]
        public = SimpleNamespace(frame_rows=rows, frame_hash=frame_hash, level=1, levels_completed=0,
                                 state="NOT_FINISHED", available_action_refs=("ACTION7", "ACTION6", "ACTION5", "ACTION2"))
        observation, parts = measure(public, 1, "reference")
        domains = []
        for limit in (3, 4096):
            domain = ObservedInputDomain(limit)
            inputs = domain.candidates(observation)
            table = domain.bindings[(1, frame_hash)]
            domains.append({"limit": limit, "candidates": inputs, "bindings": [[f"{x},{y}", value] for (x, y), value in table.items()]})
        v5 = {}
        for connectivity in (4, 8):
            measured = detect_components(ComponentExtractionInput(frame=FrameGrid(rows=rows), connectivity=connectivity))
            value = measured.model_dump(mode="json")
            # Pydantic width/height are properties, not serialized fields. The
            # TS plain records retain those same measured properties explicitly.
            for result, original in zip(value["components"], measured.components, strict=True):
                result["bbox"].update(width=original.bbox.width, height=original.bbox.height)
            v5[str(connectivity)] = value
        point = next(tuple(action["data"][key] for key in ("x", "y")) for action in domains[0]["candidates"] if action["action_ref"] == "ACTION6")
        witness = ObservedInputDomain.make_locus_witness(observation, rows, point, reason="measured reference", evidence=[observation["observation_ref"]])
        cases.append({"id": name, "rows": rows, "public": {"frame_rows": rows, "frame_hash": frame_hash, "level": 1,
                      "levels_completed": 0, "state": public.state, "available_action_refs": public.available_action_refs},
                      "observation": observation, "parts": parts, "correspondences": correspondences(parts),
                      "domains": domains, "v5": v5, "rowsDigest": rows_digest(rows), "witness": witness})
    transition = {"before": matrices[0][1], "after": matrices[3][1]}
    transition["expected"] = transitions(components(transition["before"]), components(transition["after"]))
    fixture = {"schema": "sra.v6.observer-reference.v1", "commit": COMMIT, "sourceHashes": hashes,
               "normalization": ["frozenset masks sorted lexicographically", "V5 bbox width/height properties materialized"],
               "cases": cases, "transition": transition}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(plain(fixture), ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"cases": len(cases), "sources": len(hashes), "output": str(args.output)}))


if __name__ == "__main__":
    main()
