"""Verify FT09's multi-window premise, rewrite prediction and alternate address."""
import argparse
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipt", type=Path)
parser.add_argument("hpdl_archive", type=Path)
args = parser.parse_args()
r = json.loads(args.receipt.read_bytes())
assert r["versions"]["qualification"] == "d0348ec1f1646259b9c95f0fa4a44dd0bb966025" and r["prefixes"] == 6
with ZipFile(args.hpdl_archive) as z:
    raw = z.read("qualification.json")
assert hashlib.sha256(raw).hexdigest() == r["versions"]["hpHash"]
assert r["versions"]["hpdl"] == json.loads(raw)["versions"]["qualification"]
t1, t2, t3, t4 = r["nominal"]
assert t1["pre"]["command"] == ["ACTION6", {"x": 38, "y": 38}]
assert t1["pre"]["plan"]["selected"]["expected_value"] is None and t1["after"]["matched"] is None
assert t2["pre"]["command"] == ["ACTION6", {"x": 38, "y": 46}] and t2["after"]["matched"] is None
assert t3["pre"]["command"] == ["ACTION6", {"x": 38, "y": 54}]
assert str(t3["pre"]["plan"]["selected"]["expected_value"]) == "8" and t3["after"]["matched"] is True
assert t4["after"]["levels"] == 1 and t4["after"]["record"]["result"]["status"] == "official_boundary_witness"
control = r["unSeulEffet"][0]
assert control["pre"]["command"] == t3["pre"]["command"] and control["after"]["packet"] == t3["after"]["packet"]
assert control["pre"]["plan"]["selected"]["expected_value"] is None and control["after"]["matched"] is None
assert len(control["pre"]["plan"]["selected_cells"]) == 1 and control["after"]["seal"]

single, resumed = r["uneFenetre"]
assert single["pre"]["ref"] == t1["pre"]["ref"] and single["pre"]["cut"]["offered"] is None
assert single["pre"]["command"] == ["ACTION6", {"x": 12, "y": 10}]
assert resumed["pre"]["command"] == t1["pre"]["command"]
alternative = r["sansAdresse"][0]
assert alternative["pre"]["ref"] == t1["pre"]["ref"]
assert alternative["pre"]["cut"]["pre"]["out"] == t1["pre"]["cut"]["pre"]["out"]
assert alternative["pre"]["command"] == t2["pre"]["command"]
assert alternative["after"]["record"]["result"]["address"] == [36, 44]
stationary, = r["stationnaire"]["steps"]
assert stationary["pre"] == t1["pre"] and stationary["after"]["packet"] == t1["after"]["packet"]
assert stationary["after"]["record"]["memory"]["effects"] == []
assert stationary["after"]["record"]["memory"]["rejected"] == ["36,36,9"]

print(json.dumps({
    "versions": r["versions"], "prefixes": r["prefixes"], "addresses": [t1["pre"]["command"], alternative["pre"]["command"]],
    "singleSourceFallback": single["pre"]["command"], "T3": {"sameCommand": True, "sameGamePacket": True,
       "expected": [t3["pre"]["plan"]["selected"]["expected_value"], None], "matched": [True, None]},
    "firstOfficialLevel": t4["after"]["levels"],
}, indent=2))
