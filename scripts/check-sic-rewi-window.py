"""Check the current unique REWI window and its official boundary."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipts", type=Path)
args = parser.parse_args()
gel, proof, combined = [json.loads((args.receipts / (rev + ".json")).read_bytes())
                        for rev in ("d0e7527c", "9b41b8ba", "674b0dd1")]
assert gel == proof and len(gel) == len(combined) == 4
nominal, ambiguous, stationary, early = gel


def at(rows, kind, turn):
    return next(row for row in rows if row["kind"] == kind and row["turn"] == turn)


for turn, x in enumerate((34, 28, 22, 16, 10, 4), 1):
    t = at(nominal, "ticket", turn)
    assert t["owner"] == "information_goal" and t["action"] == "ACTION6" and t["point"] == {"x": x, "y": 61}
for turn in (7, 8):
    t = at(nominal, "ticket", turn)
    assert t["owner"] == "observed_frontier" and t["action"] == "ACTION3"

r7, r8 = [at(nominal, "return", turn) for turn in (7, 8)]
assert not (r7.get("measure") or {}).get("matches")
assert r8["measure"] == {"matches": [[27, 18]], "reference": [53, 53, 62, 62], "image": [1, 1, 62, 42]}
t9 = at(nominal, "ticket", 9)
assert t9["owner"] == "public_occurrence_recall" and t9["subquestion"] == "framed_window_composition"
assert t9["guard"] == "current_window_and_point_bound" and t9["refs"] == [r8["ref"]]
assert t9["point"] == {"x": 33, "y": 24}
assert (t9["window"]["position"], t9["window"]["count"], t9["window"]["method"], t9["window"]["complete"]) == ([27, 18], 1749, "COMPLETE", True)

both = at(ambiguous, "return", 8)["measure"]
assert both["reference"] == r8["measure"]["reference"] and both["image"] == r8["measure"]["image"]
assert both["matches"] == [[5, 5], [27, 18]]
assert at(ambiguous, "ticket", 9)["offer"] != "framed_window_experiment"
assert at(stationary, "ticket", 9) == t9 == at(early, "ticket", 9)
done = at(nominal, "return", 9)
assert done["matched"] is None and done["levels"] == 1
fell = at(stationary, "return", 9)
assert fell["matched"] is None and fell["levels"] == 0
observed = next(e for e in done["acquired"] if e["kind"] == "framed_window_response")
blocked = next(e for e in fell["acquired"] if e["kind"] == "framed_window_response")
assert (observed["epoch"], observed["afterEpoch"], observed["official"], observed["changed"]) == (1, 2, True, True)
assert observed["refs"] == [t9["ref"], done["ref"]]
assert (blocked["official"], blocked["changed"], blocked["blocked"]) == (False, False, [t9["window"]["trial"]])
assert at(stationary, "ticket", 10)["offer"] != t9["offer"]
future = at(nominal, "ticket", 10)
assert future["level"] == 2 and future["question"] == "rebind_prior_epoch_hypothesis_without_transferring_authority"

print(json.dumps({
    "equalScenarios": len(gel), "assembledEqual": gel == combined, "previousView": r7["measure"],
    "framedWindow": t9, "ambiguousMatches": both["matches"], "boundary": observed, "stationary": blocked, "next": future,
}, indent=2))
