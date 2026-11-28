"""Check DAME's physical reduction and TR87's typed derivation in their native receipts."""

import argparse
import json
from pathlib import Path


def dame(g):
    steps = g["nominal"]["steps"]
    selection, capture, first_plan = steps[:3]
    selected = selection["after"]["record"]
    invitation, = selected["result"]["events"]
    assert invitation["invitations"] == [[0, 2], [4, 2]]
    assert selected["after"]["population"] == selection["pre"]["cut"]["pre"]["scene"]["population"]
    assert selected["state"]["relations"] == {}
    assert g["une-invitation"]["next"]["command"] == ["ACTION6", {"x": 45, "y": 33}]
    assert g["sans-invitation"]["next"]["command"] == ["ACTION6", {"x": 24, "y": 26}]
    observed = capture["after"]["record"]
    reduced, = observed["result"]["events"]
    assert reduced["kind"] == "observed_consumed_intermediate" and reduced["relation"] == [[-1, 1], [-2, 2]]
    assert len(observed["before"]["population"]) == 5 and len(observed["after"]["population"]) == 4
    variant = g["victime-preservee"]["steps"][1]["after"]
    assert variant["packet"] == capture["after"]["packet"]
    assert len(variant["record"]["after"]["population"]) == 5 and variant["record"]["state"]["relations"] == {}
    assert capture["after"]["ref"] in first_plan["pre"]["evidence"]
    assert first_plan["pre"]["plan"]["states"] == 8 and first_plan["after"]["matched"]
    second_level = steps[7]["pre"]
    learned = first_plan["pre"]["cut"]["pre"]["memory"]["relations"]
    retained = second_level["cut"]["pre"]["memory"]["relations"]
    key, = learned
    assert learned[key] == [reduced["relation"]] and reduced["relation"] in retained[key]
    assert second_level["plan"]["states"] == 33 and len(second_level["plan"]["steps"]) == 8
    assert steps[8]["after"]["matched"] and steps[6]["after"]["levels"] == 1 and steps[14]["after"]["levels"] == 2
    return {"nominalTickets": len(steps), "firstInvitations": invitation["invitations"],
            "physicalReduction": [5, 4], "samePacketWithoutIntermediateRemoval": True, "secondLevelSearchStates": 33,
            "reusedSameRankRelation": reduced["relation"],
            "officialBoundaries": [7, 15]}


def tr87(g):
    steps = g["nominal"]["steps"]
    first = steps[0]
    scene = first["pre"]["cut"]["pre"]["scene"]
    assert scene["rules"] == 6 and scene["derivations"] == 1 and len(scene["target"]) == 5
    assert first["pre"]["plan"]["expected"] is None and first["pre"]["command"] == ["ACTION1", {}]
    result = first["after"]["record"]
    assert result["event"]["status"] == "local_glyph_rewrite" and result["measured"][1] == 0
    assert result["measured"][0][0] != first["pre"]["plan"]["before"][0][0]
    assert result["measured"][0][1:] == first["pre"]["plan"]["before"][0][1:]
    absent = g["sans-types"]["steps"][0]
    assert g["sans-types"]["cuts"][0]["pre"]["scene"] is None and absent["pre"]["family"] != "word_interface"
    assert absent["pre"]["command"] == first["pre"]["command"] and absent["after"]["packet"] == first["after"]["packet"]
    assert g["type-temoin"]["steps"][0]["pre"]["cut"]["pre"]["scene"]["target"] == scene["target"]
    still = g["stationnaire"]["steps"][0]
    assert still["after"]["packet"] == first["after"]["packet"]
    assert still["after"]["record"]["native"]["edits"] == [] and still["after"]["record"]["native"]["directions"] == []
    assert steps[8]["after"]["record"]["event"]["status"] == "cursor_step"
    route = steps[9]["pre"]["plan"]["path"]
    assert len(route) == 7 and all(t["after"]["matched"] and t["pre"]["plan"]["path"] == route for t in steps[9:])
    assert steps[-1]["after"]["levels"] == 0
    return {"nominalTickets": len(steps), "sourceGlyphs": len(scene["target"]), "derivations": scene["derivations"],
            "sameActionWithoutRule": True, "confirmedEditsAndMoves": len(route), "officialLevels": 0}


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("game", choices=("DAME", "TR87"))
parser.add_argument("receipt", type=Path)
args = parser.parse_args()
data = json.loads(args.receipt.read_bytes())
quoted = {"DAME": ("775f40c5505add040d3b1c1aac5aba8d0dd0a027", 5), "TR87": ("c41c028c2ed06244715bad39024f542d44f8eda0", 6)}
assert (data["versions"]["qualification"], data["prefixes"]) == quoted[args.game]
summary = {"DAME": dame, "TR87": tr87}[args.game](data["native"])
print(json.dumps({"versions": data["versions"], "nativePrefixes": data["prefixes"], **summary}, indent=2))
