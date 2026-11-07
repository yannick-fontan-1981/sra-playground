"""Exact event-ledger folding. No role, goal, route or action is selected here."""
from __future__ import annotations

from .mechanical_common_contracts_c import (
    EventCompositionInputC, EventCompositionResultC, MechanicalPredicateC,
    MechanicalAcceptanceObservationC,
)
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest, immutable_json_data
from .constraint_event_scope_d import constraint_scope_binding_needs_d,constraint_event_applies_d
from .typed_relation_domains_d import bind_typed_relation_domains_d


def packet_context_equal(parent, child, model_ref=None) -> bool:
    provenance_equal = all(getattr(parent, name) == getattr(child, name) for name in (
        "caller_ref", "parent_contribution_ref", "epoch", "input_revision_ref",
    ))
    if not provenance_equal:
        return False
    if parent.model_assignments == child.model_assignments:
        return True
    # The caller may bind one exact named member of its retained model set.
    # Python verifies that supplied binding; it never selects that member.
    return (model_ref is not None and model_ref in parent.model_assignments
        and parent.model_assignments[model_ref] == child.model_assignments)


def predicate_value(predicate: MechanicalPredicateC, state: FrozenMap, *, event_scope_bound=False, relation_domain_bound=False) -> bool | None:
    if predicate.constraint_scope is not None and not event_scope_bound:return None
    domain=predicate.relation_domain
    if domain is not None:
        if not relation_domain_bound:return None
        domains=state.get('typed_relation_domains')
        if (not isinstance(domains,FrozenMap) or domains.get(domain.domain_ref)!=immutable_json_data(domain)):
            return None
    if predicate.field_ref not in state:
        return None
    actual, expected = state[predicate.field_ref], predicate.expected
    for part in predicate.field_path:
        if isinstance(actual, FrozenMap) and isinstance(part, str) and part in actual:
            actual = actual[part]
        elif isinstance(actual, tuple) and type(part) is int and 0 <= part < len(actual):
            actual = actual[part]
        else:
            return None
    if predicate.comparison == "EQ":
        return actual == expected
    if predicate.comparison == "NE":
        return actual != expected
    if predicate.comparison == "SET_EQ":
        # Membership equality is explicitly requested by SRC/DRM. Exact
        # values are compared without requiring hashability or ordering,
        # and without converting a scalar/missing value to an empty set.
        if not isinstance(actual, (tuple, frozenset)) or not isinstance(expected, (tuple, frozenset)):
            return None
        return all(any(item == candidate for candidate in expected) for item in actual) and all(
            any(item == candidate for candidate in actual) for item in expected)
    if predicate.comparison == "IN":
        return actual in expected if isinstance(expected, (tuple, frozenset)) else None
    if type(actual) not in (int, float) or type(expected) not in (int, float):
        return None
    return actual <= expected if predicate.comparison == "LE" else actual >= expected


def compose_mechanical_events(value: EventCompositionInputC) -> EventCompositionResultC:
    state = value.initial
    states = [state]
    ledger = []
    occurrences = {}
    consumed = set(value.consumed_request_refs)
    delta = []
    missing, failed = set(), set()
    contradictory = bounded = False
    cost = cursor = 0
    interruption = None
    bounds = value.request.actual_bounds
    for name in ("max_primitives", "max_events"):
        if name not in bounds:
            missing.add(name)
    primitive_limit = bounds.get("max_primitives", 0)
    event_limit = bounds.get("max_events", 0)
    # Bind the complete supplied event domain before any projected write, clock
    # effect or debit. Shared physical occurrences require one joint packet;
    # two separate STEP requests do not license a second ownership or charge.
    bound_occurrences = {}
    bound_order = []
    boundaries_by_occurrence = {}
    boundary_observations = {}
    prebinding_event_visits = 0
    if value.request.request_ref in consumed:
        missing.add("already_consumed_composition_request")
    for packet_index, packet in enumerate(value.packets):
        if missing or contradictory or bounded:
            break
        if packet_index >= primitive_limit:
            bounded = True
            missing.add("event_ownership_prebinding_primitive_bound")
            break
        for event in packet.events:
            if missing or contradictory:
                break
            if prebinding_event_visits >= event_limit:
                bounded = True
                missing.add("event_ownership_prebinding_event_bound")
                break
            prebinding_event_visits += 1
            prior = bound_occurrences.get(event.occurrence_ref)
            if prior is not None:
                prior_request_ref, prior_event = prior
                if prior_event != event:
                    contradictory = True
                    missing.add("event_ownership_prebinding_conflict")
                    missing.add(event.occurrence_ref)
                elif prior_request_ref != packet.request.request_ref:
                    missing.add("shared_event_requires_single_joint_packet")
            else:
                bound_occurrences[event.occurrence_ref] = (packet.request.request_ref, event)
                bound_order.append((packet.request.request_ref, event.occurrence_ref))

    # Source declares the whole event order, not an inferred priority among
    # cost, arrival, reaction, restoration or terminal events. Compare before
    # any projected effect; an endpoint cannot repair a different prefix.
    bound_declared_order = value.request.immutable_inputs.get("declared_event_order")
    if value.declared_event_order or bound_declared_order is not None:
        if bound_declared_order != value.declared_event_order:
            missing.add("unbound_declared_event_order")
        if len(set(value.declared_event_order)) != len(value.declared_event_order):
            missing.add("duplicate_declared_event_order")
        if tuple(bound_order) != value.declared_event_order[:len(bound_order)]:
            contradictory = True
            missing.add("declared_event_order_mismatch")
    acceptance_digest = stable_digest(tuple(immutable_json_data(item) for item in value.acceptance_boundaries))
    bound_acceptance_digest = value.request.immutable_inputs.get("acceptance_boundaries_digest")
    if value.acceptance_boundaries or bound_acceptance_digest is not None:
        if bound_acceptance_digest != acceptance_digest:
            missing.add("unbound_acceptance_boundaries")
        for boundary in value.acceptance_boundaries:
            if boundary.boundary_ref in boundary_observations:
                missing.add("duplicate_acceptance_boundary")
                continue
            boundary_observations[boundary.boundary_ref] = MechanicalAcceptanceObservationC(
                boundary=boundary, occurred=False)
            bound = bound_occurrences.get(boundary.event_occurrence_ref)
            if bound is None:
                # A PATH prefix or supported interruption can leave this exact
                # future scope unvisited. Keep its candidate result unknown;
                # neither a match elsewhere nor terminal erases that debt.
                continue
            request_ref, event = bound
            if (request_ref != boundary.request_ref or event.producer_ref != boundary.producer_ref
                    or event.kind_ref != boundary.event_kind_ref
                    or event.temporal_scope_ref != boundary.temporal_scope_ref
                    or event.snapshot_ref != boundary.snapshot_ref or event.snapshot_kind != boundary.snapshot_kind
                    or event.clock_ref != boundary.clock_ref
                    or event.tick != boundary.tick
                    or len({item.predicate_ref for item in boundary.predicates}) != len(boundary.predicates)
                    or any(item.event_kind_refs and event.kind_ref not in item.event_kind_refs
                        for item in boundary.predicates)):
                missing.add("acceptance_boundary_scope_mismatch")
                continue
            boundaries_by_occurrence.setdefault(boundary.event_occurrence_ref, []).append(boundary)

    missing.update(constraint_scope_binding_needs_d(value.request,value.predicates))
    scoped_evaluations={predicate.predicate_ref:0 for predicate in value.predicates if predicate.constraint_scope is not None}
    def evaluate(current, kind=None, event=None):
        view,relation_needs=bind_typed_relation_domains_d(value.request,current,value.relation_bindings,value.predicates)
        missing.update(relation_needs)
        for predicate in value.predicates:
            if not constraint_event_applies_d(predicate,event):continue
            if kind is None and not predicate.include_initial:
                continue
            if kind is not None and predicate.event_kind_refs and kind not in predicate.event_kind_refs:
                continue
            if predicate.constraint_scope is not None:scoped_evaluations[predicate.predicate_ref]+=1
            result = predicate_value(predicate, view,event_scope_bound=True,relation_domain_bound=not relation_needs)
            if result is None:
                missing.add(predicate.predicate_ref)
            elif not result:
                failed.add(predicate.predicate_ref)

    evaluate(state)
    for packet in value.packets:
        if missing or failed or contradictory or bounded or interruption:
            break
        if cursor >= primitive_limit:
            bounded = True
            break
        if (packet.parent_request != value.request
                or not packet_context_equal(value.request, packet.request, packet.model_ref)
                or packet.before != state
                or packet.request.immutable_inputs.get("state") != packet.before):
            contradictory = True
            missing.add("exact_step_input_identity")
            break
        if packet.request.request_ref in consumed:
            contradictory = True
            missing.add("already_consumed_step")
            break
        # A partial ledger can describe a real prefix. It cannot certify the
        # packet's successor, nor increment an external primitive a second time.
        seen_local = {}
        groups = []
        for event in packet.events:
            prior = occurrences.get(event.occurrence_ref, seen_local.get(event.occurrence_ref))
            if prior is not None:
                if prior != event:
                    contradictory = True
                    missing.add(event.occurrence_ref)
                continue
            seen_local[event.occurrence_ref] = event
            if (groups and event.snapshot_kind in ("SIMULTANEOUS", "PRE_DOSE")
                    and groups[-1][0].snapshot_ref == event.snapshot_ref
                    and groups[-1][0].clock_ref == event.clock_ref
                    and groups[-1][0].tick == event.tick):
                groups[-1].append(event)
            else:
                groups.append([event])
        for group in groups:
            if contradictory or missing or failed or bounded or interruption:
                break
            if len(ledger) + len(group) > event_limit:
                bounded = True
                break
            writes = {}
            deleted = set()
            pre_group = state
            group_refs = set()
            for event in group:
                snapshot = packet.snapshots.get(event.snapshot_ref)
                expected_snapshot = packet.before if event.snapshot_kind == "PRE_COMMAND" else pre_group
                if snapshot != expected_snapshot:
                    missing.add(event.snapshot_ref)
                    break
                if any(ref not in occurrences and ref not in group_refs for ref in event.predecessor_refs):
                    missing.add("event_predecessor_order")
                    break
                if any(key not in snapshot or snapshot[key] != event.reads[key] for key in event.reads):
                    contradictory = True
                    missing.add("event_read_snapshot")
                    break
                if any(type(event.costs[key]) is not int or event.costs[key] < 0 for key in event.costs):
                    contradictory = True
                    missing.add("event_cost_domain")
                    break
                for key in event.writes:
                    if key in writes and writes[key] != event.writes[key]:
                        contradictory = True
                        missing.add(key)
                    writes[key] = event.writes[key]
                deleted.update(event.deleted_state_refs)
                if any(key in writes for key in deleted):
                    contradictory = True
                    missing.add("simultaneous_write_delete_conflict")
                group_refs.add(event.occurrence_ref)
            if missing or contradictory:
                break
            retained_state = FrozenMap({key: state[key] for key in sorted(state) if key not in deleted})
            state = FrozenMap.overlay(writes, retained_state)
            states.append(state)
            for event in group:
                occurrences[event.occurrence_ref] = event
                ledger.append(event)
                evaluate(FrozenMap.overlay(event.predicate_values, state), event.kind_ref,event)
                for boundary in boundaries_by_occurrence.get(event.occurrence_ref, ()):
                    results = FrozenMap({predicate.predicate_ref: predicate_value(predicate,
                        FrozenMap.overlay(event.predicate_values, state)) for predicate in boundary.predicates})
                    values = tuple(results[key] for key in sorted(results))
                    conjunction = (False if any(item is False for item in values)
                        else None if any(item is None for item in values) else True)
                    boundary_observations[boundary.boundary_ref] = MechanicalAcceptanceObservationC(
                        boundary=boundary, occurred=True, event_index=len(ledger) - 1,
                        state_index=len(states) - 1, predicate_results=results,
                        conjunction=conjunction, interruption_ref=event.interruption_ref)
                if event.interruption_ref is not None:
                    interruption = event.interruption_ref
        if contradictory or bounded or missing or failed:
            break
        if state != packet.after:
            contradictory = True
            missing.add("event_ledger_successor_mismatch")
            break
        consumed.add(packet.request.request_ref)
        delta.append(packet.request.request_ref)
        cursor += 1
        cost += packet.cost
        if not packet.complete:
            missing.update(packet.missing_refs or ("incomplete_step_closure",))
            break
        if packet.terminal:
            interruption = interruption or packet.closure_stop_ref
    complete = not (missing or failed or contradictory or bounded) and (
        cursor == len(value.packets) or interruption is not None)
    return EventCompositionResultC(request=value.request, state=state, events=tuple(ledger),
        states=tuple(states), primitive_count=cursor, cost=cost, complete=complete,
        bounded=bounded, contradictory=contradictory, missing_refs=tuple(sorted(missing)),
        failed_predicate_refs=tuple(sorted(failed)), consumed_request_delta=tuple(delta),
        interruption_ref=interruption, packet_cursor=cursor,
        acceptance_observations=tuple(boundary_observations[key] for key in sorted(boundary_observations)),
        facts=FrozenMap({"complete": complete, "bounded": bounded,
            "contradictory": contradictory, "predicate_failure": bool(failed),
            "missing_measurement": bool(missing), "packet_count": cursor,
            "event_count": len(ledger), "interrupted": interruption is not None,
            "prebinding_event_visits": prebinding_event_visits,
            "trace_predicates_digest": stable_digest(tuple(immutable_json_data(predicate) for predicate in value.predicates)),
            "constraint_scope_evaluation_counts":FrozenMap(scoped_evaluations),
            "unvisited_constraint_scope_refs":tuple(ref for ref,count in sorted(scoped_evaluations.items()) if count==0),
            "acceptance_boundaries_digest": acceptance_digest,
            "declared_event_order_digest": stable_digest(value.declared_event_order),
            "declared_event_order_consumed_count": len(ledger) if value.declared_event_order else 0,
            "declared_event_order_complete": bool(value.declared_event_order) and len(ledger) == len(value.declared_event_order),
            "acceptance_boundaries_unvisited": any(not boundary_observations[key].occurred for key in sorted(boundary_observations)),
            "acceptance_boundaries_unknown": any(not boundary_observations[key].occurred
                or any(boundary_observations[key].predicate_results[ref] is None
                    for ref in sorted(boundary_observations[key].predicate_results))
                for key in sorted(boundary_observations)),
            "closure_scopes": tuple((packet.request.request_ref, packet.closure_domain_ref,
                packet.closure_stop_ref) for packet in value.packets[:cursor])}))
