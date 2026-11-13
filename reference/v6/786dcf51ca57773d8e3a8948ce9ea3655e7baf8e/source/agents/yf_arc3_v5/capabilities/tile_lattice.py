"""Exact raster geometry of repeated inset or edge-adjacent rectangles.

No palette value is a role. A lattice is a measurement, not traversability.
"""

from collections import defaultdict
from math import gcd

from .components import detect_components
from .contracts import ComponentExtractionInput, FrameGrid


def minimum_collinear_axis_pitches(points) -> tuple[int, int]:
    """Return the exact least positive row/column gaps, or zero if absent.

    Within each line the smallest pair distance occurs between neighbors.
    Sorting twice therefore preserves the exhaustive pair minimum without
    constructing its quadratic set of unused larger distances.
    """
    ordered = sorted(points)

    def minimum_gap(entries):
        return min((right[1] - left[1]
                    for left, right in zip(entries, entries[1:])
                    if left[0] == right[0] and right[1] > left[1]), default=0)

    return minimum_gap(sorted((column, row) for row, column in ordered)), minimum_gap(ordered)


def exact_joint_tile_lattices(
    frame: FrameGrid, *, maximum_pitch: int,
) -> tuple[tuple[int, int, int, int], ...]:
    """Measure zero-gap cells from equal full rectangles of several values.

    No individual value defines the lattice: adjacent rectangles of different
    values expose its boundaries. Keep the existing nine-witness, two-axis,
    half-occupied lattice contract. A border, gap or stagger is not a joint.
    """
    groups: dict[tuple[int, int], dict[tuple[int, int], int]] = defaultdict(dict)
    for component in detect_components(ComponentExtractionInput(frame=frame)).components:
        box = component.bbox
        if (2 <= box.height <= maximum_pitch and 2 <= box.width <= maximum_pitch
                and component.area == box.height * box.width):
            groups[(box.height, box.width)][(box.top, box.left)] = component.value
    geometries: set[tuple[int, int, int, int]] = set()
    for (height, width), positions in sorted(groups.items()):
        if len(positions) < 9 or len(set(positions.values())) < 2:
            continue
        rows = sorted({row for row, _ in positions})
        columns = sorted({col for _, col in positions})
        if len(rows) < 3 or len(columns) < 3:
            continue
        if (gcd(*(b - a for a, b in zip(rows, rows[1:]))) != height
                or gcd(*(b - a for a, b in zip(columns, columns[1:]))) != width):
            continue
        capacity = (1 + (rows[-1] - rows[0]) // height) * (
            1 + (columns[-1] - columns[0]) // width
        )
        if len(positions) * 2 < capacity:
            continue
        if not all(any((row + dy, col + dx) in positions for row, col in positions)
                   for dy, dx in ((height, 0), (0, width))):
            continue
        geometries.add((rows[0] % height, columns[0] % width, height, width))
    return tuple(sorted(geometries)) if len(geometries) <= 3 else ()


def exact_bordered_tile_lattices(
    frame: FrameGrid, *, maximum_pitch: int,
) -> tuple[tuple[int, int, int, int], ...]:
    """Return (row offset, column offset, height, width), at most three.

    Reuse the regular multicell lattice contract: nine complete witnesses,
    three rows/columns and at least half of the bounded lattice occupied.
    Every witness is an exact uniform rectangle with a uniform surrounding
    inset. Offsets describe full tiles, including the top/left half-open border.
    Staggered textures, isolated bodies and one-axis indicators do not qualify.
    Ambiguous geometries stay alternatives; more than three fails closed.
    """
    groups: dict[tuple[int, int, int, int], set[tuple[int, int]]] = defaultdict(set)
    for component in detect_components(ComponentExtractionInput(frame=frame)).components:
        box = component.bbox
        if (box.height < 2 or box.width < 2 or
            box.height >= maximum_pitch or box.width >= maximum_pitch or
            component.area != box.height * box.width or
            box.top < 1 or box.left < 1 or
            box.bottom >= frame.height - 1 or box.right >= frame.width - 1):
            continue
        border = (
            {frame.rows[box.top - 1][x] for x in range(box.left, box.right + 1)}
            | {frame.rows[box.bottom + 1][x] for x in range(box.left, box.right + 1)}
            | {frame.rows[y][box.left - 1] for y in range(box.top, box.bottom + 1)}
            | {frame.rows[y][box.right + 1] for y in range(box.top, box.bottom + 1)}
        )
        if len(border) == 1:
            groups[(box.height, box.width, component.value, next(iter(border)))].add(
                (box.top, box.left)
            )
    geometries: set[tuple[int, int, int, int]] = set()
    for (height, width, _interior, border), positions in sorted(groups.items()):
        if len(positions) < 9:
            continue
        rows = sorted({row for row, _ in positions})
        columns = sorted({col for _, col in positions})
        if len(rows) < 3 or len(columns) < 3:
            continue
        row_pitch = gcd(*(b - a for a, b in zip(rows, rows[1:])))
        col_pitch = gcd(*(b - a for a, b in zip(columns, columns[1:])))
        if not (height < row_pitch <= maximum_pitch and width < col_pitch <= maximum_pitch):
            continue
        capacity = (1 + (rows[-1] - rows[0]) // row_pitch) * (
            1 + (columns[-1] - columns[0]) // col_pitch
        )
        if len(positions) * 2 < capacity:
            continue
        top_inset = (row_pitch - height + 1) // 2
        left_inset = (col_pitch - width + 1) // 2
        # Every reconstructed full tile must actually have this uniform inset;
        # equal center spacing alone is insufficient evidence of a tile.
        complete = True
        for row, col in sorted(positions):
            top, left = row - top_inset, col - left_inset
            if top < 0 or left < 0 or top + row_pitch > frame.height or left + col_pitch > frame.width:
                complete = False
                break
            if any(
                frame.rows[y][x] != border
                for y in range(top, top + row_pitch)
                for x in range(left, left + col_pitch)
                if not (row <= y < row + height and col <= x < col + width)
            ):
                complete = False
                break
        if complete:
            geometries.add(((rows[0] - top_inset) % row_pitch,
                            (columns[0] - left_inset) % col_pitch,
                            row_pitch, col_pitch))
    return tuple(sorted(geometries)) if len(geometries) <= 3 else ()


def exact_full_tile_domains(
    frame: FrameGrid, *, maximum_pitch: int,
) -> tuple[tuple[int, int, int, int, int, int, str], ...]:
    """Measure enclosed full-cell partitions independently of a moving sprite.

    Every pixel of the enclosing component must tile into complete rectangles.
    Nine identical multivalue cells with a uniform perimeter must also occur
    on at least three rows and columns inside that same domain. Sparse motifs
    are admissible because the exact enclosing support independently constrains
    their boundaries: motif density and cursor centering are not premises.
    Keep every compatible enclosure/partition, without size or palette ranking.
    """
    from collections import Counter

    components = detect_components(ComponentExtractionInput(frame=frame)).components
    domains = set()
    for component in components:
        box = component.bbox
        if not all(frame.rows[row][col] == component.value
                   for row, col in (
                       *((box.top, col) for col in range(box.left, box.right + 1)),
                       *((box.bottom, col) for col in range(box.left, box.right + 1)),
                       *((row, box.left) for row in range(box.top, box.bottom + 1)),
                       *((row, box.right) for row in range(box.top, box.bottom + 1)),
                   )):
            continue
        heights = tuple(h for h in range(2, maximum_pitch + 1)
                        if box.height >= 3*h and box.height % h == 0)
        widths = tuple(w for w in range(2, maximum_pitch + 1)
                       if box.width >= 3*w and box.width % w == 0)
        for height in heights:
            for width in widths:
                support_counts = Counter(((row-box.top)//height, (col-box.left)//width)
                                         for row, col in component.pixels)
                if any(count != height*width for count in sorted(support_counts.values())):
                    continue
                patterns = defaultdict(set)
                for row in range(box.top, box.bottom+1, height):
                    for col in range(box.left, box.right+1, width):
                        pattern = tuple(line[col:col+width] for line in frame.rows[row:row+height])
                        patterns[pattern].add((row, col))
                witnessed = False
                for pattern, positions in sorted(patterns.items()):
                    if (len(positions) < 9 or len({r for r, _ in positions}) < 3
                            or len({c for _, c in positions}) < 3
                            or len({pixel for line in pattern for pixel in line}) < 2):
                        continue
                    border = set(pattern[0]) | set(pattern[-1]) | {line[0] for line in pattern} | {line[-1] for line in pattern}
                    if len(border) == 1:
                        witnessed = True
                if witnessed:
                    domains.add((box.top, box.left, height, width,
                                 box.height//height, box.width//width, component.component_id))
    return tuple(sorted(domains))
