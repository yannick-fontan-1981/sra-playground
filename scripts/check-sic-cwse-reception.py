"""Check the same-action CWSE intervention and its shared binding with CATR."""
import argparse
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipt", type=Path)
parser.add_argument("catr_archive", type=Path)
args = parser.parse_args()
r = json.loads(args.receipt.read_bytes())
assert r["versions"]["qualification"] == "71e15295d2fd38996147a524e4b0cd63e2991cc5" and r["prefixes"] == 5
with ZipFile(args.catr_archive) as z:
    catr_bytes = z.read("qualification.json")
catr = json.loads(catr_bytes)
assert r["versions"]["catr"] == catr["versions"]["qualification"]
assert r["versions"]["catrSHA"] == hashlib.sha256(catr_bytes).hexdigest()

t1, t2 = r["premier"], r["acces"]
assert t1["pre"]["command"] == "ACTION4" and t1["pre"]["plan"]["kind"] == "control_question"
assert t1["pre"]["plan"]["expected"] is None and t1["after"]["matched"] is None
vector = t1["after"]["record"]["controls"]["ACTION4"]
assert vector == {"delta": [1, 0], "evidence": [t1["pre"]["ref"], t1["after"]["ref"]]}
assert t2["pre"]["cut"]["before"]["controls"]["ACTION4"] == vector
assert t2["pre"]["plan"]["kind"] == "access" and t2["pre"]["plan"]["expected"]["actor"] == [3, 2]
assert t2["after"]["matched"] is False and t2["after"]["seal"]

control, reprise = r["sansEffet"][:2]
assert control["pre"]["cut"]["removed"] == {"action": "ACTION4", **vector}
assert control["pre"]["cut"]["search"] == t2["pre"]["cut"]["search"]
assert control["pre"]["command"] == t2["pre"]["command"] == "ACTION4"
assert control["pre"]["plan"]["kind"] == "control_question" and control["pre"]["plan"]["expected"] is None
assert control["after"]["matched"] is None and control["after"]["packet"] == t2["after"]["packet"]
assert reprise["pre"]["plan"]["kind"] == "exposure_question"

access = r["suiteN3"]
search = access[0]["pre"]["cut"]["search"]
assert (search["reason"], search["nodes"], search["pathLength"]) == ("reception_search_node_bound", 8000, 8)
assert [row["pre"]["command"] for row in access] == ["ACTION2", "ACTION1", "ACTION4", "ACTION1"]
assert all(row["after"]["matched"] is True and row["after"]["levels"] == 2 for row in access)

catr_guard, cwse_guard = [r["enveloppes"][game]["envelope"] for game in ("catr", "cwse")]
assert catr_guard == catr["nominal"][0]["issued"]["envelope"]
assert cwse_guard == t1["pre"]["envelope"]
assert sorted(catr_guard["expected"]) == sorted(cwse_guard["expected"]) == ["frame_hash", "level_epoch", "levels_completed", "state"]
assert catr_guard["point"] == [[31, 47], 12] and cwse_guard["point"] is None
assert catr_guard["foreign"]["reason"] == "relation_binding_changed"
assert cwse_guard["foreign"]["reason"] == "reception_binding_changed"
print(json.dumps({
    "versions": r["versions"], "prefixes": r["prefixes"], "vector": vector,
    "sameT2Command": t2["pre"]["command"], "T2Decision": [t2["pre"]["plan"]["kind"], control["pre"]["plan"]["kind"]],
    "T2Returns": [t2["after"]["matched"], control["after"]["matched"]], "partialN3": search["pathLength"],
    "executedN3": len(access), "sharedBinding": sorted(cwse_guard["expected"]),
}, indent=2))
