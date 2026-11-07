"""Finite carrier/stone contacts and one declared ordered reactive turn.

Typed roles, selector order, clock and response laws are caller supplied. Full
logical occupancy is not inferred from an interior sprite or creator identity.
"""

from __future__ import annotations

from typing import ClassVar
from pydantic import Field
from .contracts import FrameGrid

from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref
from .digital_topology import _neighbors
from .escape_topology import EscapeTopologyDomain, EscapeTransition, measure_escape_topology
from .mechanical_family_contracts_d import (
    DMechanicalRequest, DMechanicalResult, DWorkBudget, DComputationInterrupted,
    DResumeMismatch, d_validate_request, d_result, d_resume_rows, d_resumable_frontier, d_map,
)
from .scene_layer_measurement_d import (
    DSceneCalibration, DSceneLayerQuestion, DSceneOcclusion, measure_scene_layers_d,
)

Point = tuple[int, int]


class CaptureBody(FrozenModel):
    occurrence_ref: Ref
    type_ref: Ref
    offsets: tuple[Point, ...] = Field(min_length=1, max_length=4096)
    evidence_ref: Ref


class CapturePose(FrozenModel):
    occurrence_ref: Ref
    anchor: Point


class CaptureState(FrozenModel):
    hunter: CapturePose
    stones: tuple[CapturePose, ...] = Field(default=(), max_length=128)
    targets: tuple[CapturePose, ...] = Field(default=(), max_length=128)
    coupled_stone_ref: Ref | None = None
    tether_offset: Point | None = None
    captured_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    reserve: int = Field(ge=0)
    terminated: bool
    memory: FrozenMap = Field(default_factory=FrozenMap)


class CaptureInput(FrozenModel):
    primitive_ref: Ref
    kind_ref: Ref
    delta: Point | None = None


class FleePolicy(FrozenModel):
    policy_ref: Ref
    evidence_ref: Ref
    steps: tuple[Point, ...] = Field(min_length=1, max_length=16)
    distance_ref: Ref
    preference_ref: Ref
    visibility_ref: Ref
    visibility_bound: int | None = Field(default=None, ge=0, le=65536)
    stay_ref: Ref
    tie_ref: Ref
    hunter_cell_ref: Ref
    # A list of observed moves need not exhaust jump/diagonal/transport options.
    response_domain_completeness_evidence_ref: Ref | None = None


class CaptureModel(FrozenModel):
    model_ref: Ref
    height: int = Field(ge=1, le=256)
    width: int = Field(ge=1, le=256)
    bodies: tuple[CaptureBody, ...] = Field(min_length=1, max_length=257)
    hunter_ref: Ref
    stone_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    target_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    walkable: tuple[Point, ...] = Field(default=(), max_length=4096)
    blocked: tuple[Point, ...] = Field(default=(), max_length=4096)
    terrain_law_ref: Ref | None = None
    direction_steps: tuple[Point, ...] = Field(default=(), max_length=16)
    cargo_law_ref: Ref | None = None
    direct_contact_law_ref: Ref | None = None
    autonomous_contact_law_ref: Ref | None = None
    autonomous_exchange_tether_ref: Ref | None = None
    capture_pairs: tuple[tuple[Ref, Ref], ...] | None = Field(default=None, max_length=256)
    exchange_pairs: tuple[tuple[Ref, Ref], ...] | None = Field(default=None, max_length=256)
    attach_pairs: tuple[tuple[Ref, Ref], ...] | None = Field(default=None, max_length=256)
    attachment_adjacency_ref: Ref | None = None
    binding_law_ref: Ref | None = None
    binding_order: tuple[Ref, ...] = Field(default=(), max_length=128)
    interaction_law_ref: Ref | None = None
    clock_by_outcome: tuple[tuple[Ref, bool], ...] = Field(default=(), max_length=16)
    flee_policies: tuple[tuple[Ref, FleePolicy], ...] = Field(default=(), max_length=128)
    response_order: tuple[Ref, ...] = Field(default=(), max_length=128)
    response_order_evidence_ref: Ref | None = None
    input_costs: tuple[tuple[Ref, int], ...] = Field(default=(), max_length=16)
    terminal_order_ref: Ref | None = None
    required_target_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    reset_state: CaptureState | None = None
    reset_cost: int | None = Field(default=None, ge=0)


class CaptureStartInput(FrozenModel):
    candidate_ref: Ref
    state: CaptureState
    primitive: CaptureInput
    consumer_ref: Ref
    expiry_ref: Ref
    service_stone_ref: Ref | None = None


_CASES = (
    ('scene_measure', ('MEASURE',)), ('input_clock_fit', ('FIT',)),
    ('binding_selector', ('FIT', 'PRECONDITION')), ('direct_contact_step', ('STEP_INTERNAL',)),
    ('flee_policy_fit', ('FIT',)), ('ordered_flee_step', ('STEP_INTERNAL',)),
    ('capture_preimages', ('INVERSE_DOMAIN',)), ('barrier_services', ('INVERSE_DOMAIN',)),
    ('joint_domain', ('DOMAIN',)), ('sealed_compare', ('COMPARE',)), ('external_primitive', ('STEP',)),
)


class ReactiveCaptureRequest(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.reactive_capture_request.v1'
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = tuple(
        (f'mechanics.reactive_capture.{operation}', mode) for operation, modes in _CASES for mode in modes)
    models: tuple[CaptureModel, ...] = Field(default=(), max_length=32)
    state: CaptureState | None = None
    primitive: CaptureInput | None = None
    candidates: tuple[CaptureStartInput, ...] = Field(default=(), max_length=4096)
    available_inputs: tuple[CaptureInput, ...] = Field(default=(), max_length=16)
    requested_target_ref: Ref | None = None
    frame: FrameGrid | None = None
    frame_ref: Ref | None = None
    frame_epoch: int | None = Field(default=None, ge=0)
    frame_evidence_revision_ref: Ref | None = None
    scene_calibrations: tuple[DSceneCalibration, ...] = Field(default=(), max_length=32)
    scene_layer_questions: tuple[DSceneLayerQuestion, ...] = Field(default=(), max_length=64)
    scene_occlusions: tuple[DSceneOcclusion, ...] = Field(default=(), max_length=128)


class CapturePrerequisite(Exception):
    pass


def _support(body, pose):
    return frozenset((pose.anchor[0] + row, pose.anchor[1] + column) for row, column in body.offsets)


def _geometry(model, state, budget):
    if model.height * model.width > budget.request.domain_bound:
        raise DComputationInterrupted('CAPTURE_CELL_DOMAIN_BOUND', d_map())
    bodies = {body.occurrence_ref: body for body in model.bodies}
    stones = {pose.occurrence_ref: pose for pose in state.stones}
    targets = {pose.occurrence_ref: pose for pose in state.targets}
    if len(bodies) != len(model.bodies) or len(stones) != len(state.stones) or len(targets) != len(state.targets):
        raise CapturePrerequisite('OCCURRENCE_IDENTITIES_NOT_UNIQUE')
    declared = {model.hunter_ref} | set(model.stone_refs) | set(model.target_refs)
    if (set(bodies) != declared or state.hunter.occurrence_ref != model.hunter_ref or
        set(stones) != set(model.stone_refs) or set(targets) & set(state.captured_refs) or
        set(targets) | set(state.captured_refs) != set(model.target_refs) or
        len(set(state.captured_refs)) != len(state.captured_refs) or
        len(declared) != 1 + len(model.stone_refs) + len(model.target_refs)):
        raise CapturePrerequisite('FULL_POPULATION_OR_CAPTURE_LEDGER_NOT_QUALIFIED')
    if (state.coupled_stone_ref is None) != (state.tether_offset is None):
        raise CapturePrerequisite('TETHER_PARTNER_AND_OFFSET_NOT_BOUND_TOGETHER')
    if state.coupled_stone_ref is not None:
        if state.coupled_stone_ref not in stones:
            raise CapturePrerequisite('COUPLED_STONE_NOT_IN_CURRENT_POPULATION')
        stone = stones[state.coupled_stone_ref]
        if state.tether_offset != (stone.anchor[0] - state.hunter.anchor[0], stone.anchor[1] - state.hunter.anchor[1]):
            raise CapturePrerequisite('CURRENT_TETHER_OFFSET_CONTRADICTS_POSES')
    occupied, supports = {}, {}
    for pose in (state.hunter, *state.stones, *state.targets):
        body = bodies[pose.occurrence_ref]
        if len(set(body.offsets)) != len(body.offsets):
            raise CapturePrerequisite('FULL_LOGICAL_BODY_MASK_NOT_UNIQUE')
        support = _support(body, pose)
        for point in sorted(support):
            budget.visit({'occurrence_ref': pose.occurrence_ref})
            if not 0 <= point[0] < model.height or not 0 <= point[1] < model.width or point in occupied:
                raise CapturePrerequisite('CURRENT_FULL_BODY_OCCUPANCY_COLLISION')
            occupied[point] = pose.occurrence_ref
        supports[pose.occurrence_ref] = support
    walkable, blocked = frozenset(model.walkable), frozenset(model.blocked)
    if len(walkable) != len(model.walkable) or len(blocked) != len(model.blocked) or walkable & blocked:
        raise CapturePrerequisite('TERRAIN_SUPPORT_NOT_DISJOINT_AND_UNIQUE')
    for point in sorted(walkable | blocked):
        budget.visit()
        if not 0 <= point[0] < model.height or not 0 <= point[1] < model.width:
            raise CapturePrerequisite('TERRAIN_OUTSIDE_CURRENT_LOGICAL_DOMAIN')
    if set(occupied) & blocked:
        raise CapturePrerequisite('CURRENT_BODY_ON_DECLARED_BLOCKED_TERRAIN')
    return bodies, stones, targets, occupied, supports


def _terrain_legal(model, destination, prior, budget):
    if model.terrain_law_ref != 'immutable_supplied_walkability':
        raise CapturePrerequisite('SUPPORTED_TERRAIN_LAW_MISSING')
    floor, blocked = frozenset(model.walkable), frozenset(model.blocked)
    for point in sorted(destination):
        budget.visit({'destination_point': point})
        if not 0 <= point[0] < model.height or not 0 <= point[1] < model.width or point in blocked:
            return False
        if point not in floor and point not in prior:
            raise CapturePrerequisite('DESTINATION_HAS_UNOBSERVED_TERRAIN')
    return True


def _adjacent(model, first, second, budget):
    if model.attachment_adjacency_ref == 'cardinal_face_adjacency':
        connectivity = 4
    elif model.attachment_adjacency_ref == 'diagonal_or_face_adjacency':
        connectivity = 8
    else:
        raise CapturePrerequisite('ATTACHMENT_ADJACENCY_LAW_MISSING')
    for point in sorted(first):
        budget.visit({'attachment_face_point': point})
        if any(neighbor in second for neighbor in _neighbors(point, connectivity)):
            return True
    return False


def _binding_domain(model, state, budget):
    bodies, stones, _, _, supports = _geometry(model, state, budget)
    if model.attach_pairs is None:
        raise CapturePrerequisite('SUPPORTED_ATTACHABLE_TYPE_RELATION_MISSING')
    neighbors = []
    for ref in sorted(stones):
        budget.visit({'stone_ref': ref})
        if (bodies[model.hunter_ref].type_ref, bodies[ref].type_ref) in model.attach_pairs and _adjacent(
            model, supports[model.hunter_ref], supports[ref], budget):
            stone = stones[ref]
            neighbors.append((ref, (stone.anchor[0] - state.hunter.anchor[0], stone.anchor[1] - state.hunter.anchor[1])))
    if model.binding_law_ref == 'unique_adjacent_partner_only':
        partner = neighbors[0][0] if len(neighbors) == 1 else None
    elif model.binding_law_ref == 'supplied_partner_order':
        if len(set(model.binding_order)) != len(model.binding_order) or set(model.binding_order) != set(model.stone_refs):
            raise CapturePrerequisite('COMPLETE_SUPPORTED_BINDING_ORDER_MISSING')
        eligible = {ref for ref, _ in neighbors}
        partner = next((ref for ref in model.binding_order if ref in eligible), None)
    else:
        raise CapturePrerequisite('SUPPORTED_PARTNER_SELECTOR_MISSING')
    return {'neighbor_offsets': tuple(neighbors), 'partner_ref': partner,
        'unambiguous_neighbor': len(neighbors) == 1, 'different_offsets_preserved': True,
        'no_facing_or_parser_order_inferred': True}


def _shift(pose, delta):
    return pose.model_copy(update={'anchor': (pose.anchor[0] + delta[0], pose.anchor[1] + delta[1])})


def _direct(model, state, primitive, budget):
    bodies, stones, targets, _, supports = _geometry(model, state, budget)
    if state.terminated:
        raise CapturePrerequisite('OFFICIAL_TERMINATION_REVOKES_CAPTURE_INPUT')
    if primitive.kind_ref == 'interact':
        if model.interaction_law_ref != 'toggle_current_tether':
            raise CapturePrerequisite('SUPPORTED_ATTACHMENT_GESTURE_MISSING')
        if state.coupled_stone_ref is not None:
            following = state.model_copy(update={'coupled_stone_ref': None, 'tether_offset': None})
            return {'state': following, 'acted': True, 'outcome_ref': 'release', 'direct_events': ('tether_released',)}
        domain = _binding_domain(model, state, budget)
        partner = domain['partner_ref']
        if partner is None:
            if domain['neighbor_offsets']:
                raise CapturePrerequisite('ATTACHMENT_PARTNER_AMBIGUOUS_APPROACH_REQUIRED')
            return {'state': state, 'acted': False, 'outcome_ref': 'interaction_without_neighbor', 'direct_events': ()}
        offset = next(offset for ref, offset in domain['neighbor_offsets'] if ref == partner)
        following = state.model_copy(update={'coupled_stone_ref': partner, 'tether_offset': offset})
        return {'state': following, 'acted': True, 'outcome_ref': 'attachment', 'direct_events': ('tether_acquired',)}
    if primitive.kind_ref != 'move' or primitive.delta not in model.direction_steps or primitive.delta == (0, 0):
        raise CapturePrerequisite('SUPPORTED_DIRECT_MOVEMENT_QUANTUM_MISSING')
    hunter = _shift(state.hunter, primitive.delta)
    destination = _support(bodies[model.hunter_ref], hunter)
    if not _terrain_legal(model, destination, supports[model.hunter_ref], budget):
        return {'state': state, 'acted': False, 'outcome_ref': 'terrain_refusal', 'direct_events': ()}
    following_stones = dict(stones)
    moving_stone_ref = state.coupled_stone_ref
    touching_stones = tuple(ref for ref in sorted(stones) if destination & supports[ref])
    if moving_stone_ref is not None:
        if model.cargo_law_ref not in ('translate_tether_or_push_one_stone', 'tether_only_free_stones_are_blockers'):
            raise CapturePrerequisite('SUPPORTED_COUPLED_STONE_TRANSLATION_MISSING')
        if any(ref != moving_stone_ref for ref in touching_stones):
            return {'state': state, 'acted': False, 'outcome_ref': 'cargo_refusal', 'direct_events': ()}
    elif touching_stones:
        if model.cargo_law_ref not in ('translate_tether_or_push_one_stone', 'tether_only_free_stones_are_blockers'):
            raise CapturePrerequisite('SUPPORTED_FREE_STONE_PUSH_OR_REFUSAL_LAW_MISSING')
        if model.cargo_law_ref != 'translate_tether_or_push_one_stone' or len(touching_stones) != 1:
            return {'state': state, 'acted': False, 'outcome_ref': 'cargo_refusal', 'direct_events': ()}
        moving_stone_ref = touching_stones[0]
    if moving_stone_ref is not None:
        stone = _shift(stones[moving_stone_ref], primitive.delta)
        stone_destination = _support(bodies[moving_stone_ref], stone)
        # Contemporary target occupancy is checked BEFORE capture/autonomy.
        others = frozenset(point for ref, support in sorted(supports.items())
            if ref != moving_stone_ref and ref != model.hunter_ref for point in support)
        if (not _terrain_legal(model, stone_destination, supports[moving_stone_ref], budget) or
            stone_destination & others or stone_destination & destination):
            return {'state': state, 'acted': False, 'outcome_ref': 'cargo_refusal', 'direct_events': ()}
        following_stones[moving_stone_ref] = stone
    touching_targets = tuple(ref for ref in sorted(targets) if destination & supports[ref])
    if len(touching_targets) > 1:
        raise CapturePrerequisite('MULTIPLE_DIRECT_CONTACT_ORDER_NOT_SUPPORTED')
    captured, events = tuple(state.captured_refs), []
    following_targets = dict(targets)
    if touching_targets:
        ref = touching_targets[0]
        target = targets[ref]
        retreat = target.model_copy(update={'anchor': state.hunter.anchor})
        retreat_support = _support(bodies[ref], retreat)
        blockers = destination | frozenset(point for stone_ref in sorted(following_stones)
            for point in _support(bodies[stone_ref], following_stones[stone_ref])) | frozenset(
            point for other_ref in sorted(targets) if other_ref != ref for point in supports[other_ref])
        retreat_free = None
        if model.direct_contact_law_ref in ('capture_if_vacated_retreat_blocked_else_exchange', 'exchange_if_vacated_retreat_free'):
            retreat_free = _terrain_legal(model, retreat_support, supports[ref] | supports[model.hunter_ref], budget) and not retreat_support & blockers
        if model.direct_contact_law_ref == 'capture_if_vacated_retreat_blocked_else_exchange':
            capture = not retreat_free
        elif model.direct_contact_law_ref == 'capture_on_contact':
            capture = True
        elif model.direct_contact_law_ref == 'exchange_if_vacated_retreat_free':
            capture = False
        else:
            raise CapturePrerequisite('SUPPORTED_DIRECT_CAPTURE_EXCHANGE_RULE_MISSING')
        pair = bodies[model.hunter_ref].type_ref, bodies[ref].type_ref
        if capture and model.capture_pairs is None or not capture and model.exchange_pairs is None:
            raise CapturePrerequisite('SUPPORTED_CAPTURE_OR_EXCHANGE_TYPE_RELATION_MISSING')
        if capture and pair in model.capture_pairs:
            following_targets.pop(ref)
            captured = (*captured, ref)
            events.append(('direct_capture', ref, target.anchor))
        elif not capture and retreat_free and pair in model.exchange_pairs:
            following_targets[ref] = retreat
            events.append(('direct_exchange', ref, target.anchor, retreat.anchor))
        else:
            return {'state': state, 'acted': False, 'outcome_ref': 'contact_refusal', 'direct_events': ()}
    following = state.model_copy(update={'hunter': hunter,
        'stones': tuple(following_stones[pose.occurrence_ref] for pose in state.stones),
        'targets': tuple(following_targets[pose.occurrence_ref] for pose in state.targets if pose.occurrence_ref in following_targets),
        'captured_refs': captured})
    _geometry(model, following, budget)
    return {'state': following, 'acted': True, 'outcome_ref': 'successful_move',
        'direct_events': tuple(events), 'vacated_hunter_anchor': state.hunter.anchor}


def _clock(model, outcome):
    values = tuple(advanced for ref, advanced in model.clock_by_outcome if ref == outcome)
    if len(values) != 1:
        raise CapturePrerequisite('SUPPORTED_CLOCK_FOR_DIRECT_OUTCOME_MISSING')
    return values[0]


def _distance(first, second, law):
    dr, dc = abs(first[0] - second[0]), abs(first[1] - second[1])
    if law == 'manhattan_anchor':
        return dr + dc
    if law == 'squared_euclidean_anchor':
        return dr * dr + dc * dc
    raise CapturePrerequisite('SUPPORTED_REACTIVE_DISTANCE_MEASURE_MISSING')


def _response_candidates(model, state, ref, policy, budget, *, inspect_escape_topology=False):
    bodies, _, targets, _, supports = _geometry(model, state, budget)
    if ref not in targets:
        raise CapturePrerequisite('REACTIVE_OCCURRENCE_NO_LONGER_SURVIVES')
    pose = targets[ref]
    if len(set(policy.steps)) != len(policy.steps):
        raise CapturePrerequisite('REACTIVE_CANDIDATE_ORDER_NOT_UNIQUE')
    if policy.stay_ref == 'stay_is_a_candidate' and (0, 0) not in policy.steps:
        raise CapturePrerequisite('DECLARED_STAY_CANDIDATE_MISSING_FROM_ORDERED_DOMAIN')
    distance = _distance(pose.anchor, state.hunter.anchor, policy.distance_ref)
    if policy.visibility_ref == 'within_distance_bound':
        if policy.visibility_bound is None:
            raise CapturePrerequisite('REACTIVE_VISIBILITY_BOUND_MISSING')
        if distance > policy.visibility_bound:
            return {'candidate_rows': (), 'response_pose': pose, 'visibility_refusal': True}
    elif policy.visibility_ref != 'always_reactive':
        raise CapturePrerequisite('SUPPORTED_REACTIVE_VISIBILITY_LAW_MISSING')
    if policy.hunter_cell_ref not in ('hunter_blocks_destination', 'hunter_contact_is_eligible'):
        raise CapturePrerequisite('REACTIVE_HUNTER_CONTACT_ELIGIBILITY_MISSING')
    rows, obstructions = [], []
    blockers = frozenset(point for other_ref in sorted(supports)
        if other_ref not in (ref, model.hunter_ref) for point in supports[other_ref])
    for delta in policy.steps:
        budget.visit({'target_ref': ref, 'candidate_delta': delta})
        if delta == (0, 0) and policy.stay_ref != 'stay_is_a_candidate':
            continue
        candidate = _shift(pose, delta)
        support = _support(bodies[ref], candidate)
        terrain_free = _terrain_legal(model, support, supports[ref], budget)
        blocker_refs = tuple(other_ref for other_ref in sorted(supports)
            if other_ref not in (ref, model.hunter_ref) and support & supports[other_ref])
        if not terrain_free or support & blockers:
            obstructions.append(d_map({'delta': delta, 'anchor': candidate.anchor,
                'terrain_free': terrain_free, 'blocking_occurrence_refs': blocker_refs}))
            continue
        hunter_contact = bool(support & supports[model.hunter_ref])
        if hunter_contact and policy.hunter_cell_ref == 'hunter_blocks_destination':
            obstructions.append(d_map({'delta': delta, 'anchor': candidate.anchor,
                'terrain_free': terrain_free, 'blocking_occurrence_refs': (model.hunter_ref,)}))
            continue
        rows.append(d_map({'delta': delta, 'anchor': candidate.anchor,
            'distance': _distance(candidate.anchor, state.hunter.anchor, policy.distance_ref),
            'hunter_contact': hunter_contact}))
    if policy.stay_ref not in ('stay_is_a_candidate', 'stay_only_if_no_free_candidate', 'never_stay'):
        raise CapturePrerequisite('SUPPORTED_REACTIVE_STAY_LAW_MISSING')
    topology = None
    if inspect_escape_topology:
        origin_ref = f"{ref}:anchor:{pose.anchor[0]}:{pose.anchor[1]}"
        transitions = tuple(EscapeTransition(
            origin_ref=origin_ref,
            destination_ref=f"{ref}:anchor:{item['anchor'][0]}:{item['anchor'][1]}",
            availability=availability, evidence_refs=(policy.evidence_ref, bodies[ref].evidence_ref),
        ) for availability, domain_rows in (("free", rows), ("blocked", obstructions)) for item in domain_rows)
        completeness = policy.response_domain_completeness_evidence_ref
        topology = measure_escape_topology(EscapeTopologyDomain(
            model_ref=model.model_ref, actor_ref=ref, current_node_ref=origin_ref,
            node_refs=tuple(sorted({origin_ref, *(edge.destination_ref for edge in transitions)})),
            transitions=transitions, region_node_refs=(origin_ref,),
            complete_successor_node_refs=(origin_ref,) if completeness else (),
            completeness_evidence_refs=(completeness,) if completeness else (),
            occupancy_scope="current_occupancy",
        ), budget)
    if not rows:
        if policy.stay_ref in ('stay_only_if_no_free_candidate', 'stay_is_a_candidate'):
            return {'candidate_rows': (), 'obstruction_rows': tuple(obstructions),
                'response_pose': pose, 'no_free_candidate': True,
                'escape_topology_measurement': topology}
        raise CapturePrerequisite('REACTIVE_POLICY_HAS_NO_SUPPORTED_SUCCESSOR')
    if policy.preference_ref == 'maximize_declared_distance':
        optimum = max(row['distance'] for row in rows)
    elif policy.preference_ref == 'minimize_declared_distance':
        optimum = min(row['distance'] for row in rows)
    else:
        raise CapturePrerequisite('SUPPORTED_REACTIVE_CHOICE_RELATION_MISSING')
    tied = tuple(row for row in rows if row['distance'] == optimum)
    if len(tied) > 1 and policy.tie_ref != 'first_in_supplied_candidate_order':
        raise CapturePrerequisite('UNKNOWN_FLEE_TIE_TERMINATES_DETERMINISTIC_PREFIX')
    response = pose.model_copy(update={'anchor': tied[0]['anchor']})
    return {'candidate_rows': tuple(rows), 'obstruction_rows': tuple(obstructions), 'response_pose': response,
        'escape_topology_measurement': topology,
        'tie_count': len(tied), 'policy_ref': policy.policy_ref, 'policy_evidence_ref': policy.evidence_ref}


def _ordered_response(model, state, budget):
    _geometry(model, state, budget)
    if not state.targets:
        return {'state': state, 'reaction_trace': (), 'reaction_pass_count': 1}
    if (not model.response_order_evidence_ref or len(set(model.response_order)) != len(model.response_order) or
        set(model.response_order) != set(model.target_refs)):
        raise CapturePrerequisite('COMPLETE_SUPPORTED_REACTIVE_ACTOR_ORDER_MISSING')
    current, trace = state, []
    for ref in model.response_order:
        targets = {pose.occurrence_ref: pose for pose in current.targets}
        if ref not in targets:
            continue
        policies = tuple(policy for target_ref, policy in model.flee_policies if target_ref == ref)
        if len(policies) != 1:
            raise CapturePrerequisite('SCOPED_REACTIVE_POLICY_NOT_UNIQUE_IN_MODEL')
        before = current
        row = _response_candidates(model, before, ref, policies[0], budget)
        response = row['response_pose']
        bodies, _, _, _, supports = _geometry(model, before, budget)
        contact = bool(_support(bodies[ref], response) & supports[model.hunter_ref])
        events = []
        if contact:
            pair = bodies[model.hunter_ref].type_ref, bodies[ref].type_ref
            if (model.autonomous_contact_law_ref == 'capture_on_hunter_contact' and model.capture_pairs is None or
                model.autonomous_contact_law_ref == 'exchange_hunter_to_vacated_target_cell' and model.exchange_pairs is None):
                raise CapturePrerequisite('SUPPORTED_AUTONOMOUS_CONTACT_TYPE_RELATION_MISSING')
            if model.autonomous_contact_law_ref == 'capture_on_hunter_contact' and pair in model.capture_pairs:
                targets.pop(ref)
                current = current.model_copy(update={'captured_refs': (*current.captured_refs, ref)})
                events.append(('autonomous_capture', ref))
            elif model.autonomous_contact_law_ref == 'target_stays_on_hunter_contact':
                response = targets[ref]
                targets[ref] = response
            elif model.autonomous_contact_law_ref == 'exchange_hunter_to_vacated_target_cell' and pair in model.exchange_pairs:
                hunter = before.hunter.model_copy(update={'anchor': targets[ref].anchor})
                if before.coupled_stone_ref is not None:
                    if model.autonomous_exchange_tether_ref != 'retain_stone_and_recompute_offset':
                        raise CapturePrerequisite('AUTONOMOUS_EXCHANGE_TETHER_TRANSPORT_MISSING')
                    stone = next(pose for pose in before.stones if pose.occurrence_ref == before.coupled_stone_ref)
                    offset = stone.anchor[0] - hunter.anchor[0], stone.anchor[1] - hunter.anchor[1]
                else:
                    offset = None
                current = current.model_copy(update={'hunter': hunter, 'tether_offset': offset})
                targets[ref] = response
                events.append(('autonomous_exchange', ref))
            else:
                raise CapturePrerequisite('SUPPORTED_AUTONOMOUS_CONTACT_RULE_MISSING')
        else:
            targets[ref] = response
        current = current.model_copy(update={'targets': tuple(targets[pose.occurrence_ref]
            for pose in before.targets if pose.occurrence_ref in targets)})
        _geometry(model, current, budget)
        trace.append(d_map({'target_ref': ref, 'pre_actor_state': before,
            'before_anchor': next(pose.anchor for pose in before.targets if pose.occurrence_ref == ref),
            'response': d_map(row), 'events': tuple(events), 'post_actor_state': current,
            'reads_state_after_previous_actor': True}))
    return {'state': current, 'reaction_trace': tuple(trace), 'reaction_pass_count': 1}


def _physical_image(model, state, primitive, budget):
    direct = _direct(model, state, primitive, budget)
    advanced = _clock(model, direct['outcome_ref'])
    reaction = _ordered_response(model, direct['state'], budget) if advanced else {
        'state': direct['state'], 'reaction_trace': (), 'reaction_pass_count': 0}
    return {'state': reaction['state'], 'direct': d_map(direct), 'reaction': d_map(reaction),
        'clock_advanced': advanced, 'external_debit_applied': False}


def _external(model, state, primitive, request, budget):
    _geometry(model, state, budget)
    if state.terminated:
        raise CapturePrerequisite('OFFICIAL_TERMINATION_REVOKES_CAPTURE_INPUT')
    if primitive.kind_ref == 'reset':
        if model.reset_state is None or model.reset_cost is None:
            raise CapturePrerequisite('INDEPENDENT_CAPTURE_RESET_CONTRACT_MISSING')
        _geometry(model, model.reset_state, budget)
        return {'state': model.reset_state, 'event_ledger': d_map({'owner_ref': request.scope.event_owner_ref,
            'direct_kind': 'reset', 'reaction_pass_count': 0, 'debit': model.reset_cost,
            'acceptance_owned_by_reset_contract': True}), 'primitive_complete': True}
    image = _physical_image(model, state, primitive, budget)
    direct, reaction, advanced = image['direct'], image['reaction'], image['clock_advanced']
    costs = tuple(cost for kind, cost in model.input_costs if kind == primitive.kind_ref)
    if len(costs) != 1 or costs[0] < 0:
        raise CapturePrerequisite('EXACT_CAPTURE_PRIMITIVE_COST_MISSING')
    debit = costs[0]
    if debit > state.reserve:
        raise CapturePrerequisite('CAPTURE_PRIMITIVE_EXCEEDS_RESERVE')
    if (not model.required_target_refs or len(set(model.required_target_refs)) != len(model.required_target_refs) or
        not set(model.required_target_refs) <= set(model.target_refs)):
        raise CapturePrerequisite('SUPPORTED_REQUIRED_CAPTURE_POPULATION_MISSING')
    if model.terminal_order_ref not in ('acceptance_before_exhaustion', 'exhaustion_before_acceptance'):
        raise CapturePrerequisite('CAPTURE_TERMINAL_BUDGET_PRIORITY_MISSING')
    following = image['state']
    reserve = state.reserve - debit
    accepted = set(model.required_target_refs) <= set(following.captured_refs)
    exhausted = reserve == 0
    if exhausted and model.terminal_order_ref == 'exhaustion_before_acceptance':
        accepted = False
    following = following.model_copy(update={'reserve': reserve, 'terminated': accepted or exhausted})
    return {'state': following, 'direct': d_map(direct), 'reaction': d_map(reaction),
        'event_ledger': d_map({'owner_ref': request.scope.event_owner_ref, 'direct_kind': primitive.kind_ref,
            'direct_acted': direct['acted'], 'clock_advanced': advanced,
            'reaction_pass_count': reaction['reaction_pass_count'], 'debit': debit,
            'accepted': accepted, 'exhausted': exhausted, 'terminal_order_ref': model.terminal_order_ref}),
        'primitive_complete': True, 'second_reaction_or_debit_forbidden': True}


def _clock_fit(model, request, budget):
    if not request.observations:
        raise CapturePrerequisite('SEALED_INPUT_CLOCK_OBSERVATIONS_MISSING')
    rows = []
    for index, sample in enumerate(request.observations):
        budget.visit({'sample_index': index})
        if sample.get('sealed') is not True or not sample.get('event_owner_ref') or not sample.get('evidence_ref'):
            raise CapturePrerequisite('INPUT_CLOCK_OBSERVATION_NOT_SEALED_OR_GROUNDED')
        if sample.get('before_state') is None or sample.get('primitive') is None:
            raise CapturePrerequisite('CLOCK_BEFORE_STATE_AND_ACTUAL_INPUT_MISSING')
        state = CaptureState.model_validate(sample['before_state'])
        primitive = CaptureInput.model_validate(sample['primitive'])
        direct = _direct(model, state, primitive, budget)
        predicted = _clock(model, direct['outcome_ref'])
        observed = sample.get('clock_advanced')
        if observed is not None and type(observed) is not bool:
            raise CapturePrerequisite('OBSERVED_CLOCK_FLAG_NOT_A_BOOLEAN')
        rows.append(d_map({'sample_index': index, 'outcome_ref': direct['outcome_ref'],
            'direct_acted': direct['acted'], 'predicted_clock_advance': predicted,
            'observed_clock_advance': observed,
            'consistent_on_observed_clock': None if observed is None else predicted == observed,
            'stationary_target_is_not_a_clock_observation': True}))
    return {'clock_constraints': tuple(rows), 'missing_clock_cues': tuple(row['sample_index']
        for row in rows if row['observed_clock_advance'] is None)}


def _binding_fit(model, request, budget):
    if request.state is None:
        raise CapturePrerequisite('CURRENT_ATTACHMENT_CONTEXT_MISSING')
    domain = _binding_domain(model, request.state, budget)
    rows = []
    if request.mode_ref == 'FIT':
        if not request.observations:
            raise CapturePrerequisite('SEALED_PARTNER_SELECTION_OBSERVATIONS_MISSING')
        for index, sample in enumerate(request.observations):
            if sample.get('sealed') is not True or not sample.get('evidence_ref') or sample.get('before_state') is None:
                raise CapturePrerequisite('SEALED_BINDING_CONTEXT_MISSING')
            current = CaptureState.model_validate(sample['before_state'])
            measured = _binding_domain(model, current, budget)
            if 'observed_partner_ref' not in sample:
                raise CapturePrerequisite('ACTUAL_BOUND_PARTNER_OBSERVATION_MISSING')
            rows.append(d_map({'sample_index': index, 'domain': d_map(measured),
                'observed_partner_ref': sample['observed_partner_ref'],
                'consistent': measured['partner_ref'] == sample['observed_partner_ref']}))
    return {'current_domain': d_map(domain), 'selection_constraints': tuple(rows),
        'approach_requires_unambiguous_partner': bool(domain['neighbor_offsets']) and domain['partner_ref'] is None}


def _flee_fit(model, request, budget):
    if not request.observations:
        raise CapturePrerequisite('SEALED_REACTIVE_CHOICES_MISSING')
    rows = []
    for index, sample in enumerate(request.observations):
        if sample.get('sealed') is not True or not sample.get('evidence_ref') or sample.get('pre_reaction_state') is None or sample.get('actual_state') is None:
            raise CapturePrerequisite('REACTIVE_BEFORE_AFTER_PROVENANCE_MISSING')
        before = CaptureState.model_validate(sample['pre_reaction_state'])
        actual = CaptureState.model_validate(sample['actual_state'])
        predicted = _ordered_response(model, before, budget)
        state = predicted['state']
        actual_targets = {pose.occurrence_ref: pose for pose in actual.targets}
        expected_targets = {pose.occurrence_ref: pose for pose in state.targets}
        if len(actual_targets) != len(actual.targets):
            raise CapturePrerequisite('OBSERVED_REACTIVE_TARGET_IDENTITIES_NOT_UNIQUE')
        observed_order = sample.get('observed_response_order_refs')
        predicted_order = tuple(row['target_ref'] for row in predicted['reaction_trace'])
        rows.append(d_map({'sample_index': index, 'expected_targets': state.targets,
            'actual_targets': actual.targets, 'target_population_and_poses_match': expected_targets == actual_targets,
            'capture_ledger_match': set(state.captured_refs) == set(actual.captured_refs),
            'hunter_pose_match': state.hunter == actual.hunter, 'response_trace': predicted['reaction_trace'],
            'observed_order_refs': observed_order,
            'response_order_matches': None if observed_order is None else tuple(observed_order) == predicted_order,
            'actor_order_assumption_ref': model.response_order_evidence_ref}))
    return {'policy_constraints': tuple(rows), 'unique_policy_not_claimed': True}


def _inverse_domain(model, request, budget, barriers):
    if not request.candidates or request.requested_target_ref not in model.target_refs:
        raise CapturePrerequisite('BOUNDED_CAPTURE_CONTEXTS_AND_REQUESTED_TARGET_MISSING')
    if len(request.candidates) > request.domain_bound or len(set(item.candidate_ref for item in request.candidates)) != len(request.candidates):
        raise CapturePrerequisite('CAPTURE_PREIMAGE_DOMAIN_OR_IDENTITY_BOUND_MISMATCH')
    rows = []
    if barriers and (request.state is None or not request.available_inputs):
        raise CapturePrerequisite('BARRIER_CURRENT_STATE_AND_FIRST_INPUT_DOMAIN_MISSING')
    for candidate in request.candidates:
        budget.visit({'candidate_ref': candidate.candidate_ref})
        if candidate.consumer_ref != request.scope.parent_consumer_ref:
            raise CapturePrerequisite('CAPTURE_SERVICE_NOT_BOUND_TO_ACTUAL_CONSUMER')
        if request.requested_target_ref in candidate.state.captured_refs:
            raise CapturePrerequisite('PREIMAGE_TARGET_ALREADY_CAPTURED')
        try:
            # Inverse physical contacts do not require unrelated level-wide
            # acceptance knowledge. Cost and release qualification stay explicit.
            image = _physical_image(model, candidate.state, candidate.primitive, budget)
            following = image['state']
            costs = tuple(cost for kind, cost in model.input_costs if kind == candidate.primitive.kind_ref)
            cost = costs[0] if len(costs) == 1 and costs[0] >= 0 else None
            within_reserve = None if cost is None else cost <= candidate.state.reserve
            if within_reserve:
                reserve = candidate.state.reserve - cost
                following = following.model_copy(update={'reserve': reserve, 'terminated': reserve == 0})
            row = {'candidate_ref': candidate.candidate_ref, 'start': candidate.state,
                'primitive': candidate.primitive, 'end': following, 'consumer_ref': candidate.consumer_ref,
                'expiry_ref': candidate.expiry_ref,
                'requested_target_captured': request.requested_target_ref in following.captured_refs,
                'direct_events': image.get('direct', d_map()).get('direct_events', ()),
                'reaction_pass_count': image['reaction']['reaction_pass_count'],
                'primitive_cost': cost, 'within_current_reserve': within_reserve,
                'level_completion_not_qualified_by_contact_domain': True,
                'remaining_target_refs': tuple(pose.occurrence_ref for pose in following.targets),
                'placement_reachability_not_proved': True}
            if barriers:
                if candidate.service_stone_ref not in model.stone_refs:
                    raise CapturePrerequisite('BARRIER_STONE_NOT_BOUND_TO_THIS_CONSUMER')
                policies = tuple(policy for ref, policy in model.flee_policies if ref == request.requested_target_ref)
                if len(policies) != 1:
                    raise CapturePrerequisite('BARRIER_TARGET_RESPONSE_MODEL_MISSING')
                responses = _response_candidates(model, candidate.state, request.requested_target_ref,
                    policies[0], budget, inspect_escape_topology=True)
                stone_exclusions = tuple(obstruction for obstruction in responses.get('obstruction_rows', ())
                    if candidate.service_stone_ref in obstruction['blocking_occurrence_refs'])
                current_positions = {pose.occurrence_ref: pose.anchor for pose in request.state.stones}
                continuations = []
                if within_reserve is True and not following.terminated:
                    for primitive in request.available_inputs:
                        budget.visit({'candidate_ref': candidate.candidate_ref, 'next_input_ref': primitive.primitive_ref})
                        try:
                            next_image = _external(model, following, primitive, request, budget)
                            next_state = next_image['state']
                            continuations.append(d_map({'primitive_ref': primitive.primitive_ref,
                                'joint_successor': next_state,
                                'additional_capture_refs': tuple(ref for ref in next_state.captured_refs if ref not in following.captured_refs),
                                'direct_outcome_ref': next_image.get('direct', d_map()).get('outcome_ref'),
                                'remaining_target_refs': tuple(pose.occurrence_ref for pose in next_state.targets)}))
                        except CapturePrerequisite as error:
                            continuations.append(d_map({'primitive_ref': primitive.primitive_ref,
                                'unknown_first_successor': str(error)}))
                row.update({'stone_placement_differences': tuple((pose.occurrence_ref,
                    current_positions.get(pose.occurrence_ref), pose.anchor) for pose in candidate.state.stones
                    if current_positions.get(pose.occurrence_ref) != pose.anchor),
                    'release_needed_before_placement': candidate.state.coupled_stone_ref is not None,
                    'service_stone_ref': candidate.service_stone_ref, 'stone_excluded_response_cells': stone_exclusions,
                    'target_current_response_domain': d_map(responses),
                    'escape_topology_measurement': responses.get('escape_topology_measurement'),
                    'remaining_target_first_step_domain': tuple(continuations),
                    'remaining_target_access_requires_outer_joint_route': True,
                    'all_exits_closure_not_assumed': True})
            rows.append(d_map(row))
        except CapturePrerequisite as error:
            rows.append(d_map({'candidate_ref': candidate.candidate_ref,
                'consumer_ref': candidate.consumer_ref, 'expiry_ref': candidate.expiry_ref,
                'missing_preparation_constraint': str(error)}))
    return {'contact_domains': tuple(rows), 'sample_failure_is_not_global_impossibility': True,
        'no_preparation_route_or_new_objective_created': True}


def _sealed_compare(model, request, budget):
    if not request.observations:
        raise CapturePrerequisite('SEALED_CAPTURE_PATH_REPLY_MISSING')
    rows, first = [], None
    for index, sample in enumerate(request.observations):
        budget.visit({'sample_index': index})
        if sample.get('sealed') is not True or sample.get('event_owner_ref') != request.scope.event_owner_ref:
            raise CapturePrerequisite('CAPTURE_REPLY_NOT_SEALED_FOR_BOUND_OWNER')
        if any(sample.get(name) is None for name in ('before_state', 'actual_state', 'expected_state')):
            raise CapturePrerequisite('BEFORE_ACTUAL_EXPECTED_CAPTURE_STATES_MISSING')
        before = CaptureState.model_validate(sample['before_state'])
        actual = CaptureState.model_validate(sample['actual_state'])
        expected = CaptureState.model_validate(sample['expected_state'])
        expected_targets = {pose.occurrence_ref: pose for pose in expected.targets}
        actual_targets = {pose.occurrence_ref: pose for pose in actual.targets}
        if len(expected_targets) != len(expected.targets) or len(actual_targets) != len(actual.targets):
            raise CapturePrerequisite('SEALED_TARGET_IDENTITIES_NOT_UNIQUE')
        vanished_without_receipt = tuple(sorted(set(model.target_refs) - set(actual_targets) - set(actual.captured_refs)))
        mismatches = tuple(ref for ref in sorted(set(actual_targets) | set(expected_targets))
            if actual_targets.get(ref) != expected_targets.get(ref))
        fields = tuple(name for name in ('hunter', 'coupled_stone_ref', 'tether_offset',
            'reserve', 'terminated', 'memory') if getattr(actual, name) != getattr(expected, name))
        stone_mismatch = {pose.occurrence_ref: pose for pose in actual.stones} != {pose.occurrence_ref: pose for pose in expected.stones}
        if stone_mismatch:
            fields = (*fields, 'stones')
        if set(actual.captured_refs) != set(expected.captured_refs):
            fields = (*fields, 'captured_refs')
        actual_order, expected_order = sample.get('actual_response_order_refs'), sample.get('expected_response_order_refs')
        order_match = None if actual_order is None or expected_order is None else actual_order == expected_order
        if first is None and (mismatches or fields or vanished_without_receipt or order_match is False):
            first = index
        before_targets = {pose.occurrence_ref: pose for pose in before.targets}
        rows.append(d_map({'sample_index': index, 'mismatching_target_refs': mismatches,
            'mismatching_state_fields': fields, 'response_order_matches': order_match,
            'new_capture_receipt_refs': tuple(ref for ref in actual.captured_refs if ref not in before.captured_refs),
            'vanished_without_capture_receipt_refs': vanished_without_receipt,
            'surviving_target_translation_refs': tuple(ref for ref in sorted(actual_targets)
                if ref in before_targets and actual_targets[ref].anchor != before_targets[ref].anchor),
            'pose_exchange_is_not_a_capture': True, 'comparison_does_not_authorize_policy_branch': True}))
    return {'packet_deltas': tuple(rows), 'first_divergence_index': first, 'world_mutation_authorized': False}


def measure_reactive_capture(request: ReactiveCaptureRequest) -> DMechanicalResult:
    rejected = d_validate_request(request)
    if rejected is not None:
        return rejected
    budget = DWorkBudget(request)
    operation = request.operation_ref.rsplit('.', 1)[-1]
    rows, current_model_ref = [], None
    try:
        if operation == 'scene_measure':
            if (not request.frame_ref or request.frame_epoch != request.scope.epoch
                    or request.frame_evidence_revision_ref != request.scope.evidence_revision_ref):
                raise CapturePrerequisite('CURRENT_SOURCE_FRAME_IDENTITY_EPOCH_AND_EVIDENCE_REQUIRED')
            layers = measure_scene_layers_d(request.frame, request.scene_calibrations,
                request.scene_layer_questions, request.scene_occlusions, budget)
            return d_result(request, 'OK', 'EXACT_CALIBRATION_CORRELATED_VISIBLE_SCENE_LAYERS',
                values={'frame_ref': request.frame_ref, 'scene_layers': layers,
                    'calibration_refs': tuple(row.calibration_ref for row in request.scene_calibrations),
                    'full_collision_support_and_roles_require_separate_evidence': True,
                    'occurrence_identity_tether_and_hidden_terrain_unresolved': True},
                complete=True, examined=budget.examined)
        if not request.models:
            raise CapturePrerequisite('SCOPED_CONTACT_CLOCK_AND_REACTIVE_MODELS_MISSING')
        rows = d_resume_rows(request, tuple(model.model_ref for model in request.models))
        for model in request.models[len(rows):]:
            current_model_ref = model.model_ref
            budget.visit({'model_ref': model.model_ref})
            if operation == 'input_clock_fit':
                row = _clock_fit(model, request, budget)
            elif operation == 'binding_selector':
                row = _binding_fit(model, request, budget)
            elif operation == 'flee_policy_fit':
                row = _flee_fit(model, request, budget)
            elif operation in ('capture_preimages', 'barrier_services'):
                row = _inverse_domain(model, request, budget, operation == 'barrier_services')
            elif operation == 'sealed_compare':
                row = _sealed_compare(model, request, budget)
            else:
                if request.state is None:
                    raise CapturePrerequisite('CURRENT_JOINT_CAPTURE_STATE_MISSING')
                if operation == 'ordered_flee_step':
                    row = _ordered_response(model, request.state, budget)
                elif operation in ('direct_contact_step', 'external_primitive'):
                    if request.primitive is None:
                        raise CapturePrerequisite('SOURCE_BOUND_CAPTURE_INPUT_MISSING')
                    row = _direct(model, request.state, request.primitive, budget) if operation == 'direct_contact_step' else _external(
                        model, request.state, request.primitive, request, budget)
                elif operation == 'joint_domain':
                    _geometry(model, request.state, budget)
                    if not request.available_inputs:
                        raise CapturePrerequisite('SOURCE_BOUND_JOINT_INPUT_DOMAIN_MISSING')
                    row = {'joint_state': request.state, 'supported_model': model,
                        'available_inputs': request.available_inputs,
                        'successor_operation_ref': 'mechanics.reactive_capture.external_primitive',
                        'direct_then_at_most_one_ordered_response_pass': True,
                        'domain_bound': request.domain_bound, 'witness_limit': 3,
                        'free_walking_room_quotient_applied': False, 'recursive_search_launched': False}
                else:
                    return d_result(request, 'NEEDS_EVIDENCE', 'MISSING_IMPLEMENTATION', examined=budget.examined)
            rows.append(d_map({'model_ref': model.model_ref, 'result': d_map(row)}))
        budget.finish()
        return d_result(request, 'COMPLETE', 'REQUESTED_FINITE_CALCULATION_RETURNED',
            values={'model_correlated_results': tuple(rows)}, complete=True, examined=budget.examined)
    except CapturePrerequisite as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref))
    except DComputationInterrupted as error:
        return d_result(request, 'NEEDS_EVIDENCE', error.cause, examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref, error.frontier))
    except DResumeMismatch as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined)
