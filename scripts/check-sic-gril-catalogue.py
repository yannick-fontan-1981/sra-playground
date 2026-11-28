"""Link GRIL's submitted answer and its reusable view witness to their own public returns."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipts", type=Path)
args = parser.parse_args()
def load(name):
    return json.loads((args.receipts / (name + ".json")).read_bytes())
gel, candidate = load("d0e7527c"), load("915e0601")
assert gel == candidate and len(gel) == 4
nominal, no_answer, no_access, no_answer_for_view = gel

def at(rows, n):
    start = (n - 1) * 2
    ticket = rows[start]
    assert ticket["kind"] == "ticket" and ticket["turn"] == n
    returned = rows[start+1] if len(rows) > start+1 else None
    return ticket, returned

def one_event(row, kind):
    chosen, = [event for event in row["observed"] if event["kind"] == kind]
    return chosen

proofs = []
for n, access_turn, answer_turn, expected, answer_id, view_ids in [(4,1,2,[2],0,[0,1,2]),(15,11,12,[0],3,[0,1,2,3])]:
    t_access, r_access = at(nominal, access_turn)
    t_answer, r_answer = at(nominal, answer_turn)
    t_select, r_select = at(nominal, answer_turn+1)
    t_view, r_view = at(nominal, n)
    access = one_event(r_access, "catalogue_field_input_observed")
    response = one_event(r_answer, "catalogue_response")
    view = one_event(r_view, "catalogue_observation")
    assert access["evidence"] == [t_access["ref"], r_access["ref"]] and access["structurePreserved"] and access["fieldChanged"]
    assert t_answer["mode"] == "answer" and t_answer["evidence"]["candidate"] == answer_id
    assert t_answer["owner"] == "public_occurrence_recall" and r_answer["matched"] is None
    assert response["palette"] == 8 and response["key"] == t_answer["key"] and not response["progress"]
    assert response["evidence"] == [t_answer["ref"], r_answer["ref"]]
    assert t_select["mode"] == "select" and t_select["palette"] == 9 and r_select["matched"] is True
    assert t_view["owner"] == "public_occurrence_recall" and t_view["offer"] == "catalogue_view_experiment"
    assert t_view["action"] == "ACTION3" and t_view["details"]["candidate_ids"] == view_ids
    assert t_view["details"]["evidence_refs"] == access["evidence"] and r_answer["ref"] not in access["evidence"]
    assert view["candidates"] == expected
    proofs.append({"answer": [t_answer,response], "access": access, "view": [t_view,view]})

n2, nr2 = at(no_answer, 2)
n3, nr3 = at(no_answer, 3)
t2, r2 = at(nominal, 2)
t3, r3 = at(nominal, 3)
t4, r4 = at(nominal, 4)
assert n2 == t2 and nr2["frame"] == r2["frame"] and nr2["ref"] == r2["ref"]
assert n3["point"] == t2["point"] and n3["mode"] == "answer" and nr3["changed"] == 0
assert no_access[:6] == nominal[:6]
other, other_return = at(no_access, 4)
assert other["ref"] == t4["ref"] and other["owner"] == "observed_frontier" and other["action"] == "ACTION4"
assert r4["changed"] == 39 and other_return["changed"] == 50
assert one_event(other_return, "catalogue_field_input_observed")["evidence"] == [other["ref"],other_return["ref"]]
assert at(no_answer_for_view, 4)[0] == t4
assert sum(r.get("offer") == "occluded_catalogue_experiment" for r in nominal) == 9
assert sum(r.get("offer") == "catalogue_view_experiment" for r in nominal) == 2
print(json.dumps({"sameSessions": len(gel), "occurrences":{"40":2,"54":9}, "contexts":proofs,
    "withdrawal54":[n3,nr3], "withdrawal40":[other,other_return]}, indent=2))
