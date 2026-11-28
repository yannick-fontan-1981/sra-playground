import json
import os
from hashlib import sha256
from pathlib import Path
import sys


root = Path(sys.argv[1])
games = [f"SS{game:02}" for game in range(1, 8)]
assert {path.name for path in root.iterdir()} == {f"sic-coverage-cost-{game}" for game in games}
motions = set()
levels = commands = saved = 0
for game in games:
    directory = root / f"sic-coverage-cost-{game}"
    expected = {"identity", "base.jsonl", "active.jsonl", "base.jsonl.levels", "active.jsonl.levels",
                "start-ms", "end-ms"}
    for line in (directory / "sha256sums").read_text().splitlines():
        digest, name = line.split()
        assert name in expected and sha256((directory / name).read_bytes()).hexdigest() == digest
        expected.remove(name)
    assert not expected
    assert (directory / "identity").read_text().splitlines() == [os.environ["COVERAGE_SOURCE"],
                                                                  os.environ["VERIFIED_ENGINE"]]
    arms = []
    budgets = []
    for arm in ("base", "active"):
        row = json.loads((directory / f"{arm}.jsonl").read_text())
        assert (row["code"], row["mode"], row["sourceArm"], row["target"], row["parallelWorkers"]) == (game, "sic", "active", 3, 1)
        level_rows = row["levelStats"]
        assert [entry["level"] for entry in level_rows] == list(range(1, len(level_rows) + 1))
        assert [entry["won"] for entry in level_rows] == [True] * row["levels"] + [False] * (len(level_rows) - row["levels"])
        assert all(entry["actions"] <= entry["budget"]["actions"] for entry in level_rows)
        assert row["actions"] == row["authority"] == len(row["effects"]) == sum(entry["actions"] for entry in level_rows)
        assert max((effect[5] for effect in row["effects"]), default=0) == row["levels"]
        assert [json.loads(line) for line in (directory / f"{arm}.jsonl.levels").read_text().splitlines()] == [
            {"code": game, "level": entry} for entry in level_rows
        ]
        budgets.append([entry["budget"] for entry in level_rows])
        arms.append(row)
    baseline, active = arms
    assert budgets[0] == budgets[1] and active["levels"] == baseline["levels"]
    assert not any(decision["strategy"] == "compare_coverage_cost" for decision in baseline["sourceDecisions"])
    trials = [decision for decision in active["sourceDecisions"] if decision["strategy"] == "compare_coverage_cost"]
    assert all(0 < trial["proposed"] < trial["previous"] and 0 < trial["states"] <= 6000 for trial in trials)
    if active["actions"] < baseline["actions"]:
        assert trials
        for trial in trials:
            if active["levelStats"][trial["level"] - 1]["actions"] < baseline["levelStats"][trial["level"] - 1]["actions"]:
                assert active["levelStats"][trial["level"] - 1]["won"]
                motions.add(trial["motion"])
    levels += active["levels"]
    commands += baseline["actions"]
    saved += baseline["actions"] - active["actions"]
assert motions == {"push", "pull"} and saved > 0
print(json.dumps({"qualified": True, "source": os.environ["COVERAGE_SOURCE"], "games": len(games), "winsPerArm": levels,
                  "commands": [commands, commands - saved], "retainedMotions": sorted(motions)}))
