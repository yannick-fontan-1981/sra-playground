"""Registration proposal for source-owned relevance and wait reconciliation."""
from .relevance_contracts_c import RelevanceInputC, RelevanceFactsC, RelevanceDeltaInputC, RelevanceDeltaC
from .relevance_c import measure_reconciled_occurrences, apply_src_relevance_delta

RELEVANCE_C_TYPES = ("RelevanceInputC", "RelevanceFactsC", "RelevanceDeltaInputC", "RelevanceDeltaC")


def relevance_entries_c(entry_factory):
    return (
        entry_factory(capability_id="capability.reconciled_occurrence_measurement_c",
            implementation=measure_reconciled_occurrences, input_model=RelevanceInputC,
            output_model=RelevanceFactsC, source_file="relevance_c.py",
            applicability=("sealed_endpoint_or_retained_pending_packet",),
            invariants=("same_full_successor_state", "no_usefulness_classification",
                "actual_acknowledgements_only", "no_restart_threshold"),
            falsifiers=("stale_epoch_or_lease", "contradictory_acknowledgement")),
        entry_factory(capability_id="capability.relevance_delta_c", implementation=apply_src_relevance_delta,
            input_model=RelevanceDeltaInputC, output_model=RelevanceDeltaC, source_file="relevance_c.py",
            applicability=("src_selected_exact_disposition",),
            invariants=("occurrence_idempotence", "unresolved_not_irrelevant", "no_reset_or_action",
                "wait_contract_not_renewed"), falsifiers=("duplicate_occurrence_count", "late_current_write")),
    )


def relevance_signatures_c(type_spec, parameter_spec):
    return {
        "capability.reconciled_occurrence_measurement_c": ((parameter_spec(name="request",
            type_spec=type_spec("RelevanceInputC")),), "RelevanceFactsC"),
        "capability.relevance_delta_c": ((
            parameter_spec(name="request", type_spec=type_spec("RelevanceInputC")),
            parameter_spec(name="measured", type_spec=type_spec("RelevanceFactsC")),
            parameter_spec(name="disposition_ref", type_spec=type_spec("String")),
            parameter_spec(name="wait_status_ref", type_spec=type_spec("String")),
        ), "RelevanceDeltaC"),
    }
