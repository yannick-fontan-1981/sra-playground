"""Native K63 producer ABI is exactly MetricStackRequest -> MetricStackCalculation."""
from .metric_step_contracts_c import (MetricStepInputC, MetricStepFactsC, MetricStepDecodeInputC,
    MetricStepMeasurementC, MetricStepResponseInputC, MetricStepFinishInputC, MetricStepDispatchC)
from .metric_step_c import (measure_metric_step_signature, unsupported_metric_step,
    decode_metric_step, assemble_metric_step_response, finish_metric_step)
from .metric_stack_contracts import MetricStackRequest, MetricStackCalculation
from .metric_stack_image import calculate_metric_external_primitive
from .mechanical_request_contracts import MechanicalResponseInput

METRIC_STEP_C_ENTRIES = (
    ("capability.metric_step_signature_c", measure_metric_step_signature, MetricStepInputC, MetricStepFactsC, "metric_step_c.py"),
    ("capability.metric_step_unsupported_c", unsupported_metric_step, MetricStepInputC, MetricStepMeasurementC, "metric_step_c.py"),
    ("capability.metric_step_decode_c", decode_metric_step, MetricStepDecodeInputC, MetricStepMeasurementC, "metric_step_c.py"),
    ("capability.metric_step_response_c", assemble_metric_step_response, MetricStepResponseInputC, MechanicalResponseInput, "metric_step_c.py"),
    ("capability.metric_step_finish_c", finish_metric_step, MetricStepFinishInputC, MetricStepDispatchC, "metric_step_c.py"),
    ("capability.metric_stack_external_primitive", calculate_metric_external_primitive, MetricStackRequest, MetricStackCalculation, "metric_stack_image.py"),
)
METRIC_STEP_C_TYPES = tuple(sorted({model.__name__ for _, _, before, after, _ in METRIC_STEP_C_ENTRIES
    for model in (before, after)} | {"MetricPhaseBindingC"}))


def metric_step_entries_c(entry_factory):
    return tuple(entry_factory(capability_id=ref, implementation=implementation, input_model=before,
        output_model=after, source_file=source, applicability=("source_bound_native_k63_step",),
        invariants=("one_native_transition", "automatic_identity_law_supplied", "cost_debited_once",
            "full_state_and_budget", "native_acceptance_and_terminal_distinct", "no_act_or_search"),
        falsifiers=("foreign_identity_or_parent", "missing_owner_phase_or_reset_law", "incomplete_native_ledger"))
        for ref, implementation, before, after, source in METRIC_STEP_C_ENTRIES)


def metric_step_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind, optional=False):
        return parameter_spec(name=name, type_spec=type_spec(kind, optional=optional))
    result = {ref: ((parameter("request", before.__name__),), after.__name__)
        for ref, _, before, after, _ in METRIC_STEP_C_ENTRIES}
    result["capability.metric_step_decode_c"] = ((parameter("request", "MetricStepInputC"),
        parameter("native", "MetricStackCalculation")), "MetricStepMeasurementC")
    result["capability.metric_step_response_c"] = ((parameter("measured", "MetricStepMeasurementC"),
        parameter("source_status", "String"), parameter("missing_cause", "String", True)), "MechanicalResponseInput")
    result["capability.metric_step_finish_c"] = ((parameter("measured", "MetricStepMeasurementC"),
        parameter("normalized", "MechanicalNormalizedReturn")), "MetricStepDispatchC")
    return result
