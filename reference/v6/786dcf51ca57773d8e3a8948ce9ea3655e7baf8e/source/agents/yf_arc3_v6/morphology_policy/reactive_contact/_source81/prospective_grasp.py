"""Conditional grasp/access measurements over the retained observed cell domain.

No grasp or terrain meaning is acquired here. The declared query compares
recolour-equivalent silhouettes, assuming rigid attachment for an experiment.
Actual acquisition and action release remain with the existing recipe/WHY path.
"""
from agents.yf_arc3_v5.capabilities.contracts import ReachabilityInput, StepVector
from agents.yf_arc3_v5.capabilities.routing import finite_grid_reachability
from agents.yf_arc3_v5.capabilities.rigid_grasp_geometry import candidate_grasp_roots, translated_mask
from .operator_cell_support import measure_cell_support_model, normalized_cell_pattern
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


def _bound_pair_peer_inventory(value, *, query, positions, steps, enclosure_value,
                               cell_domain_measurement):
    """Current acquired footprint versus every peer; no evasion law is assumed."""
    assemblies = value.canonical_controlled_assembly_term_facts
    if not assemblies:
        return None
    empty = {'prospective_grasp_present': False, 'prospective_grasp_complete': False}
    profile = query.get('bound_pair_query', {})
    if profile.get('terminal_relation') != 'current_body_face_adjacent_to_peer':
        return empty
    recipes = {r['recipe_token']: (a, r) for a in assemblies
        for r in a.get('contextual_part_recipe_rows', ()) if r.get('common_motion_transition_ref')
        and r.get('operational_scene_ref') == value.current_observation_frame_ref}
    if len(recipes) != 1:
        # This finite pair query has no current covariance witness.
        # Other declared measurements retain their own admissible domains.
        return None
    assembly, recipe = sorted(recipes.items())[0][1]
    proof_refs = tuple(sorted(set((*assembly.get('role_premise_claim_refs', ()),
                                  *recipe.get('recipe_premise_claim_refs', ())))))
    grid = next((g for g in value.periodic_cell_grids.candidates
        if (g.row_offset,g.col_offset,g.cell_height,g.cell_width,g.row_pitch,
            g.col_pitch,g.logical_rows,g.logical_columns) == value.retained_grid_geometry), None)
    if grid is None or len(grid.cells) > query['maximum_cells'] or not proof_refs:
        return empty
    cells = {(c.row,c.col):c for c in grid.cells}
    by_box = {(c.bbox.top,c.bbox.left,c.bbox.bottom,c.bbox.right):p
              for p,c in sorted(cells.items())}
    components = {c.component_id:c for c in value.components.components}
    core = components.get(value.current_entity_component_refs.get(recipe['core_entity_ref']))
    if core is None:
        return empty
    start = by_box.get((core.bbox.top,core.bbox.left,core.bbox.bottom,core.bbox.right))
    boxes = tuple(tuple(b) for b in assembly.get('member_bbox_tuples', ()))
    if start is None or len(boxes) != 2 or any(b not in by_box for b in boxes):
        return empty
    body = {by_box[b] for b in boxes}
    if start not in body or len(body) != 2:
        return empty
    part = body-{start}
    offsets = tuple((r-start[0],c-start[1]) for r,c in sorted(body))
    vectors = {ref:(dr//grid.row_pitch,dc//grid.col_pitch) for ref,(dr,dc) in sorted(steps.items())
        if dr % grid.row_pitch == 0 and dc % grid.col_pitch == 0}
    if len(vectors) != len(steps) or any(abs(dr)+abs(dc) != 1 for dr,dc in sorted(vectors.values())):
        return empty
    terrain = {p for p,c in sorted(cells.items()) if all(value.frame.rows[r][col] != enclosure_value
        for r in range(c.bbox.top,c.bbox.bottom+1) for col in range(c.bbox.left,c.bbox.right+1))}
    model = measure_cell_support_model(value, {
        (r,c):{color} for r,row in enumerate(value.frame.rows) for c,color in enumerate(row)})
    if model is None:
        return empty
    nonbackground = {p for region,_,_ in model[1] for p in region}
    peers = {ref:by_box[(c.bbox.top,c.bbox.left,c.bbox.bottom,c.bbox.right)]
        for ref,c in sorted(components.items())
        if (c.bbox.top,c.bbox.left,c.bbox.bottom,c.bbox.right) in by_box
        and by_box[(c.bbox.top,c.bbox.left,c.bbox.bottom,c.bbox.right)] in nonbackground-body
        and by_box[(c.bbox.top,c.bbox.left,c.bbox.bottom,c.bbox.right)] in terrain}
    occupied = set(peers.values())
    allowed = {p for p,c in sorted(cells.items()) if (c.bbox.top,c.bbox.left) in positions
        and set(translated_mask(offsets,p)) <= terrain
        and not set(translated_mask(offsets,p)).intersection(occupied)}
    if start not in allowed:
        return empty
    step_rows = tuple(StepVector(label=ref,delta_row=d[0],delta_col=d[1])
                      for ref,d in sorted(vectors.items()))
    def reach(origin,domain):
        return finite_grid_reachability(ReachabilityInput(rows=grid.logical_rows,
            columns=grid.logical_columns,start=origin,traversable=tuple(sorted(domain)),
            goals=(),steps=step_rows))
    distances = reach(start,allowed).distances
    rows=[]; work=0
    for peer_ref,peer in sorted(peers.items()):
        for entry in distances:
            p,distance = entry.position,entry.distance
            future = set(translated_mask(offsets,p))
            if not any(abs(r-peer[0])+abs(c-peer[1]) == 1 for r,c in future):
                continue
            work += len(terrain)*2
            if work > query['maximum_comparisons'] or len(rows) >= profile['maximum_rows']:
                return empty
            open_cells = terrain-(occupied-{peer})-future
            base_cells = terrain-(occupied-{peer})-{p}
            if peer not in open_cells:
                continue
            area = len(reach(peer,open_cells).distances)
            base_area = len(reach(peer,base_cells).distances)
            exits = sum((peer[0]+dr,peer[1]+dc) in open_cells for dr,dc in sorted(vectors.values()))
            response_exit_max = exits
            if profile.get('peer_response_query') == 'stationary_or_one_observed_cell_step':
                responses = (peer, *((peer[0]+dr,peer[1]+dc)
                    for dr,dc in sorted(vectors.values())
                    if (peer[0]+dr,peer[1]+dc) in open_cells))
                response_exit_max = max(sum((q[0]+dr,q[1]+dc) in open_cells
                    for dr,dc in sorted(vectors.values())) for q in responses)
            ref = 'bound-access:'+stable_digest((value.current_observation_frame_ref,recipe['recipe_token'],peer_ref,p))
            rows.append(FrozenMap({'candidate_ref':ref,'actor_component_ref':core.component_id,
                'peer_component_ref':peer_ref,'peer_cell':peer,'part_cells':tuple(sorted(part)),
                'grip_root':p,'grip_row':p[0],'grip_col':p[1],
                'terminal_root':p,'access_distance':distance,'joint_distance':distance,
                'total_primitive_distance':distance,'contact_group_count_excluding_peer':len(part),
                'joint_reachable_pose_count':len(distances),'frame_ref':value.current_observation_frame_ref,
                'current_bound_pair_present':True,'coupling_claim_refs':proof_refs,
                'peer_escape_area':area,'peer_exit_count':exits,
                'one_cell_response_exit_count_upper_bound':response_exit_max,
                'peer_extra_partition_loss':base_area-area-len(part)}))
            if (profile.get('independent_terminal_relation') == 'stationary_part_and_actor_close_peer_exits'
                    and cell_domain_measurement):
                from .peer_constraint_geometry import stationary_contrasts
                work += len(terrain)*2
                if work > query['maximum_comparisons']:
                    return empty
                neutral = FrozenMap.overlay({
                    'separation_operator_action_ref': recipe['operator_action_ref'],
                    'part_entity_ref': recipe['part_entity_ref'],
                    'actor_entity_ref': recipe['core_entity_ref']}, rows[-1])
                contrasts = stationary_contrasts(FrozenMap.overlay({'start': start},
                    cell_domain_measurement), neutral, offsets, allowed,
                    profile['maximum_rows'])
                if len(rows) + len(contrasts) > profile['maximum_rows']:
                    return empty
                rows.extend(contrasts)
    geometry = FrozenMap({'start':start,'free':tuple(sorted(allowed)),
        'rows':grid.logical_rows,'columns':grid.logical_columns,'vectors':FrozenMap(vectors),
        'row_pitch':grid.row_pitch,'col_pitch':grid.col_pitch,
        'origin_bbox':(core.bbox.top,core.bbox.left,core.bbox.bottom,core.bbox.right),
        'cell_pixel_origins':FrozenMap({f'{r}:{c}':(cell.bbox.top,cell.bbox.left)
                                      for (r,c),cell in sorted(cells.items())})})
    return {**empty,'prospective_grasp_peer_access_inventory':FrozenMap({
        'enumeration_complete':True,'rows':tuple(rows),'geometry':geometry})}


def _current_pair_clearance(value, *, query, cells, start, free, raw,
                            silhouette, nonbackground, enclosure_value, vectors):
    """Current one-cell pair translations; no coupling is inferred."""
    if query.get('current_contact_clearance_query') != 'one_cell_pair_translation_current_observed_domain':
        return {}
    occupied = {p for p in nonbackground if p != start
        and normalized_cell_pattern(raw[p]) == silhouette and enclosure_value not in raw[p]}
    by_box = {cell.bbox: p for p, cell in sorted(cells.items())}
    components = {component.component_id: by_box[component.bbox]
                  for component in value.components.components if component.bbox in by_box}
    measured = {}
    for action, (dr, dc) in sorted(vectors.items()):
        clear = []
        destination = (start[0]+dr, start[1]+dc)
        for entity_ref, component_ref in sorted(value.current_entity_component_refs.items()):
            part = components.get(component_ref)
            if part not in occupied or abs(part[0]-start[0])+abs(part[1]-start[1]) != 1:
                continue
            moved_part = (part[0]+dr, part[1]+dc)
            other = occupied - {part}
            if (destination != moved_part and destination in free and moved_part in free
                    and destination not in other and moved_part not in other):
                clear.append(entity_ref)
        measured[action] = tuple(sorted(clear))
    return {'prospective_grasp_current_joint_clearance_by_action': FrozenMap(measured)}


def _peer_access_inventory(value, *, query, cells, grid, box, start, groups,
                           free, candidates, vectors, reach):
    """Finite geometry/cost rows only; SRC/DRM supplies the observed peer.

    Rejected grips retain no executable paths. A route is materialized only
    after Source has selected one row against its retained observation.
    """
    profile = query.get('peer_access_query', {})
    if profile.get('terminal_relation') != 'carried_cells_face_adjacent_to_peer':
        return {}
    empty = {'enumeration_complete': False, 'rows': (), 'geometry': FrozenMap()}
    cell_by_box = {c.bbox: p for p, c in sorted(cells.items())}
    peers = {c.component_id: cell_by_box[c.bbox] for c in value.components.components
             if c.bbox in cell_by_box and cell_by_box[c.bbox] in candidates}
    actor = next(c.component_id for c in value.components.components if c.bbox == box)
    domain = free - candidates
    initial_access = {d.position: d.distance for d in reach(start, domain).distances}
    scenes = [(candidates, start, 0, None)]
    if profile.get('access_query') == 'walk_or_one_obstacle_straight_translation':
        # A cell-sized observed component can move independently of a nearby
        # same-pattern cell; adjacency alone does not establish rigid coupling.
        for obstacle in sorted(set(peers.values())):
            for action, (dr, dc) in sorted(vectors.items()):
                contact = (obstacle[0]-dr, obstacle[1]-dc)
                if contact not in initial_access:
                    continue
                for span in range(1, len(cells)+1):
                    destination = (obstacle[0]+dr*span, obstacle[1]+dc*span)
                    if destination not in domain:
                        break
                    origin = (destination[0]-dr, destination[1]-dc)
                    scenes.append((candidates-{obstacle}|{destination}, origin,
                        initial_access[contact]+span,
                        (obstacle, destination, contact, action, span)))
                    if len(scenes)-1 > profile['maximum_translation_rows']:
                        return {'prospective_grasp_peer_access_inventory': FrozenMap(empty)}
    rows = []
    work = 0
    comparison_limit = profile.get('maximum_comparisons', query['maximum_comparisons'])
    for occupied, origin, prefix_distance, translation in scenes:
        current_domain = free - occupied
        access = {d.position: d.distance for d in reach(origin, current_domain).distances}
        for group in groups:
            if translation and translation[0] in group:
                continue
            roots, used, complete = candidate_grasp_roots(((0, 0),), sorted(group),
                tuple(sorted(vectors.values())), comparison_limit - work)
            work += used
            if not complete:
                return {'prospective_grasp_peer_access_inventory': FrozenMap(empty)}
            for root in roots:
                if root not in access:
                    continue
                contact_groups = tuple((other-{translation[0]}|{translation[1]}
                    if translation and translation[0] in other else other) for other in groups)
                contacts = sum(any(abs(r-root[0])+abs(c-root[1]) == 1 for r, c in other)
                               for other in contact_groups)
                offsets = tuple((r-root[0], c-root[1]) for r, c in sorted(group))
                allowed = set()
                for p in sorted(current_domain | group):
                    work += len(offsets) + 1
                    if work > comparison_limit:
                        return {'prospective_grasp_peer_access_inventory': FrozenMap(empty)}
                    cargo = set(translated_mask(offsets, p))
                    if cargo <= free and not cargo.intersection(occupied-group) and p not in cargo:
                        allowed.add(p)
                if root not in allowed:
                    continue
                motion = reach(root, allowed)
                distances = {d.position: d.distance for d in motion.distances}
                for peer_ref, peer_cell in sorted(peers.items()):
                    if peer_cell in group or translation and peer_cell == translation[0]:
                        continue
                    terminals = []
                    for p, distance in sorted(distances.items()):
                        work += len(offsets)
                        if work > comparison_limit:
                            return {'prospective_grasp_peer_access_inventory': FrozenMap(empty)}
                        if any(abs(r-peer_cell[0])+abs(c-peer_cell[1]) == 1
                               for r, c in translated_mask(offsets, p)):
                            terminals.append((distance, p))
                    if not terminals:
                        continue
                    distance, terminal = min(terminals)
                    ref = 'grasp-access:' + stable_digest((value.current_observation_frame_ref,
                        actor, tuple(sorted(group)), root, peer_ref, translation))
                    measured = {'candidate_ref': ref, 'actor_component_ref': actor,
                        'peer_component_ref': peer_ref, 'peer_cell': peer_cell,
                        'part_cells': tuple(sorted(group)),
                        'grip_root': root, 'grip_row':root[0], 'grip_col':root[1],
                        'terminal_root': terminal,
                        'access_distance': prefix_distance + access[root], 'joint_distance': distance,
                        'total_primitive_distance': prefix_distance + access[root] + 1 + distance,
                        'contact_group_count': contacts, 'joint_reachable_pose_count': len(distances),
                        'contact_group_count_excluding_peer': contacts - int(
                            abs(peer_cell[0]-root[0])+abs(peer_cell[1]-root[1]) == 1),
                        'frame_ref': value.current_observation_frame_ref}
                    if translation:
                        obstacle, destination, contact, action, span = translation
                        measured.update({'conditional_translation_access': True,
                            'translated_cell_origin': obstacle, 'translated_cell_destination': destination,
                            'translation_contact_root': contact, 'translation_action_ref': action,
                            'translation_prefix_distance': prefix_distance,
                            'translation_primitive_count': span})
                    rows.append(FrozenMap(measured))
                    if len(rows) > profile['maximum_rows']:
                        return {'prospective_grasp_peer_access_inventory': FrozenMap(empty)}
    geometry = FrozenMap({'start': start, 'free': tuple(sorted(domain)),
        'rows': grid.logical_rows, 'columns': grid.logical_columns,
        'vectors': FrozenMap(vectors), 'row_pitch': grid.row_pitch,
        'col_pitch': grid.col_pitch, 'origin_bbox': (box.top, box.left, box.bottom, box.right),
        'cell_pixel_origins': FrozenMap({f'{r}:{c}': (cell.bbox.top, cell.bbox.left)
                                       for (r, c), cell in sorted(cells.items())})})
    return {'prospective_grasp_peer_access_inventory': FrozenMap({
        'enumeration_complete': True, 'rows': tuple(rows), 'geometry': geometry})}


def _pending_motion_measurement(value, *, query, grid, box, start, groups,
                                raw, free, candidates, supports, reach):
    """Measure one joint-clearance witness for an unconfirmed recalled state.

    Matching a learned post-operator cell pattern is only a hypothesis. The
    witness keeps both independent-body and rigid-attachment outcomes possible;
    no current coupling, role or action permission is inferred here.
    """
    empty = {'prospective_grasp_pending_motion_count': 0}
    if query.get('pending_motion_query') != 'changed_cell_pattern_shortest_joint_support_route':
        return empty
    inventory_field = query.get('pending_motion_inventory_field',
        'canonical_contextual_recipe_method_inventory')
    if inventory_field not in ('canonical_contextual_recipe_method_inventory',
                               'canonical_contextual_effect_method_inventory'):
        raise ValueError('unsupported pending-motion sample input')
    inventory = getattr(value, inventory_field)
    if not inventory.get('enumeration_complete'):
        return empty
    from agents.yf_arc3_v5.capabilities.contextual_part_recipe import _signature, _retained_signature
    core = next(c for c in value.components.components if c.bbox == box)
    matching = []
    work = 0
    core_signature = _signature(core)
    for group in groups:
        if not any(abs(r-start[0])+abs(c-start[1]) == 1 for r,c in group):
            continue
        refs = set()
        operator_refs = set()
        for sample in inventory.get('rows', ()):
            work += len(group) + 1
            if work > query['maximum_comparisons']:
                return {**empty, 'prospective_grasp_pending_motion_bound_reached': True}
            changed = sample.get('changed_part_signature')
            if not changed:
                continue
            if (query.get('pending_motion_require_core_signature', True)
                    and (not sample.get('core_signature')
                         or _retained_signature(sample['core_signature']) != core_signature)):
                continue
            mask = frozenset((r % grid.row_pitch, c % grid.col_pitch) for r,c in changed[3])
            if not mask:
                continue
            if all(frozenset((i//grid.cell_width, i % grid.cell_width)
                    for i,color in enumerate(raw[p]) if color == changed[0]) == mask
                    for p in group):
                refs.update(sample['recipe_premise_claim_refs'])
                if sample.get('operator_action_ref'):
                    operator_refs.add(sample['operator_action_ref'])
        if refs:
            matching.append((group, tuple(sorted(refs)), tuple(sorted(operator_refs))))
    palette_variant = False
    if not matching and query.get('pending_motion_allow_part_palette_variant') is True:
        if query.get('pending_motion_require_core_signature', True) is not True:
            raise ValueError('palette-variant motion recall requires current core signature')
        core_mask = frozenset((r % grid.row_pitch, c % grid.col_pitch)
                              for r, c in core_signature[3])
        for group in groups:
            if not any(abs(r-start[0])+abs(c-start[1]) == 1 for r,c in group):
                continue
            refs = set()
            operator_refs = set()
            for sample in inventory.get('rows', ()):
                work += len(group) + 1
                if work > query['maximum_comparisons']:
                    return {**empty, 'prospective_grasp_pending_motion_bound_reached': True}
                changed = sample.get('changed_part_signature')
                if (not changed or not sample.get('core_signature')
                        or _retained_signature(sample['core_signature']) != core_signature):
                    continue
                mask = frozenset((r % grid.row_pitch, c % grid.col_pitch)
                                 for r,c in changed[3])
                if not mask or mask != core_mask:
                    continue
                if all(any(frozenset((i//grid.cell_width, i % grid.cell_width)
                            for i,color in enumerate(raw[p]) if color == observed_color) == mask
                           for observed_color in sorted(set(raw[p])) if observed_color != changed[0])
                       for p in group):
                    refs.update(sample['recipe_premise_claim_refs'])
                    if sample.get('operator_action_ref'):
                        operator_refs.add(sample['operator_action_ref'])
            if refs:
                matching.append((group, tuple(sorted(refs)), tuple(sorted(operator_refs))))
        palette_variant = bool(matching)
    if len(matching) != 1:
        return {'prospective_grasp_pending_motion_count': len(matching)}
    group, refs, operator_refs = matching[0]
    offsets = tuple((r-start[0],c-start[1]) for r,c in sorted(group))
    if work + len(free)*(len(offsets)+1) > query['maximum_comparisons']:
        return {**empty, 'prospective_grasp_pending_motion_bound_reached': True}
    allowed = set()
    for p in free-candidates:
        cargo = set(translated_mask(offsets,p))
        if cargo <= free and not cargo.intersection(candidates-group) and p not in cargo:
            allowed.add(p)
    if start not in allowed:
        return empty
    target = query.get('pending_motion_target', 'distinct_support')
    if target not in ('distinct_support', 'any_distinct_joint_clearance_cell'):
        raise ValueError('unsupported pending-motion target domain')
    goals = {p for p in allowed if p != start
        and (target == 'any_distinct_joint_clearance_cell'
             or p in supports or set(translated_mask(offsets,p)).intersection(supports))}
    routes = tuple(g for g in reach(start,allowed,goals).goals
        if g.reachable and g.first_shortest_step_labels)
    if not routes:
        return empty
    route = min(routes, key=lambda g:(g.distance,g.goal,g.first_shortest_step_labels))
    return {'prospective_grasp_pending_motion_count': 1,
        'prospective_grasp_pending_motion_action_ref': route.first_shortest_step_labels[0],
        'prospective_grasp_pending_motion_origin': start,
        'prospective_grasp_pending_motion_part_cells': tuple(sorted(group)),
        'prospective_grasp_pending_motion_support': route.goal,
        'prospective_grasp_pending_motion_distance': route.distance,
        'prospective_grasp_pending_motion_claim_refs': refs,
        'prospective_grasp_pending_motion_operator_action_refs': operator_refs,
        'prospective_grasp_pending_motion_common_clearance': True,
        'prospective_grasp_pending_motion_palette_variant': palette_variant,
        'prospective_grasp_pending_motion_part_match_basis': (
            'same_current_core_cell_mask_palette_variant' if palette_variant
            else 'exact_palette_mask')}


def materialize_peer_access_route(inventory, row):
    """Materialize the one geometry row explicitly admitted by Source/DRM."""
    geometry = row.get('private_geometry', inventory['geometry'])
    neutral = next(item for item in inventory['rows']
                   if item['candidate_ref'] == row['geometry_candidate_ref'])
    if any(row.get(key) != value for key, value in sorted(neutral.items()) if key != 'candidate_ref'):
        raise ValueError('projected grasp geometry differs from its measured inventory')
    conditional_translation = row.get('conditional_translation_access') is True
    root = tuple(row['translation_contact_root'] if conditional_translation else row['grip_root'])
    vectors = geometry['vectors']
    route_result = finite_grid_reachability(ReachabilityInput(rows=geometry['rows'],
        columns=geometry['columns'], start=geometry['start'],
        traversable=geometry['free'], goals=(root,), steps=tuple(
            StepVector(label=ref, delta_row=delta[0], delta_col=delta[1])
            for ref, delta in sorted(vectors.items()))))
    witness = route_result.goals[0]
    measured_distance = row['translation_prefix_distance']-row['translation_primitive_count'] if conditional_translation else row['access_distance']
    if not witness.reachable or witness.distance != measured_distance:
        raise ValueError('selected grasp access no longer matches its measured distance')
    route = tuple(witness.first_shortest_step_labels)
    translation_contact_now = conditional_translation and root == geometry['start']
    if translation_contact_now:
        route = (row['translation_action_ref'],)
    bound_pair = row.get('current_bound_pair_present') is True
    independent = row.get('independent_motion_present') is True
    if bound_pair or independent:
        route = route[:1]
    pixel_steps = {ref: (dr*geometry['row_pitch'], dc*geometry['col_pitch'])
                   for ref, (dr, dc) in sorted(vectors.items())}
    target_root = ((geometry['start'][0]+vectors[route[0]][0],
                    geometry['start'][1]+vectors[route[0]][1])
                   if (bound_pair or independent or translation_contact_now) and route else root)
    target = geometry['cell_pixel_origins'][f'{target_root[0]}:{target_root[1]}']
    first_delta = pixel_steps[route[0]] if route else (0, 0)
    return FrozenMap({
        'prospective_grasp_present': True, 'prospective_grasp_complete': True,
        'prospective_grasp_bound_pair_motion': bound_pair,
        'prospective_grasp_conditional_translation_access': conditional_translation,
        'prospective_grasp_translation_contact_now': translation_contact_now,
        'prospective_grasp_translated_cell_origin': row.get('translated_cell_origin'),
        'prospective_grasp_translated_cell_destination': row.get('translated_cell_destination'),
        'prospective_grasp_independent_motion': independent,
        'prospective_grasp_conditional_peer_contact': row.get('conditional_peer_contact', False),
        'prospective_grasp_independence_observed': row.get('actor_translation_with_part_stationary_observed', False),
        'prospective_grasp_peer_exit_count_after_independent_actor': row.get('peer_exit_count_after_independent_actor'),
        'prospective_grasp_stationary_part_neighbor_loss': row.get('stationary_part_neighbor_loss'),
        'prospective_grasp_useful_separation_ready': row.get('useful_separation_candidate') is True
            and root == tuple(geometry['start']),
        'prospective_grasp_separation_operator_ref': row.get('separation_operator_action_ref', ''),
        'prospective_grasp_prepared_constraint_ref': row.get('prepared_constraint_ref', ''),
        'prospective_grasp_prepared_constraint_claim_refs': (),
        'prospective_grasp_operator_observation_refs': row.get('proposal_operator_observation_refs', ()),
        'prospective_grasp_coupling_claim_refs': row.get('coupling_claim_refs',()),
        'prospective_grasp_peer_cell':row.get('peer_cell'),
        'prospective_grasp_peer_exit_count':row.get('peer_exit_count'),
        'prospective_grasp_ready': not conditional_translation and root == geometry['start'],
        'prospective_grasp_origin_position': tuple(geometry['origin_bbox'][:2]),
        'prospective_grasp_origin_bbox_tuples': (geometry['origin_bbox'],),
        'prospective_grasp_target_position': target,
        'prospective_grasp_part_cell_count': len(row['part_cells']),
        'prospective_grasp_reachable_pose_count': row['joint_reachable_pose_count'],
        'prospective_grasp_future_support_position': row['terminal_root'],
        'prospective_grasp_future_support_distance': row['joint_distance'],
        'prospective_grasp_hypothesis_ref': row['prospective_grasp_hypothesis_ref'],
        'prospective_grasp_matching_effect_method_claim_refs': (),
        'prospective_grasp_action_refs': route,
        'prospective_grasp_first_action_ref': route[0] if route else '',
        'prospective_grasp_observed_question_ref': row['question_ref'],
        'prospective_grasp_peer_component_ref': row['peer_component_ref'],
        'prospective_grasp_part_cells': row['part_cells'],
        'prospective_grasp_total_primitive_distance': row['total_primitive_distance'],
        'prospective_grasp_action_authorization': False,
        'bounded_zone_state_route_length': len(route),
        'bounded_zone_state_route_action_refs': route,
        'bounded_zone_state_route_distinct_action_ref_count': len(set(route)),
        'bounded_zone_state_route_action_payloads': tuple(FrozenMap({
            'expected_step_delta_row': pixel_steps[ref][0],
            'expected_step_delta_col': pixel_steps[ref][1]}) for ref in route),
        'bounded_zone_state_route_first_action_ref': route[0] if route else '',
        'bounded_zone_state_route_first_delta_row': first_delta[0],
        'bounded_zone_state_route_first_delta_col': first_delta[1],
        'bounded_zone_state_route_terminal_position': target,
        'bounded_zone_state_route_terminal_kind': 'prospective_grasp_contact',
        'bounded_zone_state_route_terminates_at_measured_peer': False,
        'bounded_zone_state_goal_bearing_route_present': bool(route),
        'bounded_zone_state_complete_route_present': False,
        'bounded_zone_state_complete_route_length': 0,
        'bounded_zone_state_complete_route_action_refs': (),
        'bounded_zone_state_complete_route_action_payloads': (),
        'bounded_zone_state_complete_route_distinct_action_ref_count': 0,
        'bounded_zone_state_complete_route_first_action_ref': '',
        'bounded_zone_state_complete_route_first_delta_row': 0,
        'bounded_zone_state_complete_route_first_delta_col': 0})


def measure_prospective_grasp(value, *, positions, steps, enclosure_value, control_bbox=None):
    from .peer_constraint_geometry import cell_domain
    query = value.route_generation_policy.get('prospective_grasp_query', {})
    domain = (cell_domain(value, steps, enclosure_value, query['maximum_cells'])
        if query.get('selection_order') == 'composition_size_observed_method_mobility_access'
        and query.get('background_rule') == 'reuse_unique_observed_traversed_cell_background'
        else FrozenMap())
    result = _measure_prospective_grasp(value, positions=positions, steps=steps,
        enclosure_value=enclosure_value, control_bbox=control_bbox,
        cell_domain_measurement=domain)
    return {**result, 'prospective_grasp_cell_domain': domain}


def _measure_prospective_grasp(value, *, positions, steps, enclosure_value,
                              control_bbox=None, cell_domain_measurement):
    empty = {'prospective_grasp_present': False, 'prospective_grasp_complete': False}
    query = value.route_generation_policy.get('prospective_grasp_query', {})
    if query.get('selection_order') != 'composition_size_observed_method_mobility_access':
        return empty
    if query.get('background_rule') != 'reuse_unique_observed_traversed_cell_background':
        return empty
    support_values=set(value.episode_input_aligned_underlay_values)
    operators=set(value.available_action_refs)-{ref for ref,_,_ in value.interface_action_translation_deltas}
    operators.discard(value.level_start_checkpoint_action_ref)
    operators.discard('ACTION6')  # Declared ARC point interface, not a local grasp operator.
    if not support_values or len(operators) != 1:
        return empty
    bound = _bound_pair_peer_inventory(value,query=query,positions=positions,steps=steps,
        enclosure_value=enclosure_value,cell_domain_measurement=cell_domain_measurement)
    if bound is not None:
        return bound
    boxes = (control_bbox,) if control_bbox is not None else value.canonical_provisional_control_geometry_bboxes
    if len(boxes) != 1 or not value.retained_grid_geometry:
        return empty
    box = boxes[0]
    if sum(component.bbox == box for component in value.components.components) != 1:
        return {**empty, 'prospective_grasp_failure_ref': 'current_control_component_not_unique'}
    if any(not (box.top <= r <= box.bottom and box.left <= c <= box.right)
           for a in value.canonical_controlled_assembly_term_facts
           for r, c in a.get('member_pixel_positions', ())):
        return empty
    grid = next((g for g in value.periodic_cell_grids.candidates
        if (g.row_offset,g.col_offset,g.cell_height,g.cell_width,g.row_pitch,
            g.col_pitch,g.logical_rows,g.logical_columns) == value.retained_grid_geometry), None)
    if grid is None or len(grid.cells) > query['maximum_cells']:
        return empty
    cells = {(c.row,c.col): c for c in grid.cells}
    start = next((p for p,c in sorted(cells.items()) if c.bbox == box), None)
    if start is None:
        return empty
    vectors = {ref: (dr//grid.row_pitch, dc//grid.col_pitch)
        for ref,(dr,dc) in sorted(steps.items())
        if dr % grid.row_pitch == 0 and dc % grid.col_pitch == 0}
    if len(vectors) != len(steps) or any(abs(dr)+abs(dc) != 1 for dr,dc in sorted(vectors.values())):
        return empty
    def pattern(cell):
        b=cell.bbox
        return tuple(value.frame.rows[r][c] for r in range(b.top,b.bottom+1)
                     for c in range(b.left,b.right+1))
    raw = {p:pattern(c) for p,c in sorted(cells.items())}
    model = measure_cell_support_model(value, {
        (r,c): {color} for r,row in enumerate(value.frame.rows) for c,color in enumerate(row)})
    if model is None:
        return {**empty, 'prospective_grasp_failure_ref': 'observed_background_not_unique'}
    nonbackground = {p for region, _, _ in model[1] for p in region}
    silhouette = normalized_cell_pattern(raw[start])
    candidates = {p for p in nonbackground if p != start
        and normalized_cell_pattern(raw[p]) == silhouette and raw[p] != raw[start]
        and enclosure_value not in raw[p]}
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
                region = frozenset(tuple(p) for p in contact['support_region_cells'])
                if not region or not region <= candidates:
                    continue
                top = min(cells[p].bbox.top for p in region)
                left = min(cells[p].bbox.left for p in region)
                bottom = max(cells[p].bbox.bottom for p in region)
                right = max(cells[p].bbox.right for p in region)
                if any(component.value == signature[0]
                    and (component.bbox.top, component.bbox.left, component.bbox.bottom, component.bbox.right)
                        == (top, left, bottom, right)
                    and (component.bbox.height, component.bbox.width) == tuple(signature[1:3])
                    and tuple(component.relative_pixels) == tuple(tuple(p) for p in signature[3])
                    for component in value.components.components):
                    preserved.update(region)
        candidates.difference_update(preserved)
    groups=[]
    unseen=set(candidates)
    while unseen:
        seed=min(unseen); unseen.remove(seed); group={seed}; pending=[seed]
        while pending:
            p=pending.pop()
            for dr,dc in sorted(vectors.values()):
                q=(p[0]+dr,p[1]+dc)
                if q in unseen and raw[q] == raw[seed]:
                    unseen.remove(q);group.add(q);pending.append(q)
        groups.append(frozenset(group))
    method_refs_by_group = {}
    inventory = value.canonical_contextual_effect_method_inventory
    for group in groups:
        observed_types = tuple(sorted({(grid.cell_height, grid.cell_width,
            normalized_cell_pattern(raw[p])) for p in group}))
        refs = set()
        for method in inventory.get('rows', ()) if inventory.get('enumeration_complete') else ():
            context = method['operator_support_context']
            if context.get('context_epoch') != value.current_context_epoch:
                continue
            body = next((r for r in context.get('coverage', ()) if r['body_ref']=='carried_part'), {})
            if (body.get('body_cell_pattern_types') == observed_types
                    and all(body.get('appearance_value') in raw[p] for p in group)):
                refs.update(method['recipe_premise_claim_refs'])
        method_refs_by_group[group] = tuple(sorted(refs))
    free={p for p,c in sorted(cells.items()) if (c.bbox.top,c.bbox.left) in positions}
    free.update(candidates)
    free.add(start)
    free.difference_update(preserved)
    supports={p for p in sorted((free-candidates-{start}) & nonbackground)
        if enclosure_value not in raw[p]}
    contact_clearance = _current_pair_clearance(value, query=query, cells=cells,
        start=start, free=free, raw=raw, silhouette=silhouette,
        nonbackground=nonbackground, enclosure_value=enclosure_value, vectors=vectors)
    if not groups:
        return {**empty, **contact_clearance}
    step_rows=tuple(StepVector(label=ref,delta_row=d[0],delta_col=d[1])
                    for ref,d in sorted(vectors.items()))
    def reach(origin, domain, goals=()):
        return finite_grid_reachability(ReachabilityInput(rows=grid.logical_rows,
            columns=grid.logical_columns,start=origin,traversable=tuple(sorted(domain)),
            goals=tuple(sorted(goals)),steps=step_rows))
    pending_motion = _pending_motion_measurement(value, query=query, grid=grid,
        box=box, start=start, groups=groups, raw=raw, free=free,
        candidates=candidates, supports=supports, reach=reach)
    specific_query = query.get('specific_recall_query')
    if specific_query:
        specific = _pending_motion_measurement(value,
            query={**dict(query), **dict(specific_query)}, grid=grid, box=box,
            start=start, groups=groups, raw=raw, free=free,
            candidates=candidates, supports=supports, reach=reach)
        pending_motion.update({key.replace('prospective_grasp_pending_motion_',
            'specific_recalled_grasp_pending_motion_', 1): item
            for key, item in sorted(specific.items())})
    pending_motion.update(contact_clearance)
    pending_motion.update(_peer_access_inventory(value, query=query, cells=cells,
        grid=grid, box=box, start=start, groups=groups, free=free,
        candidates=candidates, vectors=vectors, reach=reach))
    if not supports:
        return {**empty, **pending_motion}
    access=reach(start,free-candidates,free-candidates)
    accesses={g.goal:g for g in access.goals if g.reachable}
    rows=[]; work=0
    for group in groups:
        roots,used,complete=candidate_grasp_roots(((0,0),),sorted(group),
            tuple(sorted(vectors.values())),query['maximum_comparisons']-work)
        work+=used
        if not complete:
            return {**empty,'prospective_grasp_bound_reached':True}
        for root in roots:
            if root not in accesses:
                continue
            offsets=tuple((r-root[0],c-root[1]) for r,c in sorted(group))
            allowed=set()
            for p in sorted(free-candidates):
                work+=len(offsets)+1
                if work>query['maximum_comparisons']:
                    return {**empty,'prospective_grasp_bound_reached':True}
                cargo=set(translated_mask(offsets,p))
                if cargo <= free and not cargo.intersection(candidates-group) and p not in cargo:
                    allowed.add(p)
            if root not in allowed:
                continue
            motion=reach(root,allowed)
            reached={d.position:d.distance for d in motion.distances}
            if len(reached)<=1:
                continue
            useful=[(p, d) for p,d in sorted(reached.items())
                if p in supports or set(translated_mask(offsets,p)).intersection(supports)]
            if not useful:
                continue
            terminal,delivery_distance=min(useful,key=lambda item:(item[1],item[0]))
            # DRM declares this lexicographic order; no confidence weights.
            rank=(len(query['composition_kinds']),len(group),bool(method_refs_by_group[group]),len(reached),
                  -accesses[root].distance-delivery_distance)
            rows.append((rank,root,group,accesses[root],terminal,delivery_distance))
    if not rows:
        return {**empty, **pending_motion, 'prospective_grasp_complete':True}
    rows.sort(key=lambda row:(row[0],tuple(-v for v in row[1])),reverse=True)
    rank,root,group,access,terminal,delivery_distance=rows[0]
    route=tuple(access.first_shortest_step_labels)
    return {**pending_motion, 'prospective_grasp_present':True,'prospective_grasp_complete':True,
        'prospective_grasp_preserved_effect_cell_count':len(preserved),
        'prospective_grasp_origin_position':(box.top,box.left),
        'prospective_grasp_ready':root == start,
        'prospective_grasp_origin_bbox_tuples': ((box.top, box.left, box.bottom, box.right),),
        'prospective_grasp_target_position':(cells[root].bbox.top,cells[root].bbox.left),
        'prospective_grasp_action_refs':route,
        'prospective_grasp_first_action_ref':route[0] if route else '',
        'prospective_grasp_composition_count':rank[0],
        'prospective_grasp_part_cell_count':len(group),
        'prospective_grasp_reachable_pose_count':rank[3],
        'prospective_grasp_matching_effect_method_claim_refs':method_refs_by_group[group],
        'prospective_grasp_observed_method_match':bool(method_refs_by_group[group]),
        'prospective_grasp_future_support_position':terminal,
        'prospective_grasp_future_support_distance':delivery_distance,
        'prospective_grasp_compared_grip_count':len(rows),
        'prospective_grasp_hypothesis_ref':query['hypothesis'],
        'prospective_grasp_action_authorization':False}
