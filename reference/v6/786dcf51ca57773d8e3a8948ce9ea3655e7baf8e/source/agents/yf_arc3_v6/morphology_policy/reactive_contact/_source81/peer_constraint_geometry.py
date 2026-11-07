"""Finite cell-domain contrasts; Source/DRM owns goals and operator hypotheses."""
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from agents.yf_arc3_v5.capabilities.contracts import ReachabilityInput, StepVector
from .operator_cell_support import measure_cell_support_model
from agents.yf_arc3_v5.capabilities.routing import finite_grid_reachability


def cell_domain(value, steps, enclosure_value, maximum_cells):
    grid = next((g for g in value.periodic_cell_grids.candidates
        if (g.row_offset, g.col_offset, g.cell_height, g.cell_width, g.row_pitch,
            g.col_pitch, g.logical_rows, g.logical_columns) == value.retained_grid_geometry), None)
    if grid is None or len(grid.cells) > maximum_cells:
        return FrozenMap()
    model = measure_cell_support_model(value, {
        (r, c): {color} for r, row in enumerate(value.frame.rows)
        for c, color in enumerate(row)})
    if model is None:
        return FrozenMap()
    cells = {(c.row, c.col): c for c in grid.cells}
    boxes = {(c.bbox.top, c.bbox.left, c.bbox.bottom, c.bbox.right): p
        for p, c in sorted(cells.items())}
    vectors = {ref: (dr // grid.row_pitch, dc // grid.col_pitch)
        for ref, (dr, dc) in sorted(steps.items())
        if dr % grid.row_pitch == 0 and dc % grid.col_pitch == 0}
    if len(vectors) != len(steps) or any(abs(dr) + abs(dc) != 1 for dr, dc in sorted(vectors.values())):
        return FrozenMap()
    terrain = tuple(sorted(p for p, c in sorted(cells.items()) if all(
        value.frame.rows[r][col] != enclosure_value
        for r in range(c.bbox.top, c.bbox.bottom + 1)
        for col in range(c.bbox.left, c.bbox.right + 1))))
    component_cells = {c.component_id: boxes[box] for c in value.components.components
        if (box := (c.bbox.top, c.bbox.left, c.bbox.bottom, c.bbox.right)) in boxes}
    return FrozenMap({'frame_ref': value.current_observation_frame_ref,
        'rows': grid.logical_rows, 'columns': grid.logical_columns,
        'row_pitch': grid.row_pitch, 'col_pitch': grid.col_pitch,
        'vectors': FrozenMap(vectors), 'terrain': terrain,
        'occupied': tuple(sorted({p for region, _, _ in model[1] for p in region})),
        'component_cells': FrozenMap(component_cells),
        'entity_component_refs': value.current_entity_component_refs,
        'cell_pixel_origins': FrozenMap({f'{r}:{c}': (cell.bbox.top, cell.bbox.left)
            for (r, c), cell in sorted(cells.items())})})


def distances(domain, start, free):
    return {x.position: x.distance for x in finite_grid_reachability(ReachabilityInput(
        rows=domain['rows'], columns=domain['columns'], start=start,
        traversable=tuple(sorted(free)), goals=(), steps=tuple(StepVector(
            label=ref, delta_row=dr, delta_col=dc)
            for ref, (dr, dc) in sorted(domain['vectors'].items())))).distances}


def stationary_contrasts(domain, row, body_offsets, joint_free, maximum_rows):
    """Enumerate terminal-neighbour contrasts without choosing a constraint."""
    root, peer = tuple(row['grip_root']), tuple(row['peer_cell'])
    body = {(root[0] + dr, root[1] + dc) for dr, dc in body_offsets}
    parked = body - {root}
    others = set(domain['occupied']) - set(row['part_cells']) - {
        tuple(domain['start']), peer}
    free = set(domain['terrain']) - others - parked - {peer}
    if root not in free:
        return ()
    bare = distances(domain, root, free)
    loaded = distances(domain, root, joint_free) if root in joint_free else {}
    open_without_part = set(domain['terrain']) - others
    neighbors = tuple((peer[0] + dr, peer[1] + dc)
        for dr, dc in sorted(domain['vectors'].values()))
    exits = {p for p in neighbors if p in open_without_part - parked}
    loss = sum(p in open_without_part for p in neighbors) - len(exits)
    output = []
    for terminal in sorted(exits):
        if terminal not in bare:
            continue
        if len(output) >= maximum_rows:
            raise ValueError('stationary contrast row bound exceeded')
        ref = 'stationary-contrast:' + stable_digest((row['candidate_ref'], terminal))
        output.append(FrozenMap({**dict(row), 'candidate_ref': ref,
            'independent_terminal': terminal,
            'independent_access_distance': bare[terminal],
            'joint_terminal_reachable': terminal in loaded,
            'stationary_part_neighbor_loss': loss,
            'peer_exit_count_after_independent_actor': len(exits - {terminal}),
            'future_part_cells': tuple(sorted(parked)),
            'total_primitive_distance': row['access_distance'] + 1 + bare[terminal] + 1}))
    return tuple(output)


def independent_inventory(domain, *, actor, peer, part, origin_bbox, proposal_ref):
    cells = domain['component_cells']
    if any(ref not in cells for ref in (actor, peer, part)):
        return None
    start, target, parked = (tuple(cells[ref]) for ref in (actor, peer, part))
    other = set(domain['occupied']) - {start, target, parked}
    without_part = set(domain['terrain']) - other
    free = without_part - {parked, target}
    if start not in free:
        return None
    bare = distances(domain, start, free)
    neighbors = {(target[0] + dr, target[1] + dc) for dr, dc in sorted(domain['vectors'].values())}
    exits = neighbors & (without_part - {parked})
    loss = len(neighbors & without_part) - len(exits)
    geometry = FrozenMap.overlay({'start': start, 'free': tuple(sorted(free)),
        'origin_bbox': origin_bbox}, domain)
    rows = []
    for terminal in sorted(exits):
        if terminal not in bare:
            continue
        contact = terminal == start
        root = target if contact else terminal
        distance = 1 if contact else bare[terminal]
        row_geometry = FrozenMap.overlay({'free': tuple(sorted(free | {target}))}, geometry) if contact else geometry
        ref = 'independent-contrast:' + stable_digest((proposal_ref, domain['frame_ref'], terminal, contact))
        rows.append(FrozenMap({'candidate_ref': ref,
            'actor_component_ref': actor, 'peer_component_ref': peer,
            'peer_cell': target, 'part_cells': (parked,),
            'grip_root': root, 'grip_row': root[0], 'grip_col': root[1],
            'terminal_root': root, 'access_distance': distance, 'joint_distance': distance,
            'total_primitive_distance': distance + (0 if contact else 1),
            'joint_reachable_pose_count': len(bare), 'frame_ref': domain['frame_ref'],
            'current_bound_pair_present': False, 'independent_motion_present': True,
            'conditional_peer_contact': contact,
            'stationary_part_neighbor_loss': loss,
            'peer_exit_count_after_independent_actor': len(exits - {terminal}),
            'independent_terminal': terminal, 'private_geometry': row_geometry,
            'prepared_constraint_ref': proposal_ref}))
    return FrozenMap({'enumeration_complete': True, 'rows': tuple(rows), 'geometry': geometry})
