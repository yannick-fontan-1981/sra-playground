"""Check selection, temporal returns, and panel remeasurement separately from official progress."""

import argparse
import json
from pathlib import Path


def sele(runs):
    nominal = runs["nominal"]["steps"]
    select, launch, change = (nominal[i - 1] for i in (1, 4, 10))
    affected = select["after"]["record"]["affected"]
    assert [v[1] for v in affected] == [[30, 24]]
    assert select["after"]["record"]["step"]["selection_witness"]["kind"] == "single_cochanged_support"
    assert runs["stationnaire"]["steps"][0]["after"]["record"]["state"]["bindings"] == {}
    assert runs["stationnaire"]["next"]["command"] == ["ACTION3", {}]
    real = launch["after"]["record"]["packet"]
    short = runs["sans-trames-4"]["steps"][3]["after"]
    assert short["packet"] == launch["after"]["packet"] and real["detail"]["canonicalSame"]
    assert real["count"] == 16 and real["memory"]["launch"] == "ACTION5"
    assert [(v["body_ref"], v["frame_interval"]) for v in real["detail"]["received"]] == [(affected[0][0], [8, 13])]
    assert nominal[4]["pre"]["command"] == ["ACTION3", {}]
    assert short["record"]["packet"]["count"] == 1 and short["record"]["packet"]["memory"]["launch"] is None
    assert runs["sans-trames-4"]["next"]["command"] == ["ACTION6", {"x": 10, "y": 61}]

    changed = change["after"]["record"]
    control = runs["decoration"]["steps"][9]["after"]
    assert changed["affected"] == control["record"]["affected"]
    assert change["after"]["packet"] == control["packet"]
    assert changed["step"]["selection_witness"]["kind"] == "reciprocal_center_decoration_replacement"
    assert control["record"]["step"]["selection_witness"]["kind"] == "cochange_without_reciprocal_decoration"
    assert runs["decoration"]["next"]["command"] == ["ACTION6", {"x": 43, "y": 52}]

    full = runs["long"]["steps"][17]["after"]
    truncated = runs["sans-trames-18"]["steps"][17]["after"]
    assert full["packet"] == truncated["packet"] and full["levels"] == truncated["levels"] == 2
    assert [v["frame_interval"] for v in full["record"]["packet"]["detail"]["received"]] == [[5, 9], [12, 15]]
    assert full["record"]["packet"]["count"] == 25 and not truncated["record"]["packet"]["accepted"]
    return {"nominalTickets": len(nominal), "firstAcquiredFront": [8, 13], "secondContext": {"turn": 18,
            "orderedFronts": [[5, 9], [12, 15]], "levelsWithFinalFrameOnly": 2}}


def rswp(runs):
    nominal = runs["nominal"]["steps"]
    assert len(nominal) == 16
    apply1, next1, apply2, next2 = (nominal[i - 1] for i in (7, 8, 15, 16))
    for application, chosen, condition, material_before, material_after, levels in (
        (apply1, next1, "relation8", [15, 12, 13], [12, 13, 15], 1),
        (apply2, next2, "relation16", [13, 15, 12], [13, 15, 12], 2),
    ):
        after = application["after"]
        assert application["pre"]["command"] == ["ACTION5", {}] and after["levels"] == levels
        assert after["record"]["detail"]["score_delta"] == 0
        result = after["record"]
        assert [x["room"]["changed"] for x in result["physical"]] == [21, 21, 21]
        assert [v["material"] for v in result["before"]] == material_before
        assert [v["material"] for v in result["after"]] == material_after
        assert chosen["pre"]["cut"]["pre"]["fields"] == result["after"]
        assert chosen["pre"]["command"] == ["ACTION6", {"x": 45, "y": 12}]
        lost = runs[condition]
        assert lost["lastCut"]["pre"]["hash"] == chosen["pre"]["cut"]["pre"]["hash"]
        assert lost["lastCut"]["pre"]["samePanels"] and lost["lastCut"]["result"]["blocking"]
        assert lost["lastCut"]["result"]["reason"] == "panel_service_correspondence_unresolved"
        assert lost["stop"] == "frontier_unknown" and lost["next"] is None
    effects = runs["effets"]["next"]
    planned = next1["pre"]
    assert effects["cut"]["pre"]["used"]["effects"] == []
    assert effects["cut"]["pre"]["used"]["effects"] != planned["cut"]["pre"]["used"]["effects"]
    assert effects["plan"]["contributions"] == planned["plan"]["contributions"]
    assert effects["command"] == planned["command"]
    return {"nominalTickets": len(nominal), "pixelsChangedPerRoom": [21, 21, 21],
            "remeasuredAt": [8, 16], "withoutEffectsAt8": effects["command"], "missingRelationBlocks": [8, 16]}


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("game", choices=("SELE", "RSWP"))
parser.add_argument("receipt", type=Path)
args = parser.parse_args()
data = json.loads(args.receipt.read_bytes())
expected = {"SELE": "77df94e33aa8bae8ecc7f81c8b57e062943dffa6", "RSWP": "f3051af812f4f7f74f0179a804a87753bffa5910"}
assert data["versions"]["qualification"] == expected[args.game]
assert data["prefixes"] == 7
summary = {"SELE": sele, "RSWP": rswp}[args.game](data["native"])
print(json.dumps({"versions": data["versions"], "prefixes": data["prefixes"], **summary}, indent=2))
