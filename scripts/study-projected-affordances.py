"""Count spatially conditional transitions and their continuations in the public source cohort."""
import json
import sys
from collections import defaultdict
from pathlib import Path

def study(game):
    scenes = game["scenes"]
    edges = list(dict.fromkeys(map(tuple, game["edges"])))
    outgoing = defaultdict(list)
    alternatives = defaultdict(list)
    moved = set()
    for s, op, t in edges:
        outgoing[s].append((op, t))
        for role in scenes[s].keys() & scenes[t].keys():
            if scenes[s][role][:2] != scenes[t][role][:2]:
                moved.add(role)
    for s, op, t in edges:
        for role in moved & scenes[s].keys() & scenes[t].keys():
            alternatives[role, tuple(scenes[s][role][:2]), op].append((s, t, tuple(scenes[t][role][:2])))
    witnesses = set()
    with_follow = set()
    for (role, origin, op), trials in alternatives.items():
        for s, t, end in trials:
            if origin == end:
                continue
            for z, _, other in trials:
                if end == other:
                    continue
                for ref in (moved & scenes[s].keys() & scenes[z].keys()) - {role}:
                    if scenes[s][ref][:2] == scenes[z][ref][:2]:
                        continue
                    key = role, origin, op, ref
                    witnesses.add(key)
                    if any(role in scenes[u] and tuple(scenes[u][role][:2]) != end
                           for _, u in outgoing[t]):
                        with_follow.add(key)
    return len(witnesses), len(with_follow)

data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8-sig"))
if len(data) != 100 or len({g["code"] for g in data}) != 100:
    raise ValueError("Expected 100 distinct source games")
counts = {g["code"]: study(g) for g in data}
print(json.dumps({"games": len(counts), "alternative_arrivals": sum(x for x, _ in counts.values()),
                  "with_follow": sum(y for _, y in counts.values()),
                  "games_with_follow": [k for k, (_, y) in counts.items() if y]}))
