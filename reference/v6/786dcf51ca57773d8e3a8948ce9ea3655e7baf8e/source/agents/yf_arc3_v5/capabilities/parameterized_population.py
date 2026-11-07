"""Finite relative assignments and partial setting tables.

No goal, model or action is selected here. Source admits the displayed
population question, the retained assignment and the conditional calculation.
Unknown coefficients remain unknown; every returned control is a measured cell.
"""
from collections import Counter
from itertools import permutations

from .contracts import FrameGrid
from .homologous_interface import InterfaceObservation
from ..logos.types import FrozenMap, stable_digest


def _assignments(population, pattern, height, width, bound):
    slots = tuple((v, r, c) for r, line in enumerate(pattern)
                  for c, v in enumerate(line) if v is not None)
    origins = sorted({(pr-r, pc-c) for value, pr, pc in population
                      for v, r, c in slots if value == v})
    output = set()
    for ro, co in origins:
        translated = tuple((v, ro+r, co+c) for v, r, c in slots)
        if any(not (0 <= r < height and 0 <= c < width) for v, r, c in translated):
            continue
        for image in permutations(translated):
            if any(a[0] != b[0] for a, b in zip(population, image)):
                continue
            if not any(a == b for a, b in zip(population, image)):
                continue
            output.add(image)
            if len(output) > bound:
                return (), False
    return tuple(sorted(output)), True


def _snapshot(layout, population, groups, scope, frame_ref, frame_hash, generation,
              target, models, member_settings, member_index, kind, point):
    return {**{key: layout[key] for key in (
        'box', 'height', 'width', 'cell_height', 'cell_width', 'small_box',
        'small_pattern', 'geometry_token')},
        'population_program': True, 'scope_counter': scope,
        'population': population, 'group_boxes': tuple(g['box'] for g in groups),
        'frame_ref': frame_ref, 'frame_hash': frame_hash, 'generation': generation,
        'target_population': target, 'models': models,
        'member_settings': member_settings, 'member_index': member_index,
        'kind': kind, 'point': point, 'pad_index': -1}


def _row(base, snapshot, action_ref, **measurements):
    token = stable_digest(snapshot)
    settings = snapshot.get('member_settings', ())
    index, pad = snapshot['member_index'], snapshot['pad_index']
    requested = snapshot.get('requested_setting')
    setting_change = bool(snapshot['kind'] in ('population_probe', 'population_inverse')
        and requested is not None and len(requested) == 2 and 0 <= index < len(settings)
        and settings[index] is not None and 0 <= pad < len(settings[index])
        and tuple(requested) != tuple(settings[index][pad]))
    return 'program.population.'+token, {
        **base, 'kind': snapshot['kind'], 'snapshot': snapshot,
        'point': snapshot['point'], 'action_ref': action_ref,
        'witness_token': token, 'frame_ref': snapshot['frame_ref'],
        'scope_counter': snapshot['scope_counter'],
        'program_population_context': True,
        'program_selection_ready': False, 'program_probe_ready': False,
        'program_axis_ready': False, 'program_inverse_ready': False,
        'program_population_model_ready': False,
        'program_axis_model_parent_claim_ref': snapshot.get('axis_model_parent_claim_ref'),
        'program_current_setting_change_measured': setting_change,
        'program_full_relative_equal': snapshot['population'] == snapshot['target_population'],
        'member_order': snapshot['member_index'], 'pad_order': snapshot['pad_index'],
        'direction_order': 0, 'assignment_order': 0,
        'population_moved_count': 0, 'population_displacement_sum': 0,
        'population_inverse_cost': 0, **measurements}


def measure_population(value, agenda, base, layout, groups, contract):
    from .parameterized_control import _population, _population_correspondence, _markers, _proposal
    request = value.request
    cfg = contract['population_contract']
    population = _population(layout)
    if (not cfg['minimum_members'] <= len(population) <= cfg['maximum_members']
            or len(groups) > cfg['maximum_pads']):
        return _proposal(value, agenda, base, {}, ())
    frame = request.current_observed_frame or request.frame
    frame_hash = stable_digest(frame.rows)
    before = request.previous_action_observed_frame
    before_hash = stable_digest(before.rows) if before else None
    prior_rows = tuple(row for row in value.prior_model_rows
        if row['snapshot'].get('population_program') is True
        and row['snapshot']['scope_counter'] == base['scope_counter']
        and row['snapshot']['geometry_token'] == layout['geometry_token'])
    same = tuple(row for row in prior_rows if row['snapshot']['frame_hash'] == frame_hash
                 and row['snapshot']['frame_ref'] == request.current_observation_ref)
    previous_frame = tuple(row for row in prior_rows if row['snapshot']['frame_hash'] == before_hash)
    previous_row = max(same or previous_frame, key=lambda row: row['snapshot']['generation']) if same or previous_frame else None
    previous = previous_row['snapshot'] if previous_row else None
    evidence = tuple(ref for ref in (request.current_observation_ref,
        request.retained_physical_transition_receipt.checkpoint_ref if request.retained_physical_transition_receipt else None,
        previous_row['witness_claim_ref'] if previous_row else None) if ref is not None)
    rows = {}
    if previous is None:
        images, complete = _assignments(population, layout['small_pattern'], layout['height'],
                                       layout['width'], cfg['maximum_assignments'])
        base = {**base, 'population_assignment_domain_complete': complete}
        if not complete:
            return _proposal(value, agenda, base, {}, evidence)
        models = tuple(tuple((None, None, None, None) for group in groups) for member in population)
        settings = tuple(None for member in population)
        for image in images:
            moved = sum(a != b for a, b in zip(population, image))
            distance = sum(abs(a[1]-b[1])+abs(a[2]-b[2]) for a, b in zip(population, image))
            for index, member in enumerate(population):
                if member == image[index]:
                    continue
                cells = tuple(c for c in layout['population']
                    if (c['base_value'], c['row'], c['column']) == member)
                if len(cells) != 1:
                    continue
                snapshot = _snapshot(layout, population, groups, base['scope_counter'],
                    request.current_observation_ref, frame_hash, 1, image, models, settings,
                    index, 'population_selection', cells[0]['point'])
                ref, row = _row(base, snapshot, contract['point_action_ref'],
                    program_selection_ready=True, population_moved_count=moved,
                    population_displacement_sum=distance)
                rows[ref] = row
                if len(rows) > cfg['maximum_candidates']:
                    return _proposal(value, agenda, {**base, 'population_assignment_domain_complete': False}, {}, evidence)
        return _proposal(value, agenda, base, rows, evidence)
    if tuple(tuple(g['box']) for g in groups) != tuple(tuple(b) for b in previous['group_boxes']):
        return _proposal(value, agenda, base, {}, evidence)
    index = previous['member_index']
    population = _population_correspondence(tuple(tuple(v) for v in previous['population']), population, index)
    if population is None:
        return _proposal(value, agenda, base, {}, evidence)
    if same and previous['kind'] in ('population_selection', 'population_probe', 'population_inverse'):
        ref, row = _row(base, dict(previous), contract['point_action_ref'],
            program_selection_ready=previous['kind'] == 'population_selection',
            program_probe_ready=previous['kind'] == 'population_probe',
            program_direction_axis_supported=True,
            program_inverse_ready=previous['kind'] == 'population_inverse',
            program_inverse_domain_complete=True)
        return _proposal(value, agenda, base, {ref: row}, evidence)
    markers = _markers(layout, groups, population[index])
    bound = bool(not same and before and request.retained_physical_transition_receipt
                 and request.last_action_ref == contract['point_action_ref']
                 and request.last_point_position == tuple(previous['point']))
    if previous['kind'] == 'population_selection' and not bound:
        cells = tuple(c for c in layout['population']
                      if (c['base_value'], c['row'], c['column']) == population[index])
        if len(cells) == 1:
            snapshot = _snapshot(layout, population, groups, base['scope_counter'],
                request.current_observation_ref, frame_hash, previous['generation']+int(not same),
                previous['target_population'], previous['models'], previous['member_settings'],
                index, 'population_selection', cells[0]['point'])
            ref, row = _row(base, snapshot, contract['point_action_ref'], program_selection_ready=True)
            rows[ref] = row
        return _proposal(value, agenda, base, rows, evidence)
    if markers is None or not (same or bound):
        return _proposal(value, agenda, base, {}, evidence)
    models = [[list(pad) for pad in member] for member in previous['models']]
    settings = list(previous['member_settings'])
    target = tuple(tuple(v) for v in previous['target_population'])
    consistent = True
    if bound and previous['kind'] == 'population_probe':
        origin = previous['calibration_origin']
        pi, axis = previous['pad_index'], previous['calibration_axis']
        old = tuple(origin['markers'][pi])
        delta = markers[pi][axis]-old[axis]
        if (abs(delta) != 1 or markers[pi][1-axis] != old[1-axis]
                or any(tuple(a) != tuple(b) for j, (a, b) in enumerate(zip(origin['markers'], markers)) if j != pi)):
            consistent = False
        else:
            prior_body = origin['population'][index]
            gains = (((population[index][1]-prior_body[1])*delta) % layout['height'],
                     ((population[index][2]-prior_body[2])*delta) % layout['width'])
            for entry, gain in zip((axis, axis+2), gains):
                known = models[index][pi][entry]
                if known is not None and known != gain:
                    consistent = False
                models[index][pi][entry] = gain
    if bound and previous['kind'] == 'population_inverse':
        consistent = (tuple(population[index][1:]) == tuple(previous['expected_next_position'])
                      and tuple(markers) == tuple(tuple(v) for v in previous['expected_next_markers']))
    settings[index] = markers
    if not consistent:
        return _proposal(value, agenda, {**base, 'population_model_observation_consistent': False}, {}, evidence)
    generation = previous['generation']+int(not same)
    if population[index] == target[index]:
        for next_index, member in enumerate(population):
            if member == target[next_index]:
                continue
            cells = tuple(c for c in layout['population'] if (c['base_value'], c['row'], c['column']) == member)
            if len(cells) != 1:
                continue
            snapshot = _snapshot(layout, population, groups, base['scope_counter'],
                request.current_observation_ref, frame_hash, generation, target, models, settings,
                next_index, 'population_selection', cells[0]['point'])
            ref, row = _row(base, snapshot, contract['point_action_ref'], program_selection_ready=True)
            rows[ref] = row
    else:
        snapshot = _snapshot(layout, population, groups, base['scope_counter'],
            request.current_observation_ref, frame_hash, generation, target, models, settings,
            index, 'population_model', previous['point'])
        ref, row = _row(base, snapshot, contract['point_action_ref'],
            program_population_model_ready=True, population_model_observation_consistent=True,
            population_transition_bound=bool(request.retained_physical_transition_receipt))
        rows[ref] = row
    return _proposal(value, agenda, base, rows, evidence)


def calculate_population_inverse(value, declared):
    from .parameterized_control import _proposal, _markers
    from .parameterized_control_geometry import measure_enclosed_lattice_correspondences, measure_external_cell_groups
    from .bounded_joystick import JoystickModel, JoystickState, JoystickOccurrence, JoystickPad, JoystickSetting, BoundedJoystickRequest, measure_bounded_joystick
    from .mechanical_family_contracts_d import DMechanicalScope
    p = value.proposal
    row = p.rows[value.source_description_ref]
    snap = row['snapshot']
    contract = p.request.route_generation_policy['parameterized_control_measurement_contract']
    cfg = contract['population_contract']
    if declared.get('program_population_model_admitted') is not True:
        raise ValueError('Source partial-population model admission required')
    evidence = tuple(p.evidence_refs)+(declared['program_witness_claim_ref'],)
    if (cfg['inverse_witness_order'] != 'minimum_changed_settings_then_canonical_settings'
            or cfg['maximum_executable_witnesses'] != 1):
        raise ValueError('Unsupported Source population inverse traversal contract')
    layouts, components, complete = measure_enclosed_lattice_correspondences(p.request.current_observed_frame or p.request.frame, contract)
    layouts = tuple(item for item in layouts if item['geometry_token'] == snap['geometry_token'])
    if not complete or len(layouts) != 1:
        return _proposal(InterfaceObservation(request=p.request, agenda=p.agenda), p.agenda, p.facts, {}, evidence)
    layout, = layouts
    groups, complete = measure_external_cell_groups(p.request.current_observed_frame or p.request.frame,
        components, (layout['box'], layout['small_box']), contract)
    population = tuple(tuple(v) for v in snap['population'])
    index = snap['member_index']
    markers = _markers(layout, groups, population[index]) if complete else None
    if markers is None or tuple(markers) != tuple(tuple(v) for v in snap['member_settings'][index]):
        return _proposal(InterfaceObservation(request=p.request, agenda=p.agenda), p.agenda, p.facts, {}, evidence)
    refs = tuple('measurement.population_member.'+str(i) for i in range(len(population)))
    pad_refs = tuple('measurement.population_pad.'+str(i) for i in range(len(groups)))
    pads = tuple(JoystickPad(pad_ref=ref, occurrence_ref=refs[index], enabled=True,
        row_setting=markers[i][0], column_setting=markers[i][1],
        row_domain=tuple(range(group['height'])) if all(snap['models'][index][i][j] is not None for j in (0, 2)) else (markers[i][0],),
        column_domain=tuple(range(group['width'])) if all(snap['models'][index][i][j] is not None for j in (1, 3)) else (markers[i][1],))
        for i, (ref, group) in enumerate(zip(pad_refs, groups)))
    current = JoystickState(occurrences=tuple(JoystickOccurrence(occurrence_ref=ref, color_ref=str(v[0]), row=v[1], column=v[2])
        for ref, v in zip(refs, population)), pads=pads, active_occurrence_ref=refs[index], draw_order=refs)
    model = JoystickModel(model_ref=cfg['model_ref'], height=layout['height'], width=layout['width'],
        displacement_law=cfg['displacement_law'], crossing_count_law=None, stacking_allowed=None,
        draw_order_law=None, nudge_bound_law=None, nudge_cost=None, wrap_cost=None,
        pad_gains=tuple((ref, tuple(snap['models'][index][i])) for i, ref in enumerate(pad_refs)))
    old_contract = contract['inverse_contract']
    scope = DMechanicalScope(request_ref='measurement.population_inverse.'+stable_digest(snap),
        caller_ref=old_contract['caller_ref'], parent_consumer_ref=old_contract['parent_consumer_ref'],
        parent_goal_ref=old_contract['parent_goal_ref'], parent_contribution_ref=old_contract['parent_contribution_ref'],
        caller_next_item_ref=old_contract['caller_next_item_ref'], epoch=p.request.current_context_epoch,
        evidence_revision_ref=p.request.current_observation_ref, model_revision_ref=p.request.current_observation_ref,
        model_status_ref=cfg['model_status_ref'], event_owner_ref=old_contract['event_owner_ref'],
        input_domain_complete=True, assumption_refs=tuple(p.evidence_refs)+(declared['program_witness_claim_ref'],))
    calculation = measure_bounded_joystick(BoundedJoystickRequest(scope=scope,
        operation_ref=old_contract['preimages']['operation_ref'], mode_ref=old_contract['preimages']['mode_ref'],
        requested_result_type='DMechanicalResult', node_bound=old_contract['node_bound'],
        depth_bound=old_contract['depth_bound'], domain_bound=cfg['domain_bound'],
        time_bound_ms=old_contract['time_bound_ms'], models=(model,), state=current, occurrence_ref=refs[index]))
    result_rows = calculation.values.get('model_correlated_results', ())
    preimages = (result_rows[0]['result']['preimages'] if calculation.status == 'COMPLETE'
                 and calculation.domain_complete and len(result_rows) == 1 else ())
    desired = tuple(snap['target_population'][index][1:])
    target_rows = tuple(item for item in preimages if tuple(item['position']) == desired and item['changed_settings'])
    # Source requests a canonical shortest setting witness, not a ranking of
    # goals. Retain one witness; do not keep rejected executable alternatives.
    ordered = sorted(target_rows, key=lambda item: (len(item['changed_settings']), stable_digest(item['settings'])))
    rows = {}
    for item in ordered:
        setting = JoystickSetting.model_validate(item['changed_settings'][0])
        pi = pad_refs.index(setting.pad_ref)
        gain = snap['models'][index][pi]
        dr, dc = setting.row-markers[pi][0], setting.column-markers[pi][1]
        next_position = ((population[index][1]+sum(g*delta for g, delta in zip(gain[:2], (dr, dc)) if delta)) % layout['height'],
                         (population[index][2]+sum(g*delta for g, delta in zip(gain[2:], (dr, dc)) if delta)) % layout['width'])
        cells = tuple(c for c in groups[pi]['cells'] if (c['row_index'], c['column_index']) == (setting.row, setting.column))
        if len(cells) == 1 and next_position not in {tuple(v[1:]) for j, v in enumerate(population) if j != index}:
            next_markers = tuple((setting.row, setting.column) if j == pi else pair for j, pair in enumerate(markers))
            snapshot = {**snap, 'kind': 'population_inverse', 'point': cells[0]['point'],
                'requested_setting': (setting.row, setting.column),
                'pad_index': pi, 'generation': snap['generation']+1, 'expected_next_position': next_position,
                'expected_next_markers': next_markers,
                'axis_model_parent_claim_ref': declared['program_witness_claim_ref']}
            ref, output = _row(p.facts, snapshot, contract['point_action_ref'], program_inverse_ready=True,
                program_inverse_domain_complete=True, population_inverse_cost=len(item['changed_settings']))
            rows[ref] = output
            break
    if calculation.status == 'COMPLETE' and calculation.domain_complete:
        for pi, group in enumerate(groups):
            for order, (dr, dc) in enumerate(contract['calibration_setting_deltas']):
                axis = 0 if dr else 1
                if desired[axis] == population[index][axis+1] or all(snap['models'][index][pi][j] is not None for j in (axis, axis+2)):
                    continue
                rr, cc = markers[pi][0]+dr, markers[pi][1]+dc
                cells = tuple(c for c in group['cells'] if (c['row_index'], c['column_index']) == (rr, cc))
                if len(cells) != 1:
                    continue
                snapshot = {**snap, 'kind': 'population_probe', 'point': cells[0]['point'],
                    'requested_setting': (rr, cc),
                    'pad_index': pi, 'generation': snap['generation']+1, 'calibration_axis': axis,
                    'calibration_origin': {'markers': markers, 'population': population},
                    'axis_model_parent_claim_ref': declared['program_witness_claim_ref']}
                ref, output = _row(p.facts, snapshot, contract['point_action_ref'], program_probe_ready=True,
                    program_direction_axis_supported=True, direction_order=order)
                rows[ref] = output
    return _proposal(InterfaceObservation(request=p.request, agenda=p.agenda), p.agenda, p.facts, rows, evidence)
