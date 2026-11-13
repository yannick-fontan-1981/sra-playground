"""Five knowledge questions; Source evidence preserves memory, current input and desired outputs."""
from .knowledge_supposition_contracts_c import (InventoryNavigationSuppositionInputC, LineageSuppositionInputC, FiniteNetworkSuppositionInputC, TemporalReferenceSuppositionInputC, FeedbackIdentificationSuppositionInputC,
    KnowledgeSuppositionFactsC, KnowledgeSuppositionDecisionInputC, KnowledgeSuppositionDecisionC)
from .knowledge_supposition_c import (measure_inventory_navigation_supposition, measure_lineage_supposition, measure_finite_network_supposition, measure_temporal_reference_supposition, measure_feedback_identification_supposition, assemble_knowledge_supposition)

KNOWLEDGE_SUPPOSITION_C_TYPES = ("InventoryIdentityBindingC", "InventoryNavigationSuppositionInputC", "InternalMarkRelationC", "LineageSuppositionInputC", "NetworkOutputRequirementC", "FiniteNetworkSuppositionInputC", "RecalledPopulationC", "TemporalReferenceSuppositionInputC", "FeedbackPositionC", "FeedbackTrialObservationC", "FeedbackIdentificationSuppositionInputC", "KnowledgeSuppositionFactsC", "KnowledgeSuppositionDecisionInputC", "KnowledgeSuppositionDecisionC")
KNOWLEDGE_ROWS_C = (
    ("capability.inventory_navigation_supposition_facts_c", measure_inventory_navigation_supposition, InventoryNavigationSuppositionInputC),
    ("capability.lineage_supposition_facts_c", measure_lineage_supposition, LineageSuppositionInputC),
    ("capability.finite_network_supposition_facts_c", measure_finite_network_supposition, FiniteNetworkSuppositionInputC),
    ("capability.temporal_reference_supposition_facts_c", measure_temporal_reference_supposition, TemporalReferenceSuppositionInputC),
    ("capability.feedback_identification_supposition_facts_c", measure_feedback_identification_supposition, FeedbackIdentificationSuppositionInputC),
)


def knowledge_supposition_entries_c(entry_factory):
    rows = tuple((ref, method, before, KnowledgeSuppositionFactsC) for ref, method, before in KNOWLEDGE_ROWS_C)
    rows += (("capability.knowledge_supposition_assembly_c", assemble_knowledge_supposition,
        KnowledgeSuppositionDecisionInputC, KnowledgeSuppositionDecisionC),)
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=before, output_model=after,
        source_file="knowledge_supposition_c.py", applicability=("current_consumer_and_independent_knowledge_interface",),
        invariants=("existing_memory_mask_graph_and_ordinal_methods", "native_descriptive_measure_only",
            "no_second_physics_or_solver", "unknowns_and_conflicts_retained", "no_act_permission_or_confirmed_law"),
        falsifiers=("foreign_scope", "unqualified_identity_or_role", "incomplete_trial_or_inventory", "work_bound"))
        for ref, method, before, after in rows)


def knowledge_supposition_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    result = {ref: ((parameter("request", before.__name__),), "KnowledgeSuppositionFactsC")
        for ref, _, before in KNOWLEDGE_ROWS_C}
    result["capability.knowledge_supposition_assembly_c"] = ((parameter("request", "Any"),
        parameter("measured", "KnowledgeSuppositionFactsC"), parameter("source_disposition_ref", "Any"),
        parameter("source_policy_ref", "String")), "KnowledgeSuppositionDecisionC")
    return result
