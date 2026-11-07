"""Observed cell-pattern contacts and exact whole-region coverage, without effects."""
from agents.yf_arc3_v5.capabilities.translated_support_cells import measure_support_cell_offsets


def measure_cell_support_model(value, known, *, occlusion_pixels=()):
    query = value.route_generation_policy.get('operator_surface_relation_query', {})
    if query.get('background_pattern_rule') != 'unique_most_frequent_pattern_with_episode_observed_support_values':
        return None
    grids = tuple(g for g in value.periodic_cell_grids.candidates
        if (g.row_offset, g.col_offset, g.cell_height, g.cell_width,
            g.row_pitch, g.col_pitch, g.logical_rows, g.logical_columns)
        == value.retained_grid_geometry)
    if len(grids) != 1:
        return None
    grid = grids[0]
    occupied = {tuple(p) for row in value.canonical_controlled_assembly_term_facts
                for p in row.get('member_pixel_positions', ())}
    # The caller reconstructs this visual domain from retained observations.
    # Interior rendering can hide support without belonging to the physical
    # collision mask. Unknown/conflicting samples must still remain unknown.
    occupied.update(occlusion_pixels)
    patterns, occurrences, traversed, hidden = {}, {}, set(), {}
    for cell in grid.cells:
        positions = tuple((r, c) for r in range(cell.bbox.top, cell.bbox.bottom + 1)
                          for c in range(cell.bbox.left, cell.bbox.right + 1))
        occluded = bool(occupied.intersection(positions))
        pixels = tuple(known.get((r, c), set())
                       if (r, c) in occupied or not occluded else set()
                       for r, c in positions)
        if not all(len(values) == 1 for values in pixels):
            if occluded:
                hidden[(cell.row, cell.col)] = pixels
            continue
        pattern = tuple(next(iter(values)) for values in pixels)
        patterns[(cell.row, cell.col)] = pattern
        occurrences[pattern] = occurrences.get(pattern, 0) + 1
        if set(pattern).issubset(value.episode_input_aligned_underlay_values):
            traversed.add(pattern)
    ranked = sorted(traversed, key=lambda p: (-occurrences[p], p))
    if not ranked or (len(ranked) > 1 and occurrences[ranked[0]] == occurrences[ranked[1]]):
        return None
    background = ranked[0]
    if query.get('occluded_cell_pattern_rule') == 'unique_visible_pattern_compatible_with_retained_support':
        for position, pixels in sorted(hidden.items()):
            # A retained support sample constrains a hidden cell; a sprite hole
            # is not an observation of its underlay. Never resolve a tie.
            matches = tuple(pattern for pattern in sorted(occurrences)
                if any(pixels) and all(not values or values == {color}
                                      for values, color in zip(pixels, pattern)))
            if len(matches) == 1:
                patterns[position] = matches[0]
    unseen = {p for p, pattern in sorted(patterns.items()) if pattern != background}
    regions = []
    while unseen:
        seed = min(unseen); unseen.remove(seed)
        region, pending = {seed}, [seed]
        while pending:
            r, c = pending.pop()
            for q in ((r-1,c), (r,c-1), (r,c+1), (r+1,c)):
                if q in unseen and patterns[q] == patterns[seed]:
                    unseen.remove(q); region.add(q); pending.append(q)
        accents = sorted(set(patterns[seed]) - set(background))
        regions.append((tuple(sorted(region)), patterns[seed], accents[0] if len(accents) == 1 else None))
    return grid, tuple(regions)


def measure_cell_support_contacts(model, core_pixels, part_pixels):
    if model is None:
        return None
    grid, regions = model
    rows = []
    for body, pixels in (('carrier', core_pixels), ('carried_part', part_pixels)):
        if not pixels:
            return None
        row, col = min(pixels)
        anchor = next((c for c in grid.cells
            if c.bbox.top <= row <= c.bbox.bottom and c.bbox.left <= col <= c.bbox.right), None)
        if anchor is None:
            return None
        offsets = measure_support_cell_offsets(grid=grid, anchor_cell=anchor, pixel_positions=pixels)
        if offsets is None:
            return None
        occupied = {(anchor.row+r, anchor.col+c) for r, c in offsets}
        for region, pattern, accent in regions:
            overlap = tuple(sorted(occupied.intersection(region)))
            if not overlap:
                continue
            rows.append({'body_ref': body, 'support_pattern': pattern,
                'support_region_cells': region, 'overlapped_cells': overlap,
                'observed_support_value': accent,
                'whole_body_matches_support_region': occupied == set(region)})
    return tuple(rows)


def normalized_cell_pattern(pattern):
    "Exact equality structure under one-to-one palette renaming."
    aliases = {}
    return tuple(aliases.setdefault(color, len(aliases)) for color in pattern)


def measure_body_cell_pattern_types(model, pixels, frame, delta=(0, 0)):
    "Observed sprite-cell types, independent of cell count and location."
    if model is None:
        return ()
    grid, _ = model
    observed_pixels = {(r-delta[0], c-delta[1]) for r, c in pixels}
    patterns = set()
    for cell in grid.cells:
        b = cell.bbox
        if not any(b.top <= r <= b.bottom and b.left <= c <= b.right
                   for r, c in observed_pixels):
            continue
        raw = tuple(frame.rows[r][c] for r in range(b.top, b.bottom+1)
                    for c in range(b.left, b.right+1))
        patterns.add((b.height, b.width, normalized_cell_pattern(raw)))
    return tuple(sorted(patterns))
