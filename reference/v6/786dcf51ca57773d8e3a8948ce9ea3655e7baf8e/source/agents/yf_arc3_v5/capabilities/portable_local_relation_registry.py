"""Fixed pure capabilities for the optional acquired-method query."""

from .contracts import InteractionProbeAgenda, InteractionProbeInput
from .portable_local_relation import (
    PortableLocalFacts,
    PortableLocalProjection,
    PortableLocalQuery,
    PortableLocalResult,
    count_projected_relations,
    measure_local_relations,
    measure_query_context,
)

PORTABLE_LOCAL_TYPES = (
    "PortableLocalQuery",
    "PortableLocalProjection",
    "PortableLocalFacts",
    "PortableLocalResult",
)


def portable_local_entries(factory):
    return tuple(
        factory(
            capability_id=ref,
            implementation=method,
            input_model=before,
            output_model=after,
            source_file="portable_local_relation.py",
            applicability=("source_requested_current_local_relation_query",),
            invariants=(
                "historical_binding_not_replayed",
                "source_owns_query_admission_and_reopening",
            ),
            falsifiers=("no_current_repair_support", "changed_observation_or_source"),
        )
        for ref, method, before, after in (
            (
                "capability.portable_local_query_context",
                measure_query_context,
                PortableLocalQuery,
                PortableLocalFacts,
            ),
            (
                "capability.portable_local_relations",
                measure_local_relations,
                InteractionProbeInput,
                InteractionProbeAgenda,
            ),
            (
                "capability.portable_local_projection_counts",
                count_projected_relations,
                PortableLocalProjection,
                PortableLocalResult,
            ),
        )
    )


def portable_local_signatures(type_spec, parameter_spec):
    def p(name, kind):
        return parameter_spec(name=name, type_spec=type_spec(kind))

    return {
        "capability.portable_local_query_context": (
            (p("request", "InteractionProbeInput"), p("historical_rows", "Any")),
            "PortableLocalFacts",
        ),
        "capability.portable_local_relations": (
            (p("request", "InteractionProbeInput"),),
            "InteractionProbeAgenda",
        ),
        "capability.portable_local_projection_counts": (
            (
                p("request", "InteractionProbeInput"),
                p("projected", "Any"),
                p("agenda", "InteractionProbeAgenda"),
                p("accepted_fields", "Any"),
                p("accepted_values", "Any"),
            ),
            "PortableLocalResult",
        ),
    }
