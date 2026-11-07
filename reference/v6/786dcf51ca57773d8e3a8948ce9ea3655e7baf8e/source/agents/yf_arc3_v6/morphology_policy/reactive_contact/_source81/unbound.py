"""Static Source81 calculation with explicit operator hypotheses."""
from .prospective_grasp import FrozenMap, ReachabilityInput, StepVector, finite_grid_reachability, candidate_grasp_roots, translated_mask, measure_cell_support_model, normalized_cell_pattern, _bound_pair_peer_inventory, _current_pair_clearance, _pending_motion_measurement, _peer_access_inventory

def measure_unbound(value, *, positions, steps, enclosure_value, control_bbox=None, cell_domain_measurement, operator_candidates):
    empty = {'prospective_grasp_present': False, 'prospective_grasp_complete': False}
    query = value.route_generation_policy.get('prospective_grasp_query', {})
    if query.get('selection_order') != 'composition_size_observed_method_mobility_access':
        return empty
    if query.get('background_rule') != 'reuse_unique_observed_traversed_cell_background':
        return empty
    support_values = set(value.episode_input_aligned_underlay_values)
    if not support_values or not operator_candidates or any((row.get('action_ref') not in value.available_action_refs or not row.get('hypothesis_ref') or (not row.get('binding_claim_refs')) for row in operator_candidates)):
        return empty
    bound = _bound_pair_peer_inventory(value, query=query, positions=positions, steps=steps, enclosure_value=enclosure_value, cell_domain_measurement=cell_domain_measurement)
    if bound is not None:
        return bound
    boxes = (control_bbox,) if control_bbox is not None else value.canonical_provisional_control_geometry_bboxes
    if len(boxes) != 1 or not value.retained_grid_geometry:
        return empty
    box = boxes[0]
    if sum((component.bbox == box for component in value.components.components)) != 1:
        return {**empty, 'prospective_grasp_failure_ref': 'current_control_component_not_unique'}
    if any((not (box.top <= r <= box.bottom and box.left <= c <= box.right) for a in value.canonical_controlled_assembly_term_facts for r, c in a.get('member_pixel_positions', ()))):
        return empty
    grid = next((g for g in value.periodic_cell_grids.candidates if (g.row_offset, g.col_offset, g.cell_height, g.cell_width, g.row_pitch, g.col_pitch, g.logical_rows, g.logical_columns) == value.retained_grid_geometry), None)
    if grid is None or len(grid.cells) > query['maximum_cells']:
        return empty
    cells = {(c.row, c.col): c for c in grid.cells}
    start = next((p for p, c in sorted(cells.items()) if c.bbox == box), None)
    if start is None:
        return empty
    vectors = {ref: (dr // grid.row_pitch, dc // grid.col_pitch) for ref, (dr, dc) in sorted(steps.items()) if dr % grid.row_pitch == 0 and dc % grid.col_pitch == 0}
    if len(vectors) != len(steps) or any((abs(dr) + abs(dc) != 1 for dr, dc in sorted(vectors.values()))):
        return empty

    def pattern(cell):
        b = cell.bbox
        return tuple((value.frame.rows[r][c] for r in range(b.top, b.bottom + 1) for c in range(b.left, b.right + 1)))
    raw = {p: pattern(c) for p, c in sorted(cells.items())}
    model = measure_cell_support_model(value, {(r, c): {color} for r, row in enumerate(value.frame.rows) for c, color in enumerate(row)})
    if model is None:
        return {**empty, 'prospective_grasp_failure_ref': 'observed_background_not_unique'}
    nonbackground = {p for region, _, _ in model[1] for p in region}
    silhouette = normalized_cell_pattern(raw[start])
    candidates = {p for p in nonbackground if p != start and normalized_cell_pattern(raw[p]) == silhouette and (raw[p] != raw[start]) and (enclosure_value not in raw[p])}
    preserved = set()
    if query.get('preserve_observed_whole_support_effect') is True:
        inventory = value.canonical_contextual_effect_method_inventory
        for method in inventory.get('rows', ()) if inventory.get('enumeration_complete') else ():
            context = method['operator_support_context']
            if context.get('context_epoch') != value.current_context_epoch:
                continue
            signature = method['changed_part_signature']
            for contact in context.get('cell_support_contacts') or ():
                if contact['body_ref'] != 'carried_part' or not contact['whole_body_matches_support_region']:
                    continue
                region = frozenset((tuple(p) for p in contact['support_region_cells']))
                if not region or not region <= candidates:
                    continue
                top = min((cells[p].bbox.top for p in region))
                left = min((cells[p].bbox.left for p in region))
                bottom = max((cells[p].bbox.bottom for p in region))
                right = max((cells[p].bbox.right for p in region))
                if any((component.value == signature[0] and (component.bbox.top, component.bbox.left, component.bbox.bottom, component.bbox.right) == (top, left, bottom, right) and ((component.bbox.height, component.bbox.width) == tuple(signature[1:3])) and (tuple(component.relative_pixels) == tuple((tuple(p) for p in signature[3]))) for component in value.components.components)):
                    preserved.update(region)
        candidates.difference_update(preserved)
    groups = []
    unseen = set(candidates)
    while unseen:
        seed = min(unseen)
        unseen.remove(seed)
        group = {seed}
        pending = [seed]
        while pending:
            p = pending.pop()
            for dr, dc in sorted(vectors.values()):
                q = (p[0] + dr, p[1] + dc)
                if q in unseen and raw[q] == raw[seed]:
                    unseen.remove(q)
                    group.add(q)
                    pending.append(q)
        groups.append(frozenset(group))
    method_refs_by_group = {}
    inventory = value.canonical_contextual_effect_method_inventory
    for group in groups:
        observed_types = tuple(sorted({(grid.cell_height, grid.cell_width, normalized_cell_pattern(raw[p])) for p in group}))
        refs = set()
        for method in inventory.get('rows', ()) if inventory.get('enumeration_complete') else ():
            context = method['operator_support_context']
            if context.get('context_epoch') != value.current_context_epoch:
                continue
            body = next((r for r in context.get('coverage', ()) if r['body_ref'] == 'carried_part'), {})
            if body.get('body_cell_pattern_types') == observed_types and all((body.get('appearance_value') in raw[p] for p in group)):
                refs.update(method['recipe_premise_claim_refs'])
        method_refs_by_group[group] = tuple(sorted(refs))
    free = {p for p, c in sorted(cells.items()) if (c.bbox.top, c.bbox.left) in positions}
    free.update(candidates)
    free.add(start)
    free.difference_update(preserved)
    supports = {p for p in sorted(free - candidates - {start} & nonbackground) if enclosure_value not in raw[p]}
    contact_clearance = _current_pair_clearance(value, query=query, cells=cells, start=start, free=free, raw=raw, silhouette=silhouette, nonbackground=nonbackground, enclosure_value=enclosure_value, vectors=vectors)
    if not groups:
        return {**empty, **contact_clearance}
    step_rows = tuple((StepVector(label=ref, delta_row=d[0], delta_col=d[1]) for ref, d in sorted(vectors.items())))

    def reach(origin, domain, goals=()):
        return finite_grid_reachability(ReachabilityInput(rows=grid.logical_rows, columns=grid.logical_columns, start=origin, traversable=tuple(sorted(domain)), goals=tuple(sorted(goals)), steps=step_rows))
    pending_motion = _pending_motion_measurement(value, query=query, grid=grid, box=box, start=start, groups=groups, raw=raw, free=free, candidates=candidates, supports=supports, reach=reach)
    specific_query = query.get('specific_recall_query')
    if specific_query:
        specific = _pending_motion_measurement(value, query={**dict(query), **dict(specific_query)}, grid=grid, box=box, start=start, groups=groups, raw=raw, free=free, candidates=candidates, supports=supports, reach=reach)
        pending_motion.update({key.replace('prospective_grasp_pending_motion_', 'specific_recalled_grasp_pending_motion_', 1): item for key, item in sorted(specific.items())})
    pending_motion.update(contact_clearance)
    pending_motion.update(_peer_access_inventory(value, query=query, cells=cells, grid=grid, box=box, start=start, groups=groups, free=free, candidates=candidates, vectors=vectors, reach=reach))
    if not supports:
        return {**empty, **pending_motion}
    access = reach(start, free - candidates, free - candidates)
    accesses = {g.goal: g for g in access.goals if g.reachable}
    rows = []
    work = 0
    for group in groups:
        roots, used, complete = candidate_grasp_roots(((0, 0),), sorted(group), tuple(sorted(vectors.values())), query['maximum_comparisons'] - work)
        work += used
        if not complete:
            return {**empty, 'prospective_grasp_bound_reached': True}
        for root in roots:
            if root not in accesses:
                continue
            offsets = tuple(((r - root[0], c - root[1]) for r, c in sorted(group)))
            allowed = set()
            for p in sorted(free - candidates):
                work += len(offsets) + 1
                if work > query['maximum_comparisons']:
                    return {**empty, 'prospective_grasp_bound_reached': True}
                cargo = set(translated_mask(offsets, p))
                if cargo <= free and (not cargo.intersection(candidates - group)) and (p not in cargo):
                    allowed.add(p)
            if root not in allowed:
                continue
            motion = reach(root, allowed)
            reached = {d.position: d.distance for d in motion.distances}
            if len(reached) <= 1:
                continue
            useful = [(p, d) for p, d in sorted(reached.items()) if p in supports or set(translated_mask(offsets, p)).intersection(supports)]
            if not useful:
                continue
            terminal, delivery_distance = min(useful, key=lambda item: (item[1], item[0]))
            rank = (len(query['composition_kinds']), len(group), bool(method_refs_by_group[group]), len(reached), -accesses[root].distance - delivery_distance)
            rows.append((rank, root, group, accesses[root], terminal, delivery_distance))
    if not rows:
        return {**empty, **pending_motion, 'prospective_grasp_complete': True}
    rows.sort(key=lambda row: (row[0], tuple((-v for v in row[1]))), reverse=True)
    rank, root, group, access, terminal, delivery_distance = rows[0]
    route = tuple(access.first_shortest_step_labels)
    return {**pending_motion, 'prospective_grasp_present': True, 'prospective_grasp_complete': True, 'prospective_grasp_preserved_effect_cell_count': len(preserved), 'prospective_grasp_origin_position': (box.top, box.left), 'prospective_grasp_ready': root == start, 'prospective_grasp_origin_bbox_tuples': ((box.top, box.left, box.bottom, box.right),), 'prospective_grasp_target_position': (cells[root].bbox.top, cells[root].bbox.left), 'prospective_grasp_action_refs': route, 'prospective_grasp_first_action_ref': route[0] if route else '', 'prospective_grasp_composition_count': rank[0], 'prospective_grasp_part_cell_count': len(group), 'prospective_grasp_reachable_pose_count': rank[3], 'prospective_grasp_matching_effect_method_claim_refs': method_refs_by_group[group], 'prospective_grasp_observed_method_match': bool(method_refs_by_group[group]), 'prospective_grasp_future_support_position': terminal, 'prospective_grasp_future_support_distance': delivery_distance, 'prospective_grasp_compared_grip_count': len(rows), 'prospective_grasp_hypothesis_ref': query['hypothesis'], 'prospective_grasp_action_authorization': False}
