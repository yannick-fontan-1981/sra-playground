"""Sealed-region measurements and reducers; all dispositions belong to SRC/DRM."""
from .region_frontier_contracts_c import (RegionFrontierInputC, RegionFrontierFactsC,
    RegionDecisionInputC, RegionDecisionC)
from .region_frontier_c import measure_region_frontier, assemble_region_decision

REGION_C_TYPES = ("RegionCellObservationC", "RegionFacetC", "RegionFrontierInputC",
    "RegionFrontierFactsC", "RegionDecisionInputC", "RegionDecisionC")


def region_frontier_entries_c(entry_factory):
    return (
        entry_factory(capability_id="capability.region_frontier_measurement_c",
            implementation=measure_region_frontier, input_model=RegionFrontierInputC,
            output_model=RegionFrontierFactsC, source_file="region_frontier_c.py",
            applicability=("caller_bound_sealed_region_facets",),
            invariants=("explicit_identity_before_geometry", "individual_visibility_only",
                "current_epoch_and_revision_fenced", "no_region_or_experiment_selection"),
            falsifiers=("future_or_unsealed_observation", "duplicate_cell_identity")),
        entry_factory(capability_id="capability.region_decision_assembly_c",
            implementation=assemble_region_decision, input_model=RegionDecisionInputC,
            output_model=RegionDecisionC, source_file="region_frontier_c.py",
            applicability=("src_selected_geometry_and_frontier_dispositions",),
            invariants=("geometry_and_transient_state_separate", "no_act_or_reset",
                "both_region_alternatives_retained", "no_future_reveal"),
            falsifiers=("disposition_not_selected_by_source", "current_provenance_dropped")),
    )


def region_frontier_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    return {
        "capability.region_frontier_measurement_c": ((parameter("request", "RegionFrontierInputC"),),
            "RegionFrontierFactsC"),
        "capability.region_decision_assembly_c": ((parameter("request", "RegionFrontierInputC"),
            parameter("measured", "RegionFrontierFactsC"),
            parameter("source_binding_disposition_ref", "Any"),
            parameter("source_disposition_ref", "Any"), parameter("binding_policy_ref", "String"),
            parameter("frontier_policy_ref", "String")), "RegionDecisionC"),
    }
