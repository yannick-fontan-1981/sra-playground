"""Five revisable production questions; central activation remains separately qualified."""
from .production_supposition_contracts_c import (ReactionSuppositionInputC, ChromaticSuppositionInputC, AdversarialSuppositionInputC, WorkbenchSuppositionInputC, LatentRestorationSuppositionInputC,
    ProductionSuppositionFactsC, ProductionSuppositionDecisionInputC, ProductionSuppositionDecisionC)
from .production_supposition_c import (measure_reaction_supposition, measure_chromatic_supposition, measure_adversarial_supposition, measure_workbench_supposition, measure_latent_restoration_supposition, assemble_production_supposition)

PRODUCTION_SUPPOSITION_C_TYPES = ("NativeMeasureBindingC", "ReactionSuppositionInputC", "MixedWindowExampleC", "ChromaticSuppositionInputC", "DropPlacementC", "DropTransactionC", "AdversarialSuppositionInputC", "TypedSlotCompatibilityC", "WorkbenchSuppositionInputC", "NormalizedPatternUnitC", "LocalPatternEditC", "LatentRestorationSuppositionInputC", "ProductionSuppositionFactsC", "ProductionSuppositionDecisionInputC", "ProductionSuppositionDecisionC")
PRODUCTION_ROWS_C = (
    ("capability.reaction_supposition_facts_c", measure_reaction_supposition, ReactionSuppositionInputC),
    ("capability.chromatic_supposition_facts_c", measure_chromatic_supposition, ChromaticSuppositionInputC),
    ("capability.adversarial_supposition_facts_c", measure_adversarial_supposition, AdversarialSuppositionInputC),
    ("capability.workbench_supposition_facts_c", measure_workbench_supposition, WorkbenchSuppositionInputC),
    ("capability.latent_restoration_supposition_facts_c", measure_latent_restoration_supposition, LatentRestorationSuppositionInputC),
)


def production_supposition_entries_c(entry_factory):
    rows = tuple((ref, method, before, ProductionSuppositionFactsC) for ref, method, before in PRODUCTION_ROWS_C)
    rows += (("capability.production_supposition_assembly_c", assemble_production_supposition,
        ProductionSuppositionDecisionInputC, ProductionSuppositionDecisionC),)
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=before, output_model=after,
        source_file="production_supposition_c.py", applicability=("current_consumer_and_independent_production_interface",),
        invariants=("existing_native_descriptive_measures_only", "graph_mask_ordinal_reuse",
            "actual_sealed_observation_not_prediction", "unknowns_and_alternatives_retained", "no_act_or_confirmed_law"),
        falsifiers=("foreign_scope", "unqualified_identity_or_role", "incomplete_transaction", "work_bound"))
        for ref, method, before, after in rows)


def production_supposition_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    result = {ref: ((parameter("request", before.__name__),), "ProductionSuppositionFactsC")
        for ref, _, before in PRODUCTION_ROWS_C}
    result["capability.production_supposition_assembly_c"] = ((parameter("request", "Any"),
        parameter("measured", "ProductionSuppositionFactsC"), parameter("source_disposition_ref", "Any"),
        parameter("source_policy_ref", "String")), "ProductionSuppositionDecisionC")
    return result
