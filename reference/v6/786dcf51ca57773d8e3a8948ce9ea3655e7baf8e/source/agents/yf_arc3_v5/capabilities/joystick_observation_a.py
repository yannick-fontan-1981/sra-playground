"""Scope-bound joystick observations and supplied recovery words.

Colors do not generate identities, transformations, enabled controls or goals.
The existing D atomic successor remains the sole joystick physics engine.
"""
from pydantic import ValidationError
from agents.yf_arc3_v5.logos.types import stable_digest
from .bounded_joystick import JoystickState, JoystickPrerequisite, _atomic, _recovery_facts
from .scene_layer_measurement_d import measure_scene_layers_d
from .mechanical_family_contracts_d import (
    DWorkBudget, DComputationInterrupted, DResumeMismatch, d_input_digest,
    d_map, d_result, d_resumable_frontier,
)


def _resume(request, phase, model_ref=None):
    if not request.resume_frontier:
        return {}
    if request.resume_frontier.get('input_digest') != d_input_digest(request):
        raise DResumeMismatch('JOYSTICK_SOURCE_INPUT_OR_REVISION_RESUME_MISMATCH')
    saved = request.resume_frontier.get('work_frontier', {})
    if saved.get('phase') != phase:
        raise DResumeMismatch('EXACT_JOYSTICK_OBSERVATION_RESUME_PHASE_REQUIRED')
    return saved


def _scene(request, budget, saved, work):
    scene = request.scene_input
    if scene is None:
        raise JoystickPrerequisite('CURRENT_FRAME_SEPARATE_BOARD_PAD_AND_MINIATURE_QUESTIONS_REQUIRED')
    refs = tuple(q.layer_ref for q in scene.questions)
    calibrations = {c.calibration_ref: c for c in scene.calibrations}
    questions = {q.layer_ref: q for q in scene.questions}
    if (len(set(refs)) != len(refs) or len(calibrations) != len(scene.calibrations)
            or len({f.facet_ref for f in scene.facets}) != len(scene.facets)
            or {f.layer_ref for f in scene.facets} != set(refs)
            or any(not set(f.calibration_refs) <= set(questions[f.layer_ref].calibration_refs) for f in scene.facets)):
        raise JoystickPrerequisite('EXACT_SEPARATE_COORDINATE_SPACE_FACET_AND_CALIBRATION_DOMAINS_REQUIRED')
    layers = list(saved.get('layers', ()))
    if len(layers) > len(refs) or tuple(r.get('layer_ref') for r in layers) != refs[:len(layers)]:
        raise DResumeMismatch('EXACT_COMPLETED_JOYSTICK_LAYER_PREFIX_REQUIRED')
    work.update({'layers': layers})
    for question in scene.questions[len(layers):]:
        row, = measure_scene_layers_d(scene.frame, scene.calibrations, (question,), scene.occlusions, budget)
        layers.append(row)
    spaces = tuple(d_map({'facet_ref': f.facet_ref, 'layer_ref': f.layer_ref,
        'coordinate_space_ref': f.coordinate_space_ref, 'calibration_refs': f.calibration_refs,
        'evidence_ref': f.evidence_ref, 'independent_target_requirement_ref': f.independent_target_requirement_ref,
        'hard_target_licensed': f.independent_target_requirement_ref is not None,
        'color_does_not_license_coordinate_transform': True}) for f in scene.facets)
    return {'layers': tuple(layers), 'source_declared_coordinate_spaces': spaces,
        'relative_target_candidates': request.targets, 'missing_support_refs': scene.missing_support_refs,
        'single_patch_not_a_population_count': True, 'selection_marker_not_an_occurrence': True,
        'advisory_overlay_not_an_independent_goal': True}


def _identity(request, budget, saved, work):
    query = request.identity_input
    if query is None or not request.models:
        raise JoystickPrerequisite('CURRENT_MODEL_CORRELATED_PERSISTENT_IDENTITY_AND_VISIBLE_PATCH_DOMAIN_REQUIRED')
    models = {m.model_ref: m for m in request.models}
    refs = tuple(c.candidate_ref for c in query.candidates)
    if max(len(refs), len(query.visible_patches)) > request.domain_bound:
        raise DComputationInterrupted('JOYSTICK_IDENTITY_INPUT_DOMAIN_BOUND', d_map())
    patches = {(p.row, p.column): p for p in query.visible_patches}
    if (len(models) != len(request.models) or len(set(refs)) != len(refs)
            or len(patches) != len(query.visible_patches)
            or {c.model_ref for c in query.candidates} != set(models)):
        raise JoystickPrerequisite('EXACT_IDENTITY_MODEL_CANDIDATE_AND_VISIBLE_CELL_DOMAIN_REQUIRED')
    rows = list(saved.get('rows', ()))
    if len(rows) > len(refs) or tuple(r.get('candidate_ref') for r in rows) != refs[:len(rows)]:
        raise DResumeMismatch('EXACT_COMPLETED_IDENTITY_CANDIDATE_PREFIX_REQUIRED')
    work.update({'rows': rows})
    for candidate in query.candidates[len(rows):]:
        budget.visit({'candidate_ref': candidate.candidate_ref})
        model = models[candidate.model_ref]
        state = JoystickState.model_validate(candidate.state)
        bodies = {b.occurrence_ref: b for b in state.occurrences}
        if (len(bodies) != len(state.occurrences)
                or any(not 0 <= b.row < model.height or not 0 <= b.column < model.width for b in state.occurrences)
                or state.active_occurrence_ref is not None and state.active_occurrence_ref not in bodies
                or candidate.selection_observed and not candidate.selection_evidence_ref):
            raise JoystickPrerequisite('PERSISTENT_UNIQUE_OCCURRENCES_CURRENT_POSITIONS_AND_SELECTION_EVIDENCE_REQUIRED')
        ordered = candidate.complete_draw_order_evidence_ref is not None
        if ordered and (len(state.draw_order) != len(bodies) or set(state.draw_order) != set(bodies)):
            raise JoystickPrerequisite('EVIDENCED_COMPLETE_DRAW_ORDER_REQUIRED')
        groups = {}
        for body in state.occurrences:
            budget.visit({'occurrence_ref': body.occurrence_ref})
            groups.setdefault((body.row, body.column), []).append(body)
        mismatch, visible_rows = [], []
        if model.stacking_allowed is False and any(len(groups[k]) > 1 for k in sorted(groups)):
            mismatch.append('DECLARED_STACKING_LAW_CONTRADICTION')
        if query.complete_visible_cell_domain and set(patches) != set(groups):
            mismatch.append('VISIBLE_OCCUPIED_CELL_DOMAIN')
        for cell in sorted(patches):
            patch = patches[cell]
            group = groups.get(cell, ())
            if not group:
                mismatch.append(patch.patch_ref)
                continue
            top = tuple(b for b in group if not patch.possible_top_color_refs or b.color_ref in patch.possible_top_color_refs)
            if ordered:
                top_ref = next(ref for ref in reversed(state.draw_order) if ref in {b.occurrence_ref for b in group})
                top = tuple(b for b in top if b.occurrence_ref == top_ref)
            if not top:
                mismatch.append(patch.patch_ref)
            visible_rows.append(d_map({'patch_ref': patch.patch_ref, 'cell': cell,
                'co_located_occurrence_refs': tuple(b.occurrence_ref for b in group),
                'possible_top_occurrence_refs': tuple(b.occurrence_ref for b in top),
                'selected_occurrence_ref': state.active_occurrence_ref if candidate.selection_observed else None,
                'selection_observed': candidate.selection_observed,
                'visible_top_need_not_be_selected': True, 'shared_position_not_identity_equality': True}))
        cycle_result = None
        if candidate.cycle_input_count is not None:
            if (not candidate.cycle_evidence_ref or candidate.cycle_start_occurrence_ref not in bodies
                    or not model.same_cell_cycle_order or len(set(model.same_cell_cycle_order)) != len(model.same_cell_cycle_order)):
                raise JoystickPrerequisite('EVIDENCED_SAME_CELL_CYCLE_AND_PERSISTENT_START_IDENTITY_REQUIRED')
            start = bodies[candidate.cycle_start_occurrence_ref]
            peers = groups[(start.row, start.column)]
            peer_refs = {b.occurrence_ref for b in peers}
            order = tuple(ref for ref in model.same_cell_cycle_order if ref in peer_refs)
            if set(order) != peer_refs:
                raise JoystickPrerequisite('COMPLETE_COLOCATED_IDENTITY_CYCLE_ORDER_REQUIRED')
            result = order[(order.index(start.occurrence_ref) + candidate.cycle_input_count) % len(order)]
            cycle_result = d_map({'start_occurrence_ref': start.occurrence_ref,
                'primitive_count': candidate.cycle_input_count, 'result_occurrence_ref': result,
                'evidence_ref': candidate.cycle_evidence_ref})
            if candidate.selection_observed and result != state.active_occurrence_ref:
                mismatch.append('SELECTION_CYCLE_EFFECT')
        rows.append(d_map({'candidate_ref': candidate.candidate_ref, 'model_ref': candidate.model_ref,
            'state': state, 'compatible': not mismatch, 'mismatch_refs': tuple(mismatch),
            'complete_draw_order_observed': ordered,
            'complete_draw_order_evidence_ref': candidate.complete_draw_order_evidence_ref,
            'persistent_occurrence_evidence_ref': candidate.persistent_occurrence_evidence_ref,
            'position_evidence_ref': candidate.position_evidence_ref,
            'patch_correspondences': tuple(visible_rows), 'cycle_comparison': cycle_result,
            'current_controllable_owner_ref': state.active_occurrence_ref if candidate.selection_observed else None,
            'controllable_owner_unobserved': not candidate.selection_observed,
            'unseen_occurrence_refs': tuple(ref for ref in sorted(bodies) if (bodies[ref].row, bodies[ref].column) not in patches)}))
    return {'identity_visibility_alternatives': tuple(rows), 'new_ids_not_generated_from_color_or_location': True,
        'wrapping_positions_are_source_measured_or_existing_physics_projected': True}


def _controls(request, budget, saved, work):
    query, state = request.control_input, request.state
    if query is None or state is None:
        raise JoystickPrerequisite('CURRENT_POPULATION_PAD_AND_MARKER_READ_DOMAIN_REQUIRED')
    pads = {p.pad_ref: p for p in state.pads}
    bodies = {b.occurrence_ref for b in state.occurrences}
    reads = {r.pad_ref: r for r in query.pad_reads}
    geometries = {g.pad_ref: g for g in request.control_geometries}
    refs = query.complete_pad_ref_domain
    if len(refs) > request.domain_bound:
        raise DComputationInterrupted('JOYSTICK_CONTROL_INPUT_DOMAIN_BOUND', d_map())
    if (len(pads) != len(state.pads) or len(reads) != len(query.pad_reads)
            or len(geometries) != len(request.control_geometries) or len(set(refs)) != len(refs)
            or set(refs) != set(reads) or not set(pads) <= set(refs)
            or query.active_occurrence_observed and not query.active_occurrence_evidence_ref
            or query.active_pad_observed and not query.active_pad_evidence_ref):
        raise JoystickPrerequisite('EXACT_PAD_PRESENCE_DOMAIN_AND_SELECTED_OWNER_EVIDENCE_REQUIRED')
    rows = list(saved.get('rows', ()))
    if len(rows) > len(refs) or tuple(r.get('pad_ref') for r in rows) != refs[:len(rows)]:
        raise DResumeMismatch('EXACT_COMPLETED_CONTROL_READ_PREFIX_REQUIRED')
    work.update({'rows': rows})
    for ref in refs[len(rows):]:
        budget.visit({'pad_ref': ref})
        read, pad, geometry = reads[ref], pads.get(ref), geometries.get(ref)
        owner = read.occurrence_ref if read.occurrence_ref is not None else pad.occurrence_ref if pad else None
        if (owner is not None and owner not in bodies or pad is not None and owner != pad.occurrence_ref
                or read.evidence_revision_ref != request.scope.evidence_revision_ref
                or read.presence_ref == 'ABSENT' and (read.enabled is True or read.marker_row_pixel is not None or read.marker_column_pixel is not None)):
            raise JoystickPrerequisite('CURRENT_PAD_OWNER_PRESENCE_AND_MARKER_SCOPE_REQUIRED')
        values, unknown, mismatch = {}, [], []
        geometry_bound = (geometry is not None and geometry.scope_revision_ref == request.scope.evidence_revision_ref
            and geometry.evidence_ref == read.geometry_evidence_ref
            and geometry.geometry_status in request.control_geometry_status_refs)
        for axis, pixel, origin, inset, pitch, domain in (
                ('row', read.marker_row_pixel, geometry.row_origin if geometry else 0,
                    geometry.marker_row_inset if geometry else 0, geometry.row_pitch if geometry else 1, geometry.row_values if geometry else ()),
                ('column', read.marker_column_pixel, geometry.column_origin if geometry else 0,
                    geometry.marker_column_inset if geometry else 0, geometry.column_pitch if geometry else 1, geometry.column_values if geometry else ())):
            if read.presence_ref != 'PRESENT' or pixel is None or not read.marker_evidence_ref or not geometry_bound:
                values[axis] = None; unknown.append(axis)
                continue
            offset = pixel - origin - inset
            if offset % pitch or not 0 <= offset // pitch < len(domain):
                values[axis] = None; mismatch.append(axis + '_MARKER_OUTSIDE_DECLARED_GRID')
                continue
            value = domain[offset // pitch]
            values[axis] = value
            if pad is not None:
                bound = pad.row_domain if axis == 'row' else pad.column_domain
                stored = pad.row_setting if axis == 'row' else pad.column_setting
                if value not in bound: mismatch.append(axis + '_SETTING_OUTSIDE_PAD_DOMAIN')
                if stored is not None and stored != value: mismatch.append(axis + '_STORED_SETTING_CONTRADICTION')
        rows.append(d_map({'pad_ref': ref, 'occurrence_ref': owner, 'presence_ref': read.presence_ref,
            'enabled': read.enabled, 'observed_row_setting': values['row'], 'observed_column_setting': values['column'],
            'unobserved_setting_axes': tuple(unknown), 'mismatch_refs': tuple(mismatch),
            'stored_state_not_overwritten': True, 'absence_not_centered_enabled': True}))
    return {'per_pad_control_reads': tuple(rows),
        'selected_occurrence_ref': state.active_occurrence_ref if query.active_occurrence_observed else None,
        'selected_identity_unobserved': not query.active_occurrence_observed,
        'active_pad_ref': state.active_pad_ref if query.active_pad_observed else None,
        'active_pad_unobserved': not query.active_pad_observed,
        'positions_do_not_reconstruct_knob_vectors': True}


def _recover(request, budget, saved, work):
    query = request.recovery_input
    if query is None or request.state is None or not request.models:
        raise JoystickPrerequisite('CURRENT_DEPENDENCY_DIMENSIONS_AND_MODEL_SCOPED_RECOVERY_REQUEST_REQUIRED')
    refs = tuple(d.dependency_ref for d in query.dependencies)
    if max(len(refs), len(request.models)) > request.domain_bound:
        raise DComputationInterrupted('JOYSTICK_RECOVERY_INPUT_DOMAIN_BOUND', d_map())
    if len(set(refs)) != len(refs):
        raise JoystickPrerequisite('UNIQUE_DEPENDENCY_REPAIR_DIMENSIONS_REQUIRED')
    rows = list(saved.get('rows', ()))
    model_refs = tuple(m.model_ref for m in request.models)
    if len(set(model_refs)) != len(model_refs):
        raise JoystickPrerequisite('UNIQUE_CORRELATED_RECOVERY_MODEL_REFERENCES_REQUIRED')
    if len(rows) > len(model_refs) or tuple(r.get('model_ref') for r in rows) != model_refs[:len(rows)]:
        raise DResumeMismatch('EXACT_COMPLETED_RECOVERY_MODEL_PREFIX_REQUIRED')
    work.update({'rows': rows})
    partial = saved.get('partial', {})
    work['partial'] = dict(partial)
    for model in request.models[len(rows):]:
        dependencies = tuple(d_map({'dependency_ref': d.dependency_ref, 'evidence_revision_ref': d.evidence_revision_ref,
            'model_revision_ref': d.model_revision_ref, 'portable_evidence_ref': d.portable_evidence_ref,
            'current_revalidation_ref': d.current_revalidation_ref, 'restoration_obligation_ref': d.restoration_obligation_ref,
            'information_experiment_ref': d.information_experiment_ref, 'advisory_only': d.advisory_only,
            'dirty_dimensions': (d.dimension_ref,) if d.contradictory or d.evidence_revision_ref != request.scope.evidence_revision_ref
                or d.model_revision_ref != request.scope.model_revision_ref else ()}) for d in query.dependencies)
        child = request.model_copy(update={'observations': dependencies})
        comparisons = _recovery_facts(model, child, budget)
        work['current_model_recovery_facts'] = d_map({'model_ref': model.model_ref,
            'dependency_comparisons': comparisons, 'source_dependencies': query.dependencies,
            'declared_reset_state': model.reset_state, 'reset_cost': model.reset_cost,
            'reset_lifecycle_ref': model.reset_lifecycle_ref})
        restoration = None
        if query.before_restoration_state is not None or query.after_restoration_state is not None:
            if query.before_restoration_state is None or query.after_restoration_state is None or not query.restoration_evidence_ref:
                raise JoystickPrerequisite('PAIRED_OBSERVED_RESTORATION_STATES_AND_EVIDENCE_REQUIRED')
            before = JoystickState.model_validate(query.before_restoration_state)
            after = JoystickState.model_validate(query.after_restoration_state)
            fields = ('occurrences', 'pads', 'active_occurrence_ref', 'active_pad_ref', 'draw_order')
            restoration = d_map({'equal_fields': tuple(f for f in fields if getattr(before, f) == getattr(after, f)),
                'changed_fields': tuple(f for f in fields if getattr(before, f) != getattr(after, f)),
                'observed_positions_equal': {b.occurrence_ref: (b.row, b.column) for b in before.occurrences}
                    == {b.occurrence_ref: (b.row, b.column) for b in after.occurrences},
                'observed_knob_vectors_equal': {p.pad_ref: (p.enabled, p.row_setting, p.column_setting) for p in before.pads}
                    == {p.pad_ref: (p.enabled, p.row_setting, p.column_setting) for p in after.pads},
                'full_declared_reset_state_equal': model.reset_state is not None and after == model.reset_state,
                'coordinate_equality_not_all_knob_restoration': True, 'evidence_ref': query.restoration_evidence_ref})
        word_rows = list(partial.get('word_rows', ())) if partial.get('model_ref') == model.model_ref else []
        word_refs = tuple(w.word_ref for w in request.preparation_words)
        if (len(set(word_refs)) != len(word_refs) or len(word_rows) > len(word_refs)
                or tuple(r.get('word_ref') for r in word_rows) != word_refs[:len(word_rows)]):
            raise DResumeMismatch('EXACT_COMPLETED_RECOVERY_WORD_PREFIX_REQUIRED')
        if request.mode_ref == 'PROBE':
            if not request.preparation_words:
                raise JoystickPrerequisite('SOURCE_SUPPLIED_EXACT_INFORMATION_OR_RESTORATION_WORDS_REQUIRED')
            for word in request.preparation_words[len(word_rows):]:
                if len(set(p.primitive_ref for p in word.primitives)) != len(word.primitives):
                    raise JoystickPrerequisite('UNIQUE_PRIMITIVE_EVENT_OWNERS_WITHIN_PROBE_WORD_REQUIRED')
                resumed = partial.get('model_ref') == model.model_ref and partial.get('word_ref') == word.word_ref
                state = JoystickState.model_validate(partial['state']) if resumed else request.state
                index = partial.get('next_primitive_index', 0) if resumed else 0
                if type(index) is not int or not 0 <= index <= len(word.primitives):
                    raise DResumeMismatch('EXACT_RECOVERY_NEXT_PRIMITIVE_CURSOR_REQUIRED')
                trace = list(partial.get('event_trace', ())) if resumed else []
                accepted, violated = False, False
                while index < len(word.primitives):
                    work['partial'] = {'model_ref': model.model_ref, 'word_ref': word.word_ref,
                        'word_rows': tuple(word_rows), 'state': state, 'next_primitive_index': index, 'event_trace': tuple(trace)}
                    if index >= request.depth_bound:
                        raise DComputationInterrupted('JOYSTICK_PROBE_WORD_DEPTH_BOUND', d_map())
                    primitive = word.primitives[index]
                    scope = request.scope.model_copy(update={'event_owner_ref': primitive.primitive_ref})
                    step = request.model_copy(update={'scope': scope, 'state': state,
                        'action_kind': primitive.action_kind, 'occurrence_ref': primitive.occurrence_ref,
                        'pad_ref': primitive.pad_ref, 'settings': primitive.settings, 'nudge': primitive.nudge,
                        'selectable_occurrence_refs': primitive.selectable_occurrence_refs})
                    result = _atomic(model, state, step, budget)
                    state = result['state']; trace.extend(result['event_ledger']); index += 1
                    violated = any(not any(b.occurrence_ref == ref and (b.row, b.column) == (row, column)
                        for b in state.occurrences) for ref, row, column in request.preservation_positions)
                    accepted = result.get('accepted') is True
                    if violated or accepted: break
                word_rows.append(d_map({'word_ref': word.word_ref, 'state': state, 'primitive_count': index,
                    'word_complete': index == len(word.primitives), 'event_trace': tuple(trace),
                    'accepted': accepted, 'preservation_violated': violated,
                    'debit': sum(e['debit'] for e in trace), 'actual_wrap_count': sum(e['wrap_count'] for e in trace)}))
                partial = {}; work['partial'] = {'model_ref': model.model_ref, 'word_rows': tuple(word_rows)}
        rows.append(d_map({'model_ref': model.model_ref, 'dependency_comparisons': comparisons,
            'source_dependencies': query.dependencies, 'restoration_comparison': restoration,
            'declared_reset_state': model.reset_state, 'reset_cost': model.reset_cost,
            'reset_lifecycle_ref': model.reset_lifecycle_ref, 'probe_word_results': tuple(word_rows),
            'computation_bound_not_world_blockage': query.cause_ref == 'COMPUTATION_BOUND',
            'portable_gain_geometry_evidence_not_deleted': True,
            'advisory_guide_does_not_override_current_model': True,
            'source_owns_relevance_frozen_why_release_and_single_pursuit_counter': True}))
        partial = {}; work['partial'] = {}
    return {'model_correlated_recovery_facts': tuple(rows), 'focus_counter_changed': False,
        'probe_word_is_not_action_authorization': True}


def measure_joystick_observation_a(request):
    budget, work = DWorkBudget(request), {}
    operation = request.operation_ref.rsplit('.', 1)[-1]
    phases = {'grid_roles': 'JOY_SCENE', 'identity_and_occlusion': 'JOY_IDENTITY',
        'control_state': 'JOY_CONTROL', 'recovery_and_focus': 'JOY_RECOVERY'}
    try:
        if not request.source_identity_ref or operation not in phases:
            raise JoystickPrerequisite('CURRENT_SOURCE_IDENTITY_AND_EXACT_OBSERVATION_OPERATION_REQUIRED')
        phase = phases[operation]
        work['phase'] = phase
        saved = _resume(request, phase)
        if operation == 'grid_roles': values = _scene(request, budget, saved, work)
        elif operation == 'identity_and_occlusion': values = _identity(request, budget, saved, work)
        elif operation == 'control_state': values = _controls(request, budget, saved, work)
        else: values = _recover(request, budget, saved, work)
        budget.finish()
        return d_result(request, 'COMPLETE', 'EXACT_SCOPED_JOYSTICK_OBSERVATION_OR_RECOVERY_DOMAIN',
            values=values, complete=True, examined=budget.examined)
    except (JoystickPrerequisite, DResumeMismatch, ValidationError) as error:
        return d_result(request, 'NEEDS_EVIDENCE', str(error), examined=budget.examined,
            values={'partial_observation_domain': d_map(work)},
            frontier=d_resumable_frontier(request, (), None, work) if len(work) > 1 else ())
    except DComputationInterrupted as error:
        return d_result(request, 'BOUND_REACHED', error.cause, examined=budget.examined,
            frontier=d_resumable_frontier(request, (), None, work))
