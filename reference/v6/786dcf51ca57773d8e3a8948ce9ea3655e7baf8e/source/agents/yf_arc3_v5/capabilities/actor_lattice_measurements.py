"""Exact actor extents and orthogonal unit translations; no role or grid choice."""


def measure_unit_translation_lattices(*, boxes, translations):
    if not boxes or not translations or any(box.height <= 0 or box.width <= 0 for box in boxes):
        return ()
    extents = {(box.height, box.width, box.top % box.height, box.left % box.width)
        for box in boxes}
    if len(extents) != 1:
        return ()
    h, w, row_phase, col_phase = next(iter(extents))
    steps = set(translations)
    if not steps <= {(-h, 0), (h, 0), (0, -w), (0, w)}:
        return ()
    if not any(dr for dr, dc in steps) or not any(dc for dr, dc in steps):
        return ()
    return ((h, w, row_phase, col_phase),)
