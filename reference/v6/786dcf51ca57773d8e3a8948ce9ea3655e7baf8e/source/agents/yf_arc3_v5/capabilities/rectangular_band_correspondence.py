"""Exact rectangular bands, compact signature correspondences and cardinal gaps.

No component is assigned a control, destination or adhesion role here. These
measurements feed the existing Source/DRM one-action hypothesis frontier."""
def measure_rectangular_band_correspondences(request):
    from collections import defaultdict
    frame = (request.current_observed_frame or request.frame).rows
    height, width = len(frame), len(frame[0])
    fields = tuple(c for c in request.components.components
                   if c.bbox.height > 2 and c.bbox.width > 2
                   and 0 < c.bbox.top <= c.bbox.bottom < height - 1
                   and 0 < c.bbox.left <= c.bbox.right < width - 1)
    if len(fields) > 32:
        return ()
    results = []
    for field in fields:
        t, l, b, r = (field.bbox.top, field.bbox.left, field.bbox.bottom, field.bbox.right)
        samples = (
            ('ACTION1', tuple(frame[t - 1][x] for x in range(l, r + 1))),
            ('ACTION2', tuple(frame[b + 1][x] for x in range(l, r + 1))),
            ('ACTION3', tuple(frame[y][l - 1] for y in range(t, b + 1))),
            ('ACTION4', tuple(frame[y][r + 1] for y in range(t, b + 1))),
        )
        if any(len(set(values)) != 1 or values[0] == field.value for _, values in samples):
            continue
        bands = tuple((action, values[0]) for action, values in samples)
        signatures = {value for _, value in bands}
        points = defaultdict(list)
        other = set()
        for y in range(t, b + 1):
            for x in range(l, r + 1):
                value = frame[y][x]
                if value in signatures:
                    points[value].append((y, x))
                if value != field.value:
                    other.add((y, x))
        pairs, covered = [], set()
        for value, pixels in sorted(points.items()):
            mt, ml = min(y for y, _ in pixels), min(x for _, x in pixels)
            mb, mr = max(y for y, _ in pixels), max(x for _, x in pixels)
            if mb - mt != mr - ml or mb == mt:
                break
            footprint = {(y, x) for y in range(mt, mb + 1) for x in range(ml, mr + 1)}
            # A connected field crossing the bounding box is not decoration.
            if not footprint <= other:
                break
            matches = tuple(action for action, signature in bands if signature == value)
            if len(matches) != 1:
                break
            action = matches[0]
            gap = {'ACTION1': mt - t, 'ACTION2': b - mb, 'ACTION3': ml - l, 'ACTION4': r - mr}[action]
            pairs.append({'signature': value, 'box': (mt, ml, mb, mr), 'action': action, 'gap_px': gap})
            covered.update(footprint)
        if len(pairs) != len(points) or not 2 <= len(pairs) <= 16 or covered != other:
            continue
        results.append({'domain': (t, l, b, r), 'pairs': pairs})
    return tuple(results)



def annotate_rectangular_band_correspondences(request, agenda):
    from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
    from .agenda_measurement_transport import append_candidate_measurements
    geometries=measure_rectangular_band_correspondences(request)
    if len(geometries)!=1:
        return agenda
    geometry=geometries[0]
    pairs=geometry['pairs']
    ref='measurement.rectangular_band_correspondence.'+stable_digest((geometry['domain'],tuple(p['signature'] for p in pairs)))[:24]
    current=tuple(p for p in pairs if p['gap_px']==0)
    directions={'ACTION1':(-1,0),'ACTION2':(1,0),'ACTION3':(0,-1),'ACTION4':(0,1)}
    by_ref={}
    for candidate in agenda.candidates:
        if candidate.point is not None or candidate.action_ref not in directions:
            continue
        direction=directions[candidate.action_ref]
        rays=tuple(p for p in pairs if p['action']==candidate.action_ref and p['gap_px']>0)
        away=sum(sum(a*b for a,b in zip(direction,directions[p['action']]))<0 for p in current)
        by_ref[candidate.candidate_ref]=FrozenMap({
            'rectangular_band_measurement_ref':ref,
            'rectangular_band_unique_domain_count':len(geometries),
            'rectangular_band_pair_count':len(pairs),
            'rectangular_band_current_contact_count':len(current),
            'rectangular_band_new_contact_ray_count':len(rays),
            'rectangular_band_away_from_current_contact_count':away,
            'rectangular_band_minimum_gap_px':min((p['gap_px'] for p in rays),default=None),
            'rectangular_band_composition_cardinality':2*len(pairs)+1,
            'rectangular_band_pairs':tuple(FrozenMap(p) for p in pairs),
            'rectangular_band_domain':geometry['domain'],
            'rectangular_band_control_observed_translation_count':request.observed_controlled_translation_count,
        })
    return append_candidate_measurements(agenda,FrozenMap(by_ref),FrozenMap({}))
