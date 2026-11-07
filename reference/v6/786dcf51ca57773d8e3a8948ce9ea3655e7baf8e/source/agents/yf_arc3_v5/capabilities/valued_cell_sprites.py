"""Exact bounded multicolour sprite geometry; no roles, goals or action choices."""
from __future__ import annotations
from collections import Counter
from agents.yf_arc3_v5.capabilities.contracts import BoundingBox, FrameGrid


def unique_modal_value(values: tuple[int, ...]) -> int | None:
    counts = Counter(values)
    if not counts:
        return None
    maximum = max(counts.values())
    modes = tuple((item for (item, count) in sorted(counts.items()) if count == maximum))
    return modes[0] if len(modes) == 1 else None


def outer_ring_values(frame: FrameGrid, box: BoundingBox) -> tuple[int, ...]:
    return tuple((int(frame.rows[row][col]) for row in range(max(0, box.top - 1), min(frame.height - 1, box.bottom + 1) + 1) for col in range(max(0, box.left - 1), min(frame.width - 1, box.right + 1) + 1) if not (box.top <= row <= box.bottom and box.left <= col <= box.right)))


def bounded_valued_support(frame: FrameGrid, box: BoundingBox, substrate: int, *, expand: bool=False) -> tuple[tuple[tuple[int, int, int], ...], BoundingBox | None]:
    absolute_set = {(row, col) for row in range(box.top, box.bottom + 1) for col in range(box.left, box.right + 1) if int(frame.rows[row][col]) != substrate}
    if expand:
        frontier = list(absolute_set)
        while frontier:
            (row, col) = frontier.pop()
            for adjacent in ((row + row_delta, col + col_delta) for row_delta in (-1, 0, 1) for col_delta in (-1, 0, 1) if row_delta or col_delta):
                (adjacent_row, adjacent_col) = adjacent
                if adjacent in absolute_set or not 0 <= adjacent_row < frame.height or (not 0 <= adjacent_col < frame.width) or (int(frame.rows[adjacent_row][adjacent_col]) == substrate):
                    continue
                absolute_set.add(adjacent)
                frontier.append(adjacent)
                if len(absolute_set) > 256:
                    return ((), None)
    absolute = tuple(((row, col, int(frame.rows[row][col])) for (row, col) in sorted(absolute_set)))
    if not absolute:
        return ((), None)
    top = min((row for (row, _col, _pixel) in absolute))
    left = min((col for (_row, col, _pixel) in absolute))
    support_box = BoundingBox(top=top, left=left, bottom=max((row for (row, _col, _pixel) in absolute)), right=max((col for (_row, col, _pixel) in absolute)))
    return (tuple(((row - top, col - left, pixel) for (row, col, pixel) in absolute)), support_box)


def exact_isotropic_reductions(support: tuple[tuple[int, int, int], ...], transparent: object) -> tuple[tuple[int, tuple[tuple[object, ...], ...]], ...]:
    if not support:
        return ()
    height = max((row for (row, _col, _pixel) in support)) + 1
    width = max((col for (_row, col, _pixel) in support)) + 1
    pixels = {(row, col): pixel for (row, col, pixel) in support}
    matrix = tuple((tuple((pixels.get((row, col), transparent) for col in range(width))) for row in range(height)))
    measured: list[tuple[int, tuple[tuple[object, ...], ...]]] = []
    for factor in range(1, min(height, width) + 1):
        if height % factor or width % factor:
            continue
        reduced: list[tuple[object, ...]] = []
        exact = True
        for row in range(0, height, factor):
            reduced_row: list[object] = []
            for col in range(0, width, factor):
                block = {matrix[block_row][block_col] for block_row in range(row, row + factor) for block_col in range(col, col + factor)}
                if len(block) != 1:
                    exact = False
                    break
                reduced_row.append(next(iter(block)))
            if not exact:
                break
            reduced.append(tuple(reduced_row))
        if exact:
            measured.append((factor, tuple(reduced)))
    return tuple(measured)


def measure_anchored_multiscale_shape_gap(value):
    """Measure one peripheral/cell-canvas discrepancy and an unframed peer.

    The singleton marker and palette are compared exactly. A non-marker mask
    must genuinely differ even after quarter turns; no station effect or role
    is inferred. All geometry is bounded and the old exact entry parser shares
    the same support/reduction kernels.
    """
    defaults = {
        "anchored_multiscale_shape_gap_present": False,
        "anchored_multiscale_shape_gap_pair_count": 0,
        "anchored_multiscale_unframed_peer_count": 0,
    }
    frame = value.frame
    transparent = None

    def descriptor(box, substrate, expand=False):
        points, support_box = bounded_valued_support(
            frame, box, substrate, expand=expand)
        if support_box is None or len({pixel for _r, _c, pixel in points}) != 2:
            return None
        reductions = exact_isotropic_reductions(points, transparent)
        if not reductions:
            return None
        factor, pattern = reductions[-1]
        height, width = len(pattern), len(pattern[0])
        if not 2 <= height <= 8 or not 2 <= width <= 8:
            return None
        counts = Counter(pixel for row in pattern for pixel in row if pixel is not None)
        singletons = tuple(pixel for pixel, count in sorted(counts.items()) if count == 1)
        if len(singletons) != 1:
            return None
        marker = singletons[0]
        anchor = next((r, c) for r, row in enumerate(pattern)
                      for c, pixel in enumerate(row) if pixel == marker)
        if 2 * anchor[0] == height - 1 and 2 * anchor[1] == width - 1:
            return None
        return (support_box, factor, pattern, tuple(sorted(counts)), marker, anchor, substrate)

    def key(item):
        box = item[0]
        return (box.top, box.left, box.bottom, box.right)

    def contains(outer, inner):
        return (outer.top <= inner.top <= inner.bottom <= outer.bottom
                and outer.left <= inner.left <= inner.right <= outer.right)

    def canvases(item):
        box, _factor, _pattern, palette, _marker, _anchor, substrate = item
        found = []
        for component in value.components.components:
            outer = component.bbox
            if (component.touches_frame_boundary or component.value != substrate
                    or not contains(outer, box)
                    or outer.height <= box.height or outer.width <= box.width
                    or outer.height * outer.width > 256):
                continue
            if all(frame.rows[r][c] == substrate or (
                box.top <= r <= box.bottom and box.left <= c <= box.right
                and frame.rows[r][c] in palette
            ) for r in range(outer.top, outer.bottom + 1)
                for c in range(outer.left, outer.right + 1)):
                found.append(component)
        return tuple(found)

    tiles, cell_glyphs = {}, {}
    scanned = 0
    for grid in value.periodic_cell_grids.candidates:
        if grid.row_pitch != grid.col_pitch:
            continue
        for cell in grid.cells:
            scanned += 1
            if scanned > 512:
                return defaults, ()
            if cell.pattern_occurrence_count != 1:
                continue
            box = BoundingBox(
                top=grid.row_offset + cell.row * grid.row_pitch,
                left=grid.col_offset + cell.col * grid.col_pitch,
                bottom=grid.row_offset + (cell.row + 1) * grid.row_pitch - 1,
                right=grid.col_offset + (cell.col + 1) * grid.col_pitch - 1)
            if (box.top < 0 or box.left < 0
                    or box.bottom >= frame.height or box.right >= frame.width):
                continue
            tiles[(box.top, box.left, box.bottom, box.right)] = box
            substrate = unique_modal_value(tuple(
                frame.rows[r][c] for r in range(box.top, box.bottom + 1)
                for c in range(box.left, box.right + 1)))
            if substrate is not None:
                item = descriptor(box, substrate)
                if item is not None:
                    cell_glyphs[key(item)] = item
    if not tiles:
        return defaults, ()
    maximum_pitch = max(box.height for box in (tiles[k] for k in sorted(tiles)))
    peripheral = {}
    for component in value.components.components[:128]:
        box = component.bbox
        if box.height * box.width > 256:
            continue
        substrate = unique_modal_value(outer_ring_values(frame, box))
        if substrate is None:
            continue
        item = descriptor(box, substrate, expand=True)
        if item is None or any(contains(tile, item[0]) for tile in (tiles[k] for k in sorted(tiles))):
            continue
        b = item[0]
        if min(b.top, b.left, frame.height - 1 - b.bottom,
               frame.width - 1 - b.right) <= maximum_pitch:
            peripheral[key(item)] = item

    def same_binding(first, second):
        return (len(first[2]) == len(second[2])
                and len(first[2][0]) == len(second[2][0])
                and first[3:6] == second[3:6])

    def mask(pattern, marker):
        return tuple((r, c) for r, row in enumerate(pattern)
                     for c, pixel in enumerate(row) if pixel is not None and pixel != marker)

    def normalized(points):
        if not points:
            return ()
        top, left = min(r for r, _c in points), min(c for _r, c in points)
        return tuple(sorted((r - top, c - left) for r, c in points))

    pairs = []
    for _outer_key, outer in sorted(peripheral.items()):
        for _cell_key, cell in sorted(cell_glyphs.items()):
            backgrounds = canvases(cell)
            if len(backgrounds) != 1 or not same_binding(outer, cell) or outer[1] == cell[1]:
                continue
            points = mask(outer[2], outer[4])
            rotations = set()
            for _turn in range(4):
                rotations.add(normalized(points))
                points = tuple((-c, r) for r, c in points)
            if normalized(mask(cell[2], cell[4])) in rotations:
                continue
            pairs.append((outer, cell, backgrounds[0]))
    defaults["anchored_multiscale_shape_gap_pair_count"] = len(pairs)
    if len(pairs) != 1:
        return defaults, ()
    outer, cell, canvas = pairs[0]
    peers = tuple(item for _item_key, item in sorted(cell_glyphs.items())
                  if not canvases(item) and same_binding(outer, item)
                  and not any(not (item[0].right < b.left or b.right < item[0].left
                      or item[0].bottom < b.top or b.bottom < item[0].top)
                      for b in value.input_aligned_entity_bboxes))
    defaults["anchored_multiscale_unframed_peer_count"] = len(peers)
    if len(peers) != 1:
        return defaults, ()
    peer_domains = tuple(tiles[k] for k in sorted(tiles) if contains(tiles[k], peers[0][0]))
    if not peer_domains:
        return defaults, ()
    return {
        **defaults,
        "anchored_multiscale_shape_gap_present": True,
        "anchored_multiscale_peripheral_bbox": key(outer),
        "anchored_multiscale_peripheral_scale": outer[1],
        "anchored_multiscale_peripheral_pattern": outer[2],
        "anchored_multiscale_cell_bbox": key(cell),
        "anchored_multiscale_cell_scale": cell[1],
        "anchored_multiscale_cell_pattern": cell[2],
        "anchored_multiscale_cell_canvas_ref": canvas.component_id,
        "anchored_multiscale_shared_palette": outer[3],
        "anchored_multiscale_shared_singleton_position": outer[5],
        "anchored_multiscale_unframed_peer_bbox": key(peers[0]),
        "anchored_multiscale_unframed_peer_cell_domains": tuple(
            (b.top, b.left, b.bottom, b.right) for b in peer_domains),
        "anchored_multiscale_measurement_observation_ref": value.current_observation_ref,
        "anchored_multiscale_measurement_frame_ref": value.current_observation_frame_ref,
    }, peer_domains
