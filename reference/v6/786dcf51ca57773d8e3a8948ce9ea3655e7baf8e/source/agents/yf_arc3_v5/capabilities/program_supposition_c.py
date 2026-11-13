"""Bounded fragment/example comparisons reuse existing resource and recipe calculations."""
from .program_supposition_contracts_c import (TypedProgramSuppositionInputC, InstructionDeviceSuppositionInputC,
    RecipeOperatorSuppositionInputC, ProgramSuppositionFactsC, ProgramSuppositionDecisionInputC, ProgramSuppositionDecisionC)
from .structural_supposition_c import _scope_current
from .typed_recursive_program import measure_typed_assignment_domains
from .recipe_operator_compilation import measure_recipe_pattern_difference
from agents.yf_arc3_v5.logos.types import FrozenMap


def measure_typed_program_supposition(value: TypedProgramSuppositionInputC) -> ProgramSuppositionFactsC:
    current = _scope_current(value.scope)
    supported = (current and value.reference_word_complete and bool(value.reference_sequence_evidence_refs)
        and bool(value.resource_scope_evidence_refs))
    domains = measure_typed_assignment_domains(value.resources) if supported else None
    word, fragments, checks, bounded = value.reference_word, {}, 0, False
    if supported:
        for length in range(2, len(word)//2+1):
            for start in range(len(word)-length+1):
                if checks >= value.max_fragment_checks:
                    bounded = True
                    break
                checks += 1
                fragment = word[start:start+length]
                fragments.setdefault(fragment, []).append(start)
            if bounded:
                break
    rows = []
    for fragment in sorted(fragments):
        # Preserve every occurrence but require two nonoverlapping occurrences
        # before saying that a reusable call could reduce literal expansion.
        starts, disjoint, previous_end = tuple(fragments[fragment]), [], -1
        for start in starts:
            if start >= previous_end:
                disjoint.append(start)
                previous_end = start+len(fragment)
        if len(disjoint) >= 2:
            rows.append(FrozenMap({"fragment": fragment, "start_indices": starts,
                "nonoverlapping_start_indices": tuple(disjoint), "call_sufficiency_proved": False}))
    literal_capacity = sum("literal" in socket.accepted_instruction_kinds for socket in value.resources.sockets)
    return ProgramSuppositionFactsC(assignment_domains=domains, measurements=tuple(rows), actual_fragment_checks=checks,
        facts=FrozenMap({"scope_current": current, "reference_and_resources_supported": supported,
            "empty_sockets_supported": bool(value.empty_socket_evidence_refs),
            "typed_movable_tokens_supported": bool(value.solid_hollow_token_evidence_refs),
            "reference_exceeds_direct_literal_capacity": supported and len(word) > literal_capacity,
            "repeated_nonoverlapping_fragments_present": bool(rows), "fragment_domain_open": bounded,
            "call_tokens_present": any(token.instruction_kind == "call" for token in value.resources.tokens),
            "recursion_or_program_solution_confirmed": False}))


def measure_instruction_device_supposition(value: InstructionDeviceSuppositionInputC) -> ProgramSuppositionFactsC:
    scope, rows = value.scope, []
    current = _scope_current(scope)
    for example in value.demonstrations:
        qualified = (current and example.epoch == scope.epoch and example.revision_ref == scope.revision_ref
            and example.scope_ref == scope.scope_ref and example.module_ref in value.ordered_module_refs
            and example.sealed_observation and bool(example.evidence_refs))
        rows.append(FrozenMap({"example_ref": example.example_ref, "module_ref": example.module_ref,
            "observed_code_ref": example.observed_code_ref, "scope_qualified": qualified,
            "demonstration_changed": qualified and example.demonstration_before != example.demonstration_after,
            "world_unchanged_for_this_example": qualified and example.world_observation_complete
                and example.world_before == example.world_after,
            "universal_world_immutability_proved": False}))
    return ProgramSuppositionFactsC(measurements=tuple(rows), facts=FrozenMap({"scope_current": current,
        "ordered_modules_present": bool(value.ordered_module_refs),
        "unique_module_refs": len(set(value.ordered_module_refs)) == len(value.ordered_module_refs),
        "editable_modules_supported": bool(value.editable_module_evidence_refs),
        "execute_actuator_distinct": value.execute_actuator_ref not in value.ordered_module_refs,
        "execute_actuator_supported": bool(value.execute_actuator_evidence_refs),
        "separate_demonstration_supported": bool(value.separate_demonstration_evidence_refs),
        "code_examples_retained_separately_from_world_execution": True, "program_execution_law_confirmed": False}))


def measure_recipe_operator_supposition(value: RecipeOperatorSuppositionInputC) -> ProgramSuppositionFactsC:
    scope, rows = value.scope, []
    current = _scope_current(scope)
    supported = current and bool(value.small_pattern_example_evidence_refs) and bool(value.editable_lattice_evidence_refs)
    difference = measure_recipe_pattern_difference(value.pattern_difference) if supported else None
    for example in value.effect_examples:
        qualified = (supported and example.epoch == scope.epoch and example.revision_ref == scope.revision_ref
            and example.scope_ref == scope.scope_ref and example.interface_ref == value.interface_ref
            and example.recipe_ref == value.recipe_ref and example.recipe_transaction_sealed and bool(example.evidence_refs))
        complete = (qualified and set(example.complete_recipe_active_refs) == set(example.submitted_active_refs)
            and len(set(example.complete_recipe_active_refs)) == len(example.complete_recipe_active_refs)
            and len(set(example.submitted_active_refs)) == len(example.submitted_active_refs))
        rows.append(FrozenMap({"example_ref": example.example_ref, "interface_ref": example.interface_ref,
            "recipe_ref": example.recipe_ref, "whole_recipe_scope_qualified": complete,
            "world_effect_observed": complete and example.world_before != example.world_after,
            "effect_descriptor": example.effect_descriptor,
            "effect_rebound_to_body_click_or_walk": False}))
    return ProgramSuppositionFactsC(recipe_difference=difference, measurements=tuple(rows),
        facts=FrozenMap({"scope_current": current, "pattern_and_editable_lattice_supported": supported,
            "whole_recipe_world_effect_present": any(row["world_effect_observed"] for row in rows),
            "effect_remains_bound_to_whole_recipe_and_interface": True,
            "interface_terminal_request_proved": value.independent_interface_terminal_relation is True
                and bool(value.independent_interface_terminal_evidence_refs),
            "physical_operator_law_confirmed": False}))


def assemble_program_supposition(value: ProgramSuppositionDecisionInputC) -> ProgramSuppositionDecisionC:
    return ProgramSuppositionDecisionC(frozen_request=value.request, frozen_measurement=value.measured,
        source_disposition_ref=value.source_disposition_ref, source_policy_ref=value.source_policy_ref)
