"""Finite directed program images, owned closures and relational origin preimages."""

from __future__ import annotations

from typing import ClassVar
from pydantic import Field

from agents.yf_arc3_v5.capabilities.contracts import FrameGrid
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, stable_digest
from .program_layer_contracts_d import ProgramDisplayLayout
from .program_layer_measurement_d import measure_program_display_layers_d
from .mechanical_family_contracts_d import (
    DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_result, d_validate_request,
    d_resume_rows, d_resumable_frontier, DResumeMismatch, d_measure_layers, d_map,
)


class ProgramPose(FrozenModel):
    node_ref: Ref
    memory_ref: Ref | None
    alive: bool = True
    consumed_closure_refs: tuple[Ref, ...] = Field(default=(), max_length=4096)


class FixedProgramModel(FrozenModel):
    model_ref: Ref
    nodes: tuple[Ref, ...] = Field(min_length=1, max_length=4096)
    ports: tuple[tuple[Ref, Ref, Ref | None], ...] = Field(default=(), max_length=16384)
    word: tuple[Ref, ...] = Field(default=(), max_length=4096)
    placement_nodes: tuple[Ref, ...] = Field(default=(), max_length=4096)
    placement_hits: tuple[tuple[Ref, Ref], ...] = Field(default=(), max_length=4096)
    target_nodes: tuple[Ref, ...] = Field(default=(), max_length=4096)
    hazard_nodes: tuple[Ref, ...] = Field(default=(), max_length=4096)
    repeat_nodes: tuple[Ref, ...] = Field(default=(), max_length=4096)
    neighbor_forcers: tuple[tuple[Ref, Ref, Ref], ...] = Field(default=(), max_length=4096)
    neighbor_order: tuple[Ref, ...] = Field(default=(), max_length=4096)
    effect_priority: tuple[Ref, ...] = Field(default=(), max_length=2)
    arrival_updates_memory: bool | None = None
    cancelled_updates_memory: bool | None = None
    closure_after_cancelled: bool | None = None
    closure_after_self_loop: bool | None = None
    neighbor_updates_memory: bool | None = None
    launch_memory_law: Ref | None = None
    placement_cost: int | None = Field(default=None, ge=0)
    launch_cost: int | None = Field(default=None, ge=0)
    launch_action_ref: Ref | None = None
    reset_action_ref: Ref | None = None
    reset_pose: ProgramPose | None = None
    reset_cost: int | None = Field(default=None, ge=0)


_CASES = (
    ('display_layers', ('MEASURE',)), ('placement_launch_fit', ('FIT',)),
    ('directed_port_graph', ('FIT',)), ('nominal_instruction', ('STEP_INTERNAL',)),
    ('forced_closure', ('STEP_INTERNAL',)), ('program_image', ('EVALUATE',)),
    ('safe_origin_preimages', ('INVERSE_DOMAIN',)), ('robust_origin_domain', ('DOMAIN',)),
    ('launch_word_certificate', ('COMPILE',)), ('sealed_program_compare', ('COMPARE',)),
    ('external_primitive', ('STEP',)),
)


class FixedProgramRequest(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.fixed_program_request.v1'
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = tuple((f'mechanics.fixed_program_origin.{op}', mode)
                                     for op, modes in _CASES for mode in modes)
    models: tuple[FixedProgramModel, ...] = Field(default=(), max_length=32)
    state: ProgramPose | None = None
    instruction_ref: Ref | None = None
    closure_event_ref: Ref | None = None
    action_kind: Ref | None = None
    origin_node_ref: Ref | None = None
    bound_hit_ref: Ref | None = None
    placement_inputs: tuple[tuple[Ref, Ref, FrozenMap], ...] = Field(default=(), max_length=4096)
    placement_outcome_decides_launch: bool | None = None
    observed_word: tuple[Ref, ...] | None = Field(default=None, max_length=4096)
    expected_trace: tuple[FrozenMap, ...] = Field(default=(), max_length=4096)
    memory_domain: tuple[Ref | None, ...] = Field(default=(None,), max_length=64)
    frame: FrameGrid | None = None
    layer_regions: tuple[FrozenMap, ...] = Field(default=(), max_length=256)
    frame_ref: Ref | None = None
    frame_epoch: int | None = Field(default=None, ge=0)
    display_layouts: tuple[ProgramDisplayLayout, ...] = Field(default=(), max_length=32)


class ProgramPrerequisite(Exception):
    pass


def _port(model, node, direction):
    matching = tuple(target for origin, label, target in model.ports if origin == node and label == direction)
    if len(matching) != 1:
        raise ProgramPrerequisite('DIRECTED_PORT_UNKNOWN_OR_CONTRADICTORY')
    target = matching[0]
    if target is not None and target not in model.nodes:
        raise ProgramPrerequisite('PORT_DESTINATION_OUTSIDE_MODEL')
    return target


def _nominal(model, pose, direction, budget):
    budget.visit()
    if not pose.alive:
        return pose, d_map({'event': 'inactive_hazard_state', 'before_node': pose.node_ref,
            'after_node': pose.node_ref, 'memory_after': pose.memory_ref, 'hazard': True, 'closure_enabled': False})
    if pose.node_ref not in model.nodes:
        raise ProgramPrerequisite('POSE_OUTSIDE_DIRECTED_GRAPH')
    target = _port(model, pose.node_ref, direction)
    if target is None:
        if model.cancelled_updates_memory is None or model.closure_after_cancelled is None:
            raise ProgramPrerequisite('CANCELLATION_MEMORY_OR_EFFECT_LAW_MISSING')
        following = pose.model_copy(update={'memory_ref': direction if model.cancelled_updates_memory else pose.memory_ref})
        event = d_map({'event': 'cancelled_port', 'before_node': pose.node_ref,
            'after_node': pose.node_ref, 'nominal_direction': direction,
            'memory_after': following.memory_ref, 'closure_enabled': model.closure_after_cancelled,
            'hazard': not following.alive})
        return following, event
    if model.arrival_updates_memory is None or (target == pose.node_ref and model.closure_after_self_loop is None):
        raise ProgramPrerequisite('ARRIVAL_MEMORY_OR_SELF_LOOP_EFFECT_LAW_MISSING')
    following = pose.model_copy(update={'node_ref': target,
        'memory_ref': direction if model.arrival_updates_memory else pose.memory_ref,
        'alive': pose.alive and target not in model.hazard_nodes})
    return following, d_map({'event': 'self_loop_arrival' if target == pose.node_ref else 'port_arrival',
        'before_node': pose.node_ref, 'after_node': target, 'nominal_direction': direction,
        'memory_after': following.memory_ref, 'hazard': not following.alive,
        'closure_enabled': model.closure_after_self_loop if target == pose.node_ref else True})


def _capture_pose_transition(snapshots, before, after, phase_ref, owner_ref,
        instruction_index=None, trace_event_index=None, stop_cause_ref=None):
    if snapshots is not None:
        snapshots.append(d_map({'phase_ref': phase_ref, 'owner_ref': owner_ref,
            'instruction_index': instruction_index, 'trace_event_index': trace_event_index,
            'before_pose': before, 'after_pose': after, 'stop_cause_ref': stop_cause_ref}))


def _closure(model, pose, owner, budget, pose_snapshots=None, instruction_index=None, trace_event_offset=0):
    if owner in pose.consumed_closure_refs:
        _capture_pose_transition(pose_snapshots, pose, pose, 'closure_already_consumed', owner,
            instruction_index, stop_cause_ref='OWNER_ALREADY_CONSUMED')
        return pose, (), 'OWNER_ALREADY_CONSUMED'
    visited = set()
    trace = []
    stop = 'NO_FORCER'
    for index in range(budget.request.depth_bound):
        budget.visit({'closure_owner_ref': owner, 'effect_index': index, 'pose': pose,
            'visited': tuple(sorted(visited, key=lambda item: (item[0], item[1] or ''))),
            'event_trace': tuple(trace), 'model_ref': model.model_ref})
        if not pose.alive:
            stop = 'HAZARD'
            break
        key = (pose.node_ref, pose.memory_ref)
        if key in visited:
            stop = 'REVISIT_GUARD'
            break
        visited.add(key)
        repeat = pose.node_ref in model.repeat_nodes and pose.memory_ref is not None
        neighbors = tuple((forcer, direction) for node, forcer, direction in model.neighbor_forcers if node == pose.node_ref)
        if not repeat and not neighbors:
            break
        if len(model.effect_priority) != 2 or set(model.effect_priority) != {'repeat', 'neighbor'}:
            raise ProgramPrerequisite('DECLARED_FORCED_EFFECT_PRIORITY_MISSING')
        direction = None
        effect = None
        for kind in model.effect_priority:
            if kind == 'repeat' and repeat:
                direction, effect = pose.memory_ref, kind
                break
            if kind == 'neighbor' and neighbors:
                if any(forcer not in model.neighbor_order for forcer, _ in neighbors):
                    raise ProgramPrerequisite('DECLARED_NEIGHBOR_PRIORITY_MISSING')
                by_forcer = {forcer: tuple(direction for ref, direction in neighbors if ref == forcer)
                             for forcer, _ in neighbors}
                for forcer in model.neighbor_order:
                    if forcer in by_forcer:
                        if len(by_forcer[forcer]) != 1:
                            raise ProgramPrerequisite('AMBIGUOUS_NEIGHBOR_FORCER')
                        direction, effect = by_forcer[forcer][0], kind
                        break
                break
        target = _port(model, pose.node_ref, direction)
        if target is None:
            stop = 'FORCED_PORT_ABSENT'
            break
        if effect == 'neighbor' and model.neighbor_updates_memory is None:
            raise ProgramPrerequisite('NEIGHBOR_MEMORY_LAW_MISSING')
        memory = direction if effect == 'neighbor' and model.neighbor_updates_memory else pose.memory_ref
        following = pose.model_copy(update={'node_ref': target, 'memory_ref': memory,
            'alive': pose.alive and target not in model.hazard_nodes})
        trace.append(d_map({'event': effect, 'before_node': pose.node_ref,
            'after_node': target, 'memory_after': memory, 'hazard': not following.alive,
            'effect_owner_ref': owner, 'effect_index': index}))
        _capture_pose_transition(pose_snapshots, pose, following, 'forced_transition', owner,
            instruction_index, trace_event_offset + len(trace) - 1)
        pose = following
    else:
        raise DComputationInterrupted('FORCED_EFFECT_DEPTH_BOUND', d_map({
            'owner_ref': owner, 'pose': pose, 'visited': tuple(sorted(visited, key=lambda item: (item[0], item[1] or ''))),
            'event_trace': tuple(trace)}))
    before_sealing = pose
    pose = pose.model_copy(update={'consumed_closure_refs': (*pose.consumed_closure_refs, owner)})
    _capture_pose_transition(pose_snapshots, before_sealing, pose, 'closure_sealing', owner,
        instruction_index, stop_cause_ref=stop)
    return pose, tuple(trace), stop


def _instruction_image(model, pose, direction, owner, budget, pose_snapshots=None, instruction_index=None):
    following, nominal = _nominal(model, pose, direction, budget)
    _capture_pose_transition(pose_snapshots, pose, following, 'nominal_instruction', owner,
        instruction_index, 0)
    trace = [nominal]
    if following.alive and nominal['closure_enabled']:
        following, effects, stop = _closure(model, following, owner, budget,
            pose_snapshots, instruction_index, 1)
        trace.extend(effects)
    else:
        stop = 'EFFECT_ENTRY_DISABLED' if following.alive else 'HAZARD'
    return following, tuple(trace), stop


def _program_image(model, pose, request, budget, *, capture_pose_snapshots=False):
    if request.observed_word is None or tuple(model.word) != tuple(request.observed_word):
        raise ProgramPrerequisite('DISPLAYED_FIXED_WORD_NOT_BOUND_TO_MODEL')
    if model.launch_memory_law not in ('clear_on_launch', 'preserve_on_launch'):
        raise ProgramPrerequisite('LAUNCH_DIRECTION_MEMORY_LAW_MISSING')
    if not model.target_nodes:
        raise ProgramPrerequisite('FINAL_ACCEPTANCE_NODES_MISSING')
    before_launch = pose
    pose_snapshots = [] if capture_pose_snapshots else None
    def transport(result, after_initialization):
        if capture_pose_snapshots:
            result.update({'before_state': before_launch, 'fixed_word': model.word,
                'launch_initialization_performed': bool(pose_snapshots),
                'phase_snapshots': d_map({'before': before_launch,
                    'after_launch_initialization': after_initialization,
                    'after_program': result['pose']}),
                'pose_snapshots': tuple(pose_snapshots)})
        return result
    if not pose.alive:
        return transport({'pose': pose, 'trace': (), 'word_complete': False, 'accepted': False,
                'first_failure_instruction': None, 'closure_stop': 'PREEXISTING_HAZARD'}, pose)
    pose = pose.model_copy(update={'memory_ref': None if model.launch_memory_law == 'clear_on_launch' else pose.memory_ref})
    initialized_pose = pose
    _capture_pose_transition(pose_snapshots, before_launch, pose, 'launch_initialization', request.scope.event_owner_ref)
    trace = []
    for index, direction in enumerate(model.word):
        try:
            if index >= request.depth_bound:
                raise DComputationInterrupted('PROGRAM_DEPTH_BOUND', d_map({'instruction_index': index, 'pose': pose}))
            owner = f'{request.scope.event_owner_ref}:instruction:{index}'
            pose, events, stop = _instruction_image(model, pose, direction, owner, budget,
                pose_snapshots, index)
        except (ProgramPrerequisite, DComputationInterrupted) as error:
            if capture_pose_snapshots:
                error.frontier = d_map({'before_state': before_launch, 'fixed_word': model.word,
                    'after_launch_initialization': initialized_pose, 'instruction_index': index,
                    'last_captured_pose': pose_snapshots[-1]['after_pose'] if pose_snapshots else pose,
                    'completed_instruction_trace': tuple(trace), 'pose_snapshots': tuple(pose_snapshots),
                    'interrupted_frontier': getattr(error, 'frontier', d_map()),
                    'partial_calculation_not_primitive_completion': True})
            raise
        trace.extend(FrozenMap.overlay({'instruction_index': index, 'event_index': event_index,
            'interval_ref': owner}, event) for event_index, event in enumerate(events))
        if not pose.alive:
            return transport({'pose': pose, 'trace': tuple(trace), 'word_complete': False, 'accepted': False,
                    'first_failure_instruction': index, 'closure_stop': stop}, initialized_pose)
    return transport({'pose': pose, 'trace': tuple(trace), 'word_complete': True,
        'accepted': pose.alive and pose.node_ref in model.target_nodes,
        'acceptance_checkpoint': 'whole_fixed_word_end'}, initialized_pose)


def _preimages(model, request, budget):
    # Build complete relations, not opposite-label pseudo-inverses.
    if not model.target_nodes:
        raise ProgramPrerequisite('FINAL_ACCEPTANCE_NODES_MISSING')
    if model.launch_memory_law == 'preserve_on_launch' and request.state is None:
        raise ProgramPrerequisite('PRESERVED_INITIAL_MEMORY_MISSING')
    memories = frozenset((*request.memory_domain, *model.word,
        *(label for _, label, _ in model.ports),
        *(direction for _, _, direction in model.neighbor_forcers),
        *((request.state.memory_ref,) if request.state else ())))
    ends = {(node, memory) for node in model.target_nodes for memory in memories}
    layers = [tuple(sorted(ends, key=lambda item: (item[0], item[1] or '')))]
    if len(model.word) > request.depth_bound or len(model.nodes) * len(memories) > request.domain_bound:
        raise DComputationInterrupted('INVERSE_RELATION_DOMAIN_OR_DEPTH_BOUND', d_map({
            'model_ref': model.model_ref, 'word_length': len(model.word),
            'relation_domain_size': len(model.nodes) * len(memories)}))
    for index in range(len(model.word) - 1, -1, -1):
        previous = set()
        for node in model.nodes:
            for memory in sorted(memories, key=lambda item: item or ''):
                pose = ProgramPose(node_ref=node, memory_ref=memory)
                owner = f'{request.scope.event_owner_ref}:inverse:{index}:{node}:{memory}'
                after, _, _ = _instruction_image(model, pose, model.word[index], owner, budget)
                if after.alive and (after.node_ref, after.memory_ref) in ends:
                    previous.add((node, memory))
        ends = previous
        layers.append(tuple(sorted(ends, key=lambda item: (item[0], item[1] or ''))))
    initial_memory = None if model.launch_memory_law == 'clear_on_launch' else (request.state.memory_ref if request.state else None)
    if model.launch_memory_law not in ('clear_on_launch', 'preserve_on_launch'):
        raise ProgramPrerequisite('LAUNCH_DIRECTION_MEMORY_LAW_MISSING')
    safe = tuple(node for node in model.placement_nodes if (node, initial_memory) in ends)
    return {'inverse_layers': tuple(layers), 'safe_placement_nodes': safe,
        'initial_placement_filter_applied_only_at_origin': True}


def measure_fixed_program_origin(request: FixedProgramRequest):
    rejected = d_validate_request(request)
    if rejected is not None:
        return rejected
    budget = DWorkBudget(request)
    operation = request.operation_ref.rsplit('.', 1)[-1]
    rows = []
    current_model_ref = None
    certificate_descriptors = set()
    try:
        if operation == 'display_layers':
            d_resume_rows(request, ())
            if request.display_layouts:
                values = {'display_layer_alternatives': measure_program_display_layers_d(request, budget),
                    'frame_ref': request.frame_ref, 'directed_ports_not_inferred_from_centers': True}
            else:
                values = {'layers': d_measure_layers(request, budget),
                          'directed_ports_not_inferred_from_centers': True}
        elif operation == 'placement_launch_fit':
            rows = []
            if not request.observations:
                raise ProgramPrerequisite('SEALED_PLACEMENT_LAUNCH_SAMPLES_MISSING')
            for sample in request.observations:
                budget.visit()
                if sample.get('sealed') is not True or 'before_word' not in sample or 'after_word' not in sample:
                    raise ProgramPrerequisite('SEALED_WORD_AND_INPUT_INTERVAL_MISSING')
                rows.append(d_map({'input_ref': sample.get('action_ref'),
                    'word_preserved': sample['before_word'] == sample['after_word'],
                    'marker_before': sample.get('marker_before'), 'marker_after': sample.get('marker_after'),
                    'placement_observed': sample.get('action_kind') == 'placement',
                    'launch_without_marker': sample.get('action_kind') == 'launch' and sample.get('marker_before') is None,
                    'launch_with_marker': sample.get('action_kind') == 'launch' and sample.get('marker_before') is not None,
                    'measured_cost': sample.get('input_cost')}))
            values = {'placement_launch_observations': tuple(rows), 'highlight_does_not_confirm_edit_authority': True}
        elif operation == 'sealed_program_compare':
            if not request.observations or not request.expected_trace:
                raise ProgramPrerequisite('SEALED_INTERVAL_TRACE_MISSING')
            if any(sample.get('sealed') is not True for sample in request.observations):
                raise ProgramPrerequisite('SEALED_PROGRAM_PACKET_MISSING')
            compared = []
            divergence = None
            for index, expected in enumerate(request.expected_trace):
                budget.visit()
                if not expected.get('interval_ref') or expected.get('instruction_index') is None or expected.get('event_index') is None:
                    raise ProgramPrerequisite('EXPECTED_EVENT_INTERVAL_IDENTITY_MISSING')
                matches = tuple(sample for sample in request.observations
                    if sample.get('instruction_index') == expected.get('instruction_index')
                    and sample.get('event_index') == expected.get('event_index')
                    and sample.get('interval_ref') == expected.get('interval_ref'))
                if len(matches) != 1:
                    divergence = {'expected_index': index, 'cause': 'INTERVAL_OBSERVATION_MISSING_OR_AMBIGUOUS'}
                    break
                sample = matches[0]
                mismatches = tuple(key for key in sorted(expected)
                    if key not in ('interval_ref', 'instruction_index', 'event_index', 'sealed')
                    and (key not in sample or expected[key] != sample[key]))
                compared.append((index, mismatches))
                if mismatches:
                    divergence = {'expected_index': index, 'fields': mismatches}
                    break
            values = {'first_divergence': d_map(divergence or {}), 'compared_intervals': tuple(compared),
                'earlier_contradiction_not_erased_by_final_endpoint': True}
        else:
            if not request.models:
                raise ProgramPrerequisite('SCOPED_DIRECTED_PROGRAM_MODELS_MISSING')
            rows = d_resume_rows(request, tuple(model.model_ref for model in request.models))
            if operation == 'launch_word_certificate':
                certificate_descriptors = set(stable_digest(row['result']['external_word']) for row in rows)
            for model in request.models[len(rows):]:
                current_model_ref = model.model_ref
                budget.visit()
                if len(model.nodes) > request.domain_bound or len(set(model.nodes)) != len(model.nodes):
                    raise ProgramPrerequisite('NODE_DOMAIN_OUTSIDE_BOUND_OR_DUPLICATE')
                if operation == 'directed_port_graph':
                    supports = []
                    for sample in request.observations:
                        budget.visit()
                        if sample.get('sealed') is not True or sample.get('nominal_only') is not True:
                            raise ProgramPrerequisite('SEALED_NOMINAL_PORT_EVIDENCE_MISSING')
                        if 'nominal_destination' not in sample or not sample.get('before_node') or not sample.get('instruction_ref'):
                            raise ProgramPrerequisite('NOMINAL_DESTINATION_OR_PORT_IDENTITY_MISSING')
                        matches = tuple(end for start, label, end in model.ports
                            if start == sample.get('before_node') and label == sample.get('instruction_ref'))
                        supports.append((sample.get('sample_ref'), len(matches) == 1 and matches[0] == sample.get('nominal_destination')))
                    row = {'ports': model.ports, 'evidence_matches': tuple(supports),
                           'inverse_edges_not_assumed': True, 'unknown_ports': tuple((node, direction)
                            for node in model.nodes for direction in sorted(set(model.word))
                            if not any(start == node and label == direction for start, label, _ in model.ports))}
                elif operation == 'nominal_instruction':
                    if request.state is None or request.instruction_ref is None:
                        raise ProgramPrerequisite('CURRENT_POSE_OR_NOMINAL_SYMBOL_MISSING')
                    after, event = _nominal(model, request.state, request.instruction_ref, budget)
                    row = {'pose': after, 'event': event}
                elif operation == 'forced_closure':
                    if request.state is None or request.closure_event_ref is None:
                        raise ProgramPrerequisite('CURRENT_POSE_OR_EFFECT_OWNER_MISSING')
                    after, trace, stop = _closure(model, request.state, request.closure_event_ref, budget)
                    row = {'pose': after, 'trace': trace, 'stop_reason': stop,
                           'no_forced_successor_under_supplied_model': stop == 'NO_FORCER'}
                elif operation == 'program_image':
                    if request.state is None:
                        raise ProgramPrerequisite('PROGRAM_ORIGIN_POSE_MISSING')
                    row = _program_image(model, request.state, request, budget)
                elif operation in ('safe_origin_preimages', 'robust_origin_domain'):
                    if request.observed_word is None or request.observed_word != model.word:
                        raise ProgramPrerequisite('DISPLAYED_FIXED_WORD_NOT_BOUND_TO_MODEL')
                    row = _preimages(model, request, budget)
                    safe = frozenset(row['safe_placement_nodes'])
                    outcomes = []
                    for node in sorted(safe):
                        memory = request.state.memory_ref if request.state else None
                        image = _program_image(model, ProgramPose(node_ref=node, memory_ref=memory), request, budget)
                        outcomes.append(d_map({'origin_node': node, 'endpoint': image['pose'],
                            'whole_word_accepted': image['accepted'], 'word_complete': image['word_complete']}))
                    row['safe_origin_endpoint_outcomes'] = tuple(outcomes)
                    hit_domain = tuple(sorted(set(hit for hit, _ in model.placement_hits)))
                    row['safe_observable_hits'] = tuple(hit for hit in hit_domain
                        if all(node in safe for ref, node in model.placement_hits if ref == hit))
                elif operation == 'launch_word_certificate':
                    inputs = tuple((action, payload) for hit, action, payload in request.placement_inputs if hit == request.bound_hit_ref)
                    nodes = tuple(node for hit, node in model.placement_hits if hit == request.bound_hit_ref)
                    if len(inputs) != 1 or len(nodes) != 1 or nodes[0] not in model.placement_nodes:
                        raise ProgramPrerequisite('CURRENT_MEASURED_PLACEMENT_INPUT_NOT_UNIQUE')
                    if model.placement_cost is None or request.placement_outcome_decides_launch is None:
                        raise ProgramPrerequisite('PLACEMENT_COST_OR_LAUNCH_DEPENDENCY_MISSING')
                    if request.state is None:
                        raise ProgramPrerequisite('PREPARATION_MEMORY_POSE_MISSING')
                    external = (d_map({'action_ref': inputs[0][0], 'payload': inputs[0][1], 'cost': model.placement_cost}),)
                    if not request.placement_outcome_decides_launch:
                        if model.launch_action_ref is None or model.launch_cost is None:
                            raise ProgramPrerequisite('ESTABLISHED_LAUNCH_INPUT_OR_COST_MISSING')
                        external += (d_map({'action_ref': model.launch_action_ref, 'payload': d_map(), 'cost': model.launch_cost}),)
                    descriptor = stable_digest(external)
                    if descriptor not in certificate_descriptors and len(certificate_descriptors) >= 3:
                        raise ProgramPrerequisite('GLOBAL_ROOT_WITNESS_BOUND_REQUIRES_SOURCE_RESTRICTION')
                    certificate_descriptors.add(descriptor)
                    image = _program_image(model, request.state.model_copy(update={'node_ref': nodes[0]}), request, budget)
                    row = {'external_word': external, 'ends_after_placement': request.placement_outcome_decides_launch,
                           'program_image': d_map(image), 'whole_word_accepted': image['accepted'],
                           'frozen_prerequisites': request.scope.assumption_refs,
                           'internal_word_is_not_an_external_command_path': True}
                elif operation == 'external_primitive':
                    if request.action_kind == 'placement':
                        if request.origin_node_ref not in model.placement_nodes or model.placement_cost is None:
                            raise ProgramPrerequisite('ALLOWED_PLACEMENT_OR_COST_MISSING')
                        if request.state is None:
                            raise ProgramPrerequisite('PRE_PLACEMENT_MEMORY_POSE_MISSING')
                        row = {'pose': request.state.model_copy(update={'node_ref': request.origin_node_ref}),
                            'fixed_word': model.word, 'debit': model.placement_cost, 'automatic_pass_already_owned': True}
                        row['before_state'] = request.state
                        row['phase_snapshots'] = d_map({'before': request.state, 'after_direct': row['pose'],
                            'after_cost_and_verdict': row['pose']})
                        row['pose_snapshots'] = ()
                    elif request.action_kind == 'launch':
                        if request.state is None or model.launch_cost is None:
                            raise ProgramPrerequisite('LAUNCH_MARKER_OR_COST_MISSING')
                        row = _program_image(model, request.state, request, budget, capture_pose_snapshots=True)
                        row['debit'] = model.launch_cost
                        row['automatic_pass_already_owned'] = True
                        row['phase_snapshots'] = FrozenMap.overlay({'after_cost_and_verdict': row['pose']}, row['phase_snapshots'])
                    elif request.action_kind == 'reset' and model.reset_pose is not None and model.reset_cost is not None:
                        row = {'pose': model.reset_pose, 'fixed_word': model.word, 'debit': model.reset_cost,
                               'restoration_contract_ref': model.model_ref, 'automatic_pass_already_owned': True}
                        row['before_state'] = request.state
                        row['phase_snapshots'] = d_map({'before': request.state,
                            'independent_reset': model.reset_pose, 'after_cost_and_verdict': model.reset_pose})
                        row['pose_snapshots'] = ()
                    else:
                        raise ProgramPrerequisite('EXTERNAL_INPUT_OR_RESTORATION_LAW_MISSING')
                    row['event_owner_ref'] = request.scope.event_owner_ref
                    row['internal_effects_not_external_inputs'] = True
                    row['cost_already_owned'] = True
                    row['event_ledger'] = (d_map({'owner_ref': request.scope.event_owner_ref,
                        'external_input_kind': request.action_kind, 'debit': row['debit'],
                        'internal_event_trace': row.get('trace', ()), 'accepted': row.get('accepted', False),
                        'direct_and_automatic_effects_owned': True}),)
                else:
                    return d_result(request, 'NEEDS_EVIDENCE', 'MISSING_IMPLEMENTATION', examined=budget.examined)
                rows.append(d_map({'model_ref': model.model_ref, 'result': d_map(row)}))
            values = {'model_correlated_results': tuple(rows)}
            if operation == 'robust_origin_domain':
                hit_sets = [frozenset(row['result']['safe_observable_hits']) for row in rows]
                values['common_observable_hits'] = tuple(sorted(set.intersection(*(set(items) for items in hit_sets))))
                values['robust_domain_complete'] = True
            if operation == 'launch_word_certificate' and len(set(stable_digest(row['result']['external_word']) for row in rows)) > 3:
                raise ProgramPrerequisite('GLOBAL_ROOT_WITNESS_BOUND_REQUIRES_SOURCE_RESTRICTION')
        budget.finish()
        return d_result(request, 'COMPLETE', 'REQUESTED_FINITE_CALCULATION_RETURNED',
            values=values, complete=True, examined=budget.examined)
    except (ProgramPrerequisite, DResumeMismatch) as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref, getattr(error, 'frontier', d_map())))
    except DComputationInterrupted as error:
        return d_result(request, 'BOUND_REACHED', error.cause, examined=budget.examined,
            frontier=d_resumable_frontier(request, rows, current_model_ref, error.frontier))
