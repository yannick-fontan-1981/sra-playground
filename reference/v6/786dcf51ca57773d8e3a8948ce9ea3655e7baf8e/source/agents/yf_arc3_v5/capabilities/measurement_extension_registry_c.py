"""Current epistemic extension service, reusing B's agenda contracts."""
from .measurement_extension_contracts_c import (MeasurementExtensionInputC, MeasurementExtensionFactsC,
    MeasurementExtensionDecisionInputC, MeasurementExtensionDecisionC)
from .measurement_extension_c import measure_measurement_extension, assemble_measurement_extension

MEASUREMENT_EXTENSION_C_TYPES = ("MeasurementExtensionInputC", "MeasurementExtensionFactsC",
    "MeasurementExtensionDecisionInputC", "MeasurementExtensionDecisionC")


def measurement_extension_entries_c(entry_factory):
    return (
        entry_factory(capability_id="capability.measurement_extension_facts_c",
            implementation=measure_measurement_extension, input_model=MeasurementExtensionInputC,
            output_model=MeasurementExtensionFactsC, source_file="measurement_extension_c.py",
            applicability=("exact_specialized_measurement_and_current_epistemic_consumer",),
            invariants=("reuse_existing_agenda_signature", "operation_mode_and_parent_unchanged",
                "physical_goal_confirmation_not_required", "no_family_dispatch_or_selection"),
            falsifiers=("stale_scope_or_dependency", "request_identity_collision", "unsupported_premise")),
        entry_factory(capability_id="capability.measurement_extension_assembly_c",
            implementation=assemble_measurement_extension, input_model=MeasurementExtensionDecisionInputC,
            output_model=MeasurementExtensionDecisionC, source_file="measurement_extension_c.py",
            applicability=("src_selected_exact_agenda_extension",),
            invariants=("preserve_siblings_receipts_and_unknowns", "no_k01_substitution",
                "no_canonical_consumption", "no_action_release"),
            falsifiers=("equivalent_request_recreated", "capacity_exceeded", "identity_overwritten")),
    )


def measurement_extension_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    return {
        "capability.measurement_extension_facts_c": ((parameter("request", "MeasurementExtensionInputC"),),
            "MeasurementExtensionFactsC"),
        "capability.measurement_extension_assembly_c": ((parameter("request", "MeasurementExtensionInputC"),
            parameter("measured", "MeasurementExtensionFactsC"), parameter("source_disposition_ref", "Any"),
            parameter("source_policy_ref", "String")), "MeasurementExtensionDecisionC"),
    }
