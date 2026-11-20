"""Estimate a direction prior with one vote per original game and no coordinate or game identifier in the model."""
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

games = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8-sig"))
if len(games) != 100 or len({g["code"] for g in games}) != 100:
    raise ValueError("Expected all original games")
votes = defaultdict(Counter)
for game in games:
    directions = defaultdict(Counter)
    for source, op, dest in set(map(tuple, game["edges"])):
        if ":" in op:
            continue
        before, after = game["scenes"][source], game["scenes"][dest]
        for role in before.keys() & after.keys():
            dx, dy = (after[role][i] - before[role][i] for i in (0, 1))
            if bool(dx) != bool(dy):
                direction = ((dx > 0) - (dx < 0), (dy > 0) - (dy < 0))
                directions[op][direction] += 1
    for op, counts in directions.items():
        ranked = counts.most_common(2)
        if len(ranked) == 1 or ranked[0][1] > ranked[1][1]:
            votes[op][ranked[0][0]] += 1
out = {}
for op, counts in sorted(votes.items()):
    direction, support = counts.most_common(1)[0]
    if support >= 5 and support * 4 >= 3 * counts.total():
        out[op] = {"axis": direction, "support": support, "games": counts.total()}
print(json.dumps(out, indent=2))
