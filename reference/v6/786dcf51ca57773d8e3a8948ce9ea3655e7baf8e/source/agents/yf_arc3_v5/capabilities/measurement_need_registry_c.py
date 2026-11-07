"""Small current needs delegate to C013/B's existing agenda, without a second collector."""
from .measurement_need_contracts_c import (MorphologicalBottleneckInputC, MorphologicalBottleneckFactsC,
    MorphologicalBottleneckDecisionInputC, MorphologicalBottleneckDecisionC,
    ConsumerMeasurementNeedInputC, ConsumerMeasurementNeedFactsC,
    ConsumerMeasurementNeedDecisionInputC, ConsumerMeasurementNeedDecisionC)
from .measurement_need_c import (measure_morphological_bottleneck, assemble_morphological_bottleneck,
    measure_consumer_measurement_need, assemble_consumer_measurement_need)

MEASUREMENT_NEED_C_TYPES = ("MorphologicalBottleneckInputC", "MorphologicalBottleneckFactsC",
    "MorphologicalBottleneckDecisionInputC", "MorphologicalBottleneckDecisionC",
    "MeasurementAlternativePredictionC", "RevalidatedGeometryMemoryC", "ConsumerMeasurementNeedInputC",
    "ConsumerMeasurementNeedFactsC", "ConsumerMeasurementNeedDecisionInputC", "ConsumerMeasurementNeedDecisionC")


def measurement_need_entries_c(entry_factory):
    rows = (("capability.morphological_bottleneck_facts_c", measure_morphological_bottleneck,
            MorphologicalBottleneckInputC, MorphologicalBottleneckFactsC),
        ("capability.morphological_bottleneck_assembly_c", assemble_morphological_bottleneck,
            MorphologicalBottleneckDecisionInputC, MorphologicalBottleneckDecisionC),
        ("capability.consumer_measurement_need_facts_c", measure_consumer_measurement_need,
            ConsumerMeasurementNeedInputC, ConsumerMeasurementNeedFactsC),
        ("capability.consumer_measurement_need_assembly_c", assemble_consumer_measurement_need,
            ConsumerMeasurementNeedDecisionInputC, ConsumerMeasurementNeedDecisionC))
    return tuple(entry_factory(capability_id=ref, implementation=implementation, input_model=before,
        output_model=after, source_file="measurement_need_c.py",
        applicability=("current_consumer_dependency_or_live_alternative_distinction",),
        invariants=("observed_gap_not_unseen_solution", "bounded_search_not_unreachable_region",
            "only_needed_dimensions_not_catalogue", "current_revalidation_before_geometry_reuse",
            "preserve_validated_continuation", "existing_agenda_only", "no_action_or_canonical_write"),
        falsifiers=("foreign_or_stale_scope", "irrelevant_dimensions", "conflicting_memo_values",
            "missing_dependency_or_model_coverage", "actual_comparison_bound"))
        for ref, implementation, before, after in rows)


def measurement_need_signatures_c(type_spec, parameter_spec):
    def parameter(name, kind, optional=False):
        return parameter_spec(name=name, type_spec=type_spec(kind, optional=optional))
    return {
        "capability.morphological_bottleneck_facts_c": ((parameter("request", "MorphologicalBottleneckInputC"),), "MorphologicalBottleneckFactsC"),
        "capability.morphological_bottleneck_assembly_c": ((parameter("request", "MorphologicalBottleneckInputC"),
            parameter("measured", "MorphologicalBottleneckFactsC"), parameter("source_disposition_ref", "Any"),
            parameter("source_policy_ref", "String")), "MorphologicalBottleneckDecisionC"),
        "capability.consumer_measurement_need_facts_c": ((parameter("request", "ConsumerMeasurementNeedInputC"),), "ConsumerMeasurementNeedFactsC"),
        "capability.consumer_measurement_need_assembly_c": ((parameter("request", "ConsumerMeasurementNeedInputC"),
            parameter("measured", "ConsumerMeasurementNeedFactsC"), parameter("agenda_decision", "MeasurementExtensionDecisionC", True),
            parameter("source_disposition_ref", "Any"), parameter("source_policy_ref", "String")), "ConsumerMeasurementNeedDecisionC"),
    }
