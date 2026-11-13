"""Exact ranked-mask, corner-marker and reference-cut relations.

These are geometry and visible glyph measurements, not a grasp, a lock demand,
an opening receipt, a control law or a selected workshop. Palette bindings are
measured from the frame, never fixed by a game or by a creator description.
"""
from collections import Counter
from .stem_reliefs import measure_stem_reliefs, measure_ranked_cuts


def measure_corner_quartets(components, maximum_quartets, maximum_expansions):
    corners = {side: [] for side in ('tl', 'tr', 'bl', 'br')}
    for component in components:
        h, w = component.bbox.height, component.bbox.width
        if min(h, w) < 2:
            continue
        pixels = frozenset(component.relative_pixels)
        for side in ('tl', 'tr', 'bl', 'br'):
            r = 0 if side[0] == 't' else h - 1
            c = 0 if side[1] == 'l' else w - 1
            if pixels == frozenset((r, x) for x in range(w)) | frozenset((y, c) for y in range(h)):
                corners[side].append(component)
    rows = []
    truncated = False
    expansions = 0
    for tl in corners['tl']:
        shape = (tl.value, tl.bbox.height, tl.bbox.width)
        for tr in corners['tr']:
            if ((tr.value, tr.bbox.height, tr.bbox.width) != shape
                    or tr.bbox.top != tl.bbox.top or tr.bbox.left <= tl.bbox.right):
                continue
            for bl in corners['bl']:
                if expansions == maximum_expansions:
                    return {'quartets': tuple(rows), 'domain_truncated': True,
                            'expansion_count': expansions}
                expansions += 1
                if ((bl.value, bl.bbox.height, bl.bbox.width) != shape
                        or bl.bbox.left != tl.bbox.left or bl.bbox.top <= tl.bbox.bottom):
                    continue
                brs = tuple(br for br in corners['br']
                    if (br.value, br.bbox.height, br.bbox.width) == shape
                    and br.bbox.top == bl.bbox.top and br.bbox.left == tr.bbox.left)
                for br in brs:
                    box = (tl.bbox.top, tl.bbox.left, br.bbox.bottom, br.bbox.right)
                    singleton_refs = tuple(c.component_id for c in components
                        if c.value == tl.value and c.area == 1
                        and box[0] < c.bbox.top < box[2] and box[1] < c.bbox.left < box[3])
                    row = {'bbox': box, 'palette_value': tl.value,
                        'corner_component_refs': tuple(c.component_id for c in (tl, tr, bl, br)),
                        'intrinsic_singleton_component_refs': singleton_refs}
                    if len(rows) < maximum_quartets:
                        rows.append(row)
                    else:
                        truncated = True
    return {'quartets': tuple(rows), 'domain_truncated': truncated,
            'expansion_count': expansions}


def measure_station_profile_scene(rows, components, stem_configuration, configuration):
    required = ('maximum_component_count', 'maximum_marker_quartets',
                'maximum_receiver_enclosures', 'maximum_receiver_bindings',
                'maximum_reference_side_margin', 'receiver_axis_directions',
                'maximum_marker_expansions', 'maximum_cut_measurement_requests',
                'maximum_reference_packets', 'maximum_frame_pixels')
    if any(key not in configuration for key in required):
        return {}
    if len(components) > int(configuration['maximum_component_count']):
        return {'component_domain_truncated': True}
    if sum(len(row) for row in rows) > int(configuration['maximum_frame_pixels']):
        return {'frame_domain_truncated': True}
    stems = measure_stem_reliefs(components, stem_configuration)
    profiles = tuple({'component_ref': c.component_id, 'bbox': (
        c.bbox.top, c.bbox.left, c.bbox.bottom, c.bbox.right),
        'palette_value': c.value, 'profile': stems[c.component_id]}
        for c in components if c.component_id in stems
        and stems[c.component_id]['stem_relief_unique_profile'])
    formats = tuple(sorted({(len(p['profile']['stem_relief_rank_height_pixels']),
        p['profile']['stem_relief_rank_width_pixels'], p['profile']['stem_relief_rank_pitch_pixels'])
        for p in profiles if p['profile']['stem_relief_axis_direction']
        in configuration['receiver_axis_directions']}))
    counts = Counter(pixel for row in rows for pixel in row)
    peak = max(counts.values()) if counts else 0
    modal = frozenset(v for v, count in sorted(counts.items()) if count == peak)
    height, width = len(rows), len(rows[0]) if rows else 0
    enclosures = []
    enclosure_gaps = {}
    enclosure_truncated = False
    for c in components:
        h, w = c.bbox.height, c.bbox.width
        if min(h, w) < 3:
            continue
        pixels = frozenset(c.relative_pixels)
        perimeter = frozenset((r, x) for r in (0, h - 1) for x in range(w)) | frozenset(
            (y, col) for y in range(h) for col in (0, w - 1))
        missing = perimeter - pixels
        absolute_missing = frozenset((c.bbox.top + y, c.bbox.left + x) for y, x in missing)
        profile_refs = frozenset(p['component_ref'] for p in profiles)
        overlapping_profile_pixels = frozenset(pixel for item in components
            if item.component_id in profile_refs for pixel in item.pixels)
        # A current stem can occlude a contour without becoming a new carrier.
        # Keep the missing pixels explicit; this is a completion alternative,
        # not proof of an intact or stationary receiver.
        corners_visible = all(pos in pixels for pos in ((0, 0), (0, w - 1), (h - 1, 0), (h - 1, w - 1)))
        if corners_visible and absolute_missing.issubset(overlapping_profile_pixels):
            if len(enclosures) < int(configuration['maximum_receiver_enclosures']):
                enclosures.append(c)
                enclosure_gaps[c.component_id] = tuple(sorted(absolute_missing))
            else:
                enclosure_truncated = True
    packets = []
    bindings = []
    binding_truncated = False
    packet_truncated = False
    cut_requests = 0
    for enclosure in enclosures:
        t, l, b, r = (enclosure.bbox.top, enclosure.bbox.left,
                       enclosure.bbox.bottom, enclosure.bbox.right)
        for margin in range(1, int(configuration['maximum_reference_side_margin']) + 1):
            if l - margin < 0 or r + margin >= width:
                continue
            for reference_row in range(t + 1, b):
                value = rows[reference_row][l - margin]
                if (value in modal or value == enclosure.value
                        or rows[reference_row][r + margin] != value):
                    continue
                # Collinear internal evidence is needed; two external dots alone
                # do not supply a reference line.
                if sum(rows[reference_row][x] == value for x in range(l + 1, r)) < 2:
                    continue
                packet = {'enclosure_component_ref': enclosure.component_id,
                    'enclosure_value': enclosure.value,
                    'bbox': (t, l, b, r), 'reference_row': reference_row,
                    'reference_columns': (l - margin, r + margin), 'reference_value': value,
                    'perimeter_gaps_under_ranked_mask': enclosure_gaps[enclosure.component_id]}
                if len(packets) == int(configuration['maximum_reference_packets']):
                    packet_truncated = True
                    continue
                packets.append(packet)
                for count, rank_width, pitch in formats:
                    for first in range(l + 1, r - (count - 1) * pitch - rank_width + 1):
                        columns = tuple(first + i * pitch for i in range(count))
                        layer_values = tuple(sorted({rows[y][x] for y in range(t + 1, b)
                            for col in columns for x in range(col, col + rank_width)}))
                        for upper in layer_values:
                            for lower in layer_values:
                                if upper == lower:
                                    continue
                                if cut_requests == int(configuration['maximum_cut_measurement_requests']):
                                    binding_truncated = True
                                    break
                                cut_requests += 1
                                cut = measure_ranked_cuts(rows, rank_columns=columns,
                                    rank_width=rank_width, reference_row=reference_row,
                                    reference_columns=packet['reference_columns'], reference_value=value,
                                    band_top=t, band_bottom=b, upper_value=upper, lower_value=lower)
                                if cut['uncertain_rank_indexes']:
                                    continue
                                if len(bindings) < int(configuration['maximum_receiver_bindings']):
                                    bindings.append({**packet, 'upper_value': upper,
                                        'lower_value': lower, 'cut_measurements': cut,
                                        'cut_values': tuple(rows[rs[0]][col]
                                            for col, rs in zip(columns, cut['cut_rows_by_rank']))})
                                else:
                                    binding_truncated = True
    markers = measure_corner_quartets(components, int(configuration['maximum_marker_quartets']),
        int(configuration['maximum_marker_expansions']))
    return {'profiles': profiles, 'reference_packets': tuple(packets),
        'receiver_bindings': tuple(bindings), 'marker_quartets': markers['quartets'],
        'component_domain_truncated': False,
        'enclosure_domain_truncated': enclosure_truncated,
        'receiver_binding_domain_truncated': binding_truncated,
        'reference_packet_domain_truncated': packet_truncated,
        'cut_measurement_request_count': cut_requests,
        'marker_expansion_count': markers['expansion_count'],
        'marker_domain_truncated': markers['domain_truncated']}


def station_profile_context(scene):
    """Project exact containment and ordered-vector equalities, not roles."""
    if not scene or any(scene.get(k) for k in (
            'frame_domain_truncated', 'component_domain_truncated',
            'enclosure_domain_truncated', 'receiver_binding_domain_truncated',
            'reference_packet_domain_truncated', 'marker_domain_truncated')):
        return {}
    packets = scene['reference_packets']
    def contained(inner, outer):
        return outer[0] <= inner[0] <= inner[2] <= outer[2] and outer[1] <= inner[1] <= inner[3] <= outer[3]
    # A displayed ranked glyph can have a stem/handle outside its station.
    # Bind its measured rank cores, not the full overhanging sprite bbox.
    def ranks_inside(profile, box):
        return all(box[0] <= row <= box[2]
            and box[1] <= col <= col + profile['stem_relief_rank_width_pixels'] - 1 <= box[3]
            for row, col in profile['stem_relief_rank_origins'])
    outer = tuple(p for p in scene['profiles']
        if not any(ranks_inside(p['profile'], b['bbox']) for b in packets))
    bindings = scene['receiver_bindings']
    # Arity compatibility is a measurement, never an operand/operator role.
    # Keep every unmatched profile in the raw scene and its unknown role.
    receiver_arities = frozenset(len(b['cut_measurements']['signed_cut_offsets'])
        for b in bindings)
    compatible = tuple(p for p in outer
        if len(p['profile']['stem_relief_rank_height_pixels']) in receiver_arities)
    markers = scene['marker_quartets']
    marked = tuple((p, m) for p in outer for m in markers if contained(p['bbox'], m['bbox']))
    equalities = tuple((p['component_ref'], b['enclosure_component_ref'])
        for p in outer for b in bindings
        if p['profile']['stem_relief_rank_height_pixels'] == b['cut_measurements']['signed_cut_offsets'])
    def zero_cut_agrees_with_contour(binding):
        cuts = binding['cut_measurements']
        return all(offset == 0 for offset in cuts['signed_cut_offsets']) and all(
            rows_value == binding['enclosure_value'] for rows_value in binding['cut_values'])
    context = {'station_profile_unenclosed_profile_count': len(outer),
        'station_profile_reference_packet_count': len(packets),
        'station_profile_receiver_binding_count': len(bindings),
        'station_profile_exact_vector_equality_count': len(equalities),
        'station_profile_corner_quartet_count': len(markers),
        'station_profile_marked_profile_count': len(marked),
        'station_profile_zero_cut_contour_agreement_count': sum(zero_cut_agrees_with_contour(b) for b in bindings),
        'station_profile_same_band_vector_equality_count': sum(
            p['profile']['stem_relief_rank_height_pixels'] == b['cut_measurements']['signed_cut_offsets']
            and b['bbox'][0] <= p['profile']['stem_relief_stem_origin'][0] <= b['bbox'][2]
            for p in outer for b in bindings)}
    context.update({
        'station_profile_receiver_arity_domain_count': len(receiver_arities),
        'station_profile_receiver_arity_compatible_profile_count': len(compatible),
        'station_profile_receiver_arity_unmatched_profile_count': len(outer) - len(compatible),
        'station_profile_marked_receiver_arity_compatible': len(marked) == 1
            and marked[0][0] in compatible})
    if len(marked) == 1 and len(markers) == 1:
        p, m = marked[0]
        stem_row = p['profile']['stem_relief_stem_origin'][0]
        above_rows = tuple(q['profile']['stem_relief_stem_origin'][0] for q in outer
            if q['profile']['stem_relief_stem_origin'][0] < stem_row)
        below_rows = tuple(q['profile']['stem_relief_stem_origin'][0] for q in outer
            if q['profile']['stem_relief_stem_origin'][0] > stem_row)
        above = tuple(q for q in outer if above_rows
            and q['profile']['stem_relief_stem_origin'][0] == max(above_rows))
        below = tuple(q for q in outer if below_rows
            and q['profile']['stem_relief_stem_origin'][0] == min(below_rows))
        same_band = tuple(b for b in bindings if b['bbox'][0] <= stem_row <= b['bbox'][2])
        compatible_above_rows = tuple(q['profile']['stem_relief_stem_origin'][0]
            for q in compatible if q['profile']['stem_relief_stem_origin'][0] < stem_row)
        compatible_below_rows = tuple(q['profile']['stem_relief_stem_origin'][0]
            for q in compatible if q['profile']['stem_relief_stem_origin'][0] > stem_row)
        compatible_above = tuple(q for q in compatible if compatible_above_rows
            and q['profile']['stem_relief_stem_origin'][0] == max(compatible_above_rows))
        compatible_below = tuple(q for q in compatible if compatible_below_rows
            and q['profile']['stem_relief_stem_origin'][0] == min(compatible_below_rows))
        context.update({'station_profile_compatible_neighbor_above_count': len(compatible_above),
            'station_profile_compatible_neighbor_below_count': len(compatible_below)})
        context.update({'station_profile_unique_marked_profile_ref': p['component_ref'],
            'station_profile_inner_singleton_count': len(m['intrinsic_singleton_component_refs']),
            'station_profile_marked_profile_heights': p['profile']['stem_relief_rank_height_pixels'],
            'station_profile_marker_bbox': m['bbox'],
            'station_profile_neighbor_above_count': len(above),
            'station_profile_neighbor_below_count': len(below)})
        if len(same_band) == 1:
            cut = same_band[0]['cut_measurements']['signed_cut_offsets']
            heights = p['profile']['stem_relief_rank_height_pixels']
            side_marks = tuple(q for q in outer if q not in compatible
                and same_band[0]['bbox'][0] <= q['profile']['stem_relief_stem_origin'][0] <= same_band[0]['bbox'][2])
            context.update({
                'station_profile_marked_exact_receiver_count': sum(
                    heights == b['cut_measurements']['signed_cut_offsets'] for b in bindings),
                'station_profile_marked_rank_bag_receiver_count': sum(
                    sorted(heights) == sorted(b['cut_measurements']['signed_cut_offsets']) for b in bindings),
                'station_profile_marked_band_unmatched_count': len(side_marks),
                'station_profile_marked_band_unmatched_left_count': sum(q['bbox'][3] < p['bbox'][1] for q in side_marks),
                'station_profile_marked_band_unmatched_right_count': sum(p['bbox'][3] < q['bbox'][1] for q in side_marks)})
            context.update({
                'station_profile_compatible_neighbor_above_equal_marked_cut_count': sum(
                    q['profile']['stem_relief_rank_height_pixels'] == cut for q in compatible_above),
                'station_profile_compatible_neighbor_below_equal_marked_cut_count': sum(
                    q['profile']['stem_relief_rank_height_pixels'] == cut for q in compatible_below),
                'station_profile_compatible_neighbor_above_same_band_equality_count': sum(
                    q['profile']['stem_relief_rank_height_pixels'] == b['cut_measurements']['signed_cut_offsets']
                    and b['bbox'][0] <= q['profile']['stem_relief_stem_origin'][0] <= b['bbox'][2]
                    for q in compatible_above for b in bindings),
                'station_profile_compatible_neighbor_below_same_band_equality_count': sum(
                    q['profile']['stem_relief_rank_height_pixels'] == b['cut_measurements']['signed_cut_offsets']
                    and b['bbox'][0] <= q['profile']['stem_relief_stem_origin'][0] <= b['bbox'][2]
                    for q in compatible_below for b in bindings)})
            context.update({
                'station_profile_marked_profile_equal_same_band_cut': p['profile']['stem_relief_rank_height_pixels'] == cut,
                'station_profile_marked_receiver_horizontal_sign': (
                    1 if p['bbox'][3] < same_band[0]['bbox'][1]
                    else -1 if same_band[0]['bbox'][3] < p['bbox'][1] else 0),
                'station_profile_marked_zero_cut_contour_agreement': zero_cut_agrees_with_contour(same_band[0]),
                'station_profile_neighbor_above_equal_marked_cut_count': sum(
                    q['profile']['stem_relief_rank_height_pixels'] == cut for q in above),
                'station_profile_neighbor_below_equal_marked_cut_count': sum(
                    q['profile']['stem_relief_rank_height_pixels'] == cut for q in below),
                'station_profile_neighbor_above_same_band_equality_count': sum(
                    q['profile']['stem_relief_rank_height_pixels'] == b['cut_measurements']['signed_cut_offsets']
                    and b['bbox'][0] <= q['profile']['stem_relief_stem_origin'][0] <= b['bbox'][2]
                    for q in above for b in bindings),
                'station_profile_neighbor_below_same_band_equality_count': sum(
                    q['profile']['stem_relief_rank_height_pixels'] == b['cut_measurements']['signed_cut_offsets']
                    and b['bbox'][0] <= q['profile']['stem_relief_stem_origin'][0] <= b['bbox'][2]
                    for q in below for b in bindings)})
    return context
