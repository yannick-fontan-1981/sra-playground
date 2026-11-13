"""Bounded exact completion of a repeated ring under an observed axial mask."""
from collections import Counter

from agents.yf_arc3_v5.capabilities.contracts import (
    BoundingBox, ComponentDescription, FrameGrid, Position,
)


def measure_axially_occluded_ring_centres(
    frame: FrameGrid,
    components: tuple[ComponentDescription, ...],
    template: ComponentDescription,
    centres: tuple[Position, ...],
    centre_value: int,
    footprints: tuple[BoundingBox, ...],
) -> tuple[Position, ...]:
    """Return only uniquely measured partial copies, never unseen copies.

    Two intact copies establish the exact local template. A partial copy must
    retain a full side's worth of template pixels; every other template pixel
    must be occupied by the same measured axial body. Its intersection must
    lie in the translated control footprint, which may be only a focus pixel.
    Missing pixels with another value, a second body, or ambiguous axes refuse
    completion. The enumeration is bounded by small observed fragments.
    """
    side = template.bbox.height
    if not (2 <= len(centres) <= 3 and 3 <= side <= 7 and side % 2):
        return ()
    if len(footprints) != 1 or len(components) > 64:
        return ()
    box = footprints[0]
    if box.height * box.width > 4096:
        return ()
    excluded = frozenset(centres)
    pixels = tuple(
        (r, c)
        for component in components
        if component.value == centre_value
        for r, c in component.pixels
        if (r, c) not in excluded
    )
    rows, cols = Counter(r for r, _ in pixels), Counter(c for _, c in pixels)
    if not rows or not cols:
        return ()
    axial_rows = tuple(r for r, n in sorted(rows.items()) if n == max(rows.values()) and n >= 3)
    axial_cols = tuple(c for c, n in sorted(cols.items()) if n == max(cols.values()) and n >= 3)
    if len(axial_rows) != 1 or len(axial_cols) != 1:
        return ()
    axis_row, axis_col = axial_rows[0], axial_cols[0]
    if not (box.top <= axis_row <= box.bottom and box.left <= axis_col <= box.right):
        return ()
    offset = side // 2
    offsets = tuple((r - offset, c - offset) for r, c in template.relative_pixels)
    candidates: set[Position] = set()
    for component in components:
        if (component.value != template.value or component.touches_frame_boundary
                or component.area >= template.area
                or component.bbox.height > side or component.bbox.width > side):
            continue
        for r, c in component.pixels:
            for dr, dc in offsets:
                candidates.add((r - dr, c - dc))
                if len(candidates) > 512:
                    return ()
    completed: list[Position] = []
    for r, c in sorted(candidates - excluded):
        if not (offset <= r < frame.height - offset
                and offset <= c < frame.width - offset
                and frame.rows[r][c] == centre_value):
            continue
        visible = 0
        covered: list[Position] = []
        contradicted = False
        for dr, dc in offsets:
            rr, cc = r + dr, c + dc
            value = frame.rows[rr][cc]
            if value == template.value:
                visible += 1
            elif value == centre_value and (rr == axis_row or cc == axis_col):
                covered.append((rr, cc))
            else:
                contradicted = True
                break
        if not contradicted and visible >= side and covered:
            completed.append((r, c))
    if len(completed) != 4 - len(centres):
        return ()
    # An edge contact can leave a marker's own coloured centre off the body
    # axes. Exclude only centres whose complete local template was verified
    # above; every other same-colour pixel must still belong to the body.
    recovered_centres = frozenset(completed)
    if any(r != axis_row and c != axis_col and (r, c) not in recovered_centres
           for r, c in pixels):
        return ()
    return tuple(completed)
