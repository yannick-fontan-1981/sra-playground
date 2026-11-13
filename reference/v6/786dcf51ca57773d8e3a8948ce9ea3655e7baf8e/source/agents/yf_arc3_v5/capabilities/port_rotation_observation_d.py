"""Bounded raster/finite-relation adapter for a declared conditional port model.

No palette, game identity or solved layout is provided. The declaration owns
quarter-turn meaning, terminal predicates, edit order and hypothesis admission.
This narrow adapter requires one complete finite assignment, not a heuristic.
"""
from collections import Counter, defaultdict
from functools import reduce
from math import gcd

from agents.yf_arc3_v5.logos.types import FrozenMap, immutable_json_data, stable_digest
from .finite_search_contracts_c import FiniteVariableC, FiniteRelationC, FiniteSearchInputC
from .finite_search_c import enumerate_finite_relations
from .mechanical_request_contracts import MechanicalRequestIdentity
from .mechanical_family_contracts_d import DMechanicalScope
from .reciprocal_port_graph_d import (
    GraphPortD, PortCellD, ReciprocalPortGraphRequestD, measure_reciprocal_port_graph_d,
)


def _two_tone_stripe(values, background):
    if values[0] != background or values[-1] != background:
        return False
    middle = values[1:-1]
    outer = middle[0]
    if outer == background:
        return False
    flank = next((i for i, item in enumerate(middle) if item != outer), len(middle))
    if not flank or flank * 2 >= len(middle) or middle[-flank:] != (outer,) * flank:
        return False
    core = middle[flank:-flank]
    return len(core) % 2 == 1 and len(set(core)) == 1 and core[0] not in (outer, background)


def _port_fields(frame, components, contract):
    borders = []
    for component in components:
        box = component.bbox
        if box.width != box.height or not 9 <= box.width < min(frame.height, frame.width):
            continue
        t, l, b, r = box.top, box.left, box.bottom, box.right
        if (all(frame.rows[y][l] == frame.rows[y][r] == component.value for y in range(t, b + 1))
                and all(frame.rows[t][x] == frame.rows[b][x] == component.value for x in range(l, r + 1))):
            borders.append((t, l, b, r, component.component_id))
    if len(borders) > contract['maximum_frame_candidates']:
        return ()
    fields = {}
    for t, l, b, r, component_ref in sorted(borders):
        counts = Counter(frame.rows[y][x] for y in range(t + 1, b) for x in range(l + 1, r))
        modes = tuple(item for item, count in sorted(counts.items()) if count == max(counts.values()))
        if len(modes) != 1:
            continue
        background = modes[0]
        for extent in range(5, contract['maximum_cross_section_extent'] + 1, 2):
            radius = extent // 2
            rows, cols = Counter(), Counter()
            for y in range(t + radius, b - radius + 1):
                for x in range(l + radius, r - radius + 1):
                    vertical = tuple(frame.rows[k][x] for k in range(y - radius, y + radius + 1))
                    horizontal = tuple(frame.rows[y][k] for k in range(x - radius, x + radius + 1))
                    if _two_tone_stripe(vertical, background):
                        rows[y] += 1
                    if _two_tone_stripe(horizontal, background):
                        cols[x] += 1
            observed_rows = tuple(sorted(y for y, count in rows.items() if count >= 2))
            observed_cols = tuple(sorted(x for x, count in cols.items() if count >= 2))
            differences = tuple(d - a for axis in (observed_rows, observed_cols) for a, d in zip(axis, axis[1:]))
            pitch = reduce(gcd, differences) if differences else 0
            if len(observed_rows) < 2 or len(observed_cols) < 2 or pitch < extent:
                continue
            if (b - t) % pitch or (r - l) % pitch or pitch % 2:
                continue
            side = (b - t) // pitch
            if not 2 <= side <= contract['maximum_side'] or side * side > contract['maximum_cells']:
                continue
            ys = tuple(t + pitch // 2 + i * pitch for i in range(side))
            xs = tuple(l + pitch // 2 + i * pitch for i in range(side))
            if not set(observed_rows) <= set(ys) or not set(observed_cols) <= set(xs):
                continue
            # Keep face samples clear of both the central body and edge overlay.
            offset = pitch // 2 - contract['face_edge_inset']
            if offset <= radius:
                continue
            masks = []
            for y in ys:
                for x in xs:
                    faces = []
                    for dy, dx in contract['face_vectors']:
                        cy, cx = y + dy * offset, x + dx * offset
                        profile = tuple(frame.rows[cy + k * dx][cx + k * dy]
                                        for k in range(-radius, radius + 1))
                        faces.append(_two_tone_stripe(profile, background))
                    masks.append(tuple(faces))
            if any(not any(mask) for mask in masks):
                continue
            key = (t, l, b, r, pitch, extent, tuple(masks))
            fields[key] = {'border': (t, l, b, r), 'pitch': pitch, 'extent': extent,
                           'side': side, 'masks': tuple(masks), 'component_ref': component_ref,
                           'centers': tuple((y, x) for y in ys for x in xs)}
    return tuple(fields[key] for key in sorted(fields))


def _finite_assignment(masks, side, value, token, contract):
    variables, domains, mask_by_ref = [], [], {}
    for index, mask in enumerate(masks):
        row, col = divmod(index, side)
        orbit, rotated = [], mask
        while rotated not in tuple(item[0] for item in orbit):
            orbit.append((rotated, len(orbit)))
            rotated = (rotated[-1], *rotated[:-1])
        admitted = tuple((item, cost) for item, cost in orbit if not (
            (row == 0 and item[0]) or (col == side - 1 and item[1])
            or (row == side - 1 and item[2]) or (col == 0 and item[3])))
        refs, costs = [], {}
        for item, cost in admitted:
            ref = 'measurement.port_mask.' + ''.join(str(int(face)) for face in item)
            mask_by_ref[ref] = item
            refs.append(ref)
            costs[ref] = cost
        domains.append(tuple(refs))
        variables.append(FiniteVariableC(variable_ref=f'measurement.port_cell.{index}',
                                        values=tuple(refs), costs=FrozenMap(costs)))
    relations = []
    for index in range(len(masks)):
        row, col = divmod(index, side)
        for neighbor, face, opposite in ((index + 1, 1, 3), (index + side, 2, 0)):
            if neighbor >= len(masks) or (face == 1 and col == side - 1):
                continue
            allowed = tuple((a, b) for a in domains[index] for b in domains[neighbor]
                            if mask_by_ref[a][face] == mask_by_ref[b][opposite])
            relations.append(FiniteRelationC(relation_ref=f'measurement.port_pair.{index}.{neighbor}',
                variable_refs=(variables[index].variable_ref, variables[neighbor].variable_ref),
                allowed_rows=allowed, domain_complete=True))
    variables, relations = tuple(variables), tuple(relations)
    order = tuple(item.variable_ref for item in variables)
    evidence = (value.current_observation_frame_ref,)
    metric = contract['cost_metric_ref']
    descriptor = (variables, relations, order, metric, True, evidence)
    request = MechanicalRequestIdentity(request_ref='measurement.port_csp.' + token,
        kernel_ref=contract['kernel_ref'], operation_ref=contract['finite_operation_ref'], mode='CSP',
        caller_ref=contract['scope']['caller_ref'],
        parent_contribution_ref=contract['scope']['parent_contribution_ref'],
        epoch=value.current_context_epoch or 0, input_revision_ref=evidence[0],
        model_assignments=FrozenMap(contract['conditional_model_assignments']),
        immutable_inputs=FrozenMap({'finite_relation_digest': stable_digest(immutable_json_data(descriptor)),
                                   'cost_metric_ref': metric}),
        actual_bounds=FrozenMap(contract['search_bounds']), expected_return_type='FiniteSearchFactsC')
    result = enumerate_finite_relations(FiniteSearchInputC(request=request, variables=variables,
        relations=relations, variable_order=order, cost_metric_ref=metric, domain_complete=True, evidence_refs=evidence))
    # Exact singleton of the COMPLETE population, not a capped witness list.
    if not result.complete or len(result.retained_frontier) != 1:
        return None
    assignment = result.retained_frontier[0]['assignment']
    return tuple(mask_by_ref[assignment[item.variable_ref]] for item in variables), result.examined_count


def _graph(masks, side, value, token, contract):
    ports = tuple(GraphPortD(port_ref=f'measurement.port_face.{i}',
        opposite_ref=f'measurement.port_face.{(i + 2) % 4}', vector=tuple(vector))
        for i, vector in enumerate(contract['face_vectors']))
    cells = tuple(PortCellD(cell_ref=f'measurement.port_cell.{i}', position=divmod(i, side),
        opening_refs=tuple(ports[j].port_ref for j in range(4) if mask[j]), opening_mask_complete=True)
        for i, mask in enumerate(masks))
    scope = DMechanicalScope(**dict(contract['scope']), request_ref='measurement.port_graph.' + token,
        evidence_revision_ref=value.current_observation_frame_ref, model_revision_ref=token,
        epoch=value.current_context_epoch or 0, input_domain_complete=True)
    return measure_reciprocal_port_graph_d(ReciprocalPortGraphRequestD(scope=scope,
        operation_ref=contract['graph_operation_ref'], mode_ref='EVALUATE', phase_ref='RECIPROCAL_CONNECTIVITY',
        requested_result_type='DMechanicalResult', **dict(contract['graph_bounds']), ports=ports,
        cells=cells, source_refs=(), source_connectivity_rule='ONE_COMMON_COMPONENT', cell_domain_complete=True,
        require_all_source_connected=False, require_no_unmatched_ports=True, require_no_cycles=True))


def measure_port_rotation_loci(value, frame, components, contract):
    if (not contract or contract['quarter_turn'] != 'CLOCKWISE' or contract['edit_order'] != 'ROW_MAJOR'
            or frame.width * frame.height > contract['maximum_frame_pixels']
            or len(components) > contract['maximum_components'] or not value.current_observation_frame_ref):
        return ()
    fields = _port_fields(frame, components, contract)
    if len(fields) != 1:
        return ()
    field = fields[0]
    masks = field['masks']
    # Palette-independent and orientation-invariant inventory signature.
    def orbit_signature(mask):
        rotations = []
        for _ in range(4):
            rotations.append(mask)
            mask = (mask[-1], *mask[:-1])
        return min(rotations)
    token = stable_digest((field['border'], field['pitch'], field['extent'],
                           tuple(orbit_signature(mask) for mask in masks)))
    carried = value.canonical_dispatched_goal_continuity_facts.get('dispatched_composition_target_context') or {}
    prior = bool(carried.get('port_rotation_geometry_token'))
    matches = None
    compatible_offsets = tuple(contract['initial_click_quarter_offsets'])
    if prior:
        matches = (carried.get('port_rotation_geometry_token') == token
            and carried.get('port_rotation_context_epoch') == value.current_context_epoch
            and value.previous_action_observed_frame is not None
            and carried.get('port_rotation_source_frame_digest') == stable_digest(value.previous_action_observed_frame.rows)
            and masks == tuple(tuple(item) for item in carried.get('port_rotation_expected_masks', ())))
        if not matches:
            return ()
        before = tuple(carried['port_rotation_before_mask'])
        actual = masks[carried['port_rotation_edit_index']]
        offset_masks, rotated = [], before
        for _ in range(4):
            offset_masks.append(rotated)
            rotated = (rotated[-1], *rotated[:-1])
        compatible_offsets = tuple(offset for offset in carried['port_rotation_compatible_quarter_offsets']
                                   if offset_masks[offset] == actual)
        if not compatible_offsets:
            return ()
        target = tuple(tuple(item) for item in carried['port_rotation_target_masks'])
        examined = 0
    else:
        result = _finite_assignment(masks, field['side'], value, token, contract)
        if result is None:
            return ()
        target, examined = result
    graph = _graph(target, field['side'], value, token, contract)
    # Compile the one declaration-ordered witness. No puzzle order is supplied.
    edits = []
    for index, (mask, terminal) in enumerate(zip(masks, target)):
        rotated = mask
        for _ in range(4):
            if rotated == terminal:
                break
            following = (rotated[-1], *rotated[:-1])
            edits.append((index, rotated, following))
            rotated = following
        if rotated != terminal:
            return ()
    if not edits:
        return ()
    index, before, after = edits[0]
    expected = tuple(after if i == index else item for i, item in enumerate(masks))
    return (FrozenMap({'point': field['centers'][index], 'component_ref': field['component_ref'],
        'port_rotation_geometry_token': token, 'port_rotation_context_epoch': value.current_context_epoch,
        'port_rotation_source_frame_ref': value.current_observation_frame_ref,
        'port_rotation_source_frame_digest': stable_digest(frame.rows),
        'port_rotation_masks': masks, 'port_rotation_expected_masks': expected,
        'port_rotation_target_masks': target, 'port_rotation_edit_index': index,
        'port_rotation_before_mask': before, 'port_rotation_after_mask': after,
        'port_rotation_remaining_edit_count': len(edits), 'port_rotation_edit_witness': tuple(edits),
        'port_rotation_previous_prediction_matches': matches, 'port_rotation_assignment_reused': prior,
        'port_rotation_compatible_quarter_offsets': compatible_offsets,
        'port_rotation_finite_examined_count': examined, 'port_rotation_complete_singleton_count': 1,
        'port_rotation_graph_complete': graph.domain_complete,
        'port_rotation_terminal_component_count': len(graph.values.get('components', ())),
        'port_rotation_terminal_unmatched_count': len(graph.values.get('unmatched_incidences', ())),
        'port_rotation_terminal_cycle_count': graph.values.get('independent_cycle_count'),
        'port_rotation_source_connectivity_not_requested': True,
        'port_rotation_conditional_model': True, 'port_rotation_pitch': field['pitch'],
        'port_rotation_border': field['border']}),)
