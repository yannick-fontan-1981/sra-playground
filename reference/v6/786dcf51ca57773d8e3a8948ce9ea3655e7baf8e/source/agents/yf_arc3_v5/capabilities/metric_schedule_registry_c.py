"""K63 schedule preparation and projection keep Source and K09 as authorities."""
from .metric_stack_contracts import MetricStackRequest, MetricStackCalculation
from .metric_schedule_contracts_c import MetricScheduleAssemblyInputC
from .metric_search_contracts_c import MetricSearchInputC
from .metric_schedule_c import prepare_metric_transport_domain, assemble_metric_transport_schedules

METRIC_SCHEDULE_C_TYPES = ("MetricScheduleScope", "MetricSchedulePhase", "MetricScheduleAssemblyInputC")


def metric_schedule_entries_c(entry_factory):
    return (
        entry_factory(capability_id="capability.metric_schedule_prepare_c", implementation=prepare_metric_transport_domain,
            input_model=MetricStackRequest, output_model=MetricSearchInputC, source_file="metric_schedule_c.py",
            applicability=("source_licensed_exact_k63_transport_schedule_domain",),
            invariants=("all_licensed_cell_selection_and_destination_schemas", "existing_k09_and_native_step_only",
                "full_inventory_layers_selection_and_budget", "no_given_word_validation_only", "no_action"),
            falsifiers=("missing_current_schedule_scope", "foreign_model_or_goal", "unlicensed_restriction_or_reset")),
        entry_factory(capability_id="capability.metric_schedule_assembly_c", implementation=assemble_metric_transport_schedules,
            input_model=MetricScheduleAssemblyInputC, output_model=MetricStackCalculation, source_file="metric_schedule_c.py",
            applicability=("exact_native_k09_schedule_return",),
            invariants=("primitive_expansion_from_existing_packets", "terminal_boundary_and_cost_preserved",
                "restricted_domain_not_global_impossibility", "resume_packets_checkpoint_and_cumulative_calls",
                "no_second_physics_search_or_debit"),
            falsifiers=("foreign_or_missing_search_return", "incomplete_witness_edge", "crossed_terminal_boundary")),
    )


def metric_schedule_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    return {"capability.metric_schedule_prepare_c": ((parameter("request", "MetricStackRequest"),), "MetricSearchInputC"),
        "capability.metric_schedule_assembly_c": ((parameter("request", "MetricStackRequest"),
            parameter("search_return", "MechanicalNormalizedReturn")), "MetricStackCalculation")}
