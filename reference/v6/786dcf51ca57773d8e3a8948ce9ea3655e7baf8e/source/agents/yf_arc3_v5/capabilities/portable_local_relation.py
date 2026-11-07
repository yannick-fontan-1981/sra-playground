"""Bounded measurements for Source-requested revalidation of an acquired method.

Historical rows suggest a query only. Existing DRM interprets the fresh local
relations; SRC decides whether to retain that query or reopen the full frontier.
"""

from typing import Any

from pydantic import Field

from ..logos.types import FrozenMap, FrozenModel, Ref
from .contracts import InteractionProbeAgenda, InteractionProbeInput


class PortableLocalQuery(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.PortableLocalQuery.v1"
    request: InteractionProbeInput
    historical_rows: tuple[Any, ...] = Field(default=(), max_length=8)


class PortableLocalProjection(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.PortableLocalProjection.v1"
    request: InteractionProbeInput
    projected: Any
    agenda: InteractionProbeAgenda
    accepted_fields: tuple[Ref, ...] = Field(max_length=8)
    accepted_values: tuple[Any, ...] = Field(max_length=8)


class PortableLocalFacts(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.PortableLocalFacts.v1"
    facts: FrozenMap


def measure_query_context(value: PortableLocalQuery) -> PortableLocalFacts:
    request = value.request
    return PortableLocalFacts(
        facts=FrozenMap(
            {
                "phase": "query",
                "historical_schema_count": len(value.historical_rows),
                "point_interface_present": "ACTION6" in request.available_action_refs,
                "other_interface_count": sum(
                    ref not in ("ACTION6", request.level_start_checkpoint_action_ref)
                    for ref in request.available_action_refs
                ),
                "prior_point_delta_present": (
                    request.periodic_last_delta is not None
                    or request.reflection_last_delta is not None
                ),
                "requested_scope_ref": request.interaction_measurement_scope_ref,
                "requested_context_contract_ref": request.requested_interaction_context_contract_ref,
                "point_loci_reopen_requested": request.point_loci_reopen_requested,
                "committed_plan_present": request.committed_plan_present,
                "incoming_route_engagement_present": request.incoming_declared_route_engagement_present,
                "existing_composition_inventory_row_count": (
                    len(request.canonical_method_inventory_facts)
                    + len(request.canonical_recipe_operator_facts)
                    + len(request.canonical_controlled_assembly_term_facts)
                ),
            }
        )
    )


def measure_local_relations(value: InteractionProbeInput) -> InteractionProbeAgenda:
    # Reuse the same raster measurements and candidate identities as the full
    # frontier. No donor binding, expected palette or action sequence is read.
    from .interaction import (
        _directional_vocabulary_exhausted,
        _generic_selector_measurement,
        _periodic_cell_candidates,
    )
    from .periodic_correspondence import (
        measure_periodic_candidate,
        measure_periodic_context,
    )
    from .reflection_correspondence import (
        measure_reflection_candidate,
        measure_reflection_context,
        measure_reflection_field_inventory,
    )

    frame = value.current_observed_frame or value.frame
    context, fields, mappings = measure_periodic_context(
        frame,
        value.route_generation_policy.get("periodic_minimum_concordance"),
        value.route_generation_policy.get("periodic_minimum_count_difference"),
        value.route_generation_policy.get("periodic_quantity_palette_value"),
    )
    reflection_fields, reflection_inventory_complete = measure_reflection_field_inventory(frame)
    context = FrozenMap(
        {
            **context,
            **measure_reflection_context(
                frame, reflection_fields, value.reflection_last_delta,
                inventory_complete=reflection_inventory_complete,
            ),
            "all_directional_vocabulary_refs_exhausted": _directional_vocabulary_exhausted(
                value, dict(value.action_execution_counts),
                frozenset(value.known_no_effect_action_refs),
                frozenset(value.tested_candidate_refs_without_resolution_plan),
            ),
            "last_action_ref_present": bool(value.last_action_ref),
            "declared_point_candidate_scope_ref": value.declared_point_candidate_scope_ref,
            "requested_measurement_scope_ref": value.interaction_measurement_scope_ref,
            "measurement_frame_ref": value.current_observation_frame_ref,
            "portable_local_relation_query_measured": True,
            "provided_interaction_context_contract_ref": "interaction_context.local_relation_measurements",
        }
    )
    described = _periodic_cell_candidates(
        value,
        frozenset(value.current_context_no_effect_candidate_refs),
        frozenset(value.tested_candidate_refs_without_resolution_plan),
        dict(context),
    )
    components_by_ref = {c.component_id: c for c in value.components.components}
    selector_measurements = {
        c.candidate_ref: _generic_selector_measurement(value, c, components_by_ref)
        for c, _ in described
    }
    candidate_counts = dict(value.candidate_execution_counts)
    action_counts = dict(value.action_execution_counts)
    facts = FrozenMap(
        {
            candidate.candidate_ref: FrozenMap.overlay(
                raw,
                FrozenMap(
                    {
                        **measure_periodic_candidate(
                            frame,
                            fields,
                            mappings,
                            candidate,
                            value.periodic_last_delta,
                        ),
                        **measure_reflection_candidate(
                            reflection_fields, candidate.point,
                            value.reflection_last_delta if reflection_inventory_complete else None,
                        ),
                        "candidate_is_grid_aligned_white_selector": selector_measurements[candidate.candidate_ref][0],
                        "candidate_is_peer_after_point_cursor_selection": selector_measurements[candidate.candidate_ref][1],
                        "candidate_ref": candidate.candidate_ref,
                        "action_ref": candidate.action_ref,
                        "component_ref": candidate.component_ref,
                        "interaction_measurement_kind": "point",
                        "candidate_observation_row": candidate.point[0]
                        if candidate.point is not None
                        else None,
                        "candidate_observation_col": candidate.point[1]
                        if candidate.point is not None
                        else None,
                        "candidate_execution_count": candidate_counts.get(
                            candidate.candidate_ref, 0
                        ),
                        "action_execution_count": action_counts.get(
                            candidate.action_ref, 0
                        ),
                    }
                ),
            )
            for candidate, raw in described
        }
    )
    agenda = InteractionProbeAgenda(
        candidates=tuple(candidate for candidate, _ in described),
        alternative_refs=tuple(candidate.candidate_ref for candidate, _ in described),
        alternative_facts=facts,
        descriptive_delta_facts=facts,
        context_facts=context,
        has_candidates=bool(described),
    )

    from .observed_ordered_queues import (
        annotate_ordered_queue_input,
        append_display_controls,
    )

    agenda = append_display_controls(value, agenda)
    return annotate_ordered_queue_input(value, agenda)


class PortableLocalResult(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.PortableLocalResult.v1"
    facts: FrozenMap
    agenda: InteractionProbeAgenda


def count_projected_relations(value: PortableLocalProjection) -> PortableLocalResult:
    projected = value.projected
    rows = (
        projected.get("alternative_facts", {})
        if isinstance(projected, dict | FrozenMap)
        else projected.alternative_facts
    )
    # SRC names the already projected values to retain. Transport all matching
    # rows in their existing order; never pick a winner or infer a missing fact.
    if len(value.accepted_fields) != len(value.accepted_values):
        raise ValueError("Source filter fields and expected values differ in length")
    accepted = tuple(zip(value.accepted_fields, value.accepted_values))
    retained = frozenset(
        ref
        for ref, row in sorted(rows.items())
        if any(row.get(field) == expected for field, expected in accepted)
    )
    before = value.agenda
    candidates = tuple(
        candidate
        for candidate in before.candidates
        if candidate.candidate_ref in retained
    )
    agenda = before.model_copy(
        update={
            "candidates": candidates,
            "alternative_refs": tuple(
                candidate.candidate_ref for candidate in candidates
            ),
            "alternative_facts": FrozenMap(
                {
                    ref: facts
                    for ref, facts in sorted(before.alternative_facts.items())
                    if ref in retained
                }
            ),
            "descriptive_delta_facts": FrozenMap(
                {
                    ref: facts
                    for ref, facts in sorted(before.descriptive_delta_facts.items())
                    if ref in retained
                }
            ),
            "has_candidates": bool(candidates),
        }
    )
    request = value.request
    represented = frozenset(candidate.action_ref for candidate in candidates)
    coverage = FrozenMap(
        {
            "available_command_count": len(request.available_action_refs),
            "represented_command_count": len(represented),
            "unrepresented_command_refs": tuple(
                ref for ref in request.available_action_refs if ref not in represented
            ),
            "candidate_count": len(candidates),
            "point_candidate_count": sum(c.point is not None for c in candidates),
            "point_command_present": "ACTION6" in request.available_action_refs,
            "object_candidate_count": sum(
                c.component_ref is not None for c in candidates
            ),
            "observed_component_count": len(request.components.components),
            "interface_binding_count": len(request.canonical_interface_member_facts),
            "method_inventory_binding_count": len(
                request.canonical_method_inventory_facts
            ),
            "controlled_composition_binding_count": len(
                request.canonical_controlled_assembly_term_facts
            ),
            "point_scope_ref": request.declared_point_candidate_scope_ref,
            "interaction_scope_ref": request.interaction_measurement_scope_ref,
        }
    )
    agenda = agenda.model_copy(
        update={
            "context_facts": FrozenMap.overlay(
                {
                    "curiosity_frontier_coverage": coverage,
                    "portable_current_relation_candidate_count": len(retained),
                },
                agenda.context_facts,
            )
        }
    )
    return PortableLocalResult(
        facts=FrozenMap(
            {
                "phase": "assess",
                "current_repair_count": len(retained),
            }
        ),
        agenda=agenda,
    )
