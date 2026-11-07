"""Exact snapshot/edit/settlement checks; no terrain physics is duplicated."""
from .terrain_frontier_contracts_c import (TerrainFrontierInputC, TerrainScopeFactsC,
    TerrainCellEffectMeasurementC, TerrainFrontierMeasurementC,
    TerrainFrontierDecisionInputC, TerrainFrontierDecisionC)
from .mechanical_common_contracts_c import EventCompositionInputC
from .mechanical_event_composition_c import compose_mechanical_events, predicate_value, packet_context_equal
from agents.yf_arc3_v5.logos.types import FrozenMap


def measure_terrain_scope(value: TerrainFrontierInputC) -> TerrainScopeFactsC:
    packet, query = value.packet, value.post_edit_route
    initial = query.initial_states
    current = (packet.request.epoch == value.current_epoch
        and packet.request.input_revision_ref == value.current_revision_ref
        and packet.parent_request.epoch == value.current_epoch
        and packet.parent_request.input_revision_ref == value.current_revision_ref)
    exact_route = (len(initial) == 1 and initial[0].state == packet.after and initial[0].model_ref == packet.model_ref
        and packet_context_equal(packet.parent_request, query.request, packet.model_ref)
        and query.request.immutable_inputs.get("source_goal_contract_ref") == value.source_goal_contract_ref
        and query.request.immutable_inputs.get("parent_goal_ref") == value.parent_goal_ref)
    return TerrainScopeFactsC(facts=FrozenMap({"current_packet_scope": current, "packet_complete": packet.complete,
        "post_settlement_route_exact": exact_route, "model_not_already_terminal": not packet.terminal,
        "route_operation_ref": query.request.operation_ref, "route_kernel_ref": query.request.kernel_ref,
        "route_mode": query.request.mode, "route_return_type": query.request.expected_return_type,
        "direct_and_settlement_contracts_present": bool(value.direct_event_kind_refs)
            and bool(value.required_settlement_kind_refs),
        "route_preservation_predicates_retained": {predicate.predicate_ref for predicate in value.preservation_predicates}
            .issubset({predicate.predicate_ref for predicate in query.predicates}),
        "cell_refs_unique": len({cell.cell_ref for cell in value.cells}) == len(value.cells)}))


def measure_terrain_frontier(value: TerrainFrontierInputC) -> TerrainFrontierMeasurementC:
    packet = value.packet
    folded = compose_mechanical_events(EventCompositionInputC(request=packet.parent_request,
        initial=packet.before, packets=(packet,), predicates=value.preservation_predicates))
    before = packet.snapshots.get(value.pre_action_snapshot_ref)
    direct = packet.snapshots.get(value.post_direct_snapshot_ref)
    direct_events = tuple(event for event in packet.events if event.kind_ref in value.direct_event_kind_refs)
    same_pre = (before == packet.before and isinstance(direct, FrozenMap) and bool(direct_events)
        and all(event.snapshot_ref == value.pre_action_snapshot_ref
            and event.snapshot_kind in ("PRE_COMMAND", "SIMULTANEOUS") and event.reads == before for event in direct_events))
    event_by_ref = {event.occurrence_ref: event for event in direct_events}
    cells = []
    for cell in value.cells:
        previous = predicate_value(cell.present_predicate, before) if isinstance(before, FrozenMap) else None
        following = predicate_value(cell.present_predicate, direct) if isinstance(direct, FrozenMap) else None
        event = event_by_ref.get(cell.occurrence_ref)
        grounded = event is not None and event.snapshot_ref == value.pre_action_snapshot_ref
        holds = None
        if grounded and previous is not None and following is not None:
            if cell.operation == "REMOVE":
                holds = previous and not following
            elif cell.operation == "RECREATE":
                holds = not previous and following
            else:
                holds = following
        cells.append(TerrainCellEffectMeasurementC(cell_ref=cell.cell_ref, before_present=previous,
            after_direct_present=following, declared_effect_holds=holds,
            xor_interpretation_contradicted=grounded and cell.operation == "NEIGHBOR_CREATE"
                and previous is True and following is True,
            role_alternatives=tuple(cell.role_alternatives)))
    phases = {event.kind_ref for event in packet.events}
    settled = (folded.complete and not folded.bounded and not folded.contradictory
        and not folded.missing_refs and folded.state == packet.after
        and set(value.required_settlement_kind_refs).issubset(phases))
    return TerrainFrontierMeasurementC(folded=folded, cells=tuple(cells),
        facts=FrozenMap({"full_settlement_known": settled, "same_pre_action_snapshot": same_pre,
            "declared_edits_known": bool(cells) and all(cell.declared_effect_holds is not None for cell in cells),
            "declared_edits_hold": bool(cells) and all(cell.declared_effect_holds is True for cell in cells),
            "preservation_holds": not folded.failed_predicate_refs,
            "retained_support_blocker_hazard_alternatives": any(len(cell.role_alternatives) > 1 for cell in cells)}))


def assemble_terrain_frontier(value: TerrainFrontierDecisionInputC) -> TerrainFrontierDecisionC:
    return TerrainFrontierDecisionC(source_disposition_ref=value.source_disposition_ref,
        source_policy_ref=value.source_policy_ref, frozen_request=value.request,
        folded_settlement=value.measured.folded if value.measured else None,
        cell_effects=value.measured.cells if value.measured else (), post_edit_route=value.route,
        preservation_predicate_refs=tuple(predicate.predicate_ref for predicate in value.request.preservation_predicates))
