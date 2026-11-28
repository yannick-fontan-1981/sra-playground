"""Authorize opening the sealed cohort from independently checked source receipts."""

from hashlib import sha256
import json
import os
from pathlib import Path
import sys

GAMES = ("COMB", "DC22", "SS01", "SS04")
EXPECTED = {(game, arm) for game in GAMES for arm in ("fixed", "active")}
EXPECTED.add(("SS01", "active_without_local_recovery"))

directory = Path(sys.argv[1])
assert {p.name for p in directory.iterdir()} == {f"sic-witnessed-recovery-{g}-{a}" for g, a in EXPECTED}
shared_budget_digest = None
rows = {}
for game, arm in sorted(EXPECTED):
    receipt = directory / f"sic-witnessed-recovery-{game}-{arm}"
    files = {"result.jsonl", "result.jsonl.levels", "identity", "configuration",
             "budget-input", "start-ms", "end-ms"}
    for line in (receipt / "sha256sums").read_text().splitlines():
        digest, name = line.split()
        assert name in files and sha256((receipt / name).read_bytes()).hexdigest() == digest
        files.remove(name)
    assert not files
    assert (receipt / "configuration").read_text().splitlines() == [game, arm]
    assert (receipt / "identity").read_text().splitlines() == [
        os.environ["VERIFIED_SOURCE"], os.environ["VERIFIED_ENGINE"]]
    budget_digest = (receipt / "budget-input").read_text().split()[0]
    shared_budget_digest = shared_budget_digest or budget_digest
    assert budget_digest == shared_budget_digest, "Every source session must use the same budget document."

    row = json.loads((receipt / "result.jsonl").read_text())
    assert (row["code"], row["mode"], row["target"], row["parallelWorkers"]) == (game, "sic", 6, 1)
    assert row["sourceArm"] == ("fixed" if arm == "fixed" else "active")
    assert row["levels"] == 6, f"{game} {arm} won {row['levels']}/6; sealed cohort stays closed."
    levels = row["levelStats"]
    assert [level["level"] for level in levels] == list(range(1, 7))
    assert all(level["won"] and level["actions"] <= level["budget"]["actions"] for level in levels)
    assert row["actions"] == row["authority"] == sum(level["actions"] for level in levels)
    assert len(row["effects"]) == row["actions"] and max(effect[5] for effect in row["effects"]) == 6
    level_rows = [json.loads(line) for line in (receipt / "result.jsonl.levels").read_text().splitlines()]
    assert level_rows == [{"code": game, "level": level} for level in levels]
    rows[game, arm] = row

for game, arm in EXPECTED:
    assert [x["budget"] for x in rows[game, arm]["levelStats"]] == [
        x["budget"] for x in rows[game, "fixed"]["levelStats"]]

control = rows["COMB", "active"]
assert control["actions"] < rows["COMB", "fixed"]["actions"]
assert {"selectMarkedCursor", "verifyMarkedCursor"}.issubset(
    {result["phase"] for result in control["sourceComposerEvidence"]})
fixed, active, ablation = [rows["SS01", arm] for arm in ("fixed", "active", "active_without_local_recovery")]
assert active["actions"] < fixed["actions"]
# Prefix hashes cover the physical action and frame sequence. Policy attribution can differ.
assert [x["prefixHash"] for x in ablation["levelStats"]] == [x["prefixHash"] for x in fixed["levelStats"]]
assert [effect[:6] for effect in ablation["effects"]] == [effect[:6] for effect in fixed["effects"]]
evidence = active["sourceRecoveryEvidence"]
witnesses = {entry["after"] for entry in evidence if entry["kind"] == "sic_transport_undo_available"
             and entry["alternativeLength"] > 0}
assert any(entry["kind"] == "action_undo" and entry["cause"] == "sic_observed_transport_deadlock"
           and entry["before_observation_ref"] in witnesses for entry in evidence)
print(json.dumps({"source": os.environ["VERIFIED_SOURCE"], "receipts": len(rows),
                  "actions": {g: [rows[g, arm]["actions"] for arm in ("fixed", "active")] for g in GAMES},
                  "qualified": True}))
