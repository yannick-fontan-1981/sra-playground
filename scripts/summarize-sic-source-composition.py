import collections
import hashlib
import json
import os
from pathlib import Path
import sys

GAMES = ("GABA", "TEQU", "ESCT", "SNAR", "SKBN", "KEYD", "KLOT", "WEAV", "COLM", "REWI", "SS02", "SS04")
SOURCE_TREE = "c6be00220e0691619413e9244101f9c6a302c144"
root, output = [Path(name) for name in sys.argv[1:]]
sha = os.environ["GITHUB_SHA"]
expected = {f"sic-source-composer-{game}" for game in GAMES}
assert {path.name for path in root.iterdir()} == expected


def load_receipt(folder, arm, game):
    row = json.loads((folder / f"{arm}.jsonl").read_text())
    assert row["code"] == game and row["status"] in ("paused", "stopped")
    if "sourceArm" in row:
        assert (row["sourceArm"], row["mode"], row["parallelWorkers"]) == (arm, "sic", 1)
    levels = row["levelStats"]
    assert [level["level"] for level in levels] == list(range(1, len(levels) + 1))
    assert sum(level["won"] for level in levels) == row["levels"]
    assert sum(level["actions"] for level in levels) == row["actions"]
    assert sum(level["actions"] > level["budget"]["actions"] for level in levels) == 0
    assert row["actions"] == row["authority"]
    return row


def first_difference(left, right):
    for index, (a, b) in enumerate(zip(left, right), 1):
        if a[:6] != b[:6]:
            return {"turn": index, "fixed": [a[0], a[2], a[6], a[7]],
                    "active": [b[0], b[2], b[6], b[7]]}
    if len(left) != len(right):
        return {"turn": min(len(left), len(right)) + 1, "shorter": "fixed" if len(left) < len(right) else "active"}


rows = []
intervals = []
for game in GAMES:
    folder = root / f"sic-source-composer-{game}"
    assert (folder / "identity").read_text().splitlines() == [sha, SOURCE_TREE, game]
    for line in (folder / "sha256sums").read_text().splitlines():
        digest, name = line.split()
        assert hashlib.sha256((folder / name).read_bytes()).hexdigest() == digest
    fixed, active = [load_receipt(folder, arm, game) for arm in ("fixed", "active")]
    assert fixed["target"] == active["target"]
    assert all(a["budget"] == b["budget"] for a, b in zip(fixed["levelStats"], active["levelStats"]))
    assert "SIC_REPLAY_REFERENCES" not in os.environ
    duration_start, duration_end = (int((folder / name).read_text()) for name in ("start-ms", "end-ms"))
    intervals.append((duration_start, duration_end))
    result = {"game": game, "target": fixed["target"]}
    for arm, row in (("fixed", fixed), ("active", active)):
        effects = row.get("effects", [])
        result[arm] = {
            "won": row["levels"], "actions": row["actions"], "reason": row["reason"],
            "levelActions": [level["actions"] for level in row["levelStats"]],
            "families": dict(collections.Counter(effect[7] for effect in effects).most_common(8)),
            "rivalReturns": row.get("sourceReturnRivals"),
            "nativeEvidence": row.get("sourceComposerEvidence"),
        }
    result["firstDifference"] = first_difference(fixed.get("effects", []), active.get("effects", []))
    rows.append(result)

summary = {"sha": sha, "src": SOURCE_TREE, "games": rows,
           "targetLevels": sum(row["target"] for row in rows),
           "fixedWins": sum(row["fixed"]["won"] for row in rows),
           "activeWins": sum(row["active"]["won"] for row in rows),
           "replayWallMs": max(b for _, b in intervals) - min(a for a, _ in intervals),
           "cumulativeReplayMs": sum(b - a for a, b in intervals)}
running = peak = 0
for _, delta in sorted([(a, 1) for a, _ in intervals] + [(b, -1) for _, b in intervals]):
    running += delta
    peak = max(peak, running)
summary["peakParallelGames"] = peak
output.write_text(json.dumps(summary, indent=2) + "\n")
print(json.dumps({"fixedWins": summary["fixedWins"], "activeWins": summary["activeWins"],
                  "byGame": [(row["game"], row["fixed"]["won"], row["active"]["won"]) for row in rows]}))
