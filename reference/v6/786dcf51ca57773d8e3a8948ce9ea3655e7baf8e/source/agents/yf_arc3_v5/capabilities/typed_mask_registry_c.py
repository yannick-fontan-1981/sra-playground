"""Exact typed masks and geometric relations, with Source-owned licensing."""
from .typed_mask_contracts_c import (TypedMaskRelationInputC, TypedMaskRelationFactsC,
    TypedMaskDecisionInputC, TypedMaskDecisionC)
from .typed_mask_c import measure_typed_mask_relation, assemble_typed_mask_relation

TYPED_MASK_C_TYPES = ("MaskPointC", "TypedMaskC", "TypedMaskRelationInputC", "TypedMaskRelationFactsC",
    "TypedMaskDecisionInputC", "TypedMaskDecisionC")


def typed_mask_entries_c(entry_factory):
    return (
        entry_factory(capability_id="capability.typed_mask_relation_facts_c",
            implementation=measure_typed_mask_relation, input_model=TypedMaskRelationInputC,
            output_model=TypedMaskRelationFactsC, source_file="typed_mask_c.py",
            applicability=("declared_mask_kinds_and_shared_native_coordinate_basis",),
            invariants=("mask_kinds_never_inherited_from_raster_equality", "unknown_hidden_support_retained",
                "no_coordinate_projection_or_semantic_law", "no_action_selection"),
            falsifiers=("stale_or_foreign_frame_basis", "missing_semantic_mask", "actual_bound_reached")),
        entry_factory(capability_id="capability.typed_mask_relation_assembly_c",
            implementation=assemble_typed_mask_relation, input_model=TypedMaskDecisionInputC,
            output_model=TypedMaskDecisionC, source_file="typed_mask_c.py",
            applicability=("src_selected_typed_geometry_disposition",),
            invariants=("preserve_each_raw_mask_and_support", "geometric_relation_not_terminal_acceptance",
                "no_collision_or_click_invention", "no_act"),
            falsifiers=("requested_mask_kind_unproven", "unsupported_coordinate_comparison")),
    )


def typed_mask_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    return {
        "capability.typed_mask_relation_facts_c": ((parameter("request", "TypedMaskRelationInputC"),),
            "TypedMaskRelationFactsC"),
        "capability.typed_mask_relation_assembly_c": ((parameter("request", "TypedMaskRelationInputC"),
            parameter("measured", "TypedMaskRelationFactsC"), parameter("source_disposition_ref", "Any"),
            parameter("source_policy_ref", "String")), "TypedMaskDecisionC"),
    }
