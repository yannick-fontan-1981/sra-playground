"""Post-edit frontiers reuse event composition and K09 instead of new physics."""
from .terrain_frontier_contracts_c import (TerrainFrontierInputC, TerrainScopeFactsC,
    TerrainFrontierMeasurementC, TerrainFrontierDecisionInputC, TerrainFrontierDecisionC)
from .terrain_frontier_c import measure_terrain_scope, measure_terrain_frontier, assemble_terrain_frontier

TERRAIN_FRONTIER_C_TYPES = ("TerrainCellEffectC", "TerrainFrontierInputC", "TerrainScopeFactsC",
    "TerrainCellEffectMeasurementC", "TerrainFrontierMeasurementC", "TerrainFrontierDecisionInputC", "TerrainFrontierDecisionC")


def terrain_frontier_entries_c(entry_factory):
    return (
        entry_factory(capability_id="capability.terrain_scope_facts_c", implementation=measure_terrain_scope,
            input_model=TerrainFrontierInputC, output_model=TerrainScopeFactsC, source_file="terrain_frontier_c.py",
            applicability=("source_bound_hypothetical_edit_and_post_settlement_query",),
            invariants=("entire_settled_successor_is_route_initial_state", "current_parent_goal_scope", "no_edit_commit"),
            falsifiers=("foreign_or_stale_successor", "missing_phase_or_route_constraint")),
        entry_factory(capability_id="capability.terrain_frontier_measurement_c", implementation=measure_terrain_frontier,
            input_model=TerrainFrontierInputC, output_model=TerrainFrontierMeasurementC, source_file="terrain_frontier_c.py",
            applicability=("src_licensed_current_terrain_packet",),
            invariants=("direct_edits_same_pre_snapshot", "no_xor_invention", "forced_contacts_and_full_settlement_retained",
                "support_blocker_hazard_roles_remain_alternatives", "no_physics_or_role_selection"),
            falsifiers=("unsettled_successor", "unsafe_contact", "contrary_or_unknown_direct_effect")),
        entry_factory(capability_id="capability.terrain_frontier_assembly_c", implementation=assemble_terrain_frontier,
            input_model=TerrainFrontierDecisionInputC, output_model=TerrainFrontierDecisionC, source_file="terrain_frontier_c.py",
            applicability=("src_selected_post_edit_route_disposition",),
            invariants=("route_and_contact_proof_before_candidate_commit", "no_action_or_cell_law", "frozen_support"),
            falsifiers=("new_open_cell_treated_as_route", "required_settlement_phase_erased")),
    )


def terrain_frontier_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind, optional=False):
        return parameter_spec(name=name, type_spec=type_spec(kind, optional=optional))
    return {
        "capability.terrain_scope_facts_c": ((parameter("request", "TerrainFrontierInputC"),), "TerrainScopeFactsC"),
        "capability.terrain_frontier_measurement_c": ((parameter("request", "TerrainFrontierInputC"),), "TerrainFrontierMeasurementC"),
        "capability.terrain_frontier_assembly_c": ((parameter("request", "TerrainFrontierInputC"),
            parameter("measured", "TerrainFrontierMeasurementC", True), parameter("route", "SearchResultC", True),
            parameter("source_disposition_ref", "Any"), parameter("source_policy_ref", "String")), "TerrainFrontierDecisionC"),
    }
