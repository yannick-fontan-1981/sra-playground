"""Bounded point-cap/host/side incidences, without control or terrain roles."""
from collections import defaultdict
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


def measure_point_cap_insets(frame, components, contract):
    maximum_span = int(contract.get('maximum_span', 0))
    maximum_work = int(contract.get('maximum_work', 0))
    maximum_loci = int(contract.get('maximum_loci', 0))
    maximum_components = int(contract.get('maximum_components', 0))
    maximum_frame_pixels = int(contract.get('maximum_frame_pixels', 0))
    if min(maximum_span,maximum_work,maximum_loci,maximum_components,maximum_frame_pixels) <= 0:
        return (),False,0
    if len(components)>maximum_components or frame.height*frame.width>maximum_frame_pixels:
        return (),False,0
    rows = frame.rows
    by_pixel = {}
    work = 0
    for component in components:
        for pixel in component.pixels:
            work += 1
            if work>maximum_work:
                return (),False,work
            if not (0<=pixel[0]<frame.height and 0<=pixel[1]<frame.width):
                return (),False,work
            by_pixel[pixel] = component
    if len(by_pixel)!=frame.height*frame.width:
        return (),False,work
    groups = defaultdict(list)
    for component in components:
        if component.area == 1:
            point = component.pixels[0]
            for axis in (0,1):
                groups[(component.value,axis,point[1-axis])].append(point)
    measured = []
    for (cap_value,axis,fixed),points in sorted(groups.items()):
        points = tuple(sorted(points))
        for first_index,first in enumerate(points):
            for second in points[first_index+1:]:
                work += 1
                if work>maximum_work:
                    return (),False,work
                span = second[axis]-first[axis]
                if not 2<=span<=maximum_span:
                    continue
                def point(i,side=0):
                    return (i,fixed+side) if axis==0 else (fixed+side,i)
                before,after = point(first[axis]-1),point(second[axis]+1)
                if any(not(0<=r<frame.height and 0<=c<frame.width) for r,c in (before,after)):
                    continue
                host = by_pixel[before]
                if by_pixel[after].component_id!=host.component_id or host.value==cap_value:
                    continue
                middle = tuple(point(i) for i in range(first[axis]+1,second[axis]))
                sides = tuple(point(i,side) for i in range(first[axis]+1,second[axis]) for side in (-1,1))
                work += len(middle)+len(sides)
                if work>maximum_work:
                    return (),False,work
                if any(not(0<=r<frame.height and 0<=c<frame.width) for r,c in sides):
                    continue
                interior_values = frozenset(rows[r][c] for r,c in middle)
                side_values = frozenset(rows[r][c] for r,c in sides)
                if len(side_values)!=1 or host.value in interior_values:
                    continue
                side_value = next(iter(side_values))
                if side_value in interior_values or side_value in (cap_value,host.value):
                    continue
                center = point((first[axis]+second[axis])//2)
                transverse = (point(center[axis],-1),point(center[axis],1))
                side_refs = tuple(by_pixel[p].component_id for p in transverse)
                token = stable_digest((first,second,cap_value,host.value,tuple(sorted(interior_values)),side_value))
                measured.append(FrozenMap({'point':center,'geometry_token':token,'axis':axis,
                    'cap_points':(first,second),'cap_value':cap_value,'host_value':host.value,
                    'host_component_ref':host.component_id,'component_ref':by_pixel[center].component_id,
                    'interior_values':tuple(sorted(interior_values)),'side_value':side_value,
                    'side_component_refs':side_refs,'distinct_side_component_count':len(frozenset(side_refs))}))
                if len(measured)>maximum_loci:
                    return (),False,work
    return tuple(measured),True,work
