"""Two question measurements and one Source decision transport, no B kernel mutation."""
from .b_extension_supposition_contracts_c import (
    GuardedTransportSuppositionInputC, QueuedCascadeSuppositionInputC,
    BExtensionSuppositionDecisionInputC, BExtensionSuppositionDecisionC)
from .b_extension_supposition_c import (
    measure_guarded_transport_supposition, measure_queued_cascade_supposition,
    assemble_b_extension_supposition)
from .goal_supposition_contracts_c import GoalSuppositionFactsC

B_EXTENSION_SUPPOSITION_C_TYPES = (
    "ReceivingPositionC", "GuardedTransportSuppositionInputC", "CascadeQuotaObservationC",
    "QueuedCascadeSuppositionInputC", "BExtensionSuppositionDecisionInputC", "BExtensionSuppositionDecisionC")
B_EXTENSION_SUPPOSITION_C_ENTRIES = (
    ("capability.guarded_transport_supposition_facts_c", measure_guarded_transport_supposition,
        GuardedTransportSuppositionInputC, GoalSuppositionFactsC),
    ("capability.queued_cascade_supposition_facts_c", measure_queued_cascade_supposition,
        QueuedCascadeSuppositionInputC, GoalSuppositionFactsC),
    ("capability.b_extension_supposition_assembly_c", assemble_b_extension_supposition,
        BExtensionSuppositionDecisionInputC, BExtensionSuppositionDecisionC))


def b_extension_supposition_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=before,
        output_model=after, source_file="b_extension_supposition_c.py",
        applicability=("current_consumer_and_observed_structural_features",),
        invariants=("revisable_question_only", "three_value_conditions", "whole_required_population",
            "actual_complete_transaction_and_checkpoint", "no_act_law_role_or_priority_confirmation"),
        falsifiers=("stale_unsealed_or_duplicate_observation", "incomplete_population_or_transaction", "unknown_quota_or_checkpoint"))
        for ref, method, before, after in B_EXTENSION_SUPPOSITION_C_ENTRIES)


def b_extension_supposition_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    result = {ref: ((parameter("request", before.__name__),), after.__name__)
        for ref, _, before, after in B_EXTENSION_SUPPOSITION_C_ENTRIES}
    result["capability.b_extension_supposition_assembly_c"] = ((parameter("request", "Any"),
        parameter("measured", "GoalSuppositionFactsC"), parameter("source_disposition_ref", "Any"),
        parameter("source_policy_ref", "String"), parameter("source_reason_ref", "String"),
        parameter("source_registration_admissible", "Boolean")), "BExtensionSuppositionDecisionC")
    return result
