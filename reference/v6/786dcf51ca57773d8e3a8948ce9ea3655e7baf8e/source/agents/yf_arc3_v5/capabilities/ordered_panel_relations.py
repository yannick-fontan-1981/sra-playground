"""Bounded panel geometry and finite raster relations; no roles or ranking.

The caller supplies relation families and bounds from DRM. Every option and
every fitted relation remains represented; this module never selects an action.
"""
from collections import defaultdict

from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


def _turn(raster, turns):
    for _ in range(turns):
        raster = tuple(tuple(row) for row in zip(*raster[::-1]))
    return raster


def measure_ordered_panel_relations(frame, components, contract):
    maximum = int(contract.get('maximum_panels', 0))
    minimum = int(contract.get('minimum_indexed_slots', 0))
    maximum_area = int(contract.get('maximum_panel_area', 0))
    families = tuple(contract.get('relation_families', ()))
    if maximum <= 0 or minimum < 3 or maximum_area <= 0 or not families:
        return ()
    groups = defaultdict(list)
    for component in components:
        box = component.bbox
        h, w = box.height, box.width
        if min(h, w) < 3 or h*w > maximum_area or component.touches_frame_boundary:
            continue
        perimeter = frozenset((r,c) for r in range(h) for c in range(w)
                              if r in (0,h-1) or c in (0,w-1))
        if frozenset(component.relative_pixels) != perimeter:
            continue
        raster = tuple(tuple(frame[r][box.left+1:box.right])
                       for r in range(box.top+1, box.bottom))
        pixels = frozenset(v for row in raster for v in row)
        groups[(box.top,h,w)].append((component, raster, pixels))
        if sum(len(groups[key]) for key in sorted(groups)) > maximum:
            return ()
    groups = {k:tuple(sorted(v,key=lambda x:x[0].bbox.left)) for k,v in sorted(groups.items())}
    indexed = []
    for geometry, panels in sorted(groups.items()):
        if len(panels) < minimum:
            continue
        positions = tuple(p[0].bbox.left for p in panels)
        deltas = tuple(b-a for a,b in zip(positions,positions[1:]))
        if not deltas or len(set(deltas)) != 1 or deltas[0] <= geometry[2]:
            continue
        empty = tuple(i for i,p in enumerate(panels) if len(p[2]) == 1)
        if len(empty) != 1:
            continue
        index = empty[0]
        background = min(panels[index][2])
        visible = tuple((i,p[1]) for i,p in enumerate(panels) if i != index)
        if any(not any(v != background for row in raster for v in row) for _,raster in visible):
            continue
        values = tuple(p[0].value for p in panels)
        indexed.append((geometry,panels,index,background,visible,
                        len(set(values[:index]+values[index+1:])) == 1
                        and values[index] not in values[:index]+values[index+1:]))
    if not indexed:
        return ()
    bottom = max(g[0][0]+g[0][1]-1 for g in indexed)
    outputs = []
    for geometry,panels,index,background,visible,distinct in indexed:
        observed = dict(visible)
        fit_rows = []
        for family in families:
            operation = family.get('operation')
            if operation in ('raster_period', 'raster_period_with_partial_phase_support'):
                for period in range(1,len(panels)):
                    classes = tuple(tuple(r for i,r in visible if i%period == residue)
                                    for residue in range(period))
                    if any(len(group) < int(family['minimum_observations_per_class'])
                           or any(r != group[0] for r in group) for group in classes):
                        continue
                    if operation == 'raster_period_with_partial_phase_support':
                        repeated_minimum = int(family['minimum_observations_per_repeated_class'])
                        repeated = sum(len(group) >= repeated_minimum for group in classes)
                        partial = sum(len(group) < repeated_minimum for group in classes)
                        if (repeated < int(family['minimum_repeated_classes'])
                                or not 0 < partial <= int(family['maximum_partially_observed_classes'])):
                            continue
                    fit_rows.append((family['relation_ref'],period,classes[index%period][0],None))
            elif operation == 'raster_quarter_turn':
                for turns in family['quarter_turns']:
                    pairs = tuple((i,j) for i in sorted(observed) for j in sorted(observed) if j == i+1)
                    if len(pairs) < int(family['minimum_compared_transitions']):
                        continue
                    if any(_turn(observed[i],turns) != observed[j] for i,j in pairs):
                        continue
                    predicted = tuple(_turn(r,(turns*(index-i))%4) for i,r in visible)
                    if all(r == predicted[0] for r in predicted):
                        fit_rows.append((family['relation_ref'],turns,predicted[0],None))
            elif operation == 'increasing_support_count':
                counts = {i:sum(v != background for row in r for v in row) for i,r in visible}
                supports = {i:frozenset((y,x,r[y][x]) for y in range(len(r))
                            for x in range(len(r[0])) if r[y][x] != background) for i,r in visible}
                first,last = min(counts),max(counts)
                difference = counts[last]-counts[first]
                span = last-first
                if span <= 0 or difference <= 0 or difference%span:
                    continue
                delta = difference//span
                if any(counts[i] != counts[first]+delta*(i-first) for i in sorted(counts)):
                    continue
                if any(not supports[i] <= supports[j] for i in sorted(supports) for j in sorted(supports) if i<j):
                    continue
                if len(supports) < int(family['minimum_observations']):
                    continue
                fit_rows.append((family['relation_ref'],delta,None,
                                 (counts[first]+delta*(index-first),supports,index)))
        if not fit_rows:
            continue
        for other_geometry,options in sorted(groups.items()):
            if (other_geometry[0] <= bottom or other_geometry[1:] != geometry[1:]
                    or len(options) < int(contract['minimum_comparison_panels'])
                    or any(len(p[2]) == 1 for p in options)):
                continue
            comparisons = []
            for component,raster,_ in options:
                support = frozenset((y,x,raster[y][x]) for y in range(len(raster))
                                    for x in range(len(raster[0])) if raster[y][x] != background)
                matches = []
                for _,_,predicted,quantity in fit_rows:
                    if predicted is not None:
                        matches.append(raster == predicted)
                    else:
                        count,supports,missing = quantity
                        matches.append(len(support) == count and all(
                            s <= support if rank<missing else support <= s
                            for rank,s in sorted(supports.items())))
                comparisons.append((component,raster,tuple(matches)))
            agreement_count = sum(all(m) for _,_,m in comparisons)
            token = stable_digest((geometry,other_geometry,index,tuple(visible),
                                   tuple((ref,param) for ref,param,_,_ in fit_rows)))[:16]
            for component,raster,matches in comparisons:
                outputs.append(FrozenMap({
                    'geometry_token':token,'component_ref':component.component_id,
                    'point':((component.bbox.top+component.bbox.bottom)//2,
                             (component.bbox.left+component.bbox.right)//2),
                    'indexed_panel_count':len(panels),'observed_index_count':len(visible),
                    'missing_index':index,'distinct_empty_border':distinct,
                    'distinct_empty_border_row_count':sum(row[5] for row in indexed),
                    'fitted_relation_count':len(fit_rows),'all_relation_comparisons_agree':all(matches),
                    'agreement_panel_count':agreement_count,
                    'relation_parameter_rows':tuple((ref,param) for ref,param,_,_ in fit_rows),
                    'panel_content_digest':stable_digest(raster)[:16],
                    'frame_geometry_digest':stable_digest((geometry,other_geometry))[:16],
                }))
                if len(outputs) > maximum:
                    return ()  # Keep ambiguity; never truncate option/model bindings.
    return tuple(outputs)
