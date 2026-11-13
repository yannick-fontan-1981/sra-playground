#!/usr/bin/env python3
"""Read-only original 512/513 domain audit; no native wrapper expectations."""
from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
COMMIT = "786dcf51ca57773d8e3a8948ce9ea3655e7baf8e"
SOURCE = ROOT / "reference/v6" / COMMIT / "source"
LAYA = SOURCE / "agents/yf_arc3_v6/laya_proto"
sys.path[:0] = [str(SOURCE), str(LAYA)]
from common_mechanisms import assess_transition, construct_empirical_rule, validate_empirical_rule
from common_property_rewrites import assess_property_transition


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()


def observation(reference, count):
    return {
        "observation_ref": reference, "frame_hash": hashlib.sha256(reference.encode()).hexdigest()[:16],
        "revision": 0, "level_epoch": 1, "coordinate_basis": "screen", "state": "NOT_FINISHED",
        "levels_completed": 0, "available_action_refs": ["ACTION1", "ACTION6"],
        "entities": [{"id": "public:" + str(index), "signature": {"palette_value": 2, "shape": [[0, 0]]},
                      "position": [index % 32, index // 32], "mask": [[0, 0]],
                      "palette_value": 2, "area": 1, "scale": 1} for index in range(count)],
    }


def main():
    command = {"action_ref": "ACTION6", "data": {"x": 1, "y": 1}}
    candidate = construct_empirical_rule(observation("prior-before", 1), observation("prior-after", 1), command)
    functions = {
        "construct_empirical_rule": construct_empirical_rule,
        "validate_empirical_rule": lambda before, after, action: validate_empirical_rule(candidate, before, after, action),
        "assess_transition": assess_transition,
        "assess_property_transition": assess_property_transition,
    }
    cases = []
    for before_count, after_count in ((512, 512), (513, 512), (512, 513)):
        before = observation("boundary-before", before_count)
        after = observation("boundary-after", after_count)
        for name, function in functions.items():
            unchanged = copy.deepcopy([before, after, command, candidate])
            result = {"function": name, "beforeEntities": before_count, "afterEntities": after_count,
                      "inputSha256": digest([before, after, command])}
            try:
                value = function(before, after, command)
                result.update(accepted=True, resultSha256=digest(value),
                              resultKeys=sorted(value),
                              resultStatus=value.get("status"),
                              libraryStatus=value.get("library", {}).get("status"),
                              constructionStatus=value.get("construction", {}).get("status"),
                              ruleCount=len(value.get("empirical_rules", value.get("property_rules", []))))
            except ValueError as error:
                result.update(accepted=False, errorType=type(error).__name__, error=str(error))
            assert [before, after, command, candidate] == unchanged, name + " changed its supplied inputs"
            assert result["accepted"] == (before_count <= 512 and after_count <= 512), result
            if not result["accepted"]:
                assert result["error"] == "Neutral entity measurement domain exceeded", result
            cases.append(result)
    paths = ["common_mechanisms.py", "common_property_rewrites.py", "common_frontier_runtime.py", "prospective_contact_adapter.py"]
    report = {
        "schema": "v6-original-neutral-domain-audit.v1", "commit": COMMIT,
        "sourceMethod": "Direct unchanged original-function calls; no source rewriting, injected catch, or native expectation.",
        "sourceHashes": {str((LAYA / path).relative_to(SOURCE)): hashlib.sha256((LAYA / path).read_bytes()).hexdigest() for path in paths},
        "generator": str(Path(__file__).relative_to(ROOT)),
        "generatorSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "inputRecipe": "observation(reference, count) in the generator: distinct public one-pixel positions, repeated measured signature, complete neutral fields; public ACTION6(1,1). No game or solution input.",
        "qualification": "Pure-function domain evidence only. The V6 common caller does not isolate this exception; any V7 continuation outside the domain is an explicit robustness extension, not caller parity.",
        "sourceCaller": {"module": "agents/yf_arc3_v6/laya_proto/common_frontier_runtime.py",
                         "ordinaryAssessmentLines": [1322, 1326, 1332], "officialBoundarySkipLines": [1256, 1316],
                         "fatalCatchAndRethrowLines": [1518, 1540]},
        "existing513Oracle": {"fixture": "tests/fixtures/v6-transition-reference.json",
                             "case": "too_many_neutral_entities", "function": "construct_empirical_rule",
                             "test": "tests/v6-transition-learning.test.ts"},
        "cases": cases,
    }
    output = ROOT / "docs/migration/native-campaigns-v35/neutral-domain-original.json"
    output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"path": str(output.relative_to(ROOT)), "cases": len(cases),
                      "accepted512": sum(case["accepted"] for case in cases),
                      "rejected513": sum(not case["accepted"] for case in cases)}))


if __name__ == "__main__":
    main()
