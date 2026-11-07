"""Four capacity/support questions, without substituting visibility or past occupancy."""
from .capacity_supposition_contracts_c import (ActorProgramSuppositionInputC, VisibilityCapacitySuppositionInputC, FiniteFlowSuppositionInputC, WrapSlideSuppositionInputC,
    CapacitySuppositionFactsC, CapacitySuppositionDecisionInputC, CapacitySuppositionDecisionC)
from .capacity_supposition_c import (measure_actor_program_supposition, measure_visibility_capacity_supposition, measure_finite_flow_supposition, measure_wrap_slide_supposition, assemble_capacity_supposition)

CAPACITY_SUPPOSITION_C_TYPES = ("ActorStackExampleC", "ActorProgramSuppositionInputC", "VisibilityPermissionC", "VisibilityCapacitySuppositionInputC", "FlowVesselObservationC", "FiniteFlowSuppositionInputC", "SettledSeatAssignmentC", "WrapSlideSuppositionInputC", "CapacitySuppositionFactsC", "CapacitySuppositionDecisionInputC", "CapacitySuppositionDecisionC")
CAPACITY_ROWS_C = (
    ("capability.actor_program_supposition_facts_c", measure_actor_program_supposition, ActorProgramSuppositionInputC),
    ("capability.visibility_capacity_supposition_facts_c", measure_visibility_capacity_supposition, VisibilityCapacitySuppositionInputC),
    ("capability.finite_flow_supposition_facts_c", measure_finite_flow_supposition, FiniteFlowSuppositionInputC),
    ("capability.wrap_slide_supposition_facts_c", measure_wrap_slide_supposition, WrapSlideSuppositionInputC),
)


def capacity_supposition_entries_c(entry_factory):
    rows = tuple((ref, method, before, CapacitySuppositionFactsC) for ref, method, before in CAPACITY_ROWS_C)
    rows += (("capability.capacity_supposition_assembly_c", assemble_capacity_supposition,
        CapacitySuppositionDecisionInputC, CapacitySuppositionDecisionC),)
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=before, output_model=after,
        source_file="capacity_supposition_c.py", applicability=("current_consumer_and_capacity_support_evidence",),
        invariants=("existing_region_graph_mask_and_flow_measures", "scope_actor_and_inventory_exact",
            "simultaneous_required_occupancy", "no_second_physics_or_route", "no_act_or_confirmed_law"),
        falsifiers=("foreign_scope", "unqualified_identity_or_role", "incomplete_settled_inventory", "work_bound"))
        for ref, method, before, after in rows)


def capacity_supposition_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    result = {ref: ((parameter("request", before.__name__),), "CapacitySuppositionFactsC")
        for ref, _, before in CAPACITY_ROWS_C}
    result["capability.capacity_supposition_assembly_c"] = ((parameter("request", "Any"),
        parameter("measured", "CapacitySuppositionFactsC"), parameter("source_disposition_ref", "Any"),
        parameter("source_policy_ref", "String")), "CapacitySuppositionDecisionC")
    return result
