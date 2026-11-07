"""Creator-side differential fixtures from unchanged DRM and MorphologyPolicy."""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
from pathlib import Path
import sys
import tempfile


SITE = Path(__file__).resolve().parents[1]
COMMIT = "786dcf51ca57773d8e3a8948ce9ea3655e7baf8e"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", type=Path, default=SITE / "reference/v6" / COMMIT / "source")
    parser.add_argument("--output", type=Path, default=SITE / "tests/fixtures/v6-drm-reference.json")
    args = parser.parse_args()
    root = args.source_root.resolve()
    sys.path[:0] = [str(root), str(root / "agents/yf_arc3_v6/laya_proto")]
    from agents.yf_arc3_v5.drm.loader import load_drm_document
    from agents.yf_arc3_v5.drm.registry import DrmRegistry
    from agents.yf_arc3_v5.drm.meaning import project_declared_alternatives
    from agents.yf_arc3_v6.morphology_policy.policy import MorphologyPolicy
    from agents.yf_arc3_v6.morphology_policy.src_runtime import plain

    sources = ("agents/yf_arc3_v5/drm/meaning.py", "agents/yf_arc3_v5/drm/fact_conditions.py",
               "agents/yf_arc3_v5/drm/fact_contracts.py", "agents/yf_arc3_v5/drm/registry.py",
               "agents/yf_arc3_v5/drm/runtime.py", "agents/yf_arc3_v6/morphology_policy/policy.py")
    manifest = json.loads((SITE / "reference/v6" / COMMIT / "manifest.json").read_text())
    checked = {}
    for name in sources:
        digest = hashlib.sha256((root / name).read_bytes()).hexdigest()
        if digest != manifest["files"][name]["sha256"]: raise ValueError("Source changed: " + name)
        checked[name] = digest

    template = {"kind": "selection_policy", "evaluation": "declared_eligibility_single",
                "supported_operators": ["SELECT"], "input_contract": "yf_arc3_v5.authority_input.selection.v1",
                "output_contract": "yf_arc3_v5.authority_output.selection.v1", "declared_alternative_refs": ["left", "right"],
                "selection_required_fact_fields": ["alternative_ref"], "reason_refs": ["reason.test"],
                "selection_eligibility_conditions": [{"field": "ok", "operator": "equals", "expected": True}]}
    conditions = [
        {"field": "flag", "operator": "equals", "expected": True},
        {"field": "flag", "operator": "not_equals", "expected": True},
        {"field": "number", "operator": "equals_reference_field", "reference_field": "reference"},
        {"field": "number", "operator": "not_equals_reference_field", "reference_field": "reference"},
        {"field": "number", "operator": "greater_than_reference_field", "reference_field": "reference"},
        {"field": "item", "operator": "member_of_reference_field", "reference_field": "items"},
        {"field": "present", "operator": "is_present"},
        {"field": "absent", "operator": "is_absent"},
        {"field": "number", "operator": "greater_than", "expected": 1},
        {"field": "number", "operator": "between_inclusive", "lower": -2, "upper": 4},
        {"field": "number", "operator": "at_most_multiple_of_field", "reference_field": "reference", "factor": 2},
    ]
    condition_policy = dict(template, id="policy.test.conditions", fact_projections=[
        {"id": "projection.test.condition_" + str(index), "all_conditions": [condition], "static_facts": {"match_" + str(index): True}}
        for index, condition in enumerate(conditions)])
    condition_policy["fact_projections"].extend([
        {"id": "projection.test.alias_gate", "all_conditions": [{"field": "interaction_kind", "operator": "equals", "expected": "point"}], "static_facts": {"alias_matches": True}},
        {"id": "projection.test.any", "any_conditions": [{"field": "flag", "operator": "equals", "expected": True}, {"field": "number", "operator": "equals", "expected": 3}], "static_facts": {"any_matches": True}},
    ])
    sequence_policy = dict(template, id="policy.test.sequence", fact_contracts=[
        {"id": "contract.test.receipt", "required_fields": ["combined", "value"], "producer_owned_fields": ["combined", "value"],
         "preserved_fields": ["combined", "value"], "preservation_modes": {"combined": "contains_all"},
         "validity_field": "contract_valid", "receipt_field": "contract_receipts"}], fact_projections=[
        {"id": "projection.test.producer", "static_facts": {"value": 2},
         "bound_facts": {"copy": "flag", "swap_a": "swap_b", "swap_b": "swap_a"},
         "templated_facts": {"label": "candidate:{alternative_ref}:{flag}:{nested}", "opaque": {"$fact": "first"}, "tree": {"payload": ["{alternative_ref}", {"$fact": "first"}]}},
         "sequence_compositions": [{"output_field": "combined", "source_fields": ["first", "second"], "max_items": 4, "unique_items": True}],
         "affine_expressions": [{"output_field": "scaled", "terms": [{"field": "number", "coefficient": 3}], "constant": -1, "divisor": 2, "max_abs_value": 100},
                                {"output_field": "shifted", "terms": [{"field": "scaled"}], "constant": 1}],
         "fact_contract_refs": ["contract.test.receipt"]},
        {"id": "projection.test.extension", "all_conditions": [{"field": "extend", "operator": "equals", "expected": True}],
         "sequence_compositions": [{"output_field": "combined", "source_fields": ["combined", "extra"], "max_items": 8, "unique_items": True}]},
        {"id": "projection.test.changed", "all_conditions": [{"field": "replace", "operator": "equals", "expected": True}], "static_facts": {"value": 7}},
        {"id": "projection.test.pairs", "all_conditions": [{"field": "pair_mode", "operator": "equals", "expected": True}],
         "sequence_compositions": [{"output_field": "pair_output", "source_fields": ["pairs", "pairs"], "item_arity": 2, "max_items": 4, "unique_items": True}]},
    ])
    empty_policy = dict(template, id="policy.test.empty", declared_alternative_refs=[], configuration={"empty_inventory_projection_ref": "projection.test.empty"})
    document = {"module_id": "test.native_projection", "declarations": [condition_policy, sequence_policy, empty_policy]}
    source = json.dumps(document, indent=2) + "\n"
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / "fixture.drm"; path.write_text(source)
        loaded = load_drm_document(path)
        registry = DrmRegistry(); registry.register(loaded)
        condition_base = {"flag": True, "number": 3, "reference": 2, "item": 1, "items": [True, 1, "1"], "present": False, "ok": True,
                          "interaction_measurement_kind": "point"}
        sequence_base = {"flag": False, "number": 3, "first": ["a", "b"], "second": ["b", "c"], "extra": ["d"],
                         "swap_a": "a", "swap_b": "b", "nested": "{tail}", "tail": "done", "ok": True}
        requests = [
            ("scalar_types", "policy.test.conditions", (), condition_base),
            ("false_vs_zero", "policy.test.conditions", (), dict(condition_base, flag=0, number=True, reference=True, item=False)),
            ("missing_and_none", "policy.test.conditions", (), {"flag": False, "number": -2, "reference": 0, "present": None}),
            ("keyed_evidence", "policy.test.conditions", ("left", "right"), {"left": condition_base, "right": dict(condition_base, ok=False, reference=3)}),
            ("sequence_affine_template_contract", "policy.test.sequence", (), sequence_base),
            ("preserve_contains_all", "policy.test.sequence", (), dict(sequence_base, extend=True, pair_mode=True, pairs=[["a", "b"], ["c", "d"]])),
            ("contract_refuted", "policy.test.sequence", (), dict(sequence_base, replace=True)),
            ("no_truncation", "policy.test.sequence", (), dict(sequence_base, second=["b", "c", "d"])),
            ("affine_indivisible", "policy.test.sequence", (), dict(sequence_base, number=2)),
            ("affine_bounded", "policy.test.sequence", (), dict(sequence_base, number=99)),
            ("affine_rejects_boolean", "policy.test.sequence", (), dict(sequence_base, number=True)),
            ("template_unbound", "policy.test.sequence", (), {k: v for k, v in sequence_base.items() if k != "tail"}),
            ("declared_empty_domain", "policy.test.empty", (), {}),
            ("undeclared_empty_with_evidence", "policy.test.empty", (), {"unexpected": True}),
        ]
        projections = []
        for identity, policy_ref, alternatives, facts in requests:
            value = {"id": identity, "policy": policy_ref, "alternatives": list(alternatives), "facts": facts}
            try:
                result = project_declared_alternatives(drm=registry, selection_policy_ref=policy_ref,
                    alternative_refs=alternatives, descriptive_facts=facts)
                value["expected"] = result.model_dump(mode="json")
            except Exception as error:
                value["error"] = str(error)
            projections.append(value)

    policy = MorphologyPolicy()
    base = {"observation_ref": "reference:epoch:1:revision:1", "level_epoch": 1, "framed_pair": True, "homologous": True,
            "asymmetric": True, "control_attested": True, "single_pattern_contact_change": True, "alignment_refuted": False,
            "orientation_relation": "aligned", "color_relation": "equal", "controlled_xy": [4, 4]}
    morph_cases = [("empty_measurement", {"observation_ref": base["observation_ref"], "level_epoch": 1}), ("retained_no_route", base)]
    for name, overrides in [
        ("modifier", {"orientation_relation": "different"}), ("peer", {}),
        ("peer_access_probe", {"peer_discrimination_bound": True}),
        ("feature_probe", {"color_relation": "different", "extension_route": "feature_probe"}),
        ("capacity_probe", {"capacity_needed": True}), ("capacity_access_probe", {"capacity_needed": True}),
        ("managed_access", {"managed_capacity_bound": True}),
        ("entry_rebind", {"entry_rebind_bound": True, "control_attested": False}), ("entry_probe", {"entry_probe_bound": True}),
    ]:
        route = {"observation_ref": base["observation_ref"], "level_epoch": 1, "start_xy": [4, 4], "end_xy": [4, 5],
                 "actions": [{"action_ref": "ACTION2", "data": {}}], "contact_in_prefix": True}
        facts = {**base, **overrides, name + "_xy": [4, 5], "routes": {name: route}}
        morph_cases.append((name + "_bound", facts))
        morph_cases.append((name + "_no_forecast_reserve", {**facts, "meter_forecast": {"steps_before_empty": 0}}))
        morph_cases.append((name + "_stale", {**facts, "routes": {name: {**route, "level_epoch": 2}}}))
    morph_cases.extend([
        ("refuted", {**base, "alignment_refuted": True}),
        ("ambiguous_orientation", {**base, "orientation_relation": "ambiguous"}),
        ("chromatic_nonunique_pose", {**base, "asymmetric": False, "color_relation": "different"}),
        ("invalid_numeric_boolean", {**base, "framed_pair": 1}),
        ("invalid_scope_boolean", {**base, "level_epoch": True}),
    ])
    morphology = []
    for identity, facts in morph_cases:
        value = {"id": identity, "facts": facts}
        try: value["expected"] = plain(policy.evaluate(copy.deepcopy(facts)))
        except Exception as error: value["error"] = str(error)
        morphology.append(value)
    result = {"schema": "sra.v6.drm-reference.v1", "commit": COMMIT, "sourceHashes": checked,
              "document": {"text": source, "sha256": hashlib.sha256(source.encode()).hexdigest()},
              "projections": projections, "morphology": morphology}
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"projectionCases": len(projections), "morphologyCases": len(morphology),
                      "intentionalProjectionErrors": sum("error" in item for item in projections),
                      "intentionalMorphologyErrors": sum("error" in item for item in morphology)}))


if __name__ == "__main__":
    main()
