"""Chronological pose and control comparisons in the original source cohort."""
import json
from collections import Counter, defaultdict
from pathlib import Path
import sys

games = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8-sig"))
if len(games) != 100 or len({g["code"] for g in games}) != 100:
    raise ValueError("Expected 100 distinct source games")
totals = Counter()
for game in games:
    scenes = game["scenes"]
    history = defaultdict(list)
    mobile = set()
    measured = set()
    for scene, op, dest in game["edges"]:
        before, after = scenes[scene], scenes[dest]
        if (scene, op) in measured:
            continue
        moved = set()
        for role in before.keys() & after.keys():
            start, end = tuple(before[role][:2]), tuple(after[role][:2])
            trials = history[role, start, op]
            answers = {last for _, last in trials}
            if role in mobile and len(answers) == 1:
                totals["repeatable_forecasts"] += 1
                totals["correct_arrivals"] += end in answers
                peers = (before.keys() & mobile) - {role}
                if answers == {start} and peers:
                    equivalent = any(all(scenes[earlier].get(peer, [])[:2] == before[peer][:2] for peer in peers)
                                     for earlier, _ in trials)
                    condition = "same_placement" if equivalent else "different_placement"
                    totals[condition] += 1
                    totals[condition + "_opens"] += end != start
            if start != end:
                moved.add(role)
            trials.append((scene, end))
        mobile.update(moved)
        measured.add((scene, op))
print(json.dumps(totals, sort_keys=True))
