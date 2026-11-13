"""Exact bounded K33 graph primitives. Source supplies all laws and ordering."""
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest, immutable_json_data
from .mechanical_family_contracts_a import family_result
from .patrol_body import PatrolTickRequest, PatrolState, advance_patrol_tick
from .reactive_graph_contracts_c import (ReactiveGraphRequestC, ReactiveGraphResultC,
    ReactiveGraphCheckpointC, ReactiveGraphStateC, ReactiveGraphSourceReturnInputC, ReactiveGraphSourceReturnC)


def graph_context_digest(request: ReactiveGraphRequestC) -> str:
    # A resume changes only its cursor, never the model, observations or scope.
    return stable_digest((request.scope, request.operation_ref, request.mode, request.state,
        request.model, request.control, request.controls, request.other_state, request.alternative_state,
        request.model_candidates, request.observations, request.inverse_candidates, request.target_state,
        request.candidate_domain_complete, request.calendar_policy_revision_ref,
        request.calendar_removal_revision_ref, request.horizon,
        request.maximum_evaluations, request.maximum_states))


def graph_input_missing(request: ReactiveGraphRequestC) -> tuple[str, ...]:
    missing = []
    if request.state is None: missing.append("current_full_graph_state")
    if request.model is None: missing.append("current_full_graph_model")
    if request.scope.model_status_ref != "ACTIVE": missing.append("active_graph_model_status")
    if request.scope.request_ref in request.scope.consumed_request_refs: missing.append("unconsumed_graph_calculation")
    if request.model is not None:
        model = request.model
        nodes = {n.node_ref: n for n in model.nodes}
        if len(nodes) != len(model.nodes): missing.append("distinct_graph_node_identities")
        if len({x.link_ref for x in model.links}) != len(model.links): missing.append("distinct_graph_link_identities")
        if len(set(model.action_refs)) != len(model.action_refs): missing.append("distinct_graph_action_domain")
        if any(x.from_node_ref not in nodes or x.to_node_ref not in nodes or x.action_ref not in model.action_refs
            for x in model.links): missing.append("complete_bound_link_endpoints_and_actions")
        if not model.applicability_evidence_refs: missing.append("current_graph_model_evidence_scope")
        if not model.domain_complete: missing.append("closed_graph_geometry_domain")
        if any(not n.geometry_evidence_refs for n in model.nodes): missing.append("supplied_k01_k02_node_geometry_evidence")
        if request.state is not None:
            state = request.state
            if state.player_node_ref not in nodes and not (
                    state.player_node_ref is None and state.player_transit_mask and (state.dead or state.completed)):
                missing.append("current_player_node")
            guards = {g.guard_ref: g for g in state.guards}
            if len(guards) != len(state.guards) or len(set(state.live_guard_refs)) != len(state.live_guard_refs):
                missing.append("distinct_live_guard_identities")
            if any(ref not in guards for ref in state.live_guard_refs): missing.append("full_live_guard_set")
            if any(g.node_ref is not None and g.node_ref not in nodes for g in state.guards): missing.append("guard_node_bindings")
            if len({f.follower_ref for f in state.followers}) != len(state.followers): missing.append("distinct_follower_identities")
            if any(f.node_ref not in nodes or f.history_cursor > len(f.history_queue)
                or any(ref not in nodes for ref in f.history_queue) for f in state.followers):
                missing.append("full_follower_route_history")
    if request.resume is not None and (request.resume.context_digest != graph_context_digest(request)
            or request.resume.operation_ref != request.operation_ref or request.resume.request_consumed):
        missing.append("current_revision_keyed_graph_checkpoint")
    return tuple(sorted(set(missing)))


def graph_return(request, state, rows=(), missing=(), bounded=False, checkpoint=None, examined=0, values=None):
    contents = dict(values or {})
    contents.update({"state": state, "rows": tuple(rows), "total_examined_count":
        (request.resume.examined_count if request.resume else 0) + examined,
        "actual_bounds": {"maximum_evaluations": request.maximum_evaluations,
            "maximum_states": request.maximum_states, "horizon": request.horizon}})
    native = family_result(request, values=contents, prerequisite_refs=missing,
        examined_count=examined, domain_complete=not missing and not bounded,
        computation_bound_reached=bounded, frontier={"checkpoint": checkpoint} if checkpoint else {})
    return ReactiveGraphResultC(native=native, checkpoint=checkpoint, state=state, rows=tuple(rows))


def graph_checkpoint(request, state, *, outer=0, phase=0, item=0, rows=(), events=(), examined=0,
        secondary=None, cursor=None, pending=()):
    return ReactiveGraphCheckpointC(context_digest=graph_context_digest(request),
        operation_ref=request.operation_ref, outer_index=outer, phase_index=phase, item_index=item,
        current_state=state, retained_rows=tuple(rows), current_events=tuple(events),
        examined_count=(request.resume.examined_count if request.resume else 0) + examined,
        pending_refs=tuple(pending), request_consumed=False, secondary_state=secondary,
        cursor_data=FrozenMap(cursor or {}))


def edge_transition(state, model, control):
    if control is None or not control.evidence_refs: return state, None, (), ("current_action_link_evidence",)
    if control.action_ref not in model.action_refs: return state, None, (), ("current_declared_action_vocabulary",)
    if state.dead or state.completed: return state, None, (), ("nonterminal_graph_input",)
    if control.link_ref is None:
        matches = tuple(link for link in model.links if link.from_node_ref == state.player_node_ref
            and link.action_ref == control.action_ref)
        if matches: return state, None, (), ("explicit_bound_action_link",)
        blocked = True
        link = None
    else:
        matches = tuple(link for link in model.links if link.link_ref == control.link_ref)
        if len(matches) != 1: return state, None, (), ("current_unique_action_link",)
        link = matches[0]
        if link.from_node_ref != state.player_node_ref or link.action_ref != control.action_ref:
            return state, None, (), ("current_action_link_origin",)
        if not link.evidence_refs or link.support == "UNKNOWN": return state, None, (), ("link_support_and_internal_geometry",)
        blocked = link.support == "BLOCKED"
    if blocked:
        if model.blocked_command_supported is not True or model.blocked_command_cost is None:
            return state, None, (), ("supported_blocked_command_outcome_and_cost",)
        return state, model.blocked_command_cost, (), ()
    endpoint = next(n for n in model.nodes if n.node_ref == link.to_node_ref)
    if not link.internal_masks or link.internal_masks[-1] != endpoint.resting_mask:
        return state, None, (), ("measured_link_trace_reaches_full_resting_mask",)
    return state.model_copy(update={"player_node_ref": link.to_node_ref, "player_transit_mask": None}), link.cost, link.internal_masks, ()


def calculate_graph_edge(request: ReactiveGraphRequestC) -> ReactiveGraphResultC:
    missing = graph_input_missing(request)
    if missing: return graph_return(request, request.state, missing=missing)
    work = len(request.model.links) + len(request.model.nodes)
    if work > request.maximum_evaluations:
        cp = graph_checkpoint(request, request.state, pending=("atomic_edge_geometry_budget",))
        return graph_return(request, request.state, bounded=True, checkpoint=cp)
    after, cost, masks, missing = edge_transition(request.state, request.model, request.control)
    return graph_return(request, after, missing=missing, examined=work,
        values={"before_state": request.state, "cost": cost, "internal_player_masks": masks,
            "blocked": cost is not None and not masks,
            "blocked_clock_policy": request.model.blocked_command_advances_clock})


def contact_row(guard, player_mask):
    positions = set(player_mask)
    row = {"guard_ref": guard.guard_ref, "node_ref": guard.node_ref, "orientation": (guard.dx, guard.dy),
        "patrol_ref": guard.patrol_ref, "geometry_evidenced": bool(guard.evidence_refs)}
    for field, offsets in (("FRONT", guard.frontal_offsets), ("SIDE", guard.side_offsets),
            ("REAR", guard.rear_offsets), ("BODY", guard.body_offsets)):
        row[field] = bool(positions.intersection((guard.x + dx, guard.y + dy) for dx, dy in offsets))
    return FrozenMap(row)


def calculate_graph_guards(request: ReactiveGraphRequestC) -> ReactiveGraphResultC:
    missing = graph_input_missing(request)
    if missing: return graph_return(request, request.state, missing=missing)
    state, model = request.state, request.model
    node = next(n for n in model.nodes if n.node_ref == state.player_node_ref)
    masks = (node.resting_mask,)
    if request.control is not None:
        _, _, trace, debt = edge_transition(state, model, request.control)
        if debt: return graph_return(request, state, missing=debt)
        masks += trace
    guards = tuple(g for g in state.guards if g.guard_ref in state.live_guard_refs)
    start = request.resume.item_index if request.resume else 0
    rows = list(request.resume.retained_rows) if request.resume else []
    examined = 0
    total = len(masks) * len(guards)
    for index in range(start, total):
        guard = guards[index % len(guards)]
        mask = masks[index // len(guards)]
        work = len(mask) + sum(len(x) for x in (guard.frontal_offsets, guard.side_offsets, guard.rear_offsets, guard.body_offsets))
        if examined + work > request.maximum_evaluations or len(rows) >= request.maximum_states:
            cp = graph_checkpoint(request, state, item=index, rows=rows, examined=examined)
            return graph_return(request, state, rows, bounded=True, checkpoint=cp, examined=examined)
        examined += work
        row = dict(contact_row(guard, mask)); row["internal_position_index"] = index // len(guards)
        reactions = tuple(r for r in model.reactions if r.guard_ref == guard.guard_ref)
        row["reaction_support"] = FrozenMap({kind: tuple(r.effect for r in reactions if r.contact == kind and r.evidence_refs)
            for kind in ("FRONT", "SIDE", "REAR", "BODY") if row[kind]})
        row["unknown_reaction_contacts"] = tuple(kind for kind in row["reaction_support"]
            if len(row["reaction_support"][kind]) != 1 or row["reaction_support"][kind][0] == "UNKNOWN")
        rows.append(FrozenMap(row))
    return graph_return(request, state, rows, examined=examined,
        values={"all_live_guard_identities_retained": True, "exposure_is_not_action_permission": True})


def follower_transition(follower, law, player_node, blocked):
    if law is None or not law.evidence_refs: return follower, ("current_follower_history_law",)
    if not law.wake_domain_complete: return follower, ("closed_follower_wake_range",)
    if blocked and law.follows_blocked_inputs is None: return follower, ("follower_blocked_input_clock_policy",)
    if not follower.awake and player_node not in law.wake_node_refs: return follower, ()
    if blocked and law.follows_blocked_inputs is False: return follower, ()
    queue = follower.history_queue + (player_node,)
    if len(queue) > 4096: return follower, ("full_follower_history_capacity",)
    cursor, node = follower.history_cursor, follower.node_ref
    due = follower.clock_phase % law.cadence == 0
    if due and len(queue) - cursor > law.delay:
        node = queue[cursor]
        cursor += 1
    return follower.model_copy(update={"awake": True, "history_queue": queue,
        "history_cursor": cursor, "node_ref": node,
        "clock_phase": (follower.clock_phase + 1) % law.phase_modulus}), ()


def follower_step_with_contact(state, model, index, blocked):
    follower = state.followers[index]
    laws = tuple(law for law in model.follower_laws if law.follower_ref == follower.follower_ref)
    if len(laws) != 1 or not laws[0].evidence_refs or not laws[0].body_offsets:
        return state, follower, ("current_full_follower_mask_and_contact_law",)
    law = laws[0]
    nodes = {node.node_ref: node for node in model.nodes}
    player_mask = state.player_transit_mask if state.player_transit_mask is not None else nodes[state.player_node_ref].resting_mask
    def touches(value):
        anchor = nodes[value.node_ref]
        return bool(set(player_mask).intersection((anchor.x + x, anchor.y + y) for x, y in law.body_offsets))
    if touches(follower):
        if law.pre_motion_contact_effect in (None, "UNKNOWN"):
            return state, follower, ("evidenced_pre_motion_follower_contact_effect",)
        if law.pre_motion_contact_effect == "DEATH":
            return state.model_copy(update={"dead": True}), follower, ()
    changed, debt = follower_transition(follower, law, state.player_node_ref, blocked)
    if debt: return state, follower, debt
    after = state.model_copy(update={"followers": tuple(changed if i == index else f for i, f in enumerate(state.followers))})
    if touches(changed):
        if law.post_motion_contact_effect in (None, "UNKNOWN"):
            return state, follower, ("evidenced_post_motion_follower_contact_effect",)
        if law.post_motion_contact_effect == "DEATH":
            after = after.model_copy(update={"dead": True})
    return after, changed, ()


def calculate_graph_followers(request: ReactiveGraphRequestC) -> ReactiveGraphResultC:
    missing = graph_input_missing(request)
    if missing: return graph_return(request, request.state, missing=missing)
    if not request.model.follower_phase_enabled:
        return graph_return(request, request.state, values={"source_follower_phase_disabled": True})
    state = request.resume.current_state if request.resume else request.state
    start = request.resume.item_index if request.resume else 0
    rows = list(request.resume.retained_rows) if request.resume else []
    if request.control is None or not request.control.evidence_refs or request.control.blocked_input_outcome is None:
        return graph_return(request, state, rows, missing=("current_observed_input_outcome_for_follower_history",))
    laws = {law.follower_ref: law for law in request.model.follower_laws}
    if len(laws) != len(request.model.follower_laws): return graph_return(request, state, rows, missing=("unique_follower_law",))
    examined = 0
    for index in range(start, len(state.followers)):
        follower = state.followers[index]
        law = laws.get(follower.follower_ref)
        work = len(follower.history_queue) + 2 * (len(law.body_offsets) if law and law.body_offsets else 0) + 1
        if examined + work > request.maximum_evaluations or len(rows) >= request.maximum_states:
            cp = graph_checkpoint(request, state, item=index, rows=rows, examined=examined)
            return graph_return(request, state, rows, bounded=True, checkpoint=cp, examined=examined)
        changed_state, changed, debt = follower_step_with_contact(state, request.model, index,
            request.control.blocked_input_outcome)
        examined += work
        if debt: return graph_return(request, state, rows, missing=debt, examined=examined)
        state = changed_state
        rows.append(immutable_json_data({"follower_ref": follower.follower_ref, "before": follower, "after": changed}))
        if state.dead: break
    return graph_return(request, state, rows, examined=examined)


def patrol_evaluation_upper_bound(state):
    if state is None:
        return 0
    per_body = (3 * len(state.cells) + 4 * sum(len(body.offsets) for body in state.patrols)
        + 2 * sum(len(target.cells) for target in state.targets))
    return max(1, len(state.patrols) * per_body)


def rotate_contact_offsets(offsets, before_direction, after_direction):
    def axis(direction):
        dx, dy = direction
        if (dx == 0) == (dy == 0):
            return None
        return (0 if dx == 0 else 1 if dx > 0 else -1,
            0 if dy == 0 else 1 if dy > 0 else -1)
    old, new = axis(before_direction), axis(after_direction)
    if old is None or new is None:
        return None
    cosine = old[0] * new[0] + old[1] * new[1]
    sine = old[0] * new[1] - old[1] * new[0]
    return tuple((cosine * x - sine * y, sine * x + cosine * y) for x, y in offsets)


def patrol_transition(request, state, model, control, allowance):
    if (state.patrol_state is None or model.patrol_model is None or control is None
            or control.patrol_input_ref is None or control.patrol_event_clock_tick is None
            or not control.evidence_refs or model.player_patrol_target_ref is None):
        return state, (), ("complete_owned_patrol_clock_and_player_target_binding",), 0, False
    live = set(state.live_guard_refs)
    removed_patrols = {g.patrol_ref for g in state.guards if g.guard_ref not in live and g.patrol_ref is not None}
    live_patrols = {g.patrol_ref for g in state.guards if g.guard_ref in live and g.patrol_ref is not None}
    source_patrol = state.patrol_state
    if control.patrol_event_clock_tick != source_patrol.clock_tick:
        return state, (), ("current_source_bound_patrol_event_clock_tick",), 0, False
    source_patrol = source_patrol.model_copy(update={"patrols": tuple(body for body in source_patrol.patrols
        if body.patrol_ref not in removed_patrols or body.patrol_ref in live_patrols)})
    bodies = {body.patrol_ref: body for body in source_patrol.patrols}
    for guard in state.guards:
        if guard.guard_ref not in live or guard.patrol_ref is None:
            continue
        body = bodies.get(guard.patrol_ref)
        if (body is None or (body.x, body.y) != (guard.x, guard.y) or body.offsets != guard.body_offsets
                or guard.patrol_direction_controls_orientation is None or not guard.evidence_refs):
            return state, (), ("current_guard_patrol_full_mask_and_orientation_law",), 0, False
        if guard.patrol_direction_controls_orientation and rotate_contact_offsets((), (guard.dx, guard.dy),
                (body.dx, body.dy)) is None:
            return state, (), ("supported_cardinal_guard_orientation_transport",), 0, False
    node = next(n for n in model.nodes if n.node_ref == state.player_node_ref)
    targets = tuple(target.model_copy(update={"cells": node.resting_mask})
        if target.target_ref == model.player_patrol_target_ref else target for target in source_patrol.targets)
    if sum(target.target_ref == model.player_patrol_target_ref for target in targets) != 1:
        return state, (), ("unique_current_player_patrol_target",), 0, False
    source_patrol = source_patrol.model_copy(update={"targets": targets})
    upper = patrol_evaluation_upper_bound(source_patrol)
    if any(ref == control.patrol_input_ref and advancement is False
            for ref, advancement in model.patrol_model.input_advancement):
        upper = 1
    if allowance < upper:
        return state, (), (), 0, True
    tick_request = PatrolTickRequest(scope=request.scope, operation_ref="mechanics.patrol_body.pre_clock_tick",
        mode="STEP_INTERNAL", maximum_evaluations=allowance, state=source_patrol, model=model.patrol_model,
        input_ref=control.patrol_input_ref, event_ref=control.event_ref, event_clock_tick=control.patrol_event_clock_tick,
        clock_ref=control.clock_ref, temporal_scope_ref=control.temporal_scope_ref)
    native = advance_patrol_tick(tick_request)
    if not native.domain_complete or native.values.get("clock_event_completed") is not True:
        return state, native.values.get("events", ()), native.prerequisite_refs or ("unsealed_k13_tick",), native.examined_count, native.computation_bound_reached
    after_patrol = PatrolState.model_validate(native.values["after_state"])
    after_bodies = {body.patrol_ref: body for body in after_patrol.patrols}
    guards = []
    for guard in state.guards:
        if guard.guard_ref not in live or guard.patrol_ref is None:
            guards.append(guard)
            continue
        body = after_bodies[guard.patrol_ref]
        poses = tuple(n.node_ref for n in model.nodes if (n.x, n.y) == (body.x, body.y))
        updates = {"x": body.x, "y": body.y, "node_ref": poses[0] if len(poses) == 1 else None}
        if guard.patrol_direction_controls_orientation:
            for field in ("frontal_offsets", "side_offsets", "rear_offsets"):
                transported = rotate_contact_offsets(getattr(guard, field), (guard.dx, guard.dy), (body.dx, body.dy))
                if transported is None:
                    return state, (), ("supported_current_patrol_orientation",), native.examined_count, False
                updates[field] = transported
            updates.update({"dx": body.dx, "dy": body.dy})
        guards.append(guard.model_copy(update=updates))
    captured = native.values.get("captured_target_refs", ())
    after = state.model_copy(update={"patrol_state": after_patrol, "guards": tuple(guards),
        "dead": state.dead or model.player_patrol_target_ref in captured})
    return after, native.values.get("events", ()), (), native.examined_count, False


def calculate_graph_patrols(request: ReactiveGraphRequestC) -> ReactiveGraphResultC:
    missing = graph_input_missing(request)
    if missing:
        return graph_return(request, request.state, missing=missing)
    if not request.model.patrol_phase_enabled:
        return graph_return(request, request.state, values={"source_patrol_phase_disabled": True})
    state = request.resume.current_state if request.resume else request.state
    after, events, missing, examined, bounded = patrol_transition(request, state, request.model,
        request.control, request.maximum_evaluations)
    cp = graph_checkpoint(request, state, events=events, examined=examined,
        pending=("atomic_current_k13_tick",)) if bounded else None
    return graph_return(request, after, missing=missing, bounded=bounded, checkpoint=cp, examined=examined,
        values={"owned_k13_events": events, "at_most_one_service_call_no_second_patroller": True,
            "native_partial_tick_is_not_committed": bounded or bool(missing)})


def joint_order_missing(state, model):
    required = {"PLAYER_MOVE", "INPUT_CLOCK", "CONTACT", "BOUNDARY"}
    if model.follower_phase_enabled: required.add("FOLLOWER")
    if model.patrol_phase_enabled: required.add("PATROL")
    order = model.joint_phase_order
    if len(set(order)) != len(order) or set(order) != required or not model.simultaneous_priority_evidence_refs:
        return ("complete_supported_joint_phase_order",)
    if (len(set(model.contact_guard_order_refs)) != len(model.contact_guard_order_refs)
            or set(model.contact_guard_order_refs) != {g.guard_ref for g in state.guards}
            or len(set(model.contact_kind_order)) != len(model.contact_kind_order)
            or set(model.contact_kind_order) != {"FRONT", "SIDE", "REAR", "BODY"}):
        return ("complete_contact_identity_and_overlap_priority",)
    return ()


def _joint_chunk(request, state, control, model, allowance, phase=0, item=0, events=(), cost=0):
    missing = joint_order_missing(state, model)
    if missing: return state, phase, item, tuple(events), cost, 0, missing, False
    events = list(events)
    examined = 0
    while phase < len(model.joint_phase_order):
        if state.dead or state.completed:
            break
        stage = model.joint_phase_order[phase]
        if len(events) >= request.maximum_states:
            return state, phase, item, tuple(events), cost, examined, (), True
        before = state
        if stage == "PLAYER_MOVE":
            work = len(model.links) + len(model.nodes)
            if examined + work > allowance: return state, phase, item, tuple(events), cost, examined, (), True
            state, debit, masks, missing = edge_transition(state, model, control)
            examined += work
            if missing: return before, phase, item, tuple(events), cost, examined, missing, False
            cost += debit
            events.append(immutable_json_data({"phase": stage, "before": before, "after": state,
                "cost": debit, "internal_player_masks": masks, "blocked": not masks}))
        elif stage == "INPUT_CLOCK":
            if examined + 1 > allowance: return state, phase, item, tuple(events), cost, examined, (), True
            movement = next((event for event in events if event.get("phase") == "PLAYER_MOVE"), None)
            if movement is None:
                _, _, masks, debt = edge_transition(state, model, control)
                if debt: return state, phase, item, tuple(events), cost, examined, debt, False
                blocked = not masks
            else:
                blocked = movement["blocked"]
            advancement = model.blocked_command_advances_clock if blocked else model.nominal_input_advances_phase
            if advancement is None or not model.phase_clock_evidence_refs:
                return state, phase, item, tuple(events), cost, examined, ("current_nominal_or_blocked_input_phase_clock",), False
            examined += 1
            if advancement: state = state.model_copy(update={"phase_tick": state.phase_tick + 1})
            events.append(immutable_json_data({"phase": stage, "before": before, "after": state,
                "blocked_input": blocked, "clock_advanced": advancement}))
        elif stage == "CONTACT":
            movement = next((event for event in events if event.get("phase") == "PLAYER_MOVE"), None)
            if movement is not None:
                endpoint_ref = movement["after"]["player_node_ref"]
                endpoint = next(n for n in model.nodes if n.node_ref == endpoint_ref)
                masks = movement.get("internal_player_masks", ()) or (endpoint.resting_mask,)
            else:
                endpoint_ref = state.player_node_ref
                endpoint = next(n for n in model.nodes if n.node_ref == endpoint_ref)
                masks = (endpoint.resting_mask,)
            guards = {g.guard_ref: g for g in state.guards}
            order = model.contact_guard_order_refs
            total_contacts = len(masks) * len(order)
            while item < total_contacts:
                guard = guards[order[item % len(order)]]
                mask_index = item // len(order)
                mask = masks[mask_index]
                if guard.guard_ref not in state.live_guard_refs:
                    item += 1
                    continue
                work = len(mask) + sum(len(x) for x in (guard.body_offsets,
                    guard.frontal_offsets, guard.side_offsets, guard.rear_offsets)) + len(model.reactions)
                if examined + work > allowance or len(events) >= request.maximum_states:
                    return state, phase, item, tuple(events), cost, examined, (), True
                examined += work
                contact = contact_row(guard, mask)
                if not contact["geometry_evidenced"]:
                    return state, phase, item, tuple(events), cost, examined, ("current_guard_contact_geometry",), False
                hits = tuple(kind for kind in model.contact_kind_order if contact[kind])
                effect = "NO_EFFECT"
                if hits:
                    laws = tuple(r for r in model.reactions if r.guard_ref == guard.guard_ref and r.contact == hits[0])
                    if len(laws) != 1 or not laws[0].evidence_refs or laws[0].effect == "UNKNOWN":
                        boundary_state = state.model_copy(update={"player_node_ref": endpoint_ref
                            if mask == endpoint.resting_mask else None, "player_transit_mask": mask})
                        return boundary_state, phase, item, tuple(events), cost, examined, ("current_first_contact_reaction",), False
                    effect = laws[0].effect
                previous = state
                if effect == "DEATH":
                    state = state.model_copy(update={"dead": True, "player_node_ref": endpoint_ref
                        if mask == endpoint.resting_mask else None, "player_transit_mask": mask})
                elif effect == "REMOVE_GUARD":
                    state = state.model_copy(update={"live_guard_refs": tuple(ref for ref in state.live_guard_refs if ref != guard.guard_ref)})
                events.append(immutable_json_data({"phase": stage, "guard_ref": guard.guard_ref,
                    "contacts": hits, "internal_position_index": mask_index, "player_mask": mask,
                    "effect": effect, "before": previous, "after": state}))
                item += 1
                if state.dead: break
            if not state.dead:
                state = state.model_copy(update={"player_node_ref": endpoint_ref, "player_transit_mask": None})
        elif stage == "FOLLOWER":
            laws = {law.follower_ref: law for law in model.follower_laws}
            if len(laws) != len(model.follower_laws):
                return state, phase, item, tuple(events), cost, examined, ("unique_follower_law",), False
            blocked = next((event.get("blocked") for event in events if event.get("phase") == "PLAYER_MOVE"), None)
            if blocked is None:
                _, _, trace, debt = edge_transition(state, model, control)
                if debt: return state, phase, item, tuple(events), cost, examined, debt, False
                blocked = not trace
            while item < len(state.followers):
                follower = state.followers[item]
                law = laws.get(follower.follower_ref)
                work = len(follower.history_queue) + 2 * (len(law.body_offsets) if law and law.body_offsets else 0) + 1
                if examined + work > allowance or len(events) >= request.maximum_states:
                    return state, phase, item, tuple(events), cost, examined, (), True
                changed_state, changed, debt = follower_step_with_contact(state, model, item, blocked)
                examined += work
                if debt: return state, phase, item, tuple(events), cost, examined, debt, False
                previous = state
                state = changed_state
                events.append(immutable_json_data({"phase": stage, "follower_ref": follower.follower_ref,
                    "before": previous, "after": state}))
                item += 1
                if state.dead: break
        elif stage == "PATROL":
            state, native_events, debt, work, bounded = patrol_transition(request, state, model, control, allowance - examined)
            examined += work
            if debt or bounded:
                return before, phase, item, tuple(events), cost, examined, debt, bounded
            events.append(immutable_json_data({"phase": stage, "before": before, "after": state,
                "owned_k13_events": native_events}))
        elif stage == "BOUNDARY":
            if examined + 1 > allowance: return state, phase, item, tuple(events), cost, examined, (), True
            examined += 1
            if not model.completion_evidence_refs:
                return state, phase, item, tuple(events), cost, examined, ("current_completion_predicate_evidence",), False
            completed = (state.player_node_ref in model.completion_node_refs
                and not set(model.completion_requires_guard_refs_absent).intersection(state.live_guard_refs))
            state = state.model_copy(update={"completed": completed})
            events.append(immutable_json_data({"phase": stage, "before": before, "after": state}))
        phase += 1
        item = 0
    return state, phase, item, tuple(events), cost, examined, (), False


def calculate_graph_joint(request: ReactiveGraphRequestC) -> ReactiveGraphResultC:
    missing = graph_input_missing(request)
    if missing: return graph_return(request, request.state, missing=missing)
    cp = request.resume
    state = cp.current_state if cp else request.state
    phase, item = (cp.phase_index, cp.item_index) if cp else (0, 0)
    events = cp.current_events if cp else ()
    cost = cp.cursor_data.get("cost", 0) if cp else 0
    if phase > len(request.model.joint_phase_order) or type(cost) is not int or cost < 0:
        return graph_return(request, state, missing=("valid_current_joint_cursor",))
    state, phase, item, events, cost, examined, missing, bounded = _joint_chunk(request, state,
        request.control, request.model, request.maximum_evaluations, phase, item, events, cost)
    continuation = graph_checkpoint(request, state, phase=phase, item=item, events=events,
        examined=examined, cursor={"cost": cost}, pending=missing) if bounded or missing else None
    return graph_return(request, state, missing=missing, bounded=bounded, checkpoint=continuation, examined=examined,
        values={"before_state": request.state, "phase_events": events, "cost": cost,
            "first_death_or_completion_boundary": state.dead or state.completed,
            "unknown_reaction_is_not_completion": bool(missing)})


def calculate_graph_calendar(request: ReactiveGraphRequestC) -> ReactiveGraphResultC:
    missing = graph_input_missing(request)
    if missing: return graph_return(request, request.state, missing=missing)
    if request.calendar_policy_revision_ref is None or request.calendar_removal_revision_ref is None:
        return graph_return(request, request.state, missing=("current_patrol_calendar_policy_and_removal_revisions",))
    if len(request.controls) < request.horizon:
        return graph_return(request, request.state, missing=("explicit_calendar_clock_events_for_horizon",))
    cp = request.resume
    state = cp.current_state if cp else request.state
    rows = list(cp.retained_rows) if cp else []
    start, examined = cp.outer_index if cp else 0, 0
    if start > request.horizon or len(rows) != start:
        return graph_return(request, state, rows, missing=("exact_calendar_prefix_cursor",))
    for index in range(start, request.horizon):
        if len(rows) >= request.maximum_states:
            continuation = graph_checkpoint(request, state, outer=index, rows=rows, examined=examined)
            return graph_return(request, state, rows, bounded=True, checkpoint=continuation, examined=examined)
        if request.model.patrol_phase_enabled:
            after, events, debt, work, bounded = patrol_transition(request, state, request.model,
                request.controls[index], request.maximum_evaluations - examined)
        else:
            after, events, debt, work, bounded = state, (), (), 0, False
        examined += work
        if debt or bounded:
            continuation = graph_checkpoint(request, state, outer=index, rows=rows, examined=examined, pending=debt)
            return graph_return(request, state, rows, missing=debt, bounded=bounded, checkpoint=continuation, examined=examined)
        state = after
        rows.append(immutable_json_data({"input_index": index, "state": state, "owned_k13_events": events,
            "policy_revision_ref": request.calendar_policy_revision_ref,
            "removal_revision_ref": request.calendar_removal_revision_ref}))
        if state.dead: break
    return graph_return(request, state, rows, examined=examined,
        missing=("calendar_interrupted_by_capture",) if state.dead and len(rows) < request.horizon else (),
        values={"calendar_context_digest": graph_context_digest(request), "complete_horizon": len(rows) == request.horizon,
            "first_capture_boundary": state.dead})


def calculate_graph_equivalence(request: ReactiveGraphRequestC) -> ReactiveGraphResultC:
    missing = graph_input_missing(request)
    if missing: return graph_return(request, request.state, missing=missing)
    if request.other_state is None: return graph_return(request, request.state, missing=("second_full_graph_state",))
    left, right = request.state, request.other_state
    period = request.model.supported_period
    if period is not None:
        if not request.model.period_evidence_refs:
            return graph_return(request, left, missing=("supported_phase_period_evidence",))
        left = left.model_copy(update={"phase_tick": left.phase_tick % period})
        right = right.model_copy(update={"phase_tick": right.phase_tick % period})
    return graph_return(request, request.state, examined=1,
        values={"full_successor_state_equal": left == right, "period_reduction_used": period is not None,
            "full_live_set_and_follower_queue_compared": True})


def calculate_graph_detour(request: ReactiveGraphRequestC) -> ReactiveGraphResultC:
    missing = graph_input_missing(request)
    if missing: return graph_return(request, request.state, missing=missing)
    if request.alternative_state is None:
        return graph_return(request, request.state, missing=("explicit_full_replacement_or_ablation_state",))
    alternate_request = request.model_copy(update={"state": request.alternative_state, "resume": None})
    alternate_missing = graph_input_missing(alternate_request)
    if alternate_missing: return graph_return(request, request.state, missing=alternate_missing)
    cp = request.resume
    baseline = cp.current_state if cp else request.state
    alternative = cp.secondary_state if cp else request.alternative_state
    rows = list(cp.retained_rows) if cp else []
    index, branch, item = (cp.outer_index, cp.phase_index, cp.item_index) if cp else (0, 0, 0)
    events = cp.current_events if cp else ()
    cursor = dict(cp.cursor_data) if cp else {}
    inner_phase = cursor.get("inner_phase", 0)
    cost = cursor.get("branch_cost", 0)
    examined = 0
    while index < len(request.controls):
        if alternative is None or branch not in (0, 1) or type(inner_phase) is not int or type(cost) is not int:
            return graph_return(request, baseline, rows, missing=("complete_detour_suffix_checkpoint",))
        current = baseline if branch == 0 else alternative
        control = request.controls[index]
        if current.dead or current.completed:
            changed, end_phase, end_item, after_events, new_cost, work, debt, bounded = current, 0, 0, (), cost, 0, (), False
        else:
            view = request.model_copy(update={"state": request.state if branch == 0 else request.alternative_state, "resume": None})
            changed, end_phase, end_item, after_events, new_cost, work, debt, bounded = _joint_chunk(view, current,
                control, request.model, request.maximum_evaluations - examined, inner_phase, item, events, cost)
        examined += work
        if bounded or debt or len(rows) >= request.maximum_states:
            if branch == 0: baseline = changed
            else: alternative = changed
            continuation = graph_checkpoint(request, baseline, outer=index, phase=branch, item=end_item,
                rows=rows, events=after_events, examined=examined, secondary=alternative,
                cursor={"inner_phase": end_phase, "branch_cost": new_cost}, pending=debt)
            return graph_return(request, baseline, rows, missing=debt, bounded=bounded or len(rows) >= request.maximum_states,
                checkpoint=continuation, examined=examined)
        if branch == 0: baseline = changed
        else: alternative = changed
        rows.append(immutable_json_data({"suffix_index": index, "branch": branch, "state": changed,
            "cost": new_cost, "phase_events": after_events}))
        inner_phase, item, events, cost = 0, 0, (), 0
        branch += 1
        if branch == 2:
            branch = 0
            index += 1
    return graph_return(request, baseline, rows, examined=examined,
        values={"baseline_final_state": baseline, "alternative_final_state": alternative,
            "full_state_equal": baseline == alternative, "local_suffix_comparison_only": True,
            "global_necessity_not_proved": True})


def calculate_graph_measure(request: ReactiveGraphRequestC) -> ReactiveGraphResultC:
    missing = graph_input_missing(request)
    if missing: return graph_return(request, request.state, missing=missing)
    if request.maximum_evaluations < len(request.model.nodes) + len(request.model.links):
        cp = graph_checkpoint(request, request.state, pending=("complete_graph_measurement_budget",))
        return graph_return(request, request.state, bounded=True, checkpoint=cp)
    return graph_return(request, request.state, examined=len(request.model.nodes) + len(request.model.links),
        values={"node_count": len(request.model.nodes), "link_count": len(request.model.links),
            "full_state": request.state, "model": request.model,
            "explicit_unresolved_laws": tuple(name for name, missing_value in (
                ("blocked_command_supported", request.model.blocked_command_supported is None),
                ("blocked_command_cost", request.model.blocked_command_cost is None),
                ("blocked_input_clock", request.model.blocked_command_advances_clock is None)) if missing_value),
            "geometry_reused_without_role_or_policy_inference": True})


def calculate_graph_precondition(request: ReactiveGraphRequestC) -> ReactiveGraphResultC:
    missing = graph_input_missing(request)
    if missing: return graph_return(request, request.state, missing=missing)
    work = len(request.model.nodes) + len(request.model.links)
    if work > request.maximum_evaluations:
        cp = graph_checkpoint(request, request.state, pending=("complete_graph_precondition_budget",))
        return graph_return(request, request.state, bounded=True, checkpoint=cp)
    _, cost, masks, debt = edge_transition(request.state, request.model, request.control)
    order_debt = joint_order_missing(request.state, request.model)
    return graph_return(request, request.state, missing=tuple(sorted(set(debt + order_debt))), examined=work,
        values={"edge_preconditions_supported": not debt, "joint_order_supported": not order_debt,
            "input_cost": cost, "internal_masks": masks, "action_release_not_authorized": True})


def calculate_graph_fit(request: ReactiveGraphRequestC) -> ReactiveGraphResultC:
    if not request.model_candidates or not request.observations:
        return graph_return(request, request.state, missing=("finite_declared_models_and_revalidated_observation_pairs",))
    if request.state is None:
        return graph_return(request, None, missing=("current_full_graph_state",))
    if len({model.model_ref for model in request.model_candidates}) != len(request.model_candidates):
        return graph_return(request, request.state, missing=("distinct_finite_model_candidate_identities",))
    if request.scope.request_ref in request.scope.consumed_request_refs:
        return graph_return(request, request.state, missing=("unconsumed_graph_calculation",))
    if request.resume and (request.resume.context_digest != graph_context_digest(request)
            or request.resume.operation_ref != request.operation_ref):
        return graph_return(request, request.state, missing=("current_revision_keyed_graph_checkpoint",))
    cp = request.resume
    rows = list(cp.retained_rows) if cp else []
    model_index, observation_index, item = (cp.outer_index, cp.phase_index, cp.item_index) if cp else (0, 0, 0)
    cursor = dict(cp.cursor_data) if cp else {}
    current = cp.current_state if cp else request.state
    events = cp.current_events if cp else ()
    inner_phase, cost = cursor.get("inner_phase", 0), cursor.get("cost", 0)
    examined, candidate_contradicted = 0, cursor.get("candidate_contradicted", False)
    while model_index < len(request.model_candidates):
        model = request.model_candidates[model_index]
        while observation_index < len(request.observations) and not candidate_contradicted:
            observation = request.observations[observation_index]
            if observation.current_revalidation_ref is None:
                return graph_return(request, current, rows, missing=("current_observation_revalidation",), examined=examined)
            view = request.model_copy(update={"state": observation.before_state, "model": model,
                "control": observation.control, "resume": None})
            missing = graph_input_missing(view)
            if missing: return graph_return(request, current, rows, missing=missing, examined=examined)
            if inner_phase == 0 and item == 0 and not events:
                current = observation.before_state
            current, next_phase, next_item, next_events, next_cost, work, debt, bounded = _joint_chunk(view, current,
                observation.control, model, request.maximum_evaluations - examined, inner_phase, item, events, cost)
            examined += work
            if bounded or debt:
                continuation = graph_checkpoint(request, current, outer=model_index, phase=observation_index,
                    item=next_item, rows=rows, events=next_events, examined=examined,
                    cursor={"inner_phase": next_phase, "cost": next_cost,
                        "candidate_contradicted": candidate_contradicted}, pending=debt)
                return graph_return(request, current, rows, missing=debt, bounded=bounded, checkpoint=continuation, examined=examined)
            candidate_contradicted = current != observation.after_state
            observation_index += 1
            inner_phase, item, events, cost = 0, 0, (), 0
        if len(rows) >= request.maximum_states:
            continuation = graph_checkpoint(request, current, outer=model_index, phase=observation_index,
                rows=rows, examined=examined, cursor={"candidate_contradicted": candidate_contradicted})
            return graph_return(request, current, rows, bounded=True, checkpoint=continuation, examined=examined)
        rows.append(FrozenMap({"model_ref": model.model_ref, "observed_pairs_checked": observation_index,
            "contradicted_by_evidenced_pair": candidate_contradicted, "consistent_in_declared_scope": not candidate_contradicted}))
        model_index += 1
        observation_index, inner_phase, item, events, cost, candidate_contradicted = 0, 0, 0, (), 0, False
    return graph_return(request, request.state, rows, examined=examined,
        missing=() if request.candidate_domain_complete else ("closed_declared_model_candidate_domain",),
        values={"candidate_domain_complete": request.candidate_domain_complete,
            "consistent_models": tuple(row["model_ref"] for row in rows if row["consistent_in_declared_scope"]),
            "history_fit_not_universal_law_proof": True})


def calculate_graph_inverse(request: ReactiveGraphRequestC) -> ReactiveGraphResultC:
    missing = graph_input_missing(request)
    if missing: return graph_return(request, request.state, missing=missing)
    if request.target_state is None or not request.candidate_domain_complete:
        return graph_return(request, request.state, missing=("explicit_target_and_closed_inverse_candidate_domain",))
    cp = request.resume
    rows = list(cp.retained_rows) if cp else []
    index, phase, item = (cp.outer_index, cp.phase_index, cp.item_index) if cp else (0, 0, 0)
    current = cp.current_state if cp else request.state
    events = cp.current_events if cp else ()
    cost = cp.cursor_data.get("cost", 0) if cp else 0
    examined = 0
    while index < len(request.inverse_candidates):
        candidate = request.inverse_candidates[index]
        view = request.model_copy(update={"state": candidate, "resume": None})
        missing = graph_input_missing(view)
        if missing: return graph_return(request, current, rows, missing=missing, examined=examined)
        if phase == 0 and item == 0 and not events:
            current = candidate
        current, phase, item, events, cost, work, debt, bounded = _joint_chunk(view, current, request.control,
            request.model, request.maximum_evaluations - examined, phase, item, events, cost)
        examined += work
        if debt or bounded or len(rows) >= request.maximum_states:
            continuation = graph_checkpoint(request, current, outer=index, phase=phase, item=item, rows=rows,
                events=events, examined=examined, cursor={"cost": cost}, pending=debt)
            return graph_return(request, current, rows, missing=debt, bounded=bounded or len(rows) >= request.maximum_states,
                checkpoint=continuation, examined=examined)
        rows.append(immutable_json_data({"candidate_index": index, "before_state": candidate,
            "after_state": current, "matches_full_target": current == request.target_state, "cost": cost}))
        index += 1
        phase, item, events, cost = 0, 0, (), 0
    return graph_return(request, request.state, rows, examined=examined,
        values={"exhaustive_within_declared_candidate_domain": True,
            "matching_candidate_indices": tuple(row["candidate_index"] for row in rows if row["matches_full_target"]),
            "no_unlisted_inverse_candidate_invented": True})


def unsupported_graph_operation(request: ReactiveGraphRequestC) -> ReactiveGraphResultC:
    return ReactiveGraphResultC(native=family_result(request, signature_supported=False,
        prerequisite_refs=("exact_source_graph_operation_and_mode",), domain_complete=False),
        checkpoint=None, state=request.state, rows=())


def finish_graph_source_return(value: ReactiveGraphSourceReturnInputC) -> ReactiveGraphSourceReturnC:
    return ReactiveGraphSourceReturnC(frozen_request=value.request, calculation=value.calculation,
        source_policy_ref=value.source_policy_ref, source_disposition_ref=value.source_disposition_ref,
        source_reason_ref=value.source_reason_ref)
