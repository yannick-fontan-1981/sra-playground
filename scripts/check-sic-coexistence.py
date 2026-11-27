"""Audit the frozen source components and the receipt of every game of the joint campaign."""
import argparse
from collections import Counter
import json
from pathlib import Path
import runpy

from sic_qualification_reference import AUDIT, FROZEN, ROOT, check, frozen_campaign, git, sha

ASSEMBLY = "1afdede0dcdd4a5bb2c7b284b1ead20e1782fe0d"
TEN_LINES = "8a424aab6ca2e2f6b902cc4b9c89313ed6947b74"
QUERY = "c0b9f4027f1df257d7b8c96f5656f9dbb83661f0"
COMPONENTS = {
    "a5a90c3349ea49bba8e40055444cea2026bee962": "P05 et déplacement signé",
    "14db9cd82a345752030531e9db37fb7c0ea6df45": "lignes 90 et 91",
    "c0b9f4027f1df257d7b8c96f5656f9dbb83661f0": "ligne 87",
}


def check_components(assembly):
    check(git("rev-parse", ASSEMBLY + "^").decode().strip() == FROZEN, "Assembly must descend directly from freeze")
    blocks = [(FROZEN, src, purpose) for src, purpose in COMPONENTS.items()]
    if assembly == TEN_LINES:
        check(git("rev-parse", assembly + "^").decode().strip() == ASSEMBLY, "Expected the six-line parent")
        blocks.extend([
            (FROZEN, "16f3c5e8d300903e475400fb9b67a513f2834663", "ligne 1"),
            (FROZEN, "1a1cc965a4f4deb8b2702f8b4746ca2715ae5ebd", "ligne 18"),
            (QUERY, "e21781637371b846c60aa50de5ff080c136c9abf", "ligne 98 sur la ligne 87"),
        ])
    components, seen = {}, set()
    for baseline, revision, purpose in blocks:
        paths = git("diff", "--name-only", baseline, revision, "--", "src").decode().splitlines()
        check(not seen.intersection(paths), "Overlapping component blocks")
        seen.update(paths)
        for path in paths:
            check(git("rev-parse", revision + ":" + path) == git("rev-parse", assembly + ":" + path), path)
        components[revision] = {"purpose": purpose, "files": paths}
    check(set(git("diff", "--name-only", FROZEN, assembly).decode().splitlines()) == seen,
          "Unexpected change outside selected engine files")
    return components


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path)
    parser.add_argument("--candidate", choices=(ASSEMBLY, TEN_LINES), default=ASSEMBLY)
    parser.add_argument("--workflow", required=True)
    parser.add_argument("--run", required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    components = check_components(args.candidate)
    frozen, counts, budgets = frozen_campaign()
    chain = runpy.run_path(str(ROOT / "scripts/sic-compare-receipt-chain.py"))
    rows = chain["load_archive"](args.archive, args.candidate, args.run, args.workflow, list(frozen), counts)
    parent = None
    if args.candidate == TEN_LINES:
        base = ROOT / "docs/diagnostics/sic-coexistence-1afdede0"
        ledger = json.loads((base / "qualification.json").read_bytes())
        check(ledger["candidate"] == ASSEMBLY and ledger["archiveSHA256"] == sha((base / "recus.zip").read_bytes()),
              "Parent archive does not match the published ledger")
        parent = chain["load_archive"](base / "recus.zip", ASSEMBLY, ledger["run"], ledger["workflow"], list(frozen), counts)
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
        if parent:
            previous, previous_meta = parent[code]
            check(ledger["games"][code]["firstDifference"] is None and
                  ledger["games"][code]["receiptSHA256"] == previous_meta["rowSHA256"], "Invalid parent row " + code)
            parent_delta = chain["receipt_difference"](previous, row)
            if parent_delta and not delta:
                delta = {"parentDifference": parent_delta}
        if delta or audit["category"] != "complete" or audit["issues"] or audit["scoreDeadlineOverruns"]:
            failures.append(code)
        games[code] = {"levels": row["levels"], "actions": row["actions"], "authority": row["authority"],
                       "sourceSHA256": frozen[code][1]["rowSHA256"], "receiptSHA256": meta["rowSHA256"],
                       "category": audit["category"], "recoveries": row["recoveries"],
                       "firstDifference": delta, "issues": audit["issues"],
                       "scoreDeadlineOverruns": audit["scoreDeadlineOverruns"]}
        if parent:
            games[code]["parentReceiptSHA256"] = parent[code][1]["rowSHA256"]
    result = {"candidate": args.candidate, "frozen": FROZEN, "run": args.run, "workflow": args.workflow,
              "srcTree": git("rev-parse", args.candidate + ":src").decode().strip(), "components": components,
              "archiveSHA256": sha(args.archive.read_bytes()), "games": games}
    if parent:
        result["parent"] = ASSEMBLY
    if args.output:
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf8", newline="\n")
    print(json.dumps({"games": len(games), "levels": sum(g["levels"] for g in games.values()),
                      "actions": sum(g["actions"] for g in games.values()), "categories": dict(Counter(g["category"] for g in games.values())),
                      "differentOrIncomplete": failures}))
    return int(bool(failures))


if __name__ == "__main__":
    raise SystemExit(main())
