"""Bounded exact valued-mask poses in a raster; no role or pose selection."""
from types import SimpleNamespace
from agents.yf_arc3_v5.capabilities.contracts import BoundingBox
from agents.yf_arc3_v5.logos.types import stable_digest


def measure_exact_valued_mask_poses(*, frame, signature, quarter_turns, maximum_pixels, maximum_matches):
    if not frame or not frame[0] or len(frame)*len(frame[0])>maximum_pixels or not signature:
        return ()
    if len(signature)>maximum_pixels or len({(r,c) for r,c,v in signature})!=len(signature):
        return ()
    def normalized(points):
        top,left=min(r for r,c,v in points),min(c for r,c,v in points)
        return tuple(sorted((r-top,c-left,v) for r,c,v in points))
    poses=set()
    for turns in quarter_turns:
        if type(turns) is not int or not 0<=turns<=3:
            raise ValueError('quarter-turn measurement domain is invalid')
        points=tuple(signature)
        for _ in range(turns):points=tuple((-c,r,v) for r,c,v in points)
        poses.add(normalized(points))
    found={}
    for pose in sorted(poses):
        height,width=max(r for r,c,v in pose)+1,max(c for r,c,v in pose)+1
        if height*width>maximum_pixels:return ()
        values=frozenset(v for r,c,v in pose)
        occupied=frozenset((r,c) for r,c,v in pose)
        missing=tuple((r,c) for r in range(height) for c in range(width) if (r,c) not in occupied)
        for top in range(len(frame)-height+1):
            for left in range(len(frame[0])-width+1):
                if not all(frame[top+r][left+c]==v for r,c,v in pose):continue
                if any(frame[top+r][left+c] in values for r,c in missing):continue
                pixels=tuple((top+r,left+c) for r,c,v in pose)
                key=(top,left,pose)
                found[key]=SimpleNamespace(component_id='support.valued_pose.'+stable_digest(key),
                    bbox=BoundingBox(top=top,left=left,bottom=top+height-1,right=left+width-1),
                    pixels=pixels,area=len(pixels),value=next(iter(values)) if len(values)==1 else None,
                    valued_pixels=tuple((top+r,left+c,v) for r,c,v in pose))
                if len(found)>maximum_matches:
                    raise ValueError('valued-mask measurement match bound exceeded')
    return tuple(found[key] for key in sorted(found))
