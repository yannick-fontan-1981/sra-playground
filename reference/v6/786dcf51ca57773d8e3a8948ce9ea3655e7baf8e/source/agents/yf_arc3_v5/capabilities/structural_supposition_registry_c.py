"""Reusable structural comparisons with three independent Source-owned dispositions."""
from .structural_supposition_contracts_c import (TransitShapeInputC, LayerContactInputC, VisibleGraphInputC,
    StructuralSuppositionFactsC, StructuralSuppositionDecisionInputC, StructuralSuppositionDecisionC)
from .structural_supposition_c import (measure_transit_shape, measure_layer_contact,
    measure_visible_graph, assemble_structural_supposition)

STRUCTURAL_SUPPOSITION_C_TYPES = ("StructuralScopeC", "TransitShapeInputC", "OriginalLayerMemoryC",
    "LayerProjectionC", "MotionCouplingExampleC", "LayerContactInputC", "VisibleGraphPortC",
    "VisibleGraphStrokeC", "HomologousControlEvidenceC", "VisibleGraphInputC",
    "StructuralSuppositionFactsC", "StructuralSuppositionDecisionInputC", "StructuralSuppositionDecisionC")


def structural_supposition_entries_c(entry_factory):
    rows = (("capability.transit_shape_facts_c", measure_transit_shape, TransitShapeInputC, StructuralSuppositionFactsC),
        ("capability.layer_contact_facts_c", measure_layer_contact, LayerContactInputC, StructuralSuppositionFactsC),
        ("capability.visible_graph_facts_c", measure_visible_graph, VisibleGraphInputC, StructuralSuppositionFactsC),
        ("capability.structural_supposition_assembly_c", assemble_structural_supposition,
            StructuralSuppositionDecisionInputC, StructuralSuppositionDecisionC))
    return tuple(entry_factory(capability_id=ref, implementation=implementation, input_model=before,
        output_model=after, source_file="structural_supposition_c.py",
        applicability=("current_scoped_structural_hypothesis_consumer",),
        invariants=("transit_shape_not_parent_terminal_request", "original_layers_and_attributes_never_replaced",
            "common_motion_not_attachment", "wire_ports_roots_or_channel_not_proximity",
            "all_unknowns_and_alternatives_retained", "no_causal_law_identity_edge_or_act"),
        falsifiers=("foreign_or_stale_scope", "missing_typed_support_or_pixel_ownership",
            "unlicensed_separator_crossing", "actual_work_bound")) for ref, implementation, before, after in rows)


def structural_supposition_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    result = {ref: ((parameter("request", name),), "StructuralSuppositionFactsC") for ref, name in (
        ("capability.transit_shape_facts_c", "TransitShapeInputC"),
        ("capability.layer_contact_facts_c", "LayerContactInputC"),
        ("capability.visible_graph_facts_c", "VisibleGraphInputC"))}
    result["capability.structural_supposition_assembly_c"] = ((parameter("request", "Any"),
        parameter("measured", "StructuralSuppositionFactsC"), parameter("source_disposition_ref", "Any"),
        parameter("source_policy_ref", "String")), "StructuralSuppositionDecisionC")
    return result
