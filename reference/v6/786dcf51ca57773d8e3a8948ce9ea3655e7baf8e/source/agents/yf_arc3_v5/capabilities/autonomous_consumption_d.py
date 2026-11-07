"""Identity/command-scoped opportunity changes and ordered reactive journeys."""
from __future__ import annotations
from collections import deque
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref, stable_digest
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result, d_map


class ConsumptionActorD(FrozenModel):
    identity_ref: Ref
    type_ref: Ref
    mode_ref: Ref
    size: int = Field(ge=1)
    node_ref: Ref
    room_ref: Ref
    influence_component_ref: Ref


class ConsumptionGraphD(FrozenModel):
    node_refs: tuple[Ref, ...] = Field(min_length=1, max_length=4096)
    directed_edges: tuple[tuple[Ref, Ref], ...] = Field(default=(), max_length=8192)
    blocked_node_refs: tuple[Ref, ...] = Field(default=(), max_length=4096)
    node_rooms: tuple[tuple[Ref, Ref], ...] = Field(min_length=1, max_length=4096)
    neighbor_order: tuple[Ref, ...] = Field(min_length=1, max_length=4096)

    @model_validator(mode='after')
    def physical_domain(self):
        nodes = set(self.node_refs)
        if len(nodes) != len(self.node_refs) or set(self.neighbor_order) != nodes or len(self.neighbor_order) != len(nodes):
            raise ValueError('exact physical node/tie-order domain required')
        if set(dict(self.node_rooms)) != nodes or len(dict(self.node_rooms)) != len(self.node_rooms):
            raise ValueError('every physical node requires its current room')
        if not set(self.blocked_node_refs) <= nodes or any(not set(e) <= nodes for e in self.directed_edges):
            raise ValueError('edge/occupancy domain outside physical graph')
        return self


class ConsumptionRelationD(FrozenModel):
    actor_type_ref: Ref
    victim_type_ref: Ref
    actor_mode_ref: Ref
    victim_mode_ref: Ref
    size_comparison: Literal['ANY', 'GT', 'GE', 'LT', 'LE', 'EQ']
    allowed: bool
    evidence_ref: Ref


class CommandRightsD(FrozenModel):
    actor_ref: Ref
    command_ref: Ref
    meals_left: int = Field(ge=0)
    crossings_left: int = Field(ge=0)
    escapes_left: int = Field(ge=0)
    change_rights: tuple[tuple[Ref, int], ...]


class ConsumptionModeRuleD(FrozenModel):
    type_ref: Ref
    input_mode_ref: Ref
    cause_ref: Ref
    output_mode_ref: Ref
    minimum_rivals: int = Field(ge=1)


class OpportunityModelD(FrozenModel):
    model_ref: Ref
    trigger: Literal['SHARED_OPPORTUNITY', 'ACTUAL_CONSUMPTION']
    neighborhood: Literal['INFLUENCE_COMPONENT', 'DISTANCE']
    distance_limit: int = Field(ge=0)
    opportunity_requires_physical_route: bool
    compare_observer_to_neighbor_size: bool
    neighbor_size_comparison: Literal['GT', 'GE', 'LT', 'LE', 'EQ']
    competitive_cause_ref: Ref
    isolated_cause_ref: Ref
    scarcity_cause_ref: Ref
    meal_cause_ref: Ref
    fear_cause_ref: Ref
    mode_rules: tuple[ConsumptionModeRuleD, ...] = Field(default=(), max_length=128)
    scarcity_excludes_eater: bool
    scarcity_excludes_competitive_change: bool


class MealEvidenceD(FrozenModel):
    event_ref: Ref
    eater_ref: Ref
    victim_ref: Ref
    command_ref: Ref


class ModeSnapshotD(FrozenModel):
    actors: tuple[ConsumptionActorD, ...] = Field(min_length=1, max_length=128)
    rights: tuple[CommandRightsD, ...] = Field(min_length=1, max_length=128)
    graph: ConsumptionGraphD
    eligibility: tuple[ConsumptionRelationD, ...] = Field(default=(), max_length=4096)
    command_ref: Ref
    phase: Literal['INITIAL', 'SCARCITY', 'MEAL', 'FEAR']
    meals: tuple[MealEvidenceD, ...] = Field(default=(), max_length=128)
    fear_actor_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    prior_competitive_actor_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    prior_opportunities: tuple[tuple[Ref, tuple[Ref, ...]], ...] = Field(default=(), max_length=128)


class SealedModeTransitionD(FrozenModel):
    receipt_ref: Ref
    epoch: int = Field(ge=0)
    sealed: bool
    snapshot: ModeSnapshotD
    observed_modes: tuple[tuple[Ref, Ref], ...]


class OpportunityConditionedModesRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.opportunity_conditioned_modes_request_d.v1'
    phase_ref: Literal['MODE_SNAPSHOT_OR_SEALED_FIT']
    snapshot: ModeSnapshotD
    models: tuple[OpportunityModelD, ...] = Field(min_length=1, max_length=128)
    transitions: tuple[SealedModeTransitionD, ...] = Field(default=(), max_length=128)
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = (
        ('mechanics.autonomous_route_intervention.opportunity_conditioned_modes', 'FIT'),
        ('mechanics.autonomous_route_intervention.opportunity_conditioned_modes', 'STEP_INTERNAL'))


class GrowthRuleD(FrozenModel):
    eater_type_ref: Ref
    eater_size: int
    victim_type_ref: Ref
    victim_size: int
    resulting_type_ref: Ref
    resulting_size: int = Field(ge=1)
    resulting_mode_ref: Ref
    evidence_ref: Ref


class JourneyPolicyD(FrozenModel):
    actor_ref: Ref
    target_order: tuple[Ref, ...] = Field(default=(), max_length=128)
    targeting: Literal['ORDERED', 'NEAREST_THEN_ORDER']
    refuge_nodes: tuple[Ref, ...] = Field(default=(), max_length=128)
    protected_room_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    protection_requires_reachable_escape: bool
    reaction_before_consumption: bool
    reselect_after_escape: bool
    escape_targeting: Literal['ORDERED', 'NEAREST_THEN_ORDER']
    escape_may_consume: bool
    refuge_reachability_current: bool | None


class JourneyWorldD(FrozenModel):
    actors: tuple[ConsumptionActorD, ...] = Field(min_length=1, max_length=128)
    rights: tuple[CommandRightsD, ...] = Field(min_length=1, max_length=128)
    graph: ConsumptionGraphD
    targeting_relations: tuple[ConsumptionRelationD, ...] = Field(default=(), max_length=4096)
    contact_relations: tuple[ConsumptionRelationD, ...] = Field(default=(), max_length=4096)
    policies: tuple[JourneyPolicyD, ...] = Field(min_length=1, max_length=128)
    growth_rules: tuple[GrowthRuleD, ...] = Field(default=(), max_length=4096)
    meal_event_bindings: tuple[tuple[Ref,Ref,Ref], ...] = Field(default=(),max_length=4096)
    command_ref: Ref

    @model_validator(mode='after')
    def command_owned_rights(self):
        ids = {a.identity_ref for a in self.actors}
        nodes = set(self.graph.node_refs)
        if len(ids) != len(self.actors) or {r.actor_ref for r in self.rights} != ids or len(self.rights) != len(ids):
            raise ValueError('one current rights record per persistent identity')
        if any(r.command_ref != self.command_ref for r in self.rights) or any(a.node_ref not in nodes for a in self.actors):
            raise ValueError('actor pose/rights command mismatch')
        if any(a.room_ref!=dict(self.graph.node_rooms)[a.node_ref] for a in self.actors):
            raise ValueError('actor room must equal current physical-node membership')
        if len({(a,b) for a,b,_ in self.meal_event_bindings})!=len(self.meal_event_bindings) or len({e for _,_,e in self.meal_event_bindings})!=len(self.meal_event_bindings):
            raise ValueError('one source-owned event identity per possible meal incidence')
        if any(len(dict(r.change_rights))!=len(r.change_rights) or any(n<0 for _,n in r.change_rights) for r in self.rights):
            raise ValueError('cause rights must be unique and nonnegative')
        if {p.actor_ref for p in self.policies} != ids or len(self.policies) != len(ids):
            raise ValueError('one native journey policy per actor')
        if any(not set(p.refuge_nodes) <= nodes for p in self.policies): raise ValueError('refuge outside physical graph')
        return self


class QuotaScopedJourneysRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.quota_scoped_journeys_request_d.v1'
    phase_ref: Literal['RELATION_QUERY', 'OWNED_ACTOR_JOURNEY']
    world: JourneyWorldD
    actor_ref: Ref
    query_relation: Literal['TARGET_ELIGIBILITY', 'CONTACT_CONSUMPTION']
    victim_ref: Ref | None
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = (
        ('mechanics.autonomous_route_intervention.quota_scoped_journeys', 'PRECONDITION'),
        ('mechanics.autonomous_route_intervention.quota_scoped_journeys', 'STEP_INTERNAL'))


def _size_compare(a, b, comparison):
    return {'ANY': True, 'GT': a > b, 'GE': a >= b, 'LT': a < b, 'LE': a <= b, 'EQ': a == b}[comparison]


def _consumption_relation(actor, victim, relations):
    matches = [r for r in relations if (r.actor_type_ref, r.victim_type_ref, r.actor_mode_ref, r.victim_mode_ref) ==
        (actor.type_ref, victim.type_ref, actor.mode_ref, victim.mode_ref)]
    if len(matches) != 1: return None, ()
    rule = matches[0]
    return rule.allowed and _size_compare(actor.size, victim.size, rule.size_comparison), (rule.evidence_ref,)


def _consumption_paths(graph, origin, budget, depth_bound):
    blocked = set(graph.blocked_node_refs)
    rank = {ref: i for i, ref in enumerate(graph.neighbor_order)}
    adjacency = {n: [] for n in graph.node_refs if n not in blocked}
    for a, b in graph.directed_edges:
        budget.visit({'stage': 'native_physical_edge', 'source_ref': a, 'destination_ref': b})
        if a in adjacency and b in adjacency: adjacency[a].append(b)
    parents, depth = ({origin: None}, {origin: 0}) if origin in adjacency else ({}, {})
    queue = deque(parents)
    truncated = False
    while queue:
        current = queue.popleft()
        budget.visit({'stage': 'native_physical_path', 'node_ref': current})
        if depth[current] >= depth_bound:
            truncated = truncated or any(n not in parents for n in adjacency[current]); continue
        for neighbor in sorted(adjacency[current], key=lambda n: rank[n]):
            if neighbor not in parents:
                parents[neighbor] = current; depth[neighbor] = depth[current]+1; queue.append(neighbor)
    return parents, depth, truncated


def _consumption_path(parents, destination):
    if destination not in parents: return ()
    path, cursor = [], destination
    while cursor is not None: path.append(cursor); cursor = parents[cursor]
    return tuple(reversed(path))


def _mode_changes(snapshot, model, budget, depth_bound):
    actors = {a.identity_ref: a for a in snapshot.actors}
    rights = {r.actor_ref: r for r in snapshot.rights}
    if len(actors) != len(snapshot.actors) or set(rights) != set(actors) or any(r.command_ref != snapshot.command_ref for _,r in sorted(rights.items())):
        raise ValueError('mode snapshot identity/command-rights mismatch')
    opportunities, denied, unresolved = {}, [], []
    for actor in snapshot.actors:
        parents, distances, bounded = _consumption_paths(snapshot.graph, actor.node_ref, budget, depth_bound)
        opportunities[actor.identity_ref] = []
        for victim in snapshot.actors:
            budget.visit({'stage': 'actor_owned_opportunity', 'actor_ref': actor.identity_ref, 'victim_ref': victim.identity_ref})
            if actor.identity_ref == victim.identity_ref: continue
            allowed, evidence = _consumption_relation(actor, victim, snapshot.eligibility)
            if allowed is None: unresolved.append((actor.identity_ref, victim.identity_ref)); continue
            same = actor.influence_component_ref == victim.influence_component_ref
            if model.neighborhood == 'DISTANCE':
                same = victim.node_ref in distances and distances[victim.node_ref] <= model.distance_limit
            reachable = victim.node_ref in parents
            if allowed and same and (reachable or not model.opportunity_requires_physical_route):
                opportunities[actor.identity_ref].append(victim.identity_ref)
            elif allowed and same:
                denied.append({'actor_ref': actor.identity_ref, 'victim_ref': victim.identity_ref, 'cause': 'PHYSICAL_ROUTE_ABSENT', 'evidence_refs': evidence})
                if bounded: unresolved.append((actor.identity_ref, victim.identity_ref))
    proposed, witnesses, competitive = {}, [], []
    eaters = {m.eater_ref for m in snapshot.meals if m.command_ref == snapshot.command_ref}
    for actor in snapshot.actors:
        causes = []
        opportunities_here = set(opportunities[actor.identity_ref])
        rivals = [peer for peer in snapshot.actors if peer.identity_ref != actor.identity_ref and
            bool(opportunities_here & set(opportunities[peer.identity_ref])) and
            (not model.compare_observer_to_neighbor_size or _size_compare(actor.size, peer.size, model.neighbor_size_comparison))]
        if snapshot.phase == 'INITIAL':
            if model.trigger == 'ACTUAL_CONSUMPTION':
                rivals = [peer for peer in rivals if peer.identity_ref in eaters]
            causes.append(model.competitive_cause_ref if rivals else model.isolated_cause_ref)
        elif snapshot.phase == 'SCARCITY':
            consumed_victims = {m.victim_ref for m in snapshot.meals if m.command_ref == snapshot.command_ref}
            previous = dict(snapshot.prior_opportunities).get(actor.identity_ref)
            if previous is None:
                unresolved.append((actor.identity_ref, 'PRIOR_OPPORTUNITY_RECEIPT_REQUIRED')); continue
            if snapshot.meals and set(previous) & consumed_victims and not opportunities_here-consumed_victims and not (
                    model.scarcity_excludes_eater and actor.identity_ref in eaters or
                    model.scarcity_excludes_competitive_change and actor.identity_ref in snapshot.prior_competitive_actor_refs):
                causes.append(model.scarcity_cause_ref)
        elif snapshot.phase == 'MEAL' and actor.identity_ref in eaters: causes.append(model.meal_cause_ref)
        elif snapshot.phase == 'FEAR' and actor.identity_ref in snapshot.fear_actor_refs: causes.append(model.fear_cause_ref)
        updated, cause_rights = actor, dict(rights[actor.identity_ref].change_rights)
        for cause in causes:
            rules = [r for r in model.mode_rules if (r.type_ref, r.input_mode_ref, r.cause_ref) == (updated.type_ref, updated.mode_ref, cause)]
            if len(rules) > 1: unresolved.append((actor.identity_ref, cause)); continue
            if not rules or cause_rights.get(cause, 0) <= 0: continue
            rule = rules[0]
            if cause == model.competitive_cause_ref and len(rivals) < rule.minimum_rivals: continue
            updated = updated.model_copy(update={'mode_ref': rule.output_mode_ref})
            cause_rights[cause] -= 1
            witnesses.append({'actor_ref': actor.identity_ref, 'cause_ref': cause, 'input_mode_ref': actor.mode_ref,
                'output_mode_ref': updated.mode_ref, 'shared_opportunity_refs': tuple(sorted(opportunities_here)),
                'rival_refs': tuple(p.identity_ref for p in rivals), 'meal_refs': tuple(m.event_ref for m in snapshot.meals)})
            if cause == model.competitive_cause_ref: competitive.append(actor.identity_ref)
        proposed[actor.identity_ref] = updated
        rights[actor.identity_ref] = rights[actor.identity_ref].model_copy(update={'change_rights': tuple(sorted(cause_rights.items()))})
    return {'actors': tuple(proposed[a.identity_ref] for a in snapshot.actors), 'rights': tuple(rights[a.identity_ref] for a in snapshot.actors),
        'mode_change_witnesses': tuple(witnesses), 'denied_opportunities': tuple(denied), 'unresolved_relations': tuple(unresolved),
        'competitive_actor_refs': tuple(competitive), 'opportunity_receipts': tuple((r,tuple(v)) for r,v in sorted(opportunities.items()))}


def measure_opportunity_conditioned_modes_d(request: OpportunityConditionedModesRequestD):
    refusal = d_validate_request(request)
    if refusal is not None: return refusal
    budget = DWorkBudget(request)
    try:
        actual = [t for t in request.transitions if t.sealed and t.epoch == request.scope.epoch]
        if request.mode_ref == 'FIT' and not actual:
            return d_result(request, 'NEEDS_EVIDENCE', 'SEALED_MODE_TRANSITIONS_REQUIRED')
        rows, unresolved = [], False
        for model in request.models:
            if request.mode_ref == 'FIT':
                contradictions, unknown = [], []
                for receipt in actual:
                    if {r for r,_ in receipt.observed_modes}!={a.identity_ref for a in receipt.snapshot.actors} or len(dict(receipt.observed_modes))!=len(receipt.observed_modes):
                        unknown.append(receipt.receipt_ref);continue
                    result = _mode_changes(receipt.snapshot, model, budget, request.depth_bound)
                    predicted = {a.identity_ref: a.mode_ref for a in result['actors']}
                    if result['unresolved_relations']: unknown.append(receipt.receipt_ref)
                    elif any(predicted.get(ref) != mode for ref, mode in receipt.observed_modes): contradictions.append(receipt.receipt_ref)
                rows.append({'model_ref': model.model_ref, 'contradicting_receipts': tuple(contradictions), 'unresolved_receipts': tuple(unknown)})
                unresolved = unresolved or bool(unknown)
            else:
                result = _mode_changes(request.snapshot, model, budget, request.depth_bound)
                rows.append({'model_ref': model.model_ref, 'successor': result})
                unresolved = unresolved or bool(result['unresolved_relations'])
        budget.finish()
        return d_result(request, 'NEEDS_EVIDENCE' if unresolved else 'COMPLETE', 'CAUSE_SCOPED_MODE_DOMAIN',
            complete=not unresolved, examined=budget.examined, values={'model_rows': tuple(rows), 'semantic_model_adopted': False, 'extra_world_turns': 0})
    except ValueError as error:
        return d_result(request, 'NEEDS_EVIDENCE', 'INVALID_MODE_SCOPE', values={'error': str(error)})
    except DComputationInterrupted as error:
        return d_result(request, 'BUDGET_REACHED', error.cause, examined=budget.examined, frontier={'restart_mode_snapshot': True, 'work': error.frontier})


def _journey_target(actor, actors, world, budget, depth_bound, escape):
    policy = next(p for p in world.policies if p.actor_ref == actor.identity_ref)
    parents, distances, bounded = _consumption_paths(world.graph, actor.node_ref, budget, depth_bound)
    candidates, unknown = [], False
    if escape:
        ordered = policy.refuge_nodes
        candidates = [(node, None) for node in ordered if node in parents and node != actor.node_ref]
        targeting = policy.escape_targeting
    else:
        ordered = policy.target_order
        targeting = policy.targeting
        for ref in ordered:
            if ref not in actors or ref == actor.identity_ref: continue
            allowed, _ = _consumption_relation(actor, actors[ref], world.targeting_relations)
            unknown = unknown or allowed is None
            if allowed and actors[ref].node_ref in parents: candidates.append((actors[ref].node_ref, ref))
    if not candidates:
        return (), None, 'UNKNOWN_ROUTE' if bounded or unknown else 'NO_TARGET'
    if targeting == 'NEAREST_THEN_ORDER':
        candidates.sort(key=lambda pair: (distances[pair[0]], ordered.index(pair[0] if escape else pair[1])))
    node, ref = candidates[0]
    return _consumption_path(parents, node), ref, None


def _run_consumption_journey(world, actor_ref, budget, depth_bound):
    actors = {a.identity_ref: a for a in world.actors}
    rights = {r.actor_ref: r for r in world.rights}
    policies = {p.actor_ref: p for p in world.policies}
    rooms = dict(world.graph.node_rooms)
    events, meals, stack, seen = [], [], [], set()
    if actor_ref not in actors: return world, (), (), (), 'ACTOR_ABSENT'
    path, target, cause = _journey_target(actors[actor_ref], actors, world, budget, depth_bound, False)
    if cause: return world, (), (), (), cause
    stack.append((actor_ref, path, 0, target, False))
    stop = 'JOURNEY_COMPLETE'
    while stack:
        if len(stack) > depth_bound: raise DComputationInterrupted('REACTION_STACK_DEPTH_BOUND', {})
        ref, path, cursor, target, escape = stack[-1]
        if ref not in actors: stack.pop(); continue
        signature = stable_digest((tuple(stack), tuple(actors[a] for a in sorted(actors)), tuple(rights[a] for a in sorted(rights))))
        if signature in seen: stop = 'UNCHANGED_ACTIVATION_LOOP'; break
        seen.add(signature)
        budget.visit({'stage': 'owned_journey_cursor', 'actor_ref': ref, 'path_cursor': cursor})
        actor = actors[ref]
        if cursor >= len(path)-1:
            stack.pop()
            if stack and escape:
                parent_ref, parent_path, parent_cursor, parent_target, parent_escape = stack[-1]
                if policies[parent_ref].reselect_after_escape:
                    refreshed = world.model_copy(update={'actors': tuple(actors[a] for a in sorted(actors)), 'rights': tuple(rights[a] for a in sorted(rights) if a in actors)})
                    replacement, new_target, reason = _journey_target(actors[parent_ref], actors, refreshed, budget, depth_bound, False)
                    if reason: stop = reason; stack.pop()
                    else: stack[-1] = (parent_ref, replacement, 0, new_target, parent_escape)
            continue
        destination = path[cursor+1]
        new_room = rooms[destination]
        if new_room != actor.room_ref:
            if rights[ref].crossings_left <= 0: stop = 'COMMAND_CROSSING_RIGHT_EXHAUSTED'; stack.pop(); continue
        occupants = [a for _,a in sorted(actors.items()) if a.identity_ref != ref and a.node_ref == destination]
        if len(occupants) > 1: stop = 'AMBIGUOUS_CONTACT_OCCUPANCY'; break
        if occupants:
            victim = occupants[0]
            allowed, evidence = _consumption_relation(actor, victim, world.contact_relations)
            if allowed is None: stop = 'UNKNOWN_CONTACT_RELATION'; break
            policy = policies[victim.identity_ref]
            topologically_protected = victim.room_ref in policy.protected_room_refs
            escape_path, _, escape_cause = _journey_target(victim, actors, world, budget, depth_bound, True)
            protected = topologically_protected and (not policy.protection_requires_reachable_escape or bool(escape_path))
            if policy.reaction_before_consumption and rights[victim.identity_ref].escapes_left > 0 and escape_path:
                rights[victim.identity_ref] = rights[victim.identity_ref].model_copy(update={'escapes_left': rights[victim.identity_ref].escapes_left-1})
                events.append({'cause': 'SUSPEND_FOR_EXISTING_ESCAPE_RIGHT', 'actor_ref': ref, 'reacting_ref': victim.identity_ref})
                stack.append((victim.identity_ref, escape_path, 0, None, True)); continue
            if not allowed or protected or rights[ref].meals_left <= 0 or escape and not policies[ref].escape_may_consume:
                stop = 'CONTACT_PROTECTED_OR_INELIGIBLE'; stack.pop(); continue
            growth = [g for g in world.growth_rules if (g.eater_type_ref, g.eater_size, g.victim_type_ref, g.victim_size) ==
                (actor.type_ref, actor.size, victim.type_ref, victim.size)]
            if len(growth) != 1: stop = 'GROWTH_LAW_NOT_BOUND'; break
            meal_ref=next((event for eater,target,event in world.meal_event_bindings if (eater,target)==(ref,victim.identity_ref)),None)
            if meal_ref is None:stop='MEAL_EVENT_BINDING_REQUIRED';break
            law = growth[0]
            actors.pop(victim.identity_ref); rights.pop(victim.identity_ref)
            actor = actor.model_copy(update={'type_ref': law.resulting_type_ref, 'size': law.resulting_size,
                'mode_ref': law.resulting_mode_ref, 'node_ref': destination, 'room_ref': new_room})
            actors[ref] = actor
            rights[ref] = rights[ref].model_copy(update={'meals_left': rights[ref].meals_left-1})
            if new_room != rooms[path[cursor]]:
                rights[ref] = rights[ref].model_copy(update={'crossings_left': rights[ref].crossings_left-1})
            meal = {'cause': 'ACTUAL_CONTACT_MEAL', 'eater_ref': ref, 'victim_ref': victim.identity_ref,
                'command_ref': world.command_ref, 'event_ref':meal_ref, 'growth_evidence_ref': law.evidence_ref}
            meals.append(meal); events.append(meal); stack.pop(); continue
        actors[ref] = actor.model_copy(update={'node_ref': destination, 'room_ref': new_room})
        if new_room != actor.room_ref:
            rights[ref] = rights[ref].model_copy(update={'crossings_left': rights[ref].crossings_left-1})
        events.append({'cause': 'ACTUAL_JOURNEY_STEP', 'actor_ref': ref, 'from_ref': actor.node_ref,
            'to_ref': destination, 'command_ref': world.command_ref})
        stack[-1] = (ref, path, cursor+1, target, escape)
    after = world.model_copy(update={'actors': tuple(actors[a.identity_ref] for a in world.actors if a.identity_ref in actors),
        'rights': tuple(rights[a.identity_ref] for a in world.actors if a.identity_ref in actors)})
    return after, tuple(events), tuple(meals), tuple(stack), stop


def measure_quota_scoped_journeys_d(request: QuotaScopedJourneysRequestD):
    refusal = d_validate_request(request)
    if refusal is not None: return refusal
    budget = DWorkBudget(request)
    try:
        actors = {a.identity_ref: a for a in request.world.actors}
        if request.actor_ref not in actors: return d_result(request, 'NEEDS_EVIDENCE', 'CURRENT_ACTOR_REQUIRED')
        if request.mode_ref == 'PRECONDITION':
            if request.phase_ref != 'RELATION_QUERY' or request.victim_ref not in actors:
                return d_result(request, 'NEEDS_EVIDENCE', 'BOUND_RELATION_QUERY_REQUIRED')
            budget.visit({'stage': 'read_only_identity_relation'})
            relations = request.world.targeting_relations if request.query_relation == 'TARGET_ELIGIBILITY' else request.world.contact_relations
            allowed, evidence = _consumption_relation(actors[request.actor_ref], actors[request.victim_ref], relations)
            protection = False
            if request.query_relation == 'CONTACT_CONSUMPTION':
                policy = next(p for p in request.world.policies if p.actor_ref == request.victim_ref)
                topological = actors[request.victim_ref].room_ref in policy.protected_room_refs
                protection = topological and (not policy.protection_requires_reachable_escape or policy.refuge_reachability_current is True)
                if topological and policy.protection_requires_reachable_escape and policy.refuge_reachability_current is None: allowed = None
                if allowed is not None:
                    actor_rights = next(r for r in request.world.rights if r.actor_ref == request.actor_ref)
                    allowed = allowed and not protection and actor_rights.meals_left > 0
            values = {'relation_allowed': allowed, 'topological_protection': protection,
                'evidence_refs': evidence, 'world_unchanged': True, 'rights_spent': False}
            unknown = allowed is None
        else:
            if request.phase_ref != 'OWNED_ACTOR_JOURNEY': return d_result(request, 'NOT_APPLICABLE', 'MODE_PHASE_MISMATCH')
            after, events, meals, stack, stop = _run_consumption_journey(request.world, request.actor_ref, budget, request.depth_bound)
            unknown = stop in ('UNKNOWN_ROUTE', 'UNKNOWN_CONTACT_RELATION', 'GROWTH_LAW_NOT_BOUND', 'AMBIGUOUS_CONTACT_OCCUPANCY','MEAL_EVENT_BINDING_REQUIRED')
            values = {'world': after, 'event_delta': events, 'actual_meals': meals, 'reaction_stack': stack,
                'stop_cause': stop, 'quota_scope_command_ref': request.world.command_ref, 'external_inputs_added': 0}
        budget.finish()
        return d_result(request, 'NEEDS_EVIDENCE' if unknown else 'COMPLETE', 'COMMAND_SCOPED_JOURNEY_RESULT',
            complete=not unknown, examined=budget.examined, values=values)
    except DComputationInterrupted as error:
        return d_result(request, 'BUDGET_REACHED', error.cause, examined=budget.examined,
            frontier={'restart_atomic_journey_from_same_rights': True, 'work': error.frontier, 'quota_renewed': False})


class ConsumptionExternalPrimitiveRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.consumption_external_primitive_request_d.v1'
    phase_ref: Literal['ONE_TOPOLOGY_EDIT_AND_ORDERED_ACTIVATIONS']
    world: JourneyWorldD
    edited_graph: ConsumptionGraphD
    edit_admitted: bool | None
    new_command_ref: Ref
    initial_rights: tuple[CommandRightsD, ...] = Field(min_length=1, max_length=128)
    initial_mode_model: OpportunityModelD
    mode_eligibility: tuple[ConsumptionRelationD, ...] = Field(default=(), max_length=4096)
    nonfinal_identity_order: tuple[Ref, ...] = Field(default=(), max_length=128)
    final_identity_order: tuple[Ref, ...] = Field(default=(), max_length=128)
    activation_mode_by_group: tuple[tuple[Literal['NONFINAL', 'FINAL'], tuple[Ref, ...]], ...]
    promoted_later_activation_supported: bool
    initial_phase_order: tuple[Literal['INITIAL_MODES', 'NONFINAL', 'SCARCITY', 'FINAL', 'TERMINAL'], ...]
    remaining_resource: int
    accepted_edit_debit: int = Field(ge=0)
    refused_edit_debit: int = Field(ge=0)
    terminal_eater_ref: Ref
    terminal_victim_ref: Ref
    terminal_meal_event_ref: Ref
    survivor_failure_count: int | None = Field(default=None, ge=0)
    terminal_order: tuple[Literal['TERMINAL_MEAL', 'SURVIVOR_FAILURE', 'DEPLETION'], ...]
    depletion_at_zero: bool
    restored_world: JourneyWorldD | None
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = (
        ('mechanics.autonomous_route_intervention.consumption_external_primitive', 'STEP'),)

    @model_validator(mode='after')
    def once_owned_activation_order(self):
        if set(self.initial_phase_order) != {'INITIAL_MODES', 'NONFINAL', 'SCARCITY', 'FINAL', 'TERMINAL'} or len(self.initial_phase_order) != 5:
            raise ValueError('complete supported phase order required')
        if self.initial_phase_order[0] != 'INITIAL_MODES' or self.initial_phase_order[-1] != 'TERMINAL':
            raise ValueError('snapshot modes precede activations and the terminal checkpoint')
        if set(self.terminal_order) != {'TERMINAL_MEAL', 'SURVIVOR_FAILURE', 'DEPLETION'} or len(self.terminal_order) != 3:
            raise ValueError('complete supported terminal priority required')
        ids = {a.identity_ref for a in self.world.actors}
        if {r.actor_ref for r in self.initial_rights} != ids or len(self.initial_rights) != len(ids) or any(
                r.command_ref != self.new_command_ref for r in self.initial_rights):
            raise ValueError('rights initialized once for the new actual command')
        if set(self.nonfinal_identity_order+self.final_identity_order) != ids:
            raise ValueError('ordered activation scopes must retain every identity')
        if len(set(self.nonfinal_identity_order)) != len(self.nonfinal_identity_order) or len(set(self.final_identity_order)) != len(self.final_identity_order):
            raise ValueError('identity duplicated within activation group')
        return self


def measure_consumption_external_primitive_d(request: ConsumptionExternalPrimitiveRequestD):
    refusal = d_validate_request(request)
    if refusal is not None: return refusal
    budget = DWorkBudget(request)
    try:
        if request.edit_admitted is None: return d_result(request, 'NEEDS_EVIDENCE', 'TOPOLOGY_EDIT_PERMISSION_UNKNOWN')
        if not request.edit_admitted:
            return d_result(request, 'COMPLETE', 'REFUSED_TOPOLOGY_EDIT', complete=True, values={
                'world': request.world, 'remaining_resource': request.remaining_resource-request.refused_edit_debit,
                'rights_initialized': False, 'external_inputs': 1})
        world = request.world.model_copy(update={'graph': request.edited_graph,
            'command_ref': request.new_command_ref, 'rights': request.initial_rights})
        events, actual_meals, competitive, initial_opportunities = [], [], (), ()
        activated = set()
        unresolved, terminal = None, None
        group_modes = dict(request.activation_mode_by_group)
        original_modes = {a.identity_ref: a.mode_ref for a in request.world.actors}
        def snapshot(phase):
            return ModeSnapshotD(actors=world.actors, rights=world.rights, graph=world.graph,
                eligibility=request.mode_eligibility, command_ref=request.new_command_ref, phase=phase,
                meals=tuple(MealEvidenceD(event_ref=m['event_ref'], eater_ref=m['eater_ref'], victim_ref=m['victim_ref'],
                    command_ref=request.new_command_ref) for m in actual_meals), prior_competitive_actor_refs=competitive,
                prior_opportunities=initial_opportunities)
        for phase in request.initial_phase_order:
            budget.visit({'stage': 'owned_population_phase', 'phase': phase})
            if phase in ('INITIAL_MODES', 'SCARCITY'):
                result = _mode_changes(snapshot('INITIAL' if phase == 'INITIAL_MODES' else 'SCARCITY'),
                    request.initial_mode_model, budget, request.depth_bound)
                if result['unresolved_relations']: unresolved = 'MODE_RELATION_UNRESOLVED'; break
                world = world.model_copy(update={'actors': result['actors'], 'rights': result['rights']})
                events.extend(result['mode_change_witnesses'])
                if phase == 'INITIAL_MODES':
                    competitive, initial_opportunities = result['competitive_actor_refs'], result['opportunity_receipts']
            elif phase in ('NONFINAL', 'FINAL'):
                order = request.nonfinal_identity_order if phase == 'NONFINAL' else request.final_identity_order
                for ref in order:
                    actor = next((a for a in world.actors if a.identity_ref == ref), None)
                    if actor is None or actor.mode_ref not in group_modes.get(phase, ()): continue
                    if ref in activated and not request.promoted_later_activation_supported: continue
                    if ref in activated and actor.mode_ref == original_modes[ref]: continue
                    world, delta, meals, stack, stop = _run_consumption_journey(world, ref, budget, request.depth_bound)
                    events.extend(delta); actual_meals.extend(meals); activated.add(ref)
                    if stop in ('UNKNOWN_ROUTE', 'UNKNOWN_CONTACT_RELATION', 'GROWTH_LAW_NOT_BOUND', 'AMBIGUOUS_CONTACT_OCCUPANCY','MEAL_EVENT_BINDING_REQUIRED'):
                        unresolved = stop; break
                if unresolved: break
            else:
                resource = request.remaining_resource-request.accepted_edit_debit
                exact = any(m['eater_ref'] == request.terminal_eater_ref and m['victim_ref'] == request.terminal_victim_ref and
                    m['event_ref']==request.terminal_meal_event_ref for m in actual_meals)
                survivor_failure = request.survivor_failure_count is not None and len(world.actors) <= request.survivor_failure_count
                depleted = resource <= 0 if request.depletion_at_zero else resource < 0
                for condition in request.terminal_order:
                    if condition == 'TERMINAL_MEAL' and exact or condition == 'SURVIVOR_FAILURE' and survivor_failure or condition == 'DEPLETION' and depleted:
                        terminal = condition; break
        budget.finish()
        failed = terminal in ('SURVIVOR_FAILURE', 'DEPLETION')
        return d_result(request, 'NEEDS_EVIDENCE' if unresolved else 'COMPLETE', unresolved or 'COMPLETE_TOPOLOGY_POPULATION_PACKET',
            complete=not unresolved, examined=budget.examined, values={'world': world,
            'restored_world': request.restored_world if failed else None, 'event_delta': tuple(events),
            'actual_meals': tuple(actual_meals), 'activated_identity_refs': tuple(sorted(activated)),
            'terminal': terminal, 'remaining_resource': request.remaining_resource-request.accepted_edit_debit,
            'primitive_debit': request.accepted_edit_debit, 'external_inputs': 1, 'rights_renewed_on_reaction': False})
    except ValueError as error:
        return d_result(request, 'NEEDS_EVIDENCE', 'INVALID_CONSUMPTION_SCOPE', values={'error': str(error)})
    except DComputationInterrupted as error:
        return d_result(request, 'BUDGET_REACHED', error.cause, examined=budget.examined,
            frontier={'restart_atomic_population_packet': True, 'actual_parent_debit_reapplied': False, 'work': error.frontier})
