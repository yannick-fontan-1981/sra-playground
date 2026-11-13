"""Five interaction questions; native laws and action releases stay with their existing owners."""
from .interaction_supposition_contracts_c import (EndpointRewriteSuppositionInputC, RecurringQuantitySuppositionInputC, SharedSymbolSuppositionInputC, AuthenticationSuppositionInputC, PushLogisticsSuppositionInputC,
    InteractionSuppositionFactsC, InteractionSuppositionDecisionInputC, InteractionSuppositionDecisionC)
from .interaction_supposition_c import (measure_endpoint_rewrite_supposition, measure_recurring_quantity_supposition, measure_shared_symbol_supposition, measure_authentication_supposition, measure_push_logistics_supposition, assemble_interaction_supposition)

INTERACTION_SUPPOSITION_C_TYPES = ("EndpointPatternPairC", "PairingRewriteExampleC", "EndpointRewriteSuppositionInputC", "WellMeasurementC", "GlyphWellExampleC", "RecurringQuantitySuppositionInputC", "SymbolFocusExampleC", "SharedSymbolSuppositionInputC", "AuthenticationExampleC", "AuthenticationSuppositionInputC", "SupportRouteEvidenceC", "PushSiteQuestionC", "PushLogisticsSuppositionInputC", "InteractionSuppositionFactsC", "InteractionSuppositionDecisionInputC", "InteractionSuppositionDecisionC")
INTERACTION_ROWS_C = (
    ("capability.endpoint_rewrite_supposition_facts_c", measure_endpoint_rewrite_supposition, EndpointRewriteSuppositionInputC),
    ("capability.recurring_quantity_supposition_facts_c", measure_recurring_quantity_supposition, RecurringQuantitySuppositionInputC),
    ("capability.shared_symbol_supposition_facts_c", measure_shared_symbol_supposition, SharedSymbolSuppositionInputC),
    ("capability.authentication_supposition_facts_c", measure_authentication_supposition, AuthenticationSuppositionInputC),
    ("capability.push_logistics_supposition_facts_c", measure_push_logistics_supposition, PushLogisticsSuppositionInputC),
)


def interaction_supposition_entries_c(entry_factory):
    rows = tuple((ref, method, before, InteractionSuppositionFactsC) for ref, method, before in INTERACTION_ROWS_C)
    rows += (("capability.interaction_supposition_assembly_c", assemble_interaction_supposition,
        InteractionSuppositionDecisionInputC, InteractionSuppositionDecisionC),)
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=before, output_model=after,
        source_file="interaction_supposition_c.py", applicability=("current_consumer_and_interaction_evidence",),
        invariants=("existing_graph_ordinal_and_native_measurements", "no_second_route_or_physics",
            "actual_sealed_observations", "exact_actor_support_route", "no_act_or_confirmed_law"),
        falsifiers=("foreign_scope", "unqualified_identity_or_role", "incomplete_inventory_or_route", "work_bound"))
        for ref, method, before, after in rows)


def interaction_supposition_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    result = {ref: ((parameter("request", before.__name__),), "InteractionSuppositionFactsC")
        for ref, _, before in INTERACTION_ROWS_C}
    result["capability.interaction_supposition_assembly_c"] = ((parameter("request", "Any"),
        parameter("measured", "InteractionSuppositionFactsC"), parameter("source_disposition_ref", "Any"),
        parameter("source_policy_ref", "String")), "InteractionSuppositionDecisionC")
    return result
