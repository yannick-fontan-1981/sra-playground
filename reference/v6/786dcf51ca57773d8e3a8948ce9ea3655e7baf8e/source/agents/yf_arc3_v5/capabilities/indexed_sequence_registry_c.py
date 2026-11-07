"""Native ordinal projection service; Source retains all competing domains."""
from .indexed_sequence_contracts_c import (IndexedSequenceInputC, IndexedSequenceMeasurementC,
    IndexedSequenceDecisionInputC, IndexedSequenceDecisionC)
from .indexed_sequence_c import measure_indexed_sequence, assemble_indexed_sequence

INDEXED_SEQUENCE_C_TYPES = ("IndexedSlotObservationC", "IndexedSequenceDomainC", "IndexedSequenceInputC",
    "IndexedSlotProjectionC", "IndexedDomainProjectionC", "IndexedSequenceMeasurementC",
    "IndexedSequenceDecisionInputC", "IndexedSequenceDecisionC")


def indexed_sequence_entries_c(entry_factory):
    return (
        entry_factory(capability_id="capability.indexed_sequence_measurement_c",
            implementation=measure_indexed_sequence, input_model=IndexedSequenceInputC,
            output_model=IndexedSequenceMeasurementC, source_file="indexed_sequence_c.py",
            applicability=("explicit_finite_ordinal_domains_and_actual_bounds",),
            invariants=("no_slot_compaction", "original_ordinals_unchanged", "no_hidden_content_invention",
                "background_occluded_unknown_and_outside_distinct", "no_domain_selection"),
            falsifiers=("duplicate_domain_or_ordinal", "conflicting_content", "actual_bound_reached")),
        entry_factory(capability_id="capability.indexed_sequence_assembly_c",
            implementation=assemble_indexed_sequence, input_model=IndexedSequenceDecisionInputC,
            output_model=IndexedSequenceDecisionC, source_file="indexed_sequence_c.py",
            applicability=("src_selected_ordinal_projection_disposition",),
            invariants=("all_domains_retained", "no_clock_fit_or_action", "exact_support_transport"),
            falsifiers=("stale_or_unsupported_projection", "domain_arbitrarily_selected")),
    )


def indexed_sequence_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    return {
        "capability.indexed_sequence_measurement_c": ((parameter("request", "IndexedSequenceInputC"),),
            "IndexedSequenceMeasurementC"),
        "capability.indexed_sequence_assembly_c": ((parameter("measured", "IndexedSequenceMeasurementC"),
            parameter("source_disposition_ref", "Any"), parameter("source_policy_ref", "String")),
            "IndexedSequenceDecisionC"),
    }
