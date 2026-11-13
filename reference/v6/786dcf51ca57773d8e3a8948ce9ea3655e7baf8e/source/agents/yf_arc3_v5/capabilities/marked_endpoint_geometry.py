"""Bounded cell/glyph/offset measurements; meaning and probe order stay in DRM."""
from collections import Counter

from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest

from .components import detect_components
from .contracts import ComponentExtractionInput
from .relations import _distances_with_predecessors, _first_shortest_path


def _scene(value, frame, lattice, contract):
    if (frame is None or frame.height * frame.width > contract['maximum_pixels']
            or lattice.get('regular_multicell_bbox_lattice_enumeration_truncated')
            or lattice.get('regular_multicell_bbox_lattice_description_count') != 1
            or len(value.components.components) > contract['maximum_components']):
        return None
    grid = lattice['regular_multicell_bbox_lattice_descriptions'][0]
    height, width = grid['cell_bbox_height'], grid['cell_bbox_width']
    rp, cp = grid['row_pitch'], grid['column_pitch']
    top, left = grid['row_offset'], grid['column_offset']
    if grid['lattice_capacity'] > contract['maximum_cells']:
        return None
    # Reuse the measured regular crop domain, including layered crops.
    positions = set()
    for sprite in value.sprites:
        box = sprite.bbox
        if (box.height == height and box.width == width
                and (box.top - top) % rp == 0 and (box.left - left) % cp == 0):
            positions.add(((box.top - top) // rp, (box.left - left) // cp))
    if len(positions) != grid['occupied_lattice_position_count']:
        return None
    rectangles = {cell: (top + cell[0] * rp, left + cell[1] * cp,
                         top + cell[0] * rp + height - 1, left + cell[1] * cp + width - 1)
                  for cell in sorted(positions)}
    fills = {}
    for cell, (t, column_left, b, r) in sorted(rectangles.items()):
        histogram = Counter(frame.rows[y][x] for y in range(t, b + 1)
                            for x in range(column_left, r + 1))
        dominant = tuple(pixel for pixel, count in sorted(histogram.items())
                         if count * 2 > height * width)
        if len(dominant) == 1:
            fills[cell] = dominant[0]
    counts = Counter(fills[cell] for cell in sorted(fills))
    if len(counts) != 2:
        return None
    peak = max(counts[value] for value in sorted(counts))
    majority = tuple(v for v, count in sorted(counts.items()) if count == peak)
    if len(majority) != 1 or peak * 2 <= len(fills):
        return None
    marked = tuple(sorted(cell for cell, color in sorted(fills.items()) if color != majority[0]))
    if not marked or len(marked) > contract['maximum_offsets']:
        return None
    # Glyph masks are read from this frame, not assigned cursor/exit roles.
    # Components of a prior frame are deliberately not reused for its masks.
    components = value.components.components if frame == value.frame else detect_components(ComponentExtractionInput(frame=frame)).components
    glyphs = []
    for component in components:
        box = component.bbox
        if component.area < 2 or box.height < 2 or box.width < 2:
            continue
        cells = tuple(cell for cell, (t, column_left, b, r) in sorted(rectangles.items())
                      if t <= box.top <= box.bottom <= b and column_left <= box.left <= box.right <= r)
        if len(cells) != 1:
            continue
        rim = frozenset((y, x) for y in range(box.height) for x in range(box.width)
                        if y in (0, box.height - 1) or x in (0, box.width - 1))
        pixels = frozenset(component.relative_pixels)
        glyphs.append((cells[0], component, pixels == rim and box.height > 2 and box.width > 2))
    pairs = tuple((a, b) for a in glyphs for b in glyphs
                  if a[2] and not b[2] and a[0] != b[0]
                  and a[1].value == b[1].value
                  and b[1].area < b[1].bbox.height * b[1].bbox.width)
    cell_pairs = {(a[0], b[0]) for a, b in pairs}
    if len(cell_pairs) != 1:
        # A partly covered cell fill can itself form a rim or a nonrectangular
        # mask. It does not add a second subcell glyph. Only disambiguate an
        # otherwise rejected scene when the proper subcell masks identify one
        # physical pair; distinct subcell pairs remain unresolved.
        subcell_pairs = {
            (a[0], b[0]) for a, b in pairs
            if all(glyph[1].bbox.height < height and glyph[1].bbox.width < width
                   for glyph in (a, b))
        }
        if len(subcell_pairs) != 1:
            return None
        cell_pairs = subcell_pairs
    perimeter_cell, compact_cell = next(iter(cell_pairs))
    # Foreground and underlay can describe the same physical pair. Preserve
    # both compact masks even when the perimeter underlay changes its fill.
    # A cue partially covered by a glyph retains its strictly dominant fill.
    signature = tuple(sorted((glyph[1].value, tuple(sorted(glyph[1].relative_pixels)))
                             for glyph in glyphs if glyph[0] == compact_cell
                             and glyph[1].area < glyph[1].bbox.height * glyph[1].bbox.width))
    partial_marks = []
    if contract.get('measure_partial_marked_cell_boundaries'):
        marked_value = next(v for v in sorted(counts) if v != majority[0])
        for cell, (t, l, b, r) in sorted(rectangles.items()):
            if cell in marked or not any(g[0] == cell and g[1].bbox.height < height
                                         and g[1].bbox.width < width for g in glyphs):
                continue
            sides = (all(frame.rows[t][x] == marked_value for x in range(l, r + 1)),
                     all(frame.rows[y][r] == marked_value for y in range(t, b + 1)),
                     all(frame.rows[b][x] == marked_value for x in range(l, r + 1)),
                     all(frame.rows[y][l] == marked_value for y in range(t, b + 1)))
            longest = max((length for start in range(4) for length in range(1, 5)
                           if all(sides[(start + shift) % 4] for shift in range(length))), default=0)
            if longest >= contract['minimum_adjacent_marked_boundary_sides']:
                partial_marks.append(cell)
        marked = tuple(sorted(set(marked) | set(partial_marks)))
        if len(marked) > contract['maximum_offsets']:
            return None
    token = stable_digest((tuple(sorted(grid.items())), tuple(sorted(positions)), signature, perimeter_cell,
                           value.current_context_epoch))[:24]
    offsets = tuple(sorted((r - compact_cell[0], c - compact_cell[1]) for r, c in marked))
    proper_pairs = tuple((a, b) for a, b in pairs
                         if a[0] == perimeter_cell and b[0] == compact_cell
                         and all(g[1].bbox.height < height and g[1].bbox.width < width
                                 for g in (a, b)))
    inner_values, groups = (), ()
    if len(proper_pairs) == 1:
        box = proper_pairs[0][0][1].bbox
        inner_values = tuple(sorted({frame.rows[y][x]
                                     for y in range(box.top + 1, box.bottom)
                                     for x in range(box.left + 1, box.right)}))
        if len(inner_values) == 1:
            populations = {}
            for cell, component, rim in glyphs:
                if (cell in (perimeter_cell, compact_cell) or rim
                        or component.value != inner_values[0]
                        or component.bbox.height >= height or component.bbox.width >= width):
                    continue
                mask = (component.value, tuple(sorted(component.relative_pixels)))
                populations.setdefault(mask, set()).add(cell)
            groups = tuple((stable_digest(mask), mask[0], tuple(sorted(cells)))
                           for mask, cells in sorted(populations.items()))
    return {'token': token, 'grid': grid, 'rectangles': rectangles, 'positions': tuple(sorted(positions)),
            'perimeter_cell': perimeter_cell, 'compact_cell': compact_cell, 'signature': signature,
            'marked': marked, 'partial_marks': tuple(partial_marks),
            'offsets': offsets, 'perimeter_inner_values': inner_values,
            'matching_subcell_groups': groups}


def _bounded_waypoint_walk(source, target, neighbors, required, maximum_states,
                           *, require_before_target):
    """One shortest witness under supplied finite coverage/admission parameters.

    Required positions and the target-entry condition are caller parameters,
    never an inferred collection law. Revisiting a position with a different
    coverage mask is a distinct state. Only the retained witness is returned.
    """
    required = tuple(sorted(set(required)))
    referenced = {source, target, *required}
    referenced.update(other for _ref, adjacent in sorted(neighbors.items())
                      for other in sorted(adjacent))
    missing = tuple(sorted(referenced - set(neighbors)))
    if missing:
        return (), 0, False, missing
    if maximum_states < 1 or len(required) >= maximum_states.bit_length():
        return (), 0, True, ()
    mask_count = 1 << len(required)
    if len(neighbors) * mask_count > maximum_states:
        return (), 0, True, ()
    bits = {ref: 1 << index for index, ref in enumerate(required)}
    nodes = tuple(sorted(neighbors))
    width = len(str(len(nodes) - 1))
    states = {(ref, mask): f'{index:0{width}d}/{mask}'
              for index, ref in enumerate(nodes) for mask in range(mask_count)}
    positions = {state: ref for (ref, _mask), state in sorted(states.items())}
    graph = {}
    complete = mask_count - 1
    for (ref, mask), state in sorted(states.items()):
        adjacent = set()
        for other in sorted(neighbors[ref]):
            next_mask = mask | bits.get(other, 0)
            if require_before_target and other == target and next_mask != complete:
                continue
            adjacent.add(states[(other, next_mask)])
        graph[state] = adjacent
    start = states[(source, bits.get(source, 0))]
    finish = states[(target, complete)]
    distances, predecessors = _distances_with_predecessors(start, graph)
    word = _first_shortest_path(source=start, target=finish,
                                predecessors=predecessors)
    return tuple(positions[ref] for ref in word[1:]), len(distances), False, ()


def append_marked_endpoint_measurements(value, agenda, lattice, point_producer):
    contract = value.route_generation_policy.get('marked_endpoint_measurement_contract', {})
    if (not contract or 'ACTION6' not in value.available_action_refs
            or len(agenda.candidates) > contract['maximum_existing_frontier_candidates']):
        return agenda
    scene = _scene(value, value.frame, lattice, contract)
    if scene is None:
        return agenda
    prior_vectors, visited = set(), set()
    prior_group_counts = {}
    prior_contact_counts = Counter()
    sample_refs = []
    for record in value.canonical_probe_precondition_facts:
        sample = record.get('support_preconditions', {}).get('marked_endpoint_vector_sample', {})
        if sample.get('geometry_token') != scene['token'] or sample.get('context_epoch') != value.current_context_epoch:
            continue
        prior_vectors.update(tuple(vector) for vector in sample.get('vectors', ()))
        visited.add(tuple(sample['compact_cell']))
        for signature, _value, cells in sample.get('matching_subcell_groups', ()):
            prior_group_counts[signature] = max(prior_group_counts.get(signature, 0), len(cells))
        if sample.get('contacted_subcell_signatures') and not sample.get('remote_rim_fill_change_count', 0):
            prior_contact_counts.update(sample['contacted_subcell_signatures'])
        sample_refs.append(record['claim_ref'])
    offsets = tuple(sorted(prior_vectors | set(scene['offsets'])))
    if len(offsets) > contract['maximum_offsets']:
        return agenda
    if len(scene['positions']) > contract['maximum_tested_positions']:
        return agenda
    refs_by_cell = {cell: f'cell:{cell[0]}:{cell[1]}' for cell in scene['positions']}
    cells_by_ref = {ref: cell for cell, ref in sorted(refs_by_cell.items())}
    neighbors = {ref: {refs_by_cell[(r + dr, c + dc)] for dr, dc in offsets
                      if (r + dr, c + dc) in refs_by_cell}
                 for (r, c), ref in sorted(refs_by_cell.items())}
    source_ref = refs_by_cell[scene['compact_cell']]
    target_ref = refs_by_cell[scene['perimeter_cell']]
    distances, predecessors = _distances_with_predecessors(source_ref, neighbors)
    word = _first_shortest_path(source=source_ref, target=target_ref, predecessors=predecessors)
    route = tuple(cells_by_ref[ref] for ref in word[1:])
    tested, truncated = len(distances), False
    first = route[0] if route else None
    group = scene['matching_subcell_groups'][0] if len(scene['matching_subcell_groups']) == 1 else None
    observed_population = max(len(group[2]), prior_group_counts.get(group[0], 0)) if group else 0
    coverage_census = bool(contract.get('enumerate_matching_subcell_waypoint_walk') and group
                           and observed_population >= contract['minimum_matching_subcell_population'])
    waypoint_route, waypoint_tested, waypoint_truncated, waypoint_missing = (), 0, False, ()
    if coverage_census:
        word, waypoint_tested, waypoint_truncated, waypoint_missing = _bounded_waypoint_walk(
            source_ref, target_ref, neighbors, tuple(refs_by_cell[cell] for cell in group[2]),
            contract['maximum_tested_positions'],
            require_before_target=contract['require_waypoints_before_perimeter_entry'])
        waypoint_route = tuple(cells_by_ref[ref] for ref in word)
    waypoint_first = waypoint_route[0] if waypoint_route else None
    confirmed = False
    contradicted = False
    contacted_cells, contact_pattern_changed = (), False
    remote_rim_fill_changes = 0
    if value.previous_action_observed_frame is not None and value.last_point_position is not None:
        old = _scene(value, value.previous_action_observed_frame, lattice, contract)
        box = scene['rectangles'][scene['compact_cell']]
        py, px = value.last_point_position
        if old and old['token'] == scene['token']:
            indicated = tuple(cell for cell in old['marked']
                if old['rectangles'][cell][0] <= py <= old['rectangles'][cell][2]
                and old['rectangles'][cell][1] <= px <= old['rectangles'][cell][3])
            contradicted = bool(indicated and scene['compact_cell'] not in indicated)
        confirmed = bool(old and old['token'] == scene['token']
            and old['compact_cell'] != scene['compact_cell']
            and scene['compact_cell'] in old['marked'] and box[0] <= py <= box[2] and box[1] <= px <= box[3])
        if old and confirmed:
            contacted_cells = tuple(cell for _signature, _value, cells in old['matching_subcell_groups']
                                    for cell in cells if cell == scene['compact_cell'])
            if contacted_cells:
                t, l, b, r = box
                contact_pattern_changed = any(value.previous_action_observed_frame.rows[y][x]
                                              != value.frame.rows[y][x]
                                              for y in range(t, b + 1) for x in range(l, r + 1))
                # A body can occlude a local pattern. Measure separate, same-value
                # rim interiors outside the cell domain without naming their role.
                previous_components = detect_components(ComponentExtractionInput(
                    frame=value.previous_action_observed_frame)).components
                matching_values = {v for _s, v, cells in old['matching_subcell_groups']
                                   if any(cell in contacted_cells for cell in cells)}
                for component in previous_components:
                    q = component.bbox
                    if component.value not in matching_values or q.height <= 2 or q.width <= 2:
                        continue
                    if any(not (q.bottom < a or q.top > c or q.right < b or q.left > d)
                           for _cell, (a, b, c, d) in sorted(scene['rectangles'].items())):
                        continue
                    rim = frozenset((y, x) for y in range(q.height) for x in range(q.width)
                                    if y in (0, q.height - 1) or x in (0, q.width - 1))
                    if frozenset(component.relative_pixels) != rim:
                        continue
                    before_count = sum(value.previous_action_observed_frame.rows[y][x] == component.value
                                       for y in range(q.top + 1, q.bottom)
                                       for x in range(q.left + 1, q.right))
                    after_count = sum(value.frame.rows[y][x] == component.value
                                      for y in range(q.top + 1, q.bottom)
                                      for x in range(q.left + 1, q.right))
                    remote_rim_fill_changes += int(after_count != before_count)
    points = tuple(((scene['rectangles'][cell][0] + scene['rectangles'][cell][2]) // 2,
                    (scene['rectangles'][cell][1] + scene['rectangles'][cell][3]) // 2)
                   for cell in scene['marked'])
    measured = point_producer(value, frozenset(agenda.current_context_no_effect_candidate_refs),
        frozenset(agenda.tested_candidate_refs_without_resolution_plan), {}, {}, {}, {}, requested_points=points)
    # The ordinary producer also retains historical effectful loci. They are
    # not members of this caller-supplied current endpoint observation domain.
    by_point = {candidate.point: (candidate, facts) for candidate, facts in measured
                if candidate.point in points}
    if set(points) != set(by_point):
        return agenda
    # One physical click remains one alternative; old descriptions are aliases.
    aliases = {point: tuple(c.candidate_ref for c in agenda.candidates
                           if c.action_ref == 'ACTION6' and c.point == point) for point in points}
    candidates = [c for c in agenda.candidates if not (c.action_ref == 'ACTION6' and c.point in by_point)]
    if len(candidates) + len(points) > contract['maximum_frontier_candidates']:
        return agenda
    retained = frozenset(c.candidate_ref for c in candidates)
    facts = {ref: agenda.alternative_facts[ref] for ref in sorted(retained)}
    old_deltas = agenda.descriptive_delta_facts or agenda.alternative_facts
    deltas = {ref: old_deltas[ref] for ref in sorted(retained)}
    sample = FrozenMap({'geometry_token': scene['token'], 'context_epoch': value.current_context_epoch,
                        'compact_cell': scene['compact_cell'], 'vectors': scene['offsets'],
                        'matching_subcell_groups': scene['matching_subcell_groups'],
                        'contacted_subcell_signatures': tuple(s for s, _v, cells in old['matching_subcell_groups']
                            if any(cell in contacted_cells for cell in cells)) if contacted_cells else (),
                        'remote_rim_fill_change_count': remote_rim_fill_changes,
                        'frame_ref': value.current_observation_frame_ref})
    counts = dict(value.candidate_execution_counts)
    for cell, point in zip(scene['marked'], points):
        if point not in by_point:
            continue
        candidate, base = by_point[point]
        ref = f"probe:measured-endpoint:{scene['token']}:r{cell[0]}:c{cell[1]}"
        vector = (cell[0] - scene['compact_cell'][0], cell[1] - scene['compact_cell'][1])
        row = FrozenMap.overlay({'candidate_ref': ref, 'candidate_execution_count': counts.get(ref, 0),
            'same_action_payload_alias_candidate_refs': aliases[point],
            'attempted_without_effect_in_current_context': ref in agenda.current_context_no_effect_candidate_refs,
            'tested_before_without_resolution_plan': ref in agenda.tested_candidate_refs_without_resolution_plan,
            'marked_endpoint_last_indicated_translation_contradicted': contradicted,
            'marked_endpoint_geometry_complete': True, 'marked_endpoint_is_current_mark': True,
            'marked_endpoint_partial_boundary_cells': scene['partial_marks'],
            'marked_endpoint_vector_sample': sample, 'marked_endpoint_sample_claim_refs': tuple(sample_refs),
            'marked_endpoint_offset': vector, 'marked_endpoint_offset_previously_indicated': vector in prior_vectors,
            'marked_endpoint_cell_previously_occupied': cell in visited,
            'marked_endpoint_prior_vector_count': len(prior_vectors), 'marked_endpoint_vector_count': len(offsets),
            'marked_endpoint_matching_subcell_group_count': len(scene['matching_subcell_groups']),
            'marked_endpoint_matching_subcell_groups': scene['matching_subcell_groups'],
            'marked_endpoint_matching_subcell_observed_population': observed_population,
            'marked_endpoint_matching_subcell_coverage_census_present': coverage_census,
            'marked_endpoint_matching_subcell_prior_contact_without_remote_change_count': prior_contact_counts.get(group[0], 0) if group else 0,
            'marked_endpoint_is_matching_subcell': bool(group and cell in group[2]),
            'marked_endpoint_waypoint_route_first': waypoint_first == cell,
            'marked_endpoint_waypoint_route_cells': waypoint_route,
            'marked_endpoint_waypoint_route_length': len(waypoint_route),
            'marked_endpoint_waypoint_search_tested_states': waypoint_tested,
            'marked_endpoint_waypoint_search_truncated': waypoint_truncated,
            'marked_endpoint_waypoint_missing_node_refs': waypoint_missing,
            'marked_endpoint_last_matching_subcell_contact_present': bool(contacted_cells),
            'marked_endpoint_last_matching_subcell_contact_pattern_changed': contact_pattern_changed,
            'marked_endpoint_last_matching_subcell_remote_rim_fill_change_count': remote_rim_fill_changes,
            'marked_endpoint_last_point_translation_confirmed': confirmed,
            'marked_endpoint_route_first': first == cell, 'marked_endpoint_route_length': len(route),
            'marked_endpoint_route_cells': route, 'marked_endpoint_search_tested_positions': tested,
            'marked_endpoint_search_truncated': truncated}, base)
        candidates.append(candidate.model_copy(update={'candidate_ref': ref}))
        facts[ref], deltas[ref] = row, row
    refs = tuple(candidate.candidate_ref for candidate in candidates)
    return agenda.model_copy(update={'candidates': tuple(candidates), 'alternative_refs': refs,
        'alternative_facts': FrozenMap(facts), 'descriptive_delta_facts': FrozenMap(deltas),
        'has_candidates': bool(candidates)})
