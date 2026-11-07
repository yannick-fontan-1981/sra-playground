"""Compare Source-supplied words through K35's existing external primitive.

No search, inferred grip, speculative attachment, action release or selection.
Every word starts at the same immutable state under every retained model.
"""
from typing import Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, stable_digest
from .station_gated_cargo import (
    StationCargoState, StationCargoModel, _external, _carrier_mask, _world_cargo,
)


class RigidGraspDeliveryWord(FrozenModel):
    candidate_ref: Ref
    input_refs: tuple[Ref, ...] = Field(min_length=1, max_length=256)
    required_events: tuple[tuple[int, Ref], ...] = Field(default=(), max_length=256)

    @model_validator(mode='after')
    def event_indices(self):
        if any(index < 0 or index >= len(self.input_refs) for index, _ in self.required_events):
            raise ValueError('required effect belongs to an actual supplied primitive')
        if len(set(self.required_events)) != len(self.required_events):
            raise ValueError('required primitive effects are distinct')
        return self


class RigidGraspDeliveryQuestion(FrozenModel):
    request_ref: Ref
    question_ref: Ref
    parent_goal_ref: Ref
    source_state_ref: Ref
    evidence_revision_ref: Ref
    model_revision_ref: Ref
    coordinate_unit_ref: Ref
    carrier_ref: Ref
    cargo_ref: Ref
    comparison_kind: Literal['DELIVERY', 'INTERFACE_ACCESS']
    receiver_ref: Ref | None = None
    station_ref: Ref | None = None
    unresolved_alternative_ref: Ref
    state: StationCargoState
    models: tuple[StationCargoModel, ...] = Field(min_length=1, max_length=32)
    model_status: Literal['OBSERVED', 'SUPPORTED_HYPOTHESIS', 'UNKNOWN']
    assumption_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    evidence_refs: tuple[Ref, ...] = Field(min_length=1, max_length=128)
    candidates: tuple[RigidGraspDeliveryWord, ...] = Field(min_length=1, max_length=3)
    protected_cargo_refs: tuple[Ref, ...] = Field(default=(), max_length=128)
    minimum_remaining_budget: int = Field(default=0, ge=0)
    maximum_clock_advance: int | None = Field(default=None, ge=0)

    @model_validator(mode='after')
    def current_domains(self):
        refs = tuple(word.candidate_ref for word in self.candidates)
        if len(set(refs)) != len(refs) or self.unresolved_alternative_ref in refs:
            raise ValueError('candidate and unresolved identities remain distinct')
        if len({model.model_ref for model in self.models}) != len(self.models):
            raise ValueError('retained models have distinct identities')
        cargo_refs = {cargo.cargo_ref for cargo in self.state.cargo}
        if self.cargo_ref not in cargo_refs or any(ref not in cargo_refs for ref in self.protected_cargo_refs):
            raise ValueError('requested and protected cargo are current objects')
        if len({receiver.receiver_ref for receiver in self.state.receivers}) != len(self.state.receivers):
            raise ValueError('receiver identities are unique')
        if self.comparison_kind == 'DELIVERY' and self.receiver_ref is None:
            raise ValueError('delivery question has an explicit receiver')
        if self.receiver_ref is not None and self.receiver_ref not in {receiver.receiver_ref for receiver in self.state.receivers}:
            raise ValueError('requested receiver belongs to the same current state')
        if self.comparison_kind == 'INTERFACE_ACCESS' and self.station_ref not in {station.station_ref for station in self.state.stations}:
            raise ValueError('interface question has an explicit current support')
        if self.model_status == 'SUPPORTED_HYPOTHESIS' and not self.assumption_refs:
            raise ValueError('a provisional model retains its declared assumptions')
        return self


def _terminal_measurements(question, state):
    cargo = next(cargo for cargo in state.cargo if cargo.cargo_ref == question.cargo_ref)
    receiver = next((receiver for receiver in state.receivers if receiver.receiver_ref == question.receiver_ref), None)
    station = next((station for station in state.stations if station.station_ref == question.station_ref), None)
    deficit = () if receiver is None else tuple(sorted(set(_world_cargo(cargo)) - set(receiver.cells)))
    return {
        'cargo_delivered': cargo.delivered,
        'carrier_free': state.attached_cargo_ref is None,
        'receiver_type_match': receiver is not None and cargo.type_ref in receiver.accepted_type_refs,
        'receiver_mask_deficit_count': None if receiver is None else len(deficit), 'receiver_mask_deficit_sample': deficit[:8],
        'receiver_mask_evidenced': receiver is not None and receiver.containment_evidence_ref is not None,
        'cargo_mask_evidenced': cargo.mask_evidence_ref is not None,
        'requested_cargo_attached': state.attached_cargo_ref == question.cargo_ref,
        'carrier_at_requested_interface': station is not None and (state.carrier_x, state.carrier_y) in station.carrier_support_cells,
        'terminal_carrier_pose': (state.carrier_x, state.carrier_y),
    }


def _compare_word(question, model, word, maximum):
    current, work, executed, missing, cut = question.state, 0, 0, [], {}
    protected = tuple(cargo for cargo in current.cargo if cargo.delivered
        or cargo.cargo_ref in question.protected_cargo_refs)
    preserved, effects_match, refusals = True, True, []
    grasp_attained = current.attached_cargo_ref == question.cargo_ref
    if question.model_status == 'UNKNOWN':
        missing.append('current_retained_cargo_model_not_qualified')
    if current.status not in ('ACTIVE', 'WIN'):
        missing.append('active_current_cargo_execution_scope')
    for index, input_ref in enumerate(word.input_refs):
        if missing or cut or current.status != 'ACTIVE':
            break
        if work >= maximum:
            cut = {'phase': 'candidate_primitive', 'next_input_index': index}
            break
        if work + len(model.commands) > maximum:
            cut = {'phase': 'current_input_binding', 'next_input_index': index}
            break
        work += len(model.commands)
        commands = tuple(command for command in model.commands if command.input_ref == input_ref)
        if len(commands) != 1 or commands[0].kind == 'RESET':
            missing.append('unique_current_nonreset_input_mapping')
            break
        following, events, phases, debt, count, frontier, cost = _external(
            current, model, commands[0], maximum - work,
            allow_hypothetical=False)
        work += count
        if frontier or debt:
            cut = frontier
            missing.extend(debt)
            break  # A partial primitive is not a completed input or state.
        restored = any(event.get('restoration') for event in events)
        if restored or (following.level_scope_ref, following.restore_epoch) != (
                question.state.level_scope_ref, question.state.restore_epoch):
            missing.append('new_execution_scope_requires_current_qualification')
            break
        executed += 1
        direct = tuple(item for event in events if event.get('kind') == 'DIRECT_EVENT'
            for item in event.get('trace', ()))
        for event in direct:
            if event.get('kind') in ('RIGID_TRANSLATION_REFUSED', 'ROTATION_REFUSED'):
                mask = event.get('exact_refusal_mask', ())
                refusals.append(FrozenMap({'input_index': index, 'kind': event['kind'],
                    'refusal_cell_count': len(mask), 'refusal_cell_sample': tuple(mask[:8])}))
        required = tuple(kind for step, kind in word.required_events if step == index)
        effects_match = effects_match and all(any(event.get('kind') == kind for event in direct) for kind in required)
        current = following
        grasp_attained = grasp_attained or current.attached_cargo_ref == question.cargo_ref
        equality_work = len(following.cargo) + sum(len(cargo.offsets) for cargo in protected)
        if work + equality_work > maximum:
            cut = {'phase': 'protected_cargo_comparison', 'input_index': index}
            break
        work += equality_work
        following_cargo = {cargo.cargo_ref: cargo for cargo in following.cargo}
        preserved = preserved and all(following_cargo.get(frozen.cargo_ref) == frozen for frozen in protected)
    part = next(cargo for cargo in current.cargo if cargo.cargo_ref == question.cargo_ref)
    receiver = next((receiver for receiver in current.receivers if receiver.receiver_ref == question.receiver_ref), None)
    terminal_work = len(current.cargo) + len(current.receivers) + len(part.offsets) + (
        len(receiver.cells) if receiver is not None else 0) + sum(len(station.carrier_support_cells) for station in current.stations)
    terminal = {}
    if work + terminal_work <= maximum:
        work += terminal_work
        terminal = _terminal_measurements(question, current)
    else:
        cut = {'phase': 'terminal_whole_mask_comparison'}
    return FrozenMap({
        'model_ref': model.model_ref, 'executed_prefix_length': executed,
        'primitive_domain_complete': not missing and not cut and (
            executed == len(word.input_refs) or current.status == 'WIN'),
        'missing_refs': tuple(dict.fromkeys(missing)), 'computation_frontier': FrozenMap(cut),
        'examined_count': work, 'grasp_attained': grasp_attained,
        'protected_cargo_equal': preserved, 'required_direct_events_match': effects_match,
        'remaining_budget': current.remaining_budget,
        'budget_constraint_match': current.remaining_budget >= question.minimum_remaining_budget,
        'clock_advance': current.input_tick - question.state.input_tick,
        'clock_constraint_match': question.maximum_clock_advance is None or (
            current.input_tick - question.state.input_tick <= question.maximum_clock_advance),
        'terminal_status': current.status, 'geometry_refusals': tuple(refusals),
        'terminal_state_digest': stable_digest(current), **terminal,
    })


def measure_rigid_grasp_delivery(request):
    question = RigidGraspDeliveryQuestion.model_validate(request.delivery_comparison)
    initial_cargo = next(cargo for cargo in question.state.cargo if cargo.cargo_ref == question.cargo_ref)
    header_match = (request.coordinate_unit_ref == question.coordinate_unit_ref
        and request.carrier_ref == question.carrier_ref and request.part_ref == question.cargo_ref
        and request.current_state_ref == question.source_state_ref
        and request.evidence_revision_ref == question.evidence_revision_ref
        and request.model_revision_ref == question.model_revision_ref
        and request.level_scope_ref == question.state.level_scope_ref
        and request.restore_epoch == question.state.restore_epoch
        and (question.state.attached_cargo_ref is None or request.grasp_evidence_ref is not None)
        and set(request.carrier_cells) == set(_carrier_mask(question.state))
        and set(request.part_cells) == set(_world_cargo(initial_cargo))
        and set(request.geometry_evidence_refs) == set(question.evidence_refs))
    initial_digest, work, rows, any_cut, any_unknown = stable_digest(question.state), 0, {}, False, False
    for word in question.candidates:
        model_rows = []
        for model in question.models:
            if header_match and work < request.maximum_evaluations:
                row = _compare_word(question, model, word, request.maximum_evaluations - work)
                work += row['examined_count']
            else:
                row = FrozenMap({'model_ref': model.model_ref, 'primitive_domain_complete': False,
                    'missing_refs': ('same_current_geometry_header',) if not header_match else (),
                    'computation_frontier': FrozenMap() if not header_match else FrozenMap({'phase': 'global_comparison_bound'}),
                    'examined_count': 0})
            model_rows.append(row)
        complete = all(row['primitive_domain_complete'] for row in model_rows)
        bound = any(bool(row['computation_frontier']) for row in model_rows)
        any_cut = any_cut or bound
        any_unknown = any_unknown or any(bool(row['missing_refs']) for row in model_rows)
        rows[word.candidate_ref] = FrozenMap({
            'delivery_candidate': True, 'same_current_geometry_header': header_match,
            'all_model_primitives_complete': complete, 'computation_bound_reached': bound,
            'all_cargo_delivered': all(row.get('cargo_delivered', False) for row in model_rows),
            'all_carriers_free': all(row.get('carrier_free', False) for row in model_rows),
            'all_receiver_types_match': all(row.get('receiver_type_match', False) for row in model_rows),
            'all_receiver_masks_contained': all(row.get('receiver_mask_deficit_count', 1) == 0 for row in model_rows),
            'all_receiver_masks_evidenced': all(row.get('receiver_mask_evidenced', False) for row in model_rows),
            'all_cargo_masks_evidenced': all(row.get('cargo_mask_evidenced', False) for row in model_rows),
            'all_protected_cargo_equal': all(row.get('protected_cargo_equal', False) for row in model_rows),
            'all_required_effects_match': all(row.get('required_direct_events_match', False) for row in model_rows),
            'all_budget_constraints_match': all(row.get('budget_constraint_match', False) for row in model_rows),
            'all_clock_constraints_match': all(row.get('clock_constraint_match', False) for row in model_rows),
            'all_grasps_attained': all(row.get('grasp_attained', False) for row in model_rows),
            'all_requested_cargo_attached': all(row.get('requested_cargo_attached', False) for row in model_rows),
            'all_carriers_at_requested_interface': all(row.get('carrier_at_requested_interface', False) for row in model_rows),
            'all_terminal_statuses_active_or_win': all(row.get('terminal_status') in ('ACTIVE', 'WIN') for row in model_rows),
            'all_terminal_statuses_active': all(row.get('terminal_status') == 'ACTIVE' for row in model_rows),
            'primitive_count': len(word.input_refs), 'model_results': tuple(model_rows),
        })
    rows[question.unresolved_alternative_ref] = FrozenMap({'delivery_candidate': False,
        'primitive_count': 0,
        'computation_bound_reached': any_cut, 'unresolved_model_effects': any_unknown,
        'all_model_primitives_complete': all(rows[ref]['all_model_primitives_complete'] for ref in sorted(rows))})
    return {
        'facts': FrozenMap({'delivery_comparison_requested': True,
            'request_ref': question.request_ref, 'question_ref': question.question_ref,
            'parent_goal_ref': question.parent_goal_ref, 'source_state_ref': question.source_state_ref,
            'initial_state_digest': initial_digest, 'evidence_revision_ref': question.evidence_revision_ref,
            'model_revision_ref': question.model_revision_ref, 'coordinate_unit_ref': question.coordinate_unit_ref,
            'model_status': question.model_status, 'assumption_refs': question.assumption_refs,
            'requested_question_kind': question.comparison_kind, 'receiver_ref': question.receiver_ref,
            'station_ref': question.station_ref,
            'geometry_evidence_refs': question.evidence_refs, 'same_current_geometry_header': header_match,
            'examined_count': work, 'action_authorization': False,
            'candidate_words_are_source_supplied': True, 'search_invoked': False}),
        'comparison_refs': tuple(word.candidate_ref for word in question.candidates) + (question.unresolved_alternative_ref,),
        'comparison_facts': FrozenMap(rows),
    }
