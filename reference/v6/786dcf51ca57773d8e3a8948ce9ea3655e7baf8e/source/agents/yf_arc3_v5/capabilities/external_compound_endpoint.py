"""Measure external compact supports attached to a populated branched shape.

No palette, control role, program meaning or action is selected here.
"""

from collections import Counter


def _neighbors(point):
    row, col = point
    return ((row - 1, col), (row + 1, col),
            (row, col - 1), (row, col + 1))


def measure_external_compound_endpoints(components):
    counts = Counter()
    for component in components:
        counts[component.value] += component.area
    modal = frozenset(value for value, count in sorted(counts.items())
                      if count == max(counts.values(), default=0))
    compact = tuple(c for c in components
        if not c.touches_frame_boundary
        and min(c.bbox.height, c.bbox.width) > 1
        and max(c.bbox.height, c.bbox.width)
            <= 4 * min(c.bbox.height, c.bbox.width)
        and 2 * c.area >= c.bbox.height * c.bbox.width)
    measured = {}
    for body in compact:
        b = body.bbox
        matches = []
        for shape in components:
            q = shape.bbox
            if shape.touches_frame_boundary or shape.area <= body.area:
                continue
            if not (b.top > q.bottom or b.bottom < q.top
                    or b.left > q.right or b.right < q.left):
                continue
            population = tuple(c.component_id for c in compact
                if q.top < (c.bbox.top + c.bbox.bottom) // 2 < q.bottom
                and q.left < (c.bbox.left + c.bbox.right) // 2 < q.right)
            nonmodal_population = sum(c.component_id in population
                                      and c.value not in modal for c in compact)
            if len(population) < 2:
                continue
            pixels, body_pixels = frozenset(shape.pixels), frozenset(body.pixels)
            contacts = tuple(sorted(p for p in pixels
                if sum(n in pixels for n in _neighbors(p)) == 1
                and any(n in body_pixels for n in _neighbors(p))))
            for contact in contacts:
                path, seen, previous, current = [], set(), None, contact
                junction_degree = 0
                while current not in seen:
                    seen.add(current)
                    path.append(current)
                    neighbors = tuple(n for n in _neighbors(current) if n in pixels)
                    following = tuple(n for n in neighbors if n != previous)
                    if len(following) != 1:
                        junction_degree = len(neighbors)
                        break
                    previous, current = current, following[0]
                if len(path) < 2 or junction_degree < 3:
                    continue
                matches.append({
                    "external_compound_endpoint_measured": True,
                    "external_compound_endpoint_component_ref": body.component_id,
                    "external_compound_attached_shape_ref": shape.component_id,
                    "external_compound_attachment_path_length": len(path),
                    "external_compound_attachment_junction_degree": junction_degree,
                    "external_compound_enclosed_compact_count": len(population),
                    "external_compound_enclosed_nonmodal_compact_count": nonmodal_population,
                    "external_compound_endpoint_is_modal": body.value in modal,
                    "external_compound_endpoint_row": (b.top + b.bottom) // 2,
                    "external_compound_endpoint_col": (b.left + b.right) // 2,
                })
        # Ambiguous attachments remain undesignated, rather than selecting one.
        if len(matches) == 1:
            measured[body.component_id] = matches[0]
    return measured
