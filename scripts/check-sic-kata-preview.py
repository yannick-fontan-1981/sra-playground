"""Verify KATA's preview evidence, reuse of control and game boundaries."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipts", type=Path)
args = parser.parse_args()


def load(name):
    return json.loads((args.receipts / (name + ".json")).read_bytes())


gel, proof = load("d0e7527c"), load("d22d706c")
assert gel == proof and len(gel) == 3
nominal, preview_missing, controls_missing = gel


def at(rows, kind, turn):
    return next(row for row in rows if row["kind"] == kind and row["turn"] == turn)


def acquired(rows, turn):
    ref = at(rows, "return", turn)["ref"]
    return next(event for row in rows if row["kind"] == "return"
                for event in row["acquired"] if event["after"] == ref)


def ticket(rows, turn):
    return at(rows, "ticket", turn)


t1 = ticket(nominal, 1)
assert (t1["mode"], t1["target"], t1["selected"], t1["previewColor"]) == ("select", [0, 1], None, None)
first = acquired(nominal, 1)
assert first["selection"] is True and (first["selected"], first["previewColor"]) == ("piece:2", 0)
assert preview_missing[0] == t1 and acquired(preview_missing, 1)["selection"] is False
assert ticket(preview_missing, 2)["mode"] == "select" and ticket(preview_missing, 2)["point"] == t1["point"]

assert acquired(nominal, 2)["controls"] == {}
assert acquired(nominal, 5)["controls"]["ACTION3"] == {
    "kind": "translation", "delta": [0, -1], "evidence": [acquired(nominal, 4)["after"], acquired(nominal, 5)["after"]],
}
t18, alternate = ticket(nominal, 18), ticket(controls_missing, 18)
for key in ("ref", "selected", "previewColor"):
    assert t18[key] == alternate[key]
assert t18["level"] == 3 and t18["action"] == "ACTION2" and t18["expected"] == [1, 6]
assert acquired(nominal, 17)["after"] in t18["refs"]
assert "expected" not in alternate and alternate["action"] == "ACTION1"
assert acquired(controls_missing, 18)["pose"] == [0, 6]
assert ticket(controls_missing, 19)["action"] == "ACTION2" and ticket(controls_missing, 19)["expected"] == [1, 6]
assert at(controls_missing, "return", 19)["matched"] is True

placed = next(piece for piece in acquired(nominal, 25)["pieces"] if piece["id"] == "piece:2")
assert placed["anchor"] == [2, 0] and ticket(nominal, 26)["chosen"] == "piece:3"
assert [at(nominal, "return", turn)["levels"] for turn in (8, 16, 33)] == [1, 2, 3]
catalogue, = load("catalogue")["games"]
assert catalogue["count"] == catalogue["observed"] == len(catalogue["trace"]) == 16
assert catalogue["levels"] == 2 and [json.loads(key) for key in catalogue["keys"]] == [
    ["preview_packing", "preview_packing", None, "preview_packing"],
]
for turn, entry in enumerate(catalogue["trace"], 1):
    command = ticket(nominal, turn)
    assert "ACTION" + str(entry["action"]["id"]) == command["action"]
    assert entry["action"].get("data", {}) == command["point"]

print(json.dumps({
    "equalScenarios": len(gel), "catalogue": [catalogue["count"], catalogue["levels"]],
    "firstTarget": t1, "firstAcquisition": first, "noPreview": acquired(preview_missing, 1),
    "thirdLevel": {"nominal": t18, "controlsWithdrawn": alternate, "resumed": ticket(controls_missing, 19)},
    "nextMember": ticket(nominal, 26), "officialTurns": [8, 16, 33],
}, indent=2))
