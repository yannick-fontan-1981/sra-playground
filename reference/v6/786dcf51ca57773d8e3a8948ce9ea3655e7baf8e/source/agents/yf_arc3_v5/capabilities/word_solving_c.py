"""Current Source word constraints and revision joins; existing K30 owns math."""
from agents.yf_arc3_v5.logos.types import FrozenMap, immutable_json_data, stable_digest
from .mechanical_return_a import mechanical_request_identity_a
from .family_agenda_projection import project_family_agenda, demand_signature, FamilyAgendaReceipt
from .word_solving_contracts_c import WordSolvingFactsC, WordSolvingReturnC, WordJoinFactsC
from .family_result_join import FamilyJoinCandidate, FamilyJoinGroup, FamilyJoinRequest

def measure_word_solving(request, canonical_rows):
    native, why, agenda, demand = request.native_request, request.why, request.agenda, request.demand
    missing, partitions, invalidated, preserved = [], [], [], []
    identity = mechanical_request_identity_a(native, "mechanics.typed_word_transduction", native.scope,
        native.operation_ref, native.mode)
    if (demand.request != identity or demand not in agenda.demands or demand.parent_goal_ref != why.parent_goal_ref
            or native.scope.parent_goal_ref != why.parent_goal_ref or demand.consumer_ref != why.consumer_ref
            or demand.episode_ref != why.episode_ref or demand.level_scope_ref != why.level_scope_ref
            or not why.usefulness_premise_refs or not why.morphology_premise_refs):
        missing.append("exact_current_word_parent_why_and_question")
    if (len(canonical_rows) != 1 or canonical_rows[0].get("family_agenda") != immutable_json_data(agenda)
            or not canonical_rows[0].get("supported_agenda_claim_refs")):
        missing.append("current_canonical_word_parent_agenda")
    rows = tuple(row for row in project_family_agenda(agenda)["rows"]
        if row["signature_ref"] == demand_signature(demand)
        and row["demand"]["request"]["request_ref"] == demand.request.request_ref)
    if (len(rows) != 1 or not rows[0]["owner_current"] or not rows[0]["current_inputs_bound"]
            or not rows[0]["prerequisites_current"] or rows[0]["conflicting_current_returns"]
            or rows[0]["consumed_current_signature"]):
        missing.append("next_prerequisite_satisfied_unconsumed_word_question")
    if (native.operation_ref, native.mode) not in native.signature_pairs:
        missing.append("registered_exact_K30_operation_mode")
    contract = request.relation_contract
    if (not contract.connector_evidence_refs or not contract.relation_evidence_refs
            or contract.fixed_examples and not contract.fixed_example_evidence_refs
            or contract.evidence_revision_ref != native.scope.evidence_revision_ref
            or contract.type_pipeline[0] != contract.input_type_ref
            or contract.type_pipeline[-1] != contract.output_type_ref
            or native.input_word is not None and native.input_word != contract.input_word
            or native.input_type_ref is not None and native.input_type_ref != contract.input_type_ref
            or native.output_type_ref is not None and native.output_type_ref != contract.output_type_ref
            or native.type_pipeline is not None and native.type_pipeline != contract.type_pipeline
            or native.fixed_examples is not None and native.fixed_examples != contract.fixed_examples
            or why.desired_future.get("word_relation_contract_digest") != stable_digest(immutable_json_data(contract))):
        missing.append("grounded_connector_type_word_relation_and_preserved_fixed_examples")
    if native.operation_ref == "mechanics.typed_word_transduction.dictionary_constraints" and not contract.fixed_examples:
        missing.append("fixed_example_required_for_dictionary_synthesis")
    units = {unit.unit_ref: unit for unit in native.edit_units or ()}
    rules = {rule.rule_ref: rule for rule in native.rules or ()}
    for unit_ref in sorted(units):
        unit = units[unit_ref]
        current = tuple(variant for variant in unit.variants if variant.phase_ref == unit.current_phase_ref)
        if len(current) == 1:
            for rule in current[0].rules:
                if rule.rule_ref in rules and rules[rule.rule_ref] != rule:
                    missing.append("consistent_current_rule_across_shared_edit_units")
                rules[rule.rule_ref] = rule
    work = (len(request.side_bindings) + sum(len(side.glyph_refs) for side in request.side_bindings)
        + sum(sum(len(rule.left)+len(rule.right) for rule in variant.rules)
            for unit_ref in sorted(units) for variant in units[unit_ref].variants)
        + sum(len(use.rule_refs) for use in request.derivation_uses)
        + sum(len(tile.allowed_identity_transforms) for tile in native.tiles or ()))
    if work > native.maximum_examined:
        return WordSolvingFactsC(frozen_input=request, facts=FrozenMap({"current_word_question": False}),
            partition_rows=(), invalidated_derivation_refs=(), preserved_derivation_refs=(),
            missing_refs=tuple(sorted(set((*missing, "word_reason_preparation_bound")))))
    side_keys = set()
    for side in request.side_bindings:
        rule = rules.get(side.rule_ref)
        key = (side.rule_ref, side.side)
        if (key in side_keys or rule is None or not side.partition_evidence_refs
                or not side.tile_frame_evidence_refs or side.edit_unit_ref is not None and side.edit_unit_ref not in units):
            missing.append("separate_grounded_tile_rule_side_and_edit_unit_partition")
            continue
        side_keys.add(key)
        word = rule.left if side.side == "LEFT" else rule.right
        type_ref = rule.input_type_ref if side.side == "LEFT" else rule.output_type_ref
        if word != side.glyph_refs or type_ref != side.type_ref:
            missing.append("current_rule_side_word_and_type_binding")
            continue
        partitions.append(FrozenMap({"side_ref": side.side_ref, "rule_ref": side.rule_ref,
            "side": side.side, "type_ref": side.type_ref, "glyph_refs": side.glyph_refs,
            "edit_unit_ref": side.edit_unit_ref, "partition_evidence_refs": side.partition_evidence_refs,
            "tile_frame_evidence_refs": side.tile_frame_evidence_refs}))
    if rules and side_keys != {(ref, side) for ref in sorted(rules) for side in ("LEFT", "RIGHT")}:
        missing.append("complete_current_rule_side_partition")
    for tile in native.tiles or ():
        for transform in tile.allowed_identity_transforms:
            if not request.transform_evidence_by_ref.get(transform.transform_ref):
                missing.append("evidenced_whole_tile_identity_transform_preserving_type_and_semantic_orientation")
    observations = {row.unit_ref: row for row in request.edit_evidence}
    if len(observations) != len(request.edit_evidence):
        missing.append("unique_current_edit_unit_evidence")
    for unit_ref in sorted(units):
        unit, observed = units[unit_ref], observations.get(unit_ref)
        if (observed is None or not observed.sealed or observed.epoch != native.scope.epoch
                or observed.evidence_revision_ref != native.scope.evidence_revision_ref
                or observed.observed_phase_ref != unit.current_phase_ref or not observed.focus_evidence_refs
                or not observed.effect_evidence_refs or not observed.fixed_example_preservation_refs):
            missing.append("current_focus_effect_revalidated_editability_with_fixed_example_preserved")
            continue
        if observed.cyclic_modulus is not None:
            if not observed.shared_side_evidence_refs:
                missing.append("grounded_whole_side_shared_cyclic_edit")
                continue
            baseline = next(variant for variant in unit.variants if variant.phase_ref == unit.current_phase_ref)
            baseline_rules = {rule.rule_ref: rule for rule in baseline.rules}
            shared_sides = tuple(side for side in request.side_bindings if side.edit_unit_ref == unit_ref)
            if not shared_sides:
                missing.append("shared_cyclic_control_bound_to_actual_rule_sides")
            for variant in unit.variants:
                if {rule.rule_ref for rule in variant.rules} != set(baseline_rules):
                    missing.append("shared_phase_preserves_rule_identity_domain")
                    continue
                shifts = set()
                variant_rules = {rule.rule_ref: rule for rule in variant.rules}
                for side in shared_sides:
                    before_rule, after_rule = baseline_rules.get(side.rule_ref), variant_rules.get(side.rule_ref)
                    if before_rule is None or after_rule is None:
                        missing.append("shared_side_rule_present_in_whole_edit_unit")
                        continue
                    before = before_rule.left if side.side == "LEFT" else before_rule.right
                    after = after_rule.left if side.side == "LEFT" else after_rule.right
                    a = tuple(observed.symbol_values.get(ref) for ref in before)
                    b = tuple(observed.symbol_values.get(ref) for ref in after)
                    if len(a) != len(b) or any(type(value) is not int for value in (*a, *b)):
                        missing.append("shared_phase_complete_whole_side_symbol_domain")
                    else:
                        shifts.update((y-x) % observed.cyclic_modulus for x,y in zip(a,b))
                if len(shifts) > 1:
                    missing.append("one_cyclic_shift_for_all_glyphs_of_shared_edit_side")
                for rule in variant.rules:
                    original = baseline_rules[rule.rule_ref]
                    for before, after in ((original.left, rule.left), (original.right, rule.right)):
                        a = tuple(observed.symbol_values.get(ref) for ref in before)
                        b = tuple(observed.symbol_values.get(ref) for ref in after)
                        if len(a) != len(b) or any(type(value) is not int for value in (*a, *b)):
                            missing.append("grounded_shared_side_length_and_symbol_cycle_domain")
                        elif a and tuple((x-a[0]) % observed.cyclic_modulus for x in a) != tuple(
                                (x-b[0]) % observed.cyclic_modulus for x in b):
                            missing.append("shared_side_internal_cyclic_differences_preserved")
    if len({use.derivation_ref for use in request.derivation_uses}) != len(request.derivation_uses):
        missing.append("unique_derivation_dependency_identity")
    for use in request.derivation_uses:
        if not use.evidence_refs or set(use.rule_refs) != set(use.rule_revision_by_ref):
            missing.append("grounded_complete_derivation_rule_dependencies")
            continue
        if any(ref not in request.current_rule_revisions for ref in use.rule_refs):
            missing.append("current_revision_of_every_shared_rule_dependency")
            continue
        destination = invalidated if any(request.current_rule_revisions[ref] != use.rule_revision_by_ref[ref]
            for ref in use.rule_refs) else preserved
        destination.append(use.derivation_ref)
    if len({row.unit_ref for row in request.preserved_units}) != len(request.preserved_units):
        missing.append("unique_explicit_correct_unit_preservation")
    for support in request.preserved_units:
        unit = units.get(support.unit_ref)
        related_rules = {rule.rule_ref for variant in unit.variants
            if variant.phase_ref == unit.current_phase_ref for rule in variant.rules} if unit is not None else set()
        cited_rules = {ref for use in request.derivation_uses
            if use.derivation_ref in support.supporting_derivation_refs for ref in use.rule_refs}
        if (unit is None or not support.evidence_refs or not support.supporting_derivation_refs
                or support.preservation_ref not in why.preservation_refs
                or not set(support.supporting_derivation_refs) <= set(preserved)
                or not related_rules.intersection(cited_rules)):
            missing.append("correct_unit_preservation_supported_by_current_unaffected_derivations")
            continue
        if native.operation_ref == "mechanics.typed_word_transduction.visit_cost":
            if (native.target_phase_refs is None or native.target_phase_refs.get(unit.unit_ref) != unit.current_phase_ref
                    or support.preservation_ref not in native.scope.assumption_refs
                    or any(arc.from_phase_ref != arc.to_phase_ref for arc in unit.arcs)):
                missing.append("explicit_preservation_restricted_cost_domain_keeps_correct_unit_unchanged")
    return WordSolvingFactsC(frozen_input=request, facts=FrozenMap({"current_word_question": not bool(missing)}),
        partition_rows=tuple(partitions), invalidated_derivation_refs=tuple(sorted(invalidated)),
        preserved_derivation_refs=tuple(sorted(preserved)), missing_refs=tuple(sorted(set(missing))))

def bind_word_solving(value):
    return value.measured.frozen_input.native_request

def finish_word_solving(value):
    request, returned = value.measured.frozen_input, value.returned
    receipt, reasons = FrozenMap(), FrozenMap()
    if returned is not None and returned.request == request.demand.request and not value.measured.missing_refs:
        receipt = immutable_json_data(FamilyAgendaReceipt(
            receipt_ref="receipt.word_solving."+stable_digest((request.demand, returned)),
            demand=request.demand, result=returned))
        calculation = returned.descriptive_values.get("calculation")
        native_values = calculation.get("values") if isinstance(calculation, FrozenMap) else None
        if isinstance(native_values, FrozenMap):
            # Keep the native domains whole. These relations do not commit a parse or edit.
            reasons = FrozenMap({"word_relation_contract": immutable_json_data(request.relation_contract),
                "native_operation_ref": request.native_request.operation_ref,
                "complete_native_values": native_values,
                "partition_rows": value.measured.partition_rows,
                "invalidated_derivation_refs": value.measured.invalidated_derivation_refs,
                "preserved_derivation_refs": value.measured.preserved_derivation_refs,
                "preserved_edit_units": tuple(immutable_json_data(row) for row in request.preserved_units),
                "why": immutable_json_data(request.why)})
    join, composition_missing = None, []
    if request.join_request_ref is not None:
        peers = tuple(candidate for group in request.peer_groups for candidate in group.candidates)
        refs = tuple(candidate.candidate_ref for candidate in peers)
        group_refs = tuple(group.group_ref for group in request.peer_groups)
        supports = tuple(support.candidate_ref for support in request.join_supports)
        if (not receipt or returned.status != "FOUND" or not request.join_supports
                or len(set(refs)) != len(refs) or len(set(supports)) != len(supports)
                or len(set(group_refs)) != len(group_refs)
                or set(refs) & set(supports) or len(peers)+len(supports) > 256
                or any(candidate.result.request.epoch != request.agenda.epoch
                    or candidate.rationale.get("parent_goal_ref") != request.why.parent_goal_ref
                    or candidate.rationale.get("episode_ref") != request.why.episode_ref
                    or candidate.rationale.get("level_scope_ref") != request.why.level_scope_ref
                    or any(ref in request.agenda.invalidated_dependency_refs
                        or request.agenda.current_dependency_revisions.get(ref) != candidate.dependency_revisions[ref]
                        for ref in sorted(candidate.dependency_revisions)) for candidate in peers)):
            composition_missing.append("exact_current_word_and_peer_domains_for_scoped_join")
        else:
            calculation = returned.descriptive_values.get("calculation")
            native_values = calculation.get("values") if isinstance(calculation, FrozenMap) else None
            if (not isinstance(native_values, FrozenMap) or calculation.get("domain_complete") is not True
                    or calculation.get("prerequisite_refs") or calculation.get("computation_bound_reached")):
                composition_missing.append("complete_exact_native_word_domain_for_scoped_join")
            else:
                candidates = []
                for support in request.join_supports:
                    row, row_bound = word_result_path(native_values, support.native_row_path)
                    assignments, resources = {}, {}
                    valid = row_bound and bool(support.evidence_refs)
                    for declared, projected in ((support.assignment_paths, assignments), (support.resource_paths, resources)):
                        if len(declared) > 256:
                            valid = False
                            break
                        for key in sorted(declared):
                            projected_value, bound = word_result_path(row, declared[key])
                            valid = valid and bound
                            projected[key] = projected_value
                    if not valid:
                        composition_missing.append("exact_declared_word_row_assignment_and_resource_paths")
                        continue
                    why = request.why
                    candidates.append(FamilyJoinCandidate(candidate_ref=support.candidate_ref, result=returned,
                        assignments=FrozenMap(assignments), resource_provenance=FrozenMap(resources),
                        dependency_revisions=request.agenda.current_dependency_revisions, preservation_refs=why.preservation_refs,
                        rationale=FrozenMap({"usefulness_premise_refs":why.usefulness_premise_refs,
                            "morphology_premise_refs":why.morphology_premise_refs,"consumer_ref":why.consumer_ref,
                            "desired_predicate":why.desired_future,"and_dependency_refs":why.and_dependency_refs,
                            "or_dependency_refs":why.or_dependency_refs,"temporal_scope_ref":why.temporal_scope_ref,
                            "evidence_status":"supported","falsifier_ref":why.falsifier_ref,
                            "parent_goal_ref":why.parent_goal_ref,"episode_ref":why.episode_ref,
                            "level_scope_ref":why.level_scope_ref,"native_row_path":support.native_row_path,
                            "evidence_refs":support.evidence_refs})))
                group_ref = request.join_request_ref+".word"
                if group_ref in tuple(group.group_ref for group in request.peer_groups):
                    composition_missing.append("distinct_word_join_group_identity")
                if not composition_missing:
                    join = FamilyJoinRequest(request_ref=request.join_request_ref,parent_goal_ref=request.why.parent_goal_ref,
                        episode_ref=request.why.episode_ref,level_scope_ref=request.why.level_scope_ref,epoch=request.agenda.epoch,
                        groups=(FamilyJoinGroup(group_ref=group_ref,candidates=tuple(candidates),domain_complete=False),*request.peer_groups),
                        max_pairs=request.maximum_join_pairs,max_candidates=request.maximum_join_candidates)
    return WordSolvingReturnC(frozen_measurement=value.measured, returned=returned, receipt=receipt,
        next_item_ref=request.why.next_item_ref,
        sibling_item_refs=tuple(demand.request.request_ref for demand in request.agenda.demands if demand != request.demand),
        result_reasons=reasons, family_join_request=join,
        composition_missing_refs=tuple(sorted(set(composition_missing))))

def word_result_path(value, path):
    if not isinstance(path, tuple) or not 1 <= len(path) <= 12:
        return None, False
    for key in path:
        if isinstance(value, FrozenMap) and isinstance(key, str) and key in value:
            value = value[key]
        elif isinstance(value, tuple) and type(key) is int and 0 <= key < len(value):
            value = value[key]
        else:
            return None, False
    return value, True

def measure_word_join(value):
    return WordJoinFactsC(returned=value.returned, facts=FrozenMap({"join_bound":value.returned.family_join_request is not None}))

def get_word_join(value):
    return value.returned.family_join_request

def return_word_join(value):
    return value.returned.model_copy(update={"family_join_result":value.joined})

def bind_word_dependency_return(value):
    measured = value.returned.measured
    if not value.returned.missing_refs:
        return measured
    return measured.model_copy(update={"facts":FrozenMap({"current_word_question":False}),
        "missing_refs":tuple(sorted(set((*measured.missing_refs,*value.returned.missing_refs))))})
