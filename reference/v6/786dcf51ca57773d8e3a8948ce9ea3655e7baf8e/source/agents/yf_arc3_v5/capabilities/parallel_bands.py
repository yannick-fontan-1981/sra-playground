"""Bounded exact correspondences between filled parallel rectangular bands."""
from agents.yf_arc3_v5.logos.types import FrozenMap


def measure_parallel_solid_bands(components,contract):
    if not contract:return FrozenMap()
    bands=tuple(c for c in components if c.area==c.bbox.width*c.bbox.height
        and min(c.bbox.width,c.bbox.height)<=contract['maximum_thickness']
        and max(c.bbox.width,c.bbox.height)>=contract['minimum_length']
        and max(c.bbox.width,c.bbox.height)>=contract['minimum_axis_ratio']*min(c.bbox.width,c.bbox.height))
    complete=len(bands)<=contract['maximum_bands'] and len(bands)*len(bands)<=contract['maximum_pairs']
    if not complete:return FrozenMap({c.component_id:FrozenMap({'parallel_solid_band_domain_complete':False}) for c in bands})
    rows={}
    for c in bands:
        b=c.bbox;horizontal=b.width>b.height;peers=[]
        for p in bands:
            if p.component_id==c.component_id or p.value!=c.value:continue
            a=p.bbox
            if horizontal:
                same=b.left==a.left and b.right==a.right and b.height==a.height
                gap=max(a.top-b.bottom-1,b.top-a.bottom-1)
                thickness=b.height
            else:
                same=b.top==a.top and b.bottom==a.bottom and b.width==a.width
                gap=max(a.left-b.right-1,b.left-a.right-1)
                thickness=b.width
            if same and contract['minimum_gap']<=gap<=contract['maximum_gap_multiple']*thickness:
                peers.append(p.component_id)
        rows[c.component_id]=FrozenMap({'parallel_solid_band_domain_complete':True,
            'parallel_solid_band_peer_count':len(peers),'parallel_solid_band_peer_refs':tuple(sorted(peers))})
    return FrozenMap(rows)
