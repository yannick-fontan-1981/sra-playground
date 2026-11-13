"""Exact bounded enclosed lattices, scale correspondences and external cells.

These are display measurements. SRC/DRM owns reference/control suppositions,
identity, the selected question, local law hypotheses and action release.
"""
from collections import Counter, defaultdict

from ..logos.types import stable_digest
from .banded_framed_measurements import measure_framed_patterns
from .components import detect_components
from .contracts import ComponentExtractionInput, FrameGrid
from .tile_lattice import exact_joint_tile_lattices, minimum_collinear_axis_pitches


def box_inside(inner, outer):
    return outer[0] <= inner[0] <= inner[2] <= outer[2] and outer[1] <= inner[1] <= inner[3] <= outer[3]


def cell_measurement(frame, top, left, height, width):
    bottom, right = top + height - 1, left + width - 1
    edge = {frame.rows[r][c] for r in range(top, bottom + 1) for c in range(left, right + 1)
            if r in (top, bottom) or c in (left, right)}
    if len(edge) != 1:
        return None
    base, = edge
    inner = tuple((r-top, c-left, frame.rows[r][c])
                  for r in range(top+1, bottom) for c in range(left+1, right)
                  if frame.rows[r][c] != base)
    return {'box': (top, left, bottom, right), 'base_value': base,
            'interior_differences': inner,
            'point': ((top+bottom)//2, (left+right)//2)}


def measure_enclosed_lattice_correspondences(frame, contract):
    if frame.height * frame.width > contract['maximum_frame_pixels']:
        return (), (), False
    components = detect_components(ComponentExtractionInput(frame=frame, connectivity=4)).components
    if len(components) > contract['maximum_component_count']:
        return (), (), False
    families = measure_framed_patterns(frame, components,
        maximum_frames=contract['maximum_frames'], minimum_family_count=1)
    if any(not f['domain_complete'] for f in families):
        return (), (), False
    frames = tuple(row for family in families for row in family['frames'])
    if len(frames) > contract['maximum_frames']:
        return (), (), False
    lattices = []
    for row in frames:
        top, left, bottom, right = row['box']
        crop = FrameGrid(rows=tuple(tuple(line[left+1:right]) for line in frame.rows[top+1:bottom]))
        if crop.height < 3 or crop.width < 3:
            continue
        for ro, co, height, width in exact_joint_tile_lattices(crop, maximum_pitch=contract['maximum_pitch']):
            if ro or co or crop.height % height or crop.width % width:
                continue
            if crop.height // height * (crop.width // width) > contract['maximum_cells']:
                return (), (), False
            cells = []
            for r in range(crop.height//height):
                for c in range(crop.width//width):
                    item = cell_measurement(frame, top+1+r*height, left+1+c*width, height, width)
                    if item is None:
                        break
                    cells.append({**item, 'row': r, 'column': c})
            if len(cells) == crop.height//height*(crop.width//width):
                lattices.append({'box': row['box'], 'height': crop.height//height,
                    'width': crop.width//width, 'cell_height': height, 'cell_width': width,
                    'cells': tuple(cells)})
    correspondences = []
    for lattice in lattices:
        for other_enclosure in frames:
            if other_enclosure['box'] == lattice['box'] or box_inside(other_enclosure['box'], lattice['box']):
                continue
            t,l,b,r = other_enclosure['box']
            if (b-t-1)*(r-l-1) > contract['maximum_population']:
                continue
            pattern = tuple(tuple(line[l+1:r]) for line in frame.rows[t+1:b])
            variants = {pattern}
            if 'count_matched_values' in contract.get('miniature_sample_modes', ()):
                # Exact cardinality correspondence, not a palette/background
                # decision. Only overrepresented values may be masked: absent
                # or missing counterparts must not be silently erased.
                small_counts = Counter(v for line in pattern for v in line)
                large_counts = Counter(cell['base_value'] for cell in lattice['cells'])
                if all(large_counts[value] >= count for value, count in sorted(small_counts.items())):
                    variants.add(tuple(tuple(value if large_counts[value] == small_counts[value] else None
                                             for value in line) for line in pattern))
            for sample in sorted(variants, key=stable_digest):
                counts = Counter(v for line in sample for v in line if v is not None)
                if not counts:
                    continue
                population = tuple(cell for cell in lattice['cells'] if cell['base_value'] in counts)
                if Counter(v['base_value'] for v in population) != counts:
                    continue
                token = stable_digest((lattice['box'], lattice['cell_height'], lattice['cell_width'], other_enclosure['box'], sample))
                correspondences.append({**lattice, 'small_box': other_enclosure['box'], 'small_pattern': sample,
                    'population': population, 'geometry_token': token})
    if len(correspondences) > contract['maximum_correspondences']:
        return (), (), False
    return tuple(correspondences), components, True


def measure_external_cell_groups(frame, components, excluded_boxes, contract):
    by_extent = defaultdict(dict)
    for component in components:
        b=component.bbox
        if b.height<3 or b.width<3 or max(b.height,b.width)>contract['maximum_pitch']:
            continue
        box=(b.top,b.left,b.bottom,b.right)
        if any(box_inside(box, outer) for outer in excluded_boxes):
            continue
        item=cell_measurement(frame,b.top,b.left,b.height,b.width)
        if item is not None:
            by_extent[b.height,b.width][b.top,b.left]=item
    groups=[]
    for (height,width),cells in sorted(by_extent.items()):
        rp,cp=minimum_collinear_axis_pitches(tuple(cells))
        if not (height<rp<=contract['maximum_pitch'] and width<cp<=contract['maximum_pitch']):
            continue
        remaining=set(cells)
        while remaining:
            seed=min(remaining);remaining.remove(seed);connected={seed};pending=[seed]
            while pending:
                r,c=pending.pop()
                for point in ((r-rp,c),(r+rp,c),(r,c-cp),(r,c+cp)):
                    if point in remaining:
                        remaining.remove(point);connected.add(point);pending.append(point)
            rows=sorted({r for r,c in connected});cols=sorted({c for r,c in connected})
            if len(rows)<2 or len(cols)<2 or len(connected)!=len(rows)*len(cols):
                continue
            if any(b-a!=rp for a,b in zip(rows,rows[1:])) or any(b-a!=cp for a,b in zip(cols,cols[1:])):
                continue
            entries=tuple({**cells[r,c],'row_index':ri,'column_index':ci}
                          for ri,r in enumerate(rows)for ci,c in enumerate(cols))
            groups.append({'box':(rows[0],cols[0],rows[-1]+height-1,cols[-1]+width-1),
                'height':len(rows),'width':len(cols),'row_pitch':rp,'column_pitch':cp,
                'cell_height':height,'cell_width':width,'cells':entries})
            if len(groups)>contract['maximum_external_groups']:
                return (),False
    return tuple(sorted(groups,key=lambda x:x['box'])),True
