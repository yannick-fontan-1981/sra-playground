"""Check the DC22 support reconfiguration and same-action wrong-surface rejection."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipts", type=Path)
args = parser.parse_args()
gel, proof = [json.loads((args.receipts / (rev + ".json")).read_bytes()) for rev in ("d0e7527c", "d713024a")]
assert gel == proof and len(gel) == 2
nominal, counterexample = gel


def at(rows, kind, turn):
    return next(row for row in rows if row["kind"] == kind and row["turn"] == turn)


t2, r2 = [at(nominal, kind, 2) for kind in ("ticket", "return")]
assert t2["action"] == "ACTION2" and t2["positions"] == [None]
assert r2["matched"] is None
move = next(e for e in r2["acquired"] if e["kind"] == "unit_translation_and_support_observed")
assert (move["command"], move["delta"], move["after"]) == ("ACTION2", [2, 0], r2["ref"])

keys = set()
for turn in (7, 8, 9):
    issued, returned = [at(nominal, kind, turn) for kind in ("ticket", "return")]
    assert issued["point"] == {"x": 48, "y": 36 if turn == 9 else 19}
    assert issued["question"] and issued["question"] not in keys
    keys.add(issued["question"])
    remote = next(e for e in returned["acquired"] if e["kind"] == "remote_support_effect_measured")
    assert remote["effectRef"] == returned["ref"] and remote["cells"] > 0 and remote["usefulness"] == "unconfirmed"
    assert any(e["kind"] == "contextual_control_question_closed" and e["question"] == issued["question"]
               for e in returned["acquired"])

t11 = at(nominal, "ticket", 11)
assert at(nominal, "return", 10)["surface"] == {"start": [14] * 4, "next": [9] * 4}
assert at(nominal, "return", 11)["matched"] is True
assert at(nominal, "return", 11)["surface"]["next"] == [14] * 4
inspected = at(counterexample, "ticket", 11)
assert inspected["ref"] == t11["ref"] and inspected["action"] == t11["action"] == "ACTION1"
refusal, accepted = inspected["guards"]
assert accepted in t11["guards"] and accepted["admitted"] is True
assert refusal["admitted"] is False and refusal["reason"] == "support_binding_changed"
assert refusal["surface"] == {"start": [14] * 4, "next": [4, 9, 9, 4]}
assert accepted["surface"] == {"start": [14] * 4, "next": [9] * 4}
assert refusal["action"] == accepted["action"] == "ACTION1"
assert len([row for row in nominal if row["kind"] == "ticket"]) == 16

print(json.dumps({
    "equalScenarios": len(gel), "measuredT2": move,
    "T9": at(nominal, "ticket", 9), "T9return": at(nominal, "return", 9),
    "T11guards": [accepted, refusal], "T11return": at(nominal, "return", 11),
}, indent=2))
