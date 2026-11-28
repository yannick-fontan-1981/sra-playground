"""Verify two observable decisions and their shared evidence across the SEQN level boundary."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipts", type=Path)
args = parser.parse_args()
def load(name):
    return json.loads((args.receipts / (name + ".json")).read_bytes())
gel, candidate = load("d0e7527c"), load("b5dda8ec")
assert gel == candidate and len(gel) == 5
nominal, removed_band, wrong_band, removed_score, wrong_pixel = gel

def at(rows, n):
    ticket, returned = rows[2*(n-1):2*n]
    assert ticket["kind"] == "ticket" and returned["kind"] == "return" and ticket["turn"] == returned["turn"] == n
    return ticket, returned

def selected(row, kind):
    return [event for event in row["acquired"] if event["kind"] == kind]

t8, r8 = at(nominal, 8)
assert t8["action"] == "ACTION1" and t8["owner"] == "factored_material_return"
assert t8["guard"] == "complete_partition_bound" and t8["factor"]["indices"] == [60,61,62]
assert t8["factor"]["returned"] == at(nominal, 7)[1]["ref"]
assert t8["factor"]["witnesses"] == [at(nominal,n)[1]["ref"] for n in [1,3,4]]
assert t8["factor"]["plan"] == ["ACTION1","ACTION3","ACTION2","ACTION4"]
assert [p["matched"] for p in r8["partition"]] == [True,True]
wb8, wbr8 = at(wrong_band, 8)
assert wb8 == t8 and [p["matched"] for p in wbr8["partition"]] == [True,False]
assert wbr8["reason"] == "partition_forecast_diverged" and wbr8["seal"]
assert not selected(wbr8, "factored_rewrite_sample")
without_band, _ = at(removed_band, 8)
assert removed_band[:14] == nominal[:14] and without_band["ref"] == t8["ref"]
assert (without_band["owner"], without_band["action"]) == ("observed_frontier","ACTION4")

t11, r11 = at(nominal, 11)
scored, = selected(r11, "factored_rewrite_scored")
samples = selected(r11, "factored_rewrite_sample")
assert [sample["before"] for sample in samples] == [at(nominal,n)[0]["ref"] for n in [8,9,10]]
assert [s["action"] for s in samples] == ["ACTION1","ACTION3","ACTION2"]
model = scored["model"]
assert model["witnesses"] == [sample["before"] for sample in samples]
assert model["boundary_ref"] == t11["ref"] and model["boundary_action"] == "ACTION4"
assert scored["after"] == r11["ref"] and r11["levels"] == 1

t12, r12 = at(nominal, 12)
assert (t12["owner"], t12["offer"], t12["action"]) == ("scored_local_rewrite","public_scored_rewrite","ACTION1")
assert (t12["rewrite"]["source"], t12["rewrite"]["target"]) == (model["source"], model["target"])
assert t12["rewrite"]["sites"] == [[16,34]]
assert all(ref in t12["evidence"] for ref in [model["boundary_ref"],*model["witnesses"]])
success, = selected(r12, "scored_rewrite_test")
assert success["outcome"] == "matched" and r12["matched"] and success["after"] == r12["ref"]
alternate, ar = at(removed_score, 12)
assert removed_score[:22] == nominal[:22] and alternate["ref"] == t12["ref"]
assert (alternate["owner"], alternate["action"]) == ("observed_frontier","ACTION1")
assert ar["packet"] == r12["packet"] and not selected(ar, "scored_rewrite_test")
assert at(removed_score, 13)[0]["action"] == "ACTION2"
wrong, wr = at(wrong_pixel, 12)
assert wrong == t12 and not wr["matched"] and wr["seal"] and wr["reason"] == "predicted_mask_rewrite_refuted"
refuted, = selected(wr, "scored_rewrite_test")
assert refuted["outcome"] == "refuted" and refuted["after"] == wr["ref"] and refuted["epoch"] == 2
assert wrong_pixel[24]["action"] == "ACTION2"
assert sum(r.get("owner")=="factored_material_return" for r in nominal[:32] if r["kind"]=="ticket")==4
assert sum(r.get("owner")=="scored_local_rewrite" for r in nominal[:32] if r["kind"]=="ticket")==5
print(json.dumps({"identicalSessions":len(gel),"occurrences":{"11":4,"81":5},
    "line11":{"ticket":t8,"publicReturn":r8,"wrongChannel":wbr8,"withdrawal":without_band},
    "line81":{"source":scored,"ticket":t12,"publicReturn":r12,"withdrawal":[alternate,ar],"counterexample":refuted}},indent=2))
