"""Five motion questions, independent of pending native K42-K46 implementation."""
from .motion_supposition_contracts_c import (AutonomousInterventionInputC, KitSurvivalInputC, HiddenReceptionInputC, BallisticSuppositionInputC, OrderedTransferSuppositionInputC,
    MotionSuppositionFactsC, MotionSuppositionDecisionInputC, MotionSuppositionDecisionC)
from .motion_supposition_c import (measure_autonomous_intervention, measure_kit_survival, measure_hidden_reception, measure_ballistic_supposition, measure_ordered_transfer_supposition, assemble_motion_supposition)

MOTION_SUPPOSITION_C_TYPES = ("PhasedMotionExampleC", "ContactConsequenceC", "AutonomousInterventionInputC", "SurvivalFieldExampleC", "KitSurvivalInputC", "VisibilityLossExampleC", "HiddenReceptionInputC", "TrajectoryPoseC", "FlightTraceC", "BallisticSuppositionInputC", "SupportHighlightExampleC", "OrderedTransferSuppositionInputC", "MotionSuppositionFactsC", "MotionSuppositionDecisionInputC", "MotionSuppositionDecisionC")
MOTION_ROWS_C = (
    ("capability.autonomous_intervention_supposition_facts_c", measure_autonomous_intervention, AutonomousInterventionInputC),
    ("capability.kit_survival_supposition_facts_c", measure_kit_survival, KitSurvivalInputC),
    ("capability.hidden_reception_supposition_facts_c", measure_hidden_reception, HiddenReceptionInputC),
    ("capability.ballistic_supposition_facts_c", measure_ballistic_supposition, BallisticSuppositionInputC),
    ("capability.ordered_transfer_supposition_facts_c", measure_ordered_transfer_supposition, OrderedTransferSuppositionInputC),
)


def motion_supposition_entries_c(entry_factory):
    rows = tuple((ref, method, before, MotionSuppositionFactsC) for ref, method, before in MOTION_ROWS_C)
    rows += (("capability.motion_supposition_assembly_c", assemble_motion_supposition,
        MotionSuppositionDecisionInputC, MotionSuppositionDecisionC),)
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=before, output_model=after,
        source_file="motion_supposition_c.py", applicability=("current_consumer_and_motion_premises",),
        invariants=("existing_mask_context_layer_methods", "no_second_motion_or_flight_physics",
            "actual_sealed_observations", "source_selects_revisable_question", "no_act_or_confirmed_law"),
        falsifiers=("foreign_scope", "unqualified_identity_or_role", "incomplete_phase_or_inventory", "work_bound"))
        for ref, method, before, after in rows)


def motion_supposition_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    result = {ref: ((parameter("request", before.__name__),), "MotionSuppositionFactsC")
        for ref, _, before in MOTION_ROWS_C}
    result["capability.motion_supposition_assembly_c"] = ((parameter("request", "Any"),
        parameter("measured", "MotionSuppositionFactsC"), parameter("source_disposition_ref", "Any"),
        parameter("source_policy_ref", "String")), "MotionSuppositionDecisionC")
    return result
