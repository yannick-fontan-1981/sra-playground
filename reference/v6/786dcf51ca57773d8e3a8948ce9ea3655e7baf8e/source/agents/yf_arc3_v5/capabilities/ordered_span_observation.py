"""Bounded conditional window calculations over Source-bound raster receipts.

DRM supplies the model family, applicability, goals and experiment order. This
module retains all fitted scalar candidates and enumerates their common values.
It neither adopts a world law nor releases or orders native inputs.
"""
from functools import lru_cache
from itertools import product
from math import prod
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from .ordered_span_geometry import measure_ordered_span_geometry, measure_ordered_packet
from .mechanical_family_contracts_d import DMechanicalScope
from .window_processing_d import TrainRankD, WindowReceiverD, WindowBeatStateD
from .window_processing_primitive_d import (
    WindowNativeInputD, WindowProcessingPrimitiveRequestD, measure_window_processing_primitive_d)


@lru_cache(maxsize=4096)
def _events(values, positions, spans, filters, single_use, maximal, evidence_ref, epoch, token, contract):
    model_key = stable_digest((values, positions, spans, filters, single_use, maximal))
    scope = DMechanicalScope(**dict(contract['scope']),
        request_ref='measurement.ordered_span.' + model_key,
        evidence_revision_ref=evidence_ref, model_revision_ref=model_key,
        epoch=epoch, input_domain_complete=True)
    train = tuple(TrainRankD(unit_ref=f'measurement.rank.{token}.{i}', rank=i,
        current_color_ref=str(v), captured=False) for i, v in enumerate(values))
    rows = tuple(WindowReceiverD(receiver_ref=f'measurement.span.{token}.{i}',
        first_rank_at_beat_zero=-p-k, window_size=k,
        admitted_color_refs=None if f is None else (str(f),),
        maximal_group_required=m, required_parent_events=(),
        action=contract['input_effect'], paint_color_ref=None,
        event_ref=f'measurement.span_event.{token}.{i}', one_use_for_run=one)
        for i, (p, k, f, one, m) in enumerate(zip(positions, spans, filters, single_use, maximal)))
    state = WindowBeatStateD(train=train, receivers=rows,
        receiver_order=tuple(r.receiver_ref for r in rows), spent_for_run_refs=(),
        current_pulses=(), beat=0, rank_shift_per_beat=1,
        visitation_policy=contract['visitation_policy'], revisit_receiver_refs=(),
        firing_bounds=(), revisit_termination_evidence_ref=None)
    inp = WindowNativeInputD(input_ref='measurement.complete_operator_input',
        kind='LAUNCH', receiver_ref=None, field=None, cycle_delta=0,
        supplied_value=None, debit=0)
    result = measure_window_processing_primitive_d(WindowProcessingPrimitiveRequestD(
        scope=scope, operation_ref=contract['operation_ref'], mode_ref='STEP',
        requested_result_type='DMechanicalResult', **dict(contract['calculation_bounds']),
        phase_ref='EXTERNAL_WINDOW_SETTING_OR_LAUNCH', state=state,
        inputs=(inp,), native_focus_ref=None, bound_input_ref=inp.input_ref,
        trial_first_beat=1, trial_last_beat=max(positions)+len(values)+max(spans),
        goal_check_phase='AFTER_EACH_BEAT', reset_train_on_failure=False,
        reset_spent_on_failure=False, preserve_settings_on_failure=True,
        remaining_resource=0, debit_per_beat=0,
        goal_boundary_ref='measurement.all_occurrence_flags_absent',
        failed_trial_event_ref='measurement.some_occurrence_flags_present',
        depletion_boundary_ref='measurement.no_physical_fuel_contract'))
    if not result.domain_complete:
        return None
    return tuple(sorted((event['beat'], rank) for row in result.values['beat_ledger']
        for event in row['ledger']['ordered_events'] for rank in event['input_ranks']))


def _mapped_filters(filters, original_display, display):
    return tuple(new if old is not None and f == old and new is not None else f
                 for f, old, new in zip(filters, original_display, display))


def _signature(geometry):
    return stable_digest((geometry['square_values'], geometry['square_bboxes'],
        geometry['pitch'], geometry['band_y'], geometry['band_left'],
        tuple((p['bbox'], p['index_offset']) for p in geometry['panel_rows'])))[:24]


def measure_ordered_span_loci(value, frame, contract):
    if (not contract or not value.current_observation_frame_ref
            or frame != value.frame
            or contract['palette_value_binding'] != 'REPLACE_MATCHING_ORIGINAL_MONOCHROME_SIGNAL'):
        return ()
    carried = value.canonical_dispatched_goal_continuity_facts.get(
        'dispatched_composition_target_context') or {}
    # A Source-dispatched parameter question is the caller of this additional
    # measurement family; it is not an always-on alternative game detector.
    if not (carried.get('inset_value_geometry_token') or carried.get('ordered_window_geometry_token')):
        return ()
    layouts = measure_ordered_span_geometry(frame, contract)
    if len(layouts) != 1:
        return ()
    geometry = layouts[0]
    token = _signature(geometry)
    epoch, frame_ref = value.current_context_epoch, value.current_observation_frame_ref
    frame_digest = stable_digest(frame.rows)
    old_token = carried.get('ordered_window_geometry_token')
    if not old_token and (
            carried.get('inset_value_context_epoch') != epoch
            or value.previous_action_observed_frame is None
            or carried.get('inset_value_source_frame_digest') != stable_digest(value.previous_action_observed_frame.rows)):
        return ()
    if old_token:
        if (old_token != token or carried.get('ordered_window_context_epoch') != epoch
                or value.previous_action_observed_frame is None
                or carried.get('ordered_window_source_frame_digest') != stable_digest(value.previous_action_observed_frame.rows)):
            return ()
    trials = tuple(carried.get('ordered_window_trial_rows', ())) if old_token else ()
    panels = geometry['panel_rows']
    positions = tuple(p['index_offset'] for p in panels)
    spans = tuple(p['span_count'] for p in panels)
    display = tuple(p['majority_value'] for p in panels)
    if any(p < 0 for p in positions) or len(set(positions)) != len(positions):
        return ()
    packet_count = value.latest_ordered_action_source_frame_count or len(value.latest_ordered_action_frames)
    if packet_count > 1:
        packet = measure_ordered_packet(value, geometry, contract)
        if packet is None or packet['pixel_step'] <= 0 or not packet['nonboundary_absence_rows']:
            return ()
        before = measure_ordered_span_geometry(value.previous_action_observed_frame, contract)
        if len(before) != 1 or _signature(before[0]) != token:
            return ()
        before_spans = tuple(p['span_count'] for p in before[0]['panel_rows'])
        before_display = tuple(p['majority_value'] for p in before[0]['panel_rows'])
        if (before_spans, before_display) != (spans, display):
            return ()
        trial = FrozenMap({'frame_ref': frame_ref, 'frame_digest': frame_digest,
            'operator_action_ref': value.last_action_ref, 'span_values': spans,
            'display_values': display, 'absence_rows': tuple((e[0], e[1]) for e in packet['nonboundary_absence_rows']),
            'pixel_step': packet['pixel_step'], 'pixel_offset': packet['pixel_offset'],
            'source_frame_count': packet_count})
        if not trials or trials[-1]['frame_ref'] != frame_ref:
            trials = (*trials, trial)
    if not trials or len(trials) > contract['maximum_trial_receipts']:
        return ()
    values = tuple(geometry['square_values'])
    palette_domain = (None, *sorted(set(values)))
    n = len(panels)
    model_domain_count = (len(palette_domain) * len(contract['single_use_candidates'])
                          * len(contract['group_boundary_candidates'])) ** n
    if model_domain_count > contract['maximum_model_candidates']:
        return ()
    original_display = tuple(trials[0]['display_values'])
    models = []
    for filters in product(palette_domain, repeat=n):
        for one in product(contract['single_use_candidates'], repeat=n):
            for maximal in product(contract['group_boundary_candidates'], repeat=n):
                compatible = True
                for trial in trials:
                    current_filters = _mapped_filters(filters, original_display, tuple(trial['display_values']))
                    events = _events(values, positions, tuple(trial['span_values']), current_filters,
                        one, maximal, trial['frame_ref'], epoch, token, contract)
                    if events is None:
                        return ()
                    if events != tuple(sorted(tuple(e) for e in trial['absence_rows'])):
                        compatible = False
                        break
                if compatible:
                    models.append((filters, one, maximal))
    if not models:
        return ()
    span_domains = tuple(tuple(range(1, p['slot_count'] + 1))
                         if p['slot_count'] else (p['span_count'],) for p in panels)
    display_domains = tuple(tuple(p['inset_values']) if p['palette_point'] is not None
                            else (None,) for p in panels)
    if prod(len(d) for d in (*span_domains, *display_domains)) > contract['maximum_assignment_candidates']:
        return ()
    assignments = []
    for sizes in product(*span_domains):
        for palettes in product(*display_domains):
            common = True
            for filters, one, maximal in models:
                bound = _mapped_filters(filters, original_display, palettes)
                events = _events(values, positions, sizes, bound, one, maximal, frame_ref, epoch, token, contract)
                if events is None:
                    return ()
                if {rank for _, rank in events} != set(range(len(values))):
                    common = False
                    break
            if common:
                assignments.append((sizes, palettes))
    # This adapter exposes an exact singleton, never chooses one scalar plan
    # from competing assignments. The other candidates stay an open question.
    if len(assignments) != 1:
        return ()
    unique_sizes, unique_palettes = assignments[0]
    point_rows = []
    span_points = []
    old_points = tuple(carried.get('ordered_window_span_input_points', ()))
    for i, p in enumerate(panels):
        point = None
        if p['slot_boxes']:
            point = tuple(p['slot_boxes'][0][:2])
            if len(old_points) == n and old_points[i]:
                point = tuple(old_points[i])
            elif (tuple(carried.get('inset_value_panel_bbox', ())) == tuple(p['bbox'])
                    and carried.get('inset_value_point')):
                point = tuple(carried['inset_value_point'])
            if not any(b[0] <= point[0] <= b[2] and b[1] <= point[1] <= b[3] for b in p['slot_boxes']):
                return ()
            point_rows.append((i, 0, point, p['span_count'] == unique_sizes[i]))
        span_points.append(point)
        if p['palette_point'] is not None:
            point_rows.append((i, 1, tuple(p['palette_point']), p['majority_value'] == unique_palettes[i]))
    equal = spans == unique_sizes and all(v is None or v == actual for v, actual in zip(unique_palettes, display))
    prior_same = any(tuple(t['span_values']) == spans and tuple(t['display_values']) == display for t in trials)
    base = {'ordered_window_geometry_token': token, 'ordered_window_context_epoch': epoch,
        'ordered_window_source_frame_ref': frame_ref, 'ordered_window_source_frame_digest': frame_digest,
        'ordered_window_square_values': values, 'ordered_window_index_offsets': positions,
        'ordered_window_panel_bboxes': tuple(p['bbox'] for p in panels),
        'ordered_window_slot_counts': tuple(p['slot_count'] for p in panels),
        'ordered_window_palette_inset_bboxes': tuple(p['palette_roi'] for p in panels),
        'ordered_window_trial_rows': trials, 'ordered_window_model_rows': tuple(models),
        'ordered_window_model_domain_count': model_domain_count,
        'ordered_window_retained_model_count': len(models), 'ordered_window_assignment_count': len(assignments),
        'ordered_window_unique_span_values': unique_sizes, 'ordered_window_unique_display_values': unique_palettes,
        'ordered_window_span_values': spans, 'ordered_window_display_values': display,
        'ordered_window_span_input_points': tuple(span_points),
        'ordered_window_current_assignment_equal': equal, 'ordered_window_current_equal_prior_trial': prior_same,
        'ordered_window_domain_complete': True,
        'ordered_window_incoming_route_remaining_step_count': value.incoming_declared_route_remaining_step_count}
    out = []
    for i, column, point, same in point_rows:
        p = panels[i]
        boxes = p['slot_boxes']
        field_box = ((min(b[0] for b in boxes), min(b[1] for b in boxes),
                      max(b[2] for b in boxes), max(b[3] for b in boxes))
                     if column == 0 else p['palette_roi'])
        out.append(FrozenMap({**base, 'action_ref': contract['point_action_ref'], 'point': point,
            'component_ref': panels[i]['component_ref'], 'ordered_window_is_point': True,
            'ordered_window_field_bbox': field_box,
            'ordered_window_field_row': i, 'ordered_window_field_column': column,
            'ordered_window_parameter_value_equal_to_assignment': same}))
    action = trials[-1]['operator_action_ref']
    if action in value.available_action_refs:
        out.append(FrozenMap({**base, 'action_ref': action, 'point': None, 'component_ref': None,
            'ordered_window_is_point': False, 'ordered_window_parameter_value_equal_to_assignment': True}))
    return tuple(out)


def measure_ordered_span_candidates(value, agenda, contract, measured_rows=None):
    """Join existing current point loci to measured inset domains after compaction.

    This preserves both nominal/delta agenda representations through the shared
    adapter. It does not create, order or substitute physical point candidates.
    """
    rows = (measure_ordered_span_loci(value, value.current_observed_frame or value.frame, contract)
            if measured_rows is None else measured_rows)
    measured = {}
    for candidate in agenda.candidates:
        for row in rows:
            if candidate.action_ref != row['action_ref']:
                continue
            if row['ordered_window_is_point']:
                if candidate.point is None:
                    continue
                t, l, b, r = row['ordered_window_field_bbox']
                y, x = candidate.point
                if not (t <= y <= b and l <= x <= r):
                    continue
                update = dict(row)
                if row['ordered_window_field_column'] == 0:
                    points = list(row['ordered_window_span_input_points'])
                    points[row['ordered_window_field_row']] = candidate.point
                    update['ordered_window_span_input_points'] = tuple(points)
            else:
                if (candidate.point is not None
                        or candidate.candidate_ref != 'probe:discrete:' + candidate.action_ref):
                    continue
                update = dict(row)
            update.update(point=candidate.point, component_ref=candidate.component_ref)
            current = FrozenMap(update)
            measured[candidate.candidate_ref] = FrozenMap({**dict(current),
                'ordered_window_locus_present': True,
                'inset_value_locus_present': candidate.point is not None,
                'ordered_window_current_measurement': current})
    return FrozenMap(measured)
