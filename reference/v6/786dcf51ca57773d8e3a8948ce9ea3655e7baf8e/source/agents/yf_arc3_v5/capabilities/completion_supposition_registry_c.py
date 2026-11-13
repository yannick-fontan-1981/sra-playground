"""Seven completion questions preserve acquired receipts and real physical population scope."""
from .completion_supposition_contracts_c import (RelayOpticsSuppositionInputC, VisualSequenceSuppositionInputC, SupportedConstructionSuppositionInputC, AlignmentGameSuppositionInputC, BoundedJoystickSuppositionInputC, NeighborhoodSuppositionInputC, LayeredPrefixSuppositionInputC,
    CompletionSuppositionDecisionInputC, CompletionSuppositionDecisionC)
from .goal_supposition_contracts_c import GoalSuppositionFactsC
from .completion_supposition_c import (measure_relay_optics_supposition, measure_visual_sequence_supposition, measure_supported_construction_supposition, measure_alignment_game_supposition, measure_bounded_joystick_supposition, measure_neighborhood_supposition, measure_layered_prefix_supposition, assemble_completion_supposition)

COMPLETION_SUPPOSITION_C_TYPES = ("RelayOpticsSuppositionInputC", "QuestionReceiptC", "VisualSequenceSuppositionInputC", "ConstructionBeamC", "SupportedConstructionSuppositionInputC", "AlignmentAcquisitionC", "AlignmentGameSuppositionInputC", "BoundedJoystickSuppositionInputC", "NeighborhoodSiteC", "NeighborhoodSuppositionInputC", "ThreadPrefixC", "LayeredPrefixSuppositionInputC", "CompletionSuppositionDecisionInputC", "CompletionSuppositionDecisionC")
COMPLETION_ROWS_C = (
    ("capability.relay_optics_supposition_facts_c", measure_relay_optics_supposition, RelayOpticsSuppositionInputC),
    ("capability.visual_sequence_supposition_facts_c", measure_visual_sequence_supposition, VisualSequenceSuppositionInputC),
    ("capability.supported_construction_supposition_facts_c", measure_supported_construction_supposition, SupportedConstructionSuppositionInputC),
    ("capability.alignment_acquisition_supposition_facts_c", measure_alignment_game_supposition, AlignmentGameSuppositionInputC),
    ("capability.bounded_joystick_supposition_facts_c", measure_bounded_joystick_supposition, BoundedJoystickSuppositionInputC),
    ("capability.neighborhood_supposition_facts_c", measure_neighborhood_supposition, NeighborhoodSuppositionInputC),
    ("capability.layered_prefix_supposition_facts_c", measure_layered_prefix_supposition, LayeredPrefixSuppositionInputC),
)


def completion_supposition_entries_c(entry_factory):
    rows = tuple((ref, method, before, GoalSuppositionFactsC) for ref, method, before in COMPLETION_ROWS_C)
    rows += (("capability.completion_supposition_assembly_c", assemble_completion_supposition,
        CompletionSuppositionDecisionInputC, CompletionSuppositionDecisionC),)
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=before, output_model=after,
        source_file="completion_supposition_c.py", applicability=("current_consumer_and_explicit_completion_evidence",),
        invariants=("existing_mask_and_three_value_methods", "whole_requested_scope", "real_acquisition_and_provenance",
            "no_new_physics_or_route", "no_act_or_confirmed_terminal"),
        falsifiers=("foreign_scope_or_receipt", "unqualified_ancestry_or_access", "incomplete_current_population"))
        for ref, method, before, after in rows)


def completion_supposition_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    result = {ref: ((parameter("request", before.__name__),), "GoalSuppositionFactsC")
        for ref, _, before in COMPLETION_ROWS_C}
    result["capability.completion_supposition_assembly_c"] = ((parameter("request", "Any"),
        parameter("measured", "GoalSuppositionFactsC"), parameter("source_disposition_ref", "Any"),
        parameter("source_policy_ref", "String")), "CompletionSuppositionDecisionC")
    return result
