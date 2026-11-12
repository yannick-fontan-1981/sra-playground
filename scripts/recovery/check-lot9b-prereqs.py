#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

V6_CORE = [
    "src/logos-engine/v6-operations.ts",
    "src/logos-engine/v6-composition-engine.ts",
    "src/logos-engine/v6-native-authority.ts",
    "src/logos-engine/v6-target-binding.ts",
    "src/logos-engine/v6-operation-cache.ts",
    "src/logos-engine/v6-operation-cycle.ts",
    "src/logos-engine/v6-operation-trace.ts",
]

REQUIRED_FOR_OFFICIAL_069 = [
    "scripts/measure-native-loop-costs.mjs",
    "tests/helpers/v6-live-game-campaign.ts",
    "src/runtime/v6-agent-worker.ts",
    "docs/migration/v6-delivery-roadmap.md",
]

REGION_HINTS = (
    "region_intervention",
    "public_region_intervention",
    "v6.region_intervention.choose",
)


def git(*args: str) -> str:
    return subprocess.check_output(["git", "-C", str(ROOT), *args], text=True).strip()


def scan_region_hits() -> list[dict[str, object]]:
    hits: list[dict[str, object]] = []
    excluded_prefixes = ("docs/recovery/", "scripts/recovery/")
    for path in ROOT.rglob("*"):
        if not path.is_file() or ".git" in path.parts:
            continue
        relative = path.relative_to(ROOT).as_posix()
        if relative.startswith(excluded_prefixes):
            continue
        try:
            size = path.stat().st_size
        except OSError:
            continue
        if size > 5_000_000:
            continue
        try:
            source = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        found = [hint for hint in REGION_HINTS if hint in source]
        if found:
            hits.append({"path": relative, "hints": found})
    return hits


def main() -> int:
    missing_core = [path for path in V6_CORE if not (ROOT / path).is_file()]
    missing_official = [path for path in REQUIRED_FOR_OFFICIAL_069 if not (ROOT / path).is_file()]
    region_hits = scan_region_hits()

    result = {
        "git_head": git("rev-parse", "HEAD"),
        "git_branch": git("branch", "--show-current"),
        "v6_core": {
            "required": V6_CORE,
            "missing": missing_core,
            "present": not missing_core,
        },
        "region_integration_hits": region_hits,
        "region_reconstructed": bool(region_hits),
        "official_069_prerequisites": {
            "required": REQUIRED_FOR_OFFICIAL_069,
            "missing": missing_official,
        },
        "ready_for_region_functional_qualification": not missing_core and bool(region_hits),
        "ready_for_official_069_benchmark": (
            not missing_core and bool(region_hits) and not missing_official
        ),
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
