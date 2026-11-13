"""Exact supplied loom laws: complementary material is not visible equality.

No role acquisition, action selection, route search or cognitive publication.
Palettes and every hidden prefix survive recoloring and immutable transport.
"""
from __future__ import annotations

from itertools import product
from typing import ClassVar
from pydantic import Field

from agents.yf_arc3_v5.capabilities.contracts import FrameGrid
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref
from .mechanical_family_contracts_d import (
    DMechanicalRequest, DMechanicalResult, DWorkBudget, DComputationInterrupted,
    DResumeMismatch, d_validate_request, d_result, d_resume_rows, d_resumable_frontier, d_map,
)
from .prefix_query_contracts_c import (PrefixLayoutElementC, PrefixScheduleThreadC,
    PrefixFocusQuestionC, PrefixQueryCheckpointC)
from .mechanical_common_contracts_c import SearchDomainInputC

Point = tuple[int, int]


class PrefixThread(FrozenModel):
    thread_ref: Ref
    axis_ref: Ref
    crossings: tuple[Point, ...] = Field(min_length=1, max_length=128)
    color_domain: tuple[int, ...] = Field(min_length=1, max_length=16)
    palette_support_refs: tuple[Ref, ...] = Field(min_length=1, max_length=16)


class PrefixMaterial(FrozenModel):
    thread_ref: Ref
    color: int = Field(ge=0, le=255)
    palette: tuple[int, ...] = Field(min_length=1, max_length=16)
    layers: tuple[int, ...] = Field(default=(), max_length=128)


class PrefixCommitment(FrozenModel):
    """Immutable inserted layers, without asserting unmeasured control clocks."""
    thread_ref: Ref
    layers: tuple[int, ...] = Field(default=(), max_length=128)


class PrefixState(FrozenModel):
    threads: tuple[PrefixMaterial, ...] = Field(min_length=1, max_length=32)
    active_thread_ref: Ref | None
    reserve: int = Field(ge=0)
    terminated: bool


class PrefixModel(FrozenModel):
    model_ref: Ref
    threads: tuple[PrefixThread, ...] = Field(min_length=2, max_length=32)
    target: FrameGrid
    target_origin: Point
    target_evidence_ref: Ref
    topology_evidence_ref: Ref
    layer_law_ref: Ref
    palette_law_ref: Ref | None = None
    # Axis, native direction and intended layer are supplied together.
    direction_layers: tuple[tuple[Ref, Point, int], ...] = Field(default=(), max_length=8)
    empty_value: int = Field(ge=0, le=255)
    input_costs: tuple[tuple[Ref, int], ...] = Field(default=(), max_length=8)
    terminal_order_ref: Ref | None = None
    full_input_check_law_ref: Ref | None = None
    reset_state: PrefixState | None = None
    reset_cost: int | None = Field(default=None, ge=0)


class PrefixInput(FrozenModel):
    kind_ref: Ref
    thread_ref: Ref | None = None
    palette_index: int | None = Field(default=None, ge=0, le=15)
    delta: Point | None = None


class PrefixBinding(FrozenModel):
    kind_ref: Ref
    thread_ref: Ref | None = None
    support_ref: Ref | None = None
    delta: Point | None = None
    color: int | None = Field(default=None, ge=0, le=255)
    action_ref: Ref
    payload: FrozenMap
    evidence_revision_ref: Ref


_CASES = (
    ('layout_measure', ('MEASURE',)), ('palette_correspondence', ('CORRESPOND',)),
    ('axis_conditioned_command', ('PREDICT',)), ('occlusion_preimages', ('INVERSE_DOMAIN',)),
    ('complementary_insertion', ('STEP',)), ('projection_and_coverage', ('MATCH',)),
    ('prefix_schedule', ('DOMAIN', 'SEARCH')), ('fixed_layer_repair', ('INVERSE_DOMAIN',)),
    ('palette_action_protocol', ('COMPILE', 'COMPARE')), ('construction_focus', ('RETAIN', 'PROBE')),
    ('external_primitive', ('STEP',)),
)


class LayeredPrefixRequest(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.layered_prefix_request.v1'
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = tuple(
        (f'mechanics.layered_prefix_construction.{operation}', mode)
        for operation, modes in _CASES for mode in modes)
    models: tuple[PrefixModel, ...] = Field(default=(), max_length=32)
    state: PrefixState | None = None
    prefix_commitments: tuple[PrefixCommitment, ...] = Field(default=(), max_length=32)
    primitive: PrefixInput | None = None
    words: tuple[tuple[PrefixInput, ...], ...] = Field(default=(), max_length=3)
    bindings: tuple[PrefixBinding, ...] = Field(default=(), max_length=4096)
    layout_elements: tuple[PrefixLayoutElementC, ...] = Field(default=(), max_length=4096)
    schedule_threads: tuple[PrefixScheduleThreadC, ...] = Field(default=(), max_length=32)
    schedule_clock_contract_ref: Ref | None = None
    schedule_commutation_evidence_refs: tuple[Ref, ...] = ()
    focus_questions: tuple[PrefixFocusQuestionC, ...] = Field(default=(), max_length=4096)
    query_checkpoint: PrefixQueryCheckpointC | None = None
    schedule_query: SearchDomainInputC | None = None


class PrefixPrerequisite(Exception):
    pass


def _topology(model, budget):
    if model.layer_law_ref != 'binary_complementary_layers_top_is_one':
        raise PrefixPrerequisite('EXACT_OVER_UNDER_COMPLEMENT_LAW_MISSING')
    if model.target.height * model.target.width > budget.request.domain_bound:
        raise DComputationInterrupted('TARGET_SUPPORT_DOMAIN_BOUND', d_map())
    threads, cells = {}, {}
    for thread in model.threads:
        budget.visit({'thread_ref': thread.thread_ref})
        if thread.thread_ref in threads or thread.axis_ref not in ('horizontal', 'vertical'):
            raise PrefixPrerequisite('THREAD_IDENTITIES_OR_AXES_NOT_VALID')
        if len(set(thread.crossings)) != len(thread.crossings):
            raise PrefixPrerequisite('ORDERED_PREFIX_HAS_REPEATED_CROSSING')
        fixed_axis = 0 if thread.axis_ref == 'horizontal' else 1
        if len({cell[fixed_axis] for cell in thread.crossings}) != 1:
            raise PrefixPrerequisite('THREAD_CROSSINGS_DO_NOT_SHARE_DECLARED_AXIS')
        if (len(set(thread.color_domain)) != len(thread.color_domain)
                or any(not 0 <= color <= 255 for color in thread.color_domain)
                or len(thread.palette_support_refs) != len(thread.color_domain)
                or len(set(thread.palette_support_refs)) != len(thread.palette_support_refs)):
            raise PrefixPrerequisite('FINITE_PALETTE_DOMAIN_OR_NATIVE_SUPPORTS_INVALID')
        threads[thread.thread_ref] = thread
        for index, cell in enumerate(thread.crossings):
            budget.visit({'thread_ref': thread.thread_ref, 'prefix_index': index})
            cells.setdefault(cell, []).append((thread.thread_ref, index, thread.axis_ref))
    if len(cells) > budget.request.domain_bound:
        raise DComputationInterrupted('CROSSING_DOMAIN_BOUND', d_map())
    target_cells = {(model.target_origin[0] + row, model.target_origin[1] + column)
        for row in range(model.target.height) for column in range(model.target.width)}
    if set(cells) != target_cells or any(len(cells[cell]) != 2
            or {part[2] for part in cells[cell]} != {'horizontal', 'vertical'} for cell in sorted(cells)):
        raise PrefixPrerequisite('CURRENT_TWO_THREAD_CROSSING_TO_TARGET_TOPOLOGY_MISSING')
    return threads, cells


def _material(model, state, budget):
    threads, cells = _topology(model, budget)
    material = {}
    for item in state.threads:
        budget.visit({'material_thread_ref': item.thread_ref})
        if item.thread_ref not in threads or item.thread_ref in material:
            raise PrefixPrerequisite('FULL_MATERIAL_IDENTITIES_NOT_VALID')
        thread = threads[item.thread_ref]
        if (len(item.layers) > len(thread.crossings) or any(layer not in (0, 1) for layer in item.layers)
                or len(item.palette) != len(thread.color_domain) or set(item.palette) != set(thread.color_domain)
                or item.color not in thread.color_domain):
            raise PrefixPrerequisite('PREFIX_PALETTE_OR_COLOR_OUTSIDE_DECLARED_DOMAIN')
        material[item.thread_ref] = item
    if set(material) != set(threads) or (state.active_thread_ref is not None and state.active_thread_ref not in threads):
        raise PrefixPrerequisite('FULL_THREAD_STATE_OR_SELECTION_MISSING')
    for cell in sorted(cells):
        layers = tuple(material[ref].layers[index] for ref, index, _ in cells[cell]
            if index < len(material[ref].layers))
        if len(layers) == 2 and layers[0] == layers[1]:
            raise PrefixPrerequisite('EXISTING_MATERIAL_VIOLATES_COMPLEMENTARITY')
    return threads, cells, material


def _projection(model, state, budget):
    threads, cells, material = _material(model, state, budget)
    raster, owners, mismatches, deficits = [], [], [], []
    for row in range(model.target.height):
        values = []
        for column in range(model.target.width):
            cell = model.target_origin[0] + row, model.target_origin[1] + column
            budget.visit({'projection_cell': cell})
            present = tuple((material[ref].layers[index], ref) for ref, index, _ in cells[cell]
                if index < len(material[ref].layers))
            owner = max(present)[1] if present else None
            value = material[owner].color if owner is not None else model.empty_value
            values.append(value)
            owners.append((cell, owner))
            if value != model.target.rows[row][column]:
                mismatches.append(cell)
        raster.append(tuple(values))
    for ref in sorted(threads):
        remaining = len(threads[ref].crossings) - len(material[ref].layers)
        if remaining:
            deficits.append((ref, remaining))
    return {'raster': tuple(raster), 'visible_owners': tuple(owners),
        'mismatch_cells': tuple(mismatches), 'coverage_deficits': tuple(deficits),
        'visible_match': not mismatches, 'full_coverage': not deficits,
        'joint_completion': not mismatches and not deficits}


def _decode(model, state, primitive, budget):
    threads, _, material = _material(model, state, budget)
    if (primitive.kind_ref != 'insert' or primitive.thread_ref is not None or primitive.palette_index is not None
            or primitive.delta not in ((-1, 0), (1, 0), (0, -1), (0, 1))):
        raise PrefixPrerequisite('BOUND_CARDINAL_INSERTION_INPUT_MISSING')
    if state.active_thread_ref is None:
        return {'refusal_cause': 'NO_THREAD_SELECTED', 'thread_ref': None}
    thread = threads[state.active_thread_ref]
    matches = tuple(layer for axis, delta, layer in model.direction_layers
        if axis == thread.axis_ref and delta == primitive.delta)
    if len(set((axis, delta) for axis, delta, _ in model.direction_layers)) != len(model.direction_layers):
        raise PrefixPrerequisite('AXIS_DIRECTION_RELATION_NOT_FUNCTIONAL')
    if not model.direction_layers or any(layer not in (0, 1) or axis not in ('horizontal', 'vertical')
            or delta not in ((-1, 0), (1, 0), (0, -1), (0, 1))
            or (axis == 'horizontal' and delta[0] != 0) or (axis == 'vertical' and delta[1] != 0)
            for axis, delta, layer in model.direction_layers):
        raise PrefixPrerequisite('AXIS_CONDITIONED_LAYER_LAW_INVALID')
    compatible = primitive.delta[0] == 0 if thread.axis_ref == 'horizontal' else primitive.delta[1] == 0
    if not compatible:
        return {'refusal_cause': 'WRONG_AXIS', 'thread_ref': thread.thread_ref}
    if len(matches) != 1:
        raise PrefixPrerequisite('CURRENT_AXIS_DIRECTION_LAYER_NOT_DECLARED')
    index = len(material[thread.thread_ref].layers)
    if index == len(thread.crossings):
        return {'refusal_cause': 'THREAD_EXHAUSTED', 'thread_ref': thread.thread_ref}
    return {'refusal_cause': None, 'thread_ref': thread.thread_ref,
        'prefix_index': index, 'cell': thread.crossings[index], 'layer': matches[0],
        'retraction': False}


def _insert(model, state, primitive, budget):
    command = _decode(model, state, primitive, budget)
    if command['refusal_cause'] is not None:
        return {'state': state, 'command': command, 'material_changed': False, 'partner_reservation': None}
    _, cells, material = _material(model, state, budget)
    partner_ref, partner_index, _ = next(part for part in cells[command['cell']] if part[0] != command['thread_ref'])
    partner = material[partner_ref]
    layer = command['layer']
    reservation = d_map({'thread_ref': partner_ref, 'prefix_index': partner_index,
        'required_layer': 1 - layer, 'cell': command['cell']})
    if partner_index < len(partner.layers) and partner.layers[partner_index] != 1 - layer:
        return {'state': state, 'command': command, 'material_changed': False,
            'refusal_cause': 'COUNTERPART_NOT_COMPLEMENTARY', 'partner_reservation': reservation}
    changed = tuple(item.model_copy(update={'layers': item.layers + (layer,)})
        if item.thread_ref == command['thread_ref'] else item for item in state.threads)
    after = state.model_copy(update={'threads': changed})
    check = _projection(model, after, budget)
    return {'state': after, 'command': command, 'material_changed': True,
        'refusal_cause': None, 'partner_reservation': reservation,
        'full_coverage_check_due': check['full_coverage'], 'projection_and_coverage': d_map(check)}


def _click(model, state, primitive, budget):
    threads, _, material = _material(model, state, budget)
    if model.palette_law_ref != 'chosen_color_moves_to_end':
        raise PrefixPrerequisite('MOVE_TO_END_PALETTE_LAW_MISSING')
    if primitive.kind_ref != 'click' or primitive.delta is not None or primitive.thread_ref not in threads or primitive.palette_index is None:
        raise PrefixPrerequisite('CURRENT_THREAD_PALETTE_CLICK_NOT_BOUND')
    current = material[primitive.thread_ref]
    if primitive.palette_index >= len(current.palette):
        raise PrefixPrerequisite('PALETTE_INDEX_OUTSIDE_CURRENT_SUPPORT')
    color = current.palette[primitive.palette_index]
    palette = tuple(value for value in current.palette if value != color) + (color,)
    updated = current.model_copy(update={'color': color, 'palette': palette})
    after = state.model_copy(update={'threads': tuple(updated if item.thread_ref == current.thread_ref else item
        for item in state.threads), 'active_thread_ref': current.thread_ref})
    return {'state': after, 'thread_ref': current.thread_ref,
        'color_before': current.color, 'color_after': color,
        'current_support_color_map': tuple(zip(threads[current.thread_ref].palette_support_refs, palette)),
        'recolored_material_cells': threads[current.thread_ref].crossings[:len(current.layers)],
        'material_prefix_unchanged': True}


def _inverse(model, request, budget, fixed):
    threads, cells = _topology(model, budget)
    refs = tuple(sorted(threads))
    committed = {}
    if request.state is not None:
        _, _, supplied = _material(model, request.state, budget)
        committed.update({ref:item.layers for ref,item in sorted(supplied.items())})
    seen = set()
    for item in request.prefix_commitments:
        if (item.thread_ref not in threads or item.thread_ref in seen
                or len(item.layers) > len(threads[item.thread_ref].crossings)
                or any(bit not in (0,1) for bit in item.layers)):
            raise PrefixPrerequisite('SCOPED_PREFIX_COMMITMENTS_NOT_VALID')
        seen.add(item.thread_ref)
        prior = committed.get(item.thread_ref, ())
        if prior[:len(item.layers)] != item.layers[:len(prior)]:
            raise PrefixPrerequisite('PREFIX_COMMITMENT_SOURCES_DISAGREE')
        if len(item.layers) > len(prior):
            committed[item.thread_ref] = item.layers
    for cell in sorted(cells):
        bits = tuple(committed[ref][index] for ref,index,_ in cells[cell]
                     if index < len(committed.get(ref,())))
        if len(bits) == 2 and bits[0] == bits[1]:
            raise PrefixPrerequisite('EXISTING_MATERIAL_VIOLATES_COMPLEMENTARITY')
    if fixed:
        if request.state is None:
            raise PrefixPrerequisite('CURRENT_FIXED_MATERIAL_MISSING')
        _, _, material = _material(model, request.state, budget)
        if any(len(material[ref].layers) != len(threads[ref].crossings) for ref in refs):
            raise PrefixPrerequisite('FULL_FIXED_LAYER_REPAIR_REQUIRES_COMPLETED_COVERAGE')
    # Topology, target pixels and committed layers are constant throughout this
    # invocation. Only the proposed palette changes between assignments.
    crossing_queries = tuple((cell,
        model.target.rows[cell[0] - model.target_origin[0]][cell[1] - model.target_origin[1]],
        tuple(owner for owner, _, _ in cells[cell]
            if all(index >= len(committed.get(ref, ()))
                or committed[ref][index] == int(ref == owner)
                for ref,index,_ in cells[cell]))) for cell in sorted(cells))
    rows, examined = [], 0
    crossing_results = {}
    for colors in product(*(threads[ref].color_domain for ref in refs)):
        budget.visit({'global_color_assignment_index': examined})
        if examined >= request.domain_bound:
            raise DComputationInterrupted('GLOBAL_COLOR_DOMAIN_BOUND', d_map({'assignment_index': examined}))
        examined += 1
        mapping, local, valid = dict(zip(refs, colors)), [], True
        for cell, target, compatible_owners in crossing_queries:
            budget.visit({'assignment_index': examined - 1, 'crossing': cell})
            owners = tuple(owner for owner in compatible_owners if mapping[owner] == target)
            if not owners:
                valid = False
                break
            local.append((cell, owners))
        if valid:
            # Failed palettes need no immutable result tree. Materialize only
            # complete worlds, retaining the original cell and owner ordering.
            # With exactly two owners there are at most three nonempty owner
            # domains per crossing. Share only these immutable local subtrees.
            crossing_domains = []
            for cell, owners in local:
                key = (cell, owners)
                if key not in crossing_results:
                    crossing_results[key] = d_map({'cell': cell, 'top_owner_domain': owners,
                        'complementary_layer_domain': tuple(tuple((ref, int(ref == owner))
                            for ref, _, _ in cells[cell]) for owner in owners)})
                crossing_domains.append(crossing_results[key])
            rows.append(d_map({'global_thread_colors': tuple(zip(refs, colors)),
                'crossing_domains': tuple(crossing_domains), 'existing_layers_held_fixed': any(committed.values())}))
    return {'coherent_global_solutions': tuple(rows), 'examined_global_assignments': examined,
        'exhaustive_in_declared_color_domain': True, 'minimum_cost_claimed': False,
        'restoration_required_in_declared_domain': any(committed.values()) and not rows,
        'restoration_contract_available': model.reset_state is not None and model.reset_cost is not None}


def _external(model, state, primitive, request, budget):
    _material(model, state, budget)
    if primitive.kind_ref == 'reset':
        if primitive.thread_ref is not None or primitive.palette_index is not None or primitive.delta is not None:
            raise PrefixPrerequisite('RESET_HAS_UNBOUND_EXTRA_COMMAND_FIELDS')
        if model.reset_state is None or model.reset_cost is None:
            raise PrefixPrerequisite('INDEPENDENT_RESET_STATE_AND_COST_MISSING')
        _material(model, model.reset_state, budget)
        return {'before_state': state, 'state': model.reset_state, 'primitive_complete': True,
            'phase_snapshots': d_map({'before': state, 'independent_reset': model.reset_state}),
            'closure_facts': d_map({'independent_restoration_complete': True}),
            'event_ledger': d_map({'event_owner_ref': request.scope.event_owner_ref,
                'kind_ref': 'reset', 'debit': model.reset_cost, 'automatic_pass_count': 0,
                'acceptance_checked': False, 'accepted': False})}
    if state.terminated:
        raise PrefixPrerequisite('OFFICIAL_TERMINATION_REVOKES_FURTHER_INPUTS')
    costs = dict(model.input_costs)
    if len(costs) != len(model.input_costs) or primitive.kind_ref not in costs or any(costs[key] < 0 for key in sorted(costs)):
        raise PrefixPrerequisite('CURRENT_INPUT_COST_LAW_MISSING')
    if model.full_input_check_law_ref != 'every_input_checks_if_full':
        raise PrefixPrerequisite('FULL_CONSTRUCTION_INPUT_RECHECK_LAW_MISSING')
    if model.terminal_order_ref not in ('acceptance_before_exhaustion', 'exhaustion_before_acceptance'):
        raise PrefixPrerequisite('ACCEPTANCE_EXHAUSTION_ORDER_MISSING')
    if primitive.kind_ref == 'click':
        direct = _click(model, state, primitive, budget)
    elif primitive.kind_ref == 'insert':
        direct = _insert(model, state, primitive, budget)
    else:
        raise PrefixPrerequisite('SUPPORTED_EXTERNAL_PRIMITIVE_NOT_BOUND')
    after_direct = direct['state']
    projection = _projection(model, after_direct, budget)
    reserve = max(0, state.reserve - costs[primitive.kind_ref])
    exhausted = reserve == 0
    accepted = projection['joint_completion'] and (model.terminal_order_ref == 'acceptance_before_exhaustion' or not exhausted)
    after = after_direct.model_copy(update={'reserve': reserve, 'terminated': accepted or exhausted})
    return {'before_state': state, 'state': after, 'direct_effect': d_map(direct),
        'projection_and_coverage': d_map(projection), 'primitive_complete': True,
        'phase_snapshots': d_map({'before': state, 'after_direct': after_direct,
            'after_projection': d_map({'state': after_direct, 'projection': d_map(projection)}), 'after_cost_and_verdict': after}),
        'closure_facts': d_map({'direct_complete': True, 'whole_material_projection_complete': True,
            'coverage_checked': True, 'input_cost_complete': True, 'verdict_complete': True}),
        'event_ledger': d_map({'event_owner_ref': request.scope.event_owner_ref, 'kind_ref': primitive.kind_ref,
            'debit': costs[primitive.kind_ref], 'automatic_pass_count': 1,
            'acceptance_checked': projection['full_coverage'], 'accepted': accepted, 'exhausted': exhausted,
            'second_automatic_pass_forbidden': True, 'second_debit_forbidden': True})}


def _correspond(model, request, budget):
    if not request.observations:
        raise PrefixPrerequisite('SEALED_PALETTE_CORRESPONDENCE_EVIDENCE_MISSING')
    rows = []
    for index, sample in enumerate(request.observations):
        budget.visit({'sealed_sample_index': index})
        if sample.get('sealed') is not True or sample.get('event_owner_ref') != request.scope.event_owner_ref:
            raise PrefixPrerequisite('SEALED_PALETTE_OWNER_MISMATCH')
        if any(sample.get(key) is None for key in ('before_state', 'primitive', 'after_direct_state')):
            raise PrefixPrerequisite('OBSERVED_DIRECT_PALETTE_AND_MATERIAL_STATE_MISSING')
        before = PrefixState.model_validate(sample['before_state'])
        primitive = PrefixInput.model_validate(sample['primitive'])
        actual = PrefixState.model_validate(sample['after_direct_state'])
        if primitive.kind_ref != 'click':
            raise PrefixPrerequisite('PALETTE_CORRESPONDENCE_REQUIRES_CLICK')
        predicted = _click(model, before, primitive, budget)
        _material(model, actual, budget)
        expected = predicted['state']
        actual_map = {item.thread_ref: d_map(item) for item in actual.threads}
        expected_map = {item.thread_ref: d_map(item) for item in expected.threads}
        rows.append(d_map({'sample_index': index, 'direct_palette_and_material_match': actual_map == expected_map,
            'selected_owner_matches': actual.active_thread_ref == expected.active_thread_ref,
            'predicted_global_recolor_delta': d_map(predicted), 'observation_is_not_model_projection': True}))
    return {'palette_correspondence_constraints': tuple(rows)}


def _protocol(model, request, budget):
    if request.mode_ref == 'COMPARE':
        if not request.observations:
            raise PrefixPrerequisite('SEALED_FULL_PACKET_COMPARISON_MISSING')
        rows, first = [], None
        for index, sample in enumerate(request.observations):
            budget.visit({'packet_index': index})
            if sample.get('sealed') is not True or sample.get('event_owner_ref') != request.scope.event_owner_ref:
                raise PrefixPrerequisite('PACKET_OWNER_OR_SEAL_MISMATCH')
            if any(sample.get(key) is None for key in ('actual_state', 'expected_state', 'final_read_raster', 'scene_transition_ref')):
                raise PrefixPrerequisite('ACTUAL_EXPECTED_FINAL_READ_AND_SCENE_BOUNDARY_MISSING')
            actual = PrefixState.model_validate(sample['actual_state'])
            expected = PrefixState.model_validate(sample['expected_state'])
            next_scene = sample.get('next_scene_observation')
            if sample['scene_transition_ref'] != 'no_scene_transition' and next_scene is None:
                raise PrefixPrerequisite('NEXT_SCENE_OBSERVATION_MISSING_AFTER_BOUNDARY')
            _material(model, actual, budget)
            check = _projection(model, expected, budget)
            different = {item.thread_ref: d_map(item) for item in actual.threads} != {item.thread_ref: d_map(item) for item in expected.threads}
            controls = tuple(key for key in ('active_thread_ref', 'reserve', 'terminated') if getattr(actual, key) != getattr(expected, key))
            raster_matches = tuple(tuple(row) for row in sample['final_read_raster']) == check['raster']
            if first is None and (different or controls or not raster_matches):
                first = index
            rows.append(d_map({'packet_index': index, 'material_and_palette_match': not different,
                'control_difference_fields': controls, 'observed_final_read_matches_prediction': raster_matches,
                'scene_transition_ref': sample['scene_transition_ref'],
                'next_scene_observation': next_scene,
                'old_material_is_not_next_scene_authority': True, 'repeated_frames_are_not_inputs': True}))
        return {'sealed_comparisons': tuple(rows), 'first_divergence_index': first}
    if request.state is None or not request.words:
        raise PrefixPrerequisite('CURRENT_MATERIAL_AND_SOURCE_WORDS_MISSING')
    threads, _, _ = _material(model, request.state, budget)
    rows = []
    for word in request.words:
        if len(word) > request.depth_bound:
            raise DComputationInterrupted('PREFIX_WORD_PRIMITIVE_BOUND', d_map())
        current, native, effects, cost = request.state, [], [], 0
        for primitive in word:
            budget.visit({'word_primitive_index': len(native)})
            support, color = None, None
            if primitive.kind_ref == 'click':
                material = {item.thread_ref: item for item in current.threads}
                if primitive.thread_ref not in threads or primitive.palette_index is None or primitive.palette_index >= len(material[primitive.thread_ref].palette):
                    raise PrefixPrerequisite('PREDICTED_CURRENT_PALETTE_CLICK_NOT_BOUND')
                support = threads[primitive.thread_ref].palette_support_refs[primitive.palette_index]
                color = material[primitive.thread_ref].palette[primitive.palette_index]
            matches = tuple(binding for binding in request.bindings
                if binding.kind_ref == primitive.kind_ref and binding.thread_ref == primitive.thread_ref
                and binding.delta == primitive.delta and binding.support_ref == support and binding.color == color
                and binding.evidence_revision_ref == request.scope.evidence_revision_ref)
            if len(matches) != 1:
                raise PrefixPrerequisite('CURRENT_OR_CERTIFIED_PREDICTED_NATIVE_BINDING_NOT_UNIQUE')
            image = _external(model, current, primitive, request, budget)
            current = image['state']
            native.append(d_map({'action_ref': matches[0].action_ref, 'payload': matches[0].payload,
                'support_ref': support, 'predicted_current_color': color}))
            effects.append(d_map(image))
            cost += image['event_ledger']['debit']
            if current.terminated:
                break
        rows.append(d_map({'native_word': tuple(native), 'sealed_effects': tuple(effects),
            'state': current, 'expanded_input_cost': cost, 'terminal_prefix': current.terminated,
            'no_intermediate_reconciliation': True, 'primitive_release_authorized': False}))
    return {'compiled_words': tuple(rows)}


def measure_layered_prefix_construction(request: LayeredPrefixRequest) -> DMechanicalResult:
    rejected = d_validate_request(request)
    if rejected is not None:
        return rejected
    budget, rows, current_model_ref = DWorkBudget(request), [], None
    operation = request.operation_ref.rsplit('.', 1)[-1]
    try:
        if operation in ('layout_measure', 'prefix_schedule', 'construction_focus'):
            from .prefix_query_c import dispatch_prefix_queries
            return dispatch_prefix_queries(request)
        if not request.models:
            raise PrefixPrerequisite('SCOPED_PREFIX_MODELS_MISSING')
        rows = d_resume_rows(request, tuple(model.model_ref for model in request.models))
        for model in request.models[len(rows):]:
            current_model_ref = model.model_ref
            budget.visit({'model_ref': model.model_ref})
            if operation == 'palette_correspondence':
                row = _correspond(model, request, budget)
            elif operation in ('occlusion_preimages', 'fixed_layer_repair'):
                row = _inverse(model, request, budget, operation == 'fixed_layer_repair')
            elif operation == 'palette_action_protocol':
                row = _protocol(model, request, budget)
            else:
                if request.state is None:
                    raise PrefixPrerequisite('CURRENT_FULL_MATERIAL_STATE_MISSING')
                if operation == 'projection_and_coverage':
                    row = _projection(model, request.state, budget)
                else:
                    if request.primitive is None:
                        raise PrefixPrerequisite('SOURCE_BOUND_PREFIX_PRIMITIVE_MISSING')
                    if operation == 'axis_conditioned_command':
                        row = _decode(model, request.state, request.primitive, budget)
                    elif operation == 'complementary_insertion':
                        row = _insert(model, request.state, request.primitive, budget)
                    elif operation == 'external_primitive':
                        row = _external(model, request.state, request.primitive, request, budget)
                    else:
                        return d_result(request, 'NEEDS_EVIDENCE', 'MISSING_IMPLEMENTATION', examined=budget.examined)
            rows.append(d_map({'model_ref': model.model_ref, 'result': d_map(row)}))
        budget.finish()
        return d_result(request, 'OK', 'EXACT_SCOPED_PREFIX_COMPUTATION',
            values={'model_correlated_results': tuple(rows)}, complete=True, examined=budget.examined)
    except PrefixPrerequisite as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref))
    except DResumeMismatch as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined)
    except DComputationInterrupted as error:
        return d_result(request, 'BOUND_REACHED', error.cause, examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref, error.frontier))
