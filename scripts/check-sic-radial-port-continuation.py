"""Separate the measured port graph, conditional cost, and native continuation in PIPE."""

import argparse
import json
from pathlib import Path


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("receipt", type=Path)
args = parser.parse_args()
r = json.loads(args.receipt.read_bytes())
assert r["versions"]["qualification"] == "aa75791a365b1ab6edcfa6a464654c6432cb3b46"
assert r["prefixes"] == 6
g = r["native"]
nominal = g["nominal"]["steps"]
assert len(nominal) == 16
first = nominal[0]
links = first["pre"]["cut"]["pre"]["links"]
assert links["joined"] == [[0, 1, 1, 3], [1, 1, 2, 3], [3, 1, 4, 3], [4, 1, 5, 3]]
assert len(links["open"]) == 8
target = first["pre"]["cut"]["target"]
tree = {0}
for _ in range(9):
    for a, _, b, _ in target["links"]["joined"]:
        if a in tree or b in tree:
            tree.update((a, b))
assert len(tree) == 9 and len(target["links"]["joined"]) == 8 and target["links"]["open"] == []
assert target["visited"] == first["pre"]["plan"]["searchNodes"] == 7
assert sum(target["turns"]) == 4 and first["pre"]["command"] == ["ACTION6", {"x": 16, "y": 28}]
measured = first["after"]["record"]
assert measured["ports"][3] == [1, 2] and [3, 2, 6, 0] in measured["links"]["joined"]
assert measured["event"]["rule"]["turn"] == 1
assert all(g[name]["steps"][0]["after"]["record"]["event"]["rule"] is None for name in ("stationnaire", "autre"))

observed2, unbound2 = nominal[1]["pre"], g["methode"]["next"]
assert observed2["command"] == unbound2["command"] == ["ACTION6", {"x": 48, "y": 28}]
assert observed2["plan"]["known"] and len(observed2["plan"]["steps"]) == 3
assert not unbound2["plan"]["known"] and len(unbound2["plan"]["steps"]) == 1

t14, t15 = nominal[13:15]
with_pixel = g["exterieur"]
altered = with_pixel["steps"][13]
restart = with_pixel["next"]
assert t14["pre"] == altered["pre"] and t14["after"]["packet"] == altered["after"]["packet"]
assert t14["after"]["matched"] and not t14["after"]["seal"]
assert altered["after"]["matched"] and altered["after"]["seal"]
assert altered["after"]["record"]["actual"]["outside_changed_pixels"] == 1
assert t14["pre"]["plan"]["steps"] == t15["pre"]["plan"]["steps"]
assert restart["command"] == t15["pre"]["command"] == ["ACTION6", {"x": 14, "y": 22}]
assert (t15["pre"]["index"], restart["index"]) == (1, 0) and len(restart["plan"]["steps"]) == 2

print(json.dumps({
    "versions": r["versions"], "nativePrefixes": r["prefixes"], "nominalTickets": len(nominal),
    "initialLinks": len(links["joined"]), "initialOpenPorts": len(links["open"]),
    "conditionalSearchStates": target["visited"], "conditionalQuarterTurns": sum(target["turns"]),
    "sameCommandAt15": restart["command"], "continuationThenRestartIndices": [1, 0],
    "extraPixelsAt14": 1, "boundaryTurns": [4, 12],
}, indent=2))
