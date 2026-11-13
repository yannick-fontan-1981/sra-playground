"""Finite direct-placement calculations under explicit opponent and access laws.

No falling marks, invented random seed, favorable reply selection, contingent
blind click, agent strategy commitment or action release.
"""
from __future__ import annotations

from fractions import Fraction
from typing import ClassVar, Literal
from pydantic import Field
from agents.yf_arc3_v5.capabilities.contracts import FrameGrid
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref
from .mechanical_common_contracts_c import SearchDomainInputC
from .mechanical_request_contracts import MechanicalRequestIdentity
from .mechanical_family_contracts_d import (
    DMechanicalRequest, DMechanicalResult, DWorkBudget, DComputationInterrupted,
    DResumeMismatch, d_validate_request, d_result, d_resume_rows, d_resumable_frontier, d_map,
)
from .indexed_panel_measurement_d import DPanelLayout, measure_panel_regions_d, measure_indexed_control_d

Point = tuple[int, int]


class AlignmentMarkPrototype(FrozenModel):
    prototype_ref: Ref
    raster: FrameGrid
    source_content_kind_ref: Literal['EMPTY', 'MARK']
    source_owner_cue_ref: Ref | None = None
    evidence_ref: Ref
    evidence_revision_ref: Ref


class AlignmentBoardLayout(FrozenModel):
    board_ref: Ref
    board_epoch_ref: Ref
    panels: DPanelLayout
    cell_regions: tuple[tuple[Point, Ref], ...] = Field(min_length=1, max_length=256)
    gap_region_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    prototypes: tuple[AlignmentMarkPrototype, ...] = Field(min_length=1, max_length=256)


class AlignmentActiveBoardLayout(FrozenModel):
    panels: DPanelLayout
    board_indices: tuple[tuple[int, Ref], ...] = Field(min_length=1, max_length=32)


class AlignmentBoard(FrozenModel):
    board_ref: Ref
    epoch_ref: Ref
    cells: tuple[tuple[Ref | None, ...], ...] = Field(min_length=1, max_length=16)
    turn_ref: Ref
    status_ref: Ref
    inventory_complete: bool


class AlignmentWinReceipt(FrozenModel):
    board_ref: Ref
    board_epoch_ref: Ref
    event_owner_ref: Ref


class AlignmentState(FrozenModel):
    boards: tuple[AlignmentBoard, ...] = Field(min_length=1, max_length=32)
    active_board_ref: Ref | None
    access_evidence_ref: Ref | None
    wins: tuple[AlignmentWinReceipt, ...] = Field(default=(), max_length=128)
    reserve: int = Field(ge=0)
    disqualified: bool
    terminated: bool


class AlignmentBoardRule(FrozenModel):
    board_ref: Ref
    cell_domain: tuple[Point, ...] = Field(min_length=1, max_length=256)
    winning_lines: tuple[tuple[Point, ...], ...] = Field(min_length=1, max_length=256)
    evidence_ref: Ref


class AlignmentOutcomeTransition(FrozenModel):
    board_ref: Ref
    outcome_ref: Ref
    effect_ref: Ref
    next_board_ref: Ref | None = None
    access_evidence_ref: Ref | None = None
    restore_state: AlignmentState | None = None


class AlignmentReplyDistribution(FrozenModel):
    board_ref: Ref
    position: tuple[tuple[Ref | None, ...], ...] = Field(min_length=1, max_length=16)
    probabilities: tuple[tuple[Point, int, int], ...] = Field(min_length=1, max_length=256)
    evidence_ref: Ref


class AlignmentModel(FrozenModel):
    model_ref: Ref
    player_ref: Ref
    opponent_ref: Ref
    rules: tuple[AlignmentBoardRule, ...] = Field(min_length=1, max_length=32)
    placement_law_ref: Ref | None = None
    reply_policy_ref: Ref | None = None
    reply_tie_ref: Ref | None = None
    reply_order: tuple[Point, ...] = Field(default=(), max_length=256)
    opponent_terminal_values: tuple[tuple[Ref, int], ...] = Field(default=(), max_length=3)
    distributions: tuple[AlignmentReplyDistribution, ...] = Field(default=(), max_length=4096)
    transitions: tuple[AlignmentOutcomeTransition, ...] = Field(default=(), max_length=96)
    required_wins: int | None = Field(default=None, ge=1, le=128)
    win_count_law_ref: Ref | None = None
    input_cost: int | None = Field(default=None, ge=0)
    debit_order_ref: Ref | None = None
    terminal_order_ref: Ref | None = None
    reset_law_ref: Ref | None = None
    ignored_reset_lifecycle_ref: Ref | None = None
    reset_state: AlignmentState | None = None
    reset_cost: int | None = Field(default=None, ge=0)


class AlignmentInput(FrozenModel):
    kind_ref: Ref
    board_ref: Ref | None = None
    board_epoch_ref: Ref | None = None
    cell: Point | None = None


class AlignmentBinding(FrozenModel):
    primitive: AlignmentInput
    action_ref: Ref
    payload: FrozenMap
    support_ref: Ref
    evidence_revision_ref: Ref


class AlignmentRiskAlternative(FrozenModel):
    alternative_ref: Ref
    known_response_cost: int | None = Field(default=None, ge=0)
    worst_case_guaranteed_cost: int | None = Field(default=None, ge=0)
    acquisition_cost: int | None = Field(default=None, ge=0)
    probability_numerator: int | None = Field(default=None, ge=0)
    probability_denominator: int | None = Field(default=None, ge=1)
    guarantee_evidence_ref: Ref | None = None
    distribution_evidence_ref: Ref | None = None
    metric_scope_ref: Ref


class AlignmentRecoveryRecord(FrozenModel):
    record_ref: Ref
    model_ref: Ref
    model_revision_ref: Ref
    evidence_ref: Ref
    input_revision_ref: Ref
    before_state: AlignmentState
    actual_state: AlignmentState
    primitive: AlignmentInput
    event_owner_ref: Ref
    sealed: bool
    policy_return_ref: Ref | None = None
    policy_payload: FrozenMap = Field(default_factory=FrozenMap)
    response_quantifier_ref: Ref | None = None
    required_response_refs: tuple[Ref, ...] = Field(default=(), max_length=4096)
    covered_response_refs: tuple[Ref, ...] = Field(default=(), max_length=4096)
    response_domain_complete: bool = False
    current_revalidation_ref: Ref | None = None
    current_model_revision_ref: Ref | None = None
    current_input_revision_ref: Ref | None = None


class AlignmentLevelCommand(FrozenModel):
    command_ref: Ref
    action_ref: Ref
    kind_ref: Literal['place', 'reset']
    board_ref: Ref | None = None
    cell: Point | None = None
    evidence_refs: tuple[Ref, ...] = Field(min_length=1, max_length=128)


class AlignmentLevelPhase(FrozenModel):
    phase_ref: Literal['after_player', 'after_opponent', 'after_access_effects', 'after_cost_and_quota', 'actual_reset_protocol']
    kind_ref: Ref
    producer_ref: Ref
    clock_ref: Ref
    temporal_scope_ref: Ref
    snapshot_kind: Literal['PRE_COMMAND', 'ACTOR_TURN']


class AlignmentLevelStepTemplate(FrozenModel):
    model_ref: Ref
    request: MechanicalRequestIdentity


class AlignmentLevelComposition(FrozenModel):
    origin_ref: Literal['EXTERNAL_ROOT_QUESTION', 'INTERNAL_SUCCESSOR']
    query_template: SearchDomainInputC
    step_templates: tuple[AlignmentLevelStepTemplate, ...] = Field(min_length=1, max_length=32)
    commands: tuple[AlignmentLevelCommand, ...] = Field(min_length=1, max_length=256)
    phases: tuple[AlignmentLevelPhase, ...] = Field(min_length=1, max_length=5)
    closure_domain_ref: Ref
    closure_stop_ref: Ref
    evidence_refs: tuple[Ref, ...] = Field(min_length=1, max_length=128)
    observation_fields: tuple[str, ...] = Field(min_length=1, max_length=7)


_CASES = (
    ('layout_measure', ('MEASURE',)), ('control_scope', ('PRECONDITION', 'MEASURE')),
    ('tactical_domain', ('DOMAIN',)), ('reply_model', ('FIT', 'DOMAIN')),
    ('position_value', ('EVALUATE', 'SEARCH')), ('sequential_objective', ('DOMAIN', 'SEARCH')),
    ('cost_risk_compare', ('COMPARE',)), ('click_compile', ('COMPILE',)),
    ('transaction_reconcile', ('COMPARE',)), ('recovery_memory', ('RETAIN', 'PROBE')),
    ('external_primitive', ('STEP',)),
)


class FiniteAlignmentRequest(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.finite_alignment_request.v1'
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = tuple(
        (f'mechanics.finite_alignment_game.{operation}', mode)
        for operation, modes in _CASES for mode in modes)
    models: tuple[AlignmentModel, ...] = Field(default=(), max_length=32)
    state: AlignmentState | None = None
    primitive: AlignmentInput | None = None
    board_ref: Ref | None = None
    perspective_ref: Ref | None = None
    response_quantifier_ref: Ref | None = None
    terminal_values: tuple[tuple[Ref, int], ...] = Field(default=(), max_length=3)
    bindings: tuple[AlignmentBinding, ...] = Field(default=(), max_length=4096)
    words: tuple[tuple[AlignmentInput, ...], ...] = Field(default=(), max_length=3)
    risk_alternatives: tuple[AlignmentRiskAlternative, ...] = Field(default=(), max_length=4096)
    observed_frame: FrameGrid | None = None
    frame_ref: Ref | None = None
    frame_epoch: int | None = Field(default=None, ge=0)
    frame_evidence_revision_ref: Ref | None = None
    observed_scene_ref: Ref | None = None
    board_layouts: tuple[AlignmentBoardLayout, ...] = Field(default=(), max_length=32)
    active_board_layouts: tuple[AlignmentActiveBoardLayout, ...] = Field(default=(), max_length=32)
    recovery_records: tuple[AlignmentRecoveryRecord, ...] = Field(default=(), max_length=4096)
    level_composition: AlignmentLevelComposition | None = None


class AlignmentPrerequisite(Exception):
    pass


def _layout_measure(request, budget):
    if (request.observed_frame is None or not request.frame_ref or not request.observed_scene_ref
            or request.frame_epoch != request.scope.epoch
            or request.frame_evidence_revision_ref != request.scope.evidence_revision_ref
            or not request.board_layouts):
        raise AlignmentPrerequisite('CURRENT_ALIGNMENT_FRAME_SCENE_AND_BOARD_LAYOUTS_REQUIRED')
    if max(len(request.board_layouts), len(request.active_board_layouts)) > request.domain_bound:
        raise DComputationInterrupted('ALIGNMENT_LAYOUT_DOMAIN_BOUND', d_map())
    layout_refs = tuple(row.panels.layout_ref for row in request.board_layouts)
    control_refs = tuple(row.panels.layout_ref for row in request.active_board_layouts)
    if len(set(layout_refs)) != len(layout_refs) or len(set(control_refs)) != len(control_refs):
        raise AlignmentPrerequisite('UNIQUE_BOARD_AND_CONTROL_LAYOUT_ALTERNATIVES_REQUIRED')
    board_refs = {row.board_ref for row in request.board_layouts}
    boards = []
    for layout in request.board_layouts:
        if not layout.board_epoch_ref or layout.panels.scene_ref != request.observed_scene_ref:
            raise AlignmentPrerequisite('CURRENT_SCENE_AND_BOARD_EPOCH_REQUIRED')
        if layout.panels.slots:
            raise AlignmentPrerequisite('BOARD_USES_EXPLICIT_TWO_DIMENSIONAL_CELLS_NOT_ONE_AXIS_PANEL_SLOTS')
        cells = dict(layout.cell_regions)
        regions = {region.region_ref: region for region in layout.panels.regions}
        if (len(cells) != len(layout.cell_regions)
                or len({ref for _, ref in layout.cell_regions}) != len(layout.cell_regions)
                or any(min(cell) < 0 or max(cell) > 15 for cell in cells)
                or any(ref not in regions or regions[ref].purpose_ref != 'BOARD_CELL' for _, ref in layout.cell_regions)):
            raise AlignmentPrerequisite('UNIQUE_INDEXED_BOARD_CELL_CORES_REQUIRED_NOT_GAPS_OR_LAMPS')
        if (len(set(layout.gap_region_refs)) != len(layout.gap_region_refs)
                or any(ref not in regions or regions[ref].purpose_ref != 'BORDER' for ref in layout.gap_region_refs)):
            raise AlignmentPrerequisite('GAP_SUPPORTS_MUST_BE_DECLARED_SEPARATELY_FROM_CELLS')
        if max(len(layout.cell_regions), len(layout.prototypes), len(layout.gap_region_refs)) > request.domain_bound:
            raise DComputationInterrupted('ALIGNMENT_CELL_PROTOTYPE_DOMAIN_BOUND', d_map())
        for index, (_, first_ref) in enumerate(layout.cell_regions):
            first = regions[first_ref].content_bounds
            for _, second_ref in layout.cell_regions[index + 1:]:
                budget.visit({'first_cell_region_ref': first_ref, 'second_cell_region_ref': second_ref})
                second = regions[second_ref].content_bounds
                if max(first[0], second[0]) <= min(first[2], second[2]) and max(first[1], second[1]) <= min(first[3], second[3]):
                    raise AlignmentPrerequisite('DISTINCT_BOARD_CELL_CORES_OVERLAP')
        for gap_ref in layout.gap_region_refs:
            gap = regions[gap_ref].content_bounds
            for _, cell_ref in layout.cell_regions:
                budget.visit({'gap_ref': gap_ref, 'cell_region_ref': cell_ref})
                core = regions[cell_ref].content_bounds
                if max(gap[0], core[0]) <= min(gap[2], core[2]) and max(gap[1], core[1]) <= min(gap[3], core[3]):
                    raise AlignmentPrerequisite('PURE_GAP_SUPPORT_OVERLAPS_A_DECLARED_CELL_CORE')
        if len({row.prototype_ref for row in layout.prototypes}) != len(layout.prototypes):
            raise AlignmentPrerequisite('UNIQUE_SOURCE_MARK_PROTOTYPE_IDENTITIES_REQUIRED')
        for prototype in layout.prototypes:
            if prototype.raster.height * prototype.raster.width > request.domain_bound:
                raise DComputationInterrupted('ALIGNMENT_PROTOTYPE_PIXEL_DOMAIN_BOUND', d_map())
            if (not prototype.evidence_ref or prototype.evidence_revision_ref != request.scope.evidence_revision_ref
                    or prototype.source_content_kind_ref == 'EMPTY' and prototype.source_owner_cue_ref is not None
                    or prototype.source_content_kind_ref == 'MARK' and not prototype.source_owner_cue_ref):
                raise AlignmentPrerequisite('CURRENT_SOURCE_MARK_EMPTY_PROTOTYPES_AND_OWNER_CUES_REQUIRED')
        measured = measure_panel_regions_d(request.observed_frame, (layout.panels,), budget)[0]
        by_region = {row['region_ref']: row for row in measured['regions']}
        descriptions, empties = [], []
        for cell, region_ref in layout.cell_regions:
            content = by_region[region_ref]
            raster = content['local_raster']
            matches = []
            if raster is not None:
                for prototype in layout.prototypes:
                    equal = len(raster) == prototype.raster.height and len(raster[0]) == prototype.raster.width
                    if equal:
                        for row in range(prototype.raster.height):
                            for column in range(prototype.raster.width):
                                budget.visit({'board_ref': layout.board_ref, 'cell': cell,
                                    'prototype_ref': prototype.prototype_ref, 'pixel': (row, column)})
                                equal = equal and raster[row][column] == prototype.raster.rows[row][column]
                    if equal:
                        matches.append(prototype)
            native_hits = tuple(point for ref, point in measured['native_click_supports'] if ref == region_ref)
            core = regions[region_ref].content_bounds
            if any(not core[0] <= point[0] <= core[2] or not core[1] <= point[1] <= core[3] for point in native_hits):
                raise AlignmentPrerequisite('NATIVE_CELL_HIT_SUPPORT_MUST_NOT_USE_PURE_GAP_OR_DECORATIVE_BORDER')
            empty_cue = bool(matches) and all(row.source_content_kind_ref == 'EMPTY' for row in matches)
            if empty_cue:
                empties.append(d_map({'cell': cell, 'region_ref': region_ref, 'native_hit_supports': native_hits,
                    'source_empty_prototype_refs': tuple(row.prototype_ref for row in matches),
                    'empty_meaning_remains_source_premise': True}))
            descriptions.append(d_map({'cell': cell, 'region_ref': region_ref, 'measured_content': content,
                'matching_source_prototypes': tuple(matches), 'native_hit_supports': native_hits,
                'content_unknown_or_not_covered_by_prototype': raster is None or not matches,
                'lamp_colors_do_not_assign_cell_ownership': True}))
        boards.append(d_map({'board_ref': layout.board_ref, 'board_epoch_ref': layout.board_epoch_ref,
            'layout_ref': layout.panels.layout_ref, 'indexed_cells': tuple(descriptions),
            'source_empty_cell_candidate_supports': tuple(empties),
            'separate_measured_gaps': tuple(by_region[ref] for ref in layout.gap_region_refs),
            'all_measured_panel_regions': measured['regions'], 'no_scale_shared_between_boards': True}))
    controls = []
    for layout in request.active_board_layouts:
        indices = dict(layout.board_indices)
        if (layout.panels.scene_ref != request.observed_scene_ref
                or len(indices) != len(layout.board_indices)
                or len({ref for _, ref in layout.board_indices}) != len(layout.board_indices)
                or set(indices) != {slot.index for slot in layout.panels.slots}
                or any(ref not in board_refs for _, ref in layout.board_indices)):
            raise AlignmentPrerequisite('CURRENT_COMPLETE_INDEX_TO_BOARD_CONTROL_BINDINGS_REQUIRED')
        measured = measure_indexed_control_d(request.observed_frame, (layout.panels,), budget)[0]
        active = measured['current_active_index']
        controls.append(d_map({'layout_ref': layout.panels.layout_ref, 'measured_controls': measured,
            'current_active_board_cue_ref': indices[active] if active is not None else None,
            'possible_active_board_cue_refs': tuple(indices[index] for index in measured['possible_active_indices']),
            'active_board_mark_is_not_board_cell_ownership': True}))
    budget.finish()
    return {'frame_ref': request.frame_ref, 'indexed_board_layout_alternatives': tuple(boards),
        'independent_active_board_control_alternatives': tuple(controls),
        'active_board_control_not_supplied': not request.active_board_layouts,
        'role_access_turn_goal_and_action_authority_source_owned': True}


def _state(model, state, budget):
    if not model.player_ref or not model.opponent_ref or model.player_ref == model.opponent_ref:
        raise AlignmentPrerequisite('DISTINCT_SOURCE_PLAYER_AND_OPPONENT_MARKS_REQUIRED')
    boards, rules = {}, {rule.board_ref: rule for rule in model.rules}
    if len(rules) != len(model.rules):
        raise AlignmentPrerequisite('UNIQUE_BOARD_RULE_IDENTITIES_REQUIRED')
    for board in state.boards:
        budget.visit({'board_ref': board.board_ref})
        if board.board_ref in boards or board.board_ref not in rules or not board.epoch_ref or not board.inventory_complete:
            raise AlignmentPrerequisite('CURRENT_COMPLETE_INDEXED_BOARD_AND_EPOCH_REQUIRED')
        width = len(board.cells[0])
        if not 1 <= width <= 16 or any(len(row) != width for row in board.cells):
            raise AlignmentPrerequisite('RECTANGULAR_FINITE_BOARD_REQUIRED')
        rule = rules[board.board_ref]
        cells = frozenset(rule.cell_domain)
        if len(cells) != len(rule.cell_domain) or len(cells) > budget.request.domain_bound:
            raise AlignmentPrerequisite('UNIQUE_BOUNDED_CELL_NOT_GAP_DOMAIN_REQUIRED')
        if any(not (0 <= row < len(board.cells) and 0 <= column < width) for row, column in cells):
            raise AlignmentPrerequisite('DECLARED_PLAYABLE_CELL_OUTSIDE_BOARD')
        if any(board.cells[row][column] not in (None, model.player_ref, model.opponent_ref) for row, column in cells):
            raise AlignmentPrerequisite('OBSERVED_MARK_OUTSIDE_DECLARED_OWNER_DOMAIN')
        if any(not line or len(set(line)) != len(line) or not set(line) <= cells for line in rule.winning_lines):
            raise AlignmentPrerequisite('EXPLICIT_VALID_WINNING_LINES_REQUIRED')
        if board.turn_ref not in (model.player_ref, model.opponent_ref) or board.status_ref not in ('LIVE', 'LOCKED', 'PLAYER_WON', 'OPPONENT_WON', 'DRAW'):
            raise AlignmentPrerequisite('DECLARED_TURN_AND_BOARD_STATUS_REQUIRED')
        boards[board.board_ref] = board
    if set(boards) != set(rules) or (state.active_board_ref is not None and state.active_board_ref not in boards):
        raise AlignmentPrerequisite('FULL_BOARD_POPULATION_AND_CURRENT_ACCESS_REQUIRED')
    if len(set((receipt.board_ref, receipt.board_epoch_ref) for receipt in state.wins)) != len(state.wins):
        raise AlignmentPrerequisite('DUPLICATE_BOARD_EPOCH_WIN_RECEIPT')
    if any(receipt.board_ref not in boards or not receipt.board_epoch_ref or not receipt.event_owner_ref for receipt in state.wins):
        raise AlignmentPrerequisite('WIN_RECEIPT_IDENTITY_AND_PROVENANCE_REQUIRED')
    return boards, rules


def _terminal(model, rule, board):
    player_lines = tuple(line for line in rule.winning_lines if all(board.cells[row][column] == model.player_ref for row, column in line))
    opponent_lines = tuple(line for line in rule.winning_lines if all(board.cells[row][column] == model.opponent_ref for row, column in line))
    if player_lines and opponent_lines:
        raise AlignmentPrerequisite('CONTRADICTORY_SIMULTANEOUS_BOARD_WINNERS')
    if player_lines:
        return 'PLAYER_WIN', player_lines
    if opponent_lines:
        return 'OPPONENT_WIN', opponent_lines
    if all(board.cells[row][column] is not None for row, column in rule.cell_domain):
        return 'DRAW', ()
    return None, ()


def _empty(rule, board):
    return tuple(cell for cell in rule.cell_domain if board.cells[cell[0]][cell[1]] is None)


def _place(model, rule, board, cell, actor):
    if model.placement_law_ref != 'direct_empty_cell_without_gravity' or cell not in rule.cell_domain or board.cells[cell[0]][cell[1]] is not None:
        raise AlignmentPrerequisite('DECLARED_DIRECT_LEGAL_EMPTY_CELL_PLACEMENT_REQUIRED')
    cells = tuple(tuple(actor if (row, column) == cell else mark for column, mark in enumerate(values)) for row, values in enumerate(board.cells))
    return board.model_copy(update={'cells': cells, 'turn_ref': model.opponent_ref if actor == model.player_ref else model.player_ref})


def _immediate(model, rule, board, actor, budget):
    rows = []
    for cell in _empty(rule, board):
        budget.visit({'immediate_actor_ref': actor, 'cell': cell})
        after = _place(model, rule, board, cell, actor)
        outcome, lines = _terminal(model, rule, after)
        if outcome == ('PLAYER_WIN' if actor == model.player_ref else 'OPPONENT_WIN'):
            rows.append(d_map({'cell': cell, 'winning_lines': lines}))
    return tuple(rows)


def _utilities(model, perspective, values):
    table = dict(values)
    if perspective not in (model.player_ref, model.opponent_ref) or len(table) != 3 or set(table) != {'PLAYER_WIN', 'OPPONENT_WIN', 'DRAW'}:
        raise AlignmentPrerequisite('EXPLICIT_PERSPECTIVE_AND_COMPLETE_TERMINAL_VALUE_CONTRACT_REQUIRED')
    own = 'PLAYER_WIN' if perspective == model.player_ref else 'OPPONENT_WIN'
    other = 'OPPONENT_WIN' if own == 'PLAYER_WIN' else 'PLAYER_WIN'
    if not table[own] > table['DRAW'] > table[other]:
        raise AlignmentPrerequisite('TERMINAL_VALUE_SIGN_AND_PERSPECTIVE_CONTRACT_INCOHERENT')
    return table


def _value(model, rule, board, perspective, values, quantifier, request, budget, cache, depth=0, unrestricted=False):
    terminal, _ = _terminal(model, rule, board)
    if terminal is not None:
        return values[terminal]
    key = (board.cells, board.turn_ref, perspective, quantifier, unrestricted)
    if key in cache:
        return cache[key]
    if depth >= request.depth_bound:
        raise DComputationInterrupted('ALTERNATING_POSITION_DEPTH_BOUND', d_map({'board_ref': board.board_ref, 'depth': depth}))
    if len(cache) >= request.domain_bound:
        raise DComputationInterrupted('POSITION_MEMO_DOMAIN_BOUND', d_map({'board_ref': board.board_ref}))
    budget.visit({'board_ref': board.board_ref, 'alternating_depth': depth})
    actor = board.turn_ref
    if actor == model.opponent_ref and not unrestricted:
        choices = tuple(row['cell'] for row in _replies(model, rule, board, request, budget, depth))
    else:
        choices = _empty(rule, board)
    if not choices:
        raise AlignmentPrerequisite('NONTERMINAL_POSITION_WITHOUT_COMPLETE_LEGAL_TRANSITIONS')
    results = tuple(_value(model, rule, _place(model, rule, board, cell, actor), perspective, values,
        quantifier, request, budget, cache, depth + 1, unrestricted) for cell in choices)
    value = max(results) if actor == perspective or quantifier == 'EXISTS' else min(results)
    if len(cache) >= request.domain_bound:
        raise DComputationInterrupted('POSITION_MEMO_DOMAIN_BOUND', d_map({'board_ref': board.board_ref}))
    cache[key] = value
    return value


def _replies(model, rule, board, request, budget, depth=0):
    if _terminal(model, rule, board)[0] is not None:
        return ()
    if board.turn_ref != model.opponent_ref:
        raise AlignmentPrerequisite('OPPONENT_REPLY_DOMAIN_REQUIRES_OPPONENT_TURN')
    legal = _empty(rule, board)
    if model.reply_policy_ref == 'all_legal_replies':
        candidates = legal
    elif model.reply_policy_ref == 'immediate_win_then_block_then_all_equal':
        wins = _immediate(model, rule, board, model.opponent_ref, budget)
        blocks = _immediate(model, rule, board, model.player_ref, budget)
        candidates = tuple(row['cell'] for row in wins) if wins else tuple(row['cell'] for row in blocks) if blocks else legal
    elif model.reply_policy_ref == 'optimal_opponent_outcome_ties':
        values = _utilities(model, model.opponent_ref, model.opponent_terminal_values)
        cache, scored = {}, []
        for cell in legal:
            after = _place(model, rule, board, cell, model.opponent_ref)
            value = _value(model, rule, after, model.opponent_ref, values, 'FORALL', request, budget, cache, depth + 1, unrestricted=True)
            scored.append((cell, value))
        optimum = max(value for _, value in scored)
        candidates = tuple(cell for cell, value in scored if value == optimum)
    else:
        raise AlignmentPrerequisite('SUPPLIED_OPPONENT_REPLY_POLICY_MISSING')
    if model.reply_tie_ref == 'all_equal_domain':
        probabilities = {}
    elif model.reply_tie_ref == 'first_source_order':
        if len(set(model.reply_order)) != len(model.reply_order) or not set(candidates) <= set(model.reply_order):
            raise AlignmentPrerequisite('COMPLETE_SOURCE_REPLY_TIE_ORDER_REQUIRED')
        candidates = tuple(cell for cell in model.reply_order if cell in candidates)[:1]
        probabilities = {cell: Fraction(1) for cell in candidates}
    elif model.reply_tie_ref == 'declared_position_distribution':
        distributions = tuple(row for row in model.distributions if row.board_ref == board.board_ref and row.position == board.cells)
        if len(distributions) != 1:
            raise AlignmentPrerequisite('EXACT_CURRENT_POSITION_REPLY_DISTRIBUTION_MISSING')
        distribution = distributions[0]
        probabilities = {}
        for cell, numerator, denominator in distribution.probabilities:
            if cell in probabilities or numerator < 0 or denominator <= 0:
                raise AlignmentPrerequisite('REPLY_DISTRIBUTION_NOT_VALID')
            probabilities[cell] = Fraction(numerator, denominator)
        if set(probabilities) != set(candidates) or sum(probabilities.values(), Fraction(0)) != 1:
            raise AlignmentPrerequisite('COMPLETE_NORMALIZED_CURRENT_REPLY_DISTRIBUTION_REQUIRED')
    else:
        raise AlignmentPrerequisite('TIE_DOMAIN_OR_OBSERVED_DISTRIBUTION_LAW_REQUIRED')
    return tuple(d_map({'cell': cell, 'probability': (probabilities[cell].numerator, probabilities[cell].denominator) if cell in probabilities else None,
        'unknown_random_seed_not_inferred': True}) for cell in candidates if cell not in probabilities or probabilities[cell] > 0)


def _scope(model, state, budget):
    boards, rules = _state(model, state, budget)
    if state.active_board_ref is None or not state.access_evidence_ref:
        return {'playable_cells': (), 'access_unknown': True, 'turn_unknown': True}
    board = boards[state.active_board_ref]
    terminal, _ = _terminal(model, rules[board.board_ref], board)
    allowed = not state.terminated and not state.disqualified and board.status_ref == 'LIVE' and board.turn_ref == model.player_ref and terminal is None
    return {'active_board_ref': board.board_ref, 'board_epoch_ref': board.epoch_ref,
        'playable_cells': _empty(rules[board.board_ref], board) if allowed else (), 'access_unknown': False,
        'turn_unknown': False, 'turn_ref': board.turn_ref, 'status_ref': board.status_ref,
        'access_evidence_ref': state.access_evidence_ref, 'selection_not_required': True,
        'future_visible_boards_not_currently_authorized': True}


def _tactical(model, request, budget):
    boards, rules = _state(model, request.state, budget)
    ref = request.board_ref or request.state.active_board_ref
    if ref not in boards:
        raise AlignmentPrerequisite('SOURCE_TACTICAL_BOARD_SCOPE_MISSING')
    board, rule = boards[ref], rules[ref]
    if _terminal(model, rule, board)[0] is not None:
        return {'board_terminal': True, 'candidate_placements': ()}
    alternatives = []
    for cell in _empty(rule, board):
        budget.visit({'tactical_cell': cell})
        after = _place(model, rule, board, cell, model.player_ref)
        outcome, lines = _terminal(model, rule, after)
        threats = _immediate(model, rule, after, model.player_ref, budget) if outcome is None else ()
        replies = _replies(model, rule, after, request, budget) if outcome is None else ()
        responses = []
        for reply in replies:
            response = _place(model, rule, after, reply['cell'], model.opponent_ref)
            terminal, _ = _terminal(model, rule, response)
            continuations = _immediate(model, rule, response, model.player_ref, budget) if terminal is None else ()
            responses.append(d_map({'opponent_cell': reply['cell'], 'outcome_ref': terminal,
                'next_player_winning_cells': tuple(row['cell'] for row in continuations),
                'earlier_opposing_terminal_refutes_fork': terminal == 'OPPONENT_WIN'}))
        alternatives.append(d_map({'cell': cell, 'immediate_player_win': outcome == 'PLAYER_WIN',
            'retained_reply_cells': tuple(row['cell'] for row in replies), 'reply_domain_complete': True,
            'winning_line_witnesses': lines, 'distinct_next_winning_cells': tuple(row['cell'] for row in threats),
            'nominal_multiple_threats': len(threats) >= 2, 'reply_continuations': tuple(responses),
            'next_win_after_every_retained_reply': bool(responses) and all(row['outcome_ref'] is None and row['next_player_winning_cells'] for row in responses),
            'agent_move_selected': False}))
    return {'immediate_player_wins': _immediate(model, rule, board, model.player_ref, budget),
        'opponent_immediate_wins': _immediate(model, rule, board, model.opponent_ref, budget),
        'candidate_placements': tuple(alternatives), 'threats_count_distinct_cells_not_duplicate_lines': True,
        'priority_still_owned_by_source_drm': True}


def _board_value(model, request, budget):
    boards, rules = _state(model, request.state, budget)
    ref = request.board_ref or request.state.active_board_ref
    if ref not in boards or request.response_quantifier_ref not in ('FORALL', 'EXISTS'):
        raise AlignmentPrerequisite('SOURCE_VALUE_BOARD_AND_EXPLICIT_RESPONSE_QUANTIFIER_REQUIRED')
    values = _utilities(model, request.perspective_ref, request.terminal_values)
    cache = {}
    value = _value(model, rules[ref], boards[ref], request.perspective_ref, values, request.response_quantifier_ref, request, budget, cache)
    board = boards[ref]
    continuations = []
    if _terminal(model, rules[ref], board)[0] is None:
        choices = tuple(row['cell'] for row in _replies(model, rules[ref], board, request, budget)) if board.turn_ref == model.opponent_ref else _empty(rules[ref], board)
        for cell in choices:
            budget.visit({'value_continuation_cell': cell})
            successor = _place(model, rules[ref], board, cell, board.turn_ref)
            successor_value = _value(model, rules[ref], successor, request.perspective_ref, values,
                request.response_quantifier_ref, request, budget, cache, depth=1)
            continuations.append(d_map({'cell': cell, 'successor_value': successor_value,
                'attains_current_position_value': successor_value == value, 'action_selected': False}))
    return {'position_value': value, 'perspective_ref': request.perspective_ref,
        'board_ref': board.board_ref, 'board_epoch_ref': board.epoch_ref, 'current_turn_ref': board.turn_ref,
        'terminal_value_contract': request.terminal_values, 'response_quantifier_ref': request.response_quantifier_ref,
        'memoized_position_count': len(cache), 'complete_in_declared_board_transition_domain': True,
        'value_attaining_continuation_domain': tuple(continuations),
        'winning_value': value > values['DRAW'], 'nonlosing_value': value >= values['DRAW'],
        'whole_level_quota_strategy_proved': False, 'agent_action_committed': False}


def _replace_board(state, board):
    return state.model_copy(update={'boards': tuple(board if old.board_ref == board.board_ref else old for old in state.boards)})


def _win_count(model, state):
    if model.win_count_law_ref == 'distinct_board_epochs':
        return len(set((receipt.board_ref, receipt.board_epoch_ref) for receipt in state.wins))
    if model.win_count_law_ref == 'distinct_board_refs':
        return len(set(receipt.board_ref for receipt in state.wins))
    raise AlignmentPrerequisite('EXPLICIT_WIN_RECEIPT_COUNT_SCOPE_REQUIRED')


def _outcome(model, state, board, outcome, owner):
    if outcome is None:
        return _replace_board(state, board), {'board_outcome_ref': None, 'access_effect_ref': 'NO_BOARD_TERMINAL'}
    status = {'PLAYER_WIN': 'PLAYER_WON', 'OPPONENT_WIN': 'OPPONENT_WON', 'DRAW': 'DRAW'}[outcome]
    current = _replace_board(state, board.model_copy(update={'status_ref': status}))
    if outcome == 'PLAYER_WIN':
        receipt = AlignmentWinReceipt(board_ref=board.board_ref, board_epoch_ref=board.epoch_ref, event_owner_ref=owner)
        if not any(old.board_ref == receipt.board_ref and old.board_epoch_ref == receipt.board_epoch_ref for old in current.wins):
            current = current.model_copy(update={'wins': current.wins + (receipt,)})
    transitions = tuple(row for row in model.transitions if row.board_ref == board.board_ref and row.outcome_ref == outcome)
    if len(transitions) != 1:
        raise AlignmentPrerequisite('EXACT_BOARD_OUTCOME_ACCESS_RESET_TRANSITION_MISSING')
    transition = transitions[0]
    if transition.effect_ref == 'ADVANCE':
        if transition.next_board_ref is None or not transition.access_evidence_ref or transition.next_board_ref not in {item.board_ref for item in current.boards}:
            raise AlignmentPrerequisite('DECLARED_NEXT_BOARD_ACCESS_AUTHORITY_MISSING')
        next_board = next(item for item in current.boards if item.board_ref == transition.next_board_ref)
        current = _replace_board(current, next_board.model_copy(update={'status_ref': 'LIVE'})).model_copy(update={
            'active_board_ref': transition.next_board_ref, 'access_evidence_ref': transition.access_evidence_ref})
    elif transition.effect_ref == 'STOP_LEVEL':
        current = current.model_copy(update={'active_board_ref': None, 'disqualified': outcome == 'OPPONENT_WIN', 'terminated': True})
    elif transition.effect_ref == 'RESTORE_WHOLE':
        if transition.restore_state is None:
            raise AlignmentPrerequisite('EXACT_WHOLE_LEVEL_RESTORATION_STATE_MISSING')
        current = transition.restore_state
    elif transition.effect_ref == 'RESTORE_BOARD':
        if transition.restore_state is None:
            raise AlignmentPrerequisite('EXACT_BOARD_RESTORATION_SCOPE_MISSING')
        restored = next((item for item in transition.restore_state.boards if item.board_ref == board.board_ref), None)
        if restored is None:
            raise AlignmentPrerequisite('RESTORED_CURRENT_BOARD_NOT_IN_DECLARED_ENTRY')
        current = _replace_board(current, restored).model_copy(update={'active_board_ref': board.board_ref,
            'access_evidence_ref': transition.restore_state.access_evidence_ref})
    else:
        raise AlignmentPrerequisite('SUPPORTED_OUTCOME_ACCESS_EFFECT_MISSING')
    return current, {'board_outcome_ref': outcome, 'access_effect_ref': transition.effect_ref}


def _external(model, state, primitive, request, budget):
    boards, rules = _state(model, state, budget)
    if primitive.kind_ref == 'reset':
        if primitive.board_ref is not None or primitive.board_epoch_ref is not None or primitive.cell is not None:
            raise AlignmentPrerequisite('RESET_HAS_UNBOUND_EXTRA_FIELDS')
        if model.reset_law_ref == 'advertised_but_ignored':
            if model.reset_cost is None:
                raise AlignmentPrerequisite('IGNORED_RESET_COST_CONTRACT_MISSING')
            if model.ignored_reset_lifecycle_ref not in ('debit_and_exhaustion', 'debit_without_verdict'):
                raise AlignmentPrerequisite('ACTUAL_IGNORED_RESET_LIFECYCLE_EFFECT_REQUIRED')
            reserve = max(0, state.reserve - model.reset_cost)
            current = state.model_copy(update={'reserve': reserve,
                'terminated': state.terminated or (reserve == 0 and model.ignored_reset_lifecycle_ref == 'debit_and_exhaustion')})
        elif model.reset_law_ref == 'declared_exact_restoration':
            if model.reset_state is None or model.reset_cost is None:
                raise AlignmentPrerequisite('INDEPENDENT_RESET_STATE_AND_COST_MISSING')
            current = model.reset_state
        else:
            raise AlignmentPrerequisite('ACTUAL_RESET_PROTOCOL_LAW_MISSING')
        _state(model, current, budget)
        return {'alignment_input': primitive, 'before_state': state,
            'retained_reply_cells': (None,), 'responses': (d_map({'state': current, 'probability': (1, 1), 'primitive_complete': True,
            'phase_snapshots': d_map({'before': state, 'actual_reset_protocol': current}),
            'closure_facts': d_map({'actual_reset_effect_complete': True}),
            'event_ledger': d_map({'event_owner_ref': request.scope.event_owner_ref, 'debit': model.reset_cost,
                'automatic_pass_count': 0, 'accepted': False, 'reset_law_ref': model.reset_law_ref})}),), 'reply_domain_complete': True}
    scope = _scope(model, state, budget)
    if (primitive.kind_ref != 'place' or primitive.board_ref != state.active_board_ref or primitive.board_ref not in boards
            or primitive.board_epoch_ref != boards[primitive.board_ref].epoch_ref or primitive.cell not in scope['playable_cells']):
        raise AlignmentPrerequisite('CURRENT_PLAYABLE_BOARD_EPOCH_TURN_AND_EMPTY_CELL_GUARDS_NOT_MET')
    if model.input_cost is None or model.required_wins is None or model.debit_order_ref not in ('before_transaction', 'after_access_effects'):
        raise AlignmentPrerequisite('EXACT_INPUT_COST_QUOTA_AND_DEBIT_ORDER_MISSING')
    if model.terminal_order_ref not in ('quota_before_exhaustion', 'exhaustion_before_quota'):
        raise AlignmentPrerequisite('DECLARED_QUOTA_EXHAUSTION_ORDER_MISSING')
    initial = state.model_copy(update={'reserve': max(0, state.reserve - model.input_cost)}) if model.debit_order_ref == 'before_transaction' else state
    board, rule = boards[primitive.board_ref], rules[primitive.board_ref]
    player_board = _place(model, rule, board, primitive.cell, model.player_ref)
    immediate, _ = _terminal(model, rule, player_board)
    replies = () if immediate is not None else _replies(model, rule, player_board, request, budget)
    alternatives = ((None, None),) if immediate is not None else tuple((row['cell'], row['probability']) for row in replies)
    if not alternatives:
        raise AlignmentPrerequisite('NONTERMINAL_PLAYER_TRANSACTION_WITHOUT_COMPLETE_REPLY_DOMAIN')
    responses = []
    for reply_cell, probability in alternatives:
        budget.visit({'opponent_reply_cell': reply_cell})
        response_board = player_board if reply_cell is None else _place(model, rule, player_board, reply_cell, model.opponent_ref)
        outcome, lines = _terminal(model, rule, response_board)
        after_access, access = _outcome(model, initial, response_board, outcome, request.scope.event_owner_ref)
        _state(model, after_access, budget)
        reserve = after_access.reserve if model.debit_order_ref == 'before_transaction' else max(0, after_access.reserve - model.input_cost)
        exhausted = reserve == 0
        won = _win_count(model, after_access) >= model.required_wins and not after_access.disqualified
        accepted = won and (model.terminal_order_ref == 'quota_before_exhaustion' or not exhausted)
        after = after_access.model_copy(update={'reserve': reserve, 'terminated': after_access.terminated or accepted or exhausted or after_access.disqualified})
        responses.append(d_map({'state': after, 'opponent_cell': reply_cell,
            'probability': (1, 1) if immediate is not None else probability,
            'board_outcome_ref': outcome, 'winning_line_witnesses': lines, 'primitive_complete': True,
            'phase_snapshots': d_map({'before': state, 'after_player': _replace_board(initial, player_board),
                'after_opponent': _replace_board(initial, response_board), 'after_access_effects': after_access, 'after_cost_and_quota': after}),
            'closure_facts': d_map({'player_placement_complete': True, 'immediate_terminal_checked': True,
                'one_reply_or_immediate_terminal_complete': True, 'access_reset_effect_complete': True,
                'cost_and_quota_complete': True}),
            'event_ledger': d_map({'event_owner_ref': request.scope.event_owner_ref, 'debit': model.input_cost,
                'player_cell': primitive.cell, 'opponent_cell': reply_cell, 'automatic_pass_count': 1 if reply_cell is not None else 0,
                'accepted': accepted, 'exhausted': exhausted, 'access_effect': d_map(access),
                'second_reply_forbidden': True, 'second_debit_forbidden': True})}))
    return {'alignment_input': primitive, 'before_state': state,
        'retained_reply_cells': tuple(cell for cell, _ in alternatives),
        'responses': tuple(responses), 'reply_domain_complete': True,
        'uncertain_reply_not_selected_as_favorable_deterministic': len(responses) > 1}


def _reply_domain(model, request, budget):
    boards, rules = _state(model, request.state, budget)
    ref = request.board_ref or request.state.active_board_ref
    if ref not in boards:
        raise AlignmentPrerequisite('SOURCE_REPLY_BOARD_SCOPE_REQUIRED')
    if request.mode_ref == 'DOMAIN':
        return {'retained_reply_domain': _replies(model, rules[ref], boards[ref], request, budget), 'policy_ref': model.reply_policy_ref}
    if not request.observations:
        raise AlignmentPrerequisite('SEALED_PLAYER_AND_OPPONENT_RESPONSE_EVIDENCE_REQUIRED')
    rows = []
    for index, sample in enumerate(request.observations):
        if sample.get('sealed') is not True or sample.get('event_owner_ref') != request.scope.event_owner_ref:
            raise AlignmentPrerequisite('REPLY_FIT_PACKET_OWNER_OR_SEAL_MISMATCH')
        if any(sample.get(key) is None for key in ('before_state', 'primitive', 'actual_state')):
            raise AlignmentPrerequisite('ACTUAL_REPLY_INPUT_AND_WHOLE_STATE_REQUIRED')
        before = AlignmentState.model_validate(sample['before_state'])
        actual = AlignmentState.model_validate(sample['actual_state'])
        primitive = AlignmentInput.model_validate(sample['primitive'])
        projected = _external(model, before, primitive, request, budget)
        matches = tuple(index for index, response in enumerate(projected['responses']) if response['state'] == d_map(actual))
        rows.append(d_map({'sample_index': index, 'compatible_response_indices': matches,
            'full_retained_response_domain': projected['responses'], 'other_ties_not_discarded': True,
            'seed_inferred': False}))
    return {'reply_policy_evidence_constraints': tuple(rows), 'policy_ref': model.reply_policy_ref}


def _risk(request, budget):
    if not request.risk_alternatives or len(request.risk_alternatives) > request.domain_bound:
        raise AlignmentPrerequisite('BOUNDED_SOURCE_COST_RISK_ALTERNATIVES_REQUIRED')
    rows = []
    for alternative in request.risk_alternatives:
        budget.visit({'alternative_ref': alternative.alternative_ref})
        if alternative.worst_case_guaranteed_cost is not None and not alternative.guarantee_evidence_ref:
            raise AlignmentPrerequisite('EXPLICIT_WORST_CASE_GUARANTEE_EVIDENCE_REQUIRED')
        probability = None
        if alternative.probability_numerator is not None or alternative.probability_denominator is not None:
            if alternative.probability_numerator is None or alternative.probability_denominator is None or not alternative.distribution_evidence_ref:
                raise AlignmentPrerequisite('DECLARED_DISTRIBUTION_FOR_PROBABILITY_REQUIRED')
            probability = Fraction(alternative.probability_numerator, alternative.probability_denominator)
            if not 0 <= probability <= 1:
                raise AlignmentPrerequisite('PROBABILITY_OUTSIDE_DECLARED_UNIT_INTERVAL')
        rows.append(d_map({'alternative_ref': alternative.alternative_ref, 'known_response_cost': alternative.known_response_cost,
            'worst_case_guaranteed_cost': alternative.worst_case_guaranteed_cost, 'acquisition_cost': alternative.acquisition_cost,
            'declared_probability': (probability.numerator, probability.denominator) if probability is not None else None,
            'metric_scope_ref': alternative.metric_scope_ref, 'source_evidence': d_map(alternative)}))
    # Only componentwise comparisons on identical scopes and complete measures.
    dominated = []
    for first in request.risk_alternatives:
        measures = (first.known_response_cost, first.worst_case_guaranteed_cost, first.acquisition_cost)
        if any(value is None for value in measures):
            continue
        for second in request.risk_alternatives:
            other = (second.known_response_cost, second.worst_case_guaranteed_cost, second.acquisition_cost)
            if first.alternative_ref != second.alternative_ref and first.metric_scope_ref == second.metric_scope_ref and not any(value is None for value in other):
                if all(left >= right for left, right in zip(measures, other)) and any(left > right for left, right in zip(measures, other)):
                    dominated.append((first.alternative_ref, second.alternative_ref))
    return {'separate_cost_risk_metrics': tuple(rows), 'cost_dominance_pairs_only': tuple(dominated),
        'cost_nondominated_alternative_refs': tuple(row.alternative_ref for row in request.risk_alternatives
            if not any(first == row.alternative_ref for first, _ in dominated)),
        'nondominated_costs_do_not_claim_nondominated_unknown_risk': True,
        'risk_not_blended_into_cost': True, 'alternative_selected': False}


def _compile(model, request, budget):
    if not request.words:
        raise AlignmentPrerequisite('SOURCE_JUSTIFIED_CURRENT_CLICK_WORDS_REQUIRED')
    rows = []
    for word in request.words:
        if len(word) > request.depth_bound:
            raise DComputationInterrupted('ALIGNMENT_NATIVE_WORD_PRIMITIVE_BOUND', d_map())
        current, native, cost, boundary, response_domain, transactions = request.state, [], 0, False, (), []
        for primitive in word:
            if current.terminated:
                break
            budget.visit({'current_click_prefix_index': len(native)})
            matches = tuple(binding for binding in request.bindings if binding.primitive == primitive
                and binding.evidence_revision_ref == request.scope.evidence_revision_ref)
            if len(matches) != 1 or not matches[0].support_ref:
                raise AlignmentPrerequisite('CURRENT_EMPTY_CELL_NATIVE_HIT_BINDING_NOT_UNIQUE')
            image = _external(model, current, primitive, request, budget)
            transactions.append(d_map(image))
            responses = image['responses']
            native.append(d_map({'action_ref': matches[0].action_ref, 'payload': matches[0].payload,
                'board_epoch_ref': primitive.board_epoch_ref, 'support_ref': matches[0].support_ref,
                'primitive': primitive, 'binding_evidence_revision_ref': matches[0].evidence_revision_ref}))
            cost += responses[0]['event_ledger']['debit']
            response_domain = responses
            if len(responses) != 1:
                boundary = True
                break
            current = AlignmentState.model_validate(responses[0]['state'])
        rows.append(d_map({'frozen_known_native_prefix': tuple(native), 'expanded_prefix_cost': cost,
            'compiled_transactions': tuple(transactions), 'current_evidence_revision_ref': request.scope.evidence_revision_ref,
            'response_domain_at_boundary': response_domain, 'unresolved_reply_boundary': boundary,
            'uncompiled_suffix_count': len(word) - len(native), 'primitive_release_authorized': False,
            'contingent_future_clicks_not_frozen': True}))
    return {'compiled_current_justified_prefixes': tuple(rows)}


def _recovery(model, request, budget):
    _state(model, request.state, budget)
    if not request.recovery_records:
        raise AlignmentPrerequisite('ACTUAL_SCOPED_RECOVERY_RECORDS_MISSING')
    if len(request.recovery_records) > request.domain_bound:
        raise DComputationInterrupted('RECOVERY_RECORD_DOMAIN_BOUND', d_map())
    if len({record.record_ref for record in request.recovery_records}) != len(request.recovery_records):
        raise AlignmentPrerequisite('RECOVERY_RECORD_IDENTITIES_NOT_UNIQUE')
    rows, policy_rows = [], []
    for record in request.recovery_records:
        budget.visit({'recovery_record_ref': record.record_ref})
        if record.model_ref != model.model_ref:
            continue
        if not record.sealed:
            raise AlignmentPrerequisite('ACTUAL_SEALED_RECOVERY_PROVENANCE_MISSING')
        original_current = (record.event_owner_ref == request.scope.event_owner_ref
            and record.model_revision_ref == request.scope.model_revision_ref
            and record.input_revision_ref == request.scope.evidence_revision_ref)
        revalidation_reported_current = (record.current_revalidation_ref is not None
            and record.current_model_revision_ref == request.scope.model_revision_ref
            and record.current_input_revision_ref == request.scope.evidence_revision_ref)
        current_comparison_bound = original_current or revalidation_reported_current
        _state(model, record.before_state, budget)
        _state(model, record.actual_state, budget)
        if len(set(record.required_response_refs)) != len(record.required_response_refs) or len(set(record.covered_response_refs)) != len(record.covered_response_refs):
            raise AlignmentPrerequisite('RECOVERY_RESPONSE_IDENTITIES_NOT_UNIQUE')
        for ref in (*record.required_response_refs, *record.covered_response_refs):
            budget.visit({'recovery_record_ref': record.record_ref, 'response_ref': ref})
        pending = [record.policy_payload]
        while pending:
            value = pending.pop()
            budget.visit({'recovery_policy_record_ref': record.record_ref})
            if isinstance(value, FrozenMap):
                pending.extend(value[key] for key in reversed(sorted(value)))
            elif isinstance(value, tuple):
                pending.extend(reversed(value))
        physical_unchanged = (record.before_state.boards == record.actual_state.boards
            and record.before_state.active_board_ref == record.actual_state.active_board_ref
            and record.before_state.access_evidence_ref == record.actual_state.access_evidence_ref
            and record.before_state.wins == record.actual_state.wins
            and record.before_state.disqualified == record.actual_state.disqualified)
        reset_expected, reset_matches, reset_unknown = None, None, None
        if record.primitive.kind_ref == 'reset':
            if model.reset_law_ref == 'advertised_but_ignored':
                if model.reset_cost is None or model.ignored_reset_lifecycle_ref not in ('debit_and_exhaustion', 'debit_without_verdict'):
                    reset_unknown = 'IGNORED_RESET_LIFECYCLE_OR_COST_MISSING'
                else:
                    reserve = max(0, record.before_state.reserve - model.reset_cost)
                    reset_expected = record.before_state.model_copy(update={'reserve': reserve,
                        'terminated': record.before_state.terminated or reserve == 0 and model.ignored_reset_lifecycle_ref == 'debit_and_exhaustion'})
            elif model.reset_law_ref == 'declared_exact_restoration':
                if model.reset_state is None or model.reset_cost is None:
                    reset_unknown = 'EXACT_RESET_RESTORATION_OR_COST_MISSING'
                else:
                    reset_expected = model.reset_state
            else:
                reset_unknown = 'ACTUAL_RESET_PROTOCOL_LAW_MISSING'
            if reset_expected is not None:
                reset_matches = reset_expected == record.actual_state
        complete_coverage = (record.response_domain_complete and bool(record.required_response_refs)
            and set(record.required_response_refs) == set(record.covered_response_refs))
        deterministic = (model.reply_tie_ref == 'first_source_order'
            and model.reply_policy_ref in ('all_legal_replies', 'immediate_win_then_block_then_all_equal', 'optimal_opponent_outcome_ties')
            and len(set(model.reply_order)) == len(model.reply_order)
            and all(set(rule.cell_domain) <= set(model.reply_order) for rule in model.rules))
        policy_rows.append(d_map({'record_ref': record.record_ref, 'policy_return_ref': record.policy_return_ref,
            'policy_payload': record.policy_payload, 'evidence_ref': record.evidence_ref,
            'model_ref': record.model_ref, 'model_revision_ref': record.model_revision_ref,
            'response_quantifier_ref': record.response_quantifier_ref,
            'required_response_refs': record.required_response_refs, 'covered_response_refs': record.covered_response_refs,
            'complete_reported_response_coverage': complete_coverage,
            'universal_policy_evidence_candidate': current_comparison_bound and record.policy_return_ref is not None
                and bool(record.policy_payload) and record.response_quantifier_ref == 'FORALL' and complete_coverage,
            'policy_scope_ref': 'CURRENT_SUPPLIED_MODEL_ONLY',
            'new_scene_native_coordinates_or_word_released': False,
            'canonical_policy_qualification_or_use_proved': False}))
        rows.append(d_map({'record_ref': record.record_ref, 'evidence_ref': record.evidence_ref,
            'event_owner_ref': record.event_owner_ref, 'actual_reset_input': record.primitive.kind_ref == 'reset',
            'original_provenance_current': original_current,
            'reported_current_revalidation_ref': record.current_revalidation_ref,
            'reported_current_revalidation_matches_revisions': revalidation_reported_current,
            'current_comparison_bound': current_comparison_bound,
            'reset_law_ref': model.reset_law_ref if record.primitive.kind_ref == 'reset' else None,
            'observed_physical_state_unchanged': physical_unchanged,
            'whole_current_state_equals_prior_attempt_start': request.state == record.before_state,
            'whole_current_state_equals_prior_attempt_end': request.state == record.actual_state,
            'expected_reset_state': reset_expected, 'actual_reset_matches_supplied_contract': reset_matches,
            'reset_unknown_prerequisite': reset_unknown,
            'deterministic_reply_under_supplied_model': deterministic,
            'same_declared_deterministic_start_can_repeat': current_comparison_bound and deterministic
                and request.state == record.before_state,
            'different_initial_state_is_not_information_gain_proof': True,
            'reason_and_action_relevance_owned_by_source_drm': True}))
    if not rows:
        raise AlignmentPrerequisite('RECOVERY_RECORD_FOR_THIS_RETAINED_MODEL_MISSING')
    return {'recovery_record_comparisons': tuple(rows),
        'retained_policy_evidence_candidates': tuple(policy_rows) if request.mode_ref == 'RETAIN' else (),
        'requested_recovery_mode_ref': request.mode_ref, 'reset_simulation_or_action_dispatched': False,
        'canonical_memory_mutation_or_action_release': False}


def _compare(model, request, budget):
    if not request.observations:
        raise AlignmentPrerequisite('WHOLE_SEALED_BOARD_REPLY_ACCESS_QUOTA_PACKETS_REQUIRED')
    rows, first = [], None
    for index, sample in enumerate(request.observations):
        budget.visit({'packet_index': index})
        if sample.get('sealed') is not True or sample.get('event_owner_ref') != request.scope.event_owner_ref:
            raise AlignmentPrerequisite('ALIGNMENT_PACKET_OWNER_OR_SEAL_MISMATCH')
        if any(sample.get(key) is None for key in ('before_state', 'primitive', 'actual_state', 'official_boundary')):
            raise AlignmentPrerequisite('PLAYER_INPUT_WHOLE_STATE_AND_OFFICIAL_BOUNDARY_REQUIRED')
        before = AlignmentState.model_validate(sample['before_state'])
        actual = AlignmentState.model_validate(sample['actual_state'])
        primitive = AlignmentInput.model_validate(sample['primitive'])
        _state(model, actual, budget)
        expected = _external(model, before, primitive, request, budget)
        compatible = tuple(ordinal for ordinal, response in enumerate(expected['responses']) if response['state'] == d_map(actual))
        if first is None and not compatible:
            first = index
        boundary = sample['official_boundary']
        if boundary.get('changed') is True and sample.get('next_scene_observation') is None:
            raise AlignmentPrerequisite('NEXT_SCENE_OBSERVATION_AFTER_OFFICIAL_BOUNDARY_REQUIRED')
        rows.append(d_map({'packet_index': index, 'compatible_response_indices': compatible,
            'player_placement': primitive.cell, 'actual_board_level_state': actual,
            'retained_response_domain': expected['responses'], 'official_boundary': boundary,
            'next_scene_observation': sample.get('next_scene_observation'),
            'stale_display_evidence': sample.get('stale_display_evidence'),
            'repeated_glyph_frames_not_multiple_turns': True, 'authoritative_completion_not_overridden_by_hud': True}))
    return {'sealed_alignment_comparisons': tuple(rows), 'first_divergence_index': first}


def measure_finite_alignment_game(request: FiniteAlignmentRequest) -> DMechanicalResult:
    rejected = d_validate_request(request)
    if rejected is not None:
        return rejected
    budget, rows, current_model_ref = DWorkBudget(request), [], None
    operation = request.operation_ref.rsplit('.', 1)[-1]
    try:
        if operation == 'layout_measure':
            return d_result(request, 'OK', 'EXACT_CURRENT_INDEXED_BOARD_LAYOUTS',
                values=_layout_measure(request, budget), complete=True, examined=budget.examined)
        if operation == 'sequential_objective':
            from .alignment_level_composition_d import compose_alignment_level_domain
            values, status, cause = compose_alignment_level_domain(request, budget)
            budget.finish()
            return d_result(request, status, cause, values=values,
                complete=status == 'OK', examined=budget.examined)
        if operation == 'cost_risk_compare':
            values = _risk(request, budget)
            budget.finish()
            return d_result(request, 'OK', 'EXACT_SCOPED_COST_RISK_COMPARISON', values=values, complete=True, examined=budget.examined)
        if not request.models or request.state is None:
            raise AlignmentPrerequisite('SCOPED_DIRECT_ALIGNMENT_MODELS_AND_CURRENT_LEVEL_STATE_REQUIRED')
        rows = d_resume_rows(request, tuple(model.model_ref for model in request.models))
        for model in request.models[len(rows):]:
            current_model_ref = model.model_ref
            budget.visit({'model_ref': model.model_ref})
            if operation == 'control_scope':
                row = _scope(model, request.state, budget)
            elif operation == 'tactical_domain':
                row = _tactical(model, request, budget)
            elif operation == 'reply_model':
                row = _reply_domain(model, request, budget)
            elif operation == 'position_value':
                row = _board_value(model, request, budget)
            elif operation == 'click_compile':
                row = _compile(model, request, budget)
            elif operation == 'transaction_reconcile':
                row = _compare(model, request, budget)
            elif operation == 'recovery_memory':
                row = _recovery(model, request, budget)
            elif operation == 'external_primitive':
                if request.primitive is None:
                    raise AlignmentPrerequisite('BOUND_ACTUAL_DIRECT_PLACEMENT_INPUT_REQUIRED')
                row = _external(model, request.state, request.primitive, request, budget)
            else:
                return d_result(request, 'NEEDS_EVIDENCE', 'MISSING_IMPLEMENTATION', examined=budget.examined)
            rows.append(d_map({'model_ref': model.model_ref, 'result': d_map(row)}))
        budget.finish()
        return d_result(request, 'OK', 'EXACT_SCOPED_FINITE_ALIGNMENT', values={'model_correlated_results': tuple(rows)}, complete=True, examined=budget.examined)
    except AlignmentPrerequisite as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref))
    except DResumeMismatch as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined)
    except DComputationInterrupted as error:
        return d_result(request, 'BOUND_REACHED', error.cause, examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref, error.frontier))
