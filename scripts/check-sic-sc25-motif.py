"""Check the limited SC25 motif witness and search retained historical decisions."""
import argparse
from collections import Counter
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipts", type=Path)
parser.add_argument("--historical", type=Path, required=True, action="append")
args = parser.parse_args()


def load(root, name):
    return json.loads((root / name).read_bytes())


gel, proof = [load(args.receipts, rev + ".json") for rev in ("d0e7527c", "6172e2d3")]
assert gel == proof and len(gel) == 3
nominal, no_grid, no_card = gel


def at(rows, kind, turn):
    return next(row for row in rows if row["kind"] == kind and row["turn"] == turn)


def evidence(rows, turn):
    ref = at(rows, "return", turn)["ref"]
    return next(event for row in rows if row["kind"] == "return"
                for event in row["acquired"] if event.get("ref") == ref)


assert len([row for row in nominal if row["kind"] == "ticket" and row["owner"] == "motif_access"]) == 12
t2 = at(nominal, "ticket", 2)
assert t2["mode"] == "calibrate" and t2["translations"] == {} and t2["action"] == "ACTION1"
e2 = evidence(nominal, 2)
assert e2["before"] == e2["after"] == [[39, 19], 4]
assert at(no_grid, "ticket", 2)["owner"] == "observed_frontier" and at(no_grid, "ticket", 2)["action"] == t2["action"]
t8 = at(nominal, "ticket", 8)
assert t8["mode"] == "toggle" and t8["card"] == [1, 3, 5, 7]
assert t8["translations"] == {"ACTION3": [-4, 0], "ACTION4": [4, 0]}
assert all(evidence(nominal, n)["ref"] in t8["refs"] for n in (4, 7))
assert at(no_card, "ticket", 8)["owner"] == "observed_frontier" and at(no_card, "ticket", 8)["point"] == {"x": 12, "y": 19}
assert at(nominal, "ticket", 9)["point"] == at(nominal, "ticket", 13)["point"] == {"x": 30, "y": 55}
assert [at(nominal, "ticket", n)["owner"] for n in (9, 13)] == ["public_occurrence_recall", "motif_access"]
t15, r15 = [at(nominal, kind, 15) for kind in ("ticket", "return")]
assert t15["mode"] == "invoke" and t15["expected"] is None
assert r15["frames"] == 17 and r15["matched"] is None and r15["levels"] == 0
e15 = evidence(nominal, 15)
assert e15["clear"] is True and "remoteContact" not in e15

extended, = load(args.receipts, "prolongation.json")["games"]
assert extended["count"] == extended["observed"] == 51 and extended["levels"] == 0
assert len(extended["rows"]) == 51
assert all(row["proposal"] == "cell_patch_placement" for row in extended["rows"][15:])

history = []
for root in args.historical:
    receipt = load(root, "SC25.receipt")
    levels, turns = Counter(), Counter()
    found = []
    with (root / "SC25-A.jsonl").open(encoding="utf8") as stream:
        for raw in stream:
            event = json.loads(raw)
            if event["kind"] != "decision":
                continue
            proposal = event["value"].get("proposal") or {}
            level, turn = event["level"], event["turn"]
            levels[level] += 1
            turns[proposal.get("kind")] += 1
            if proposal.get("motif_plan") or proposal.get("material_access_subquestion") == "motif_conditioned_access":
                found.append({"level": level, "turn": turn, "kind": proposal.get("kind")})
    assert sum(turns.values()) == receipt["actions"]
    history.append({"directory": root.name, "levelsWon": receipt["levels"], "decisions": sum(turns.values()),
                    "perLevel": levels, "selectedProposalKinds": turns, "motifOffers": found, "stop": receipt["reason"]})

print(json.dumps({
    "short": {"scenarios": len(gel), "motifTickets": 12, "invocation": e15},
    "catalogueExtension": {"decisions": extended["count"], "levelsWon": extended["levels"], "afterT15": "cell_patch_placement"},
    "historical": history,
}, indent=2))
