"""Compare the LS20 modifier, selective return and peer access across revisions."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipts", type=Path)
args = parser.parse_args()


def load(name):
    return json.loads((args.receipts / (name + ".json")).read_bytes())


gel, proof = load("d0e7527c"), load("a0af03d0")
assert gel == proof and len(gel) == 3
nominal, orientation, stale = gel


def at(rows, kind, turn):
    return next(row for row in rows if row["kind"] == kind and row["turn"] == turn)


t7, t11, t14 = (at(nominal, "ticket", turn) for turn in (7, 11, 14))
assert (t7["action"], t7["route"], t7["orientation"], t7["alternatives"]) == ("ACTION3", "modifier", "different", [3])
assert (t7["from"], t7["to"], t7["contactChange"]) == ([24, 45], [19, 45], False)
assert at(nominal, "return", 7)["matched"] is True
r10 = at(nominal, "return", 10)
assert r10["matched"] is None and r10["reason"] == "measure_terminal_contact_or_boundary"
selective, = r10["acquired"]
assert selective["ref"] == r10["ref"] and selective["unchanged"] == [33, 9, 39, 15] and selective["pair"]
for ticket, route in ((t11, "peer_access_probe"), (t14, "peer")):
    assert ticket["route"] == route and ticket["pair"] == t7["pair"]
    assert ticket["contactRef"] == selective["ref"] and ticket["contactChange"] is True
    assert (ticket["orientation"], ticket["alternatives"]) == ("aligned", [0])
assert at(nominal, "return", 14)["matched"] is True and t14["to"] == [34, 25]
assert at(nominal, "return", 17)["levels"] == 1
assert at(nominal, "ticket", 18)["level"] == 2 and at(nominal, "ticket", 18)["owner"] == "acquire_control_for_target"

for rows, reason, binding in ((orientation, "pose_not_discriminated", "bound"), (stale, "modifier_access_unbound", "stale_scope")):
    assert rows[:12] == nominal[:12]
    replacement = at(rows, "ticket", 7)
    assert replacement["ref"] == t7["ref"] and replacement["owner"] == "view" and replacement["action"] == "ACTION2"
    base, rejection = replacement["assessments"]
    assert base == t7["assessments"][-1] and base["route"] == "modifier" and base["bindings"]["modifier"] == "bound"
    assert rejection["ref"] == base["ref"] and rejection["route"] is None and rejection["authority"] is False
    assert rejection["reason"] == reason and rejection["bindings"]["modifier"] == binding
    returned = at(rows, "return", 7)
    assert returned["owner"] == "view" and returned["packet"] != at(nominal, "return", 7)["packet"]

catalogue, = load("catalogue")["games"]
assert catalogue["count"] == catalogue["observed"] == 16 and len(catalogue["rows"]) == 10
assert [row["sequence"] for row in catalogue["rows"]] == list(range(7, 17))
assert catalogue["levels"] == 0
print(json.dumps({
    "equalScenarios": len(gel), "catalogue": [catalogue["count"], len(catalogue["rows"])],
    "modifier": t7, "selectiveReturn": selective, "peerAccess": t11, "peerChoice": t14,
    "changes": [at(rows, "ticket", 7) for rows in (orientation, stale)], "firstBoundary": 17,
}, indent=2))
