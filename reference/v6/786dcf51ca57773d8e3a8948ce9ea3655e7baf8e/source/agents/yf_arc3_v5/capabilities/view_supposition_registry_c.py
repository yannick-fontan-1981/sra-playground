"""Five view/acceptance questions preserve supported equivalence and receipt provenance."""
from .view_supposition_contracts_c import (VoxelViewSuppositionInputC, PreviewPackingSuppositionInputC, ProfileWorkbenchSuppositionInputC, AxialFieldSuppositionInputC, TemporalFragmentSuppositionInputC,
    ViewSuppositionDecisionInputC, ViewSuppositionDecisionC)
from .goal_supposition_contracts_c import GoalSuppositionFactsC
from .view_supposition_c import (measure_voxel_view_supposition, measure_preview_packing_supposition, measure_profile_workbench_supposition, measure_axial_field_supposition, measure_temporal_fragment_supposition, assemble_view_supposition)

VIEW_SUPPOSITION_C_TYPES = ("VoxelViewSuppositionInputC", "PackingPieceObservationC", "PreviewPackingSuppositionInputC", "AuthenticationReceiptMemoryC", "ProfileWorkbenchSuppositionInputC", "StableTargetBodyC", "AxialFieldSuppositionInputC", "TemporalFragmentSuppositionInputC", "ViewSuppositionDecisionInputC", "ViewSuppositionDecisionC")
VIEW_ROWS_C = (
    ("capability.voxel_view_supposition_facts_c", measure_voxel_view_supposition, VoxelViewSuppositionInputC),
    ("capability.preview_packing_supposition_facts_c", measure_preview_packing_supposition, PreviewPackingSuppositionInputC),
    ("capability.profile_workbench_supposition_facts_c", measure_profile_workbench_supposition, ProfileWorkbenchSuppositionInputC),
    ("capability.axial_field_supposition_facts_c", measure_axial_field_supposition, AxialFieldSuppositionInputC),
    ("capability.temporal_fragment_supposition_facts_c", measure_temporal_fragment_supposition, TemporalFragmentSuppositionInputC),
)


def view_supposition_entries_c(entry_factory):
    rows = tuple((ref, method, before, GoalSuppositionFactsC) for ref, method, before in VIEW_ROWS_C)
    rows += (("capability.view_supposition_assembly_c", assemble_view_supposition,
        ViewSuppositionDecisionInputC, ViewSuppositionDecisionC),)
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=before, output_model=after,
        source_file="view_supposition_c.py", applicability=("current_consumer_and_explicit_view_acceptance_evidence",),
        invariants=("existing_mask_and_goal_value_methods", "bounded_current_geometry", "acquisition_revalidation_separate",
            "real_point_and_photo_binding", "no_new_physics_or_route", "no_act_or_confirmed_terminal"),
        falsifiers=("foreign_scope", "unqualified_identity_or_basis", "incomplete_population_or_acceptance"))
        for ref, method, before, after in rows)


def view_supposition_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    result = {ref: ((parameter("request", before.__name__),), "GoalSuppositionFactsC")
        for ref, _, before in VIEW_ROWS_C}
    result["capability.view_supposition_assembly_c"] = ((parameter("request", "Any"),
        parameter("measured", "GoalSuppositionFactsC"), parameter("source_disposition_ref", "Any"),
        parameter("source_policy_ref", "String")), "ViewSuppositionDecisionC")
    return result
