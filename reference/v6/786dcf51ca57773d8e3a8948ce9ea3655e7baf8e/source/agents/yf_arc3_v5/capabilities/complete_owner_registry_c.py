"""Source bindings and exact K03 calculation receipt, never an external action dispatcher."""
from .complete_owner_contracts_c import (
    CompleteOwnerInputC, CompleteOwnerFactsC, CompleteOwnerBindingInputC, CompleteOwnerBindingC,
    CompleteOwnerReconciliationInputC, CompleteOwnerReturnInputC, CompleteOwnerReturnC)
from .complete_owner_c import (
    measure_complete_owner, assemble_complete_owner_binding, measure_complete_owner_return,
    assemble_complete_owner_return)

COMPLETE_OWNER_C_TYPES = ("CompleteOwnerInputC", "CompleteOwnerFactsC", "CompleteOwnerBindingInputC",
    "CompleteOwnerBindingC", "CompleteOwnerReconciliationInputC", "CompleteOwnerReturnInputC", "CompleteOwnerReturnC")
COMPLETE_OWNER_C_ENTRIES = (
    ("capability.complete_owner_measure_c", measure_complete_owner, CompleteOwnerInputC, CompleteOwnerFactsC),
    ("capability.complete_owner_bind_c", assemble_complete_owner_binding, CompleteOwnerBindingInputC, CompleteOwnerBindingC),
    ("capability.complete_owner_return_measure_c", measure_complete_owner_return, CompleteOwnerReconciliationInputC, CompleteOwnerFactsC),
    ("capability.complete_owner_return_c", assemble_complete_owner_return, CompleteOwnerReturnInputC, CompleteOwnerReturnC))


def complete_owner_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=before, output_model=after,
        source_file="complete_owner_c.py", applicability=("current_prebound_one_complete_primitive_owner",),
        invariants=("source_execution_disposition", "inherited_unchanged_if_no_delegation", "one_current_collector_receipt",
            "trace_safety_unknowns_and_preservation_retained", "calculation_discharge_not_physical_sealed", "no_act_or_second_tick"),
        falsifiers=("unknown_or_duplicate_owner", "stale_or_partial_packet", "missing_or_reused_collector_receipt"))
        for ref, method, before, after in COMPLETE_OWNER_C_ENTRIES)


def complete_owner_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    result = {ref: ((parameter("request", before.__name__),), after.__name__)
        for ref, _, before, after in COMPLETE_OWNER_C_ENTRIES}
    result["capability.complete_owner_bind_c"] = ((parameter("request", "CompleteOwnerInputC"),
        parameter("measured", "CompleteOwnerFactsC"), parameter("source_disposition_ref", "Any"),
        parameter("source_policy_ref", "String"), parameter("source_reason_ref", "String"),
        parameter("source_inherited_execution_allowed", "Boolean"), parameter("source_inherited_execution_suppressed", "Boolean")), "CompleteOwnerBindingC")
    result["capability.complete_owner_return_c"] = ((parameter("request", "CompleteOwnerReconciliationInputC"),
        parameter("measured", "CompleteOwnerFactsC"), parameter("source_disposition_ref", "Any"),
        parameter("source_policy_ref", "String"), parameter("source_reason_ref", "String"),
        parameter("source_calculation_discharge_allowed", "Boolean")), "CompleteOwnerReturnC")
    return result
