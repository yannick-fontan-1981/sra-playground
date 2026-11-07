"""Measured thin-path endpoints across a complete occluding partition.

All endpoint supports remain alternatives. No control, receiver or wire role
is assigned, and no direction or click is selected here.
"""
from itertools import combinations
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest
from agents.yf_arc3_v5.capabilities.components import detect_components
from agents.yf_arc3_v5.capabilities.contracts import ComponentExtractionInput,FrameGrid


def _inside(box, point):
    return box.top < point[0] < box.bottom and box.left < point[1] < box.right


def measure_remote_connector_loci(frame, components, contract):
    minimum = int(contract.get('minimum_path_pixels',0))
    thickness = int(contract.get('maximum_path_thickness',0))
    gap = int(contract.get('maximum_partition_gap',0))
    maximum = int(contract.get('maximum_loci',0))
    area_bound = int(contract.get('maximum_compact_area',0))
    if min(minimum,thickness,gap,maximum,area_bound) <= 0:
        return ()
    compact = tuple(p for p in components
        if min(p.bbox.height,p.bbox.width) >= 3 and p.area <= area_bound
        and 2*p.area >= p.bbox.height*p.bbox.width and not p.touches_frame_boundary)
    enclosures=[];paths=[]
    for p in components:
        b=p.bbox
        perimeter=frozenset((r,c) for r in range(b.height) for c in range(b.width)
                            if r in (0,b.height-1) or c in (0,b.width-1))
        if min(b.height,b.width)>=3 and frozenset(p.relative_pixels)==perimeter:
            population=sum(_inside(b,((q.bbox.top+q.bbox.bottom)//2,
                                     (q.bbox.left+q.bbox.right)//2)) for q in compact)
            enclosures.append((p,population))
    path_components=detect_components(ComponentExtractionInput(
        frame=FrameGrid(rows=frame),connectivity=int(contract['path_connectivity']))).components
    for p in path_components:
        b=p.bbox
        if p.area<minimum or min(b.height,b.width)>thickness:
            continue
        for axis in (0,1):
            points=tuple(sorted(p.pixels,key=lambda q:(q[axis],q[1-axis])))
            if len({q[axis] for q in points}) != len(points):
                continue
            steps=tuple((q[axis]-v[axis],q[1-axis]-v[1-axis]) for v,q in zip(points,points[1:]))
            if (not steps or any(a!=1 or abs(d)>1 for a,d in steps)
                    or not (all(d>=0 for _,d in steps) or all(d<=0 for _,d in steps))):
                continue
            paths.append((p,axis,points))
    rows=[]
    for first,second in combinations(paths,2):
        a,axis,ap=first;b,other_axis,bp=second
        if axis!=other_axis or a.value!=b.value:
            continue
        if ap[0][axis]>bp[0][axis]:
            a,b,ap,bp=b,a,bp,ap
        end,start=ap[-1],bp[0];distance=start[axis]-end[axis]
        if distance<2 or distance>gap or abs(start[1-axis]-end[1-axis])>1:
            continue
        occluded=tuple(range(end[axis]+1,start[axis]))
        if any(not (len(set(frame[i]))==1 if axis==0
                    else len({row[i] for row in frame})==1) for i in occluded):
            continue
        endpoints=(ap[0],bp[-1]);groups=[]
        for point in endpoints:
            groups.append(tuple(q for q in compact if any(
                max(abs(r-point[0]),abs(c-point[1]))<=1 for r,c in q.pixels)))
        for left in groups[0]:
            for right in groups[1]:
                if left.component_id==right.component_id:
                    continue
                for candidate,peer in ((left,right),(right,left)):
                    point=((candidate.bbox.top+candidate.bbox.bottom)//2,
                           (candidate.bbox.left+candidate.bbox.right)//2)
                    peer_point=((peer.bbox.top+peer.bbox.bottom)//2,
                                (peer.bbox.left+peer.bbox.right)//2)
                    enclosing=sum(_inside(e.bbox,point) and population>=int(
                        contract['minimum_enclosed_compact_supports']) for e,population in enclosures)
                    peer_enclosing=sum(_inside(e.bbox,peer_point) and population>=int(
                        contract['minimum_enclosed_compact_supports']) for e,population in enclosures)
                    token=stable_digest((a.component_id,b.component_id,candidate.component_id,
                                         peer.component_id,endpoints))[:16]
                    rows.append(FrozenMap({'connector_geometry_token':token,
                        'component_ref':candidate.component_id,'peer_component_ref':peer.component_id,
                        'point':point,'peer_point':peer_point,'connector_partition_gap':distance,
                        'endpoint_enclosing_population_count':enclosing,
                        'peer_enclosing_population_count':peer_enclosing,
                        'connector_component_refs':(a.component_id,b.component_id)}))
                    if len(rows)>maximum:
                        return ()
    return tuple(rows)
