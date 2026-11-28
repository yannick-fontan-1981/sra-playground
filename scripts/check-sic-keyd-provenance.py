"""Locate the first effect of KEYD access provenance on actual native tickets."""

import argparse
import json
from pathlib import Path


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("directory", type=Path)
args = parser.parse_args()


def read(name):
    return json.loads((args.directory / name).read_bytes())


parent, correction = read("f710f2e1.json"), read("51d983a7.json")
assert parent["revision"] == "f710f2e13f252ca0ec1b7de7e25768e13a5e5bf4"
assert correction["revision"] == "51d983a7243289d2ebb2cef365dd536cbeaf59b1"
assert parent["nominal"] == correction["nominal"]
base = correction["nominal"]["steps"]
assert parent["level"] == correction["level"] == 1 and parent["cap"] == correction["cap"] == len(base) == 16
proof, = [r["access"] for r in base[7]["after"]["access"] if "access" in r]
assert proof["status"] == "local_access_return" and proof["evidence"] == [base[7]["pre"]["ref"], base[8]["pre"]["ref"]]
assert proof["partition_changed_pixels"] == 11 and proof["display_signature_disappeared"] is True
assert base[8]["pre"]["offer"] == "capacity_probe_candidate"
assert base[8]["pre"]["refs"] == [base[8]["pre"]["ref"], *proof["evidence"]]

for kind in ("removed", "foreign", "priorPair"):
    old, new = parent[kind]["steps"], correction[kind]["steps"]
    assert old[:8] == new[:8] == base[:8]
    old_read, = parent[kind]["projectionReads"]
    new_read, = correction[kind]["projectionReads"]
    expected = {"removed": [], "foreign": [base[7]["pre"]["ref"], base[5]["pre"]["ref"]],
                "priorPair": [base[6]["pre"]["ref"], base[7]["pre"]["ref"]]}[kind]
    assert old_read == new_read
    assert [r["evidence"] for r in new_read["used"]] == ([expected] if expected else [])
    assert old[8]["pre"]["offer"] == ("capacity_probe_candidate" if expected else "endpoint_approach_candidate")
    assert new[8]["pre"]["offer"] == new[9]["pre"]["offer"] == "endpoint_approach_candidate"
    for turn, command in ((9, "ACTION4"), (10, "ACTION2")):
        a, b, nominal = (s[turn - 1] for s in (old, new, base))
        assert len({r["pre"]["packet"] for r in (a,b,nominal)}) == len({r["after"]["packet"] for r in (a,b,nominal)}) == 1
        assert all(r["pre"]["command"] == {"actionRef": command, "data": {}} for r in (a,b,nominal))
        assert all(r["pre"]["guard"] == "current_scoped_inventory_composition" and r["after"]["matched"] is True
                   for r in (a,b,nominal))
        assert all(r["after"]["levels"] == 0 for r in (a,b,nominal))

before = read("SKBN/f710f2e1.json")
after = read("SKBN/51d983a7.json")
assert before == after
nominal, _ = after
for turn in (14, 16):
    result = next(r for r in nominal if r["kind"] == "return" and r["turn"] == turn)
    assert result["matched"] is False and result["acquired"][0]["accessCount"] == [0, 0]

print(json.dumps({
    "parent": parent["revision"], "correction": correction["revision"], "nominalTickets": len(base),
    "scope": "KEYD N1 under catalogue action cap", "firstDifference": 9,
    "truePair": [8, 9], "rejectedPairs": [[8, 6], [7, 8]], "confirmedCommands": ["ACTION4", "ACTION2"],
    "typeBefore": "capacity_probe_candidate", "typeAfter": "endpoint_approach_candidate",
    "unchangedPhysicalReturns": [9, 10], "unchangedSKBNTurns": [14, 16],
}, indent=2))
