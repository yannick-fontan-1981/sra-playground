"""Caller-declared anchored preview, pickup and strict packing calculations.

Full supports retain notches and identity through preview overlap. Physical
transactions neither choose a packing nor authorize an action or a next scene.
"""
from __future__ import annotations

from typing import ClassVar
from pydantic import Field
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref
from .contracts import FrameGrid
from .packing_inventory_contracts_d import PackingInventoryLayout
from .packing_inventory_measurement_d import measure_packing_inventory_d
from .mechanical_family_contracts_d import (
    DMechanicalRequest, DMechanicalResult, DWorkBudget, DComputationInterrupted,
    DResumeMismatch, d_validate_request, d_result, d_resume_rows, d_resumable_frontier, d_map,
)

Point = tuple[int, int]
_CARDINAL = ((-1, 0), (1, 0), (0, -1), (0, 1))
_TRANSFORMS = ('rotate_cw', 'rotate_ccw', 'reflect_rows', 'reflect_columns')


class PackingPiece(FrozenModel):
    piece_ref: Ref
    full_mask: tuple[Point, ...] = Field(min_length=1, max_length=128)
    movable: bool
    evidence_ref: Ref


class PackingPose(FrozenModel):
    piece_ref: Ref
    anchor: Point
    mask: tuple[Point, ...] = Field(min_length=1, max_length=128)


class PackingState(FrozenModel):
    poses: tuple[PackingPose, ...] = Field(min_length=1, max_length=32)
    held_piece_ref: Ref | None
    pickup_pose: PackingPose | None
    reserve: int = Field(ge=0)
    terminated: bool


class PackingModel(FrozenModel):
    model_ref: Ref
    pieces: tuple[PackingPiece, ...] = Field(min_length=1, max_length=32)
    world_cells: tuple[Point, ...] = Field(min_length=1, max_length=4096)
    board_cells: tuple[Point, ...] = Field(min_length=1, max_length=4096)
    topology_evidence_ref: Ref
    transform_law_ref: Ref | None = None
    permitted_transforms: tuple[Ref, ...] = Field(default=(), max_length=4)
    preview_motion_law_ref: Ref | None = None
    release_law_ref: Ref | None = None
    held_click_law_ref: Ref | None = None
    nonselecting_click_law_ref: Ref | None = None
    invalid_switch_law_ref: Ref | None = None
    invalid_release_law_ref: Ref | None = None
    off_world_law_ref: Ref | None = None
    input_costs: tuple[tuple[Ref, int], ...] = Field(default=(), max_length=16)
    acceptance_law_ref: Ref | None = None
    acceptance_checkpoint_ref: Ref | None = None
    terminal_order_ref: Ref | None = None
    reset_state: PackingState | None = None
    reset_cost: int | None = Field(default=None, ge=0)


class PackingInput(FrozenModel):
    kind_ref: Ref
    cell: Point | None = None
    delta: Point | None = None


class PackingPoseProgram(FrozenModel):
    candidate_ref: Ref
    origin_pose: PackingPose
    edits: tuple[PackingInput, ...] = Field(default=(), max_length=4096)


class PackingPoseDomain(FrozenModel):
    piece_ref: Ref
    poses: tuple[PackingPose, ...] = Field(min_length=1, max_length=4096)
    domain_complete: bool
    evidence_revision_ref: Ref


class PackingBinding(FrozenModel):
    kind_ref: Ref
    cell: Point | None = None
    delta: Point | None = None
    action_ref: Ref
    payload: FrozenMap
    evidence_revision_ref: Ref


class PackingHit(FrozenModel):
    piece_ref: Ref | None
    cell: Point
    native_point: Point
    measured_filled_native_pixels: tuple[Point, ...] = Field(default=(), max_length=4096)
    action_ref: Ref
    payload: FrozenMap
    native_support_ref: Ref
    hit_margin: int = Field(ge=0)
    evidence_revision_ref: Ref


_CASES = (
    ('inventory_measure', ('MEASURE',)), ('selection_transaction_fit', ('FIT',)),
    ('anchored_pose_domain', ('DOMAIN',)), ('preview_release_validity', ('PRECONDITION',)),
    ('preview_edit_successor', ('STEP',)), ('residual_partition_domain', ('INVERSE_DOMAIN',)),
    ('costed_packing_paths', ('DOMAIN',)), ('selection_click_compile', ('COMPILE',)),
    ('pickup_restore_repair_domain', ('DOMAIN',)), ('sealed_packing_compare', ('COMPARE',)),
    ('external_primitive', ('STEP',)),
)


class PreviewPackingRequest(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.preview_packing_request.v1'
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = tuple(
        (f'mechanics.preview_piece_packing.{operation}', mode)
        for operation, modes in _CASES for mode in modes)
    models: tuple[PackingModel, ...] = Field(default=(), max_length=32)
    state: PackingState | None = None
    primitive: PackingInput | None = None
    pose_programs: tuple[PackingPoseProgram, ...] = Field(default=(), max_length=4096)
    pose_domains: tuple[PackingPoseDomain, ...] = Field(default=(), max_length=32)
    words: tuple[tuple[PackingInput, ...], ...] = Field(default=(), max_length=3)
    bindings: tuple[PackingBinding, ...] = Field(default=(), max_length=4096)
    hits: tuple[PackingHit, ...] = Field(default=(), max_length=4096)
    click_piece_ref: Ref | None = None
    click_transaction_ref: Ref | None = None
    observed_frame: FrameGrid | None = None
    frame_ref: Ref | None = None
    frame_epoch: int | None = Field(default=None, ge=0)
    inventory_layouts: tuple[PackingInventoryLayout, ...] = Field(default=(), max_length=32)


class PackingPrerequisite(Exception):
    pass


def _normalized(mask):
    minimum_row, minimum_column = min(row for row, _ in mask), min(column for _, column in mask)
    return tuple(sorted((row - minimum_row, column - minimum_column) for row, column in mask))


def _transform(mask, kind):
    if kind == 'rotate_cw':
        result = tuple((column, -row) for row, column in mask)
    elif kind == 'rotate_ccw':
        result = tuple((-column, row) for row, column in mask)
    elif kind == 'reflect_rows':
        result = tuple((-row, column) for row, column in mask)
    elif kind == 'reflect_columns':
        result = tuple((row, -column) for row, column in mask)
    else:
        raise PackingPrerequisite('SUPPORTED_ANCHORED_TRANSFORM_MISSING')
    return _normalized(result)


def _shape_orbit(piece, model, budget):
    # Finite D4 support orbit, no transport search or executable route family.
    if model.transform_law_ref != 'normalized_top_left_anchor':
        raise PackingPrerequisite('NORMALIZED_ANCHORED_TRANSFORM_LAW_MISSING')
    if len(set(model.permitted_transforms)) != len(model.permitted_transforms) or any(kind not in _TRANSFORMS for kind in model.permitted_transforms):
        raise PackingPrerequisite('DECLARED_TRANSFORM_DOMAIN_INVALID')
    orbit = {_normalized(piece.full_mask)}
    for _ in range(8):
        expanded = set(orbit)
        for mask in sorted(orbit):
            for kind in model.permitted_transforms:
                budget.visit({'orientation_piece_ref': piece.piece_ref, 'transform_ref': kind})
                expanded.add(_transform(mask, kind))
        if expanded == orbit:
            return frozenset(orbit)
        orbit = expanded
    raise PackingPrerequisite('FINITE_ORIENTATION_GROUP_NOT_CLOSED')


def _domains(model, budget):
    world, board = frozenset(model.world_cells), frozenset(model.board_cells)
    if len(world) != len(model.world_cells) or len(board) != len(model.board_cells) or not board <= world:
        raise PackingPrerequisite('UNIQUE_BOARD_INSIDE_CURRENT_WORLD_REQUIRED')
    if len(world) > budget.request.domain_bound:
        raise DComputationInterrupted('WORLD_DOMAIN_BOUND', d_map())
    pieces = {}
    for piece in model.pieces:
        budget.visit({'piece_ref': piece.piece_ref})
        if piece.piece_ref in pieces or len(set(piece.full_mask)) != len(piece.full_mask):
            raise PackingPrerequisite('FULL_OCCURRENCE_IDENTITIES_AND_MASKS_NOT_VALID')
        pieces[piece.piece_ref] = piece
    return world, board, pieces


def _support(pose):
    return frozenset((pose.anchor[0] + row, pose.anchor[1] + column) for row, column in pose.mask)


def _valid_pose(pose, model, world, pieces, budget):
    budget.visit({'pose_piece_ref': pose.piece_ref})
    if pose.piece_ref not in pieces or len(set(pose.mask)) != len(pose.mask) or pose.mask != _normalized(pose.mask):
        raise PackingPrerequisite('NORMALIZED_FULL_POSE_IDENTITY_MISSING')
    if pose.mask != _normalized(pieces[pose.piece_ref].full_mask) and pose.mask not in _shape_orbit(pieces[pose.piece_ref], model, budget):
        raise PackingPrerequisite('CURRENT_POSE_NOT_IN_SUPPORTED_FULL_SHAPE_ORBIT')
    support = _support(pose)
    if not support <= world:
        raise PackingPrerequisite('CURRENT_FULL_POSE_OUTSIDE_WORLD')
    return support


def _state(model, state, budget):
    world, board, pieces = _domains(model, budget)
    poses, supports = {}, {}
    for pose in state.poses:
        if pose.piece_ref in poses:
            raise PackingPrerequisite('DUPLICATE_CURRENT_OCCURRENCE')
        supports[pose.piece_ref] = _valid_pose(pose, model, world, pieces, budget)
        poses[pose.piece_ref] = pose
    if set(poses) != set(pieces):
        raise PackingPrerequisite('FULL_CURRENT_POPULATION_MISSING')
    if state.held_piece_ref is None:
        if state.pickup_pose is not None:
            raise PackingPrerequisite('PICKUP_SNAPSHOT_WITHOUT_HELD_OWNER')
    elif state.held_piece_ref not in pieces or not pieces[state.held_piece_ref].movable or state.pickup_pose is None or state.pickup_pose.piece_ref != state.held_piece_ref:
        raise PackingPrerequisite('HELD_OWNER_AND_PICKUP_SNAPSHOT_NOT_BOUND')
    else:
        _valid_pose(state.pickup_pose, model, world, pieces, budget)
    return world, board, pieces, poses, supports


def _release(model, state, budget):
    _, board, _, _, supports = _state(model, state, budget)
    if state.held_piece_ref is None:
        raise PackingPrerequisite('RELEASE_REQUIRES_CURRENT_HELD_OCCURRENCE')
    if model.release_law_ref not in ('disjoint_inside_board', 'disjoint_inside_or_wholly_outside_board'):
        raise PackingPrerequisite('EXACT_PREVIEW_RELEASE_LAW_MISSING')
    held = supports[state.held_piece_ref]
    overlap = frozenset(cell for ref in sorted(supports) if ref != state.held_piece_ref for cell in held & supports[ref])
    inside, external = held <= board, not bool(held & board)
    allowed = inside or (external and model.release_law_ref == 'disjoint_inside_or_wholly_outside_board')
    return {'valid_release': not overlap and allowed, 'overlap_cells': tuple(sorted(overlap)),
        'inside_board': inside, 'wholly_external_staging': external,
        'board_straddling': not inside and not external,
        'release_constraints_are_not_preview_motion_constraints': True}


def _partition(model, state, budget):
    _, board, _, _, supports = _state(model, state, budget)
    if model.acceptance_law_ref != 'strict_complete_population_partition':
        raise PackingPrerequisite('STRICT_FULL_POPULATION_PARTITION_CONTRACT_MISSING')
    counts = {}
    for ref in sorted(supports):
        for cell in sorted(supports[ref]):
            budget.visit({'partition_piece_ref': ref, 'cell': cell})
            counts[cell] = counts.get(cell, 0) + 1
    missing = tuple(sorted(board - set(counts)))
    extra = tuple(sorted(set(counts) - board))
    multiple = tuple(cell for cell in sorted(counts) if counts[cell] != 1)
    exact = not missing and not extra and not multiple
    if model.acceptance_checkpoint_ref not in ('including_held_preview', 'only_when_not_held'):
        raise PackingPrerequisite('HELD_PREVIEW_ACCEPTANCE_CHECKPOINT_MISSING')
    acceptance = exact and (state.held_piece_ref is None or model.acceptance_checkpoint_ref == 'including_held_preview')
    return {'strict_partition': exact, 'missing_board_cells': missing, 'outside_board_cells': extra,
        'multiple_occupancy_cells': multiple, 'acceptance': acceptance,
        'held_is_not_an_extra_piece': True}


def _edit(model, pose, primitive, world, pieces, budget):
    _valid_pose(pose, model, world, pieces, budget)
    if primitive.kind_ref == 'move':
        if primitive.cell is not None or primitive.delta not in _CARDINAL:
            raise PackingPrerequisite('ACTUAL_UNIT_PREVIEW_TRANSLATION_MISSING')
        after = pose.model_copy(update={'anchor': (pose.anchor[0] + primitive.delta[0], pose.anchor[1] + primitive.delta[1])})
    elif primitive.kind_ref in _TRANSFORMS:
        if (model.transform_law_ref != 'normalized_top_left_anchor' or primitive.kind_ref not in model.permitted_transforms
                or primitive.cell is not None or primitive.delta is not None):
            raise PackingPrerequisite('UNAVAILABLE_OR_UNBOUND_ANCHORED_TRANSFORM')
        after = pose.model_copy(update={'mask': _transform(pose.mask, primitive.kind_ref)})
    else:
        raise PackingPrerequisite('PREVIEW_EDIT_KIND_NOT_DECLARED')
    if model.preview_motion_law_ref not in ('world_only', 'world_and_fixed_collision'):
        raise PackingPrerequisite('PREVIEW_MOTION_CONSTRAINT_LAW_MISSING')
    if not _support(after) <= world:
        return pose, 'WORLD_BOUND_REFUSAL'
    return after, None


def _replace(state, pose, **updates):
    return state.model_copy(update={'poses': tuple(pose if old.piece_ref == pose.piece_ref else old for old in state.poses), **updates})


def _transaction(model, state, primitive, budget):
    world, _, pieces, poses, supports = _state(model, state, budget)
    if primitive.kind_ref in ('move', *_TRANSFORMS):
        if state.held_piece_ref is None:
            return {'state': state, 'transaction_ref': 'NO_HELD_EDIT_REFUSAL', 'affected_piece_refs': ()}
        before = poses[state.held_piece_ref]
        after, refusal = _edit(model, before, primitive, world, pieces, budget)
        if refusal is None and model.preview_motion_law_ref == 'world_and_fixed_collision':
            if any(_support(after) & supports[ref] for ref in sorted(pieces) if not pieces[ref].movable and ref != before.piece_ref):
                after, refusal = before, 'FIXED_MATERIAL_MOTION_REFUSAL'
        return {'state': _replace(state, after), 'transaction_ref': refusal or 'HELD_PREVIEW_EDIT',
            'affected_piece_refs': (before.piece_ref,), 'material_pose': after}
    if primitive.kind_ref != 'click' or primitive.cell is None or primitive.delta is not None:
        raise PackingPrerequisite('BOUND_NATIVE_WORLD_CLICK_MISSING')
    if primitive.cell not in world:
        if model.off_world_law_ref == 'no_transaction_no_debit':
            return {'state': state, 'transaction_ref': 'IGNORED_OFF_WORLD', 'affected_piece_refs': (), 'ignored': True}
        if model.off_world_law_ref != 'release_attempt':
            raise PackingPrerequisite('OFF_WORLD_CLICK_TRANSACTION_LAW_MISSING')
    held = state.held_piece_ref
    peers = tuple(ref for ref in sorted(supports) if ref != held and primitive.cell in supports[ref])
    if len(peers) > 1:
        raise PackingPrerequisite('PEER_HIT_OWNER_NOT_UNIQUE')
    target = peers[0] if peers else None
    if held is None:
        if target is None or not pieces[target].movable:
            return {'state': state, 'transaction_ref': 'NO_MOVABLE_HIT', 'affected_piece_refs': ()}
        return {'state': state.model_copy(update={'held_piece_ref': target, 'pickup_pose': poses[target]}),
            'transaction_ref': 'PICKUP', 'affected_piece_refs': (target,)}
    if primitive.cell in supports[held]:
        if model.held_click_law_ref == 'held_intercepts_no_effect':
            return {'state': state, 'transaction_ref': 'HELD_HIT_INTERCEPTED', 'affected_piece_refs': (held,)}
        if model.held_click_law_ref == 'held_intercepts_release':
            target = None
        elif model.held_click_law_ref != 'held_pass_through':
            raise PackingPrerequisite('HELD_MASK_CLICK_INTERCEPTION_LAW_MISSING')
    elif (target is None or not pieces[target].movable) and primitive.cell in world:
        if model.nonselecting_click_law_ref == 'no_transaction':
            return {'state': state, 'transaction_ref': 'NONSELECTING_CLICK_REFUSED', 'affected_piece_refs': (held,)}
        if model.nonselecting_click_law_ref != 'release_attempt':
            raise PackingPrerequisite('NONSELECTING_WORLD_CLICK_TRANSACTION_LAW_MISSING')
    validity = _release(model, state, budget)
    if target is not None and pieces[target].movable:
        if validity['valid_release']:
            working, event = state, 'RELEASE_AND_PICKUP'
        elif model.invalid_switch_law_ref == 'rollback_to_pickup_then_select':
            working, event = _replace(state, state.pickup_pose), 'ROLLBACK_AND_PICKUP'
        elif model.invalid_switch_law_ref == 'retain_preview_refuse_switch':
            return {'state': state, 'transaction_ref': 'INVALID_SWITCH_REFUSED', 'affected_piece_refs': (held, target), 'release_validity': d_map(validity)}
        else:
            raise PackingPrerequisite('INVALID_SWITCH_ROLLBACK_OR_REFUSAL_LAW_MISSING')
        return {'state': working.model_copy(update={'held_piece_ref': target, 'pickup_pose': poses[target]}),
            'transaction_ref': event, 'affected_piece_refs': (held, target), 'release_validity': d_map(validity)}
    if validity['valid_release']:
        after, event = state.model_copy(update={'held_piece_ref': None, 'pickup_pose': None}), 'RELEASE'
    elif model.invalid_release_law_ref == 'rollback_to_pickup_and_release':
        after, event = _replace(state, state.pickup_pose, held_piece_ref=None, pickup_pose=None), 'ROLLBACK_RELEASE'
    elif model.invalid_release_law_ref == 'retain_invalid_held':
        after, event = state, 'INVALID_RELEASE_REFUSED'
    else:
        raise PackingPrerequisite('INVALID_RELEASE_RESTORATION_LAW_MISSING')
    return {'state': after, 'transaction_ref': event, 'affected_piece_refs': (held,), 'release_validity': d_map(validity)}


def _cost(model, kind):
    costs = dict(model.input_costs)
    if len(costs) != len(model.input_costs) or kind not in costs or any(costs[key] < 0 for key in sorted(costs)):
        raise PackingPrerequisite('ACTUAL_PRIMITIVE_COST_LAW_MISSING')
    return costs[kind]


def _external(model, state, primitive, request, budget):
    _state(model, state, budget)
    if primitive.kind_ref == 'reset':
        if primitive.cell is not None or primitive.delta is not None or model.reset_state is None or model.reset_cost is None:
            raise PackingPrerequisite('INDEPENDENT_BOUND_RESET_CONTRACT_MISSING')
        _state(model, model.reset_state, budget)
        return {'state': model.reset_state, 'before_state': state, 'primitive_complete': True,
            'phase_snapshots': d_map({'before': state, 'independent_reset': model.reset_state}),
            'closure_facts': d_map({'independent_reset_complete': True}),
            'event_ledger': d_map({'event_owner_ref': request.scope.event_owner_ref, 'kind_ref': 'reset',
                'debit': model.reset_cost, 'automatic_pass_count': 0, 'accepted': False, 'acceptance_checked': False})}
    if state.terminated:
        raise PackingPrerequisite('OFFICIAL_TERMINATION_REVOKES_PREVIOUS_SCENE_INPUTS')
    direct = _transaction(model, state, primitive, budget)
    if direct.get('ignored') is True:
        return {'state': state, 'before_state': state, 'direct_effect': d_map(direct), 'primitive_complete': True,
            'phase_snapshots': d_map({'before': state, 'ignored_off_world': state}),
            'closure_facts': d_map({'ignored_input_complete': True}),
            'event_ledger': d_map({'event_owner_ref': request.scope.event_owner_ref, 'kind_ref': primitive.kind_ref,
                'debit': 0, 'automatic_pass_count': 0, 'accepted': False, 'acceptance_checked': False})}
    if model.terminal_order_ref not in ('acceptance_before_exhaustion', 'exhaustion_before_acceptance'):
        raise PackingPrerequisite('OFFICIAL_ACCEPTANCE_EXHAUSTION_ORDER_MISSING')
    after_direct = direct['state']
    partition, cost = _partition(model, after_direct, budget), _cost(model, primitive.kind_ref)
    reserve = max(0, state.reserve - cost)
    exhausted = reserve == 0
    accepted = partition['acceptance'] and (model.terminal_order_ref == 'acceptance_before_exhaustion' or not exhausted)
    after = after_direct.model_copy(update={'reserve': reserve, 'terminated': accepted or exhausted})
    return {'before_state': state, 'state': after, 'direct_effect': d_map(direct),
        'partition': d_map(partition), 'primitive_complete': True,
        'phase_snapshots': d_map({'before': state, 'after_direct': after_direct,
            'after_full_partition_check': d_map({'state': after_direct, 'partition': d_map(partition)}), 'after_cost_and_verdict': after}),
        'closure_facts': d_map({'direct_complete': True, 'full_population_partition_complete': True,
            'input_cost_complete': True, 'official_interruption_checked': True}),
        'event_ledger': d_map({'event_owner_ref': request.scope.event_owner_ref, 'kind_ref': primitive.kind_ref,
            'debit': cost, 'automatic_pass_count': 1, 'accepted': accepted, 'exhausted': exhausted,
            'acceptance_checked': True, 'second_automatic_pass_forbidden': True, 'second_debit_forbidden': True})}


def _pose_domain(model, request, budget):
    world, _, pieces = _domains(model, budget)
    if not request.pose_programs or len(request.pose_programs) > request.domain_bound:
        raise PackingPrerequisite('BOUNDED_CALLER_POSE_EDIT_DOMAIN_MISSING')
    rows = []
    for program in request.pose_programs:
        budget.visit({'candidate_ref': program.candidate_ref})
        pose, cost, refusal = program.origin_pose, 0, None
        _valid_pose(pose, model, world, pieces, budget)
        if not pieces[pose.piece_ref].movable and program.edits:
            raise PackingPrerequisite('FIXED_OCCURRENCE_HAS_NO_EDIT_ORBIT')
        if len(program.edits) > request.depth_bound:
            raise DComputationInterrupted('ANCHORED_EDIT_DEPTH_BOUND', d_map({'candidate_ref': program.candidate_ref}))
        if model.preview_motion_law_ref == 'world_and_fixed_collision' and request.state is None:
            raise PackingPrerequisite('CURRENT_FIXED_OCCUPANCY_REQUIRED_FOR_POSE_DOMAIN')
        fixed_supports = ()
        if request.state is not None:
            _, _, _, _, supports = _state(model, request.state, budget)
            fixed_supports = tuple(supports[ref] for ref in sorted(pieces) if not pieces[ref].movable and ref != pose.piece_ref)
        for primitive in program.edits:
            budget.visit({'candidate_ref': program.candidate_ref, 'pose_edit': primitive.kind_ref})
            after, refusal = _edit(model, pose, primitive, world, pieces, budget)
            if refusal is None and model.preview_motion_law_ref == 'world_and_fixed_collision' and any(_support(after) & support for support in fixed_supports):
                refusal = 'FIXED_MATERIAL_MOTION_REFUSAL'
            cost += _cost(model, primitive.kind_ref)
            if refusal is not None:
                break
            pose = after
        rows.append(d_map({'candidate_ref': program.candidate_ref, 'origin_pose': program.origin_pose, 'pose': pose,
            'full_support': tuple(sorted(_support(pose))), 'expanded_input_cost': cost,
            'refusal_cause': refusal, 'release_validity_not_assumed': True,
            'cost_scope_is_supplied_origin_not_unproved_current_transport': True,
            'symmetry_equal_geometry_does_not_erase_input_cost': True}))
    return {'anchored_pose_results': tuple(rows), 'complete_in_supplied_edit_domain': True,
        'minimum_cost_claimed': False, 'unprovided_transport_paths_not_proved': True}


def _residual(model, request, budget):
    world, board, pieces = _domains(model, budget)
    if model.acceptance_law_ref != 'strict_complete_population_partition':
        raise PackingPrerequisite('STRICT_PARTITION_INVERSE_CONTRACT_MISSING')
    domains = {domain.piece_ref: domain for domain in request.pose_domains}
    if len(domains) != len(request.pose_domains) or set(domains) != set(pieces):
        raise PackingPrerequisite('ONE_COMPLETE_POSE_DOMAIN_PER_OCCURRENCE_REQUIRED')
    current_poses = {}
    if request.state is not None:
        _, _, _, current_poses, _ = _state(model, request.state, budget)
    alternatives = []
    for ref in sorted(pieces):
        domain = domains[ref]
        if not domain.domain_complete or domain.evidence_revision_ref != request.scope.evidence_revision_ref:
            raise PackingPrerequisite('CURRENT_COMPLETE_POSE_DOMAIN_EVIDENCE_MISSING')
        if len(domain.poses) > request.domain_bound:
            raise DComputationInterrupted('POSE_DOMAIN_BOUND', d_map({'piece_ref': ref}))
        valid = []
        for pose in domain.poses:
            support = _valid_pose(pose, model, world, pieces, budget)
            if pose.piece_ref != ref:
                raise PackingPrerequisite('POSE_DOMAIN_OCCURRENCE_MISMATCH')
            if not pieces[ref].movable and (ref not in current_poses or pose != current_poses[ref]):
                raise PackingPrerequisite('FIXED_OCCURRENCE_POSE_NOT_CURRENT')
            if support <= board:
                valid.append((pose, support))
        alternatives.append(tuple(valid))
    if sum(len(piece.full_mask) for piece in model.pieces) != len(board):
        return {'packing_assignments': (), 'area_mismatch': True, 'exhaustive_in_supplied_pose_domains': True}
    if len(alternatives) > request.depth_bound:
        raise DComputationInterrupted('PARTITION_RECURSION_DEPTH_BOUND', d_map())
    assignments = []

    def enumerate_residual(index, occupied, prefix):
        budget.visit({'piece_domain_index': index, 'remaining_cells': len(board - occupied)})
        if index == len(alternatives):
            if occupied == board:
                if len(assignments) >= request.domain_bound:
                    raise DComputationInterrupted('PACKING_ASSIGNMENT_DOMAIN_BOUND', d_map())
                assignments.append(d_map({'poses': prefix, 'strict_partition': True}))
            return
        for pose, support in alternatives[index]:
            if not support & occupied:
                enumerate_residual(index + 1, occupied | support, prefix + (pose,))

    enumerate_residual(0, frozenset(), ())
    return {'packing_assignments': tuple(assignments), 'area_mismatch': False,
        'exhaustive_in_supplied_pose_domains': True, 'packing_does_not_prove_transport': True,
        'minimum_cost_claimed': False}


def _words(model, request, budget):
    if request.state is None or not request.words:
        raise PackingPrerequisite('CURRENT_JOINT_STATE_AND_SOURCE_WORDS_MISSING')
    rows = []
    before_partition = _partition(model, request.state, budget)
    before_poses = {pose.piece_ref: pose for pose in request.state.poses}
    for word in request.words:
        if len(word) > request.depth_bound:
            raise DComputationInterrupted('PACKING_WORD_PRIMITIVE_BOUND', d_map())
        current, native, effects, cost = request.state, [], [], 0
        for index, primitive in enumerate(word):
            budget.visit({'word_primitive_index': index})
            if current.terminated:
                break
            matches = tuple(binding for binding in request.bindings
                if binding.kind_ref == primitive.kind_ref and binding.cell == primitive.cell and binding.delta == primitive.delta
                and binding.evidence_revision_ref == request.scope.evidence_revision_ref)
            if len(matches) != 1:
                raise PackingPrerequisite('CURRENT_NATIVE_PACKING_INPUT_BINDING_NOT_UNIQUE')
            image = _external(model, current, primitive, request, budget)
            current = image['state']
            native.append(d_map({'action_ref': matches[0].action_ref, 'payload': matches[0].payload}))
            effects.append(d_map(image))
            cost += image['event_ledger']['debit']
        rows.append(d_map({'native_word': tuple(native), 'sealed_effects': tuple(effects),
            'state': current, 'expanded_input_cost': cost, 'official_interruption': current.terminated,
            'partition_before': d_map(before_partition), 'partition_after': d_map(_partition(model, current, budget)),
            'release_validity_after': d_map(_release(model, current, budget)) if current.held_piece_ref is not None else None,
            'changed_piece_refs': tuple(pose.piece_ref for pose in current.poses if pose != before_poses[pose.piece_ref]),
            'archive_only_suffix_count': len(word) - len(native), 'joint_staging_and_pickup_preserved': True,
            'independent_reserve_case_not_assumed': True, 'minimum_cost_claimed': False,
            'no_intermediate_reconciliation': True, 'primitive_release_authorized': False}))
    return {'checked_joint_words': tuple(rows), 'transport_outside_supplied_words': 'UNVERIFIED'}


def _click_bindings(model, request, budget):
    if request.state is None or not request.hits or request.click_transaction_ref is None:
        raise PackingPrerequisite('CURRENT_BODY_PIXELS_AND_SOURCE_CLICK_CONSUMER_MISSING')
    world, _, pieces, _, supports = _state(model, request.state, budget)
    rows = []
    for hit in request.hits:
        budget.visit({'native_support_ref': hit.native_support_ref})
        if hit.evidence_revision_ref != request.scope.evidence_revision_ref:
            raise PackingPrerequisite('CURRENT_NATIVE_HIT_MEASUREMENT_MISSING')
        if request.click_piece_ref is not None:
            if request.click_piece_ref not in pieces or not pieces[request.click_piece_ref].movable:
                raise PackingPrerequisite('SOURCE_CLICK_OCCURRENCE_NOT_MOVABLE')
            if hit.piece_ref != request.click_piece_ref or hit.cell not in supports[request.click_piece_ref]:
                continue
            if not hit.measured_filled_native_pixels:
                raise PackingPrerequisite('MEASURED_FULL_NATIVE_BODY_PIXEL_SUPPORT_MISSING')
            if hit.native_point not in hit.measured_filled_native_pixels:
                continue
            if request.state.held_piece_ref != request.click_piece_ref and request.state.held_piece_ref is not None and hit.cell in supports[request.state.held_piece_ref]:
                continue
        elif hit.piece_ref is not None:
            continue
        image = _transaction(model, request.state, PackingInput(kind_ref='click', cell=hit.cell), budget)
        if image['transaction_ref'] != request.click_transaction_ref:
            continue
        rows.append(d_map({'native_point': hit.native_point, 'cell': hit.cell, 'action_ref': hit.action_ref,
            'payload': hit.payload, 'native_support_ref': hit.native_support_ref, 'hit_margin': hit.hit_margin,
            'in_world': hit.cell in world, 'transaction_ref': image['transaction_ref'],
            'affected_piece_refs': image['affected_piece_refs'], 'browser_scaling_not_inferred': True}))
    return {'native_click_binding_domain': tuple(rows), 'source_consumer_transaction_ref': request.click_transaction_ref,
        'primitive_release_authorized': False}


def _fit(model, request, budget):
    if not request.observations:
        raise PackingPrerequisite('SEALED_BEFORE_INPUT_AFTER_TRANSACTION_EVIDENCE_MISSING')
    rows = []
    for index, sample in enumerate(request.observations):
        budget.visit({'sample_index': index})
        if sample.get('sealed') is not True or sample.get('event_owner_ref') != request.scope.event_owner_ref:
            raise PackingPrerequisite('SELECTION_FIT_EVENT_OWNER_OR_SEAL_MISMATCH')
        if any(sample.get(key) is None for key in ('before_state', 'primitive', 'after_direct_state')):
            raise PackingPrerequisite('ACTUAL_DIRECT_SELECTION_STATE_MISSING')
        before = PackingState.model_validate(sample['before_state'])
        primitive = PackingInput.model_validate(sample['primitive'])
        actual = PackingState.model_validate(sample['after_direct_state'])
        if primitive.kind_ref != 'click':
            raise PackingPrerequisite('SELECTION_TRANSACTION_FIT_REQUIRES_CLICK')
        image = _transaction(model, before, primitive, budget)
        _state(model, actual, budget)
        rows.append(d_map({'sample_index': index, 'predicted_transaction': d_map(image),
            'observed_direct_state_matches': d_map(actual) == d_map(image['state']),
            'unobserved_switch_context_not_confirmed': True}))
    return {'selection_transaction_constraints': tuple(rows)}


def _compare(model, request, budget):
    if not request.observations:
        raise PackingPrerequisite('SEALED_PACKING_PACKETS_MISSING')
    rows, receipts, first = [], {}, None
    for index, sample in enumerate(request.observations):
        budget.visit({'packet_index': index})
        if sample.get('sealed') is not True or sample.get('event_owner_ref') != request.scope.event_owner_ref:
            raise PackingPrerequisite('PACKET_OWNER_OR_SEAL_MISMATCH')
        if any(sample.get(key) is None for key in ('actual_state', 'expected_state', 'boundary_observation')):
            raise PackingPrerequisite('FULL_POSE_PICKUP_BUDGET_AND_BOUNDARY_OBSERVATION_MISSING')
        actual = PackingState.model_validate(sample['actual_state'])
        expected = PackingState.model_validate(sample['expected_state'])
        _state(model, actual, budget)
        _state(model, expected, budget)
        fields = tuple(key for key in ('held_piece_ref', 'pickup_pose', 'reserve', 'terminated') if getattr(actual, key) != getattr(expected, key))
        poses_equal = {pose.piece_ref: d_map(pose) for pose in actual.poses} == {pose.piece_ref: d_map(pose) for pose in expected.poses}
        validity = _release(model, actual, budget) if actual.held_piece_ref is not None else None
        boundary = sample['boundary_observation']
        if any(boundary.get(key) is None for key in ('event_ref', 'score_before', 'score_after', 'level_before', 'level_after')):
            raise PackingPrerequisite('OFFICIAL_BOUNDARY_RECEIPT_FIELDS_MISSING')
        receipt = d_map(boundary)
        if receipt['event_ref'] in receipts and receipts[receipt['event_ref']] != receipt:
            raise PackingPrerequisite('REPEATED_BOUNDARY_RECEIPT_CONTRADICTORY')
        receipts[receipt['event_ref']] = receipt
        boundary_changed = boundary['score_after'] != boundary['score_before'] or boundary['level_after'] != boundary['level_before']
        if boundary_changed and sample.get('next_scene_observation') is None:
            raise PackingPrerequisite('NEXT_SCENE_OBSERVATION_AFTER_OFFICIAL_BOUNDARY_MISSING')
        if first is None and (fields or not poses_equal):
            first = index
        rows.append(d_map({'packet_index': index, 'full_masks_and_anchors_match': poses_equal,
            'control_and_pickup_difference_fields': fields, 'actual_release_validity': validity,
            'boundary_event_ref': boundary['event_ref'], 'next_scene_observation': sample.get('next_scene_observation'),
            'old_scope_does_not_authorize_next_scene': True}))
    completions = tuple(receipts[ref] for ref in sorted(receipts)
        if receipts[ref]['score_after'] > receipts[ref]['score_before'] or receipts[ref]['level_after'] > receipts[ref]['level_before'])
    return {'sealed_comparisons': tuple(rows), 'first_divergence_index': first,
        'unique_official_completion_receipts': completions, 'repeated_flags_are_not_new_wins': True}


def measure_preview_piece_packing(request: PreviewPackingRequest) -> DMechanicalResult:
    rejected = d_validate_request(request)
    if rejected is not None:
        return rejected
    budget, rows, current_model_ref = DWorkBudget(request), [], None
    operation = request.operation_ref.rsplit('.', 1)[-1]
    try:
        if operation == 'inventory_measure':
            d_resume_rows(request, ())
            inventory = measure_packing_inventory_d(request, budget)
            budget.finish()
            return d_result(request, 'OK', 'EXACT_CURRENT_PACKING_INVENTORY_SAMPLES',
                values={'frame_ref': request.frame_ref, 'inventory_layout_alternatives': inventory},
                complete=True, examined=budget.examined)
        if not request.models:
            raise PackingPrerequisite('SCOPED_FULL_MASK_PREVIEW_TRANSACTION_MODELS_MISSING')
        rows = d_resume_rows(request, tuple(model.model_ref for model in request.models))
        for model in request.models[len(rows):]:
            current_model_ref = model.model_ref
            budget.visit({'model_ref': model.model_ref})
            if operation == 'selection_transaction_fit':
                row = _fit(model, request, budget)
            elif operation == 'anchored_pose_domain':
                row = _pose_domain(model, request, budget)
            elif operation == 'residual_partition_domain':
                row = _residual(model, request, budget)
            elif operation in ('costed_packing_paths', 'pickup_restore_repair_domain'):
                row = _words(model, request, budget)
            elif operation == 'selection_click_compile':
                row = _click_bindings(model, request, budget)
            elif operation == 'sealed_packing_compare':
                row = _compare(model, request, budget)
            else:
                if request.state is None:
                    raise PackingPrerequisite('CURRENT_JOINT_PREVIEW_STATE_MISSING')
                if operation == 'preview_release_validity':
                    row = _release(model, request.state, budget)
                elif operation in ('preview_edit_successor', 'external_primitive'):
                    if request.primitive is None:
                        raise PackingPrerequisite('BOUND_PREVIEW_EXTERNAL_PRIMITIVE_MISSING')
                    row = _external(model, request.state, request.primitive, request, budget)
                else:
                    return d_result(request, 'NEEDS_EVIDENCE', 'MISSING_IMPLEMENTATION', examined=budget.examined)
            rows.append(d_map({'model_ref': model.model_ref, 'result': d_map(row)}))
        budget.finish()
        return d_result(request, 'OK', 'EXACT_SCOPED_PREVIEW_PACKING_COMPUTATION',
            values={'model_correlated_results': tuple(rows)}, complete=True, examined=budget.examined)
    except PackingPrerequisite as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref))
    except DResumeMismatch as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined)
    except DComputationInterrupted as error:
        return d_result(request, 'BOUND_REACHED', error.cause, examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref, error.frontier))
