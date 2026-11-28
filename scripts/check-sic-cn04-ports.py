"""Check CN04 compatibility, reachability and contact before the official boundary."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipts", type=Path)
args = parser.parse_args()


def load(name):
    return json.loads((args.receipts / (name + ".json")).read_bytes())


gel, proof, combined = (load(name) for name in ("d0e7527c", "bfba3acb", "674b0dd1"))
assert gel == proof and len(gel) == len(combined) == 1
rows, = gel


def at(kind, turn):
    return next(row for row in rows if row["kind"] == kind and row["turn"] == turn)


t1, r1 = [at(kind, 1) for kind in ("ticket", "return")]
assert t1["action"] == "ACTION1" and t1["mode"] == "calibrate" and t1["expected"] is None
event = next(e for e in r1["acquired"] if e["ref"] == r1["ref"])
assert (event["status"], event["poses"], event["up"]) == ("pose_measured", [[0, 3, 2], [0, 12, 9]], [0, -1])
t5, t8 = [at("ticket", turn) for turn in (5, 8)]
assert t5["goal"] == [[3, 7, 10], [0, 12, 9]] and t5["expected"] is None
assert t5["route"]["compatible"] is True and t5["route"]["path"] is None
assert all(at("ticket", turn)["action"] == "ACTION5" and at("ticket", turn)["mode"] == "rotate" for turn in (5, 6, 7))
assert t8["route"]["path"] == ["ACTION2"] * 7 + ["ACTION4"] * 4
assert t8["route"]["withoutDown"] is None
assert any(not g["admitted"] and g["reason"] == "compare_joint_material_occupancy_and_epoch" for g in t8["guards"])

r17, r18 = [at("return", turn) for turn in (17, 18)]
assert r17["matched"] is True and r17["levels"] == 0
assert r17["contact"]["frames"][-1] == [False, [8, 8]]
assert r18["contact"]["points"] == [[12, 11], [12, 13]]
assert r18["contact"]["frames"] == [[True, [3, 3]], [True, [3, 3]], [False, [12, 12]]]
assert r18["matched"] is None and r18["levels"] == 1 and r18["reason"] == "official_boundary"
assert any(e["ref"] == r18["ref"] and e["status"] == "official_boundary" for e in r18["acquired"])
assert (at("ticket", 19)["level"], at("ticket", 19)["mode"], at("ticket", 19)["ports"]) == (2, "calibrate", [2, 4, 4, 2])
catalogue, = load("catalogue")["games"]
assert catalogue["count"] == catalogue["observed"] == 16 and catalogue["levels"] == 0
assert all(row["proposal"] == "rigid_port_assembly" for row in catalogue["rows"])

print(json.dumps({
    "equalScenarios": len(gel), "assembledEqual": gel == combined,
    "compatibilityBeforeRotation": t5["route"], "routeAfterRotation": t8["route"],
    "T17": r17["contact"], "T18": r18["contact"], "officialTurn": 18,
    "catalogue": [catalogue["count"], len(catalogue["rows"])],
}, indent=2))
