"""Four source-owned transport questions; producers and usage remain separately qualified."""
from .transport_supposition_contracts_c import (ReactiveGraphSuppositionInputC, QuantityIdentitySuppositionInputC, OrientedCargoSuppositionInputC, PiercingOrderSuppositionInputC,
    TransportSuppositionFactsC, TransportSuppositionDecisionInputC, TransportSuppositionDecisionC)
from .transport_supposition_c import (measure_reactive_graph_supposition, measure_quantity_identity_supposition, measure_oriented_cargo_supposition, measure_piercing_order_supposition,
    assemble_transport_supposition)

TRANSPORT_SUPPOSITION_C_TYPES = ("ScopedTransportObservationC", "GraphLandingExampleC", "ReactiveGraphSuppositionInputC", "QuantityIdentityExampleC", "QuantityIdentitySuppositionInputC", "CargoOrientationExampleC", "OrientedCargoSuppositionInputC", "PiercingOrderSuppositionInputC", "TransportSuppositionFactsC", "TransportSuppositionDecisionInputC", "TransportSuppositionDecisionC")
TRANSPORT_ROWS_C = (
    ("capability.reactive_graph_supposition_facts_c", measure_reactive_graph_supposition, ReactiveGraphSuppositionInputC),
    ("capability.quantity_identity_supposition_facts_c", measure_quantity_identity_supposition, QuantityIdentitySuppositionInputC),
    ("capability.oriented_cargo_supposition_facts_c", measure_oriented_cargo_supposition, OrientedCargoSuppositionInputC),
    ("capability.piercing_order_supposition_facts_c", measure_piercing_order_supposition, PiercingOrderSuppositionInputC),
)


def transport_supposition_entries_c(entry_factory):
    rows = tuple((ref, method, before, TransportSuppositionFactsC) for ref, method, before in TRANSPORT_ROWS_C)
    rows += (("capability.transport_supposition_assembly_c", assemble_transport_supposition,
        TransportSuppositionDecisionInputC, TransportSuppositionDecisionC),)
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=before, output_model=after,
        source_file="transport_supposition_c.py", applicability=("current_consumer_and_transport_evidence",),
        invariants=("existing_graph_mask_layer_and_rod_measurements", "no_second_physics_or_route",
            "scoped_actual_examples", "source_selects_question", "no_act_or_confirmed_law"),
        falsifiers=("foreign_scope", "unqualified_identity_or_role", "incomplete_inventory", "work_bound"))
        for ref, method, before, after in rows)


def transport_supposition_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    result = {ref: ((parameter("request", before.__name__),), "TransportSuppositionFactsC")
        for ref, _, before in TRANSPORT_ROWS_C}
    result["capability.transport_supposition_assembly_c"] = ((parameter("request", "Any"),
        parameter("measured", "TransportSuppositionFactsC"), parameter("source_disposition_ref", "Any"),
        parameter("source_policy_ref", "String")), "TransportSuppositionDecisionC")
    return result
