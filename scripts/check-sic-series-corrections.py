"""Check WEAV's sealed crossing and COMB's scoped refutation in native receipts."""

import argparse
import json
from pathlib import Path


def weav(r):
    assert r["versions"]["qualification"] == "b01ca9bfde92510eb622a105e1f1470c796dc8e0"
    c, g = r["candidate"], r["gel"]
    seq = c["nominal"]["steps"]
    pair = seq[4]["after"]["record"]
    assert pair["comparison"]["reference_property_matched"] and pair["witness"] == pair["pairDigest"]
    assert pair["pair"]["evidence"] == [seq[4]["pre"]["ref"], seq[4]["after"]["ref"]]
    assert pair["pair"]["inputs"] == {"0": "ACTION1", "1": "ACTION3"}
    before = seq[6]["pre"]
    assert before["plan"]["pair"] == pair["pair"] and before["command"] == ["ACTION1", {}]
    assert before["scope"]["live"]["admitted"] and not before["scope"]["stale"]["admitted"]
    assert len(seq) == len(g["nominal"]["steps"]) == 16
    assert [s["after"]["packet"] for s in seq] == [s["after"]["packet"] for s in g["nominal"]["steps"]]
    stale = g["wrong"]["steps"][6]
    assert stale["pre"]["plan"]["pair"]["evidence"][0] == seq[1]["after"]["ref"]
    assert stale["pre"]["command"] == before["command"] and stale["after"]["packet"] == seq[6]["after"]["packet"]
    variations = ("ancienne-reference", "journal-altere", "sans-paire", "sans-recu")
    for name in variations:
        replay = c[name]["steps"]
        assert replay[:6] == seq[:6]
        pre, post = replay[6]["pre"], replay[6]["after"]
        assert pre["cut"]["pre"]["raster"] == before["cut"]["pre"]["raster"]
        assert pre["plan"] is None and pre["family"] == "information_goal"
        assert pre["command"] == ["ACTION6", {"x": 28, "y": 61}] and post["packet"]
    assert c["journal-intact"]["steps"] == seq[:7]
    assert r["firstDifference"] == 7 and r["firstSecondEpochUse"] is None
    return {"nominalTickets": len(seq), "nativePrefixes": 2 + len(c), "firstDifference": 7,
            "rejectedAlterations": variations, "staleScopeRejected": True,
            "newEpochStorageTurn": r["afterBoundary"], "newEpochUse": None}


def comb(r):
    assert r["versions"]["qualification"] == "24e9743683b22b2256104d9f4de2c84abb1a1de3"
    c, g = r["candidate"], r["gel"]
    nominal = c["nominal"]["steps"]
    assert len(nominal) == len(g["nominal"]["steps"]) == 16
    assert [s["after"]["packet"] for s in nominal] == [s["after"]["packet"] for s in g["nominal"]["steps"]]
    contrasts = (("contradiction-n1", "n1", 2, ["ACTION1", {}]),
                 ("contradiction-n2", "n2", 8, ["ACTION6", {"x": 45, "y": 20}]))
    for name, arm, index, fallback in contrasts:
        old, new = g[arm]["steps"][index]["pre"], c["runs"][name]["steps"][index]["pre"]
        assert old["plan"]["compiled"] and new["plan"] is None
        assert old["cut"]["pre"]["hash"] == new["cut"]["pre"]["hash"]
        assert old["cut"]["pre"]["used"]["counterexamples"] == new["cut"]["pre"]["used"]["counterexamples"]
        assert new["cut"]["result"]["reason"] == "factor_product_independence_refuted_in_current_scope"
        assert new["command"] == fallback
    local = c["runs"]["locale"]["steps"][8]
    plan = local["pre"]["plan"]
    assert plan["compiled"] is None and len(plan["commands"]) == 1
    assert plan["local"]["before"] == [4, 4, 11] and plan["local"]["after"] == [4, 8, 11]
    assert local["pre"]["command"] == ["ACTION6", {"x": 31, "y": 20}]
    assert local["after"]["matched"] and local["after"]["seal"]
    assert local["after"]["packet"] == nominal[8]["after"]["packet"]
    for name in ("locale-contredite", "ancienne"):
        assert c["runs"][name]["steps"][8]["pre"]["plan"] is None
    other = c["runs"]["etrangere"]["steps"][3]["pre"]["cut"]["pre"]
    assert other["prior"]["epoch"] == 1 and other["epoch"] == 2 and other["used"] is None
    return {"nominalTickets": len(nominal), "nativePrefixes": 4 + len(c["runs"]) + 3,
            "firstDifferences": [3, 9], "localTurn": 9, "localBefore": plan["local"]["before"],
            "localAfter": plan["local"]["after"], "scopedRefusals": ["locale-contredite", "ancienne"],
            "foreignEpochIgnored": True}


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("game", choices=("WEAV", "COMB"))
parser.add_argument("receipt", type=Path)
args = parser.parse_args()
receipt = json.loads(args.receipt.read_bytes())
result = {"WEAV": weav, "COMB": comb}[args.game](receipt)
print(json.dumps({"versions": receipt["versions"], **result}, ensure_ascii=False, indent=2))
