"""Replay the sealed pressure recovery tests against explicit native engine checkouts."""
import argparse
import json
from pathlib import Path
import re
import subprocess

from sic_qualification_reference import ROOT, check, git

PORT = "c515ea1464387c940b06e93f3ad7ecd73f782f60"
TEST = "tests/sic-observed-pressure-reserve.test.ts"
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("reference", type=Path)
parser.add_argument("candidate", type=Path)
parser.add_argument("candidate_sha")
parser.add_argument("output", type=Path)
parser.add_argument("--one", action="store_true", help="Only replay the crossing-before-closure case")
parser.add_argument("--node", default="node")
args = parser.parse_args()

base = "0aef4289e97ce094782dfd03f5a79ace6eae5fd2"
source = git("show", f"{PORT}:{TEST}").decode("utf8")
git("merge-base", "--is-ancestor", base, args.candidate_sha)
check(len(args.candidate_sha) == 40, "Pass the full candidate SHA")
args.output.mkdir(parents=True)
arms = {}
for label, checkout, expected in (("A", args.reference, base), ("B", args.candidate, args.candidate_sha)):
    checkout = checkout.resolve()
    check(git("rev-parse", "HEAD", cwd=checkout).decode().strip() == expected, "Unexpected engine SHA")
    git("diff", "--exit-code", expected, "--", "src", "reference", "public/python", cwd=checkout)
    # Only redirect the sealed test's imports. The routes, controls and assertions are unchanged.
    test = args.output / (label + ".test.mts")
    redirected, imports = re.subn(r"'(\.\./src/)([^']+)'", lambda m: "'" + (checkout / "src" / m[2]).as_uri() + "'", source)
    check(imports == 6, "Unexpected imports in the sealed test")
    test.write_text(redirected, encoding="utf8", newline="\n")
    flags = ["--test-name-pattern=crossing is observed before gate closure"] if args.one else []
    log = args.output / (label + ".log")
    with log.open("xb") as stream:
        subprocess.run([args.node, "--test", "--test-reporter=tap", *flags, str(test.resolve())],
                       cwd=ROOT, stdout=stream, stderr=subprocess.STDOUT, check=True)
    diagnostics = [json.loads(line[2:]) for line in log.read_text(encoding="utf8").splitlines()
                   if line.startswith('# {"gateClosedAt":')]
    check([(d["crossingAt"], d["gateClosedAt"], d["actions"]) for d in diagnostics]
          == ([(6, 14, 32)] if args.one else [(6, 14, 32), (12, 6, 32)]), "Missing pressure recovery case")
    check(git("rev-parse", "HEAD", cwd=checkout).decode().strip() == expected, "Engine SHA changed during replay")
    git("diff", "--exit-code", expected, "--", "src", "reference", "public/python", cwd=checkout)
    arms[label] = {"source": expected, "scenarios": diagnostics}
result = {**arms, "equal": arms["A"]["scenarios"] == arms["B"]["scenarios"]}
(args.output / "report.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf8", newline="\n")
print(json.dumps(result))
raise SystemExit(int(not result["equal"]))
