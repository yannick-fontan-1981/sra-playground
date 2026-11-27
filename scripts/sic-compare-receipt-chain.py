"""Compare a parent archive, its direct child and the frozen SIC-107 receipts offline."""
import argparse
from collections import Counter
import json
from pathlib import Path
import runpy
from zipfile import ZipFile

from sic_qualification_reference import AUDIT, FROZEN, REFERENCES, ROOT, check, frozen_campaign, git, sha, tree, verified_campaign

receipt_difference = runpy.run_path(str(ROOT / "scripts/sic-qualification-progressive.py"))["receipt_difference"]


def load_archive(path, source, run, workflow, codes, counts):
    prefix = "sic-107-" + source[:8] + "-"
    with ZipFile(path) as zipped:
        return verified_campaign(source, run, workflow, lambda name: zipped.read(prefix + name), codes, counts)


def decision_receipts(path, parent, child, parent_rows, child_rows, parent_index):
    detailed = {}
    with ZipFile(path) as z:
        for name in z.namelist():
            if not name.endswith("/pair.json"):
                continue
            pair = json.loads(z.read(name))
            code = pair["game"]
            check(name == code + "/pair.json" and code in child_rows and code not in detailed,
                  "Duplicate or unknown decision receipt")
            a, b, comp = pair["A"], pair["B"], pair["comparison"]
            digest = b["traceSHA256"]
            check((a["source"], b["source"]) == (parent, child) and pair["matches"] and comp["equal"]
                  and comp["game"] == code and comp["decisions"] == child_rows[code][0]["actions"]
                  and comp["events"] >= comp["decisions"] and a["traceSHA256"] == digest
                  and len(digest) == 64 and all(c in "0123456789abcdef" for c in digest)
                  and pair["parentRowSHA256"] == parent_rows[code][1]["rowSHA256"], f"Invalid decision binding: {code}")
            method = pair.get("method", "ordered-pair")
            check(method in ("ordered-pair", "verified-parent-trace-sha256"), "Unknown comparison method")
            campaign_differences = {}
            for label, data, source, reference in (("A", a, parent, parent_rows), ("B", b, child, child_rows)):
                if method == "verified-parent-trace-sha256" and label == "A":
                    check(parent_index[code]["decisions"]["sha256B"] == digest, "Unrecognised reused trace")
                    continue
                raw = z.read(f"{code}/{label}.receipt")
                binding = json.loads(z.read(f"{code}/{label}.source.json"))
                argv = binding["argv"]
                check(binding["source"] == source and binding["tree"] == tree(source)
                      and binding["game"] == code and binding["node"] == "v24.22.3"
                      and binding["seed"] == 0 and binding["startLevel"] == 1
                      and binding["referencesSHA256"] == sha((ROOT / REFERENCES).read_bytes())
                      and len(argv) == 7 and argv[2:4] == [code, "auto"] and argv[5:] == ["1", "sic"]
                      and sha(raw) == data["receiptSHA256"], f"Invalid decision-run receipt: {code}/{label}")
                delta = receipt_difference(reference[code][0], json.loads(raw))
                if delta is not None:
                    campaign_differences[label] = delta
            detailed[code] = {"comparison": comp, "sha256A": digest, "sha256B": digest, "method": method}
            if campaign_differences:
                detailed[code]["campaignToDecisionRunDifferences"] = campaign_differences
    check(bool(detailed), "Empty decision archive")
    return detailed


def compare(opts):
    frozen, counts, budgets = frozen_campaign()
    codes = list(frozen)
    index = json.loads((opts.parent / "qualification.json").read_bytes())
    parent = index["candidate"]
    check(git("rev-parse", opts.candidate + "^").decode().strip() == parent, "Expected a direct parent")
    check(index["frozen"] == FROZEN, "Parent ledger has another frozen reference")
    parent_zip = opts.parent / "recus.zip"
    check(sha(parent_zip.read_bytes()) == index["archiveSHA256"], "Unexpected parent archive")
    a = load_archive(parent_zip, parent, index["runId"], index["workflow"], codes, counts)
    b = load_archive(opts.receipts, opts.candidate, opts.run_id, opts.workflow, codes, counts)
    previous = {g["game"]: g for g in index["games"]}
    check(len(previous) == len(index["games"]) == 107 and set(previous) == set(codes), "Parent ledger coverage")
    details = decision_receipts(opts.pairs, parent, opts.candidate, a, b, previous) if opts.pairs else {}
    results = []
    for code in codes:
        f, f_meta = frozen[code]
        ar, a_meta = a[code]
        br, b_meta = b[code]
        check(previous[code]["matches"] and previous[code]["candidateRowSHA256"] == a_meta["rowSHA256"]
              and previous[code]["referenceRowSHA256"] == f_meta["rowSHA256"], f"Parent ledger mismatch: {code}")
        check(receipt_difference(f, ar) is None, f"Parent deviates from freeze: {code}")
        verdict = AUDIT["audit_game"](br, counts[code], budgets[code])
        delta = receipt_difference(ar, br)
        frozen_delta = receipt_difference(f, br)
        matches = (delta is None and frozen_delta is None and verdict["category"] == "complete"
                   and not verdict["issues"] and not verdict["scoreDeadlineOverruns"])
        results.append({"game": code, "matches": matches, "target": counts[code], "scored": verdict["scored"],
                        "reconciled": verdict["reconciled"], "actions": br.get("actions"), "authority": br.get("authority"),
                        "recoveries": verdict["recoveries"], "category": verdict["category"], "shard": b_meta["shard"],
                        "referenceRowSHA256": f_meta["rowSHA256"], "parentRowSHA256": a_meta["rowSHA256"],
                        "candidateRowSHA256": b_meta["rowSHA256"],
                        **({"decisions": details[code]} if code in details else {}),
                        **({"parentDifference": delta, "frozenDifference": frozen_delta, "audit": verdict} if not matches else {})})
    report = {"frozen": FROZEN, "parent": parent, "parentRunId": index["runId"], "candidate": opts.candidate,
              "candidateTree": tree(opts.candidate), "workflow": opts.workflow, "runId": opts.run_id, "attempt": 1,
              "archiveSHA256": sha(opts.receipts.read_bytes()), "games": results}
    if opts.pairs:
        report["decisionArchiveSHA256"] = sha(opts.pairs.read_bytes())
    if opts.output:
        opts.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf8", newline="\n")
    differences = [r["game"] for r in results if not r["matches"]]
    print(json.dumps({"games": len(results), "scored": sum(r["scored"] for r in results),
                      "reconciled": sum(r["reconciled"] for r in results),
                      "categories": dict(Counter(r["category"] for r in results)), "different": differences}))
    return int(bool(differences))


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--parent", type=Path, required=True)
    p.add_argument("--candidate", required=True)
    p.add_argument("--workflow", required=True)
    p.add_argument("--run-id", required=True)
    p.add_argument("--receipts", type=Path, required=True)
    p.add_argument("--pairs", type=Path, help="Attach independently captured decision-pair verdicts")
    p.add_argument("--output", type=Path)
    raise SystemExit(compare(p.parse_args()))
