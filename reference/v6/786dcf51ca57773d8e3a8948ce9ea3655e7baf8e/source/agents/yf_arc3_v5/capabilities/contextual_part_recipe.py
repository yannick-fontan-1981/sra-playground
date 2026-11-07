"""Neutral part recolouring and subsequent common-motion measurements.

The supplied control identity belongs to Source. Appearance change alone does
not establish attachment, and a recorded sample never authorizes an action.
"""
from collections.abc import Mapping
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from agents.yf_arc3_v5.logos.operator_support import OperatorSurfaceAccessTarget


def _get(value,name,default=None):
    return value.get(name,default) if isinstance(value,Mapping) else getattr(value,name,default)


def _box(component):
    box=_get(component,'bbox')
    return tuple(int(_get(box,n)) for n in ('top','left','bottom','right'))


def _signature(component):
    box=_box(component)
    return (int(_get(component,'value')),box[2]-box[0]+1,box[3]-box[1]+1,
            tuple(tuple(int(n) for n in p) for p in _get(component,'relative_pixels',())))


def _retained_signature(value):
    return (value[0],value[1],value[2],tuple(tuple(p) for p in value[3]))


def _offset(core,part):
    a,b=_box(core),_box(part)
    return (b[0]-a[0],b[1]-a[1])


def measure_recipe_contact_variations(value, action_ref, maximum_comparisons=4096,
                                     contact_witnesses=()):
    """Compare a supplied current control/contact with retained operator samples.

    A common value with a changed shape/offset is a measurement, not attachment,
    operator applicability or a part role. DRM owns the experimental question.
    """
    inventory = value.canonical_contextual_recipe_method_inventory
    facts = {
        'recipe_contact_inventory_complete': inventory.get('enumeration_complete', False),
        'recipe_contact_enumeration_complete': True,
        'recipe_contact_candidate_count': 0,
        'recipe_contact_exact_sample_count': 0,
        'recipe_contact_current_support_complete': False,
        'recipe_contact_current_support_inside_control': False,
        'recipe_contact_evidence_refs': (),
        'recipe_contact_recalled_claim_refs': (),
        'recipe_contact_current_role_claim_refs': (),
        'recipe_contact_product_refs': (),
        'recipe_contact_part_ref': '',
        'recipe_contact_witnesses': (),
    }
    boxes = tuple(value.canonical_provisional_control_geometry_bboxes)
    if len(boxes) != 1 or not facts['recipe_contact_inventory_complete']:
        return FrozenMap(facts)
    box = boxes[0]
    assemblies = tuple(value.canonical_controlled_assembly_term_facts)
    facts['recipe_contact_current_support_complete'] = bool(assemblies) and all(
        assembly.get('member_pixel_positions') for assembly in assemblies)
    facts['recipe_contact_current_support_inside_control'] = (
        facts['recipe_contact_current_support_complete'] and all(
            box.top <= row <= box.bottom and box.left <= col <= box.right
            for assembly in assemblies for row, col in assembly['member_pixel_positions']))
    candidates, exact, products, evidence = {}, set(), set(), set()
    witnessed_contacts = {}
    recalled_evidence, current_evidence = set(), set()
    comparisons = 0
    for sample in inventory.get('rows', ()):
        if sample['operator_action_ref'] != action_ref:
            continue
        cores = tuple(component for component in value.components.components
            if component.bbox == box
            and _signature(component) == _retained_signature(sample['core_signature']))
        for core in cores:
            neighbors = {(row+dr, col+dc) for row, col in core.pixels
                for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1))}
            for part in value.components.components:
                comparisons += 1
                if comparisons > maximum_comparisons:
                    return FrozenMap({**facts, 'recipe_contact_enumeration_complete': False})
                witnesses = tuple(w for w in contact_witnesses
                    if w['actor_component_ref'] == core.component_id
                    and w['subject_component_ref'] == part.component_id
                    and w['frame_ref'] == value.current_observation_frame_ref)
                if (part.component_id == core.component_id
                        or part.value != sample['original_part_signature'][0]
                        or (not neighbors.intersection(part.pixels) and not witnesses)):
                    continue
                key = (core.component_id, part.component_id)
                candidates[key] = part.component_id
                witnessed_contacts[key] = witnesses
                products.add(sample['product_ref'])
                evidence.update(sample['recipe_premise_claim_refs'])
                recalled_evidence.update(sample['recipe_premise_claim_refs'])
                if (_signature(part) == _retained_signature(sample['original_part_signature'])
                        and _offset(core, part) == tuple(sample['contact_offset'])):
                    exact.add((sample['recipe_token'], *key))
    if candidates:
        current_evidence.update(ref for row in value.canonical_provisional_control_term_facts
            for ref in row.get('role_premise_claim_refs', ()))
        evidence.update(current_evidence)
    facts.update({
        'recipe_contact_candidate_count': len(candidates),
        'recipe_contact_exact_sample_count': len(exact),
        'recipe_contact_evidence_refs': tuple(sorted(evidence)),
        'recipe_contact_recalled_claim_refs': tuple(sorted(recalled_evidence)),
        'recipe_contact_current_role_claim_refs': tuple(sorted(current_evidence)),
        'recipe_contact_product_refs': tuple(sorted(products)),
        'recipe_contact_part_ref': candidates[sorted(candidates)[0]] if len(candidates) == 1 else '',
        'recipe_contact_witnesses': witnessed_contacts[sorted(candidates)[0]] if len(candidates) == 1 else (),
    })
    return FrozenMap(facts)


def _operator_surface_observed_scope(value, moving_pixels, restoration_known,
        moving_boxes, delta):
    """Actual visible scope; projected scope requires measured render restoration."""
    height, width = len(value.frame.rows), len(value.frame.rows[0])
    bound = height * width
    components = value.components.components
    if len(components) > bound or sum(c.area for c in components) > bound:
        return None, None, 0, 0
    pixels = {p: c.value for c in components for p in c.pixels}
    actual = stable_digest((height, width, tuple(sorted(pixels.items()))))
    underlay = {p: next(iter(restoration_known[p])) for p in moving_pixels
        if len(restoration_known.get(p, ())) == 1}
    unknown = len(moving_pixels) - len(underlay)
    # Enclosed appearance is not automatically part of the carried body.
    enclosure = {p for p in pixels if any(t <= p[0] < t+h and l <= p[1] < l+w
        for t,l,h,w in moving_boxes)}
    unclassified = sum(1 for p in enclosure-moving_pixels
        if len(restoration_known.get(p, ())) != 1
        or pixels[p] != next(iter(restoration_known[p])))
    if delta == (0, 0):
        return actual, actual, unknown, unclassified
    if unknown or unclassified:
        return actual, None, unknown, unclassified
    projected = {**pixels, **underlay}
    for r,c in moving_pixels:
        target = (r+delta[0], c+delta[1])
        if not (0 <= target[0] < height and 0 <= target[1] < width):
            return actual, None, unknown, unclassified
        projected[target] = pixels[(r,c)]
    return actual, stable_digest((height, width, tuple(sorted(projected.items())))), unknown, unclassified


def measure_operator_surface_context(value, action_ref, *, position=None, known_surface_pixels=None,
                                     cell_support_model=None):
    """Exact carrier/part coverage of observed underlays, retaining unknown pixels."""
    default = {'operator_surface_context_present': False,
               'operator_surface_context_same_typed_effect_match': False,
               'operator_surface_context_analogous_effect_match': False,
               'operator_surface_context_reused_effect_claim_refs': (),
               'operator_surface_context_previously_observed': False,
               'operator_surface_context': FrozenMap(),
               'operator_surface_context_failure_ref': 'core_bbox_or_history_unqualified',
               'operator_surface_context_core_bbox_count': len(value.canonical_provisional_control_geometry_bboxes),
               'operator_surface_context_core_component_count': None,
               'operator_surface_context_compatible_assembly_count': None,
               'operator_surface_context_distinct_mask_count': None,
               'operator_surface_context_distinct_recipe_token_count': None}
    boxes = tuple(value.canonical_provisional_control_geometry_bboxes)
    if len(boxes) != 1 or not value.operator_trial_history_complete:
        return FrozenMap(default)
    core = tuple(c for c in value.components.components if c.bbox == boxes[0])
    default.update(operator_surface_context_core_component_count=len(core),
                   operator_surface_context_failure_ref='core_component_not_unique')
    if len(core) != 1:
        return FrozenMap(default)
    core_pixels = frozenset(core[0].pixels)
    assemblies = tuple(value.canonical_controlled_assembly_term_facts)
    compatible = tuple(row for row in assemblies
        if core_pixels.issubset(frozenset(tuple(p) for p in row.get('member_pixel_positions', ())))
        and row.get('contextual_part_recipe_rows')
        and any(tuple(binding.get(key) for key in ('current_bbox_top', 'current_bbox_left',
                'current_bbox_height', 'current_bbox_width')) ==
            (core[0].bbox.top, core[0].bbox.left, core[0].bbox.height, core[0].bbox.width)
            for binding in row.get('current_maximal_anchor_bindings', ())))
    masks = {frozenset(tuple(p) for p in row['member_pixel_positions']) for row in compatible}
    default.update(operator_surface_context_compatible_assembly_count=len(compatible),
                   operator_surface_context_distinct_mask_count=len(masks),
                   operator_surface_context_failure_ref='current_assembly_mask_not_unique')
    shared_mask = next(iter(masks)) if len(masks) == 1 else None
    if len(masks) != 1:
        query = value.route_generation_policy.get('operator_surface_relation_query', {})
        if query.get('assembly_mask_equivalence') != 'retained_cell_occupancy_with_shared_visible_support':
            return FrozenMap(default)
        anchors = tuple((grid, cell) for grid in value.periodic_cell_grids.candidates
            if (grid.row_offset, grid.col_offset, grid.cell_height, grid.cell_width,
                grid.row_pitch, grid.col_pitch, grid.logical_rows, grid.logical_columns)
               == value.retained_grid_geometry
            for cell in grid.cells if cell.bbox == boxes[0])
        if len(anchors) != 1 or not masks:
            return FrozenMap(default)
        from .translated_support_cells import measure_support_cell_offsets
        grid, anchor = anchors[0]
        supports = tuple(measure_support_cell_offsets(
            grid=grid, anchor_cell=anchor, pixel_positions=mask) for mask in masks)
        if any(support is None for support in supports) or len(set(supports)) != 1:
            return FrozenMap(default)
        shared_mask = frozenset.intersection(*masks)
        shared_support = measure_support_cell_offsets(
            grid=grid, anchor_cell=anchor, pixel_positions=shared_mask)
        if shared_support != supports[0]:
            return FrozenMap(default)
        default.update(operator_surface_context_mask_equivalence_kind='retained_cell_occupancy',
            operator_surface_context_distinct_support_count=1,
            operator_surface_context_retained_mask_alternative_count=len(masks))
    query = value.route_generation_policy.get('operator_surface_relation_query', {})
    if (query.get('body_membership_rule') == 'retained_carrier_cell_owns_its_internal_rendering_parts'
            and value.retained_grid_geometry):
        carrier_cells = tuple(cell for grid in value.periodic_cell_grids.candidates
            if (grid.row_offset, grid.col_offset, grid.cell_height, grid.cell_width,
                grid.row_pitch, grid.col_pitch, grid.logical_rows, grid.logical_columns)
                == value.retained_grid_geometry
            for cell in grid.cells if cell.bbox == core[0].bbox)
        if len(carrier_cells) == 1:
            # Partition the already observed assembly by the retained carrier
            # cell, not by its dominant colour. Its internal marker is not cargo.
            box = carrier_cells[0].bbox
            core_pixels = frozenset(p for p in shared_mask
                if box.top <= p[0] <= box.bottom and box.left <= p[1] <= box.right)
    part_pixels = shared_mask - core_pixels
    default['operator_surface_context_failure_ref'] = 'current_part_pixels_empty'
    if not part_pixels:
        return FrozenMap(default)
    recipes = {r['recipe_token']: r for row in compatible for r in row['contextual_part_recipe_rows']
               if r.get('operator_action_ref') == action_ref and r.get('recipe_token')}
    default.update(operator_surface_context_distinct_recipe_token_count=len(recipes),
                   operator_surface_context_failure_ref='current_recipe_token_not_unique')
    if len(recipes) != 1:
        return FrozenMap(default)
    recipe = recipes[sorted(recipes)[0]]
    moving_support = core_pixels | part_pixels
    if query.get('support_occlusion_rule') == 'enclosed_rendering_in_confirmed_assembly':
        from .sprite_occlusion import enclosed_rendering_pixels
        # Preserve separate physical masks. Only the possibly occluded support
        # domain includes interior rendering, with retained observation evidence.
        moving_support |= (enclosed_rendering_pixels(core_pixels)
                           | enclosed_rendering_pixels(part_pixels))
    known = {(r,c): {color} for r,row in enumerate(value.frame.rows)
             for c,color in enumerate(row) if (r,c) not in moving_support}
    sample_observations = {}
    retained_sample_positions = set()
    for row in value.current_translation_underlay_rows:
        for r, c, color in row.get('observed_underlay_pixels', ()):
            if (r,c) not in moving_support:
                continue
            known.setdefault((r,c), set()).add(color)
            if row.get('sample_observation_ref'):
                sample_observations.setdefault((r, c), set()).add(row['sample_observation_ref'])
    for row in value.retained_translation_underlay_rows:
        if (row.get('context_epoch') != value.current_context_epoch
                or row.get('support_validity_kind') != 'conditional_observation_retained_without_visible_contradiction'
                or row.get('hidden_mutation_absence_proven') is not False):
            continue
        for r, c, color, observation_ref in row.get('support_samples', ()):
            if observation_ref and (r,c) in moving_support:
                known.setdefault((r, c), set()).add(color)
                sample_observations.setdefault((r, c), set()).add(observation_ref)
                retained_sample_positions.add((r, c))
    current_moving_pixels = moving_support
    part_top, part_left = min(r for r,c in part_pixels), min(c for r,c in part_pixels)
    moving_boxes = ((core[0].bbox.top, core[0].bbox.left, core[0].bbox.height, core[0].bbox.width),
        (part_top, part_left, max(r for r,c in part_pixels)-part_top+1,
            max(c for r,c in part_pixels)-part_left+1))
    restoration_known = known
    delta = (0, 0)
    origin = (core[0].bbox.top, core[0].bbox.left)
    if position is not None:
        delta = (position[0]-origin[0], position[1]-origin[1])
        core_pixels = frozenset((r+delta[0], c+delta[1]) for r,c in core_pixels)
        part_pixels = frozenset((r+delta[0], c+delta[1]) for r,c in part_pixels)
        origin = position
    if known_surface_pixels is not None:
        known = known_surface_pixels
    cell_support_contacts = None
    query = value.route_generation_policy.get('operator_surface_relation_query', {})
    if query.get('support_relation_representation') == 'retained_cells_and_connected_regions':
        from .operator_cell_support import measure_cell_support_model, measure_cell_support_contacts
        if cell_support_model is None:
            cell_support_model = measure_cell_support_model(
                value, known, occlusion_pixels=current_moving_pixels)
        cell_support_contacts = measure_cell_support_contacts(cell_support_model, core_pixels, part_pixels)
    from .operator_cell_support import measure_body_cell_pattern_types
    coverage, signatures = [], []
    for body, pixels in (('carrier', core_pixels), ('carried_part', part_pixels)):
        groups = {}
        unknown = 0
        exact = []
        for r,c in sorted(pixels):
            values = known.get((r,c), set())
            color = next(iter(values)) if len(values) == 1 else None
            exact.append((r-origin[0], c-origin[1], color))
            if color is None:
                unknown += 1
            else:
                groups[color] = groups.get(color, 0) + 1
        coverage.append(FrozenMap({'body_ref': body, 'pixel_count': len(pixels),
            'body_cell_pattern_types': measure_body_cell_pattern_types(
                cell_support_model, pixels, value.frame, delta),
            # Compare the retained object's appearance, not a temporary held
            # recolouring. Similarity is an experimental cue, never a deposit law.
            'appearance_value': (int(recipe.get('acquired_part_appearance_value', recipe['original_part_signature'][0]))
                if body == 'carried_part' else int(core[0].value)),
            'known_surface_counts': tuple(sorted(groups.items())), 'unknown_pixel_count': unknown,
            'whole_support_observed': unknown == 0,
            'current_support_observation_complete': False,
            'retained_conditional_pixel_count': sum(p in retained_sample_positions for p in pixels),
            'support_validity_kind': 'conditional_observation_only',
            'sample_observation_refs': tuple(sorted({ref for p in pixels for ref in sample_observations.get(p, ())}))}))
        signatures.append((body, stable_digest(tuple(exact))))
    actual_scope, projected_scope, unknown_restoration, unclassified_rendering = (
        _operator_surface_observed_scope(value, current_moving_pixels,
            restoration_known, moving_boxes, delta))
    default.update(operator_surface_context_retained_sample_count=sum(len(row.get('support_samples', ())) for row in value.retained_translation_underlay_rows),
        operator_surface_context_retained_support_validity='conditional_observation_only',
        operator_surface_context_hidden_mutation_absence_proven=False,
        operator_surface_context_support_provenance_refs=tuple(sorted(
            {row['term_ref'] for row in value.retained_translation_underlay_rows if row.get('term_ref')})),
        operator_surface_context_current_support_observation_complete=False)
    default.update(operator_surface_context_restoration_unknown_pixel_count=unknown_restoration,
        operator_surface_context_unclassified_render_pixel_count=unclassified_rendering,
        operator_surface_context_restoration_complete=actual_scope is not None and unknown_restoration == 0 and unclassified_rendering == 0,
        operator_surface_context_comparison_qualified=projected_scope is not None)
    observed_configuration = projected_scope or actual_scope
    if not observed_configuration:
        return FrozenMap({**default,
            'operator_surface_context_failure_ref': 'current_observed_configuration_unqualified'})
    # Pose/configuration and provenance are separate; no frame/refresh nonce.
    identity = (value.current_context_epoch, observed_configuration, tuple(origin),
        tuple(sorted(value.available_action_refs)), action_ref, (),
        _retained_signature(recipe['core_signature']),
        _retained_signature(recipe['changed_part_signature']),
        tuple(recipe['contact_offset']), tuple(signatures))
    ref = 'operator-surface-context:' + stable_digest(identity)
    context = FrozenMap({'context_ref': ref, 'context_epoch': value.current_context_epoch,
        'operator_action_ref': action_ref, 'recipe_token': recipe['recipe_token'],
        'observed_configuration_digest': observed_configuration, 'pose_origin': tuple(origin),
        'prospective_comparison_qualified': projected_scope is not None,
        'scope_kind': 'current_observed_spatial_configuration',
        'latent_mechanical_state_qualified': False,
        'support_validity_kind': 'conditional_observation_only',
        'hidden_mutation_absence_proven': False,
        'current_support_observation_complete': False,
        'support_provenance_refs': default['operator_surface_context_support_provenance_refs'],
        'support_signatures': tuple(signatures), 'coverage': tuple(coverage),
        'cell_support_contacts': cell_support_contacts,
        'evidence_refs': tuple(recipe.get('recipe_premise_claim_refs', ()))})
    same_effect, analogous_effect = measure_operator_effect_reuse(value, context)
    compositions = _operator_surface_compositions(context, context, query)
    return FrozenMap({**default, 'operator_surface_context_failure_ref': '',
        'operator_surface_context_composition_count': len(compositions),
        'operator_surface_context_same_typed_effect_match': bool(same_effect),
        'operator_surface_context_analogous_effect_match': bool(analogous_effect),
        'operator_surface_context_reused_effect_claim_refs': tuple(dict.fromkeys((*same_effect, *analogous_effect))),
        'operator_surface_context_present': True,
        'operator_surface_context_ref': ref,
        'operator_surface_context_previously_observed': projected_scope is not None and ref in value.observed_operator_trial_context_refs,
        'operator_surface_context': context})


def measure_operator_effect_reuse(value, context):
    """Compare observed effect conditions, independent of object size/location.

    A match transports evidence; it never authorizes an operator or asserts
    that a different appearance has the same mechanical effect.
    """
    query = value.route_generation_policy.get('operator_surface_relation_query', {})
    if query.get('effect_reuse_rule') != 'same_body_cell_structure_and_support_pattern_up_to_bijective_recoloring':
        return (), ()
    from .operator_cell_support import normalized_cell_pattern
    inventory = value.canonical_contextual_effect_method_inventory
    contacts = tuple(r for r in (context.get('cell_support_contacts') or ())
                     if r['body_ref'] == 'carried_part' and r['whole_body_matches_support_region'])
    coverage = next((r for r in context.get('coverage', ()) if r['body_ref'] == 'carried_part'), {})
    exact, analogous = [], []
    if not inventory.get('enumeration_complete') or not contacts:
        return (), ()
    for method in inventory.get('rows', ()):
        prior = method['operator_support_context']
        if (prior.get('context_epoch') != context.get('context_epoch')
                or method['operator_action_ref'] != context.get('operator_action_ref')):
            continue
        prior_body = next((r for r in prior.get('coverage', ()) if r['body_ref'] == 'carried_part'), {})
        prior_contacts = tuple(r for r in (prior.get('cell_support_contacts') or ())
                               if r['body_ref'] == 'carried_part' and r['whole_body_matches_support_region'])
        if not prior_contacts:
            continue
        body_pattern = coverage.get('body_cell_pattern_types')
        if not body_pattern or body_pattern != prior_body.get('body_cell_pattern_types'):
            continue
        same_appearance = coverage.get('appearance_value') == prior_body.get('appearance_value')
        same_support = any(tuple(a['support_pattern']) == tuple(b['support_pattern'])
                           for a in contacts for b in prior_contacts)
        if same_appearance and same_support:
            exact.extend(method['recipe_premise_claim_refs'])
        elif any(normalized_cell_pattern(a['support_pattern']) ==
                 normalized_cell_pattern(b['support_pattern'])
                 for a in contacts for b in prior_contacts):
            analogous.extend(method['recipe_premise_claim_refs'])
    return tuple(sorted(set(exact))), tuple(sorted(set(analogous)))


def measure_operator_surface_access_return(value, action_ref, current):
    """Compare a canonical access intention to current measured geometry.

    This is an observed arrival comparison, not an operator permit or a claim
    that an unknown effect works. Keep individual mismatches inspectable.
    """
    prior = value.canonical_dispatched_goal_continuity_facts
    target = prior.get('dispatched_composition_target_context') or FrozenMap()
    observed = current.get('operator_surface_context') or FrozenMap()
    checks = FrozenMap({
        'target_present': target.get('target_kind') == 'operator_surface_access_only',
        'scope_matches': prior.get('dispatched_goal_continuity_parent_scope_matches') is True
            and target.get('context_epoch') == value.current_context_epoch,
        'current_context_present': current.get('operator_surface_context_present') is True,
        'operator_matches': bool(action_ref) and target.get('operator_action_ref') == action_ref
            and observed.get('operator_action_ref') == action_ref,
        'recipe_matches': bool(target.get('recipe_token'))
            and target.get('recipe_token') == observed.get('recipe_token'),
        'pose_matches': bool(target.get('pose_origin'))
            and tuple(target.get('pose_origin', ())) == tuple(observed.get('pose_origin', ())),
        'support_matches': bool(target.get('support_signatures'))
            and tuple(target.get('support_signatures', ())) == tuple(observed.get('support_signatures', ())),
    })
    receipt = FrozenMap({
        'dispatched_intent_ref': prior.get('dispatched_composition_intent_ref'),
        'access_target_ref': target.get('access_target_ref'),
        'current_context_ref': observed.get('context_ref'),
        'operator_action_ref': observed.get('operator_action_ref'),
        'recipe_token': observed.get('recipe_token'),
        'comparisons': checks,
        'operator_effect_confirmed': False,
        'action_authorized': False,
    })
    return FrozenMap({
        'operator_surface_access_return_matches': all(checks.values()),
        'operator_surface_access_return': receipt,
    })


def _operator_surface_compositions(context, current_context, query):
    """Bind declared experiment relations; never confirm their unknown effects."""
    relations = {}
    for kind in query.get('base_composition_kinds', ()):
        ref = 'experiment-composition:' + stable_digest((
            kind, context['recipe_token'], context['operator_action_ref']))
        relations[ref] = FrozenMap({'composition_ref': ref, 'kind_ref': kind,
            'recipe_token': context['recipe_token'],
            'operator_action_ref': context['operator_action_ref'],
            'effect_confirmed': False})
    if context.get('cell_support_contacts') is not None and query.get('cell_support_composition_kind'):
        for row in context['cell_support_contacts']:
            witnesses = tuple((query['cell_support_composition_kind'], (cell,))
                for cell in row['overlapped_cells'])
            if row['whole_body_matches_support_region']:
                witnesses += ((query['whole_region_composition_kind'], row['support_region_cells']),)
            for kind, cells in witnesses:
                ref = 'experiment-composition:' + stable_digest((kind, context['recipe_token'],
                    context['operator_action_ref'], row['body_ref'], row['support_pattern'], cells))
                relations[ref] = FrozenMap({**dict(row), 'composition_ref': ref, 'kind_ref': kind,
                    'contact_cells': cells, 'operator_action_ref': context['operator_action_ref'],
                    'effect_confirmed': False})
        return tuple(relations[ref] for ref in sorted(relations))
    baseline_by_body = {row['body_ref']: frozenset(value
        for value, count in row['known_surface_counts'] if count > 0)
        for row in current_context['coverage']}
    support_kind = query.get('unobserved_support_composition_kind')
    if support_kind:
        for row in context['coverage']:
            for value, count in row['known_surface_counts']:
                if count <= 0 or value in baseline_by_body.get(row['body_ref'], ()):
                    continue
                ref = 'experiment-composition:' + stable_digest((
                    support_kind, context['recipe_token'], context['operator_action_ref'],
                    row['body_ref'], value))
                relations[ref] = FrozenMap({'composition_ref': ref,
                    'kind_ref': support_kind, 'body_ref': row['body_ref'],
                    'observed_support_value': value, 'covered_pixel_count': count,
                    'body_pixel_count': row['pixel_count'],
                    'operator_action_ref': context['operator_action_ref'],
                    'effect_confirmed': False})
    return tuple(relations[ref] for ref in sorted(relations))


def _operator_surface_rank(compositions, coverage, distance, query, effect_reuse=((), ())):
    """Measure the exact lexicographic order explicitly requested by DRM."""
    default = (len(compositions), -distance)
    order = query.get('support_relation_order')
    if order == 'maximal_composition_then_typed_method_and_access':
        exact, analogous = effect_reuse
        preferred = any(row.get('body_ref') == query['preferred_support_body_ref'] for row in compositions)
        # Logical correspondence precedes access; palette distance has no
        # observed causal authority to override two equivalent analogies.
        if query.get('analogy_tie_breaker') != 'shortest_access':
            raise ValueError('analogical access order is not declared')
        return (len(compositions), bool(exact), bool(analogous), preferred, -distance)
    if order == 'composition_then_carried_part_then_distance':
        preferred = any(row.get('body_ref') == query['preferred_support_body_ref']
                        for row in compositions)
        # A known operation and an exploratory operation share this order.
        # Appearance must not outrank access when DRM requests distance ties.
        return (len(compositions), preferred, -distance)
    if order not in {'carried_part_then_composition_then_similarity_then_distance',
                     'composition_then_carried_part_then_similarity_then_distance'}:
        return default
    if query.get('support_similarity_metric') != 'retained_appearance_display_rgb_squared_distance':
        raise ValueError('operator support ordering lacks its declared similarity measurement')
    from .interaction import ARC_DISPLAY_RGB_BY_VALUE
    bodies = {row['body_ref']: row for row in coverage}
    preferred = tuple(row for row in compositions
        if row.get('body_ref') == query['preferred_support_body_ref'])
    color_distances = []
    for row in preferred:
        appearance = ARC_DISPLAY_RGB_BY_VALUE.get(bodies[row['body_ref']].get('appearance_value'))
        support = ARC_DISPLAY_RGB_BY_VALUE.get(row['observed_support_value'])
        if appearance is not None and support is not None:
            color_distances.append(sum((a-b)**2 for a,b in zip(appearance, support)))
    # The official display palette supplies exact RGB values. If another
    # display cannot supply them, preserve candidates without a color claim.
    similarity = -min(color_distances) if color_distances else 0
    if order == 'composition_then_carried_part_then_similarity_then_distance':
        return (len(compositions), bool(preferred), similarity, -distance)
    return (bool(preferred), len(compositions), similarity, -distance)


def measure_operator_surface_route(value, *, positions, distances, route_to, steps):
    """Answer the declared richest simultaneous experiment, then access cost.

    Reuses the caller's whole-footprint graph and predecessor tree. No second
    navigation model, wall classification or movement permission is created.
    """
    empty = {'operator_surface_route_present': False,
             'operator_surface_route_query_complete': False,
             'operator_surface_route_action_refs': (),
             'operator_surface_route_action_payloads': (),
             'operator_surface_route_length': 0,
             'operator_surface_route_first_action_ref': '',
             'operator_surface_route_composition_count': 0,
             'operator_surface_route_richer_than_motion_only': False,
             'operator_surface_route_has_additional_support_composition': False,
             'operator_surface_current_context_observed': False,
             'operator_surface_route_failure_ref': 'relation_query_not_declared',
             'operator_surface_route_operator_count': None,
             'operator_surface_route_position_count': len(positions),
             'operator_surface_frontier_enumeration_complete': False,
             'operator_surface_frontier_examined_position_count': 0,
             'operator_surface_frontier_omitted_position_count': len(positions),
             'operator_surface_frontier_support_budget_estimate': 0,
             'operator_surface_frontier_unknown_support_position_count': 0,
             'operator_surface_frontier_unqualified_scope_position_count': 0,
             'operator_surface_frontier_observed_context_position_count': 0,
             'operator_surface_frontier_context_alternatives': (),
             'operator_surface_frontier_context_alternative_count': 0}
    query = value.route_generation_policy.get('operator_surface_relation_query', {})
    if query.get('terminal_selection') not in {
            'maximal_simultaneous_composition_then_shortest_unobserved_support_relation',
            'declared_body_composition_similarity_access_order'}:
        return empty
    if query.get('target_kind') != 'operator_surface_access_only':
        return empty
    empty['operator_surface_route_failure_ref'] = 'position_bound_or_history_unqualified'
    if len(positions) > query['maximum_positions'] or not value.operator_trial_history_complete:
        return empty
    operators = tuple(sorted({r.get('operator_action_ref')
        for row in value.canonical_controlled_assembly_term_facts
        for r in row.get('contextual_part_recipe_rows', ()) if r.get('operator_action_ref')}))
    empty.update(operator_surface_route_operator_count=len(operators),
                 operator_surface_route_failure_ref='operator_not_unique')
    if len(operators) != 1:
        return empty
    current = measure_operator_surface_context(value, operators[0])
    empty.update({key:item for key,item in sorted(current.items())
                  if key.startswith('operator_surface_context_')
                  and (key.endswith('_count') or key.endswith('_failure_ref'))})
    empty['operator_surface_route_failure_ref'] = 'current_operator_context_unqualified'
    if not current['operator_surface_context_present']:
        return empty
    # These measurements concern the recipe operator, not a route direction.
    # Route-owned names preserve that subject across the raw measurement agenda.
    empty.update(
        operator_surface_route_current_operator_action_ref=operators[0],
        operator_surface_route_support_validity_kind=current['operator_surface_context_retained_support_validity'],
        operator_surface_route_hidden_mutation_absence_proven=current['operator_surface_context_hidden_mutation_absence_proven'],
        operator_surface_route_support_provenance_refs=current['operator_surface_context_support_provenance_refs'],
        operator_surface_route_current_support_observation_complete=current['operator_surface_context_current_support_observation_complete'])
    occupied = frozenset(tuple(p) for row in value.canonical_controlled_assembly_term_facts
                        for p in row.get('member_pixel_positions', ()))
    if query.get('support_occlusion_rule') == 'enclosed_rendering_in_confirmed_assembly':
        from .sprite_occlusion import enclosed_rendering_pixels
        occupied |= enclosed_rendering_pixels(occupied)
    pixels = value.frame.rows
    known = {(r,c): {color} for r,row in enumerate(pixels) for c,color in enumerate(row)
             if (r,c) not in occupied}
    # Hidden support retains its observation provenance and conditional status.
    # Visible pixels remain authoritative; conflicting hidden samples stay unknown.
    for row in value.current_translation_underlay_rows:
        for r, c, color in row.get('observed_underlay_pixels', ()):
            if (r, c) in occupied:
                known.setdefault((r, c), set()).add(color)
    for row in value.retained_translation_underlay_rows:
        if (row.get('context_epoch') != value.current_context_epoch
                or row.get('support_validity_kind') != 'conditional_observation_retained_without_visible_contradiction'
                or row.get('hidden_mutation_absence_proven') is not False):
            continue
        for r, c, color, observation_ref in row.get('support_samples', ()):
            if observation_ref and (r, c) in occupied:
                known.setdefault((r, c), set()).add(color)
    cell_model = None
    if query.get('support_relation_representation') == 'retained_cells_and_connected_regions':
        from .operator_cell_support import measure_cell_support_model
        cell_model = measure_cell_support_model(value, known, occlusion_pixels=occupied)
        if cell_model is None:
            return {**empty, 'operator_surface_route_failure_ref': 'retained_cell_background_unqualified'}
    compared = 0
    examined = 0
    unknown_support = 0
    unqualified_scope = 0
    observed_context = 0
    alternatives = {}
    winner = None
    winner_rank = None
    empty['operator_surface_route_failure_ref'] = ''
    complete = dict(empty)
    complete['operator_surface_current_context_observed'] = current['operator_surface_context_previously_observed']
    ordered_positions = tuple(position for position in sorted(positions, key=lambda p: (distances[p], p))
                              if distances[position] != 0)
    for position in ordered_positions:
        if distances[position] == 0:
            continue
        compared += len(occupied)
        if compared > query['maximum_support_comparisons']:
            complete.update(operator_surface_route_failure_ref='support_budget_estimate_bound_reached',
                operator_surface_frontier_examined_position_count=examined,
                operator_surface_frontier_omitted_position_count=len(ordered_positions)-examined,
                operator_surface_frontier_support_budget_estimate=compared,
                operator_surface_frontier_unknown_support_position_count=unknown_support,
                operator_surface_frontier_unqualified_scope_position_count=unqualified_scope,
                operator_surface_frontier_observed_context_position_count=observed_context,
                operator_surface_frontier_context_alternatives=tuple(alternatives[ref] for ref in sorted(alternatives)),
                operator_surface_frontier_context_alternative_count=len(alternatives))
            # A partial enumeration cannot establish maximal richness.
            return {**complete, **(winner or {}),
                'operator_surface_route_query_complete': False,
                'operator_surface_route_richer_than_motion_only': False}
        examined += 1
        candidate = measure_operator_surface_context(value, operators[0], position=position,
            known_surface_pixels=known, cell_support_model=cell_model)
        context = candidate['operator_surface_context']
        if query.get('support_relation_representation') == 'retained_cells_and_connected_regions' and context.get('cell_support_contacts') is None:
            return {**empty, 'operator_surface_route_failure_ref': 'current_body_cell_coverage_unqualified'}
        if not candidate['operator_surface_context_present']:
            unknown_support += 1
            continue
        if any(row['unknown_pixel_count'] for row in context['coverage']):
            unknown_support += 1
            continue
        comparison_qualified = candidate['operator_surface_context_comparison_qualified']
        if not comparison_qualified:
            unqualified_scope += 1
        if comparison_qualified and (candidate['operator_surface_context_previously_observed']
                or context['context_ref'] == current['operator_surface_context']['context_ref']):
            observed_context += 1
            continue
        access_ref = 'operator-support-access:' + stable_digest((
            context['context_epoch'], context['operator_action_ref'], context['recipe_token'],
            tuple(position), context['support_signatures']))
        compositions = _operator_surface_compositions(
            context, current['operator_surface_context'], query)
        composition_refs = tuple(row['composition_ref'] for row in compositions)
        effect_reuse = measure_operator_effect_reuse(value, context)
        method_refs = tuple(dict.fromkeys((*effect_reuse[0], *effect_reuse[1])))
        access = OperatorSurfaceAccessTarget(
            target_kind=query['target_kind'], access_target_ref=access_ref,
            context_epoch=context['context_epoch'], operator_action_ref=context['operator_action_ref'],
            recipe_token=context['recipe_token'], pose_origin=tuple(position),
            support_signatures=context['support_signatures'], coverage=context['coverage'],
            evidence_refs=tuple(dict.fromkeys((*context['evidence_refs'], *method_refs))),
            simultaneous_composition_refs=composition_refs,
            composition_hypotheses=compositions,
            predicted_experiment_context_ref=context['context_ref'] if comparison_qualified else None,
            requires_current_observation=query['requires_current_observation'],
            operator_action_authorized=query['operator_action_authorized'])
        rank = _operator_surface_rank(compositions, context['coverage'], distances[position], query, effect_reuse)
        alternatives.setdefault(context['context_ref'], FrozenMap({
            'context_ref': context['context_ref'], 'position': position,
            'route_length': distances[position], 'support_coverage': context['coverage'],
            'simultaneous_composition_refs': composition_refs,
            'simultaneous_composition_count': len(composition_refs),
            'declared_experiment_rank': rank,
            'same_typed_effect_evidence_refs': effect_reuse[0],
            'analogous_effect_evidence_refs': effect_reuse[1]}))
        actions, _ = route_to(position)
        if not actions:
            continue
        if winner_rank is not None and rank <= winner_rank:
            continue
        winner_rank = rank
        winner = {'operator_surface_route_present': True,
            'operator_surface_route_same_typed_effect_match': bool(effect_reuse[0]),
            'operator_surface_route_analogous_effect_match': bool(effect_reuse[1]),
            'operator_surface_route_reused_effect_claim_refs': method_refs,
            'operator_surface_route_declared_experiment_rank': rank,
            'operator_surface_route_composition_count': len(composition_refs),
            'operator_surface_route_has_additional_support_composition': (
                len(composition_refs) > len(query.get('base_composition_kinds', ()))),
            'operator_surface_route_richer_than_motion_only': (
                len(composition_refs) > query['motion_only_composition_count']),
            'operator_surface_route_query_complete': True,
            'operator_surface_route_action_refs': actions,
            'operator_surface_route_action_payloads': tuple(FrozenMap({
                'expected_step_delta_row': steps[action][0],
                'expected_step_delta_col': steps[action][1]}) for action in actions),
            'operator_surface_route_length': len(actions),
            'operator_surface_route_first_action_ref': actions[0],
            'operator_surface_route_first_delta_row': steps[actions[0]][0],
            'operator_surface_route_first_delta_col': steps[actions[0]][1],
            'operator_surface_route_target_context': FrozenMap(access.model_dump()),
            'operator_surface_route_target_requires_current_observation': access.requires_current_observation,
            'operator_surface_route_target_position': position,
            'operator_surface_route_evidence_refs': access.evidence_refs}
    complete.update(operator_surface_frontier_enumeration_complete=unknown_support == 0,
        operator_surface_frontier_examined_position_count=examined,
        operator_surface_frontier_omitted_position_count=0,
        operator_surface_frontier_support_budget_estimate=compared,
        operator_surface_frontier_unknown_support_position_count=unknown_support,
        operator_surface_frontier_unqualified_scope_position_count=unqualified_scope,
        operator_surface_frontier_observed_context_position_count=observed_context,
        operator_surface_frontier_context_alternatives=tuple(alternatives[ref] for ref in sorted(alternatives)),
        operator_surface_frontier_context_alternative_count=len(alternatives))
    if unknown_support and winner is None:
        complete['operator_surface_route_failure_ref'] = 'target_support_projection_incomplete'
    return {**complete, 'operator_surface_route_query_complete': unknown_support == 0, **(winner or {})}


def measure_current_recipe_bindings(*, tracking, previous_rows, context_epoch,
                                    maximum_rows, require_common_motion=True,
                                    revalidated_phase='current_configuration_revalidated',
                                    require_original_pose=False):
    """Compare current identities and geometry to an already evidenced sample.

    No new action effect or common motion is inferred from this consultation.
    Changed identity, appearance or relative pose leaves the sample unbound.
    """
    if len(previous_rows) > maximum_rows:
        return FrozenMap({'rows': (), 'has_rows': False, 'enumeration_complete': False})
    current = {_get(e, 'entity_id'): e for e in _get(tracking, 'entities', ())}
    frame_ref = _get(tracking, 'frame_ref')
    rows = []
    for previous in previous_rows:
        core_ref, part_ref = previous['core_entity_ref'], previous['part_entity_ref']
        if (previous['context_epoch'] != context_epoch or core_ref == part_ref
                or previous.get('operational_scene_ref') == frame_ref
                or (require_common_motion and not previous.get('common_motion_transition_ref'))
                or not previous.get('recipe_premise_claim_refs')
                or core_ref not in current or part_ref not in current):
            continue
        core, part = current[core_ref], current[part_ref]
        if any(_get(item, 'identity_status') != 'established' for item in (core, part)):
            continue
        cb, pb = _get(core, 'component'), _get(part, 'component')
        if require_original_pose and (
                _box(cb) != tuple(previous['original_core_bbox'])
                or _box(pb) != tuple(previous['original_part_bbox'])):
            continue
        if (_signature(cb) != _retained_signature(previous['core_signature'])
                or _signature(pb) != _retained_signature(previous['changed_part_signature'])
                or _offset(cb, pb) != tuple(previous['contact_offset'])):
            continue
        prior_claims = tuple(previous['recipe_premise_claim_refs'])
        rows.append(FrozenMap({**dict(previous),
            'observation_phase': revalidated_phase,
            'operational_scene_ref': frame_ref,
            'observation_transition_ref': stable_digest((previous['recipe_token'], frame_ref))[:24],
            'current_member_entity_refs': (core_ref, part_ref),
            'prior_common_motion_evidence_present': bool(previous.get('common_motion_transition_ref')),
            'current_identities_and_relative_geometry_match': True,
            'revalidation_evidence_refs': (frame_ref, *prior_claims),
            'prior_recipe_premise_claim_refs': prior_claims,
        }))
    return FrozenMap({'rows': tuple(rows), 'has_rows': bool(rows), 'enumeration_complete': True})


def measure_series_recipe_matches(*, before_tracking, terminal_tracking, covariance_rows,
                                  previous_rows, maximum_rows,
                                  revalidate_current_origin=False):
    """Join retained operator geometry to an exact captured covariance witness.

    Net displacement may be zero. Movement evidence comes from the complete
    series measurement, not from manufacturing a directional primitive.
    """
    before = {_get(e, 'entity_id'): e for e in _get(before_tracking, 'entities', ())}
    after = {_get(e, 'entity_id'): e for e in _get(terminal_tracking, 'entities', ())}
    rows, comparisons = [], []
    if len(previous_rows) > maximum_rows or len(covariance_rows) > maximum_rows:
        return FrozenMap({'rows': (), 'comparison_receipts': (), 'enumeration_complete': False})
    for previous in previous_rows:
        token = previous['recipe_token']
        core, part = previous['core_entity_ref'], previous['part_entity_ref']
        check = None
        origin_changed = previous['operational_scene_ref'] != _get(before_tracking, 'frame_ref')
        if origin_changed and not revalidate_current_origin:
            check = 'comparison.operator_observation_series_origin.failed'
        elif any(ref not in before or ref not in after for ref in (core, part)):
            check = 'comparison.recipe_member_identity.failed'
        elif (any(_get(e,'identity_status') != 'established' for e in (before[core],after[core],after[part]))
              or (_get(before[part],'identity_status') != 'established'
                  and not previous.get('pose_correspondence_proof_validated'))):
            check = 'comparison.recipe_member_established_identity.failed'
        else:
            cb, pb = _get(before[core], 'component'), _get(before[part], 'component')
            ca, pa = _get(after[core], 'component'), _get(after[part], 'component')
            if (_signature(cb) != _retained_signature(previous['core_signature'])
                    or _signature(ca) != _signature(cb)
                    or _signature(pb) != _retained_signature(previous['changed_part_signature'])
                    or _signature(pa) != _signature(pb)):
                check = 'comparison.recipe_member_signatures.failed'
            elif (_offset(cb, pb) != tuple(previous['contact_offset'])
                    or _offset(ca, pa) != _offset(cb, pb)):
                check = 'comparison.recipe_contact_offset.failed'
        matched = () if check else tuple(w for w in covariance_rows
            if w['root_entity_ref'] == core and {core, part}.issubset(w['member_refs'])
            and w['context_epoch'] == previous['context_epoch']
            and w['all_member_samples_exact'] and w['connected_disjoint_supports']
            and w['sample_count'] > 0 and w['moved_sample_count'] > 0)
        if check is None and len(matched) != 1:
            check = 'comparison.recipe_single_covariance_witness.failed'
        comparisons.append(FrozenMap({'candidate_ref': token,
            'check_ref': check or 'comparison.recipe_series_geometry_matched',
            'origin_revalidated_from_current_geometry': bool(origin_changed and check is None)}))
        if check is not None:
            continue
        witness = matched[0]
        rows.append(FrozenMap({**dict(previous),
            'series_covariance_matches_pending_operator': True,
            'series_moved_sample_count': witness['moved_sample_count'],
            'series_origin_revalidated': origin_changed,
            'series_origin_observation_ref': _get(before_tracking, 'frame_ref'),
            'operational_scene_ref': _get(terminal_tracking, 'frame_ref'),
            'observation_transition_ref': witness['transition_ref'],
            'common_motion_transition_ref': witness['transition_ref'],
            'current_member_entity_refs': (core, part),
        }))
    return FrozenMap({'rows': tuple(rows), 'comparison_receipts': tuple(comparisons),
                      'enumeration_complete': True})


def measure_contextual_part_recipes(*,before_tracking,after_tracking,control_rows,
        group_rows,previous_rows,action_ref,transition_ref,context_epoch,
        directional_action_refs,point_action_ref,after_frame_ref,contact_witnesses=(),
        qualified_pose_rows=(), qualified_pending_pose_rows=(), maximum_pose_support_pixels=4096,
        maximum_pose_candidate_entities=4096, operator_trial_context=None):
    if len(previous_rows)>64 or len(qualified_pose_rows)>64 or len(qualified_pending_pose_rows)>64 or len(group_rows)>64 or len(control_rows)>64 or not after_frame_ref:
        return FrozenMap({'rows':(),'enumeration_complete':False,'input_status':'bounded_or_missing_scope'})
    before={_get(e,'entity_id'):e for e in _get(before_tracking,'entities',())}
    after={_get(e,'entity_id'):e for e in _get(after_tracking,'entities',())}
    roots=tuple(sorted({_get(r,'entity_ref') for r in control_rows if _get(r,'entity_ref')}))
    if len(roots)!=1:
        return FrozenMap({'rows':(),'enumeration_complete':False,'input_status':'control_identity_unresolved'})
    core_ref=roots[0]
    if core_ref not in before or core_ref not in after:
        return FrozenMap({'rows':(),'enumeration_complete':False,'input_status':'control_tracking_absent'})
    core_before,core_after=before[core_ref],after[core_ref]
    if any(_get(e,'identity_status')!='established' for e in (core_before,core_after)):
        return FrozenMap({'rows':(),'enumeration_complete':False,'input_status':'control_identity_unestablished'})
    cb,ca=_get(core_before,'component'),_get(core_after,'component')
    rows=[]
    if (action_ref not in directional_action_refs and action_ref!=point_action_ref
            and _get(core_after,'match_kind')=='stationary_exact'
            and _signature(cb)==_signature(ca) and _box(cb)==_box(ca)):
        core_pixels={(r+_box(cb)[0],c+_box(cb)[1]) for r,c in _signature(cb)[3]}
        perimeter={(r+dr,c+dc) for r,c in core_pixels for dr,dc in ((-1,0),(1,0),(0,-1),(0,1))}
        for ref,part_after in sorted(after.items()):
            if ref==core_ref or ref not in before:
                continue
            part_before=before[ref]
            pb,pa=_get(part_before,'component'),_get(part_after,'component')
            if (_get(part_before,'identity_status')!='established'
                    or _get(part_after,'identity_status')!='established'
                    or _get(part_after,'match_kind')!='stationary_value_transition'
                    or _box(pb)!=_box(pa) or _signature(pb)[1:]!=_signature(pa)[1:]
                    or _signature(pb)[0]==_signature(pa)[0]):
                continue
            part_pixels={(r+_box(pb)[0],c+_box(pb)[1]) for r,c in _signature(pb)[3]}
            witnessed_contacts = tuple(w for w in contact_witnesses
                if w.frame_ref == _get(before_tracking,'frame_ref')
                and w.actor_component_ref == _get(cb,'component_id')
                and w.subject_component_ref == _get(pb,'component_id')
                and w.actor_bbox == _box(cb) and w.subject_bbox == _box(pb))
            if (not part_pixels.intersection(perimeter) and not witnessed_contacts) or part_pixels.intersection(core_pixels):
                continue
            token=stable_digest((action_ref,_signature(cb),_signature(pb),_signature(pa),_offset(cb,pb)))
            coupled = tuple(p for p in qualified_pose_rows
                if p['core_entity_ref'] == core_ref and p['part_entity_ref'] == ref
                and _retained_signature(p['changed_part_signature']) == _signature(pb)
                and tuple(p['contact_offset']) == _offset(cb,pb))
            rows.append(FrozenMap({'recipe_token':token,'observation_phase':'contextual_change',
                'acquired_part_appearance_value': _signature(pb)[0],
                'prior_part_cotranslation_observed': bool(coupled),
                'operator_support_context': operator_trial_context or FrozenMap(),
                'operator_action_ref':action_ref,'operator_transition_ref':transition_ref,
                'core_entity_ref':core_ref,'part_entity_ref':ref,
                'core_signature':_signature(cb),'original_part_signature':_signature(pb),
                'changed_part_signature':_signature(pa),'contact_offset':_offset(cb,pb),
                'original_core_bbox':_box(cb),'original_part_bbox':_box(pb),
                'context_epoch':context_epoch,'operational_scene_ref':after_frame_ref,
                'observation_transition_ref':transition_ref,'common_motion_transition_ref':None,
                'current_member_entity_refs':(core_ref,ref),
                'contact_observation_witnesses':tuple(w.model_dump(mode='python') for w in witnessed_contacts)}))
    if qualified_pose_rows and len(after) > maximum_pose_candidate_entities:
        return FrozenMap({'rows':tuple(rows),'enumeration_complete':False,'input_status':'pose_candidate_bound_reached'})
    # A transformed observed pose is a new pending sample. It neither equates
    # the new shape with an old signature nor asserts that attachment survived.
    pose_comparisons = []
    if (action_ref not in directional_action_refs and action_ref != point_action_ref
            and _signature(cb) == _signature(ca) and _box(cb) == _box(ca)):
        from .rigid_grasp_geometry import quarter_turned_mask
        pivot2 = (_box(cb)[0] + _box(cb)[2], _box(cb)[1] + _box(cb)[3])
        core_pixels2 = tuple((2*(r+_box(cb)[0]), 2*(c+_box(cb)[1]))
                             for r,c in _signature(cb)[3])
        for previous in qualified_pose_rows:
            old_part_ref = previous['part_entity_ref']
            check = None
            if previous['context_epoch'] != context_epoch or previous['core_entity_ref'] != core_ref:
                check = 'comparison.pose_control_anchor_scope_changed'
            elif previous['operational_scene_ref'] != _get(before_tracking,'frame_ref'):
                check = 'comparison.pose_prior_frame_changed'
            elif old_part_ref not in before:
                check = 'comparison.pose_prior_member_unavailable'
            else:
                part_before = before[old_part_ref]
                pb = _get(part_before,'component')
                if _get(part_before,'identity_status') != 'established':
                    check = 'comparison.pose_prior_identity_unestablished'
                elif (_signature(pb) != _retained_signature(previous['changed_part_signature'])
                      or _signature(cb) != _retained_signature(previous['core_signature'])
                      or _offset(cb,pb) != tuple(previous['contact_offset'])):
                    check = 'comparison.pose_prior_relation_geometry_changed'
                else:
                    old_pixels2 = tuple((2*(r+_box(pb)[0]),2*(c+_box(pb)[1])) for r,c in _signature(pb)[3])
                    if len(old_pixels2)+len(core_pixels2) > maximum_pose_support_pixels:
                        check = 'comparison.pose_support_bound_reached'
                    else:
                        predictions = tuple((turn,frozenset(quarter_turned_mask(old_pixels2,pivot2,turn)))
                            for turn in (1,2,3)
                            if frozenset(quarter_turned_mask(core_pixels2,pivot2,turn)) == frozenset(core_pixels2))
                        matches = []
                        for ref,candidate in sorted(after.items()):
                            if ref == core_ref:
                                continue
                            if _get(candidate,'current_frame_ref') != after_frame_ref:
                                continue
                            pa = _get(candidate,'component')
                            if len(_get(pa,'relative_pixels',())) != len(old_pixels2):
                                continue
                            if _get(pa,'value') != _get(pb,'value'):
                                continue
                            new_pixels2 = frozenset((2*(r+_box(pa)[0]),2*(c+_box(pa)[1])) for r,c in _signature(pa)[3])
                            if new_pixels2 == frozenset(old_pixels2):
                                continue
                            for turn,predicted in predictions:
                                if predicted == new_pixels2:
                                    matches.append((ref,pa,turn,_get(candidate,'identity_status')))
                                    if len(matches) == 2:
                                        break
                            if len(matches) == 2:
                                break
                        if len(matches) != 1:
                            check = 'comparison.pose_current_correspondence_not_unique'
                        else:
                            ref,pa,turn,current_status = matches[0]
                            token = stable_digest((previous['recipe_token'],transition_ref,_signature(pa),_offset(ca,pa)))
                            rows.append(FrozenMap({
                                'recipe_token':token,'observation_phase':'transformed_pose_observation',
                                'operator_action_ref':action_ref,'operator_transition_ref':transition_ref,
                                'core_entity_ref':core_ref,'part_entity_ref':ref,
                                'core_signature':_signature(ca),'original_part_signature':_signature(pb),
                                'acquired_part_appearance_value': previous.get('acquired_part_appearance_value', previous['original_part_signature'][0]),
                                'changed_part_signature':_signature(pa),'contact_offset':_offset(ca,pa),
                                'original_core_bbox':_box(cb),'original_part_bbox':_box(pb),
                                'context_epoch':context_epoch,'operational_scene_ref':after_frame_ref,
                                'observation_transition_ref':transition_ref,'common_motion_transition_ref':None,
                                'current_member_entity_refs':(core_ref,ref),
                                'prior_pose_evidence_refs':tuple(previous['recipe_premise_claim_refs']),
                                'prior_recipe_token':previous['recipe_token'],
                                'pose_quarter_turns':turn,'pose_pivot_doubled':pivot2,
                                'pose_prior_part_entity_ref':old_part_ref,
                                'pose_current_part_identity_status':current_status,
                                'pose_correspondence_unique':True,
                            }))
            pose_comparisons.append(FrozenMap({'candidate_ref':previous['recipe_token'],
                'check_ref':check or 'comparison.pose_distinct_exact_transform_observed'}))
    # Revalidate an unchanged pending pose across a new observation frame,
    # preserving its token and original operator transition. This is not a
    # second transform observation or an attachment assertion.
    for previous in qualified_pending_pose_rows:
        part_ref = previous['part_entity_ref']
        if (previous['context_epoch'] != context_epoch or previous['core_entity_ref'] != core_ref
                or previous['operational_scene_ref'] != _get(before_tracking,'frame_ref')
                or part_ref not in before or part_ref not in after):
            continue
        part_before,part_after = before[part_ref],after[part_ref]
        pb,pa = _get(part_before,'component'),_get(part_after,'component')
        if (not previous.get('pose_correspondence_proof_validated')
                or _signature(cb) != _signature(ca)
                or _signature(cb) != _retained_signature(previous['core_signature'])
                or _box(cb) != _box(ca) or _signature(pb) != _signature(pa)
                or _signature(pa) != _retained_signature(previous['changed_part_signature'])
                or _box(pb) != _box(pa)
                or _offset(cb,pb) != tuple(previous['contact_offset'])
                or _offset(ca,pa) != tuple(previous['contact_offset'])):
            continue
        rows.append(FrozenMap({**dict(previous),
            'observation_phase':'transformed_pose_revalidation_observation',
            'operational_scene_ref':after_frame_ref,
            'observation_transition_ref':stable_digest((previous['recipe_token'],after_frame_ref))[:24],
            'pose_revalidation_evidence_refs':(*previous['recipe_premise_claim_refs'], *previous['pose_correspondence_claim_refs']),
        }))
    if action_ref in directional_action_refs:
        delta=(_get(core_after,'delta_row'),_get(core_after,'delta_col'))
        if _get(core_after,'match_kind')!='translated_exact' or delta==(0,0):
            return FrozenMap({'rows':tuple(rows),'enumeration_complete':True,'input_status':'no_common_motion_observed'})
        for previous in previous_rows:
            part_ref=_get(previous,'part_entity_ref')
            if (_get(previous,'core_entity_ref')!=core_ref
                    or _get(previous,'context_epoch')!=context_epoch
                    or part_ref not in before or part_ref not in after):
                continue
            # The retained recipe already binds the observed contact. Common
            # motion is an exact displacement/offset observation, including
            # bodies whose sprites have a gap; pixel adjacency is not required.
            part_before,part_after=before[part_ref],after[part_ref]
            pb,pa=_get(part_before,'component'),_get(part_after,'component')
            if (_get(part_before,'identity_status')!='established'
                    or _get(part_after,'identity_status')!='established'
                    or _get(part_after,'match_kind')!='translated_exact'
                    or (_get(part_after,'delta_row'),_get(part_after,'delta_col'))!=delta
                    or _signature(cb)!=_retained_signature(_get(previous,'core_signature'))
                    or _signature(ca)!=_signature(cb)
                    or _signature(pb)!=_retained_signature(_get(previous,'changed_part_signature'))
                    or _signature(pa)!=_signature(pb)
                    or _offset(cb,pb)!=tuple(_get(previous,'contact_offset'))
                    or _offset(ca,pa)!=_offset(cb,pb)):
                continue
            rows.append(FrozenMap({**dict(previous),'observation_phase':'common_motion',
                'action_ref':action_ref,
                'operational_scene_ref':after_frame_ref,'observation_transition_ref':transition_ref,
                'common_motion_transition_ref':transition_ref,'current_member_entity_refs':(core_ref,part_ref)}))
    if len(rows)>64:
        return FrozenMap({'rows':(),'enumeration_complete':False,'input_status':'observation_rows_bound_reached'})
    return FrozenMap({'rows':tuple(rows),'enumeration_complete':True,'input_status':'measured',
        'pose_transition_comparison_receipts':tuple(pose_comparisons)})
