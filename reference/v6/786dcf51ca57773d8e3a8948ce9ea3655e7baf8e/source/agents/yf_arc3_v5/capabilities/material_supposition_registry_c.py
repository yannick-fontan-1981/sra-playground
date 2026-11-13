"""Candidate registration only; canonical producers and activation need separate evidence."""
from .material_supposition_contracts_c import (WordTransductionSuppositionInputC,
    DirectedFlowSuppositionInputC, LocalFieldSuppositionInputC, MaterialSuppositionFactsC,
    MaterialSuppositionDecisionInputC, MaterialSuppositionDecisionC)
from .material_supposition_c import (measure_word_transduction_supposition, measure_directed_flow_supposition,
    measure_local_field_supposition, assemble_material_supposition)

MATERIAL_SUPPOSITION_C_TYPES = ("WordCarrierC", "WordConnectorC", "WordEditC", "WordTransductionSuppositionInputC",
    "DirectedFlowSuppositionInputC", "FieldSampleC", "FieldCompatibilityC", "LocalFieldSuppositionInputC",
    "MaterialSuppositionFactsC", "MaterialSuppositionDecisionInputC", "MaterialSuppositionDecisionC")

MATERIAL_ROWS_C = (
    ("capability.word_transduction_supposition_facts_c", measure_word_transduction_supposition, WordTransductionSuppositionInputC),
    ("capability.directed_flow_supposition_facts_c", measure_directed_flow_supposition, DirectedFlowSuppositionInputC),
    ("capability.local_field_supposition_facts_c", measure_local_field_supposition, LocalFieldSuppositionInputC))


def material_supposition_entries_c(entry_factory):
    rows = tuple((ref, method, before, MaterialSuppositionFactsC) for ref, method, before in MATERIAL_ROWS_C)
    rows += (("capability.material_supposition_assembly_c", assemble_material_supposition,
        MaterialSuppositionDecisionInputC, MaterialSuppositionDecisionC),)
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=before,
        output_model=after, source_file="material_supposition_c.py",
        applicability=("current_consumer_with_independent_interface_evidence",),
        invariants=("pure_descriptive_facts", "focus_not_mutation", "aperture_not_boundary",
            "transient_not_persistent_production", "bounded_pairs_remain_open",
            "source_selects_revisable_question", "no_act_goal_or_confirmed_law"),
        falsifiers=("foreign_scope", "unqualified_identity_or_role", "incomplete_packet", "work_bound"))
        for ref, method, before, after in rows)


def material_supposition_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    result = {ref: ((parameter("request", before.__name__),), "MaterialSuppositionFactsC")
        for ref, _, before in MATERIAL_ROWS_C}
    result["capability.material_supposition_assembly_c"] = ((parameter("request", "Any"),
        parameter("measured", "MaterialSuppositionFactsC"), parameter("source_disposition_ref", "Any"),
        parameter("source_policy_ref", "String")), "MaterialSuppositionDecisionC")
    return result
