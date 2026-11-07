"""Endpoint-related questions keep propagation, channel control, goals and identity distinct."""
from .endpoint_supposition_contracts_c import (ArticulatedChannelSuppositionInputC, InverseAnchorSuppositionInputC,
    ContactShapeSuppositionInputC, EndpointSuppositionFactsC, EndpointSuppositionDecisionInputC, EndpointSuppositionDecisionC)
from .endpoint_supposition_c import (measure_articulated_channel_supposition,
    measure_inverse_anchor_supposition, measure_contact_shape_supposition, assemble_endpoint_supposition)

ENDPOINT_SUPPOSITION_C_TYPES = ("ArticulatedChannelSuppositionInputC", "InverseAnchorSuppositionInputC",
    "ContactShapeSuppositionInputC", "EndpointSuppositionFactsC", "EndpointSuppositionDecisionInputC", "EndpointSuppositionDecisionC")


def endpoint_supposition_entries_c(entry_factory):
    rows = (("capability.articulated_channel_supposition_facts_c", measure_articulated_channel_supposition,
        ArticulatedChannelSuppositionInputC, EndpointSuppositionFactsC),
        ("capability.inverse_anchor_supposition_facts_c", measure_inverse_anchor_supposition,
            InverseAnchorSuppositionInputC, EndpointSuppositionFactsC),
        ("capability.contact_shape_supposition_facts_c", measure_contact_shape_supposition,
            ContactShapeSuppositionInputC, EndpointSuppositionFactsC),
        ("capability.endpoint_supposition_assembly_c", assemble_endpoint_supposition,
            EndpointSuppositionDecisionInputC, EndpointSuppositionDecisionC))
    return tuple(entry_factory(capability_id=ref, implementation=implementation, input_model=before,
        output_model=after, source_file="endpoint_supposition_c.py",
        applicability=("current_selected_consumer_and_supported_endpoint_structure",),
        invariants=("existing_kinematics_anchor_and_mask_measurements", "attachment_not_channel_control",
            "beacon_signature_not_anchor_destination", "whole_contour_not_focus_point",
            "aspect_change_not_new_identity", "all_hypotheses_retained", "no_act_or_canonical_law"),
        falsifiers=("foreign_scope", "missing_endpoint_or_identity_support", "incompatible_typed_mask_relation"))
        for ref, implementation, before, after in rows)


def endpoint_supposition_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    result = {ref: ((parameter("request", name),), "EndpointSuppositionFactsC") for ref, name in (
        ("capability.articulated_channel_supposition_facts_c", "ArticulatedChannelSuppositionInputC"),
        ("capability.inverse_anchor_supposition_facts_c", "InverseAnchorSuppositionInputC"),
        ("capability.contact_shape_supposition_facts_c", "ContactShapeSuppositionInputC"))}
    result["capability.endpoint_supposition_assembly_c"] = ((parameter("request", "Any"),
        parameter("measured", "EndpointSuppositionFactsC"), parameter("source_disposition_ref", "Any"),
        parameter("source_policy_ref", "String")), "EndpointSuppositionDecisionC")
    return result
