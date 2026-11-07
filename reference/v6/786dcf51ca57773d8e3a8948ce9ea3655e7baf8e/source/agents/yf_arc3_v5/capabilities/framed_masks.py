"""Bounded exact mask correspondences inside uniformly filled frames.

Palette changes and repeated occurrences remain measurements. No occurrence
is chosen as a source, destination, controllable body or transport recipient.
"""
from agents.yf_arc3_v5.logos.types import stable_digest


def measure_enclosed_frame_groups(frame, components, contract):
    """Closed one-pixel frames with possibly marked interiors, without roles.

    Unlike exact-mask correspondence, this measures all interior colours. It
    does not silently reinterpret a marking as a hole or a solid body. Existing
    mask-correspondence callers retain their original, stricter default.
    """
    if not contract or frame.height * frame.width > contract['maximum_frame_pixels']:
        return {'enclosed_frame_groups_complete': False, 'enclosed_frame_groups': (), 'work_count': 0}
    if len(components) > contract['maximum_component_count']:
        return {'enclosed_frame_groups_complete': False, 'enclosed_frame_groups': (), 'work_count': 0}
    count = 0
    groups = {}
    rows = frame.rows
    try:
        def charge(amount):
            nonlocal count
            count += amount
            if count > contract['maximum_work']:
                raise OverflowError('enclosed frame work bound')

        for component in components:
            box = component.bbox
            if (min(box.height, box.width) < contract['minimum_mask_extent']
                    or max(box.height, box.width) > contract['maximum_mask_extent']
                    or component.area < contract['minimum_mask_area']):
                continue
            top, left, bottom, right = box.top-1, box.left-1, box.bottom+1, box.right+1
            if top < 0 or left < 0 or bottom >= frame.height or right >= frame.width:
                continue
            bounds = (top, left, bottom, right)
            if bounds in groups:
                continue
            charge(2*(bottom-top+right-left))
            border = rows[top][left]
            if border == component.value or not (
                    all(rows[y][x] == border for y in (top, bottom) for x in range(left, right+1))
                    and all(rows[y][x] == border for x in (left, right) for y in range(top+1, bottom))):
                continue
            histogram = {}
            charge(box.height*box.width)
            for y in range(box.top, box.bottom+1):
                for x in range(box.left, box.right+1):
                    value = rows[y][x]
                    histogram[value] = histogram.get(value, 0)+1
            greatest = max(histogram.values())
            modes = tuple(value for value, amount in sorted(histogram.items()) if amount == greatest)
            enclosed = []
            for member in components:
                charge(1)
                b = member.bbox
                if top <= b.top <= b.bottom <= bottom and left <= b.left <= b.right <= right:
                    enclosed.append(member.component_id)
            groups[bounds] = {
                'frame_ref': 'measurement.enclosed_frame.'+stable_digest(bounds),
                'frame_bbox': bounds, 'border_value': border,
                'interior_value_counts': tuple(sorted(histogram.items())),
                'interior_border_value_count': histogram.get(border, 0),
                'unique_modal_interior_value': modes[0] if len(modes) == 1 else None,
                'enclosed_component_refs': tuple(sorted(enclosed)),
                'interior_pattern_digest': stable_digest(tuple(tuple(rows[y][x]
                    for x in range(box.left, box.right+1)) for y in range(box.top, box.bottom+1))),
            }
            if len(groups) > contract['maximum_framed_occurrences']:
                raise OverflowError('enclosed frame occurrence bound')
    except OverflowError:
        # Prefixes cannot establish a complete inventory or uniqueness.
        return {'enclosed_frame_groups_complete': False, 'enclosed_frame_groups': (), 'work_count': count}
    return {'enclosed_frame_groups_complete': True,
        'enclosed_frame_groups': tuple(row for _, row in sorted(groups.items())), 'work_count': count}


def measure_framed_mask_correspondences(frame, entities, contract):
    if not contract:
        return {"framed_mask_domain_complete": False, "framed_mask_pairs": ()}
    rows = frame.rows
    height, width = len(rows), len(rows[0]) if rows else 0
    if (height * width > contract["maximum_frame_pixels"]
            or len(entities) > contract["maximum_component_count"]):
        return {"framed_mask_domain_complete": False, "framed_mask_pairs": ()}
    framed = []
    for entity in entities:
        component = entity.component if hasattr(entity, 'component') else entity
        entity_ref = entity.entity_id if hasattr(entity, 'entity_id') else component.component_id
        box = component.bbox
        if not (contract["minimum_mask_area"] <= component.area <= contract["maximum_mask_area"]
                and min(box.height, box.width) >= contract["minimum_mask_extent"]
                and max(box.height, box.width) <= contract["maximum_mask_extent"]):
            continue
        top, left, bottom, right = box.top - 1, box.left - 1, box.bottom + 1, box.right + 1
        if top < 0 or left < 0 or bottom >= height or right >= width:
            continue
        border = rows[top][left]
        if border == component.value:
            continue
        if not (all(rows[y][x] == border for y in (top, bottom) for x in range(left, right + 1))
                and all(rows[y][x] == border for x in (left, right) for y in range(top, bottom + 1))):
            continue
        mask = frozenset(component.relative_pixels)
        if any(rows[y][x] != (component.value if (y - box.top, x - box.left) in mask else border)
               for y in range(box.top, box.bottom + 1) for x in range(box.left, box.right + 1)):
            continue
        framed.append((component, entity_ref, border, (top, left, bottom, right)))
    if len(framed) > contract["maximum_framed_occurrences"]:
        return {"framed_mask_domain_complete": False, "framed_mask_pairs": ()}
    pairs = []
    for index, (a, first_ref, first_border, first_box) in enumerate(framed):
        for b, second_ref, second_border, second_box in framed[index + 1:]:
            if (a.value == b.value or a.bbox.height != b.bbox.height
                    or a.bbox.width != b.bbox.width or a.relative_pixels != b.relative_pixels):
                continue
            pairs.append({
                "mask_digest": stable_digest((a.bbox.height, a.bbox.width, a.relative_pixels)),
                "mask_extent": (a.bbox.height, a.bbox.width), "mask_area": a.area,
                "first_entity_ref": first_ref, "second_entity_ref": second_ref,
                "first_component_ref": a.component_id, "second_component_ref": b.component_id,
                "first_frame_bbox": first_box, "second_frame_bbox": second_box,
                "first_inner_value": a.value, "second_inner_value": b.value,
                "first_border_value": first_border, "second_border_value": second_border,
            })
            if len(pairs) > contract["maximum_correspondences"]:
                return {"framed_mask_domain_complete": False, "framed_mask_pairs": ()}
    occurrences = tuple({
        'entity_ref': ref, 'component_ref': component.component_id,
        'mask_digest': stable_digest((component.bbox.height, component.bbox.width, component.relative_pixels)),
        'mask_extent': (component.bbox.height, component.bbox.width),
        'mask_area': component.area, 'inner_value': component.value, 'border_value': border,
        'frame_bbox': box, 'inner_bbox': (component.bbox.top, component.bbox.left, component.bbox.bottom, component.bbox.right),
        'inner_fills_bbox': component.area == component.bbox.height * component.bbox.width,
    } for component, ref, border, box in framed)
    return {"framed_mask_domain_complete": True, "framed_mask_pairs": tuple(pairs),
            'framed_mask_occurrences': occurrences,
            "framed_mask_pair_count": len(pairs), "framed_mask_occurrence_count": len(framed)}


def measure_framed_mask_transition(before_frame, after_frame, before_entities, after_entities, contract):
    before = measure_framed_mask_correspondences(before_frame, before_entities, contract)
    after = measure_framed_mask_correspondences(after_frame, after_entities, contract)
    return {
        "framed_mask_domain_complete": before["framed_mask_domain_complete"] and after["framed_mask_domain_complete"],
        "framed_mask_before_pairs": before["framed_mask_pairs"],
        'framed_mask_before_occurrences': before.get('framed_mask_occurrences', ()),
        'framed_mask_occurrences': after.get('framed_mask_occurrences', ()),
        "framed_mask_pairs": after["framed_mask_pairs"],
        "framed_mask_pair_count": after.get("framed_mask_pair_count", 0),
        "framed_mask_before_pair_count": before.get("framed_mask_pair_count", 0),
        "framed_mask_observation_digest": stable_digest((before["framed_mask_pairs"], after["framed_mask_pairs"])),
    }
