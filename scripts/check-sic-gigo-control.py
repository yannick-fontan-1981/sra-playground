"""Separate GIGO's mixed effect and stop from VALV's continued field offers."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipts", type=Path)
args = parser.parse_args()
gel, proof = [json.loads((args.receipts / (rev + ".json")).read_bytes()) for rev in ("d0e7527c", "b2eef226")]
assert gel == proof and len(gel) == 5
nominal, same_state, tied, stationary, valv = gel


def at(rows, kind, turn):
    return next(row for row in rows if row["kind"] == kind and row["turn"] == turn)


d, r = [at(nominal, kind, 1) for kind in ("ticket", "return")]
assert at(same_state, "ticket", 1) == d
assert (d["offer"], d["action"], d["point"], d["expected"]) == ("nested_control_experiment", "ACTION6", {"x": 26, "y": 20}, "unknown")
assert (d["box"], d["area"], d["palette"], d["alternatives"]) == ([24, 18, 29, 23], 16, 5, [])
assert d["guard"] == "current_nested_core_exact_point"
response, = r["acquired"]
assert response["kind"] == "nested_control_response" and response["refs"] == [d["ref"], r["ref"]]
assert (response["pixels"], response["local"], response["remote"], response["official"]) == (420, 20, 400, False)
assert r["matched"] is None and r["levels"] == 0
assert nominal[-1]["reason"] == "nested_control_effect_requires_composition" and nominal[-1]["kind"] != "ticket"
assert not any(row.get("offer") == "nested_control_experiment" for row in tied)
assert [offer for row in tied for offer in row.get("offers", [])] and not any(offer for row in tied for offer in row.get("offers", []))

assert at(stationary, "ticket", 1) == d
negative, = at(stationary, "return", 1)["acquired"]
assert (negative["disposition"], negative["pixels"], negative["selection"], negative["impossibility"]) == (
    "local_no_visible_effect", 0, False, False)
assert at(stationary, "ticket", 2)["owner"] == "observed_frontier"
vd, vr = [at(valv, kind, 1) for kind in ("ticket", "return")]
assert vd["offer"] == d["offer"] and vd["guard"] == d["guard"]
local, context = vr["acquired"]
assert (local["pixels"], local["local"], local["remote"], context["kind"]) == (72, 0, 72, "envelope_fill_context")
assert [at(valv, "ticket", n)["offer"] for n in (2, 5, 11, 12)] == [
    "envelope_fill_experiment", "field_service_experiment", "field_service_transfer_experiment", "field_service_transfer_experiment"]

print(json.dumps({
    "equalScenarios": len(gel), "GIGO": response, "GIGOstop": nominal[-1]["reason"],
    "syntheticUnchanged": negative, "VALV": local, "VALVnext": at(valv, "ticket", 2)["offer"],
}, indent=2))
