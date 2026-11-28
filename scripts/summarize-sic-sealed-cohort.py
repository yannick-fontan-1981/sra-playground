from hashlib import sha256
import json
import os
from pathlib import Path
import sys

expected = [f"SS{index:02d}" for index in range(8, 26)]
root, target = [Path(path) for path in sys.argv[1:]]
assert {path.name for path in root.iterdir()} == {f"sic-sealed-cohort-{game}" for game in expected}
budget = {"actions": 80, "activeTimeMs": 90000, "source": "no_level_reference"}
if "SIC_COMPARISON_ACTION_CAP" in os.environ or "SIC_COMPARISON_TIME_CAP_MS" in os.environ:
    budget = {"actions": int(os.environ["SIC_COMPARISON_ACTION_CAP"]),
              "activeTimeMs": int(os.environ["SIC_COMPARISON_TIME_CAP_MS"]), "source": "matched_comparison_cap"}
assert budget["actions"] > 0 and budget["activeTimeMs"] > 0
games, intervals = [], []
for game in expected:
    directory = root / f"sic-sealed-cohort-{game}"
    files = {"fixed.jsonl", "active.jsonl", "fixed.jsonl.levels", "active.jsonl.levels",
             "identity", "start-ms", "end-ms"}
    for line in (directory / "sha256sums").read_text().splitlines():
        digest, name = line.split()
        assert name in files and sha256((directory / name).read_bytes()).hexdigest() == digest
        files.remove(name)
    assert not files
    assert (directory / "identity").read_text().splitlines() == [
        os.environ["VERIFIED_SOURCE"], os.environ["VERIFIED_ENGINE"], game, os.environ["GITHUB_RUN_ID"],
        os.environ["GITHUB_SHA"]]
    intervals.append(tuple(int((directory / name).read_text()) for name in ("start-ms", "end-ms")))
    result = {"game": game}
    for arm in ("fixed", "active"):
        row = json.loads((directory / f"{arm}.jsonl").read_text())
        assert (row["code"], row["target"]) == (game, 8)
        assert row["status"] in ("stopped", "paused")
        if "sourceArm" in row:
            assert (row["sourceArm"], row["mode"], row["parallelWorkers"]) == (arm, "sic", 1)
        levels = row["levelStats"]
        won = row["levels"]
        assert 1 <= len(levels) <= 8
        assert len(levels) >= won and row["actions"] == row["authority"]
        assert [level["level"] for level in levels] == list(range(1, len(levels) + 1))
        assert [level["won"] for level in levels] == [True] * won + [False] * (len(levels) - won)
        assert all(level["budget"] == budget and 0 <= level["actions"] <= budget["actions"] for level in levels)
        assert sum(level["actions"] for level in levels) == row["actions"]
        independently_serialized = [
            json.loads(line) for line in (directory / f"{arm}.jsonl.levels").read_text().splitlines()]
        assert independently_serialized == [{"code": game, "level": level} for level in levels]
        if "effects" in row:
            assert max((effect[5] for effect in row["effects"]), default=0) == won
        result[arm] = {"wins": won, "started": len(levels), "actions": row["actions"],
                       "stop": row["reason"], "levelActions": [level["actions"] for level in levels],
                       "recoveries": row.get("recoveries")}
    games.append(result)

totals = {}
for arm in ("fixed", "active"):
    totals[arm] = {"wins": sum(row[arm]["wins"] for row in games),
                   "reachedN2": sum(row[arm]["wins"] > 0 for row in games),
                   "actions": sum(row[arm]["actions"] for row in games)}
active = peak = 0
for _, delta in sorted([(start, 1) for start, _ in intervals] + [(end, -1) for _, end in intervals]):
    active += delta
    peak = max(peak, active)
result = {"source": os.environ["VERIFIED_SOURCE"], "engine": os.environ["VERIFIED_ENGINE"], "levels": 144,
          "budget": budget, "totals": totals, "games": games, "peakReplayJobs": peak,
          "replayWallMs": max(end for _, end in intervals) - min(start for start, _ in intervals),
          "cumulativeReplayMs": sum(end - start for start, end in intervals)}
target.write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(totals))
