"""Reconcile the WA30 service decisions with the physical returns around both contact offers."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipts", type=Path)
args = parser.parse_args()
def load(sha):
    return json.loads((args.receipts / (sha + ".json")).read_bytes())
gel, candidate = load("d0e7527c"), load("14a185d9")
assert len(gel) == 4 and len(candidate) == 7

common = [0, 1, 3, 4]
for index, session in zip(common, gel):
    assert candidate[index] == session, index
nominal, stationary, withdrawn26, extended, withheld31, substitute31, withdrawn31 = candidate

def turn(rows, n):
    ticket, returned = rows[2*(n-1):2*n]
    assert ticket["kind"] == "ticket" and returned["kind"] == "return" and ticket["turn"] == returned["turn"] == n
    return ticket, returned

def events(row, kind):
    return [event for event in row["acquisitions"] if event["kind"] == kind]

t3, r3 = turn(nominal, 3)
t4, r4 = turn(nominal, 4)
_, r2 = turn(nominal, 2)
invitation, = events(r2, "front_contour_invitation")
assert invitation["evidence"] in t3["proof"]
assert (t3["owner"], t3["action"], r3["matched"], r3["changed"]) == ("oriented_coupling", "ACTION5", None, 12)
assert events(r3, "visible_relation_change_candidate") and not events(r3, "public_rigid_pair_translation")
assert r4["changed"] == 44 and r4["matched"] is True
translation, = events(r4, "public_rigid_pair_translation")
assert translation["delta"] == [0, -1] and translation["evidence"] == r4["ref"]
# The stationary arm reuses archived input packets without the optional live palette.
def decisions_and_measures(rows):
    return [{key: value for key, value in row.items() if key != "packet"} for row in rows]
assert decisions_and_measures(stationary[:5]) == decisions_and_measures(nominal[:5])
assert stationary[5]["changed"] == 0
assert not events(stationary[5], "visible_relation_change_candidate")
assert withdrawn26[:4] == nominal[:4] and withdrawn26[4]["ref"] == t3["ref"]
assert withdrawn26[4]["owner"] == "observed_frontier" and withdrawn26[5]["changed"] == 0
assert withdrawn26[6]["action"] == "ACTION5" and withdrawn26[6]["owner"] == "oriented_coupling"

def prove_trial(ticket, returned, site):
    event, = events(returned, "pre_score_effect_contact")
    assert (ticket["owner"], ticket["site"], ticket["expected"], returned["matched"]) == ("pre_score_contact", site, None, None)
    assert (event["before"], event["after"], event["trial"], event["action"]) == (
        ticket["ref"], returned["ref"], ticket["trial"], ticket["action"])
    assert event["expected"] == event["matched"] == [] and event["scoreDelta"] == 0
    return event

t16, r16 = turn(extended, 16)
t17, r17 = turn(extended, 17)
a16, ar16 = turn(substitute31, 16)
f16, fr16 = turn(withdrawn31, 16)
assert substitute31[:30] == withdrawn31[:30] == extended[:30]
assert a16["ref"] == f16["ref"] == t16["ref"]
assert r16["changed"] == 0 and r17["changed"] == 44
assert prove_trial(t16, r16, [36,29])["vector"] == [0,-4]
assert prove_trial(t17, r17, [32,33])["vector"] == [-4,0]
assert prove_trial(a16, ar16, [32,33])["vector"] == [-4,0]
assert a16["action"] == f16["action"] == "ACTION3" and a16["point"] == f16["point"]
assert ar16["changed"] == fr16["changed"] == 44 and ar16["packet"] == fr16["packet"]
assert f16["owner"] == fr16["owner"] == "oriented_coupling" and not events(fr16, "pre_score_effect_contact")
assert withheld31[32]["site"] == [36,29] and withheld31[31]["ref"] == r16["ref"]
# The producer emits the receipt. The test disables applyEvent for this kind,
# and the repeated site at T17 exposes the missing uptake.
assert prove_trial(withheld31[30], withheld31[31], [36,29]) == events(r16, "pre_score_effect_contact")[0]
assert withheld31[32]["trial"] == t16["trial"]
assert substitute31[32]["owner"] == withdrawn31[32]["owner"] == "oriented_coupling"
assert sum(r.get("owner") == "oriented_coupling" for r in nominal if r["kind"] == "ticket") == 13
assert sum(r.get("owner") == "pre_score_contact" for r in nominal if r["kind"] == "ticket") == 1
print(json.dumps({"line26": {"invitation": invitation, "interaction": t3, "translation": translation, "catalogueOccurrences": 13},
    "line31": {"nominal": [t16,r16,t17,r17], "substitution": [a16,ar16], "withdrawal": [f16,fr16],
    "samePhysicalPacket": ar16["packet"], "catalogueOccurrences": 1}, "commonSessions": len(gel)}, indent=2))
