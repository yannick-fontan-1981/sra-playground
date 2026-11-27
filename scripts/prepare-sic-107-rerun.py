"""Bind the validated 107-game GitHub workflow to an exact source commit."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

TEMPLATE_COMMIT = "9d730b984b88268162f6de4e51615422e727750a"
REFERENCE_SOURCE = "0fe417b2e91bb8ca15573e82b79b7081157aeb37"
REFERENCE_TREE = "359b57d62ee36110cfb349496eabe13d4ebfb13a"
WORKFLOW_PATH = Path(".github/workflows/sic-campaign-107.yml")
BASELINE_PATH = "docs/diagnostics/sic-107-4a546a13-20261126/manifest.json"
BUDGET_INPUTS = (
    "docs/architecture/sic-replay-reference-levels-20261126.json",
    "docs/architecture/sic-v8-level6-campaign-7bb9f152.json",
    "scripts/sic-replay-budgets.mjs",
)


def git(*args: str) -> bytes:
    return subprocess.check_output(("git", *args))


def read_at(commit: str, path: str) -> bytes:
    return git("show", f"{commit}:{path}")


def prepare(source: str) -> tuple[dict, bytes]:
    if not re.fullmatch(r"[0-9a-f]{40}", source):
        raise ValueError("Pass the complete hexadecimal source commit")
    if git("rev-parse", f"{source}^{{commit}}").decode().strip() != source:
        raise ValueError("The source must identify a commit")
    tree = git("rev-parse", f"{source}^{{tree}}").decode().strip()
    baseline = json.loads(read_at(source, BASELINE_PATH))
    reference = json.loads(read_at(REFERENCE_SOURCE, BASELINE_PATH))
    for key in ("expectedCodes", "expectedLevelCounts", "expectedGames", "expectedLevels"):
        if baseline[key] != reference[key]:
            raise ValueError(f"The supplied source changes the reference campaign's {key}")
    for path in BUDGET_INPUTS:
        if read_at(source, path) != read_at(REFERENCE_SOURCE, path):
            raise ValueError(f"The supplied source changes the original budget input {path}")

    template = read_at(TEMPLATE_COMMIT, WORKFLOW_PATH.as_posix()).decode()
    template = template.replace(REFERENCE_SOURCE, "{frozen_source}")
    template = template.replace(REFERENCE_TREE, "{frozen_tree}")
    template = template.replace(REFERENCE_SOURCE[:8], "{source_prefix}")
    workflow = (template.replace("{frozen_source}", source).replace("{frozen_tree}", tree)
                .replace("{source_prefix}", source[:8])).encode()
    branch = f"audit/sic-107-{source[:8]}-20261127"
    return {
        "source": source,
        "tree": tree,
        "branch": branch,
        "workflow": WORKFLOW_PATH.as_posix(),
        "workflowSha256": hashlib.sha256(workflow).hexdigest(),
        "templateCommit": TEMPLATE_COMMIT,
        "games": baseline["expectedGames"],
        "levels": baseline["expectedLevels"],
        "shards": 24,
    }, workflow


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, help="Exact full commit of the solver to replay")
    parser.add_argument("--write", action="store_true", help="Write the bound workflow into its audit branch")
    args = parser.parse_args()
    try:
        info, workflow = prepare(args.source)
        if args.write:
            root = Path(git("rev-parse", "--show-toplevel").decode().strip())
            current = git("branch", "--show-current").decode().strip()
            head = git("rev-parse", "HEAD").decode().strip()
            if current != info["branch"] or head != info["source"]:
                raise ValueError(f"Use branch {info['branch']} at commit {info['source']}")
            destination = root / WORKFLOW_PATH
            if destination.exists() and destination.read_bytes() != workflow:
                raise ValueError(f"Existing workflow differs at {destination}")
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(workflow)
        print(json.dumps(info, indent=2))
    except (OSError, subprocess.CalledProcessError, ValueError) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
