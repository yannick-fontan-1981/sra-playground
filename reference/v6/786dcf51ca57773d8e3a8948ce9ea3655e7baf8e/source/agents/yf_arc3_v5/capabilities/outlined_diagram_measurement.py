"""Bounded square-outline incidence measurements, without roles or action choice."""
from collections import Counter, defaultdict
from math import gcd
from functools import lru_cache

from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest, immutable_json_data
from .components import detect_components
from .contracts import ComponentExtractionInput


@lru_cache(maxsize=64)
def measure_outlined_diagrams(frame, reference_bands=()):
    if frame.height * frame.width > 4096:
        return None
    rows = frame.rows
    components = detect_components(ComponentExtractionInput(frame=frame, connectivity=4)).components
    background = Counter(v for row in rows for v in row).most_common(1)[0][0]
    seeds = set()
    for component in components:
        b = component.bbox
        if (3 <= b.height == b.width <= 16 and component.area == 4*b.height-4
                and all(r in (b.top,b.bottom) or c in (b.left,b.right) for r,c in component.pixels)):
            seeds.add((b.height,component.value))
    groups = defaultdict(list)
    for size,ink in sorted(seeds):
        for top in range(frame.height-size+1):
            for left in range(frame.width-size+1):
                bottom,right = top+size-1,left+size-1
                # The corners may carry an independent overlay. All other
                # border pixels must be measured in the same outline value.
                if any(rows[r][c] != ink for r,c in (
                        *((top,c) for c in range(left+1,right)),
                        *((bottom,c) for c in range(left+1,right)),
                        *((r,left) for r in range(top+1,bottom)),
                        *((r,right) for r in range(top+1,bottom)))):
                    continue
                corners = tuple(rows[r][c] for r,c in ((top,left),(top,right),(bottom,left),(bottom,right)))
                if len(set(corners)) != 1:
                    continue
                counts = tuple(sorted(Counter(rows[r][c] for r in range(top+1,bottom)
                    for c in range(left+1,right)).items()))
                groups[(size,ink)].append((top,left,counts,corners[0]))
    diagrams,strata = [],[]
    for (size,ink),boxes in sorted(groups.items()):
        if not 3 <= len(boxes) <= 64:
            continue
        for top in sorted({b[0] for b in boxes}):
            band = tuple(b for b in boxes if b[0]==top)
            if len(band)<3:
                continue
            left,right = min(b[1] for b in band),max(b[1]+size for b in band)
            counts = tuple(sorted(Counter(rows[r][c] for r in range(top+1,top+size-1)
                for c in range(left,right) if rows[r][c] not in (background,ink)).items()))
            strata.append((top,left,right,size,ink,counts))
        edges = []
        for i,a in enumerate(boxes):
            for j,b in enumerate(boxes):
                if j<=i:
                    continue
                y,x,_,_ = a; yy,xx,_,_ = b
                if y==yy and size < xx-x <= 2*size:
                    gap = tuple(rows[y+size//2][c] for c in range(x+size,xx))
                elif x==xx and size < yy-y <= 2*size:
                    gap = tuple(rows[r][x+size//2] for r in range(y+size,yy))
                else:
                    continue
                if gap and background not in gap:
                    edges.append((i,j,tuple(sorted(Counter(gap).items()))))
        if len(edges)<len(boxes)-1:
            continue
        connected = {0}
        for _ in boxes:
            connected.update(j for i,j,_ in edges if i in connected)
            connected.update(i for i,j,_ in edges if j in connected)
        if len(connected)!=len(boxes):
            continue
        pitch = 0
        for i,j,_ in edges:
            pitch = gcd(pitch,abs(boxes[i][0]-boxes[j][0])+abs(boxes[i][1]-boxes[j][1]))
        diagrams.append(FrozenMap({'extent':size,'outline_value':ink,'boxes':tuple(boxes),
            'center_values':tuple(rows[b[0]+size//2][b[1]+size//2] for b in boxes),
            'links':tuple(edges),'pitch':pitch,'measurement_ref':'measurement:outlined-incidence:'+stable_digest((size,ink,boxes,edges))[:20]}))
    detected_keys = {b[:5] for b in strata}
    if len(reference_bands)>16:
        return None
    for top,left,right,size,ink,excluded in reference_bands:
        if (top,left,right,size,ink) in detected_keys:
            continue
        if not (0<=top<top+size<=frame.height and 0<=left<right<=frame.width):
            return None
        counts = tuple(sorted(Counter(rows[r][c] for r in range(top+1,top+size-1)
            for c in range(left,right) if rows[r][c] not in (excluded,ink)).items()))
        strata.append((top,left,right,size,ink,counts))
    if len(diagrams)>3 or len(strata)>16:
        return None
    # Every stratum is returned. Its function and any partition choice are
    # caller declarations, not conclusions of this raster measurement.
    partitions = tuple((band,stable_digest(rows[:band[0]]),tuple(sorted(Counter(
        v for row in rows[:band[0]] for v in row).items()))) for band in strata)
    singleton_counts = tuple(sorted(Counter(c.value for c in components if c.area==1).items()))
    return FrozenMap({'diagrams':tuple(diagrams),'strata':partitions,
        'background_value':background,'singleton_counts':singleton_counts,'frame_digest':stable_digest(rows)})


def annotate_outlined_diagrams(value, agenda):
    records = value.sparse_raster_transitions
    initial = records[0].before_outline_diagram_measurement if records else measure_outlined_diagrams(value.frame)
    current = measure_outlined_diagrams(value.frame, retained_stratum_geometry(initial))
    diagrams = tuple(g for g in initial.get('diagrams',())
        if sum(b[3]!=g['outline_value'] for b in g['boxes'])==1) if initial else ()
    facts = {'outlined_incidence_anchor_variant_count':len(diagrams),
             'diagram_navigation_actual_source_return':False}
    if len(diagrams)==1 and current is not None:
        facts['outlined_incidence_parameter_input'] = immutable_json_data({
            'diagram':diagrams[0],'initial':initial,'current':current,
            'transitions':records,'receipt':value.retained_physical_transition_receipt,
            'interface_deltas':value.interface_action_translation_deltas,
            'epoch':value.current_context_epoch,'level_index':value.observed_level_index,
            'frame_ref':value.current_observation_frame_ref})
    shared = FrozenMap(facts)
    return agenda.model_copy(update={'context_facts':FrozenMap.overlay(shared,agenda.context_facts),
        'alternative_facts':FrozenMap({k:FrozenMap.overlay(shared,f) for k,f in sorted(agenda.alternative_facts.items())}),
        'descriptive_delta_facts':FrozenMap({k:FrozenMap.overlay(shared,f) for k,f in sorted(agenda.descriptive_delta_facts.items())})})


def retained_stratum_geometry(measurement):
    """Previously observed supports, without a persistent role assignment."""
    if not measurement:
        return ()
    return tuple(b[:5]+(measurement['background_value'],) for b,_,_ in measurement['strata'])
