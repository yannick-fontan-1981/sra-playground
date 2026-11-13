"""Source-declared nose clicks and snapshot-reserved arm wave closure.

Schemas are not inferred from occupants. Complete bodies move together; a
within-wave removal never creates a destination in that same snapshot.
"""
from __future__ import annotations

from collections import Counter
from typing import ClassVar
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref
from .contracts import FrameGrid
from .rail_layer_contracts_d import RailLayerLayout
from .rail_layer_measurement_d import measure_rail_layers_d
from .mechanical_family_contracts_d import (
    DMechanicalRequest, DMechanicalResult, DWorkBudget, DComputationInterrupted,
    DResumeMismatch, d_validate_request, d_result, d_resume_rows, d_resumable_frontier, d_map,
)

Cell = tuple[int, int]


class RailNose(FrozenModel):
    nose_ref: Ref
    offset: Cell


class RailTrain(FrozenModel):
    train_ref: Ref
    axis: Cell
    footprint: tuple[Cell, ...] = Field(min_length=1, max_length=4096)
    noses: tuple[RailNose, RailNose]
    geometry_evidence_ref: Ref


class RailPose(FrozenModel):
    train_ref: Ref
    origin: Cell


class RailBay(FrozenModel):
    bay_ref: Ref
    train_ref: Ref
    rank: int
    offset: Cell
    schema_type_refs: tuple[Ref, ...] | None = Field(default=None, max_length=128)
    schema_evidence_ref: Ref | None = None


class RailBox(FrozenModel):
    box_ref: Ref
    type_ref: Ref | None = None
    type_evidence_ref: Ref | None = None


class RailLoad(FrozenModel):
    bay_ref: Ref
    box_ref: Ref | None


class RailArm(FrozenModel):
    arm_ref: Ref
    donor_endpoint: Cell
    receiver_endpoint: Cell
    permitted_type_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    geometry_evidence_ref: Ref


class RailHolding(FrozenModel):
    arm_ref: Ref
    phase_ref: Ref
    box_ref: Ref | None
    origin_bay_ref: Ref | None = None


class RailDemand(FrozenModel):
    bay_ref: Ref
    permitted_type_refs: tuple[Ref, ...] = Field(min_length=1, max_length=128)
    demand_evidence_ref: Ref


class RailState(FrozenModel):
    scope_ref: Ref
    poses: tuple[RailPose, ...] = Field(min_length=1, max_length=128)
    loads: tuple[RailLoad, ...] = Field(default=(), max_length=4096)
    arms: tuple[RailHolding, ...] = Field(default=(), max_length=128)
    unattached_box_refs: tuple[Ref, ...] = Field(default=(), max_length=4096)
    reserve: int = Field(ge=0)
    input_count: int = Field(ge=0)
    terminated: bool


class RailModel(FrozenModel):
    model_ref: Ref
    scope_ref: Ref
    trains: tuple[RailTrain, ...] = Field(min_length=1, max_length=128)
    bays: tuple[RailBay, ...] = Field(default=(), max_length=4096)
    boxes: tuple[RailBox, ...] = Field(default=(), max_length=4096)
    arms: tuple[RailArm, ...] = Field(default=(), max_length=128)
    rail_cells: tuple[Cell, ...] = Field(min_length=1, max_length=4096)
    rail_evidence_ref: Ref
    covered_control_cells: tuple[Cell, ...] = Field(default=(), max_length=4096)
    click_law_ref: Ref | None = None
    nose_tie_order: tuple[Ref, ...] = Field(default=(), max_length=256)
    train_choice_ref: Ref | None = None
    train_tie_order: tuple[Ref, ...] = Field(default=(), max_length=128)
    eligibility_order_ref: Ref | None = None
    support_law_ref: Ref | None = None
    path_safety_ref: Ref | None = None
    transfer_law_ref: Ref | None = None
    transfer_filter_ref: Ref | None = None
    reservation_law_ref: Ref | None = None
    arm_order: tuple[Ref, ...] = Field(default=(), max_length=128)
    trigger_law_ref: Ref | None = None
    cadence_ref: Ref | None = None
    cadence_wave_count: int | None = Field(default=None, ge=0, le=4096)
    physical_wave_cap: int | None = Field(default=None, ge=1, le=4096)
    required_demands: tuple[RailDemand, ...] | None = Field(default=None, max_length=128)
    acceptance_checkpoint_ref: Ref | None = None
    input_costs: tuple[tuple[Ref, int], ...] = Field(default=(), max_length=2)
    debit_order_ref: Ref | None = None
    terminal_order_ref: Ref | None = None
    success_effect_ref: Ref | None = None
    success_entry_state: RailState | None = None
    reset_state: RailState | None = None
    reset_cost: int | None = Field(default=None, ge=0)


class RailInput(FrozenModel):
    kind_ref: Ref
    point: Cell | None = None


class RailBinding(FrozenModel):
    primitive: RailInput
    action_ref: Ref
    payload: FrozenMap
    native_support_ref: Ref
    evidence_revision_ref: Ref


class RailAlignment(FrozenModel):
    arm_ref: Ref
    donor_bay_ref: Ref
    receiver_bay_ref: Ref


class RailPreservation(FrozenModel):
    box_ref: Ref
    location_kind_ref: Ref
    location_ref: Ref | None


_CASES = (
    ('layers', ('MEASURE',)), ('click_law_fit', ('FIT',)),
    ('click_selection', ('PRECONDITION',)), ('bay_alignment_preimages', ('INVERSE_DOMAIN',)),
    ('snapshot_plan', ('STEP_INTERNAL',)), ('settled_click_successor', ('STEP',)),
    ('typed_assignment', ('PROPAGATE',)), ('buffer_repair_domains', ('INVERSE_DOMAIN',)),
    ('word_certificate', ('COMPILE', 'PATH')), ('sealed_compare', ('COMPARE',)),
    ('external_primitive', ('STEP',)),
)


class CadencedRailRequest(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.cadenced_rail_request.v1'
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = tuple(
        (f'mechanics.cadenced_rail_transfer.{operation}', mode)
        for operation, modes in _CASES for mode in modes)
    models: tuple[RailModel, ...] = Field(default=(), max_length=32)
    observed_frame: FrameGrid | None = None
    frame_ref: Ref | None = None
    frame_epoch: int | None = Field(default=None, ge=0)
    layer_layouts: tuple[RailLayerLayout, ...] = Field(default=(), max_length=32)
    state: RailState | None = None
    primitive: RailInput | None = None
    click_domain: tuple[Cell, ...] = Field(default=(), max_length=4096)
    alignments: tuple[RailAlignment, ...] = Field(default=(), max_length=4096)
    obstructive_bay_ref: Ref | None = None
    buffer_bay_refs: tuple[Ref, ...] = Field(default=(), max_length=4096)
    onward_bay_refs: tuple[Ref, ...] = Field(default=(), max_length=4096)
    words: tuple[tuple[RailInput, ...], ...] = Field(default=(), max_length=3)
    bindings: tuple[RailBinding, ...] = Field(default=(), max_length=4096)
    preserve_locations: tuple[RailPreservation, ...] = Field(default=(), max_length=4096)
    forbidden_transfer_pairs: tuple[tuple[Ref, Ref], ...] = Field(default=(), max_length=4096)


class RailPrerequisite(Exception):
    pass


def _add(first, second):
    return first[0] + second[0], first[1] + second[1]


def _subtract(first, second):
    return first[0] - second[0], first[1] - second[1]


def _cells(train, origin):
    return frozenset(_add(origin, offset) for offset in train.footprint)


def _inventory(state):
    return Counter(tuple(load.box_ref for load in state.loads if load.box_ref is not None)
        + tuple(arm.box_ref for arm in state.arms if arm.box_ref is not None) + state.unattached_box_refs)


def _locations(state):
    return {**{load.box_ref: ('BAY', load.bay_ref) for load in state.loads if load.box_ref is not None},
        **{arm.box_ref: ('ARM', arm.arm_ref) for arm in state.arms if arm.box_ref is not None},
        **{ref: ('UNATTACHED', None) for ref in state.unattached_box_refs}}


def _state(model, state, budget):
    if state.scope_ref != model.scope_ref:
        raise RailPrerequisite('CURRENT_RAIL_EXECUTION_SCOPE_NOT_MODEL_SCOPE')
    domains = (model.trains, model.bays, model.boxes, model.arms)
    identifiers = ('train_ref', 'bay_ref', 'box_ref', 'arm_ref')
    maps = tuple({getattr(item, field): item for item in items} for items, field in zip(domains, identifiers))
    if any(len(mapping) != len(items) for mapping, items in zip(maps, domains)):
        raise RailPrerequisite('UNIQUE_CURRENT_TRAIN_BAY_BOX_ARM_IDENTITIES_REQUIRED')
    trains, bays, boxes, arms = maps
    poses, loads, holdings = {pose.train_ref: pose for pose in state.poses}, {load.bay_ref: load for load in state.loads}, {arm.arm_ref: arm for arm in state.arms}
    if (len(poses) != len(state.poses) or set(poses) != set(trains)
            or len(loads) != len(state.loads) or set(loads) != set(bays)
            or len(holdings) != len(state.arms) or set(holdings) != set(arms)):
        raise RailPrerequisite('COMPLETE_UNIQUE_POSE_CONTENT_AND_ARM_PHASE_DOMAINS_REQUIRED')
    if max((*[len(items) for items in domains], len(model.rail_cells), len(model.covered_control_cells),
            *[len(train.footprint) for train in model.trains])) > budget.request.domain_bound:
        raise DComputationInterrupted('RAIL_INPUT_DOMAIN_BOUND', d_map())
    occupied, nose_refs, ranks, bay_points = set(), set(), set(), set()
    for train in model.trains:
        budget.visit({'train_ref': train.train_ref})
        if train.axis not in ((0, 1), (1, 0), (0, -1), (-1, 0)) or len(set(train.footprint)) != len(train.footprint):
            raise RailPrerequisite('DECLARED_UNIT_RAIL_AXIS_AND_FULL_UNIQUE_BODY_MASK_REQUIRED')
        for nose in train.noses:
            if nose.nose_ref in nose_refs:
                raise RailPrerequisite('UNIQUE_PHYSICAL_NOSE_IDENTITIES_REQUIRED')
            nose_refs.add(nose.nose_ref)
        body = _cells(train, poses[train.train_ref].origin)
        if occupied & body:
            raise RailPrerequisite('CURRENT_FULL_TRAIN_BODIES_OVERLAP')
        occupied.update(body)
    for bay in model.bays:
        budget.visit({'bay_ref': bay.bay_ref})
        if bay.train_ref not in trains or (bay.train_ref, bay.rank) in ranks:
            raise RailPrerequisite('CURRENT_UNIQUE_BAY_TRAIN_RANK_REQUIRED')
        ranks.add((bay.train_ref, bay.rank))
        point = _add(poses[bay.train_ref].origin, bay.offset)
        if point in bay_points:
            raise RailPrerequisite('BAY_ENDPOINT_OWNERSHIP_NOT_UNIQUE')
        bay_points.add(point)
    for holding in state.arms:
        if holding.phase_ref not in ('READY', 'CARRYING', 'RETURNING') or (holding.phase_ref == 'CARRYING') != (holding.box_ref is not None):
            raise RailPrerequisite('EXACT_ARM_HOLDING_AND_RETURN_PHASE_REQUIRED')
        if (holding.phase_ref == 'CARRYING' and holding.origin_bay_ref not in bays) or (holding.phase_ref != 'CARRYING' and holding.origin_bay_ref is not None):
            raise RailPrerequisite('CURRENT_HELD_BOX_EXTRACTION_ORIGIN_REQUIRED')
    inventory = _inventory(state)
    if set(inventory) != set(boxes) or any(inventory[ref] != 1 for ref in sorted(inventory)):
        raise RailPrerequisite('COMPLETE_UNIQUE_BOX_OCCURRENCE_LOCATION_CONSERVATION_REQUIRED')
    return trains, bays, boxes, arms, poses, loads, holdings


def _pose_constraints(model, state, train, origin, budget):
    other = frozenset(cell for body in model.trains if body.train_ref != train.train_ref
        for cell in _cells(body, next(pose.origin for pose in state.poses if pose.train_ref == body.train_ref)))
    final = _cells(train, origin)
    blockers = []
    if final & other:
        blockers.append('FINAL_FULL_BODY_OCCUPANCY_CONFLICT')
    rail = frozenset(model.rail_cells)
    if model.support_law_ref == 'both_nose_endpoints':
        support = frozenset(_add(origin, nose.offset) for nose in train.noses)
    elif model.support_law_ref == 'full_final_footprint':
        support = final
    elif model.support_law_ref == 'all_final_bay_points':
        support = frozenset(_add(origin, bay.offset) for bay in model.bays if bay.train_ref == train.train_ref)
        if not support:
            raise RailPrerequisite('DECLARED_BAY_SUPPORT_DOMAIN_EMPTY')
    else:
        raise RailPrerequisite('EXACT_ENDPOINT_OR_BODY_SUPPORT_LAW_REQUIRED')
    if not support <= rail:
        blockers.append('FINAL_DECLARED_SUPPORT_MISSING')
    before = next(pose.origin for pose in state.poses if pose.train_ref == train.train_ref)
    delta = _subtract(origin, before)
    if (train.axis[0] == 0 and delta[0] != 0) or (train.axis[1] == 0 and delta[1] != 0):
        blockers.append('DISPLACEMENT_NOT_DECLARED_RAIL_AXIS')
    distance = abs(delta[0]) + abs(delta[1])
    if model.path_safety_ref not in ('endpoint_only', 'swept_full_body_collision', 'swept_full_body_collision_and_support'):
        raise RailPrerequisite('SEPARATE_PATH_SAFETY_PREDICATE_REQUIRED')
    if model.path_safety_ref != 'endpoint_only' and not blockers:
        if distance > budget.request.depth_bound:
            raise DComputationInterrupted('RAIL_SWEPT_DISPLACEMENT_BOUND', d_map())
        step = (0 if delta[0] == 0 else (1 if delta[0] > 0 else -1), 0 if delta[1] == 0 else (1 if delta[1] > 0 else -1))
        for index in range(1, distance + 1):
            budget.visit({'swept_step_index': index})
            body = _cells(train, (before[0] + index * step[0], before[1] + index * step[1]))
            if body & other:
                blockers.append('SWEPT_FULL_BODY_OCCUPANCY_CONFLICT')
                break
            if model.path_safety_ref == 'swept_full_body_collision_and_support' and not body <= rail:
                blockers.append('SWEPT_FULL_BODY_SUPPORT_MISSING')
                break
    return tuple(blockers), distance


def _click_selection(model, state, point, budget):
    trains, _, _, _, poses, _, _ = _state(model, state, budget)
    if model.click_law_ref != 'body_or_exposed_rail_nearest_nose':
        raise RailPrerequisite('DECLARED_BODY_RAIL_NOSING_CLICK_LAW_REQUIRED')
    if model.eligibility_order_ref not in ('legality_before_choice', 'choice_before_legality'):
        raise RailPrerequisite('CLICK_LEGALITY_VERSUS_TRAIN_CHOICE_ORDER_REQUIRED')
    if point in model.covered_control_cells:
        return {'state': state, 'candidate_poses': (), 'train_ref': None, 'nose_ref': None,
            'effect_ref': 'COVERED_CLICK_REFUSAL', 'movement_effective': False, 'hit_ref': 'COVERED'}
    body_hits = tuple(ref for ref in sorted(trains) if point in _cells(trains[ref], poses[ref].origin))
    if not body_hits and point not in model.rail_cells:
        return {'state': state, 'candidate_poses': (), 'train_ref': None, 'nose_ref': None,
            'effect_ref': 'OFF_MAP_CLICK_NO_EFFECT', 'movement_effective': False, 'hit_ref': 'OFF_MAP'}
    candidates = []
    for ref in body_hits or tuple(sorted(trains)):
        train = trains[ref]
        for nose in train.noses:
            budget.visit({'click_train_ref': ref, 'click_nose_ref': nose.nose_ref})
            nose_now = _add(poses[ref].origin, nose.offset)
            difference = _subtract(point, nose_now)
            if (train.axis[0] == 0 and difference[0] != 0) or (train.axis[1] == 0 and difference[1] != 0):
                continue
            origin = _subtract(point, nose.offset)
            blockers, distance = _pose_constraints(model, state, train, origin, budget)
            candidates.append(d_map({'train_ref': ref, 'nose_ref': nose.nose_ref, 'origin': origin,
                'nose_displacement': distance, 'blockers': blockers, 'legal': not blockers}))
    eligible = tuple(row for row in candidates if row['legal']) if model.eligibility_order_ref == 'legality_before_choice' else tuple(candidates)
    hit_ref = 'BODY' if body_hits else 'EXPOSED_RAIL'
    if not eligible:
        return {'state': state, 'candidate_poses': tuple(candidates), 'train_ref': None, 'nose_ref': None,
            'effect_ref': 'NO_CLICK_PREIMAGE', 'movement_effective': False, 'hit_ref': hit_ref}
    # This is a declared physical hit resolver, not an exploration priority.
    per_train = []
    for ref in sorted({row['train_ref'] for row in eligible}):
        rows = tuple(row for row in eligible if row['train_ref'] == ref)
        distance = min(row['nose_displacement'] for row in rows)
        ties = tuple(row for row in rows if row['nose_displacement'] == distance)
        if len(ties) > 1:
            if len(set(model.nose_tie_order)) != len(model.nose_tie_order) or not {row['nose_ref'] for row in ties} <= set(model.nose_tie_order):
                raise RailPrerequisite('DECLARED_EXACT_NOSE_TIE_ORDER_REQUIRED')
            unique_nose_ref = next(ref for ref in model.nose_tie_order if any(row['nose_ref'] == ref for row in ties))
            ties = tuple(row for row in ties if row['nose_ref'] == unique_nose_ref)
        per_train.append(ties[0])
    if model.train_choice_ref == 'minimum_nose_displacement_then_order':
        distance = min(row['nose_displacement'] for row in per_train)
        per_train = [row for row in per_train if row['nose_displacement'] == distance]
    elif model.train_choice_ref != 'declared_train_order':
        raise RailPrerequisite('DECLARED_COMPETING_TRAIN_PHYSICAL_CHOICE_RULE_REQUIRED')
    if len(per_train) > 1:
        if len(set(model.train_tie_order)) != len(model.train_tie_order) or not {row['train_ref'] for row in per_train} <= set(model.train_tie_order):
            raise RailPrerequisite('DECLARED_EXACT_TRAIN_TIE_ORDER_REQUIRED')
        unique_train_ref = next(ref for ref in model.train_tie_order if any(row['train_ref'] == ref for row in per_train))
        per_train = [row for row in per_train if row['train_ref'] == unique_train_ref]
    unique = per_train[0]
    effective = bool(unique['legal']) and unique['origin'] != poses[unique['train_ref']].origin
    after = state.model_copy(update={'poses': tuple(pose.model_copy(update={'origin': unique['origin']}) if pose.train_ref == unique['train_ref'] else pose for pose in state.poses)}) if effective else state
    if effective:
        _state(model, after, budget)
    return {'state': after, 'candidate_poses': tuple(candidates), 'train_ref': unique['train_ref'], 'nose_ref': unique['nose_ref'],
        'effect_ref': 'TRAIN_MOVED' if effective else ('INERT_NOSE_CLICK' if unique['legal'] else 'ILLEGAL_POSE_REFUSAL'),
        'movement_effective': effective, 'hit_ref': hit_ref, 'final_pose_constraints': unique['blockers']}


def _wave(model, state, request, budget):
    _, bays, boxes, arms, poses, loads, holdings = _state(model, state, budget)
    if model.transfer_law_ref not in ('immediate_pick_deposit', 'pickup_carry_deposit_return') or model.transfer_filter_ref not in ('unfiltered', 'arm_declared_type_filter'):
        raise RailPrerequisite('DECLARED_TRANSFER_HOLDING_PHASE_AND_TYPE_FILTER_LAW_REQUIRED')
    if model.reservation_law_ref not in ('reject_conflicts', 'declared_order_reserves_snapshot_endpoints'):
        raise RailPrerequisite('DECLARED_IMMUTABLE_SNAPSHOT_RESERVATION_LAW_REQUIRED')
    at = {_add(poses[bays[ref].train_ref].origin, bays[ref].offset): ref for ref in sorted(bays)}
    proposals = []
    for ref in sorted(arms):
        budget.visit({'wave_arm_ref': ref})
        arm, holding = arms[ref], holdings[ref]
        donor, receiver = at.get(arm.donor_endpoint), at.get(arm.receiver_endpoint)
        if holding.phase_ref == 'RETURNING':
            proposals.append(d_map({'arm_ref': ref, 'kind_ref': 'RETURN_READY', 'source_ref': None, 'destination_ref': None, 'box_ref': None, 'transfer_source_ref': None}))
            continue
        if holding.phase_ref == 'CARRYING':
            if receiver is not None and loads[receiver].box_ref is None:
                proposals.append(d_map({'arm_ref': ref, 'kind_ref': 'DEPOSIT', 'source_ref': None, 'destination_ref': receiver, 'box_ref': holding.box_ref, 'transfer_source_ref': holding.origin_bay_ref}))
            continue
        if donor is None or loads[donor].box_ref is None:
            continue
        box_ref = loads[donor].box_ref
        if model.transfer_filter_ref == 'arm_declared_type_filter':
            if boxes[box_ref].type_ref is None:
                raise RailPrerequisite('CURRENT_BOX_TYPE_REQUIRED_BY_DECLARED_TRANSFER_FILTER')
            if boxes[box_ref].type_ref not in arm.permitted_type_refs:
                continue
        if model.transfer_law_ref == 'immediate_pick_deposit':
            if receiver is None or loads[receiver].box_ref is not None:
                continue
            kind, destination = 'TRANSFER', receiver
        else:
            kind, destination = 'PICKUP', None
        proposals.append(d_map({'arm_ref': ref, 'kind_ref': kind, 'source_ref': donor, 'destination_ref': destination, 'box_ref': box_ref, 'transfer_source_ref': donor}))
    conflicts = tuple((first['arm_ref'], second['arm_ref']) for index, first in enumerate(proposals)
        for second in proposals[index + 1:] if (first['source_ref'] is not None and first['source_ref'] == second['source_ref'])
        or (first['destination_ref'] is not None and first['destination_ref'] == second['destination_ref']))
    if conflicts and model.reservation_law_ref == 'reject_conflicts':
        raise RailPrerequisite('SNAPSHOT_TRANSFER_CONFLICT_UNRESOLVED_BY_CURRENT_LAW')
    if model.reservation_law_ref == 'declared_order_reserves_snapshot_endpoints':
        if len(set(model.arm_order)) != len(model.arm_order) or set(model.arm_order) != set(arms):
            raise RailPrerequisite('COMPLETE_PHYSICAL_ARM_RESERVATION_ORDER_REQUIRED')
        proposals.sort(key=lambda row: model.arm_order.index(row['arm_ref']))
    reserved_sources, reserved_destinations, reserved_arms, events = set(), set(), set(), []
    for proposal in proposals:
        budget.visit({'reservation_arm_ref': proposal['arm_ref']})
        if proposal['arm_ref'] in reserved_arms or (proposal['source_ref'] is not None and proposal['source_ref'] in reserved_sources) or (proposal['destination_ref'] is not None and proposal['destination_ref'] in reserved_destinations):
            continue
        reserved_arms.add(proposal['arm_ref'])
        if proposal['source_ref'] is not None:
            reserved_sources.add(proposal['source_ref'])
        if proposal['destination_ref'] is not None:
            reserved_destinations.add(proposal['destination_ref'])
        events.append(proposal)
    next_loads, next_holdings = dict(loads), dict(holdings)
    for event in events:
        if event['source_ref'] is not None:
            next_loads[event['source_ref']] = RailLoad(bay_ref=event['source_ref'], box_ref=None)
    for event in events:
        if event['destination_ref'] is not None:
            next_loads[event['destination_ref']] = RailLoad(bay_ref=event['destination_ref'], box_ref=event['box_ref'])
        phase = 'CARRYING' if event['kind_ref'] == 'PICKUP' else ('RETURNING' if event['kind_ref'] == 'DEPOSIT' else 'READY')
        next_holdings[event['arm_ref']] = RailHolding(arm_ref=event['arm_ref'], phase_ref=phase,
            box_ref=event['box_ref'] if phase == 'CARRYING' else None,
            origin_bay_ref=event['source_ref'] if phase == 'CARRYING' else None)
    after = state.model_copy(update={'loads': tuple(next_loads[load.bay_ref] for load in state.loads),
        'arms': tuple(next_holdings[arm.arm_ref] for arm in state.arms)})
    if _inventory(after) != _inventory(state):
        raise RailPrerequisite('SNAPSHOT_TRANSFER_MULTISET_NOT_CONSERVED')
    _state(model, after, budget)
    return {'before_state': state, 'state': after, 'events': tuple(events), 'conflicts': conflicts,
        'reservation_snapshot': d_map({'sources': tuple(sorted(reserved_sources)), 'arms': tuple(sorted(reserved_arms)), 'destinations': tuple(sorted(reserved_destinations))}),
        'new_vacancy_not_reused_within_wave': True, 'box_multiset_conserved': True, 'state_changed': after != state}


def _closure(model, state, triggered, request, budget):
    if not triggered:
        return {'state': state, 'waves': (), 'cadence_complete': True, 'quiescent': not _wave(model, state, request, budget)['state_changed'], 'automatic_pass_count': 0}
    if model.cadence_ref not in ('until_fixed_point', 'fixed_wave_count') or model.physical_wave_cap is None:
        raise RailPrerequisite('DECLARED_ARM_CADENCE_AND_PHYSICAL_WAVE_CAP_REQUIRED')
    if model.cadence_ref == 'fixed_wave_count' and model.cadence_wave_count is None:
        raise RailPrerequisite('DECLARED_FIXED_CADENCE_COUNT_REQUIRED')
    limit = model.physical_wave_cap if model.cadence_ref == 'until_fixed_point' else model.cadence_wave_count
    if limit > model.physical_wave_cap:
        raise RailPrerequisite('FIXED_CADENCE_EXCEEDS_PHYSICAL_CAP')
    current, waves, seen = state, [], set()
    for index in range(limit):
        if index >= request.depth_bound or len(waves) >= request.domain_bound:
            raise DComputationInterrupted('ARM_WAVE_COMPUTATION_BOUND', d_map({'next_wave_index': index}))
        key = current.poses, current.loads, current.arms
        if key in seen and model.cadence_ref == 'until_fixed_point':
            raise RailPrerequisite('CYCLIC_ARM_CLOSURE_NOT_QUIESCENT')
        seen.add(key)
        wave = _wave(model, current, request, budget)
        waves.append(d_map(wave))
        current = wave['state']
        if model.cadence_ref == 'until_fixed_point' and not wave['state_changed']:
            return {'state': current, 'waves': tuple(waves), 'cadence_complete': True, 'quiescent': True, 'automatic_pass_count': len(waves)}
    # Read a possible next snapshot only to describe quiescence; do not apply it.
    quiescent = not _wave(model, current, request, budget)['state_changed']
    if model.cadence_ref == 'until_fixed_point' and not quiescent:
        raise RailPrerequisite('PHYSICAL_WAVE_CAP_REACHED_WITHOUT_SETTLEMENT')
    return {'state': current, 'waves': tuple(waves), 'cadence_complete': True, 'quiescent': quiescent, 'automatic_pass_count': len(waves)}


def _acceptance(model, state, quiescent, budget):
    _, bays, boxes, _, _, loads, _ = _state(model, state, budget)
    if model.required_demands is None or model.acceptance_checkpoint_ref != 'quiescent_typed_demands':
        raise RailPrerequisite('EXPLICIT_REQUIRED_BAY_DOMAIN_AND_QUIESCENT_ACCEPTANCE_CONTRACT_REQUIRED')
    if len({demand.bay_ref for demand in model.required_demands}) != len(model.required_demands):
        raise RailPrerequisite('UNIQUE_REQUIRED_TYPED_BAYS_REQUIRED')
    rows = []
    for demand in model.required_demands:
        budget.visit({'demand_bay_ref': demand.bay_ref})
        if demand.bay_ref not in bays:
            raise RailPrerequisite('REQUIRED_TYPED_BAY_NOT_CURRENT')
        box_ref = loads[demand.bay_ref].box_ref
        known_type = boxes[box_ref].type_ref if box_ref is not None else None
        matches = False if box_ref is None else (known_type in demand.permitted_type_refs if known_type is not None else None)
        rows.append(d_map({'bay_ref': demand.bay_ref, 'box_ref': box_ref, 'current_type_ref': known_type, 'matches': matches}))
    if any(row['matches'] is None for row in rows):
        raise RailPrerequisite('CURRENT_REQUIRED_OCCUPANT_TYPE_UNOBSERVED')
    return {'required_delivery_constraints': tuple(rows), 'accepted': quiescent and all(row['matches'] for row in rows),
        'unrequested_storage_or_spare_boxes_not_extra_demands': True}


def _external(model, state, primitive, request, budget):
    _state(model, state, budget)
    if primitive.kind_ref == 'reset':
        if primitive.point is not None or model.reset_state is None or model.reset_cost is None:
            raise RailPrerequisite('INDEPENDENT_RAIL_RESET_STATE_AND_COST_REQUIRED')
        _state(model, model.reset_state, budget)
        return {'state': model.reset_state, 'before_state': state, 'primitive_complete': True,
            'phase_snapshots': d_map({'before': state, 'independent_reset': model.reset_state}),
            'wave_trace': (), 'event_ledger': d_map({'event_owner_ref': request.scope.event_owner_ref,
                'debit': model.reset_cost, 'native_input_count': 1, 'automatic_pass_count': 0, 'accepted': False})}
    if primitive.kind_ref != 'click' or primitive.point is None or state.terminated:
        raise RailPrerequisite('CURRENT_NONTERMINAL_NATIVE_RAIL_CLICK_REQUIRED')
    costs = dict(model.input_costs)
    if len(costs) != len(model.input_costs) or 'click' not in costs or costs['click'] < 0:
        raise RailPrerequisite('ACTUAL_EXTERNAL_CLICK_COST_REQUIRED')
    if model.debit_order_ref not in ('before_direct', 'after_closure') or model.terminal_order_ref not in ('acceptance_before_exhaustion', 'exhaustion_before_acceptance'):
        raise RailPrerequisite('EXPLICIT_CLICK_DEBIT_AND_ACCEPTANCE_EXHAUSTION_ORDER_REQUIRED')
    cost = costs['click']
    charged = state.model_copy(update={'reserve': max(0, state.reserve - cost), 'input_count': state.input_count + 1}) if model.debit_order_ref == 'before_direct' else state.model_copy(update={'input_count': state.input_count + 1})
    click = _click_selection(model, charged, primitive.point, budget)
    if model.trigger_law_ref == 'effective_train_movement_only':
        triggered = click['movement_effective']
    elif model.trigger_law_ref == 'all_legal_supported_clicks':
        triggered = click['effect_ref'] in ('TRAIN_MOVED', 'INERT_NOSE_CLICK')
    elif model.trigger_law_ref == 'every_click':
        triggered = True
    else:
        raise RailPrerequisite('EXPLICIT_EFFECTIVE_OR_INERT_CLICK_TRIGGER_LAW_REQUIRED')
    closure = _closure(model, click['state'], triggered, request, budget)
    settled = closure['state']
    reserve = settled.reserve if model.debit_order_ref == 'before_direct' else max(0, settled.reserve - cost)
    charged_after = settled.model_copy(update={'reserve': reserve})
    verdict = _acceptance(model, charged_after, closure['quiescent'], budget)
    exhausted = reserve == 0
    accepted = verdict['accepted'] and (model.terminal_order_ref == 'acceptance_before_exhaustion' or not exhausted)
    after = charged_after.model_copy(update={'terminated': charged_after.terminated or exhausted or accepted})
    new_scope = False
    if accepted:
        if model.success_effect_ref == 'enter_declared_next_scope':
            if model.success_entry_state is None or model.success_entry_state.scope_ref == model.scope_ref:
                raise RailPrerequisite('QUALIFIED_DISTINCT_RAIL_NEXT_SCOPE_ENTRY_REQUIRED')
            after, new_scope = model.success_entry_state, True
        elif model.success_effect_ref != 'current_scope_win':
            raise RailPrerequisite('ACTUAL_RAIL_SUCCESS_PROGRESSION_CONTRACT_REQUIRED')
    return {'before_state': state, 'state': after, 'click_effect': d_map(click), 'wave_trace': closure['waves'],
        'typed_acceptance': d_map(verdict), 'primitive_complete': True,
        'phase_snapshots': d_map({'before': state, 'after_direct': click['state'], 'after_arm_closure': settled,
            'after_cost': charged_after, 'after_verdict_or_boundary': after}),
        'closure_facts': d_map({'cadence_complete': closure['cadence_complete'], 'quiescent': closure['quiescent'],
            'triggered': triggered, 'new_scope_requires_qualification': new_scope}),
        'event_ledger': d_map({'event_owner_ref': request.scope.event_owner_ref, 'debit': cost,
            'native_input_count': 1, 'automatic_pass_count': closure['automatic_pass_count'],
            'accepted': accepted, 'exhausted': exhausted, 'scope_boundary': new_scope,
            'second_automatic_closure_forbidden': True, 'second_cost_debit_forbidden': True})}


def _alignment(model, state, alignment, request, budget):
    trains, bays, _, arms, poses, loads, holdings = _state(model, state, budget)
    if alignment.arm_ref not in arms or alignment.donor_bay_ref not in bays or alignment.receiver_bay_ref not in bays or alignment.donor_bay_ref == alignment.receiver_bay_ref:
        raise RailPrerequisite('CURRENT_DISTINCT_DONOR_RECEIVER_ARM_IDENTITIES_REQUIRED')
    arm = arms[alignment.arm_ref]
    required_origins = {}
    for bay_ref, endpoint in ((alignment.donor_bay_ref, arm.donor_endpoint), (alignment.receiver_bay_ref, arm.receiver_endpoint)):
        bay = bays[bay_ref]
        origin = _subtract(endpoint, bay.offset)
        if bay.train_ref in required_origins and required_origins[bay.train_ref] != origin:
            return {'alignment': alignment, 'geometric_alignment_possible': False, 'cause': 'SAME_TRAIN_INCOMPATIBLE_BAY_RANKS'}
        required_origins[bay.train_ref] = origin
    click_images = []
    if any(poses[ref].origin != required_origins[ref] for ref in sorted(required_origins)):
        if not request.click_domain or len(request.click_domain) > request.domain_bound:
            raise RailPrerequisite('BOUNDED_REAL_CLICK_PREIMAGE_DOMAIN_REQUIRED')
        for point in request.click_domain:
            budget.visit({'alignment_click_point': point})
            image = _click_selection(model, state, point, budget)
            click_images.append((point, image))
    services = []
    joint_poses = tuple(pose.model_copy(update={'origin': required_origins[pose.train_ref]}) if pose.train_ref in required_origins else pose for pose in state.poses)
    joint_body, overlap = set(), False
    for pose in joint_poses:
        body = _cells(trains[pose.train_ref], pose.origin)
        overlap = overlap or bool(joint_body & body)
        joint_body.update(body)
    for ref in sorted(required_origins):
        origin = required_origins[ref]
        already = poses[ref].origin == origin
        preimages = tuple(d_map({'point': point, 'nose_ref': image['nose_ref'], 'effect_ref': image['effect_ref']})
            for point, image in click_images if image['train_ref'] == ref and image['movement_effective']
            and next(pose.origin for pose in image['state'].poses if pose.train_ref == ref) == origin)
        services.append(d_map({'train_ref': ref, 'required_origin': origin, 'already_aligned': already,
            'current_click_preimages': preimages, 'current_direct_access_available': already or bool(preimages),
            'each_effective_move_requires_its_own_closure': not already}))
    final_support_blockers = []
    if not overlap:
        joint_state = state.model_copy(update={'poses': joint_poses})
        for ref in sorted(required_origins):
            blockers, _ = _pose_constraints(model, joint_state, trains[ref], required_origins[ref], budget)
            final_support_blockers.extend((ref, blocker) for blocker in blockers)
    return {'alignment': alignment, 'geometric_alignment_possible': not overlap,
        'paired_train_services': tuple(services), 'destination_empty_now': loads[alignment.receiver_bay_ref].box_ref is None,
        'donor_box_ref': loads[alignment.donor_bay_ref].box_ref, 'arm_phase_ref': holdings[alignment.arm_ref].phase_ref,
        'joint_final_bodies_conflict': overlap, 'joint_final_support_blockers': tuple(final_support_blockers),
        'alignment_without_trigger_does_not_transfer': True,
        'joint_services_not_a_transport_word': True}


def _alignment_domain(model, request, budget):
    if not request.alignments or len(request.alignments) > request.domain_bound:
        raise RailPrerequisite('BOUNDED_SOURCE_DONOR_RECEIVER_ALIGNMENT_QUERIES_REQUIRED')
    return {'paired_alignment_domains': tuple(d_map(_alignment(model, request.state, alignment, request, budget)) for alignment in request.alignments)}


def _assignment(model, request, budget):
    _, bays, boxes, _, _, _, _ = _state(model, request.state, budget)
    if model.required_demands is None or len({demand.bay_ref for demand in model.required_demands}) != len(model.required_demands):
        raise RailPrerequisite('EXPLICIT_UNIQUE_REQUIRED_TYPED_BAY_DOMAIN_REQUIRED')
    domains, deficits = [], []
    for demand in model.required_demands:
        budget.visit({'assignment_bay_ref': demand.bay_ref})
        if demand.bay_ref not in bays:
            raise RailPrerequisite('ASSIGNMENT_DEMAND_BAY_NOT_CURRENT')
        candidates = tuple(ref for ref in sorted(boxes) if boxes[ref].type_ref is None or boxes[ref].type_ref in demand.permitted_type_refs)
        domains.append((demand, candidates))
        if not candidates:
            deficits.append(demand.bay_ref)
    assignments = []
    def enumerate_assignments(index, used, rows):
        budget.visit({'assignment_depth': index})
        if index > request.depth_bound:
            raise DComputationInterrupted('TYPED_ASSIGNMENT_DEPTH_BOUND', d_map())
        if index == len(domains):
            if len(assignments) >= request.domain_bound:
                raise DComputationInterrupted('TYPED_ASSIGNMENT_RETURN_DOMAIN_BOUND', d_map())
            assignments.append(tuple(rows))
            return
        demand, candidates = domains[index]
        for ref in candidates:
            if ref not in used:
                row = d_map({'bay_ref': demand.bay_ref, 'box_ref': ref, 'type_constraint_refs': demand.permitted_type_refs,
                    'requires_current_type_evidence': boxes[ref].type_ref is None})
                enumerate_assignments(index + 1, used | {ref}, rows + [row])
    enumerate_assignments(0, set(), [])
    return {'injective_occurrence_assignments': tuple(assignments), 'direct_type_deficit_bay_refs': tuple(deficits),
        'joint_occurrence_assignment_deficit': not assignments,
        'conditional_assignment_exists': bool(assignments),
        'known_type_assignment_exists': any(all(not row['requires_current_type_evidence'] for row in assignment) for assignment in assignments),
        'every_assignment_has_unobserved_types': bool(assignments) and all(any(row['requires_current_type_evidence'] for row in assignment) for assignment in assignments),
        'allocation_not_transport_witness': True, 'unrequested_boxes_or_bays_not_added_to_demands': True}


def _repairs(model, request, budget):
    _, bays, boxes, arms, _, loads, holdings = _state(model, request.state, budget)
    donor = request.obstructive_bay_ref
    if donor not in bays or loads[donor].box_ref is None or not request.buffer_bay_refs or not set(request.buffer_bay_refs) <= set(bays):
        raise RailPrerequisite('CURRENT_OBSTRUCTIVE_BOX_AND_DECLARED_BUFFER_DOMAIN_REQUIRED')
    if not request.onward_bay_refs or not set(request.onward_bay_refs) <= set(bays):
        raise RailPrerequisite('EXPLICIT_ONWARD_RECEIVER_QUERY_DOMAIN_REQUIRED')
    if max(len(request.buffer_bay_refs), len(request.onward_bay_refs)) > request.domain_bound:
        raise DComputationInterrupted('BUFFER_RECEIVER_DOMAIN_BOUND', d_map())
    if model.transfer_filter_ref not in ('unfiltered', 'arm_declared_type_filter'):
        raise RailPrerequisite('EXPLICIT_REPAIR_EXTRACTION_TYPE_FILTER_REQUIRED')
    box_ref = loads[donor].box_ref
    if model.transfer_filter_ref == 'arm_declared_type_filter' and boxes[box_ref].type_ref is None:
        raise RailPrerequisite('REPAIR_BOX_TYPE_UNOBSERVED_FOR_FILTER')
    alternatives = []
    for receiver in request.buffer_bay_refs:
        if receiver == donor:
            continue
        onward = []
        for onward_receiver in request.onward_bay_refs:
            if onward_receiver == receiver:
                continue
            for onward_arm_ref in sorted(arms):
                if model.transfer_filter_ref == 'arm_declared_type_filter' and boxes[box_ref].type_ref not in arms[onward_arm_ref].permitted_type_refs:
                    continue
                onward_image = _alignment(model, request.state, RailAlignment(arm_ref=onward_arm_ref,
                    donor_bay_ref=receiver, receiver_bay_ref=onward_receiver), request, budget)
                if onward_image['geometric_alignment_possible'] and not onward_image['joint_final_support_blockers']:
                    if len(onward) >= request.domain_bound:
                        raise DComputationInterrupted('ONWARD_SERVICE_RETURN_DOMAIN_BOUND', d_map())
                    onward.append(d_map({'receiver_bay_ref': onward_receiver, 'arm_ref': onward_arm_ref,
                        'alignment_services': d_map(onward_image),
                        'receiver_empty_now': loads[onward_receiver].box_ref is None,
                        'blocking_box_ref': loads[onward_receiver].box_ref,
                        'requires_box_in_buffer_after_extraction': True,
                        'current_preimages_require_revalidation_after_extraction': True}))
        for arm_ref in sorted(arms):
            budget.visit({'repair_receiver_ref': receiver, 'repair_arm_ref': arm_ref})
            alignment = RailAlignment(arm_ref=arm_ref, donor_bay_ref=donor, receiver_bay_ref=receiver)
            image = _alignment(model, request.state, alignment, request, budget)
            if not image['geometric_alignment_possible'] or image['joint_final_support_blockers']:
                continue
            if model.transfer_filter_ref == 'arm_declared_type_filter' and boxes[box_ref].type_ref not in arms[arm_ref].permitted_type_refs:
                continue
            blocker = loads[receiver].box_ref
            if len(alternatives) >= request.domain_bound:
                raise DComputationInterrupted('EXTRACTION_SERVICE_RETURN_DOMAIN_BOUND', d_map())
            alternatives.append(d_map({'box_ref': loads[donor].box_ref, 'source_bay_ref': donor, 'buffer_bay_ref': receiver,
                'arm_ref': arm_ref, 'alignment_services': d_map(image),
                'and_prerequisites': d_map({'receiver_empty': blocker is None, 'receiver_blocking_box_ref': blocker,
                    'arm_ready': holdings[arm_ref].phase_ref == 'READY', 'trigger_required': True}),
                'or_onward_alignment_services': tuple(onward), 'restoration_bay_ref': donor,
                'restoration_required_by_declared_demand': model.required_demands is not None and any(demand.bay_ref == donor for demand in model.required_demands),
                'actual_extraction_or_onward_word_proved': False}))
    return {'or_extraction_service_domains': tuple(alternatives), 'no_structural_extraction_in_supplied_domain': not alternatives,
        'occupied_receiver_requires_separate_vacancy_service': True, 'local_certificate_not_global_impossibility': True}


def _word(model, request, budget):
    if not request.words:
        raise RailPrerequisite('SOURCE_DECLARED_RAIL_WORD_REQUIRED')
    rows = []
    if any(preservation.location_kind_ref not in ('BAY', 'ARM', 'UNATTACHED')
            or (preservation.location_kind_ref == 'UNATTACHED') != (preservation.location_ref is None)
            for preservation in request.preserve_locations):
        raise RailPrerequisite('TYPED_BAY_ARM_OR_UNATTACHED_PRESERVATION_LOCATION_REQUIRED')
    _, bays, boxes, arms, _, _, _ = _state(model, request.state, budget)
    if any(preservation.box_ref not in boxes or (preservation.location_kind_ref == 'BAY' and preservation.location_ref not in bays)
            or (preservation.location_kind_ref == 'ARM' and preservation.location_ref not in arms)
            for preservation in request.preserve_locations) or any(source not in bays or destination not in bays for source, destination in request.forbidden_transfer_pairs):
        raise RailPrerequisite('CURRENT_TYPED_PRESERVATION_AND_TRANSFER_DOMAIN_IDENTITIES_REQUIRED')
    for word in request.words:
        if len(word) > request.depth_bound:
            raise DComputationInterrupted('RAIL_WORD_PRIMITIVE_BOUND', d_map())
        current, native, effects, violations, cost = request.state, [], [], [], 0
        for primitive in word:
            if current.terminated or current.scope_ref != model.scope_ref:
                break
            budget.visit({'word_input_index': len(native)})
            bindings = tuple(binding for binding in request.bindings if binding.primitive == primitive and binding.evidence_revision_ref == request.scope.evidence_revision_ref)
            if len(bindings) != 1 or not bindings[0].native_support_ref:
                raise RailPrerequisite('CURRENT_NATIVE_CLICK_OR_RESET_PAYLOAD_BINDING_NOT_UNIQUE')
            image = _external(model, current, primitive, request, budget)
            checkpoints = [image['state']] if image['state'].scope_ref == model.scope_ref else [RailState.model_validate(image['phase_snapshots']['after_cost'])]
            for wave in image.get('wave_trace', ()):
                checkpoints.append(RailState.model_validate(wave['state']))
                for event in wave['events']:
                    if (event['transfer_source_ref'], event['destination_ref']) in request.forbidden_transfer_pairs:
                        violations.append(d_map({'input_index': len(native), 'forbidden_transfer': event}))
            for checkpoint in checkpoints:
                locations = _locations(checkpoint)
                for preservation in request.preserve_locations:
                    if locations.get(preservation.box_ref) != (preservation.location_kind_ref, preservation.location_ref):
                        violations.append(d_map({'input_index': len(native), 'box_ref': preservation.box_ref, 'required_location_ref': preservation.location_ref,
                            'required_location_kind_ref': preservation.location_kind_ref,
                            'actual_location': locations.get(preservation.box_ref)}))
            native.append(d_map({'action_ref': bindings[0].action_ref, 'payload': bindings[0].payload, 'native_support_ref': bindings[0].native_support_ref}))
            effects.append(d_map(image))
            cost += image['event_ledger']['debit']
            current = image['state']
        rows.append(d_map({'frozen_native_prefix': tuple(native), 'whole_primitive_predictions': tuple(effects),
            'state': current, 'expanded_external_cost': cost, 'event_domain_violations': tuple(violations),
            'uncompiled_boundary_suffix_count': len(word) - len(native), 'same_full_initial_state': True,
            'primitive_release_authorized': False, 'event_constraints_satisfied': not violations}))
    return {'conditional_word_certificates': tuple(rows), 'internal_wave_count_not_external_input_cost': True}


def _schema_and_delivery_constraints(model, predicted_state, sample, budget):
    if sample.get('newly_exposed_schema_observations') is None or sample.get('actual_required_delivery_observations') is None:
        raise RailPrerequisite('SEALED_EXPOSED_SCHEMA_AND_REQUIRED_DELIVERY_OBSERVATIONS_REQUIRED')
    if predicted_state.scope_ref != model.scope_ref:
        return {'new_scope_schema_and_delivery_unqualified': True,
            'newly_exposed_schema_observations': sample['newly_exposed_schema_observations'],
            'actual_required_delivery_observations': sample['actual_required_delivery_observations'], 'constraints_match': None}
    _, bays, boxes, _, _, loads, _ = _state(model, predicted_state, budget)
    schema_constraints = []
    for observation in sample['newly_exposed_schema_observations']:
        budget.visit({'exposed_schema_bay_ref': observation.get('bay_ref')})
        ref = observation.get('bay_ref')
        if ref not in bays or 'schema_type_refs' not in observation or not observation.get('evidence_ref'):
            raise RailPrerequisite('OBSERVED_SCHEMA_BAY_IDENTITY_AND_SIGNATURE_EVIDENCE_REQUIRED')
        actual_types, expected_types = observation['schema_type_refs'], bays[ref].schema_type_refs
        matches = None if actual_types is None or expected_types is None else frozenset(actual_types) == frozenset(expected_types)
        schema_constraints.append(d_map({'bay_ref': ref, 'known_schema_matches': matches,
            'observed_schema_type_refs': actual_types, 'unobserved_schema_not_filled_from_occupant': True}))
    observed = {}
    for observation in sample['actual_required_delivery_observations']:
        budget.visit({'delivery_observation_bay_ref': observation.get('bay_ref')})
        ref = observation.get('bay_ref')
        if ref not in bays or ref in observed or any(key not in observation for key in ('box_ref', 'type_ref')) or not observation.get('evidence_ref'):
            raise RailPrerequisite('UNIQUE_ACTUAL_BAY_CONTENT_TYPE_AND_DELIVERY_EVIDENCE_REQUIRED')
        observed[ref] = observation
    if model.required_demands is None or not {demand.bay_ref for demand in model.required_demands} <= set(observed):
        raise RailPrerequisite('ALL_DECLARED_REQUIRED_BAYS_NEED_ACTUAL_DELIVERY_OBSERVATION')
    deliveries = []
    for demand in model.required_demands:
        box_ref = loads[demand.bay_ref].box_ref
        expected_type = boxes[box_ref].type_ref if box_ref is not None else None
        observation = observed[demand.bay_ref]
        matches = observation['box_ref'] == box_ref and observation['type_ref'] == expected_type
        deliveries.append(d_map({'bay_ref': demand.bay_ref, 'observed_delivery_matches': matches,
            'observed_box_ref': observation['box_ref'], 'observed_type_ref': observation['type_ref']}))
    return {'exposed_schema_constraints': tuple(schema_constraints), 'required_delivery_constraints': tuple(deliveries),
        'constraints_match': not any(row['known_schema_matches'] is False for row in schema_constraints)
            and all(row['observed_delivery_matches'] for row in deliveries)}


def _compare(model, request, budget):
    if not request.observations:
        raise RailPrerequisite('SEALED_WHOLE_RAIL_TRANSACTION_EVIDENCE_REQUIRED')
    rows, first = [], None
    for index, sample in enumerate(request.observations):
        budget.visit({'sealed_rail_packet_index': index})
        if sample.get('sealed') is not True or sample.get('event_owner_ref') != request.scope.event_owner_ref:
            raise RailPrerequisite('RAIL_PACKET_OWNER_OR_SEAL_MISMATCH')
        if any(sample.get(key) is None for key in ('before_state', 'primitive', 'actual_state', 'observed_waves')) or 'observed_train_ref' not in sample:
            raise RailPrerequisite('ACTUAL_CLICK_SELECTION_CONTENTS_AND_WAVE_SNAPSHOTS_REQUIRED')
        before = RailState.model_validate(sample['before_state'])
        primitive = RailInput.model_validate(sample['primitive'])
        actual = RailState.model_validate(sample['actual_state'])
        image = _external(model, before, primitive, request, budget)
        if actual.scope_ref == model.scope_ref:
            _state(model, actual, budget)
        elif sample.get('next_scene_observation') is None:
            raise RailPrerequisite('NEW_RAIL_SCOPE_REQUIRES_NEXT_SCENE_OBSERVATION')
        observed_waves = tuple(d_map(wave) for wave in sample['observed_waves'])
        expected_waves = image.get('wave_trace', ())
        if any(any(key not in wave for key in ('before_state', 'state', 'events')) for wave in observed_waves):
            raise RailPrerequisite('WHOLE_OBSERVED_WAVE_SNAPSHOTS_AND_EVENTS_REQUIRED')
        wave_matches = len(observed_waves) == len(expected_waves) and all(
            observed['before_state'] == predicted['before_state'] and observed['state'] == predicted['state'] and observed['events'] == predicted['events']
            for observed, predicted in zip(observed_waves, expected_waves))
        train_ref = image['click_effect']['train_ref'] if image.get('click_effect') is not None else None
        expected = image['state']
        schema_delivery = _schema_and_delivery_constraints(model, expected, sample, budget)
        mismatches = tuple(field for field in ('scope_ref', 'poses', 'loads', 'arms', 'unattached_box_refs', 'reserve', 'input_count', 'terminated') if getattr(actual, field) != getattr(expected, field))
        train_matches = sample['observed_train_ref'] == train_ref
        if first is None and (mismatches or not wave_matches or not train_matches or schema_delivery['constraints_match'] is False):
            first = index
        rows.append(d_map({'packet_index': index, 'full_state_difference_fields': mismatches,
            'physical_train_choice_matches': train_matches, 'same_snapshot_transfers_match': wave_matches,
            'schema_and_delivery_constraints': d_map(schema_delivery),
            'projection_does_not_infer_hidden_types_or_reapply_transfer': True}))
    return {'sealed_transaction_constraints': tuple(rows), 'first_divergence_index': first,
        'fit_preserves_each_correlated_hit_trigger_and_transfer_model': True}


def measure_cadenced_rail_transfer(request: CadencedRailRequest) -> DMechanicalResult:
    rejected = d_validate_request(request)
    if rejected is not None:
        return rejected
    budget, rows, current_model_ref = DWorkBudget(request), [], None
    operation = request.operation_ref.rsplit('.', 1)[-1]
    try:
        if operation == 'layers':
            d_resume_rows(request, ())
            layers = measure_rail_layers_d(request, budget)
            budget.finish()
            return d_result(request, 'OK', 'EXACT_CURRENT_RAIL_LAYER_SAMPLES',
                values={'frame_ref': request.frame_ref, 'layer_layout_alternatives': layers},
                complete=True, examined=budget.examined)
        if not request.models or request.state is None:
            raise RailPrerequisite('SCOPED_RAIL_MODEL_AND_COMPLETE_CURRENT_CONFIGURATION_REQUIRED')
        rows = d_resume_rows(request, tuple(model.model_ref for model in request.models))
        for model in request.models[len(rows):]:
            current_model_ref = model.model_ref
            budget.visit({'model_ref': model.model_ref})
            _state(model, request.state, budget)
            if operation == 'click_selection':
                if request.primitive is None or request.primitive.kind_ref != 'click' or request.primitive.point is None:
                    raise RailPrerequisite('CURRENT_PROPOSED_CLICK_REQUIRED')
                row = _click_selection(model, request.state, request.primitive.point, budget)
            elif operation == 'bay_alignment_preimages':
                row = _alignment_domain(model, request, budget)
            elif operation == 'snapshot_plan':
                row = _wave(model, request.state, request, budget)
            elif operation in ('settled_click_successor', 'external_primitive'):
                if request.primitive is None:
                    raise RailPrerequisite('ACTUAL_NATIVE_RAIL_PRIMITIVE_REQUIRED')
                row = _external(model, request.state, request.primitive, request, budget)
            elif operation == 'typed_assignment':
                row = _assignment(model, request, budget)
            elif operation == 'buffer_repair_domains':
                row = _repairs(model, request, budget)
            elif operation == 'word_certificate':
                row = _word(model, request, budget)
            elif operation in ('click_law_fit', 'sealed_compare'):
                row = _compare(model, request, budget)
            else:
                return d_result(request, 'NEEDS_EVIDENCE', 'MISSING_IMPLEMENTATION', examined=budget.examined)
            rows.append(d_map({'model_ref': model.model_ref, 'result': d_map(row)}))
        budget.finish()
        return d_result(request, 'OK', 'EXACT_SCOPED_CADENCED_RAIL_TRANSFER',
            values={'model_correlated_results': tuple(rows)}, complete=True, examined=budget.examined)
    except RailPrerequisite as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref))
    except DResumeMismatch as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined)
    except DComputationInterrupted as error:
        return d_result(request, 'BOUND_REACHED', error.cause, examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref, error.frontier))
