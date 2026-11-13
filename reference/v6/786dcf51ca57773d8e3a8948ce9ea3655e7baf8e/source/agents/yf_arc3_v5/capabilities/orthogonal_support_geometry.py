"""Exact grid/support homology; no roles or action selection."""
from collections import defaultdict
from agents.yf_arc3_v5.logos.types import stable_digest

from agents.yf_arc3_v5.capabilities.components import detect_components
from agents.yf_arc3_v5.capabilities.contracts import ComponentExtractionInput


def measure_orthogonal_support_geometry(value):
    frame = value.current_observed_frame or value.frame
    if frame.height * frame.width > 4096:
        return ()
    components = detect_components(ComponentExtractionInput(frame=frame)).components
    if len(components) > 256:
        return ()
    interface_inputs = {ref for ref, _, _ in value.interface_action_translation_deltas}
    shifts = tuple(m for row in value.sparse_raster_transitions
                   if row.action_ref in interface_inputs
                   for m in row.small_component_translations
                   if m[-1] == 1 and bool(m[5]) != bool(m[6]))
    pitches = sorted({abs(m[5] or m[6]) for m in shifts if abs(m[5] or m[6]) > 1})
    squares = defaultdict(set)
    for component in components:
        b = component.bbox
        if b.height == b.width and b.height > 1 and component.area == b.height * b.width:
            squares[b.height].add((b.top,b.left))
    # A retained parameter model supplies a query family, never coordinates.
    # With no current motion yet, enumerate pitches from current repeated
    # squares and retain only complete current homologous-panel witnesses.
    recalled_query = bool(getattr(value, 'canonical_prefix_mechanism_memory_facts', ())) and not shifts
    if recalled_query:
        pitches = sorted({abs(a-b) for members in squares.values()
            for r,c in members for y,x in members
            for a,b in ((r,y),) if c == x and a != b} |
            {abs(a-b) for members in squares.values()
             for r,c in members for y,x in members
             for a,b in ((c,x),) if r == y and a != b})
    # A retained geometric census survives later connected material. These
    # positions seed topology only; current fill/occupancy is never restored.
    if value.sparse_raster_transitions:
        for top,left,extent,_,_ in value.sparse_raster_transitions[0].before_uniform_square_patches or ():
            squares[extent].add((top,left))
    descriptions = []
    for extent, members in sorted(squares.items()):
        for pitch in pitches:
            if pitch <= extent:
                continue
            groups = defaultdict(list)
            for top,left in sorted(members):
                groups[(top % pitch, left % pitch)].append((top,left))
            for _, items in sorted(groups.items()):
                measured_rows = {r for r,_ in items}
                measured_columns = {c for _,c in items}
                rr, cc = items[0][0] % pitch, items[0][1] % pitch
                for m in shifts:
                    for r, c in ((m[1],m[2]),):
                        r0, c0 = r-(extent-1)//2, c-(extent-1)//2
                        if r0 % pitch == rr and c0 % pitch == cc:
                            measured_rows.add(r0); measured_columns.add(c0)
                rows, columns = tuple(sorted(measured_rows)), tuple(sorted(measured_columns))
                if (min(len(rows), len(columns)) < 2 or len(rows) * len(columns) > 128
                        or any(b-a != pitch for a, b in zip(rows, rows[1:]))
                        or any(b-a != pitch for a, b in zip(columns, columns[1:]))):
                    continue
                centers = {(r + (extent-1)//2, c + (extent-1)//2)
                           for r in rows for c in columns}
                if not recalled_query and not any((m[1], m[2]) in centers
                           and (m[1]+m[5], m[2]+m[6]) in centers for m in shifts):
                    continue
                top, left, bottom, right = rows[0], columns[0], rows[-1]+extent-1, columns[-1]+extent-1
                row_centers = tuple(r+(extent-1)//2 for r in rows)
                col_centers = tuple(c+(extent-1)//2 for c in columns)
                row_origins, col_origins = defaultdict(set), defaultdict(set)
                # Historical outlined interiors retain geometric origins when
                # current color bands connect a button to the grid. Every
                # candidate box is still sampled uniformly in the current frame.
                for record in value.sparse_raster_transitions:
                    for y,x,outer,_,_,_ in (*tuple(record.before_square_contours or ()),
                            *tuple(record.after_square_contours or ())):
                        size = outer-2
                        if not 1 < size < extent:
                            continue
                        cy,cx = y+(outer-1)//2,x+(outer-1)//2
                        if x+outer-1 < left and cy in row_centers:
                            row_origins[size].add(x+1)
                        if y+outer-1 < top and cx in col_centers:
                            col_origins[size].add(y+1)
                for component in components:
                    b = component.bbox
                    if component.area != b.height*b.width:
                        continue
                    if (1 < b.height < extent and b.height <= b.width <= extent
                            and b.right < left and (b.top+b.bottom)/2 in row_centers):
                        row_origins[b.height].add(b.left)
                    if (1 < b.width < extent and b.width <= b.height <= extent
                            and b.bottom < top and (b.left+b.right)/2 in col_centers):
                        col_origins[b.width].add(b.top)

                def uniform(r, c, h, w):
                    if r < 0 or c < 0 or r+h > frame.height or c+w > frame.width:
                        return None
                    vals = {frame.rows[y][x] for y in range(r, r+h) for x in range(c, c+w)}
                    return next(iter(vals)) if len(vals) == 1 else None

                for size in sorted(row_origins.keys() & col_origins.keys()):
                    xs, ys = tuple(sorted(row_origins[size])), tuple(sorted(col_origins[size]))
                    if not 2 <= len(xs) == len(ys) <= 16:
                        continue
                    row_boxes, col_boxes = [], []
                    for i, r in enumerate(row_centers):
                        for x in xs:
                            y = r-(size-1)//2
                            v = uniform(y, x, size, size)
                            if v is not None:
                                row_boxes.append((i, y, x, size, v))
                    for i, c in enumerate(col_centers):
                        for y in ys:
                            x = c-(size-1)//2
                            v = uniform(y, x, size, size)
                            if v is not None:
                                col_boxes.append((i, y, x, size, v))
                    if len(row_boxes) != len(rows)*len(xs) or len(col_boxes) != len(columns)*len(ys):
                        continue
                    palette = {b[-1] for b in row_boxes}
                    if palette != {b[-1] for b in col_boxes}:
                        continue
                    points = {(r, c) for r in range(frame.height) for c in range(frame.width)
                              if frame.rows[r][c] in palette}
                    panels = []
                    while points:
                        first = min(points)
                        points.remove(first)
                        pending = [first]
                        connected = set(pending)
                        while pending:
                            r, c = pending.pop()
                            for p in ((r-1,c), (r+1,c), (r,c-1), (r,c+1)):
                                if p in points:
                                    points.remove(p); connected.add(p); pending.append(p)
                        r0, c0 = min(r for r,c in connected), min(c for r,c in connected)
                        h, w = max(r for r,c in connected)-r0+1, max(c for r,c in connected)-c0+1
                        if (len(connected) != h*w or h % len(rows) or w % len(columns)
                                or h//len(rows) != w//len(columns)
                                or len({frame.rows[r][c] for r,c in connected}) < 2
                                or not (r0+h <= top or r0 > bottom or c0+w <= left or c0 > right)):
                            continue
                        k = h//len(rows)
                        vals = tuple(tuple(uniform(r0+i*k,c0+j*k,k,k)
                                           for j in range(len(columns))) for i in range(len(rows)))
                        if all(v is not None for row in vals for v in row):
                            panels.append((r0,c0,k,vals))
                    contours = []
                    for component in components:
                        b = component.bbox
                        if (b.height != extent or b.width != extent
                                or any(r not in (b.top,b.bottom) and c not in (b.left,b.right)
                                       for r,c in component.pixels)):
                            continue
                        center = ((b.top+b.bottom)//2,(b.left+b.right)//2)
                        for axis, boxes in (('row',row_boxes),('column',col_boxes)):
                            for index,y,x,s,v in boxes:
                                if center == (y+(s-1)//2,x+(s-1)//2):
                                    contours.append((axis,index,y,x,s,component.value))
                    subgrids = tuple({
                        'rows':tuple(y+i*k for i in range(len(rows))),
                        'columns':tuple(x+j*k for j in range(len(columns))),
                        'extent':k, 'values':values,
                        # logical row/column, miniature box, main-grid box, value.
                        'cell_correspondences':tuple((i,j,y+i*k,x+j*k,k,
                            rows[i],columns[j],extent,values[i][j])
                            for i in range(len(rows)) for j in range(len(columns)))
                    } for y,x,k,values in panels) if len(panels) <= 3 else ()
                    if recalled_query and len(subgrids) != 1:
                        continue
                    descriptions.append({'rows':rows,'columns':columns,'extent':extent,'pitch':pitch,
                        'frame_digest':stable_digest(frame.rows),
                        'cell_center_values':tuple(tuple(frame.rows[r][c] for c in col_centers) for r in row_centers),
                        'row_boundary_adjacent_values':tuple(frame.rows[r][left-1] for r in row_centers),
                        'column_boundary_adjacent_values':tuple(frame.rows[top-1][c] for c in col_centers),
                        'row_support_boxes':tuple(row_boxes),'column_support_boxes':tuple(col_boxes),
                        'homologous_colored_rectangles':tuple(panels),'outline_support_intersections':tuple(contours),
                        'homologous_raster_subgrids':subgrids,
                        'homologous_raster_subgrids_complete':len(panels) <= 3,
                        'singleton_positions':tuple((c.bbox.top,c.bbox.left,c.value)
                            for c in components if c.area == 1)})
                    if len(descriptions) > 3:
                        return ()
    return tuple(descriptions)
