"""Registered bounded macro certification; Source selects its disposition."""
from .macro_expansion_contracts_c import (MacroExpansionInputC, MacroExpansionFactsC,
    MacroExpansionReturnInputC, MacroExpansionReturnC)
from .macro_expansion_c import measure_macro_expansion, assemble_macro_expansion

MACRO_EXPANSION_C_TYPES = ("MacroMemberC", "MacroEdgeC", "MacroDefinitionC", "MacroExpansionInputC",
    "MacroExpansionFactsC", "MacroExpansionReturnInputC", "MacroExpansionReturnC")
MACRO_EXPANSION_C_ENTRIES = (
    ("capability.macro_expansion_measure_c", measure_macro_expansion, MacroExpansionInputC, MacroExpansionFactsC),
    ("capability.macro_expansion_return_c", assemble_macro_expansion, MacroExpansionReturnInputC, MacroExpansionReturnC))


def macro_expansion_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file="macro_expansion_c.py", applicability=("explicit_finite_macro_quotient",),
        invariants=("full_underlying_states", "cost_and_predicates_preserved", "verified_primitive_words",
            "global_bounds_not_renewed", "no_native_calls_or_act"),
        falsifiers=("missing_member_or_edge", "hidden_process_changes", "stale_metric_or_scope", "unsafe_partial_path"))
        for ref, method, inputs, outputs in MACRO_EXPANSION_C_ENTRIES)


def macro_expansion_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    result = {ref: ((parameter("request", before.__name__),), after.__name__)
        for ref, _, before, after in MACRO_EXPANSION_C_ENTRIES}
    result["capability.macro_expansion_return_c"] = ((parameter("request", "MacroExpansionInputC"),
        parameter("measured", "MacroExpansionFactsC"), parameter("source_disposition_ref", "Any"),
        parameter("source_policy_ref", "String"), parameter("source_reason_ref", "String"),
        parameter("source_word_admissible", "Boolean")), "MacroExpansionReturnC")
    return result
