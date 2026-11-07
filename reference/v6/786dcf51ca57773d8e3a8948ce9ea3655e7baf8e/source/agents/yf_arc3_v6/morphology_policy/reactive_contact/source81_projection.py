"""Static Source81 calculator adapter; no execution authority."""
from collections import Counter
import hashlib, json
from agents.yf_arc3_v5.capabilities.contracts import BoundingBox, FrameGrid, ComponentExtractionInput, InteractionProbeInput, PeriodicCellDescription, PeriodicCellGridCandidate, PeriodicCellGridResult
from agents.yf_arc3_v5.capabilities.components import detect_components
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest, thaw_json
from ._source81 import prospective_grasp as prospective
from ._source81 import peer_constraint_geometry as constraints

class _Source81InputView:
    """Historical field absent from current schema; explicitly no acquisition."""

    def __init__(self, value):
        self.value = value
        self.canonical_contextual_effect_method_inventory = FrozenMap({'enumeration_complete': False, 'rows': ()})

    def __getattr__(self, name):
        return getattr(self.value, name)

def source81_project(scene, recipe, observation, rows, observed_support_values, directions, *, support_evidence, maximum_cells=256, maximum_comparisons=200000, binding_claim_refs=(), parent_question=None, mode='bound_pair', operator_candidates=()):
    base = {'status': 'unknown', 'inventory': {'enumeration_complete': False, 'rows': [], 'geometry': {}}, 'domain': {}, 'binding': {'observation_ref': observation['observation_ref'], 'epoch': observation['level_epoch']}, 'release_authorized': False, 'unknowns': ['reactive_policy', 'release_effect', 'capture_law']}
    if not binding_claim_refs or not parent_question or (not parent_question.get('id')) or (parent_question.get('peer_entity_ref') != scene['peer']['id']):
        return {**base, 'reason': 'current_parent_and_caller_claim_binding_missing'}
    method_claim_refs = tuple(binding_claim_refs)
    if mode not in ('bound_pair', 'unbound'):
        return {**base, 'reason': 'unknown_projection_mode'}
    if not observed_support_values or not support_evidence:
        return {**base, 'reason': 'observed_support_missing'}
    if mode == 'unbound' and (not operator_candidates or any((x.get('action_ref') not in observation['available_action_refs'] or not x.get('hypothesis_ref') or (not x.get('binding_claim_refs')) for x in operator_candidates))):
        return {**base, 'reason': 'explicit_available_operator_hypotheses_missing'}
    if mode == 'bound_pair' and (not recipe or recipe.get('status') != 'observed_nonpushing_common_translation' or recipe.get('scope') != observation['level_epoch'] or (not recipe.get('evidence')) or (not recipe.get('operator_action_ref')) or (not recipe.get('operator_observation_refs')) or (not recipe.get('subject_mask_digest')) or (recipe.get('subject_area') is None)):
        return {**base, 'reason': 'current_method_or_observed_support_or_caller_claim_binding_missing'}
    body = scene['body']
    peer = scene['peer']
    entities = observation['entities']
    matches = [e for e in entities if mode == 'bound_pair' and list(e['bbox']) == list(recipe['subject_box']) and (e['palette_value'] == recipe['subject_value'])]
    if mode == 'bound_pair' and len(matches) != 1:
        return {**base, 'reason': 'current_subject_not_unique'}
    part = matches[0] if matches else None
    if part and (part['area'] != recipe['subject_area'] or hashlib.sha256(json.dumps(part['mask'], sort_keys=True, separators=(',', ':')).encode()).hexdigest() != recipe['subject_mask_digest']):
        return {**base, 'reason': 'current_subject_mask_or_area_mismatch'}
    if part and list(recipe['offset']) != [part['bbox'][0] - body['bbox'][0], part['bbox'][1] - body['bbox'][1]]:
        return {**base, 'reason': 'current_rigid_offset_mismatch'}
    if part and list(part['bbox']) in (list(body['bbox']), list(peer['bbox'])):
        return {**base, 'reason': 'roles_not_distinct'}
    b = body['bbox']
    tile = scene['tiles'][scene['bodykey']]['box']
    dx, dy = (b[0] - tile[0], b[1] - tile[1])
    width, height = (b[2] - b[0] + 1, b[3] - b[1] + 1)
    pitch = scene['pitch']
    grid0 = scene['grid']
    if width > pitch or height > pitch or dx < 0 or (dy < 0):
        return {**base, 'reason': 'footprint_lattice_not_qualified'}
    x0, y0 = (grid0['col_offset'] + dx, grid0['row_offset'] + dy)
    cells = []
    patterns = []
    for t in scene['tiles'].values():
        l, top = t['box'][:2]
        l += dx
        top += dy
        r = l + width - 1
        bottom = top + height - 1
        if not (0 <= l <= r < len(rows[0]) and 0 <= top <= bottom < len(rows)):
            return {**base, 'reason': 'clipped_footprint_window'}
        patterns.append(tuple((rows[y][x] for y in range(top, bottom + 1) for x in range(l, r + 1))))
        cells.append(((top - y0) // pitch, (l - x0) // pitch, BoundingBox(left=l, top=top, right=r, bottom=bottom)))
    counts = Counter(patterns)
    nr = max((x[0] for x in cells)) + 1
    nc = max((x[1] for x in cells)) + 1
    if nr * nc != len(cells) or len(cells) > maximum_cells:
        return {**base, 'reason': 'nonrectangular_or_large_measured_domain'}
    descriptions = tuple((PeriodicCellDescription(row=rr, col=cc, bbox=box, point=(box.top, box.left), pattern_ref='measured:' + stable_digest(pattern), palette_value_count=len(set(pattern)), palette_values=tuple(sorted(set(pattern))), pattern_occurrence_count=counts[pattern]) for (rr, cc, box), pattern in zip(cells, patterns)))
    grid = PeriodicCellGridCandidate(candidate_ref='current-footprint-lattice:' + stable_digest((x0, y0, width, height, pitch)), row_offset=y0, col_offset=x0, cell_height=height, cell_width=width, row_gap=pitch - height, col_gap=pitch - width, row_pitch=pitch, col_pitch=pitch, logical_rows=nr, logical_columns=nc, separator_consistency_ppm=0, repeated_pattern_count=sum((n > 1 for n in counts.values())), distinct_pattern_count=len(counts), cells=descriptions)
    frame = FrameGrid(rows=tuple((tuple(r) for r in rows)))
    components = detect_components(ComponentExtractionInput(frame=frame, connectivity=4))
    bybox = {(c.bbox.left, c.bbox.top, c.bbox.right, c.bbox.bottom): c for c in components.components}
    if any((tuple(e['bbox']) not in bybox for e in (body, peer, part) if e)):
        return {**base, 'reason': 'current_component_bbox_not_unique'}
    core = bybox[tuple(body['bbox'])]
    enclosing = [c for c in components.components if c.area > core.area and c.value not in set(observed_support_values) and (c.bbox.left <= b[0]) and (c.bbox.top <= b[1]) and (c.bbox.right >= b[2]) and (c.bbox.bottom >= b[3])]
    if not enclosing:
        return {**base, 'reason': 'enclosing_surface_candidate_missing'}
    maximum = max((c.area for c in enclosing))
    winners = [c for c in enclosing if c.area == maximum]
    if len(winners) != 1:
        return {**base, 'reason': 'enclosing_surface_ambiguous'}
    enclosure = winners[0].value
    geometry = (y0, x0, height, width, pitch, pitch, nr, nc)
    query = {'selection_order': 'composition_size_observed_method_mobility_access', 'background_rule': 'reuse_unique_observed_traversed_cell_background', 'maximum_cells': maximum_cells, 'maximum_comparisons': maximum_comparisons, 'bound_pair_query': {'terminal_relation': 'current_body_face_adjacent_to_peer', 'maximum_rows': 2048, 'peer_response_query': 'stationary_or_one_observed_cell_step', 'independent_terminal_relation': 'stationary_part_and_actor_close_peer_exits'}}
    query.update({'composition_kinds': ('carrier_with_part', 'assembly_on_distinct_support', 'operator_on_assembly'), 'hypothesis': 'hypothesis.rigid_attachment_at_current_contact', 'peer_access_query': {'terminal_relation': 'carried_cells_face_adjacent_to_peer', 'access_query': 'walk_or_one_obstacle_straight_translation', 'maximum_translation_rows': 64, 'maximum_comparisons': 262144, 'maximum_rows': 1024}})
    operator = {'background_pattern_rule': 'unique_most_frequent_pattern_with_episode_observed_support_values', 'occluded_cell_pattern_rule': 'unique_visible_pattern_compatible_with_retained_support'}
    token = 'observed-method:' + stable_digest(recipe)
    boxrc = lambda e: (e['bbox'][1], e['bbox'][0], e['bbox'][3], e['bbox'][2])
    assembly = None
    if part:
        assembly = _bound_assembly(body, part, recipe, observation, method_claim_refs, token)
    steps = {name: (v[1] * pitch, v[0] * pitch) for name, v in directions.items()}
    value = InteractionProbeInput(frame=frame, components=components, available_action_refs=tuple(observation['available_action_refs']), periodic_cell_grids=PeriodicCellGridResult(candidates=(grid,)), retained_grid_geometry=geometry, current_observation_frame_ref=observation['observation_ref'], current_entity_component_refs=FrozenMap({body['id']: core.component_id}), canonical_provisional_control_geometry_bboxes=(core.bbox,), canonical_controlled_assembly_term_facts=(assembly,) if assembly else (), episode_input_aligned_underlay_values=tuple(sorted(observed_support_values)), interface_action_translation_deltas=tuple(((a, *d) for a, d in steps.items())), route_generation_policy=FrozenMap({'prospective_grasp_query': query, 'operator_surface_relation_query': operator}))
    domain = constraints.cell_domain(value, steps, enclosure, maximum_cells)
    terrain = set(domain.get('terrain', ()))
    positions = tuple(((cell.bbox.top, cell.bbox.left) for cell in descriptions if (cell.row, cell.col) in terrain))
    if mode == 'bound_pair':
        measured = prospective._bound_pair_peer_inventory(value, query=query, positions=positions, steps=steps, enclosure_value=enclosure, cell_domain_measurement=domain)
    else:
        from ._source81.unbound import measure_unbound
        measured = measure_unbound(_Source81InputView(value), positions=positions, steps=steps, enclosure_value=enclosure, cell_domain_measurement=domain, operator_candidates=operator_candidates)
    inventory = (measured or {}).get('prospective_grasp_peer_access_inventory', {})
    peer_ref = bybox[tuple(peer['bbox'])].component_id
    parent_rows = [thaw_json(row) for row in inventory.get('rows', ()) if row.get('peer_component_ref') == peer_ref]
    mapping = {c.component_id: [e['id'] for e in entities if tuple(e['bbox']) == (c.bbox.left, c.bbox.top, c.bbox.right, c.bbox.bottom) and e['palette_value'] == c.value and (e['area'] == c.area)] for c in components.components}
    return {**base, 'status': 'measured_source81_' + mode if inventory else 'no_source81_rows', 'domain': thaw_json(domain), 'inventory': thaw_json(inventory), 'component_entity_bindings': mapping, 'parent_inventory': {'enumeration_complete': inventory.get('enumeration_complete', False), 'rows': parent_rows}, 'parent_applicability': 'current_parent_rows' if parent_rows else 'no_current_parent_access', 'binding': {**base['binding'], 'actor_ref': core.component_id, 'peer_ref': peer_ref, 'part_ref': bybox[tuple(part['bbox'])].component_id if part else None, 'origin_bbox': boxrc(body), 'recipe_evidence': recipe.get('evidence', []) if recipe else [], 'binding_claim_refs': list(binding_claim_refs), 'parent_question': parent_question, 'support_evidence': list(support_evidence)}, 'operator_candidates': list(operator_candidates), 'calculation_refs': ['Source81.peer_constraint_geometry.cell_domain', 'Source81.prospective_grasp.' + ('_bound_pair_peer_inventory' if part else '_measure_prospective_grasp_explicit_operators')], 'measurement_scope': {'enclosure_value': enclosure, 'enclosure_source': 'unique_largest_current_enclosing_component_excluding_observed_support', 'core_geometry': list(geometry), 'background_support_values': list(observed_support_values), 'available_actions_unchanged': list(value.available_action_refs), 'checkpoint_role_invented': False, 'response_bound': 'stationary_or_one_cell_is_conditional_comparison_not_complete_flee_policy'}}

def _bound_assembly(body, part, recipe, observation, method_claim_refs, token):
    recipe_row = {'recipe_token': token, 'common_motion_transition_ref': recipe['evidence'][-1], 'operational_scene_ref': observation['observation_ref'], 'core_entity_ref': body['id'], 'part_entity_ref': part['id'], 'operator_action_ref': recipe['operator_action_ref'], 'recipe_premise_claim_refs': tuple(method_claim_refs)}
    boxrc = lambda e: (e['bbox'][1], e['bbox'][0], e['bbox'][3], e['bbox'][2])
    return FrozenMap({'member_bbox_tuples': (boxrc(body), boxrc(part)), 'member_pixel_positions': tuple(((e['bbox'][1] + y, e['bbox'][0] + x) for e in (body, part) for x, y in e['mask'])), 'role_premise_claim_refs': tuple(method_claim_refs), 'contextual_part_recipe_rows': (recipe_row,)})

def materialize_selected(projection, candidate_ref, selected_row=None):
    inventory = FrozenMap(projection['inventory'])
    matches = [r for r in inventory.get('rows', ()) if r['candidate_ref'] == candidate_ref]
    if len(matches) != 1:
        raise ValueError('selected current row not unique')
    if matches[0].get('peer_component_ref') != projection['binding']['peer_ref']:
        raise ValueError('selected geometry does not target the current parent peer')
    if selected_row is None or not selected_row.get('question_ref') or (not selected_row.get('prospective_grasp_hypothesis_ref')):
        raise ValueError('current parent question and declared hypothesis binding required')
    selected = FrozenMap(selected_row)
    if selected.get('question_ref') != projection['binding']['parent_question']['id']:
        raise ValueError('foreign parent question')
    if selected.get('geometry_candidate_ref') != candidate_ref:
        raise ValueError('foreign geometry selection')
    return thaw_json(prospective.materialize_peer_access_route(inventory, selected))

def current_independent_inventory(projection, actor_ref, peer_ref, part_ref, origin_bbox, proposal_ref):
    if (actor_ref, peer_ref, part_ref) != (projection['binding']['actor_ref'], projection['binding']['peer_ref'], projection['binding']['part_ref']):
        raise ValueError('independent roles must bind the current projection')
    return thaw_json(constraints.independent_inventory(FrozenMap(projection['domain']), actor=actor_ref, peer=peer_ref, part=part_ref, origin_bbox=tuple(origin_bbox), proposal_ref=proposal_ref))
