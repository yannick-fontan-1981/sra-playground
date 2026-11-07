"""Bounded raster factorization; no roles, visit meanings, goals or ordering.

Equal rectangular patches carry ordered variable islands. A separate repeated
larger-patch family may carry the same ordered vector at its centers. Border
changes are reported literally; DRM decides whether they mean cumulative visits.
"""
from collections import defaultdict, deque
from functools import lru_cache
from itertools import product


def _border(rows, box):
    top, left, bottom, right = box
    values = {rows[r][c] for r in (top, bottom) for c in range(left, right + 1)}
    values.update(rows[r][c] for r in range(top, bottom + 1) for c in (left, right))
    return next(iter(values)) if len(values) == 1 else None


def _islands(positions):
    remaining = set(positions)
    groups = []
    while remaining:
        origin = min(remaining)
        remaining.remove(origin)
        queue, group = deque((origin,)), [origin]
        while queue:
            r, c = queue.popleft()
            for point in ((r-1,c),(r+1,c),(r,c-1),(r,c+1)):
                if point in remaining:
                    remaining.remove(point)
                    queue.append(point)
                    group.append(point)
        groups.append(tuple(sorted(group)))
    return tuple(groups)


@lru_cache(maxsize=16)
def measure_rectangular_tuple_arrays(rows, boxes, before_rows=None):
    """Return every qualifying factorization, preserving geometric ambiguity.

    Bounds are computational, not game dimensions: <=256 rectangles, <=64
    tuples, 2..4 factors and <=4 values/factor. Incomplete products are refused.
    """
    if not rows or len(boxes) > 256:
        return ()
    groups = defaultdict(list)
    for box in sorted(set(boxes)):
        t,l,b,r = box
        if t < 0 or l < 0 or b >= len(rows) or r >= len(rows[0]):
            continue
        if b-t < 2 or r-l < 2 or _border(rows, box) is None:
            continue
        groups[(b-t+1,r-l+1)].append(box)
    results = []
    for (height,width), raw_boxes in sorted(groups.items()):
        if not 4 <= len(raw_boxes) <= 64:
            continue
        patches = tuple(raw_boxes)
        # Every patch must be disjoint, including its border.
        if any(not (a[2]<b[0] or b[2]<a[0] or a[3]<b[1] or b[3]<a[1])
               for i,a in enumerate(patches) for b in patches[i+1:]):
            continue
        variable = tuple((y,x) for y in range(1,height-1) for x in range(1,width-1)
                         if len({rows[t+y][l+x] for t,l,_,_ in patches}) > 1)
        islands = _islands(variable)
        if not 2 <= len(islands) <= 4:
            continue
        tuples = []
        for t,l,_,_ in patches:
            samples = tuple({rows[t+y][l+x] for y,x in island} for island in islands)
            if any(len(sample) != 1 for sample in samples):
                break
            tuples.append(tuple(next(iter(sample)) for sample in samples))
        if len(tuples) != len(patches) or len(set(tuples)) != len(tuples):
            continue
        domains = tuple(tuple(sorted({row[i] for row in tuples})) for i in range(len(islands)))
        if any(not 2 <= len(domain) <= 4 for domain in domains):
            continue
        if set(product(*domains)) != set(tuples):
            continue
        large_families = []
        for (h,w), family in sorted(groups.items()):
            if h <= height or w <= width or len(family) != len(islands):
                continue
            vector = tuple(rows[(t+b)//2][(l+r)//2] for t,l,b,r in family)
            if vector in tuples:
                large_families.append((tuple(family), vector))
        # Ambiguity is data, not silently settled by relative size or palette.
        for family, vector in large_families:
            borders = tuple(_border(rows, box) for box in patches)
            match_index = tuples.index(vector)
            delta_index, departed_marker, migration, retention = -1,None,False,False
            if (before_rows and len(before_rows)==len(rows)
                    and len(before_rows[0])==len(rows[0])
                    and all(before_rows[t+y][l+x]==row[i]
                            for (t,l,_,_),row in zip(patches,tuples)
                            for i,island in enumerate(islands) for y,x in island)):
                before_vector = tuple(before_rows[(t+b)//2][(l+r)//2] for t,l,b,r in family)
                before_borders = tuple(_border(before_rows, box) for box in patches)
                changed = tuple(i for i,(a,b) in enumerate(zip(before_vector,vector)) if a!=b)
                if before_vector in tuples and len(changed)==1 and None not in before_borders:
                    prior_index = tuples.index(before_vector)
                    marker = before_borders[prior_index]
                    delta_index = changed[0]
                    migration = (before_borders.count(marker)==1 and borders.count(marker)==1
                                 and borders[match_index]==marker and prior_index!=match_index
                                 and borders[prior_index]!=marker)
                    departed_marker = borders[prior_index] if migration else None
                    retention = migration and all(
                        borders[i] in (departed_marker,marker)
                        for i,v in enumerate(before_borders) if v==departed_marker)
            results.append((patches,islands,tuple(tuples),domains,family,vector,borders,
                            match_index,delta_index,departed_marker,migration,retention))
    def encloses(a,b):
        return a[0]<=b[0] and a[1]<=b[1] and a[2]>=b[2] and a[3]>=b[3]
    def same_center(a,b):
        return (a[0]+a[2],a[1]+a[3])==(b[0]+b[2],b[1]+b[3])
    # Nested fill and outline components describe one co-centered raster
    # carrier, not competing arrays. Keep its exact enclosing representation;
    # genuinely different loci/factorizations remain separate witnesses.
    return tuple(row for row in results if not any(
        other is not row and other[2]==row[2] and other[5]==row[5]
        and len(other[0])==len(row[0]) and len(other[4])==len(row[4])
        and all(same_center(a,b) and encloses(a,b) for a,b in zip(other[0],row[0]))
        and all(same_center(a,b) and encloses(a,b) for a,b in zip(other[4],row[4]))
        and (other[0]!=row[0] or other[4]!=row[4]) for other in results))


def tuple_array_point_facts(rows, components, point, before_rows=None):
    boxes = tuple((c.bbox.top,c.bbox.left,c.bbox.bottom,c.bbox.right) for c in components)
    arrays = measure_rectangular_tuple_arrays(rows,boxes,before_rows)
    base = {"rectangular_tuple_array_count":len(arrays)}
    if len(arrays) != 1:
        return base
    patches,islands,tuples,domains,family,vector,borders,current,delta,marker,migration,retention = arrays[0]
    indices = tuple(i for i,(t,l,b,r) in enumerate(family) if t<=point[0]<=b and l<=point[1]<=r)
    base.update({"tuple_array_patch_count":len(patches),
                 "tuple_array_factor_count":len(islands),
                 "tuple_array_large_patch_index_count":len(indices),
                 "tuple_array_single_factor_delta_index":delta,
                 "tuple_array_border_marker_migrated":migration,
                 "tuple_array_border_class_count":len(set(borders)),
                 "tuple_array_departed_border_marker_retained":retention,
                 "tuple_array_vector_row_index":current})
    if len(indices)==1:
        index = indices[0]
        neighbors = tuple(i for i,row in enumerate(tuples) if row[index]!=vector[index]
                          and all(row[j]==vector[j] for j in range(len(vector)) if j!=index))
        base.update({"tuple_array_large_patch_index":index,
                     "tuple_array_factor_alternative_count":len(domains[index])-1,
                     "tuple_array_neighbor_nonmarker_count":sum(borders[i]!=marker for i in neighbors)
                       if marker is not None else len(neighbors)})
    return base
