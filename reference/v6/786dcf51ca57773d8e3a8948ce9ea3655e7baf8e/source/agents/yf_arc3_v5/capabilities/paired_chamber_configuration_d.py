"""Source-declared quantized incidence hypothesis through the finite service.

Geometry and the complete current pose constrain the provisional model. The
existing finite-relation service supplies all minimum-cost settings; DRM owns
their meaning, priority and one currently revalidated experimental primitive.
"""
from itertools import product
from types import SimpleNamespace

from agents.yf_arc3_v5.logos.types import FrozenMap, immutable_json_data, stable_digest
from .finite_search_contracts_c import FiniteVariableC, FiniteRelationC, FiniteSearchInputC
from .finite_search_c import enumerate_finite_relations
from .mechanical_request_contracts import MechanicalRequestIdentity


def _sign(value):
    return (value > 0) - (value < 0)


def measure_paired_configuration(value, scene, contract):
    if not contract or contract.get('projection_ref') != 'signed_unit_incidence_coordinate_sign':
        return None
    rooms, controls = scene['main_rooms'], scene['controls']
    if (not controls or len(controls) > contract['maximum_control_count']
            or len({tuple(c['typed_pair']) for c in controls}) != len(controls)):
        return None
    from .paired_chamber_controls_d import _edges
    expected_edges = {(a, b, axis) for a, b, axis, _, _ in _edges(tuple(
        (r['bounds'], SimpleNamespace(value=r['paint'])) for r in rooms))}
    measured_edges = tuple(edge for control in controls for edge in control['main_incidence_indices'])
    if set(measured_edges) != expected_edges or len(measured_edges) != len(expected_edges):
        return None
    modes = tuple(sorted({c['modal_band_paint'] for c in controls}))
    centers = tuple((r['bounds'][0] + r['bounds'][2],
                     r['bounds'][1] + r['bounds'][3]) for r in rooms)
    current = tuple(tuple(r['body_center2']) for r in rooms)
    quanta = {abs(p[k] - center[k]) for p, center in zip(current, centers)
              for k in (0, 1) if p[k] != center[k]}
    if len(modes) != 2 or len(quanta) != 1:
        return None
    quantum = next(iter(quanta))
    start = tuple(modes.index(c['modal_band_paint']) for c in controls)

    def poses(bits, polarity):
        forces = [[0, 0] for _ in rooms]
        for bit, control in zip(bits, controls):
            force = polarity if bit else -polarity
            for a, b, axis in control['main_incidence_indices']:
                direction = _sign(centers[b][axis] - centers[a][axis])
                forces[a][axis] += force * direction
                forces[b][axis] -= force * direction
        return tuple(tuple(center[k] + quantum * _sign(force[k]) for k in (0, 1))
                     for center, force in zip(centers, forces))

    polarities = tuple(p for p in (-1, 1) if poses(start, p) == current)
    if len(polarities) != 1:
        return None
    polarity = polarities[0]
    targets = {i: tuple(r['fitting_frame_center2']) for i, r in enumerate(rooms)
               if r['fitting_frame_center2'] is not None}
    # A larger solid is not silently relabeled as an occluded fitting frame.
    # Preserve its observed location while configuring the explicit outlines.
    preserved = {i: current[i] for i, r in enumerate(rooms)
                 if 'observed_solid_body_bbox' in r}
    goals = {**targets, **preserved}
    if not targets or not any(current[i] != point for i, point in sorted(targets.items())):
        return None
    incidents = tuple(tuple(j for j, c in enumerate(controls)
                            if any(i in (a, b) for a, b, _ in c['main_incidence_indices']))
                      for i in range(len(rooms)))
    variables = tuple(FiniteVariableC(variable_ref=f'measurement.paired_control.{i}',
        values=('measurement.mode.0', 'measurement.mode.1'),
        costs=FrozenMap({f'measurement.mode.{bit}': int(bit != start[i]) for bit in (0, 1)}))
        for i in range(len(controls)))
    relations = []
    for room_index, target in sorted(goals.items()):
        indices = incidents[room_index]
        if not indices:
            return None
        allowed = []
        for local in product((0, 1), repeat=len(indices)):
            bits = list(start)
            for index, bit in zip(indices, local):
                bits[index] = bit
            if poses(bits, polarity)[room_index] == target:
                allowed.append(tuple(f'measurement.mode.{bit}' for bit in local))
        relations.append(FiniteRelationC(relation_ref=f'measurement.paired_room.{room_index}',
            variable_refs=tuple(variables[i].variable_ref for i in indices),
            allowed_rows=tuple(allowed), domain_complete=True))
    relations = tuple(relations)
    order = tuple(v.variable_ref for v in variables)
    evidence = (scene['source_frame_ref'],)
    metric = contract['cost_metric_ref']
    descriptor = (variables, relations, order, metric, True, evidence)
    token = stable_digest(immutable_json_data((scene, polarity, quantum)))[:16]
    request = MechanicalRequestIdentity(request_ref='measurement.paired_configuration.' + token,
        kernel_ref=contract['kernel_ref'], operation_ref=contract['finite_operation_ref'], mode='CSP',
        caller_ref=contract['scope']['caller_ref'],
        parent_contribution_ref=contract['scope']['parent_contribution_ref'],
        epoch=value.current_context_epoch or 0, input_revision_ref=evidence[0],
        model_assignments=FrozenMap({**dict(contract['conditional_model_assignments']),
            'measured_quantum2': quantum, 'measured_mode_polarity': polarity}),
        immutable_inputs=FrozenMap({'finite_relation_digest': stable_digest(immutable_json_data(descriptor)),
                                   'cost_metric_ref': metric}),
        actual_bounds=FrozenMap(contract['search_bounds']), expected_return_type='FiniteSearchFactsC')
    result = enumerate_finite_relations(FiniteSearchInputC(request=request, variables=variables,
        relations=relations, variable_order=order, cost_metric_ref=metric,
        domain_complete=True, evidence_refs=evidence))
    examined = result.examined_count
    for _ in range(contract['maximum_finite_batches'] - 1):
        if result.complete or not result.bounded or result.checkpoint is None:
            break
        result = enumerate_finite_relations(result.request.model_copy(update={'resume': result.checkpoint}))
        examined += result.examined_count
    if not result.complete or result.minimum_cost is None or result.minimum_cost == 0:
        return None
    # Use the complete population, never the finite service's capped witnesses.
    optimal = tuple(row['assignment'] for row in result.retained_frontier
                    if row['cost'] == result.minimum_cost)
    if not optimal:
        return None
    aligned = {i: point for i, point in sorted(goals.items()) if current[i] == point}
    common = FrozenMap({'source_frame_ref': evidence[0],
        'source_frame_digest': scene['source_frame_digest'], 'context_epoch': scene['context_epoch'],
        'conditional_model_assignments': request.model_assignments,
        'current_model_count': len(polarities), 'current_pose_count': len(current),
        'current_poses2': current, 'current_control_modes': tuple(c['modal_band_paint'] for c in controls),
        'observed_outline_targets2': FrozenMap({str(i): p for i, p in sorted(targets.items())}),
        'preserved_unresolved_solid_poses2': FrozenMap({str(i): p for i, p in sorted(preserved.items())}),
        'minimum_remaining_toggles': result.minimum_cost, 'minimum_assignment_count': len(optimal),
        'minimum_assignments': optimal, 'finite_request': request.model_dump(mode='json'),
        'finite_complete': result.complete, 'finite_examined_count': examined})
    rows = {}
    for index, control in enumerate(controls):
        required = any(assignment[variables[index].variable_ref] != f'measurement.mode.{start[index]}'
                       for assignment in optimal)
        bits = list(start)
        bits[index] = 1 - bits[index]
        predicted = poses(bits, polarity)
        maintains = all(predicted[i] == point for i, point in sorted(aligned.items()))
        rows[tuple(control['point'])] = FrozenMap({
            'paired_configuration_model_currently_complete': True,
            'paired_configuration_control_on_minimum_assignment': required,
            'paired_configuration_preserves_current_aligned_poses': maintains,
            'paired_configuration_current_measurement': FrozenMap.overlay({
                'control_index': index, 'current_mode': start[index],
                'predicted_next_poses2': predicted,
                'predicted_next_control_modes': tuple(modes[bit] for bit in bits),
                'preserves_current_aligned_poses': maintains}, common)})
    return rows
