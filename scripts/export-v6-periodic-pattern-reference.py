#!/usr/bin/env python3
"""Exact V5 periodic-grid outputs for the native fragment-counting transfer.

Only controlled palette matrices and the pinned agent source are loaded.
No game host, implementation, specification or solution is used.
"""
import gzip
import hashlib
import json
from pathlib import Path
import random
import sys

ROOT = Path(__file__).resolve().parents[1]
COMMIT = "786dcf51ca57773d8e3a8948ce9ea3655e7baf8e"
SOURCE = ROOT / "reference/v6" / COMMIT / "source"
NAMES = ["frame", "tile_lattice", "contracts"]
manifest = json.loads((ROOT / "reference/v6" / COMMIT / "manifest.json").read_text())
hashes = {}
for name in NAMES:
    path = f"agents/yf_arc3_v5/capabilities/{name}.py"
    hashes[path] = hashlib.sha256((SOURCE / path).read_bytes()).hexdigest()
    assert hashes[path] == manifest["files"][path]["sha256"]
sys.path.insert(0, str(SOURCE))
from agents.yf_arc3_v5.capabilities.contracts import FrameGrid, PeriodicCellGridInput
from agents.yf_arc3_v5.capabilities.frame import enumerate_periodic_cell_grids, _periodic_axes
from agents.yf_arc3_v5.capabilities.tile_lattice import exact_bordered_tile_lattices, exact_joint_tile_lattices

randomizer = random.Random(37138)
rasters = {
    "many-fragment-ids": [[randomizer.randrange(256) for _ in range(27)] for _ in range(24)],
    "palette-byte-boundaries": [[(0, 10, 34, 92, 127, 128, 255)[(y // 3 + x // 3) % 7] for x in range(24)] for y in range(21)],
    "same-multiset-different-cell-order": [[(x % 3 + 3 * (y % 3) + 9 * ((x // 3 + y // 3) % 2)) % 18 for x in range(24)] for y in range(21)],
    "bordered-repetition": [[0 if x % 5 in (0, 4) or y % 5 in (0, 4) else 255 for x in range(25)] for y in range(25)],
}
cases = []
for name, rows in rasters.items():
    frame = FrameGrid(rows=tuple(map(tuple, rows)))
    exact = tuple(sorted(set(exact_bordered_tile_lattices(frame, maximum_pitch=8) + exact_joint_tile_lattices(frame, maximum_pitch=8))))
    axes = _periodic_axes(frame, axis="column", maximum_pitch=8,
                          exact_zero_gap_axes=tuple((width, left) for _, left, _, width in exact))
    fragments = {tuple(row[left:left + axis.cell_extent]) for axis in axes for left in axis.starts for row in rows}
    for conditioned in (False, True):
        options = {"maximum_pitch": 8, "maximum_candidates": 3,
                   "action_conditioned_grid_evidence": conditioned, "observed_translation_quantum": 3}
        result = enumerate_periodic_cell_grids(PeriodicCellGridInput(frame=frame, **options)).model_dump(mode="json")
        result.pop("schema_version")
        for candidate in result["candidates"]:
            for key in ("cells", "clipped_cells", "visible_row_range", "visible_column_range", "schema_version"):
                candidate.pop(key)
        cases.append({"id": f"{name}:{conditioned}", "rows": rows, "options": options,
                      "distinctHorizontalFragments": len(fragments), "expected": result})
assert cases[0]["distinctHorizontalFragments"] > 256
for path, digest in hashes.items():
    assert hashlib.sha256((SOURCE / path).read_bytes()).hexdigest() == digest
output = ROOT / "tests/fixtures/v6-periodic-pattern-reference.json.gz"
payload = {"schema": "logos-engine.periodic-pattern-source-reference.v1", "sourceCommit": COMMIT,
           "sourceHashes": hashes, "cases": cases}
output.write_bytes(gzip.compress((json.dumps(payload, separators=(",", ":")) + "\n").encode(), mtime=0))
print(json.dumps({"output": str(output), "cases": len(cases),
                  "maximumDistinctHorizontalFragments": max(case["distinctHorizontalFragments"] for case in cases)}))
