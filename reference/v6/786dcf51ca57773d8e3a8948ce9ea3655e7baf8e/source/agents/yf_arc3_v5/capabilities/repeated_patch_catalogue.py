"""Exact repeated patch/glyph measurements; no palette or interface roles."""
from collections import defaultdict
from pydantic import model_validator
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, stable_digest
from .occluded_catalogue_projection_d import iter_integer_mask_projection_d


class PatchCatalogueMeasurement(FrozenModel):
    """Bounded descriptive witnesses, never an implicitly complete domain."""

    entries: tuple[FrozenMap, ...]
    complete: bool
    count_lower_bound: int
    transport_limit: int

    @model_validator(mode='after')
    def coherent_counts(self):
        if (self.transport_limit < 1 or len(self.entries) > self.transport_limit
                or self.count_lower_bound < len(self.entries)
                or self.complete and self.count_lower_bound != len(self.entries)):
            raise ValueError('inconsistent bounded patch measurement')
        return self


def _patch_measurement(entries, *, limit, complete):
    return PatchCatalogueMeasurement(
        entries=tuple(entries[:limit]), complete=complete,
        count_lower_bound=len(entries), transport_limit=limit)


def _record_patch_measurement(agenda, measurement, scope):
    prefix = 'repeated_patch_' + scope
    return agenda.model_copy(update={'context_facts': FrozenMap({
        **agenda.context_facts,
        prefix + '_domain_complete': measurement.complete,
        prefix + '_count_lower_bound': measurement.count_lower_bound,
        prefix + '_transport_limit': measurement.transport_limit,
        prefix + '_measurement_status': ('complete' if measurement.complete else
            'ambiguous' if measurement.transport_limit == 2 and measurement.count_lower_bound >= 2 else 'incomplete'),
    })})


def measure_repeated_patch_rows(frame, components):
    groups = defaultdict(list)
    for component in components:
        box = component.bbox
        if component.area == box.height * box.width:
            continue
        groups[(component.value, box.top, box.bottom, box.width)].append(component)
    rows = []
    for key in sorted(groups):
        patches = sorted(groups[key], key=lambda item: (item.bbox.left, item.component_id))
        if len(patches) < 2:
            continue
        gaps = tuple(right.bbox.left-left.bbox.right-1 for left,right in zip(patches, patches[1:]))
        if not gaps or min(gaps) < 1 or len(set(gaps)) != 1:
            continue
        interiors = []
        for patch in patches:
            box = patch.bbox
            values = defaultdict(list)
            for r in range(box.top, box.bottom+1):
                for c in range(box.left, box.right+1):
                    value = frame.rows[r][c]
                    if value != patch.value:
                        values[value].append((r-box.top, c-box.left))
            if len(values) != 1:
                break
            ink, = sorted(values)
            interiors.append((ink, tuple(values[ink])))
        if len(interiors) != len(patches) or len({ink for ink,_ in interiors}) != 1:
            continue
        signatures = tuple(stable_digest(points) for _,points in interiors)
        if len(set(signatures)) < 2:
            continue
        ink = interiors[0][0]
        outside = sum(1 for component in components if component.value == ink
                      for r,c in component.pixels
                      if not any(p.bbox.top <= r <= p.bbox.bottom and p.bbox.left <= c <= p.bbox.right for p in patches))
        interior_outside = sum(1 for component in components
            if component.value == ink and not component.touches_frame_boundary
            for r,c in component.pixels
            if not any(p.bbox.top <= r <= p.bbox.bottom and p.bbox.left <= c <= p.bbox.right for p in patches))
        rows.append(FrozenMap({
            'patch_row_ref': stable_digest(tuple(p.component_id for p in patches)),
            'patch_count': len(patches), 'distinct_glyph_count': len(set(signatures)),
            'ink_value': ink, 'outside_ink_pixel_count': outside,
            'patch_component_value': key[0],
            'interior_outside_ink_pixel_count': interior_outside,
            'patch_bounds': tuple((p.bbox.top,p.bbox.left,p.bbox.bottom,p.bbox.right) for p in patches),
            'relative_glyph_pixels': tuple(points for _,points in interiors),
            'component_refs': tuple(p.component_id for p in patches),
        }))
    if len(rows) > 16:
        return _patch_measurement(rows, limit=16, complete=False)
    def strictly_contains(outer, inner):
        return (outer != inner and outer[0] <= inner[0] and outer[1] <= inner[1]
                and outer[2] >= inner[2] and outer[3] >= inner[3])
    retained_rows = tuple(row for row in rows if not any(
        row['patch_row_ref'] != outer['patch_row_ref']
        and len(row['patch_bounds']) == len(outer['patch_bounds'])
        and all(strictly_contains(a,b) for a,b in zip(outer['patch_bounds'],row['patch_bounds']))
        for outer in rows))
    return _patch_measurement(retained_rows, limit=16, complete=True)


def measure_patch_ring_pose_domains(frame, components, patch_rows):
    """Exact positive-only, integer-scale, contained-mask pose domains.

    A rectangular pixel perimeter supplies geometry, not a viewport role.
    Every scale and translation contained in it is considered. Absence,
    clipping, opacity and layer order are deliberately not inferred.
    """
    domains = []
    for ring in components:
        box = ring.bbox
        if box.width <= 2 or box.height <= 2:
            continue
        if ring.area != 2 * (box.width + box.height) - 4:
            continue
        if not all(r in (box.top, box.bottom) or c in (box.left, box.right)
                   for r, c in ring.pixels):
            continue
        top, left, bottom, right = box.top+1, box.left+1, box.bottom-1, box.right-1
        for row in patch_rows:
            if any(not (b[2] < top or b[0] > bottom or b[3] < left or b[1] > right)
                   for b in row['patch_bounds']):
                continue
            positive = frozenset((r, c) for r in range(top, bottom+1)
                                 for c in range(left, right+1)
                                 if frame.rows[r][c] == row['ink_value'])
            if not positive:
                continue
            pr0, pc0 = min(r for r, c in positive), min(c for r, c in positive)
            pr1, pc1 = max(r for r, c in positive), max(c for r, c in positive)
            alternatives = []
            for index, points in enumerate(row['relative_glyph_pixels']):
                gr0, gc0 = min(r for r, c in points), min(c for r, c in points)
                glyph = frozenset((r-gr0, c-gc0) for r, c in points)
                height, width = max(r for r, c in glyph)+1, max(c for r, c in glyph)+1
                poses = []
                zero_patch_value_overlap_poses = []
                minimum_patch_value_overlap = None
                for scale in range(1, min((bottom-top+1)//height, (right-left+1)//width)+1):
                    for dr in range(max(top, pr1-height*scale+1), min(pr0, bottom-height*scale+1)+1):
                        for dc in range(max(left, pc1-width*scale+1), min(pc0, right-width*scale+1)+1):
                            if all(((r-dr)//scale, (c-dc)//scale) in glyph for r, c in positive):
                                poses.append((scale, dr, dc))
                                overlap = sum(frame.rows[r][c] == row['patch_component_value']
                                    for r, c in iter_integer_mask_projection_d(glyph, scale, (dr, dc)))
                                if minimum_patch_value_overlap is None or overlap < minimum_patch_value_overlap:
                                    minimum_patch_value_overlap = overlap
                                if overlap == 0:
                                    zero_patch_value_overlap_poses.append((scale, dr, dc))
                alternatives.append(FrozenMap({
                    'patch_index': index, 'contained_positive_pose_count': len(poses),
                    'integer_scales': tuple(sorted({p[0] for p in poses})),
                    'unique_pose': poses[0] if len(poses) == 1 else None,
                    'minimum_patch_value_overlap': minimum_patch_value_overlap,
                    'zero_patch_value_overlap_pose_count': len(zero_patch_value_overlap_poses),
                    'unique_zero_patch_value_overlap_pose': (zero_patch_value_overlap_poses[0]
                        if len(zero_patch_value_overlap_poses) == 1 else None),
                }))
            if not any(item['contained_positive_pose_count'] > 0 for item in alternatives):
                continue
            domains.append(FrozenMap({
                'ring_component_ref': ring.component_id,
                'interior_bounds': (top, left, bottom, right),
                'patch_row_ref': row['patch_row_ref'],
                'visible_ink_pixel_count': len(positive),
                'alternatives': tuple(alternatives),
            }))
            # A second positive binding disproves uniqueness. The consumers
            # cannot use a partial domain to pick either binding; keep both as
            # witnesses and record that the remaining enumeration is open.
            if len(domains) == 2:
                return _patch_measurement(domains, limit=2, complete=False)
    return _patch_measurement(domains, limit=2, complete=True)


def _append_component_points(value, agenda, component_refs, point_measurements):
    if point_measurements is None or 'ACTION6' not in value.available_action_refs:
        return agenda
    context_delta = {}
    point_rows = point_measurements(
        value, frozenset(agenda.current_context_no_effect_candidate_refs),
        frozenset(agenda.tested_candidate_refs_without_resolution_plan),
        context_delta, {}, {}, {}, component_refs=frozenset(component_refs))
    current = {item.candidate_ref for item in agenda.candidates}
    added = tuple((item, facts) for item, facts in point_rows if item.candidate_ref not in current)
    if not added:
        return agenda
    context = FrozenMap.overlay(context_delta, agenda.context_facts)
    return agenda.model_copy(update={
        'candidates': agenda.candidates + tuple(item for item, _facts in added),
        'alternative_refs': agenda.alternative_refs + tuple(item.candidate_ref for item, _facts in added),
        'descriptive_delta_facts': FrozenMap.overlay(
            {item.candidate_ref: facts for item, facts in added}, agenda.descriptive_delta_facts),
        'alternative_facts': FrozenMap.overlay(
            {item.candidate_ref: FrozenMap.overlay(facts, context) for item, facts in added},
            agenda.alternative_facts),
        'context_facts': context, 'has_candidates': True,
    })


def annotate_patch_adjacent_color_bands(value, agenda, *, point_measurements=None):
    """Current rectangle bands and exact changes relative to a prior patch row.

    No selector role or response correctness is inferred. In particular the
    prior panel bounds only delimit a comparison; their old component IDs do
    not become current geometry supports.
    """
    agenda = agenda.model_copy(update={'context_facts': FrozenMap({
        **agenda.context_facts,
        'repeated_patch_prior_band_rows_domain_complete': False,
        'repeated_patch_prior_band_poses_domain_complete': False,
    })})
    previous = value.previous_action_observed_frame
    if value.last_action_ref != 'ACTION6' or previous is None:
        return agenda
    if previous.height != value.frame.height or previous.width != value.frame.width:
        return agenda
    from .contracts import VisualSceneInput
    from .sprites import describe_visual_scene
    prior_components = describe_visual_scene(VisualSceneInput(frame=previous)).blocks.components
    prior_rows = measure_repeated_patch_rows(previous, prior_components)
    agenda = _record_patch_measurement(agenda, prior_rows, 'prior_band_rows')
    if not prior_rows.complete:
        return agenda
    measured = measure_patch_ring_pose_domains(previous, prior_components, prior_rows.entries)
    agenda = _record_patch_measurement(agenda, measured, 'prior_band_poses')
    if not measured.complete:
        return agenda
    domains = measured.entries
    prior_rows = prior_rows.entries
    if len(domains) != 1:
        return agenda
    domain, = domains
    row, = (r for r in prior_rows if r['patch_row_ref'] == domain['patch_row_ref'])
    top, left, bottom, right = domain['interior_bounds']
    field_values = frozenset(value.frame.rows[r][c] for r in range(top, bottom+1)
                             for c in range(left, right+1))
    bands = defaultdict(list)
    for component in value.components.components:
        box = component.bbox
        if component.area != box.height * box.width or component.value not in field_values:
            continue
        if not (box.bottom < top or box.top > bottom or box.right < left or box.left > right):
            continue
        if any(not (box.bottom < b[0] or box.top > b[2] or box.right < b[1] or box.left > b[3])
               for b in row['patch_bounds']):
            continue
        bands[(box.top, box.bottom, box.width)].append(component)
    bands = tuple(tuple(sorted(items, key=lambda c: (c.bbox.left, c.component_id)))
                  for key, items in sorted(bands.items())
                  if len({c.value for c in items}) > 1
                  and any(c.value == row['ink_value'] for c in items))
    if len(bands) != 1:
        return agenda
    band, = bands
    bounds = tuple((c.bbox.top, c.bbox.left, c.bbox.bottom, c.bbox.right) for c in band)
    agenda = _append_component_points(value, agenda, (c.component_id for c in band), point_measurements)
    point = value.last_point_position
    hit = bool(point is not None and any(b[0] <= point[0] <= b[2] and b[1] <= point[1] <= b[3]
                                        for b in row['patch_bounds']))
    field_unchanged = all(previous.rows[r][c] == value.frame.rows[r][c]
                          for r in range(top, bottom+1) for c in range(left, right+1))
    masks_unchanged = all(
        (previous.rows[r][c] == row['ink_value']) == (value.frame.rows[r][c] == row['ink_value'])
        for b in row['patch_bounds'] for r in range(b[0], b[2]+1) for c in range(b[1], b[3]+1))
    panels_changed = any(previous.rows[r][c] != value.frame.rows[r][c]
                         for b in row['patch_bounds'] for r in range(b[0], b[2]+1)
                         for c in range(b[1], b[3]+1))
    measured = FrozenMap({
        'repeated_patch_band_ref': stable_digest(tuple(c.component_id for c in band)),
        'repeated_patch_band_component_refs': tuple(c.component_id for c in band),
        'repeated_patch_band_values': tuple(c.value for c in band),
        'repeated_patch_prior_row_ref': row['patch_row_ref'],
        'repeated_patch_prior_ring_bounds': domain['interior_bounds'],
        'repeated_patch_prior_panel_bounds': row['patch_bounds'],
        'repeated_patch_prior_ink_value': row['ink_value'],
        'repeated_patch_last_point_in_prior_panel': hit,
        'repeated_patch_field_unchanged_since_action': field_unchanged,
        'repeated_patch_ink_masks_unchanged_since_action': masks_unchanged,
        'repeated_patch_panel_pixels_changed_since_action': panels_changed,
        'repeated_patch_previous_action_ref': value.last_action_ref,
    })
    candidates = {c.candidate_ref: c for c in agenda.candidates}
    facts, descriptive = {}, {}
    for ref in agenda.alternative_refs:
        p = candidates[ref].point
        values = tuple(c.value for c, b in zip(band, bounds) if p is not None
                       and b[0] <= p[0] <= b[2] and b[1] <= p[1] <= b[3])
        delta = {'repeated_patch_point_in_different_value_band_core':
                 len(values) == 1 and values[0] != row['ink_value']}
        facts[ref] = FrozenMap.overlay(delta, agenda.alternative_facts[ref])
        if ref in agenda.descriptive_delta_facts:
            descriptive[ref] = FrozenMap.overlay(delta, agenda.descriptive_delta_facts[ref])
    return agenda.model_copy(update={
        'context_facts': FrozenMap.overlay(measured, agenda.context_facts),
        'alternative_facts': FrozenMap(facts), 'descriptive_delta_facts': FrozenMap(descriptive),
    })


def annotate_repeated_patch_rows(value, agenda, *, point_measurements=None):
    agenda = annotate_patch_adjacent_color_bands(value, agenda, point_measurements=point_measurements)
    agenda = agenda.model_copy(update={'context_facts': FrozenMap({
        **agenda.context_facts,
        'repeated_patch_current_rows_domain_complete': False,
        'repeated_patch_current_poses_domain_complete': False,
    })})
    rows = measure_repeated_patch_rows(value.frame, value.components.components)
    agenda = _record_patch_measurement(agenda, rows, 'current_rows')
    if not rows.complete:
        return agenda
    measured = measure_patch_ring_pose_domains(value.frame, value.components.components, rows.entries)
    agenda = _record_patch_measurement(agenda, measured, 'current_poses')
    if not measured.complete:
        return agenda
    rows = rows.entries
    connected = measured.entries
    if len(connected) != 1:
        return agenda
    domain, = connected
    row, = (item for item in rows if item['patch_row_ref'] == domain['patch_row_ref'])
    if point_measurements is not None and 'ACTION6' in value.available_action_refs:
        # Reuse the ordinary point measurement service for every panel, not
        # just the uniquely matching one. DRM alone selects the experiment.
        # A narrow prior route must not erase newly measured point supports.
        agenda = _append_component_points(value, agenda, row['component_refs'], point_measurements)
    positive_variants = tuple(item for item in domain['alternatives']
                              if item['contained_positive_pose_count'] > 0)
    unique_variant = positive_variants[0] if len(positive_variants) == 1 else None
    zero_overlap_variants = tuple(item for item in domain['alternatives']
                                 if item['zero_patch_value_overlap_pose_count'] > 0)
    unique_zero_overlap_variant = zero_overlap_variants[0] if len(zero_overlap_variants) == 1 else None
    previous = value.previous_action_observed_frame
    point = value.last_point_position
    top, left, bottom, right = domain['interior_bounds']
    comparable = (previous is not None and previous.height == value.frame.height
                  and previous.width == value.frame.width)
    field_unchanged = comparable and all(
        previous.rows[r][c] == value.frame.rows[r][c]
        for r in range(top, bottom+1) for c in range(left, right+1))
    prior_ink_absent = comparable and all(
        previous.rows[r][c] != row['ink_value']
        for b in row['patch_bounds'] for r in range(b[0], b[2]+1) for c in range(b[1], b[3]+1))
    current_ink_core_hit = bool(point is not None and any(
        c.value == row['ink_value'] and c.area == c.bbox.width*c.bbox.height
        and c.bbox.top <= point[0] <= c.bbox.bottom and c.bbox.left <= point[1] <= c.bbox.right
        and (c.bbox.bottom < top or c.bbox.top > bottom or c.bbox.right < left or c.bbox.left > right)
        and all(c.bbox.bottom < b[0] or c.bbox.top > b[2] or c.bbox.right < b[1] or c.bbox.left > b[3]
                for b in row['patch_bounds']) for c in value.components.components))
    cover_count = uncover_count = 0
    exclusive_exchange = bool(comparable)
    if comparable:
        for r in range(top, bottom+1):
            for c in range(left, right+1):
                a, b = previous.rows[r][c], value.frame.rows[r][c]
                if a == b:
                    continue
                if (a, b) == (row['patch_component_value'], row['ink_value']):
                    cover_count += 1
                elif (a, b) == (row['ink_value'], row['patch_component_value']):
                    uncover_count += 1
                else:
                    exclusive_exchange = False
    patches_unchanged = bool(comparable and all(
        previous.rows[r][c] == value.frame.rows[r][c]
        for b in row['patch_bounds'] for r in range(b[0], b[2]+1) for c in range(b[1], b[3]+1)))
    ring = next(c for c in value.components.components if c.component_id == domain['ring_component_ref'])
    ring_unchanged = bool(comparable and all(previous.rows[r][c] == value.frame.rows[r][c]
                                            for r, c in ring.pixels))
    pose_delta = None
    direction_matches = False
    last_delta = {ref: (dr, dc) for ref, dr, dc in value.interface_action_translation_deltas}.get(value.last_action_ref)
    if (cover_count and uncover_count and exclusive_exchange and patches_unchanged and ring_unchanged
            and unique_zero_overlap_variant is not None and last_delta is not None):
        prior_domains = measure_patch_ring_pose_domains(previous, (ring,), (row,))
        prior = next((d for d in prior_domains.entries if d['ring_component_ref'] == domain['ring_component_ref']), None) if prior_domains.complete else None
        index = unique_zero_overlap_variant['patch_index']
        after_pose = unique_zero_overlap_variant['unique_pose']
        before_pose = prior['alternatives'][index]['unique_pose'] if prior is not None else None
        if before_pose is not None and after_pose is not None and before_pose[0] == after_pose[0]:
            pose_delta = (after_pose[1]-before_pose[1], after_pose[2]-before_pose[2])
            direction_matches = bool(pose_delta != (0, 0) and all(
                (a == b == 0) or a*b > 0 for a, b in zip(pose_delta, last_delta)))
    measured = FrozenMap({
        'repeated_patch_row_count': len(connected),
        'repeated_patch_row_ref': row['patch_row_ref'],
        'repeated_patch_distinct_glyph_count': row['distinct_glyph_count'],
        'repeated_patch_component_value': row['patch_component_value'],
        'repeated_patch_ink_value': row['ink_value'],
        'repeated_patch_outside_ink_pixel_count': row['outside_ink_pixel_count'],
        'repeated_patch_component_refs': row['component_refs'],
        'repeated_patch_ring_component_ref': domain['ring_component_ref'],
        'repeated_patch_visible_ink_pixel_count': domain['visible_ink_pixel_count'],
        'repeated_patch_positive_variant_count': len(positive_variants),
        'repeated_patch_zero_patch_value_overlap_variant_count': len(zero_overlap_variants),
        'repeated_patch_unique_zero_overlap_variant_pose_count': (
            unique_zero_overlap_variant['zero_patch_value_overlap_pose_count'] if unique_zero_overlap_variant else 0),
        'repeated_patch_pose_domain_contained_only': True,
        'repeated_patch_unique_variant_pose_count': unique_variant['contained_positive_pose_count'] if unique_variant else 0,
        'repeated_patch_last_action_ref': value.last_action_ref,
        'repeated_patch_last_point_in_current_ink_core': current_ink_core_hit,
        'repeated_patch_current_ink_absent_from_previous_panel_bounds': bool(prior_ink_absent),
        'repeated_patch_current_field_unchanged_since_action': bool(field_unchanged),
        'repeated_patch_value_to_ink_pixel_count': cover_count,
        'repeated_patch_ink_to_value_pixel_count': uncover_count,
        'repeated_patch_field_changes_only_exchange_ink_and_patch_value': exclusive_exchange,
        'repeated_patch_panels_unchanged_since_action': patches_unchanged,
        'repeated_patch_ring_unchanged_since_action': ring_unchanged,
        'repeated_patch_unique_zero_overlap_pose_delta': pose_delta,
        'repeated_patch_unique_zero_overlap_pose_delta_matches_interface_direction': direction_matches,
        'repeated_patch_previous_frame_digest': stable_digest(previous.rows) if direction_matches else None,
    })
    deltas = {ref: (dr, dc) for ref, dr, dc in value.interface_action_translation_deltas}
    candidates = {item.candidate_ref: item for item in agenda.candidates}
    facts = {}
    delta_facts = {}
    for ref in sorted(agenda.alternative_refs):
        delta = deltas.get(candidates[ref].action_ref)
        projection = {'repeated_patch_interface_row_delta': delta[0] if delta else None,
                      'repeated_patch_interface_col_delta': delta[1] if delta else None}
        point = candidates[ref].point
        box = row['patch_bounds'][unique_variant['patch_index']] if unique_variant else None
        projection['repeated_patch_point_in_unique_positive_variant_panel'] = bool(
            point is not None and box is not None
            and box[0] <= point[0] <= box[2] and box[1] <= point[1] <= box[3])
        zero_box = row['patch_bounds'][unique_zero_overlap_variant['patch_index']] if unique_zero_overlap_variant else None
        projection['repeated_patch_point_in_unique_zero_patch_value_overlap_panel'] = bool(
            point is not None and zero_box is not None
            and zero_box[0] <= point[0] <= zero_box[2] and zero_box[1] <= point[1] <= zero_box[3])
        facts[ref] = FrozenMap.overlay(projection, agenda.alternative_facts[ref])
        if ref in agenda.descriptive_delta_facts:
            delta_facts[ref] = FrozenMap.overlay(projection, agenda.descriptive_delta_facts[ref])
    return agenda.model_copy(update={
        'context_facts': FrozenMap.overlay(measured, agenda.context_facts),
        'alternative_facts': FrozenMap(facts),
        'descriptive_delta_facts': FrozenMap(delta_facts),
    })
