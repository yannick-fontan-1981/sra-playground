"""Exact endpoint/centre-mark raster pairs and their current patch deltas."""
import re
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from .remote_connector_loci import measure_remote_connector_loci
from .center_mark_changes import measure_new_center_marks


def _patch(rows, box):
    return tuple(tuple(row[box['left']:box['right']+1])
                 for row in rows[box['top']:box['bottom']+1])


def measure_linked_mark_pair(before, after, components, candidate_ref, contract):
    match=re.search(r':at:r(\d+):c(\d+)$',candidate_ref)
    point=tuple(map(int,match.groups())) if match else None
    marks=measure_new_center_marks(before,after,components)['new_center_mark_candidate_rows']
    bodies={c.component_id:c for c in components}
    rows=[]
    for link in measure_remote_connector_loci(before.rows,components,contract):
        if tuple(link['point'])!=point:
            continue
        for mark in marks:
            box=mark['bbox'];center=((box['top']+box['bottom'])//2,(box['left']+box['right'])//2)
            if tuple(link['peer_point'])!=center:
                continue
            c=bodies[link['component_ref']];b=c.bbox
            window=FrozenMap({'top':max(0,b.top-1),'left':max(0,b.left-1),
                'bottom':min(after.height-1,b.bottom+1),'right':min(after.width-1,b.right+1)})
            old,new=_patch(before.rows,window),_patch(after.rows,window)
            changed=sum(x!=y for a,z in zip(old,new) for x,y in zip(a,z))
            if changed==0:
                continue
            rows.append(FrozenMap({'linked_mark_digest':stable_digest((link,mark,new)),
                'linked_endpoint_population_count':link['endpoint_enclosing_population_count'],
                'linked_peer_population_count':link['peer_enclosing_population_count'],
                'linked_endpoint_bbox':window,'linked_endpoint_after_patch':new,
                'linked_peer_bbox':box,'linked_peer_center':center,
                'linked_peer_marker_value':mark['marker_value'],
                'linked_endpoint_point':point,'linked_endpoint_changed_pixel_count':changed}))
    result={'linked_center_mark_pair_count':len(rows)}
    if len(rows)==1:
        result.update(rows[0])
    return FrozenMap(result)


def measure_linked_mark_recall(frame, records):
    rows=[]
    for record in records:
        box=record.get('endpoint_bbox');old=record.get('endpoint_after_patch')
        center=record.get('peer_center')
        if not box or not old or not center:
            continue
        if not (0<=box['top']<=box['bottom']<frame.height
                and 0<=box['left']<=box['right']<frame.width
                and 0<=center[0]<frame.height and 0<=center[1]<frame.width):
            continue
        new=_patch(frame.rows,box)
        if len(old)!=len(new) or any(len(x)!=len(y) for x,y in zip(old,new)):
            continue
        rows.append(FrozenMap({'linked_recall_term_ref':record['term_ref'],
            'linked_current_peer_center_equals_marker':frame.rows[center[0]][center[1]]==record['peer_marker_value'],
            'linked_current_endpoint_patch_changed_pixel_count':sum(x!=y for a,b in zip(old,new) for x,y in zip(a,b))}))
    result={'linked_mark_recall_count':len(rows)}
    if len(rows)==1:result.update(rows[0])
    return FrozenMap(result)
