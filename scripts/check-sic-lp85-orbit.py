"""Check the same LP85 click with different warranted plans and measured arrangements."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipts", type=Path)
args = parser.parse_args()
gel, proof, combined = [json.loads((args.receipts / (rev + ".json")).read_bytes())
                        for rev in ("d0e7527c", "80d14be1", "674b0dd1")]
assert gel == proof and len(gel) == len(combined) == 2
nominal, withdrawal = gel


def at(rows, kind, turn):
    return next(row for row in rows if row["kind"] == kind and row["turn"] == turn)


def learned(rows, turn):
    ref = at(rows, "return", turn)["ref"]
    return next(event for row in rows if row["kind"] == "return"
                for event in row["acquired"] if event["ref"] == ref)


assert nominal[:4] == withdrawal[:4]
t1 = at(nominal, "ticket", 1)
assert (t1["orbit"]["count"], t1["orbit"]["size"], t1["orbit"]["controls"]) == (20, 4, 2)
assert t1["orbit"]["operators"] == 0 and t1["orbit"]["expected"] is None
assert [learned(nominal, turn)["matches"] for turn in (1, 2)] == [1, 1]
t3, w3 = [at(rows, "ticket", 3) for rows in gel]
assert t3["point"] == w3["point"] == {"x": 5, "y": 32}
assert t3["ref"] == w3["ref"] and t3["orbit"]["values"] == w3["orbit"]["values"]
assert (t3["orbit"]["actions"], w3["orbit"]["actions"]) == (5, 1)
assert (t3["orbit"]["operators"], w3["orbit"]["operators"]) == (2, 1)
r1 = at(nominal, "return", 1)["ref"]
assert r1 in t3["refs"] and r1 not in w3["refs"]
r3, w3r = [at(rows, "return", 3) for rows in gel]
assert r3["packet"] == w3r["packet"] and r3["values"] == w3r["values"] == t3["orbit"]["expected"]
assert r3["matched"] is True and w3r["matched"] is None and w3["orbit"]["expected"] is None
assert at(withdrawal, "ticket", 4)["orbit"]["operators"] == 2
assert w3r["ref"] in at(withdrawal, "ticket", 4)["refs"]
denied = [entry for entry in at(nominal, "ticket", 4)["guards"] if not entry["admitted"]]
assert denied and denied[0]["reason"] == "compare_frozen_positions_contents_and_control"
assert at(nominal, "return", 7)["levels"] == 1
t8 = at(nominal, "ticket", 8)
assert t8["level"] == 2 and (t8["orbit"]["count"], t8["orbit"]["size"], t8["orbit"]["controls"]) == (42, 2, 6)
t15, t16, t17 = [at(nominal, "ticket", turn) for turn in (15, 16, 17)]
assert learned(nominal, 15)["matches"] > 1 and learned(nominal, 16)["matches"] == 1
assert t15["orbit"]["values"] != t16["orbit"]["values"] and t16["orbit"]["expected"] is None
assert t17["orbit"]["operators"] == 3

print(json.dumps({
    "equalScenarios": len(gel), "assembledEqual": gel == combined,
    "sameT3Command": t3["point"], "T3Plans": [5, 1], "actualArrangement": r3["values"],
    "T3Observed": [r3["matched"], w3r["matched"]],
    "nextLevel": [learned(nominal, turn) for turn in (15, 16)],
}, indent=2))
