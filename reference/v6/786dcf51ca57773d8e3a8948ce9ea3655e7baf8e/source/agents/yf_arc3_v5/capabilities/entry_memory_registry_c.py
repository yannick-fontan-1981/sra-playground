"""Field memory service contracts; policy and execution belong to Source."""
from .entry_memory_contracts_c import EntryMemoryInputC, EntryMemorySessionC, EntryFieldAppendInputC
from .entry_memory_c import measure_entry_memory, append_source_entry_disposition

ENTRY_MEMORY_C_TYPES = ("EntryFieldObservationC", "RememberedEntryFieldC", "PredictedEntryFieldC",
    "EntryPersistenceEvidenceC", "PortableEntryMethodC", "CurrentEntryIdentityBindingC", "EntryMemoryInputC",
    "EntryFieldMeasurementC", "EntryFieldDispositionC", "EntryMemorySessionC", "EntryFieldAppendInputC")


def entry_memory_entries_c(entry_factory):
    return (
        entry_factory(capability_id="capability.entry_memory_measurement_c",
            implementation=measure_entry_memory, input_model=EntryMemoryInputC,
            output_model=EntryMemorySessionC, source_file="entry_memory_c.py",
            applicability=("current_sealed_entry_field_projection",),
            invariants=("observed_remembered_predicted_distinct", "appearance_not_content",
                "current_identity_and_persistence_scoped", "no_state_binding_or_role_selection"),
            falsifiers=("stale_observation", "missing_actual_entry_fields", "contradictory_persistence")),
        entry_factory(capability_id="capability.entry_memory_append_c",
            implementation=append_source_entry_disposition, input_model=EntryFieldAppendInputC,
            output_model=EntryMemorySessionC, source_file="entry_memory_c.py",
            applicability=("src_selected_field_disposition",),
            invariants=("preserve_raw_and_supported_alternatives", "current_observation_before_memory",
                "no_action_release", "freeze_exact_field_why"),
            falsifiers=("unmeasured_or_duplicate_append", "unsupported_persistence")),
    )


def entry_memory_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    return {
        "capability.entry_memory_measurement_c": ((parameter("request", "EntryMemoryInputC"),),
            "EntryMemorySessionC"),
        "capability.entry_memory_append_c": ((parameter("session", "EntryMemorySessionC"),
            parameter("measured", "Any"), parameter("source_disposition_ref", "Any"),
            parameter("source_policy_ref", "String")), "EntryMemorySessionC"),
    }
