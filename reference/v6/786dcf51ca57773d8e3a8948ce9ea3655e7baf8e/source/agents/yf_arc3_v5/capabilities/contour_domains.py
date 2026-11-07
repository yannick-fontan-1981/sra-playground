"""Bounded raster enclosure measurements; no influence law or role assignment.

A flood from the outside preserves concavities. An open or clipped contour
does not license filling its bounding rectangle. Coordinates are (row, col).
"""
from collections import deque

from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


def measure_contour_domain(component):
    box = component.bbox
    height, width = box.height, box.width
    if height * width > 4096 or min(height, width) < 3:
        return None
    if component.touches_frame_boundary:
        return None  # A clipped perimeter leaves the missing boundary unknown.
    boundary = frozenset(component.relative_pixels)
    outside = set()
    pending = deque((r, c) for r in range(-1, height + 1)
                    for c in range(-1, width + 1)
                    if r in (-1, height) or c in (-1, width))
    outside.update(pending)
    while pending:
        row, col = pending.popleft()
        for point in ((row - 1, col), (row + 1, col),
                      (row, col - 1), (row, col + 1)):
            r, c = point
            if (-1 <= r <= height and -1 <= c <= width
                    and point not in boundary and point not in outside):
                outside.add(point)
                pending.append(point)
    interior = frozenset((r, c) for r in range(height) for c in range(width)
                         if (r, c) not in boundary and (r, c) not in outside)
    if not interior:
        return None
    domain = boundary | interior
    domain_boundary = frozenset(p for p in domain if any(q not in domain for q in (
        (p[0]-1, p[1]), (p[0]+1, p[1]), (p[0], p[1]-1), (p[0], p[1]+1))))
    rectangle = domain == frozenset((r, c) for r in range(height) for c in range(width))
    # Exact digital disk, with doubled coordinates supporting half-pixel centres.
    distances = {(r, c): (2*r-height+1)**2 + (2*c-width+1)**2
                 for r in range(height) for c in range(width)}
    radius_squared = max(distances[p] for p in domain)
    disk = (height == width and domain == frozenset(
        p for p, distance in sorted(distances.items()) if distance <= radius_squared))
    return FrozenMap({
        'relative_boundary': tuple(sorted(boundary)),
        'relative_interior': tuple(sorted(interior)),
        'relative_domain': tuple(sorted(domain)),
        'closed_contour_present': True, 'exact_rectangular_domain': rectangle,
        'contour_is_exact_domain_boundary': boundary == domain_boundary,
        'exact_circular_domain': disk and not rectangle,
        'boundary_inclusion_unknown': True,
        'domain_digest': stable_digest(tuple(sorted(domain)))[:16],
    })


def measure_support_membership(domain, relative_points):
    """Exact membership alternatives; DRM must select the effect's predicate.

    Return centre, full-support and overlap separately. Boundary is separate
    from strict interior; neither an unknown inclusion convention nor an
    influence effect is silently decided here.
    """
    points = frozenset(relative_points)
    if not points:
        return FrozenMap({'support_present': False})
    interior = frozenset(domain['relative_interior'])
    boundary = frozenset(domain['relative_boundary'])
    centre2 = (min(r for r, _ in points) + max(r for r, _ in points),
               min(c for _, c in points) + max(c for _, c in points))
    # A centre between pixels is not rounded into a cell.
    centre_integral = centre2[0] % 2 == 0 and centre2[1] % 2 == 0
    centre = (centre2[0] // 2, centre2[1] // 2)
    return FrozenMap({
        'support_present': True, 'centre_on_raster': centre_integral,
        'centre_strictly_inside': centre_integral and centre in interior,
        'centre_on_boundary': centre_integral and centre in boundary,
        'support_strictly_inside': points <= interior,
        'support_overlaps_interior': bool(points & interior),
        'support_overlaps_boundary': bool(points & boundary),
    })


def measure_cotranslated_enclosures(before_by_entity, after_by_entity, translations,
                                   *, action_ref, transition_ref, context_epoch):
    """Associate closed supports with enclosed, equally translated supports.

    All associations survive; enclosure and co-motion do not distinguish an
    aura from a structural frame, or establish protection, pickup reach, etc.
    """
    if len(translations) > 128:
        return ()
    rows = []
    for outer in translations:
        before = before_by_entity[outer.entity_ref].component
        after = after_by_entity[outer.entity_ref].component
        domain = measure_contour_domain(after)
        previous = measure_contour_domain(before)
        if (domain is None or previous is None
                or not domain['contour_is_exact_domain_boundary']
                or not previous['contour_is_exact_domain_boundary']
                or domain['relative_boundary'] != previous['relative_boundary']
                or domain['relative_domain'] != previous['relative_domain']):
            continue
        enclosed = []
        for inner in translations:
            if (inner.entity_ref == outer.entity_ref
                    or (inner.delta_row, inner.delta_col) != (outer.delta_row, outer.delta_col)):
                continue
            component = after_by_entity[inner.entity_ref].component
            points = tuple((r-after.bbox.top, c-after.bbox.left) for r, c in component.pixels)
            original = before_by_entity[inner.entity_ref].component
            original_points = tuple((r-before.bbox.top, c-before.bbox.left)
                                    for r, c in original.pixels)
            if (measure_support_membership(domain, points)['support_strictly_inside']
                    and measure_support_membership(previous, original_points)['support_strictly_inside']):
                enclosed.append(inner.entity_ref)
        if not enclosed:
            continue
        rows.append(FrozenMap({
            **dict(domain), 'contour_entity_ref': outer.entity_ref,
            'contour_component_ref': after.component_id,
            'observed_value': after.value,
            'enclosed_member_refs': tuple(enclosed), 'enclosed_member_count': len(enclosed),
            'enclosure_token': stable_digest((outer.entity_ref, tuple(enclosed)))[:16],
            'delta_row': outer.delta_row, 'delta_col': outer.delta_col,
            'origin_row': after.bbox.top, 'origin_col': after.bbox.left,
            'action_ref': action_ref, 'transition_ref': transition_ref,
            'context_epoch': context_epoch, 'same_relative_domain_after_translation': True,
        }))
    return tuple(rows)


def measure_translated_support_changes(before_by_entity, after_by_entity, translations,
                                       enclosure_rows, before_frame, after_frame):
    """Measure own-pixel changes independently of apparent support translation.

    Enclosure and covariance are retained even when every contour pixel has the
    same value in both frames. These receipts assign neither control nor physical
    extent; DRM distinguishes visible motion from a possible occlusion boundary.
    """
    receipts = {}
    for translation in translations:
        ref = translation.entity_ref
        before = before_by_entity[ref].component
        after = after_by_entity[ref].component
        receipts[ref] = FrozenMap({
            'entity_ref': ref,
            'changed_departure_pixels': sum(before_frame.rows[r][c] != after_frame.rows[r][c]
                                            for r, c in before.pixels),
            'changed_arrival_pixels': sum(before_frame.rows[r][c] != after_frame.rows[r][c]
                                          for r, c in after.pixels),
        })
    visible_refs = tuple(ref for ref, row in sorted(receipts.items())
                         if row['changed_departure_pixels'] or row['changed_arrival_pixels'])
    facts = {
        'input_aligned_support_change_receipts': tuple(receipts[ref] for ref in sorted(receipts)),
        'input_aligned_changed_support_count': len(visible_refs),
        'input_aligned_changed_support_refs': visible_refs,
    }
    if len(visible_refs) == 1:
        ref = visible_refs[0]
        component = before_by_entity[ref].component
        translation = next(t for t in translations if t.entity_ref == ref)
        unchanged_contours = tuple(row['contour_entity_ref'] for row in enclosure_rows
                                  if ref in row['enclosed_member_refs']
                                  and not receipts[row['contour_entity_ref']]['changed_departure_pixels']
                                  and not receipts[row['contour_entity_ref']]['changed_arrival_pixels'])
        facts.update({
            'unique_changed_support_entity_ref': ref,
            'unique_changed_support_component_ref': component.component_id,
            'unique_changed_support_member_refs': (ref,),
            'unique_changed_support_member_bound_exceeded': False,
            'unique_changed_support_delta_row': translation.delta_row,
            'unique_changed_support_delta_col': translation.delta_col,
            'unique_changed_support_area': component.area,
            'unique_changed_support_bbox_height': component.bbox.height,
            'unique_changed_support_bbox_width': component.bbox.width,
            'unique_changed_support_observed_value': component.value,
            'unique_changed_support_shape_digest': stable_digest(component.relative_pixels)[:16],
            'unique_changed_support_departure_pixels': receipts[ref]['changed_departure_pixels'],
            'unique_changed_support_arrival_pixels': receipts[ref]['changed_arrival_pixels'],
            'unique_changed_support_unchanged_contour_count': len(unchanged_contours),
            'unique_changed_support_unchanged_contour_refs': unchanged_contours,
        })
    # This count also preserves ambiguity when several visible inner supports
    # exist. No individual core is chosen in that case.
    facts['unchanged_contour_with_changed_enclosed_support_refs'] = tuple(
        row['contour_entity_ref'] for row in enclosure_rows
        if not receipts[row['contour_entity_ref']]['changed_departure_pixels']
        and not receipts[row['contour_entity_ref']]['changed_arrival_pixels']
        and any(ref in visible_refs for ref in row['enclosed_member_refs']))
    facts['input_aligned_occlusion_contour_present'] = bool(
        facts['unchanged_contour_with_changed_enclosed_support_refs'])
    return FrozenMap(facts)
