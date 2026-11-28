"""Audit the frozen source components and the receipt of every game of the joint campaign."""
import argparse
from collections import Counter
import json
from pathlib import Path
import runpy

from sic_qualification_reference import AUDIT, FROZEN, ROOT, check, frozen_campaign, git, sha

ASSEMBLY = "1afdede0dcdd4a5bb2c7b284b1ead20e1782fe0d"
TEN_LINES = "8a424aab6ca2e2f6b902cc4b9c89313ed6947b74"
NEXT_ASSEMBLY = "f27eb1c055d44e852fb90a25c542d0a466eb6c16"
TWENTY_FIVE = "278d5b357d3e3328a32697fe402f3fa9d957d547"
THIRTY_FIVE = "09aeb9e14e40b6115269e47267b47ba8d71708fd"
QUERY = "c0b9f4027f1df257d7b8c96f5656f9dbb83661f0"
COMPONENTS = {
    "a5a90c3349ea49bba8e40055444cea2026bee962": "P05 et déplacement signé",
    "14db9cd82a345752030531e9db37fb7c0ea6df45": "lignes 90 et 91",
    "c0b9f4027f1df257d7b8c96f5656f9dbb83661f0": "ligne 87",
}


def check_components(assembly):
    check(git("rev-parse", ASSEMBLY + "^").decode().strip() == FROZEN, "Assembly must descend directly from freeze")
    blocks = [(FROZEN, src, purpose) for src, purpose in COMPONENTS.items()]
    if assembly in (TEN_LINES, NEXT_ASSEMBLY, TWENTY_FIVE, THIRTY_FIVE):
        check(git("rev-parse", TEN_LINES + "^").decode().strip() == ASSEMBLY, "Expected the six-line parent")
        blocks.extend([
            (FROZEN, "16f3c5e8d300903e475400fb9b67a513f2834663", "ligne 1"),
            (FROZEN, "1a1cc965a4f4deb8b2702f8b4746ca2715ae5ebd", "ligne 18"),
            (QUERY, "e21781637371b846c60aa50de5ff080c136c9abf", "ligne 98 sur la ligne 87"),
        ])
    if assembly in (NEXT_ASSEMBLY, TWENTY_FIVE, THIRTY_FIVE):
        check(git("rev-parse", NEXT_ASSEMBLY + "^").decode().strip() == TEN_LINES, "Expected the ten-line parent")
        blocks.extend([
            (FROZEN, "21fd159e8339ee464a5b7bee0824b93ccefe9995", "ligne 61 corrigée"),
            (FROZEN, "495ea14890c1d0cd69de356d40a3b243e0b86f6d", "lignes 44 et 47, portée corrigée de 48"),
            (FROZEN, "39e32b1f0218d53f41c27b7140c925e8e929e705", "lignes 52, 57 et 58"),
        ])
    if assembly in (TWENTY_FIVE, THIRTY_FIVE):
        check(git("rev-parse", TWENTY_FIVE + "^").decode().strip() == NEXT_ASSEMBLY, "Expected the eighteen-line parent")
        blocks.extend([
            (FROZEN, "4946cf0297734b9464fc52256af6fb27846f3bad", "ligne 96, projection isolée"),
            (FROZEN, "75aa3829ddf9d7e4561c6c92297ad1bb8d2ac5ef", "lignes 27 et 28 ; 29 déjà présente"),
            (FROZEN, "f489393bb15a1ce775a3904ee97a216d40db026f", "ligne 3"),
        ])
    if assembly == THIRTY_FIVE:
        check(git("rev-parse", assembly + "^").decode().strip() == TWENTY_FIVE, "Expected the twenty-five-line parent")
        blocks.extend([
            (FROZEN, "f005be662b0e4b556a0cea3d246381cd98eec7ae", "lignes 68, 69 ; ligne 2 déjà présente"),
            (FROZEN, "48aae7fc05ed8d8409b1aa3a05efa4fa9c65c06d", "ligne 13 ; ligne 14 déjà présente"),
            (FROZEN, "bb4a99b5ba41531eb70f1dccb6a97a919cefec56", "ligne 4 seule"),
        ])
    components, seen = {}, set()
    for baseline, revision, purpose in blocks:
        paths = git("diff", "--name-only", baseline, revision, "--", "src").decode().splitlines()
        if revision == "bb4a99b5ba41531eb70f1dccb6a97a919cefec56":
            routing = "src/logos-engine/v6-branch-routing.ts"
            cell = "src/logos-engine/v6-cell-placement.ts"
            check(set(paths) == {routing, cell}, "Unexpected SP80 source files")
            check(git("rev-parse", FROZEN + ":" + cell) == git("rev-parse", assembly + ":" + cell),
                  "Line 41 must retain its frozen implementation")
            paths = [routing]
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
    parser.add_argument("--candidate", choices=(ASSEMBLY, TEN_LINES, NEXT_ASSEMBLY, TWENTY_FIVE, THIRTY_FIVE), default=ASSEMBLY)
    parser.add_argument("--workflow", required=True)
    parser.add_argument("--run", required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    components = check_components(args.candidate)
    frozen, counts, budgets = frozen_campaign()
    chain = runpy.run_path(str(ROOT / "scripts/sic-compare-receipt-chain.py"))
    rows = chain["load_archive"](args.archive, args.candidate, args.run, args.workflow, list(frozen), counts)
    parent = None
    parent_sha = {TEN_LINES: ASSEMBLY, NEXT_ASSEMBLY: TEN_LINES, TWENTY_FIVE: NEXT_ASSEMBLY, THIRTY_FIVE: TWENTY_FIVE}.get(args.candidate)
    if parent_sha:
        base = ROOT / "docs/diagnostics" / ("sic-coexistence-" + parent_sha[:8])
        ledger = json.loads((base / "qualification.json").read_bytes())
        check(ledger["candidate"] == parent_sha and ledger["archiveSHA256"] == sha((base / "recus.zip").read_bytes()),
              "Parent archive does not match the published ledger")
        parent = chain["load_archive"](base / "recus.zip", parent_sha, ledger["run"], ledger["workflow"], list(frozen), counts)
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
        result["parent"] = parent_sha
    if args.output:
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf8", newline="\n")
    print(json.dumps({"games": len(games), "levels": sum(g["levels"] for g in games.values()),
                      "actions": sum(g["actions"] for g in games.values()), "categories": dict(Counter(g["category"] for g in games.values())),
                      "differentOrIncomplete": failures}))
    return int(bool(failures))


if __name__ == "__main__":
    raise SystemExit(main())
