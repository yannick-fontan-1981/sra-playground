#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REQUIRED = [
    "scripts/measure-native-loop-costs.mjs",
    "tests/helpers/v6-live-game-campaign.ts",
    "src/runtime/v6-agent-worker.ts",
    "docs/migration/v6-delivery-roadmap.md",
]
REGION_HINTS = [
    "region_intervention",
    "public_region_intervention",
    "v6.region_intervention.choose",
]


def git(*args: str) -> str:
    return subprocess.check_output(["git", "-C", str(ROOT), *args], text=True).strip()


def main() -> int:
    missing = [p for p in REQUIRED if not (ROOT / p).is_file()]
    region_hits: list[dict[str, object]] = []
    for path in ROOT.rglob("*"):
        if not path.is_file() or ".git" in path.parts:
            continue
        if "docs/recovery" in path.as_posix() or "scripts/recovery" in path.as_posix():
            continue
        if path.stat().st_size > 5_000_000:
            continue
        try:
            source = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        hits = [hint for hint in REGION_HINTS if hint in source]
        if hits:
            region_hits.append({"path": str(path.relative_to(ROOT)), "hints": hits})

    result = {
        "git_head": git("rev-parse", "HEAD"),
        "git_branch": git("branch", "--show-current"),
        "required_files": REQUIRED,
        "missing_required_files": missing,
        "region_hits": region_hits,
        "ready_for_official_069_benchmark": not missing and bool(region_hits),
        "benchmark_contract": {
            "order": ["A1", "B1", "B2", "A2"],
            "games": ["STCK", "SMLP"],
            "measured_sessions": 32,
            "measured_actions": 400,
            "warmup_sessions": 8,
            "warmup_actions": 24,
            "global_threshold_percent": 10.0,
            "threshold_is_strict": True,
            "phase_overrun_allowed_when_same_game_global_passes": True,
            "cross_game_compensation_allowed": False,
            "sample_removal_allowed": False,
        },
    }
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result["ready_for_official_069_benchmark"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
