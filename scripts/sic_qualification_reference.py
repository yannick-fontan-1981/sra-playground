"""Read and validate SIC receipts without starting the game runner."""
import gzip
import hashlib
import json
from pathlib import Path
import runpy
import subprocess

ROOT = Path(__file__).resolve().parents[1]
AUDIT = runpy.run_path(str(ROOT / "scripts/audit-sic-107-receipts.py"))
PREPARE = runpy.run_path(str(ROOT / "scripts/prepare-sic-107-rerun.py"))["prepare"]
FROZEN = "d0e7527ca8033bd805a6d7a8bb021eff62e87021"
SOURCE = "4be368a365a6347fb551bb4c73dd5756413bb34e"
ARCHIVE = "e36b550cfcaa79f5ee210694a8569cdf47265323"
DIRECTORY = "docs/diagnostics/sic-107-4be368a3-20261127"
WORKFLOW = "abab3da60767b520ede320033e8091a0c0ee8414"
RUN = "46051058377"
REFERENCES = AUDIT["REFERENCE"]
INITIAL = ("AS66", "G50T", "HOLE")
STRICT_SHA = {
    "AS66": "afe063f42626c5bff0c1434f19902acc5f5f0462ece4d6daf8e2ce2c5889b337",
    "G50T": "3c465801169b0b29f6a84ff92182c90efd2e55915787d594b3a5bcda7f4736e5",
    "HOLE": "d7ae06dab522b7e386dde870ef33fa61fcc120c0efe30ad02da12ab3fd9eddbd",
}
PAIRED = ("sic_paired_passage", "sic_follow_paired_passages_after_motion")


def check(ok, message):
    if not ok:
        raise ValueError(message)


def git(*args, cwd=ROOT):
    return subprocess.check_output(["git", *args], cwd=cwd)


def tree(source):
    return git("rev-parse", source + "^{tree}").decode().strip()


def sha(data):
    return hashlib.sha256(data).hexdigest()


def archive_file(path):
    return git("show", f"{ARCHIVE}:{DIRECTORY}/{path}")


def verified_campaign(source, run, workflow, read, codes, counts):
    """read() returns original, uncompressed bytes from a download or pinned Git blob."""
    source_tree = tree(source)
    check(len(workflow) == 40 and git("rev-parse", workflow + "^{commit}").decode().strip() == workflow,
          "Provide the workflow SHA reported by GitHub")
    _, expected_workflow = PREPARE(source)
    check(git("show", workflow + ":.github/workflows/sic-campaign-107.yml") == expected_workflow,
          "The workflow does not launch this exact source under the historical protocol")
    plan = json.loads(read("aggregate/plan.json"))
    shards = AUDIT["declared_shards"](plan, source, source_tree, codes, counts)
    summary = json.loads(read("aggregate/summary.json"))
    check((summary["source"], summary["tree"], summary["runId"]) == (source, source_tree, run),
          "Aggregate source/tree/run mismatch")
    hashes = {p: sha(git("show", f"{source}:{p}")) for p in AUDIT["SOURCE_FILES"]}
    expected = {s["shard"]: s for s in summary["shards"]}
    check(len(expected) == len(summary["shards"]) == len(shards) == 24 and expected.keys() == shards.keys(),
          "Expected 24 unique shard digests from this run")
    rows = {}
    for shard, games in shards.items():
        prefix = f"shard-{shard}"
        manifest = json.loads(read(f"{prefix}/manifest.json"))
        actual, planned = AUDIT["validate_manifest"](manifest, source, source_tree, run, workflow, shards, hashes)
        check(actual == shard and planned == games, f"Invalid shard binding {shard}")
        raw = read(f"{prefix}/results.jsonl")
        check(sha(raw) == expected[shard]["sha256"] and len(raw) == expected[shard]["bytes"],
              f"Receipt digest/size mismatch in shard {shard}")
        entries = raw.splitlines()
        decoded = [json.loads(line) for line in entries]
        check([r["code"] for r in decoded] == games, f"Receipt order/coverage mismatch in shard {shard}")
        for line, row in zip(entries, decoded):
            check(row["code"] not in rows, f"Duplicate receipt {row['code']}")
            rows[row["code"]] = (row, {"shard": shard, "rowSHA256": sha(line), "shardSHA256": expected[shard]["sha256"],
                                       "nodeVersion": manifest["nodeVersion"], "runnerOS": manifest["runnerOS"],
                                       "runnerArch": manifest["runnerArch"], "runAttempt": manifest["runAttempt"]})
    check(len(rows) == len(set(codes)) == 107 and rows.keys() == set(codes), "Invalid 107-game coverage")
    return {code: rows[code] for code in codes}


def frozen_campaign():
    check(tree(FROZEN) == tree(SOURCE), "Receipt source tree differs from frozen merge")
    codes, counts, budgets, _ = AUDIT["frozen_catalog"](FROZEN)
    check(len(set(codes)) == 107 and sum(counts.values()) == 692, "Frozen catalog changed")

    def read(path):
        if path.endswith(".jsonl"):
            return gzip.decompress(archive_file(path + ".gz"))
        return archive_file(path)

    rows = verified_campaign(SOURCE, RUN, WORKFLOW, read, codes, counts)
    for code, (row, _) in rows.items():
        verdict = AUDIT["audit_game"](row, counts[code], budgets[code])
        check(verdict["category"] == "complete" and not verdict["issues"] and not verdict["scoreDeadlineOverruns"],
              f"Unqualified frozen receipt for {code}: {verdict}")
        check(row.get("mode") == "sic" and row.get("parallelWorkers") == 1, f"Frozen solver mismatch for {code}")
    return rows, counts, budgets


def strict_witnesses(path):
    missing, contact = [], []
    with path.open(encoding="utf8") as stream:
        for line in stream:
            event = json.loads(line)
            value = event["value"]
            if event["kind"] == "native" and value.get("kind") == "sic_native_plan" and value.get("missingControl"):
                missing.append([event["level"], event["turn"]])
            if event["kind"] == "decision":
                proposal = value.get("proposal") or {}
                if proposal.get("kind") not in PAIRED:
                    continue
                route = proposal.get("route") or {}
                steps = route.get("steps") or []
                if route.get("switchTest") and steps and steps[0].get("point") == route["switchTest"]:
                    contact.append([event["level"], event["turn"]])
    return missing, contact


def inventory(rows, strict_dir):
    result = []
    for code in sorted(rows):
        row, binding = rows[code]
        trace = strict_dir / f"{code}-A.jsonl"
        strict = "aucune archivée"
        missing, contact = [], []
        if code in STRICT_SHA:
            strict = "empreinte archivée, fichier à fournir"
            if trace.is_file():
                check(sha(trace.read_bytes()) == STRICT_SHA[code], f"Unrecognised reference trace {trace}")
                strict = "A vérifiée"
                missing, contact = strict_witnesses(trace)
        hints = []
        index = 0
        for level in row["levelStats"]:
            for turn, effect in enumerate(row["effects"][index:index + level["actions"]], 1):
                if (effect[7] in PAIRED and effect[6] == "P05"
                        and effect[8] == "Test the marked switch and compare the passage connections and visits"):
                    hints.append([level["level"], turn])
            index += level["actions"]
        historical = code in ("AS66", "G50T", "DC22")  # Documented native fixtures, not call-site coverage.
        reason = "reste de la cohorte"
        wave = "reste"
        if code in INITIAL:
            wave, reason = "initial", "cohorte A/A′"
        elif contact or hints or missing or historical:
            wave, reason = "appelants", "offre P05 sur cible interrupteur" if hints or contact else "témoin de contrôle documenté"
        elif code == "SNAR" or any(row["recoveries"].values()):
            wave, reason = "temoins", "correction du gel" if code == "SNAR" else "récupération au gel"
        result.append({"game": code, "wave": wave, "priorityReason": reason, "levels": row["levels"],
                       "actions": row["actions"], "stop": row["reason"], "recoveries": row["recoveries"],
                       "limitsActionsMs": [[s["budget"]["actions"], s["budget"]["activeTimeMs"]] for s in row["levelStats"]],
                       "historicalDetail": "effects, levelStats, prefixHash, trace", **binding,
                       "strictA": strict, "traceSHA256": STRICT_SHA.get(code),
                       "evaluateMissingControl": "attesté" if missing else
                       "témoin historique, appel non établi au gel" if historical else "non établi",
                       "missingControlWitnesses": missing,
                       "switchContact": "attesté" if contact else "contact supposé, offre attestée" if hints else "non établi",
                       "switchWitnesses": contact, "switchHints": hints})
    rank = {"initial": 0, "appelants": 1, "temoins": 2, "reste": 3}
    return sorted(result, key=lambda g: (rank[g["wave"]], INITIAL.index(g["game"]) if g["game"] in INITIAL else 0,
                                          not bool(g["switchHints"]), g["game"]))
