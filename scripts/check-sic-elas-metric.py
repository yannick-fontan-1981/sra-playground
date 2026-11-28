"""Verify ELAS target identity, transfer effect and reference-sensitive sealing."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipts", type=Path)
args = parser.parse_args()
gel, proof = [json.loads((args.receipts / (rev + ".json")).read_bytes()) for rev in ("d0e7527c", "280a54b5")]
assert gel == proof and len(gel) == 2
nominal, second_selection = gel


def at(rows, kind, turn):
    return next(row for row in rows if row["kind"] == kind and row["turn"] == turn)


for turn, receiver, point, scale, target in (
    (1, 24, {"x": 28, "y": 25}, [2, 1], [14, 10]),
    (3, 30, {"x": 19, "y": 28}, [3, 1], [8, 6]),
):
    issued = at(nominal, "ticket", turn)
    assert issued["action"] == "ACTION6" and issued["receiver"] == "visible:" + str(receiver)
    assert (issued["point"], issued["scale"], issued["anchor"]) == (point, scale, target)
    assert at(nominal, "return", turn)["metric"]["selected"] == receiver

t5, r5 = [at(nominal, kind, 5) for kind in ("ticket", "return")]
r4 = at(nominal, "return", 4)
assert t5["control"] and r4["ref"] in t5["refs"]
assert r4["matched"] is True and r4["metric"]["targetContains9"]
assert r5["matched"] is False and r5["reason"] == "metric_effect_or_underlay_requires_reconciliation"
assert any(event["seal_prefix"] is True for event in r5["comparisons"])
assert r5["metric"]["selected"] == 16 and r5["metric"]["grid"] == t5["grid"]
assert r5["metric"]["target"] != t5["target"] and not r5["metric"]["targetContains9"]
assert at(nominal, "ticket", 6)["target"] == r5["metric"]["target"]
measure, = [event for event in r5["measurements"] if event["kind"] == "metric_control_response" and event["after"] == r5["ref"]]
assert measure["projected"] is True and measure["unknown"] is False

actual = at(nominal, "ticket", 2)
other = at(second_selection, "ticket", 2)
assert actual["action"] == other["action"] == "ACTION1"
rejected, accepted = other["guards"]
assert accepted["selected"] == 24 and accepted["admitted"] is True
assert rejected["selected"] == 8 and rejected["admitted"] is False and rejected["reason"] == "metric_premise_changed"
r1 = at(second_selection, "return", 1)
assert any(row["selected"] == 8 and row["matched"] is False and row["seal_prefix"] is True for row in r1["comparisons"])
assert [at(nominal, "return", n)["levels"] for n in (2, 11)] == [1, 2]
assert at(nominal, "ticket", 12)["owner"] == "contextual_compartments"

print(json.dumps({
    "equalScenarios": len(gel), "firstSelections": [at(nominal, "ticket", n) for n in (1, 3)],
    "T5Physical": measure, "T5Sealed": True, "T5target": r5["metric"]["target"],
    "sameActionAlternateReceiver": [accepted, rejected], "officialTurns": [2, 11],
}, indent=2))
