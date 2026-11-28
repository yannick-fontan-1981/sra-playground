"""Check the official SKBN approaches and KEYD access evidence in their paired captures."""

import argparse
import json
from pathlib import Path


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("skbn", type=Path)
parser.add_argument("keyd", type=Path)
args = parser.parse_args()


def read(folder, name):
    return json.loads((folder / name).read_bytes())


def turn(session, number, kind):
    return next(row for row in session if row["kind"] == kind and row["turn"] == number)


skbn = read(args.skbn, "d0e7527c.json")
assert skbn == read(args.skbn, "fa126d65.json")
nominal, already_visited = skbn
for number, command in ((14, "ACTION1"), (16, "ACTION4")):
    ticket = turn(nominal, number, "ticket")
    result = turn(nominal, number, "return")
    assert ticket["action"] == command and ticket["offer"] == "endpoint_approach_candidate"
    assert ticket["endpointRole"] == "unknown"
    assert result["matched"] is False and result["levels"] == 0
    receipt, = result["acquired"]
    assert receipt["status"] == "changed_endpoint_reached" and receipt["accessCount"] == [0, 0]
    assert receipt["evidence"] == [ticket["ref"], result["ref"]]
assert [turn(nominal, n, "ticket")["owner"] for n in (15, 17)] == ["observed_frontier", "pre_score_contact"]
assert turn(already_visited, 14, "ticket")["ref"] == turn(nominal, 14, "ticket")["ref"]
assert turn(already_visited, 14, "ticket")["action"] == "ACTION2"

gel, candidate = (read(args.keyd, name) for name in ("keyd-causal.json", "keyd-preuve.json"))
sha_g, sha_c = gel.pop("revision"), candidate.pop("revision")
assert sha_g.startswith("d0e7527c") and sha_c.startswith("fa126d65") and gel == candidate
base, removed, foreign = (gel[name] for name in ("nominal", "removed", "foreign"))
assert len(base["steps"]) == 16 and all(s["pre"]["owner"] == "public_observed_inventory" for s in base["steps"])
t5, t6, t8, t9, cut, stale = (arm["steps"][n - 1] for arm, n in
                            ((base, 5), (base, 6), (base, 8), (base, 9), (removed, 9), (foreign, 9)))
assert t5["pre"]["command"]["actionRef"] == "ACTION5" and t5["after"]["matched"] is None
access, = [v["access"] for v in t8["after"]["access"] if "access" in v]
assert access["status"] == "local_access_return" and access["evidence"] == [t8["pre"]["ref"], t9["pre"]["ref"]]
assert [s["pre"]["offer"] for s in (t9, cut, stale)] == [
    "capacity_probe_candidate", "endpoint_approach_candidate", "capacity_probe_candidate",
]
assert all(s["pre"]["command"]["actionRef"] == "ACTION4" and s["after"]["matched"] is True for s in (t9, cut, stale))
assert len({s["pre"]["packet"] for s in (t9, cut, stale)}) == len({s["after"]["packet"] for s in (t9, cut, stale)}) == 1
assert removed["projectionReads"][0]["used"] == []
assert t9["pre"]["refs"] == [t9["pre"]["ref"], *access["evidence"]]
assert cut["pre"]["refs"] == [t9["pre"]["ref"]]
assert stale["pre"]["refs"] == [t9["pre"]["ref"], t8["pre"]["ref"], t6["pre"]["ref"]]
assert all(s["after"]["levels"] == 0 for s in base["steps"])

print(json.dumps({
    "freeze": sha_g, "proof": sha_c, "line": 38, "strict": False,
    "skbn": {"officialApproaches": 2, "turns": [14, 16], "accessAcquisitions": 0},
    "keyd": {"officialInventoryTickets": 16, "accessAcquiredAt": 8, "firstDifferenceAt": 9,
             "withdrawal": [t9["pre"]["offer"], cut["pre"]["offer"]],
             "foreignEvidenceAdmitted": True, "command": t9["pre"]["command"], "sameOfficialReturn": True,
             "levels": 0},
}, indent=2))
