"""Can a previously ineffective command express a movement learned through another command?"""
from collections import Counter, defaultdict
import json
from pathlib import Path
import sys


def study(game):
    scenes = game["scenes"]
    seen = set()
    controls = defaultdict(list)
    moved_by = defaultdict(set)
    destinations = defaultdict(Counter)
    examples = defaultdict(list)
    displacements = defaultdict(Counter)
    previous = None
    counts = Counter()
    for source, op, target in game["edges"]:
        if (source, op) in seen:
            previous = (source, op, target)
            continue
        before, after = scenes[source], scenes[target]
        updates = []
        for role, data in before.items():
            start = tuple(data[:2])
            prior = controls[role, start, op]
            # Select the experiment before revealing the role's outcome.
            if moved_by[role] and op not in moved_by[role] and prior and all(end == start for _, end in prior):
                ends = destinations[role, start]
                votes = ends.copy()
                if not votes:
                    for (dx, dy), n in displacements[role].items():
                        votes[(start[0] + dx, start[1] + dy)] += n
                ranked = sorted(votes, key=lambda p: (-votes[p], p))
                if ranked:
                    groups = ["eligible"]
                    if ends:
                        groups.append("known_departure")
                    if previous and previous[2] == source and previous[0] in {s for s, _ in prior}:
                        groups.append("direct_preparation")
                    peers = [p for p in before if p != role and moved_by[p]]
                    if peers and all(any(before[p][:2] != scenes[s].get(p, [])[:2] for p in peers) for s, _ in prior):
                        groups.append("peers_moved")
                    # A setup may reproduce part of a historically productive configuration.
                    gain = loss = 0
                    for donor in examples[role, start, ranked[0]]:
                        for inactive, _ in prior:
                            later = former = 0
                            for peer in (set(before) | set(scenes[donor]) | set(scenes[inactive])) - {role}:
                                expected = scenes[donor].get(peer, [])[:2]
                                was = scenes[inactive].get(peer, [])[:2]
                                now = before.get(peer, [])[:2]
                                later += now == expected and was != expected
                                former += was == expected and now != expected
                            if later - former > gain - loss:
                                gain, loss = later, former
                    if gain > loss:
                        groups.append("closer_to_donor")
                    for group in groups:
                        counts[group + ".forecasts"] += 1
                        if role not in after:
                            counts[group + ".unobserved"] += 1
                            continue
                        actual = tuple(after[role][:2])
                        counts[group + ".moves"] += actual != start
                        counts[group + ".first_exact"] += actual == ranked[0]
                        counts[group + ".top_three_exact"] += actual in ranked[:3]
                        counts[group + ".any_exact"] += actual in ranked
            if role in after:
                updates.append((role, start, tuple(after[role][:2])))
        for role, start, end in updates:
            controls[role, start, op].append((source, end))
            if start != end:
                moved_by[role].add(op)
                destinations[role, start][end] += 1
                examples[role, start, end].append(source)
                displacements[role][end[0] - start[0], end[1] - start[1]] += 1
        previous = source, op, target
        seen.add((source, op))
    return counts


games = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8-sig"))
if len(games) != 100 or len({g["code"] for g in games}) != 100:
    raise ValueError("Expected 100 distinct source games")
by_game = {g["code"]: study(g) for g in games}
total = Counter()
for c in by_game.values():
    total.update(c)
print(json.dumps({"counts": total, "exact_games": sorted(g for g,c in by_game.items() if c["eligible.first_exact"])}))
