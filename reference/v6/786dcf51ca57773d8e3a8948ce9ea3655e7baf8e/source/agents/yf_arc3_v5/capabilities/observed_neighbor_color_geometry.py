"""Current, bounded cell/signature correlations without role or action choice.

The caller supplies the retained calibration and measurement bounds. A change
of palette never assigns a new identity here. These descriptive tables need a
Source/DRM interpretation before they become a neighborhood model or a goal.
"""
from collections import Counter

from .framed_masks import measure_enclosed_frame_groups


def _box(box):
    return box.top, box.left, box.bottom, box.right


def _inside(inner, outer):
    return outer[0] <= inner[0] <= inner[2] <= outer[2] and outer[1] <= inner[1] <= inner[3] <= outer[3]


def _core_box(cell, geometry):
    r0, c0, h, w, dr, dc, _, _ = geometry
    r, c = cell
    return r0 + r * dr, c0 + c * dc, r0 + r * dr + h - 1, c0 + c * dc + w - 1


def _cell(box, geometry):
    r0, c0, _, _, dr, dc, nr, nc = geometry
    r, c = (box[0] - r0) // dr, (box[1] - c0) // dc
    return (r, c) if 0 <= r < nr and 0 <= c < nc and _inside(box, _core_box((r, c), geometry)) else None


def _uniform(frame, box, omitted=None):
    values = {frame.rows[r][c] for r in range(box[0], box[2] + 1)
              for c in range(box[1], box[3] + 1)
              if omitted is None or not (omitted[0] <= r <= omitted[2] and omitted[1] <= c <= omitted[3])}
    return next(iter(values)) if len(values) == 1 else None


def _signature_boxes(frame, components, signature, geometry, bounds,
                     before=None, delta=(0, 0), cells=None):
    """Exact bounded raster matches; no control role or tie is selected."""
    signature = tuple(tuple(row) for row in signature)
    if (not signature or not signature[0]
            or len(components) > bounds['maximum_component_count']):
        return (), False, 0
    height, width = len(signature), len(signature[0])
    boxes, work = [], 0
    for component in components:
        box = _box(component.bbox)
        t, l, b, r = box
        cell = _cell(box, geometry)
        if (b-t+1 != height or r-l+1 != width or cell is None
                or (cells is not None and cell not in cells)):
            continue
        work += height*width*(1+int(before is not None))
        if work > bounds['maximum_work']:
            return (), False, work
        if tuple(tuple(row[l:r+1]) for row in frame.rows[t:b+1]) != signature:
            continue
        if before is not None:
            old = (t-delta[0],l-delta[1],b-delta[0],r-delta[1])
            if not _inside(old,(0,0,before.height-1,before.width-1)):
                continue
            if tuple(tuple(row[old[1]:old[3]+1]) for row in before.rows[old[0]:old[2]+1]) != signature:
                continue
        boxes.append(box)
    return tuple(sorted(set(boxes))), True, work


def _framed_cells(frame, group, geometry):
    t, l, b, r = group['frame_bbox']
    h, w, dr, dc = geometry[2:6]
    ih, iw = b - t - 1, r - l - 1
    if ih < h or iw < w or (ih - h) % dr > dr - h or (iw - w) % dc > dc - w:
        return None
    nr, nc = (ih - h) // dr + 1, (iw - w) // dc + 1
    rows = tuple(tuple(_uniform(frame, (t + 1 + y * dr, l + 1 + x * dc,
                t + y * dr + h, l + x * dc + w)) for x in range(nc)) for y in range(nr))
    if any(value is None for row in rows for value in row):
        return None
    noncore = Counter(frame.rows[y][x]
        for y in range(t + 1, b) for x in range(l + 1, r)
        if (y - t - 1) % dr >= h or (x - l - 1) % dc >= w
        or y - t - 1 >= (nr - 1) * dr + h
        or x - l - 1 >= (nc - 1) * dc + w)
    return {'frame_ref': group['frame_ref'], 'box': (t, l, b, r), 'rows': rows,
            'cell_rows': nr, 'cell_columns': nc,
            'trailing_gap_pixels': ((ih - h) % dr, (iw - w) % dc),
            'noncore_value_counts': tuple(sorted(noncore.items()))}


def measure_observed_neighbor_color_geometry(request, bounds, prior_measurement=None):
    """Measure one retained-cell displacement and its localized color changes.

    A sampled pane is a finite observation domain, not an asserted world
    boundary. Previous occupied footprints supply conditional support samples;
    the returned palette set is not a new canonical traversability claim.
    """
    def missing(cause):
        return {'geometry_complete': False, 'cause': cause, 'frame_pair_candidates': ()}

    frame = request.current_observed_frame or request.frame
    before = request.previous_action_observed_frame
    calibration = getattr(request, 'point_scope_calibration_geometry', None)
    if calibration is not None and (
            request.declared_point_candidate_scope_ref != 'probe_scope.full_point_loci'
            or not getattr(request, 'point_scope_calibration_ref', None)
            or (request.retained_grid_geometry is not None
                and tuple(calibration) != tuple(request.retained_grid_geometry))):
        return missing('POINT_SCOPE_CALIBRATION_NOT_CURRENT_OR_CONFLICTING')
    geometry = tuple(request.retained_grid_geometry or calibration or ())
    if before is None or len(geometry) != 8 or not request.action_conditioned_grid_evidence:
        return missing('CURRENT_ACTION_CONDITIONED_GRID_AND_PREVIOUS_FRAME_REQUIRED')
    if frame.height * frame.width > bounds['maximum_frame_pixels']:
        return missing('FRAME_DOMAIN_BOUND')
    if (before.height, before.width) != (frame.height, frame.width):
        return missing('FRAME_DIMENSIONS_CHANGED')
    relocate = prior_measurement is not None and bounds.get('allow_revalidated_proxy_signature_relocalization')
    if (min(geometry[2:6]) <= 0
            or (not relocate and len(request.input_aligned_entity_bboxes) != 1)):
        return missing('UNIQUE_CURRENT_PROXY_AND_VALID_CELL_GEOMETRY_REQUIRED')
    if (min(geometry[6:]) <= 0 or geometry[6] * geometry[7] > bounds['maximum_cell_count']
            or geometry[2] > geometry[4] or geometry[3] > geometry[5]):
        return missing('FINITE_NONOVERLAPPING_CELL_DOMAIN_REQUIRED')
    deltas = tuple((r, c) for a, r, c in request.known_action_translation_deltas if a == request.last_action_ref)
    if len(deltas) != 1:
        return missing('CURRENT_DIRECTION_TRANSLATION_NOT_BOUND')
    delta = deltas[0]
    if (delta[0], delta[1]) not in ((-geometry[4], 0), (geometry[4], 0), (0, -geometry[5]), (0, geometry[5])):
        return missing('ONE_RETAINED_CELL_TRANSLATION_NOT_OBSERVED')
    proxy_work = 0
    if relocate:
        candidates, complete, proxy_work = _signature_boxes(frame,
            request.components.components, prior_measurement['proxy_patch'], geometry, bounds,
            before=before, delta=delta)
        if not complete or len(candidates) != 1:
            return missing('RECALLED_PROXY_SIGNATURE_TRANSLATION_NOT_UNIQUE_OR_WITHIN_BOUND')
        proxy, = candidates
    else:
        proxy = _box(request.input_aligned_entity_bboxes[0])
    old_proxy = (proxy[0] - delta[0], proxy[1] - delta[1], proxy[2] - delta[0], proxy[3] - delta[1])
    if not _inside(proxy, (0, 0, frame.height - 1, frame.width - 1)):
        return missing('CURRENT_PROXY_OUTSIDE_FRAME')
    if not _inside(old_proxy, (0, 0, before.height - 1, before.width - 1)):
        return missing('PREVIOUS_PROXY_OUTSIDE_FRAME')
    if any(frame.rows[r][c] != before.rows[r - delta[0]][c - delta[1]]
           for r in range(proxy[0], proxy[2] + 1) for c in range(proxy[1], proxy[3] + 1)):
        return missing('PROXY_TRANSLATION_SIGNATURE_CHANGED')
    current_cell, prior_cell = _cell(proxy, geometry), _cell(old_proxy, geometry)
    if current_cell is None or prior_cell is None:
        return missing('PROXY_NOT_CONTAINED_IN_RETAINED_CELL_CORE')
    counts = Counter(value for row in frame.rows for value in row)
    greatest = max(counts[value] for value in sorted(counts))
    modes = {value for value, count in sorted(counts.items()) if count == greatest}
    bars = tuple(_box(c.bbox) for c in request.components.components
                 if c.bbox.width == frame.width and c.area == c.bbox.height * c.bbox.width
                 and c.value not in modes)
    if len(bars) != 1:
        return missing('FULL_WIDTH_NONMODAL_PARTITION_NOT_UNIQUE')
    bar = bars[0]
    regions = ((0, 0, bar[0] - 1, frame.width - 1),
               (bar[2] + 1, 0, frame.height - 1, frame.width - 1))
    regions = tuple(region for region in regions if _inside(proxy, region) and _inside(old_proxy, region))
    if len(regions) != 1:
        return missing('PROXY_PARTITION_MEMBERSHIP_NOT_UNIQUE')
    region = regions[0]
    cells = tuple((r, c) for r in range(geometry[6]) for c in range(geometry[7])
                  if _inside(_core_box((r, c), geometry), region))
    if len(cells) > bounds['maximum_cell_count']:
        return missing('CELL_DOMAIN_BOUND')
    sampled = tuple({cell: _uniform(f, _core_box(cell, geometry), omitted)
                     for cell in cells} for f, omitted in ((before, old_proxy), (frame, proxy)))
    if any(value is None for view in sampled for _, value in sorted(view.items())):
        return missing('CELL_CORES_NOT_UNIFORM_OUTSIDE_TRANSLATED_PROXY')
    supports = set(request.episode_input_aligned_underlay_values)
    if prior_measurement is not None:
        # Conditional support signatures travel with the recalled hypothesis;
        # current geometry, population and observed colour keys are remeasured.
        supports.update(prior_measurement['conditional_support_values'])
    for box in request.visited_input_aligned_entity_bboxes:
        box = _box(box)
        cell = _cell(box, geometry)
        if cell in cells and box == _core_box(cell, geometry) and cell != current_cell:
            value = _uniform(frame, box)
            if value is not None:
                supports.add(value)
    if not supports:
        return missing('CONDITIONAL_SUPPORT_SAMPLE_DOMAIN_EMPTY')
    occupied = tuple({cell: value for cell, value in sorted(view.items()) if value not in supports} for view in sampled)
    old, new = occupied
    if not 2 <= len(new) <= bounds['maximum_member_count'] or len(old) != len(new):
        return missing('BOUNDED_EQUAL_NON_SUPPORT_CORE_COUNT_REQUIRED')
    if set(old) - set(new) != {prior_cell} or set(new) - set(old) != {current_cell}:
        return missing('SINGLE_PROXY_GUIDED_OCCUPANCY_DISPLACEMENT_REQUIRED')
    stationary_changed = tuple(cell for cell in set(old) & set(new) if old[cell] != new[cell])
    if prior_measurement is None and (not stationary_changed or old[prior_cell] == new[current_cell]):
        return missing('BOTH_DISPLACED_AND_STATIONARY_APPEARANCE_CHANGE_REQUIRED')
    changes = tuple((r, c) for r in range(frame.height) for c in range(frame.width)
                    if frame.rows[r][c] != before.rows[r][c])
    boxes = tuple(_core_box(cell, geometry) for cell in set(old) | set(new))
    if any(not any(t <= r <= b and l <= c <= rr for t, l, b, rr in boxes) for r, c in changes):
        return missing('CHANGES_NOT_LOCALIZED_TO_OBSERVED_CORE_UNION')
    offsets = tuple(tuple(x) for x in bounds['candidate_offsets'])
    if not 1 <= len(offsets) <= 16 or len(set(offsets)) != len(offsets) or (0, 0) in offsets:
        return missing('DISTINCT_NONZERO_OFFSET_DOMAIN_REQUIRED')
    samples, table = [], {}
    for view_index, view in enumerate(occupied):
        for cell, value in sorted(view.items()):
            mask = sum(1 << i for i, (r, c) in enumerate(offsets) if (cell[0] + r, cell[1] + c) in view)
            if mask in table and table[mask] != value:
                return missing('SAME_MEASURED_OFFSET_MASK_DIFFERENT_PALETTES')
            table[mask] = value
            samples.append((view_index, cell, mask, value))
    if prior_measurement is not None:
        if offsets != tuple(tuple(x) for x in prior_measurement['offset_domain']):
            return missing('RECALLED_OFFSET_DOMAIN_CHANGED')
        prior_table = dict(prior_measurement['functional_sample_table'])
        if not set(table).intersection(prior_table):
            return missing('NO_CURRENT_SAMPLE_REVALIDATES_RECALLED_TABLE')
        if any(prior_table[key] != value for key, value in sorted(table.items()) if key in prior_table):
            return missing('CURRENT_SAMPLE_CONTRADICTS_RECALLED_TABLE')
        table = {**prior_table, **table}
    framed = measure_enclosed_frame_groups(frame, request.components.components,
        {**bounds, 'maximum_work':bounds['maximum_work']-proxy_work})
    if not framed['enclosed_frame_groups_complete']:
        return missing('ENCLOSED_FRAME_MEASUREMENT_INCOMPLETE')
    panes = tuple(p for group in framed['enclosed_frame_groups']
                  if (p := _framed_cells(frame, group, geometry)) is not None)
    pairs = []
    for field in panes:
        origin = _cell((field['box'][0] + 1, field['box'][1] + 1,
                        field['box'][0] + geometry[2], field['box'][1] + geometry[3]), geometry)
        if origin is None or not _inside(field['box'], region):
            continue
        if not all(value in supports for row in field['rows'] for value in row):
            continue
        if any(value not in supports for value, _ in field['noncore_value_counts']):
            continue
        for reference in panes:
            if reference['box'] == field['box'] or _inside(reference['box'], region):
                continue
            if (reference['cell_rows'], reference['cell_columns']) != (field['cell_rows'], field['cell_columns']):
                continue
            values = {value for row in reference['rows'] for value in row}
            empty = values & supports
            if len(empty) != 1:
                continue
            empty = next(iter(empty))
            if any(value != empty for value, _ in reference['noncore_value_counts']):
                continue
            # Frame correspondence is geometric. Unseen reference pigments
            # remain unknown model outputs; the exact layout service must not
            # accept them until a current sample supplies their colour keys.
            requested = tuple((origin[0] + r, origin[1] + c) for r, row in enumerate(reference['rows'])
                              for c, value in enumerate(row) if value != empty)
            if len(requested) == len(new):
                pairs.append({'field': field, 'reference': reference, 'field_origin': origin,
                              'empty_value_candidate': empty, 'nonempty_reference_positions': requested})
    return {'geometry_complete': True, 'cause': 'LOCALIZED_CELL_DISPLACEMENT_AND_COLOR_CORRELATION_MEASURED',
            'grid_geometry': geometry, 'sample_region': region, 'partition_box': bar,
            'sampled_cells': cells, 'conditional_support_values': tuple(sorted(supports)),
            'prior_non_support_cells': tuple(sorted(old.items())), 'current_non_support_cells': tuple(sorted(new.items())),
            'prior_proxy_cell': prior_cell, 'current_proxy_cell': current_cell,
            'current_proxy_bbox':proxy,
            'stationary_color_changed_cells': stationary_changed, 'offset_domain': offsets,
            'observed_mask_palette_samples': tuple(samples), 'functional_sample_table': tuple(sorted(table.items())),
            'frame_pair_candidates': tuple(pairs),
            'proxy_relocalization_work_count':proxy_work,
            'enclosed_frame_work_count': framed['work_count']+proxy_work}


def snapshot_neighbor_color_geometry(request, measured):
    """Bounded image witnesses, not a role, route or complete mechanical law."""
    frame = request.current_observed_frame or request.frame
    pair, = measured['frame_pair_candidates']
    t, l, b, r = pair['reference']['box']
    ft, fl, fb, fr = pair['field']['box']
    core = _core_box(tuple(measured['current_proxy_cell']), tuple(measured['grid_geometry']))
    proxy = tuple(measured['current_proxy_bbox'])
    return {**measured,
        'proxy_relative_box': (proxy[0]-core[0],proxy[1]-core[1],proxy[2]-core[0],proxy[3]-core[1]),
        'proxy_patch': tuple(tuple(row[proxy[1]:proxy[3]+1]) for row in frame.rows[proxy[0]:proxy[2]+1]),
        'reference_patch': tuple(tuple(row[l:r + 1]) for row in frame.rows[t:b + 1]),
        'field_border': tuple((y, x, frame.rows[y][x])
            for y in range(ft, fb + 1) for x in range(fl, fr + 1)
            if y in (ft, fb) or x in (fl, fr))}


def revalidate_neighbor_color_geometry(request, measured, bounds):
    """Recount current occupancy and falsify a supplied partial sample table.

    The caller must bind the canonical record to the current level. This checks
    its raster/calibration witnesses and each known table entry currently used.
    New current cases extend the measured table only when all occurrences of
    the same key agree. Source must acquire that delta before it is used.
    Identity never follows from a changed colour.
    """
    def missing(cause):
        return {'geometry_complete': False, 'cause': cause, 'frame_pair_candidates': ()}
    frame = request.current_observed_frame or request.frame
    calibration = getattr(request, 'point_scope_calibration_geometry', None)
    if calibration is not None and (
            request.declared_point_candidate_scope_ref != 'probe_scope.full_point_loci'
            or not getattr(request, 'point_scope_calibration_ref', None)
            or (request.retained_grid_geometry is not None
                and tuple(calibration) != tuple(request.retained_grid_geometry))):
        return missing('POINT_SCOPE_CALIBRATION_NOT_CURRENT_OR_CONFLICTING')
    geometry = tuple(request.retained_grid_geometry or calibration or ())
    relocate = bounds.get('allow_revalidated_proxy_signature_relocalization')
    if (geometry != tuple(measured['grid_geometry']) or not request.action_conditioned_grid_evidence
            or frame.height * frame.width > bounds['maximum_frame_pixels']
            or (not relocate and len(request.input_aligned_entity_bboxes) != 1)):
        return missing('RECALLED_GEOMETRY_OR_CURRENT_PROXY_NOT_REVALIDATED')
    pair, = measured['frame_pair_candidates']
    t, l, b, r = pair['reference']['box']
    if not _inside((t, l, b, r), (0, 0, frame.height - 1, frame.width - 1)):
        return missing('RECALLED_REFERENCE_OUTSIDE_FRAME')
    patch = tuple(tuple(row[l:r + 1]) for row in frame.rows[t:b + 1])
    if patch != tuple(tuple(row) for row in measured['reference_patch']):
        return missing('RECALLED_REFERENCE_RASTER_CHANGED')
    if any(frame.rows[y][x] != value for y, x, value in measured['field_border']):
        return missing('RECALLED_COMPARISON_BORDER_CHANGED')
    cells = tuple(tuple(cell) for cell in measured['sampled_cells'])
    proxy_work = 0
    if relocate:
        candidates, complete, proxy_work = _signature_boxes(frame,
            request.components.components, measured['proxy_patch'], geometry, bounds,
            cells=frozenset(cells))
        if not complete or len(candidates) != 1:
            return missing('RECALLED_PROXY_SIGNATURE_NOT_CURRENTLY_UNIQUE_OR_WITHIN_BOUND')
        proxy, = candidates
    else:
        proxy = _box(request.input_aligned_entity_bboxes[0])
    current_cell = _cell(proxy, geometry)
    if len(cells) > bounds['maximum_cell_count'] or current_cell not in cells:
        return missing('RECALLED_CELL_DOMAIN_OR_CURRENT_PROXY_NOT_REVALIDATED')
    core = _core_box(current_cell, geometry)
    pr = measured['proxy_relative_box']
    glyph = (core[0]+pr[0],core[1]+pr[1],core[0]+pr[2],core[1]+pr[3])
    patch = tuple(tuple(row[glyph[1]:glyph[3]+1]) for row in frame.rows[glyph[0]:glyph[2]+1])
    if patch != tuple(tuple(row) for row in measured['proxy_patch']):
        return missing('RECALLED_SELECTED_GLYPH_SIGNATURE_CHANGED')
    sampled = {cell: _uniform(frame, _core_box(cell, geometry), glyph) for cell in cells}
    if any(value is None for _, value in sorted(sampled.items())):
        return missing('CURRENT_CORES_NOT_UNIFORM_OUTSIDE_PROXY')
    supports = frozenset(measured['conditional_support_values'])
    occupied = {cell: value for cell, value in sorted(sampled.items()) if value not in supports}
    if len(occupied) != len(measured['current_non_support_cells']) or current_cell not in occupied:
        return missing('RECALLED_POPULATION_OR_ACTIVE_PROXY_MEMBERSHIP_CHANGED')
    offsets = tuple(tuple(x) for x in measured['offset_domain'])
    table = dict(measured['functional_sample_table'])
    unmapped, additions = [], {}
    for cell, value in sorted(occupied.items()):
        mask = sum(1 << i for i, (dy, dx) in enumerate(offsets) if (cell[0] + dy, cell[1] + dx) in occupied)
        if mask not in table:
            unmapped.append((cell, mask, value))
            if mask in additions and additions[mask] != value:
                return missing('CURRENT_UNKNOWN_MASK_HAS_CONFLICTING_SAMPLES')
            additions[mask] = value
        elif table[mask] != value:
            return missing('CURRENT_KNOWN_NEIGHBOR_SAMPLE_CONTRADICTED')
    return {**measured, 'cause': 'RECALLED_PARTIAL_SAMPLE_TABLE_CURRENTLY_REVALIDATED',
            'current_unmapped_neighbor_samples': tuple(unmapped),
            'proxy_relocalization_work_count':proxy_work,
            'enclosed_frame_work_count':measured['enclosed_frame_work_count']
                -measured.get('proxy_relocalization_work_count',0)+proxy_work,
            'functional_sample_table': tuple(sorted({**table, **additions}.items())),
            'current_non_support_cells': tuple(sorted(occupied.items())),
            'current_proxy_cell': current_cell, 'current_proxy_bbox':proxy}
