"""Five scoped goal questions preserve actual coverage and three-valued conditions."""
from .goal_supposition_contracts_c import (CyclicCoverageSuppositionInputC, MetricImageSuppositionInputC, OrientedPassageSuppositionInputC, ReactiveCaptureSuppositionInputC, StationCargoSuppositionInputC,
    GoalSuppositionFactsC, GoalSuppositionDecisionInputC, GoalSuppositionDecisionC)
from .goal_supposition_c import (measure_cyclic_coverage_supposition, measure_metric_image_supposition, measure_oriented_passage_supposition, measure_reactive_capture_supposition, measure_station_cargo_supposition, assemble_goal_supposition)

GOAL_SUPPOSITION_C_TYPES = ("TupleVisitC", "CyclicCoverageSuppositionInputC", "MetricImageSuppositionInputC", "PassageLayerExampleC", "OrientedPassageSuppositionInputC", "CaptureIdentityExampleC", "ReactiveCaptureSuppositionInputC", "CargoDeliveryAssignmentC", "StationCargoSuppositionInputC", "GoalSuppositionFactsC", "GoalSuppositionDecisionInputC", "GoalSuppositionDecisionC")
GOAL_ROWS_C = (
    ("capability.cyclic_coverage_supposition_facts_c", measure_cyclic_coverage_supposition, CyclicCoverageSuppositionInputC),
    ("capability.metric_image_supposition_facts_c", measure_metric_image_supposition, MetricImageSuppositionInputC),
    ("capability.oriented_passage_supposition_facts_c", measure_oriented_passage_supposition, OrientedPassageSuppositionInputC),
    ("capability.reactive_capture_supposition_facts_c", measure_reactive_capture_supposition, ReactiveCaptureSuppositionInputC),
    ("capability.station_cargo_supposition_facts_c", measure_station_cargo_supposition, StationCargoSuppositionInputC),
)


def goal_supposition_entries_c(entry_factory):
    rows = tuple((ref, method, before, GoalSuppositionFactsC) for ref, method, before in GOAL_ROWS_C)
    rows += (("capability.goal_supposition_assembly_c", assemble_goal_supposition,
        GoalSuppositionDecisionInputC, GoalSuppositionDecisionC),)
    return tuple(entry_factory(capability_id=ref, implementation=method, input_model=before, output_model=after,
        source_file="goal_supposition_c.py", applicability=("current_consumer_and_explicit_goal_evidence",),
        invariants=("existing_typed_mask_relations", "actual_scoped_observations", "full_quantified_conditions",
            "known_false_dominates_unknown_conjunct", "no_second_physics_or_route", "no_act_or_confirmed_terminal"),
        falsifiers=("foreign_scope_reset_or_identity", "unlicensed_transform", "incomplete_goal_observation"))
        for ref, method, before, after in rows)


def goal_supposition_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))
    result = {ref: ((parameter("request", before.__name__),), "GoalSuppositionFactsC")
        for ref, _, before in GOAL_ROWS_C}
    result["capability.goal_supposition_assembly_c"] = ((parameter("request", "Any"),
        parameter("measured", "GoalSuppositionFactsC"), parameter("source_disposition_ref", "Any"),
        parameter("source_policy_ref", "String")), "GoalSuppositionDecisionC")
    return result
