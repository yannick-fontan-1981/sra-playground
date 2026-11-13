"""K33 pure methods and Source signatures, no Python operation dispatcher."""
from .reactive_graph_contracts_c import ReactiveGraphRequestC, ReactiveGraphResultC, ReactiveGraphSourceReturnInputC, ReactiveGraphSourceReturnC
from .reactive_graph_c import (calculate_graph_edge, calculate_graph_guards, calculate_graph_patrols, calculate_graph_followers, calculate_graph_joint, calculate_graph_calendar, calculate_graph_equivalence, calculate_graph_detour, calculate_graph_measure, calculate_graph_precondition, calculate_graph_fit, calculate_graph_inverse, unsupported_graph_operation, finish_graph_source_return)
from .mechanical_family_contracts_a import MechanicalSignatureFacts, project_requested_signature

REACTIVE_GRAPH_C_TYPES = ["ReactiveGraphNodeC","ReactiveGraphLinkC","ReactiveGraphGuardC","ReactiveFollowerStateC","ReactiveFollowerLawC","ReactiveGraphStateC","ReactiveGraphReactionC","ReactiveGraphModelC","ReactiveGraphControlC","ReactiveGraphCheckpointC","ReactiveGraphResultC","ReactiveGraphObservationC","ReactiveGraphRequestC","ReactiveGraphSourceReturnInputC","ReactiveGraphSourceReturnC","MechanicalSignatureFacts"]
REACTIVE_GRAPH_C_ENTRIES = (
    ("capability.reactive_graph_signature_c", project_requested_signature, ReactiveGraphRequestC, MechanicalSignatureFacts),
    ("capability.reactive_graph_edge_successor_c", calculate_graph_edge, ReactiveGraphRequestC, ReactiveGraphResultC),
    ("capability.reactive_graph_guard_report_c", calculate_graph_guards, ReactiveGraphRequestC, ReactiveGraphResultC),
    ("capability.reactive_graph_patrol_successor_c", calculate_graph_patrols, ReactiveGraphRequestC, ReactiveGraphResultC),
    ("capability.reactive_graph_follower_successor_c", calculate_graph_followers, ReactiveGraphRequestC, ReactiveGraphResultC),
    ("capability.reactive_graph_joint_successor_c", calculate_graph_joint, ReactiveGraphRequestC, ReactiveGraphResultC),
    ("capability.reactive_graph_phase_calendar_c", calculate_graph_calendar, ReactiveGraphRequestC, ReactiveGraphResultC),
    ("capability.reactive_graph_state_equivalence_c", calculate_graph_equivalence, ReactiveGraphRequestC, ReactiveGraphResultC),
    ("capability.reactive_graph_detour_report_c", calculate_graph_detour, ReactiveGraphRequestC, ReactiveGraphResultC),
    ("capability.reactive_graph_measure_c", calculate_graph_measure, ReactiveGraphRequestC, ReactiveGraphResultC),
    ("capability.reactive_graph_precondition_c", calculate_graph_precondition, ReactiveGraphRequestC, ReactiveGraphResultC),
    ("capability.reactive_graph_fit_c", calculate_graph_fit, ReactiveGraphRequestC, ReactiveGraphResultC),
    ("capability.reactive_graph_inverse_domain_c", calculate_graph_inverse, ReactiveGraphRequestC, ReactiveGraphResultC),
    ("capability.reactive_graph_unsupported_c", unsupported_graph_operation, ReactiveGraphRequestC, ReactiveGraphResultC),
    ("capability.reactive_graph_source_return_c", finish_graph_source_return, ReactiveGraphSourceReturnInputC, ReactiveGraphSourceReturnC))


def reactive_graph_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file=method.__module__.rsplit(".", 1)[-1] + ".py", applicability=("supplied_current_graph_model",),
        invariants=("full_guard_identity_and_follower_history", "source_joint_order", "single_owned_k13_service",
            "operational_revision_keyed_resume", "no_k09_or_act"),
        falsifiers=("stale_checkpoint", "missing_frontal_reaction", "partial_clock_tick", "unclosed_candidate_domain"))
        for ref, method, inputs, outputs in REACTIVE_GRAPH_C_ENTRIES)


def reactive_graph_signatures_c(type_spec, parameter_spec):
    def parameter(name, model):
        return parameter_spec(name=name, type_spec=type_spec(model))
    signatures = {ref: ((parameter("request", inputs.__name__),), outputs.__name__)
        for ref, _, inputs, outputs in REACTIVE_GRAPH_C_ENTRIES}
    signatures["capability.reactive_graph_source_return_c"] = ((parameter("request", "ReactiveGraphRequestC"),
        parameter("calculation", "ReactiveGraphResultC"), parameter("source_policy_ref", "String"),
        parameter("source_disposition_ref", "String"), parameter("source_reason_ref", "String")), "ReactiveGraphSourceReturnC")
    return signatures
