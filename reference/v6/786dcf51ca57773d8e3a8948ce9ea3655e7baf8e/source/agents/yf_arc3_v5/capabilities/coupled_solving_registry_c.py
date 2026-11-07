"""Typed ports for the goal-owned K23 question producer."""
from .coupled_solving_contracts_c import (CoupledSolvingMeasureInputC, CoupledSolvingMeasurementC,
    CoupledSolvingBindInputC, CoupledSolvingQuestionC, CoupledSolvingResponseInputC,
    CoupledSolvingConsumeInputC, CoupledSolvingConsumedC, CoupledSolvingAnswerInputC,
    CoupledSolvingAnswerC, CoupledSolvingReceiptInputC, CoupledSolvingJoinInputC,
    CoupledSolvingJoinFactsC, CoupledSolvingJoinReturnInputC, CoupledSolvingJoinedC)
from .mechanical_request_contracts import MechanicalResponseInput
from .coupled_solving_c import (measure_coupled_solving, bind_coupled_solving_question,
    bind_coupled_solving_response, consume_coupled_solving, bind_coupled_execution_receipt,
    finish_coupled_solving_answer, produce_coupled_solving_join, return_coupled_solving_join)

COUPLED_SOLVING_C_TYPES = ("CoupledLocalConstraintC", "CoupledParentWhyC", "CoupledSolvingInputC",
    "CoupledSolvingMeasureInputC", "CoupledSolvingMeasurementC", "CoupledSolvingQuestionC",
    "CoupledSolvingBindInputC", "CoupledSolvingReceiptInputC", "CoupledSolvingReceiptFactsC",
    "CoupledSolvingResponseInputC", "CoupledSolvingConsumedC", "CoupledSolvingConsumeInputC",
    "CoupledSolvingExecutionInputC", "CoupledSolvingAnswerInputC", "CoupledSolvingAnswerC",
    "CoupledSolvingJoinInputC", "CoupledSolvingJoinFactsC", "CoupledSolvingJoinReturnInputC", "CoupledSolvingJoinedC")
COUPLED_SOLVING_C_ENTRIES = (
    ("capability.coupled_solving_measure_c", measure_coupled_solving, CoupledSolvingMeasureInputC, CoupledSolvingMeasurementC),
    ("capability.coupled_solving_bind_c", bind_coupled_solving_question, CoupledSolvingBindInputC, CoupledSolvingQuestionC),
    ("capability.coupled_solving_response_c", bind_coupled_solving_response, CoupledSolvingResponseInputC, MechanicalResponseInput),
    ("capability.coupled_solving_consume_c", consume_coupled_solving, CoupledSolvingConsumeInputC, CoupledSolvingConsumedC),
    ("capability.coupled_solving_receipt_input_c", bind_coupled_execution_receipt, CoupledSolvingAnswerInputC, CoupledSolvingReceiptInputC),
    ("capability.coupled_solving_answer_c", finish_coupled_solving_answer, CoupledSolvingAnswerInputC, CoupledSolvingAnswerC),
    ("capability.coupled_solving_join_c", produce_coupled_solving_join, CoupledSolvingJoinInputC, CoupledSolvingJoinFactsC),
    ("capability.coupled_solving_join_return_c", return_coupled_solving_join, CoupledSolvingJoinReturnInputC, CoupledSolvingJoinedC))

def coupled_solving_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=inputs,
        output_model=outputs, source_file="coupled_solving_c.py",
        applicability=("current_parent_coupled_field_question",),
        invariants=("canonical_agenda", "exact_local_mapping", "all_allowed_values", "preserved_parent_why", "no_act"),
        falsifiers=("stale_agenda", "unbound_scale_or_reference", "invented_action", "missing_current_certificate"))
        for ref, method, inputs, outputs in COUPLED_SOLVING_C_ENTRIES)

def coupled_solving_signatures_c(type_spec, parameter_spec):
    def parameter(name, model):
        return parameter_spec(name=name, type_spec=type_spec(model))
    return {
        "capability.coupled_solving_measure_c": ((parameter("request", "CoupledSolvingInputC"),
            parameter("canonical_agenda_rows", "Any")), "CoupledSolvingMeasurementC"),
        "capability.coupled_solving_bind_c": ((parameter("measured", "CoupledSolvingMeasurementC"),
            parameter("source_disposition_ref", "String"), parameter("source_reason_ref", "String")), "CoupledSolvingQuestionC"),
        "capability.coupled_solving_response_c": ((parameter("measured", "CoupledSolvingReceiptFactsC"),
            parameter("source_status", "String")), "MechanicalResponseInput"),
        "capability.coupled_solving_consume_c": ((parameter("measured", "CoupledSolvingReceiptFactsC"),
            parameter("normalized", "Any")), "CoupledSolvingConsumedC"),
        "capability.coupled_solving_receipt_input_c": ((parameter("request", "CoupledSolvingExecutionInputC"),
            parameter("native_return", "Any"), parameter("consumed", "Any")), "CoupledSolvingReceiptInputC"),
        "capability.coupled_solving_answer_c": ((parameter("request", "CoupledSolvingExecutionInputC"),
            parameter("native_return", "Any"), parameter("consumed", "Any")), "CoupledSolvingAnswerC"),
        "capability.coupled_solving_join_c": ((parameter("request", "CoupledSolvingJoinInputC"),), "CoupledSolvingJoinFactsC"),
        "capability.coupled_solving_join_return_c": ((parameter("measured", "CoupledSolvingJoinFactsC"),
            parameter("joined", "Any")), "CoupledSolvingJoinedC")}
