"""Audit the frozen source components and the receipt of every game of the joint campaign."""
import argparse
from collections import Counter
import json
from pathlib import Path
import runpy

from sic_qualification_reference import AUDIT, FROZEN, ROOT, check, frozen_campaign, git, sha

ASSEMBLY = "1afdede0dcdd4a5bb2c7b284b1ead20e1782fe0d"
COMPONENTS = {
    "a5a90c3349ea49bba8e40055444cea2026bee962": "P05 et déplacement signé",
    "14db9cd82a345752030531e9db37fb7c0ea6df45": "lignes 90 et 91",
    "c0b9f4027f1df257d7b8c96f5656f9dbb83661f0": "ligne 87",
}


def check_components():
    check(git("rev-parse", ASSEMBLY + "^").decode().strip() == FROZEN, "Assembly must descend directly from freeze")
    components, seen = {}, set()
    for revision, purpose in COMPONENTS.items():
        paths = git("diff", "--name-only", FROZEN, revision, "--", "src").decode().splitlines()
        check(not seen.intersection(paths), "Overlapping component blocks")
        seen.update(paths)
        for path in paths:
            check(git("rev-parse", revision + ":" + path) == git("rev-parse", ASSEMBLY + ":" + path), path)
        components[revision] = {"purpose": purpose, "files": paths}
    check(set(git("diff", "--name-only", FROZEN, ASSEMBLY).decode().splitlines()) == seen,
          "Unexpected change outside selected engine files")
    return components


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--workflow", required=True)
    parser.add_argument("--run", required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    components = check_components()
    frozen, counts, budgets = frozen_campaign()
    chain = runpy.run_path(str(ROOT / "scripts/sic-compare-receipt-chain.py"))
    rows = chain["load_archive"](args.archive, ASSEMBLY, args.run, args.workflow, list(frozen), counts)
    games, failures = {}, []
    for code, (row, meta) in rows.items():
        audit = AUDIT["audit_game"](row, counts[code], budgets[code])
        delta = chain["receipt_difference"](frozen[code][0], row)
        for field in ("mode", "parallelWorkers", "solverFamilies"):
            if delta is None and frozen[code][0][field] != row[field]:
                delta = {"field": field, "before": frozen[code][0][field], "after": row[field]}
        # Count transitions inside and between plans. Their median elapsed milliseconds are host timings.
        before = {kind: metric["count"] for kind, metric in frozen[code][0]["gaps"].items()}
        after = {kind: metric["count"] for kind, metric in row["gaps"].items()}
        if delta is None and before != after:
            delta = {"field": "gaps.count", "before": before, "after": after}
        if delta or audit["category"] != "complete" or audit["issues"] or audit["scoreDeadlineOverruns"]:
            failures.append(code)
        games[code] = {"levels": row["levels"], "actions": row["actions"], "authority": row["authority"],
                       "sourceSHA256": frozen[code][1]["rowSHA256"], "receiptSHA256": meta["rowSHA256"],
                       "category": audit["category"], "recoveries": row["recoveries"],
                       "firstDifference": delta, "issues": audit["issues"],
                       "scoreDeadlineOverruns": audit["scoreDeadlineOverruns"]}
    result = {"candidate": ASSEMBLY, "frozen": FROZEN, "run": args.run, "workflow": args.workflow,
              "srcTree": git("rev-parse", ASSEMBLY + ":src").decode().strip(), "components": components,
              "archiveSHA256": sha(args.archive.read_bytes()), "games": games}
    if args.output:
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf8", newline="\n")
    print(json.dumps({"games": len(games), "levels": sum(g["levels"] for g in games.values()),
                      "actions": sum(g["actions"] for g in games.values()), "categories": dict(Counter(g["category"] for g in games.values())),
                      "differentOrIncomplete": failures}))
    return int(bool(failures))


if __name__ == "__main__":
    raise SystemExit(main())
