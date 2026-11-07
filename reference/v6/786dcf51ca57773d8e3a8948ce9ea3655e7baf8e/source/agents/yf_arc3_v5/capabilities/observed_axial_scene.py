"""Finite pixel calibrations for bounded edge-pair questions; no force law."""
from collections import defaultdict
from math import gcd

from .contracts import ComponentExtractionInput
from .components import detect_components
from ..logos.types import FrozenMap, stable_digest, immutable_json_data


def opposite_translation_quanta(records, maximum):
    result = set()
    for record in records:
        if not record.small_component_translations_complete:
            continue
        deltas = {(row[5], row[6]) for row in record.small_component_translations}
        for dr, dc in deltas:
            quantum = abs(dr) + abs(dc)
            if bool(dr) != bool(dc) and 1 < quantum <= maximum and (-dr, -dc) in deltas:
                result.add(quantum)
    return tuple(sorted(result))


def annotate_observed_axial(value, agenda):
    if not value.retained_physical_transition_receipt or not any(c.point is not None for c in agenda.candidates):
        return agenda
    if not opposite_translation_quanta(value.sparse_raster_transitions, 32) and not any(
            min(c.bbox.height, c.bbox.width) >= 6 and gcd(c.bbox.height, c.bbox.width) > 1
            for c in value.components.components):
        return agenda
    packet = immutable_json_data({'receipt': value.retained_physical_transition_receipt,
        'frame_ref': value.current_observation_frame_ref, 'level_index': value.observed_level_index,
        'epoch': value.current_context_epoch})
    shared = FrozenMap({'observed_axial_scene_input': packet})
    return agenda.model_copy(update={'context_facts': FrozenMap.overlay(shared, agenda.context_facts)})


def measure_edge_field_candidates(frame, records, configuration):
    """Enumerate complete rectangular calibrations and edge-pattern groups.

    Pole labels and object/receiver roles are not assigned here. The caller
    retains every candidate; a finite bound is never a uniqueness certificate.
    """
    quanta = opposite_translation_quanta(records, configuration['maximum_pitch'])
    components = detect_components(ComponentExtractionInput(frame=frame, connectivity=4)).components
    if len(components) > configuration['maximum_components']:
        return {'rows': (), 'enumeration_complete': False}
    fields, rows = [], []
    for component in components:
        box = component.bbox
        t, l, b, r = box.top, box.left, box.bottom, box.right
        if not (all(frame.rows[t][x] == frame.rows[b][x] == component.value for x in range(l, r + 1))
                and all(frame.rows[y][l] == frame.rows[y][r] == component.value for y in range(t, b + 1))):
            continue
        candidate_quanta = tuple(sorted(set(quanta) | {q for q in range(2, configuration['maximum_pitch'] + 1)
            if box.height % q == box.width % q == 0 and min(box.height // q, box.width // q) >= 3}))
        for quantum in candidate_quanta:
            if (box.height % quantum or box.width % quantum
                    or min(box.height // quantum, box.width // quantum) < 3):
                continue
            nr, nc = box.height // quantum, box.width // quantum
            if nr * nc > configuration['maximum_cells']:
                return {'rows': (), 'enumeration_complete': False}
            poles, patterns, matrices = [], defaultdict(list), {}
            for row in range(nr):
                for col in range(nc):
                    y, x = t + row * quantum, l + col * quantum
                    matrix = tuple(tuple(line[x:x + quantum]) for line in frame.rows[y:y + quantum])
                    token = stable_digest(matrix)
                    patterns[token].append((row, col)); matrices[token] = matrix
                    sides = (matrix[0], matrix[-1], tuple(line[0] for line in matrix), tuple(line[-1] for line in matrix))
                    for first, second in ((sides[0], sides[1]), (sides[2], sides[3])):
                        if len(set(first)) == len(set(second)) == 1 and first[0] != second[0]:
                            poles.append({'cell': (row, col), 'edge_values': tuple(sorted((first[0], second[0]))),
                                'neutral_values': tuple(sorted({v for side in sides for v in side} - {first[0], second[0]}))})
            fields.append((t, l, b, r, quantum))
            if len(fields) > configuration['maximum_fields']:
                return {'rows': (), 'enumeration_complete': False}
            pair_translation_support_count = 0
            if len(poles) == 2:
                for record in records:
                    if not record.small_component_translations_complete:
                        continue
                    supported = [set(), set()]
                    for translation in record.small_component_translations:
                        _, before_y, before_x, height, width, dr, dc, _ = translation
                        if bool(dr) == bool(dc) or abs(dr) + abs(dc) != quantum:
                            continue
                        after_y, after_x = before_y + dr, before_x + dc
                        for index, pole in enumerate(poles):
                            row, col = pole['cell']
                            y, x = t + row * quantum, l + col * quantum
                            if y <= after_y and after_y + height <= y + quantum and x <= after_x and after_x + width <= x + quantum:
                                supported[index].add((dr, dc))
                    if any((-dr, -dc) in supported[1] for dr, dc in supported[0]):
                        pair_translation_support_count = 2
                        break
            bordered = []
            for token, positions in sorted(patterns.items()):
                matrix = matrices[token]
                perimeter = {*matrix[0], *matrix[-1], *(line[0] for line in matrix), *(line[-1] for line in matrix)}
                interior = {v for line in matrix[1:-1] for v in line[1:-1]}
                if len(perimeter) == 1 and interior - perimeter:
                    bordered.append((token, tuple(positions), tuple(sorted({v for line in matrix for v in line}))))
            for token, positions, palette in bordered:
                between = False
                if len(poles) == 2 and len(positions) == 1:
                    a, z = (p['cell'] for p in poles); c = positions[0]
                    between = ((a[0] == z[0] == c[0] and min(a[1], z[1]) < c[1] < max(a[1], z[1]))
                        or (a[1] == z[1] == c[1] and min(a[0], z[0]) < c[0] < max(a[0], z[0])))
                rows.append({'field': (t, l, b, r, quantum, nr, nc), 'poles': tuple(poles),
                    'pattern_ref': token, 'positions': positions, 'palette': palette,
                    'pair_translation_support_count': pair_translation_support_count,
                    'translation_quantum_observed': quantum in quanta,
                    'pole_cell_count': len(poles), 'locus_occurrence_count': len(positions),
                    'locus_between_pair': between, 'shared_edge_palette_count': len({p['edge_values'] for p in poles}),
                    'singleton_bordered_pattern_count': sum(len(p[1]) == 1 for p in bordered)})
    pair_calibrations = {row['field'] for row in rows if row['pole_cell_count'] == 2
        and row['locus_occurrence_count'] == 1 and row['locus_between_pair']}
    return {'rows': tuple({**row, 'calibration_count': len(fields),
        'pair_calibration_count': len(pair_calibrations)} for row in rows), 'enumeration_complete': True}
