"""Autonomous experiment frontier registrations with Source-owned decisions."""
from .experiment_frontier_contracts_c import (ExperimentFrontierInputC, ExperimentFrontierFactsC,
    ExperimentDecisionInputC, ExperimentDecisionC, OperationalUnderstandingGoal, OperationalExperimentEvidence,
    OperationalExperimentAction, OperationalExperimentObservable, OperationalExperimentExecution,
    UnderstandingObservedField, UnderstandingObservationInput, UnderstandingObservationMeasurement, UnderstandingObservationReturn)
from .experiment_frontier_c import measure_experiment_frontier, assemble_experiment_decision

EXPERIMENT_C_TYPES = ("ExperimentFrontierInputC", "ExperimentFrontierFactsC", "ExperimentDecisionInputC",
    "ExperimentDecisionC", "OperationalUnderstandingGoal", "OperationalExperimentEvidence",
    "OperationalExperimentAction", "OperationalExperimentObservable", "OperationalExperimentExecution",
    "UnderstandingObservedField", "UnderstandingObservationInput", "UnderstandingObservationMeasurement", "UnderstandingObservationReturn")


def experiment_frontier_entries_c(entry_factory):
    return (
        entry_factory(capability_id="capability.experiment_frontier_measurement_c",
            implementation=measure_experiment_frontier, input_model=ExperimentFrontierInputC,
            output_model=ExperimentFrontierFactsC, source_file="experiment_frontier_c.py",
            applicability=("caller_bound_current_observation_and_predicted_models",),
            invariants=("observable_not_private_partition", "all_models_retained", "revalidation_before_recall",
                "recovery_cost_included", "no_experiment_selection"),
            falsifiers=("stale_scope", "incomplete_observation_contract", "missing_predicted_models")),
        entry_factory(capability_id="capability.experiment_decision_assembly_c",
            implementation=assemble_experiment_decision, input_model=ExperimentDecisionInputC,
            output_model=ExperimentDecisionC, source_file="experiment_frontier_c.py",
            applicability=("src_selected_experiment_disposition",),
            invariants=("no_act_or_reset", "preserve_parent_and_question", "preserve_ambiguity_and_falsifiers"),
            falsifiers=("decision_not_selected_by_source", "scope_or_model_refs_dropped")),
    )


def experiment_frontier_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    return {
        "capability.experiment_frontier_measurement_c": ((parameter("request", "ExperimentFrontierInputC"),),
            "ExperimentFrontierFactsC"),
        "capability.experiment_decision_assembly_c": ((parameter("request", "ExperimentFrontierInputC"),
            parameter("measured", "ExperimentFrontierFactsC"), parameter("source_disposition_ref", "Any"),
            parameter("source_policy_ref", "Any"), parameter("admission_projection", "Any")),
            "ExperimentDecisionC"),
    }
