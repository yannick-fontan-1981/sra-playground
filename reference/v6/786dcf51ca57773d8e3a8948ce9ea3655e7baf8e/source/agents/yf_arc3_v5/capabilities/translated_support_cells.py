"""Exact cell offsets for a supplied current support; no role or route choice."""

def measure_support_cell_offsets(*, grid, anchor_cell, pixel_positions):
    """Return every occupied logical offset, or unknown on incomplete geometry."""
    if not pixel_positions or len(pixel_positions) > 4096:
        return None
    owners = {}
    for cell in grid.cells:
        for row in range(cell.bbox.top, cell.bbox.bottom + 1):
            for column in range(cell.bbox.left, cell.bbox.right + 1):
                point = (row, column)
                if point in owners:
                    owners[point] = None
                else:
                    owners[point] = (cell.row, cell.col)
    offsets = set()
    for point in pixel_positions:
        position = owners.get(tuple(point))
        if position is None:
            return None
        offsets.add((position[0] - anchor_cell.row, position[1] - anchor_cell.col))
    if (0, 0) not in offsets:
        return None
    return frozenset(offsets)


def measure_support_pixel_offsets(*, grid, anchor_cell, pixel_positions):
    """Expand measured logical occupancy, retaining holes between member cells.

    Decorative holes inside a cell do not remove that cell's physical support.
    Gaps between cell cores remain gaps; no enclosing rectangle is substituted.
    """
    offsets = measure_support_cell_offsets(
        grid=grid, anchor_cell=anchor_cell, pixel_positions=pixel_positions)
    if offsets is None:
        return None
    return frozenset(
        (row * grid.row_pitch + dr, col * grid.col_pitch + dc)
        for row, col in offsets
        for dr in range(anchor_cell.bbox.height)
        for dc in range(anchor_cell.bbox.width)
    )
