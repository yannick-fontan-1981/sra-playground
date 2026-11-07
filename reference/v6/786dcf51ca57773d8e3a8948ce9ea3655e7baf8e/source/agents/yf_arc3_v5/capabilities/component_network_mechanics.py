"""Bounded raster/graph calculations for a Source-supplied conditional model.

Role queries, topology, admissible pigment domain and traversal descriptions are
inputs. These calculations neither choose a hypothesis nor authorize a click.
"""

from heapq import heappop, heappush

from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


def patch_rows(frame, box):
    return tuple(tuple(row[box.left:box.right + 1])
        for row in frame.rows[box.top:box.bottom + 1])


def measure_units(frame, grid, maximum_radius):
    records = []
    for index, cell in enumerate(grid.cells):
        patch = patch_rows(frame, cell.bbox)
        height, width = len(patch), len(patch[0])
        middle = height // 2, width // 2
        values = {value for row in patch for value in row}
        masks = []
        limit = min(middle[0], middle[1], height - 1 - middle[0],
            width - 1 - middle[1], maximum_radius)
        for radius in range(1, limit + 1):
            row, col = middle
            families = (
                ('cardinal', ((row-radius,col),(row+radius,col),
                    (row,col-radius),(row,col+radius))),
                ('diagonal', ((row-radius,col-radius),(row-radius,col+radius),
                    (row+radius,col-radius),(row+radius,col+radius))),
            )
            for family, positions in families:
                marked = {patch[y][x] for y, x in positions}
                rest = {patch[y][x] for y in range(height) for x in range(width)
                    if (y, x) not in positions and (y, x) != middle}
                if len(marked) == 1 and len(rest) == 1:
                    masks.append(FrozenMap({'mask':family, 'radius':radius,
                        'marker_value':next(iter(marked)), 'body_value':next(iter(rest)),
                        'center_value':patch[row][col]}))
        records.append(FrozenMap({'index':index, 'row':cell.row, 'col':cell.col,
            'patch':patch, 'pattern_ref':cell.pattern_ref,
            'uniform_value':next(iter(values)) if len(values) == 1 else None,
            'marker_measurements':tuple(masks),
            'bbox':(cell.bbox.top, cell.bbox.left, cell.bbox.bottom, cell.bbox.right),
            'point':(cell.bbox.top + height // 2, cell.bbox.left + width // 2)}))
    return tuple(records)


def query_marker_rows(records, query, domain, retained_rows=None):
    """Execute only the geometric mask and value binding declared by Source."""
    rows = []
    field = query['value_field']
    if field not in ('center_value', 'marker_value'):
        raise ValueError('unsupported Source marker value query')
    for record in records:
        if record['index'] not in domain:
            continue
        matches = tuple(row for row in record['marker_measurements']
            if row['mask'] == query['mask']
            and (retained_rows is not None or row['marker_value'] != row['body_value']))
        retained = tuple(row for row in (retained_rows or ()) if row['index'] == record['index'])
        if retained_rows is not None:
            if not retained:
                continue
            matches = tuple(row for row in matches
                if row['radius'] == retained[0]['radius'] and row[field] == retained[0]['value'])
        if len(matches) == 1:
            row = matches[0]
            rows.append(FrozenMap({'index':record['index'], 'value':row[field],
                'content':row['body_value'], 'radius':row['radius']}))
    if retained_rows is not None and len(rows) != len(retained_rows):
        return ()
    return tuple(rows)


def component_rows(opened, origins, demands, columns, cell_count, deltas):
    remaining = set(opened)
    rows, index_to_component = [], {}
    while remaining:
        first = min(remaining)
        remaining.remove(first)
        pending, cells = [first], []
        while pending:
            node = pending.pop()
            cells.append(node)
            row, col = divmod(node, columns)
            for dr, dc in deltas:
                rr, cc = row + dr, col + dc
                other = rr * columns + cc
                if 0 <= cc < columns and 0 <= other < cell_count and other in remaining:
                    remaining.remove(other)
                    pending.append(other)
        cell_set = frozenset(cells)
        values = frozenset(value for index, value in origins if index in cell_set)
        wanted = frozenset(value for index, value in demands if index in cell_set)
        position = len(rows)
        rows.append((cell_set, values, wanted))
        for node in sorted(cell_set):
            index_to_component[node] = position
    return tuple(rows), index_to_component


def evaluate_profile(records, geometry, editable_patch, domain_bounds, profile,
        contract, retained_empty_value=None, retained_role_rows=None):
    """Compare one already declared role/law alternative to the current raster."""
    columns, cell_count = int(geometry[8]), int(geometry[7]) * int(geometry[8])
    top, left, bottom, right = domain_bounds
    domain = frozenset(record['index'] for record in records
        if top <= record['row'] <= bottom and left <= record['col'] <= right)
    emitters = query_marker_rows(records, profile['emitter_query'], domain,
        None if retained_role_rows is None else retained_role_rows['emitter_rows'])
    receivers = query_marker_rows(records, profile['receiver_query'], domain,
        None if retained_role_rows is None else retained_role_rows['receiver_rows'])
    if not emitters or not receivers:
        return FrozenMap({'status':'unknown', 'cause':'marker_query_has_no_current_support'})
    if {row['index'] for row in emitters} & {row['index'] for row in receivers}:
        return FrozenMap({'status':'unknown', 'cause':'role_queries_overlap'})
    # A contradiction independent of the empty-content interpretation remains
    # visible; it is not silently turned into absent role evidence.
    if (any(row['content'] != row['value'] for row in emitters)
            and contract.get('unacquired_union_binding') != 'two_unreserved_unique_originals'):
        probe_opened = {record['index'] for record in records
            if record['index'] in domain and record['uniform_value'] is not None}
        probe_opened.update(row['index'] for row in emitters + receivers)
        probe_origins = tuple((row['index'], row['value']) for row in emitters)
        probe_demands = tuple((row['index'], row['value']) for row in receivers)
        probe_components, probe_mapping = component_rows(probe_opened, probe_origins,
            probe_demands, columns, cell_count, tuple(tuple(d) for d in contract['neighbor_deltas']))
        if any(len(probe_components[probe_mapping[row['index']]][1]) == 1
                and row['content'] != row['value'] for row in emitters):
            return FrozenMap({'status':'contradicted', 'cause':'emitter_own_content_differs'})
        return FrozenMap({'status':'unknown', 'cause':'unacquired_origin_union'})
    if retained_empty_value is None:
        backgrounds = {row['content'] for row in receivers}
        if len(backgrounds) != 1:
            return FrozenMap({'status':'unknown', 'cause':'empty_content_is_ambiguous'})
        empty = next(iter(backgrounds))
    else:
        empty = retained_empty_value
    originals = frozenset(row['value'] for row in emitters)
    if any(row['value'] not in originals for row in receivers):
        if contract.get('unacquired_union_binding') == 'two_unreserved_unique_originals':
            return evaluate_partial_origin_union(records, geometry, editable_patch,
                domain_bounds, profile, contract, empty, emitters, receivers)
        return FrozenMap({'status':'unknown', 'cause':'mixture_demand_not_in_acquired_domain'})
    editable = frozenset(record['index'] for record in records
        if record['index'] in domain and record['patch'] == editable_patch)
    observed = {record['index']:record['uniform_value'] for record in records
        if record['index'] in domain and record['uniform_value'] is not None}
    observed.update({row['index']:row['content'] for row in emitters + receivers})
    opened = frozenset(observed)
    origins = tuple((row['index'], row['value']) for row in emitters)
    demands = tuple((row['index'], row['value']) for row in receivers)
    deltas = tuple(tuple(delta) for delta in contract['neighbor_deltas'])
    components, mapping = component_rows(opened, origins, demands, columns, cell_count, deltas)
    for cells, values, _wanted in components:
        if len(values) > 1:
            return FrozenMap({'status':'unknown', 'cause':'unacquired_origin_union'})
        content = next(iter(values)) if values else empty
        if any(observed[node] != content for node in cells):
            return FrozenMap({'status':'contradicted', 'cause':'component_content_differs'})
    satisfied = sum(components[mapping[node]][1] == frozenset((value,))
        for node, value in demands)
    return FrozenMap({'status':'fits', 'cause':'current_component_contents_agree',
        'geometry':tuple(geometry), 'domain_bounds':tuple(domain_bounds),
        'editable_patch':editable_patch, 'empty_value':empty, 'role_profile':profile,
        'opened':tuple(sorted(opened)), 'editable':tuple(sorted(editable)),
        'origins':origins, 'demands':demands, 'satisfied_count':satisfied,
        'emitter_rows':emitters, 'receiver_rows':receivers,
        'observed_content':tuple(sorted(observed.items()))})


def component_rows_value(components, mapping, node, empty):
    values = components[mapping[node]][1]
    return next(iter(values)) if len(values) == 1 else empty if not values else None


def evaluate_partial_origin_union(records, geometry, editable_patch, domain_bounds,
        profile, contract, empty, emitters, receivers):
    """Measure the single binary binding explicitly supplied by the Source contract.

    The binding is a counterfactual, never an acquired colour recipe. Current
    connected components alone can supply an observed set-to-display relation.
    """
    originals = frozenset(row['value'] for row in emitters)
    demand_values = frozenset(row['value'] for row in receivers)
    unmapped = demand_values - originals
    remainder = originals - demand_values
    if (len(unmapped) != 1 or len(remainder) != 2
            or len(emitters) != len(originals)):
        return FrozenMap({'status':'unknown', 'cause':'binary_origin_binding_not_unique'})
    required = {value:frozenset((value,)) for value in demand_values & originals}
    required[next(iter(unmapped))] = remainder
    top, left, bottom, right = domain_bounds
    domain = frozenset(row['index'] for row in records
        if top <= row['row'] <= bottom and left <= row['col'] <= right)
    editable = frozenset(row['index'] for row in records
        if row['index'] in domain and row['patch'] == editable_patch)
    observed = {row['index']:row['uniform_value'] for row in records
        if row['index'] in domain and row['uniform_value'] is not None}
    observed.update({row['index']:row['content'] for row in emitters + receivers})
    origins = tuple((row['index'], row['value']) for row in emitters)
    demands = tuple((row['index'], row['value']) for row in receivers)
    opened = frozenset(observed)
    columns, count = int(geometry[8]), int(geometry[7])*int(geometry[8])
    deltas = tuple(tuple(x) for x in contract['neighbor_deltas'])
    components, mapping = component_rows(opened, origins, demands, columns, count, deltas)
    displays = {frozenset():empty, **{frozenset((v,)):v for v in originals}}
    for cells, values, wanted in components:
        contents = frozenset(observed[node] for node in cells)
        if len(contents) != 1:
            return FrozenMap({'status':'contradicted', 'cause':'component_content_differs'})
        content = next(iter(contents))
        if values in displays and displays[values] != content:
            return FrozenMap({'status':'contradicted', 'cause':'origin_set_display_differs'})
        if len(values) > 1 and values != remainder:
            return FrozenMap({'status':'unknown', 'cause':'origin_union_outside_binary_binding'})
        if wanted and any(values - required[value] for value in wanted):
            return FrozenMap({'status':'contradicted', 'cause':'current_demand_origin_set_incompatible'})
        displays[values] = content
    if remainder in displays and displays[remainder] != next(iter(unmapped)):
        return FrozenMap({'status':'contradicted', 'cause':'observed_union_falsifies_display_binding'})
    unknown = () if remainder in displays else (tuple(sorted(remainder)),)
    return FrozenMap({'status':'fits', 'cause':'current_contents_fit_partial_origin_union_binding',
        'geometry':tuple(geometry), 'domain_bounds':tuple(domain_bounds),
        'editable_patch':editable_patch, 'empty_value':empty, 'role_profile':profile,
        'opened':tuple(sorted(opened)), 'editable':tuple(sorted(editable)),
        'origins':origins, 'demands':demands,
        'demand_origin_sets':tuple((node,tuple(sorted(required[value]))) for node,value in demands),
        'unacquired_origin_sets':unknown,
        'satisfied_count':sum(components[mapping[node]][1] == required[value]
            and observed[node] == value for node,value in demands),
        'emitter_rows':emitters, 'receiver_rows':receivers,
        'observed_content':tuple(sorted(observed.items()))})


def calculate_route_words(model, contract, remaining_quantity):
    """At most one minimum-cost path per Source traversal description.

    A negative return is scoped to these descriptions. No family of paths or
    permutation family is enumerated and no empty-world proof is produced.
    """
    if model.get('demand_origin_sets'):
        from .component_origin_routes import calculate_origin_set_route_words
        return calculate_origin_set_route_words(model, contract, remaining_quantity)
    if contract['cost_measure'] != 'new_cells_then_edges':
        raise ValueError('unsupported Source route cost measure')
    geometry = model['geometry']
    columns, cell_count = int(geometry[8]), int(geometry[7]) * int(geometry[8])
    initial = frozenset(model['opened'])
    editable = frozenset(model['editable'])
    origins, demands = tuple(model['origins']), tuple(model['demands'])
    deltas = tuple(tuple(delta) for delta in contract['neighbor_deltas'])
    traversal = tuple(contract['route_descriptions'])
    if len(traversal) > 3:
        raise ValueError('Source route-description bound exceeds three')
    words, examined, bounded = [], 0, False

    def separation(demand):
        node, value = demand
        row, col = divmod(node, columns)
        distances = tuple(abs(row - origin // columns) + abs(col - origin % columns)
            for origin, pigment in origins if pigment == value)
        return min(distances) if distances else cell_count

    for ordinal, description in enumerate(traversal):
        if description == 'increasing_separation':
            order = tuple(sorted(demands, key=lambda row:(separation(row), row[0])))
        elif description == 'decreasing_separation':
            order = tuple(sorted(demands, key=lambda row:(-separation(row), row[0])))
        elif description == 'measurement_order':
            order = tuple(sorted(demands))
        else:
            raise ValueError('unsupported Source route description')
        opened, word, complete = set(initial), [], True
        for target, pigment in order:
            components, mapping = component_rows(opened, origins, demands, columns, cell_count, deltas)
            if components[mapping[target]][1] == frozenset((pigment,)):
                continue
            starts = tuple(sorted(node for node in opened
                if components[mapping[node]][1] == frozenset((pigment,))))
            allowed = set()
            for node in sorted(opened | editable):
                row, col = divmod(node, columns)
                touched = {mapping[node]} if node in mapping else set()
                for dr, dc in deltas:
                    rr, cc = row + dr, col + dc
                    other = rr * columns + cc
                    if 0 <= cc < columns and 0 <= other < cell_count and other in mapping:
                        touched.add(mapping[other])
                if all(not (components[index][1] - {pigment})
                        and not (components[index][2] - {pigment}) for index in touched):
                    allowed.add(node)
            queue, distances, parents = [], {}, {}
            for node in starts:
                distances[node] = (0, 0)
                parents[node] = None
                heappush(queue, (0, 0, node))
            while queue:
                cost, depth, node = heappop(queue)
                if distances.get(node) != (cost, depth):
                    continue
                examined += 1
                if examined > int(contract['maximum_expansions']):
                    bounded = True
                    break
                if node == target:
                    break
                if depth >= int(contract['maximum_path_length']):
                    continue
                row, col = divmod(node, columns)
                for dr, dc in deltas:
                    rr, cc = row + dr, col + dc
                    other = rr * columns + cc
                    if not (0 <= cc < columns and 0 <= other < cell_count and other in allowed):
                        continue
                    distance = cost + (other not in opened), depth + 1
                    if other not in distances or distance < distances[other]:
                        distances[other] = distance
                        parents[other] = node
                        heappush(queue, (*distance, other))
            if bounded or target not in parents:
                complete = False
                break
            suffix, cursor = [], target
            while parents[cursor] is not None:
                if cursor not in opened:
                    suffix.append(cursor)
                cursor = parents[cursor]
            for node in reversed(suffix):
                opened.add(node)
                word.append(node)
                components, mapping = component_rows(opened, origins, demands, columns, cell_count, deltas)
                if any(len(values) > 1 or (values and wanted - values)
                        for _cells, values, wanted in components):
                    complete = False
                    break
            if not complete or len(word) > remaining_quantity:
                complete = False
                break
        if complete and word:
            components, mapping = component_rows(opened, origins, demands, columns, cell_count, deltas)
            all_satisfied = all(components[mapping[node]][1] == frozenset((value,))
                for node, value in demands)
            if all_satisfied:
                words.append(FrozenMap({'description_ordinal':ordinal,
                    'description':description, 'new_cell_indices':tuple(word),
                    'primitive_count':len(word), 'demand_count':len(demands),
                    'all_prefixes_valid':True,
                    'word_digest':stable_digest((geometry, word, origins, demands))}))
        if bounded:
            break
    return tuple(words), FrozenMap({'examined_count':examined, 'bounded':bounded,
        'world_impossibility_asserted':False, 'description_count':len(traversal)})
