"""Source retains scoped relief-writing hypotheses rather than inventing depth."""
from .relief_supposition_contracts_c import (ReliefSuppositionInputC, ReliefSuppositionFactsC,
    ReliefSuppositionDecisionInputC, ReliefSuppositionDecisionC)
from .relief_supposition_c import measure_relief_supposition, assemble_relief_supposition

RELIEF_SUPPOSITION_C_TYPES = ("ReliefSuppositionInputC", "ReliefSuppositionFactsC",
    "ReliefSuppositionDecisionInputC", "ReliefSuppositionDecisionC")


def relief_supposition_entries_c(entry_factory):
    return (
        entry_factory(capability_id="capability.relief_supposition_facts_c", implementation=measure_relief_supposition,
            input_model=ReliefSuppositionInputC, output_model=ReliefSuppositionFactsC, source_file="relief_supposition_c.py",
            applicability=("current_consumer_and_independently_supported_layer_completion",),
            invariants=("existing_contour_and_order_measurement", "caps_remain_open_domains",
                "raw_masks_and_alternatives_retained", "no_physical_depth_or_role_selection"),
            falsifiers=("missing_completion_support", "foreign_scope", "cycle_or_work_bound")),
        entry_factory(capability_id="capability.relief_supposition_assembly_c", implementation=assemble_relief_supposition,
            input_model=ReliefSuppositionDecisionInputC, output_model=ReliefSuppositionDecisionC,
            source_file="relief_supposition_c.py", applicability=("source_selected_relief_writing_disposition",),
            invariants=("hypothesis_not_confirmed_law", "frozen_reference_surface_and_completion_evidence", "no_act"),
            falsifiers=("relief_turned_into_physical_depth", "truncated_order_promoted_to_unique")),
    )


def relief_supposition_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    return {"capability.relief_supposition_facts_c": ((parameter("request", "ReliefSuppositionInputC"),), "ReliefSuppositionFactsC"),
        "capability.relief_supposition_assembly_c": ((parameter("request", "ReliefSuppositionInputC"),
            parameter("measured", "ReliefSuppositionFactsC"), parameter("source_disposition_ref", "Any"),
            parameter("source_policy_ref", "String")), "ReliefSuppositionDecisionC")}
