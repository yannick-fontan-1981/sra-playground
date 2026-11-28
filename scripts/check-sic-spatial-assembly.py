"""Check VOIS assignment and THER quota constraints without conflating their returns."""

import argparse
import json
from pathlib import Path


def vois(r):
    g = r["native"]
    nominal = g["nominal"]["steps"]
    assert len(nominal) == 16
    a = nominal[0]["pre"]
    original = a["cut"]["pre"]["scene"]
    shifted = g["reference-deplacee"]["cuts"][0]["pre"]["scene"]
    assert original["bodies"] == shifted["bodies"] and original["population"] == shifted["population"] == 2
    assert [t[:2] for t in original["target"]] == [[5, 6], [5, 7]]
    assert [t[:2] for t in shifted["target"]] == [[5, 7], [6, 6]]
    assert a["plan"]["chosen"] == [5, 3] and not a["plan"]["complete"]
    shifted_ticket = g["reference-deplacee"]["steps"][0]["pre"]
    assert shifted_ticket["plan"]["chosen"] == [5, 10] and shifted_ticket["command"] == ["ACTION6", {"x": 43, "y": 23}]
    deleted = g["reference-retiree"]
    surplus = deleted["cuts"][0]["pre"]["surplus"]
    assert surplus["bodies"] == original["bodies"] and len(surplus["target"]) == 1
    assert deleted["steps"][0]["pre"]["plan"] is None

    first_move = nominal[1]["after"]["record"]["event"]
    assert first_move["active"] == [4, 3] and first_move["controls"]["ACTION1"]["delta"] == [-1, 0]
    assert not g["stationnaire"]["steps"][1]["after"]["record"]["event"]["controls"]
    assert all(s["pre"]["plan"]["complete"] and s["after"]["matched"] for s in nominal[5:8])
    assert nominal[7]["after"]["record"]["event"]["active"] == [5, 6]
    bad = g["reference-changee"]
    assert bad["steps"][5]["after"]["packet"] == nominal[5]["after"]["packet"]
    assert bad["steps"][5]["after"]["matched"] is False and bad["stop"] == "frontier_unknown"
    assert bad["cuts"][-1]["local"]["reason"] == "current_reference_population_revalidation_missing"
    assert nominal[13]["after"]["levels"] == 1 and nominal[14]["pre"]["cut"]["pre"]["scene"]["population"] == 4
    n2 = nominal[15]["after"]["record"]["event"]
    assert n2["active"] == [6, 9] and n2["controls"]["ACTION1"]["delta"] == [-1, 0]
    return {"nativePrefixes": 6, "nominalTickets": len(nominal), "firstMatching": 6, "firstArrival": 8,
            "movedSquareSelects": shifted_ticket["command"], "noAssignmentForSurplus": True, "secondLevelPopulation": 4}


def ther(r):
    g = r["native"]
    nominal = g["nominal"]["steps"]
    add, cut, projection = (nominal[i]["after"] for i in range(3))
    added, removed = (s["record"]["event"] for s in (add, cut))
    assert added["context"]["lengths"] == [3, 0, 0] and added["model"]["addition"] and not added["model"]["cut"]
    assert removed["context"]["lengths"] == [1, 0, 0] and removed["model"]["addition"] and removed["model"]["cut"]
    for name, length, refusal in (
        ("stationnaire", [0, 0, 0], "indexed_edit_response_not_supported"),
        ("soeur-modifiee", [3, 1, 0], "indexed_edit_owner_or_prefix_refuted"),
    ):
        observed = g[name]["steps"][0]["after"]
        assert observed["packet"] == add["packet"]
        e = observed["record"]["event"]
        assert e["context"]["lengths"] == length and e["stop"] == refusal and not e["model"]["addition"]
    assert nominal[2]["pre"]["plan"]["desired"] == [[1], [2], [1]]
    assert projection["matched"] and not projection["seal"]
    assert [s["i"] for s in nominal if s["after"]["levels"] > 0 and s["after"]["levels"] >
            nominal[s["i"] - 2]["after"]["levels"]] == [4, 7, 11, 15]
    historical, changed = (r["archive"][name] for name in ("nominal", "control"))
    assert historical["marks"] == [[3, 3, 4, 3, 1], [2, 3, 4, 3, 2]]
    assert historical["domains"] == [[4], [0], [1], [3], [3], [3]]
    assert historical["actions"][0] == {"action_ref": "ACTION6", "data": {"x": 19, "y": 26}}
    assert changed["marks"] == [[3, 3, 4, 3, 2], [2, 3, 4, 3, 2]]
    assert changed["cause"] == "EMPTY_DOMAIN_CONTRADICTION" and changed["refusal"] == "conditional_prefix_marginals_not_singleton"
    return {"nativePrefixes": 4, "nominalTickets": len(nominal), "additionLength": [3, 0, 0], "cutLength": [1, 0, 0],
            "firstProjection": [[1], [2], [1]], "v42N5ChangedMark": changed["edited"], "v42Refusal": changed["refusal"]}


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("game", choices=("VOIS", "THER"))
parser.add_argument("receipt", type=Path)
args = parser.parse_args()
data = json.loads(args.receipt.read_bytes())
expected = {"VOIS": "1391bd741ad11addfce68370db8969cd3d37b6b0", "THER": "dc9314cc1ebdfc4ac4888d5ad0e7bfa0fb62542f"}
assert data["versions"]["qualification"] == expected[args.game]
result = {"VOIS": vois, "THER": ther}[args.game](data)
assert data["prefixes"] == result["nativePrefixes"]
print(json.dumps({"versions": data["versions"], **result}, indent=2))
