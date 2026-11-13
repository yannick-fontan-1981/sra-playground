"""Neutral repeated-field, compact-mask and cardinal packet measurements.

No type-to-angle association, curve law, route choice or action authorization.
Unmatched intermediate renderings remain explicitly unresolved samples.
"""
from collections import Counter
from functools import reduce
from math import gcd
from agents.yf_arc3_v5.logos.types import stable_digest
from .components import detect_components
from .contracts import ComponentExtractionInput


def _box(c):
    b=c.bbox
    return (b.top,b.left,b.bottom,b.right)


def _pixels(frame,component):
    b=component.bbox
    return tuple((y,x) for y in range(b.top,b.bottom+1) for x in range(b.left,b.right+1)
        if frame.rows[y][x]==component.value)


def measure_arc_center_field(frame,components,contract):
    if (not contract or frame.height*frame.width>contract['maximum_frame_pixels']
            or len(components)>contract['maximum_components']):return None
    classes={}
    for c in components:
        b=c.bbox
        if b.width==b.height and c.area==b.width*b.height and 1<b.width<=contract['maximum_cell_extent']:
            classes.setdefault((c.value,b.width),[]).append(c)
    repeated=tuple((key,cs) for key,cs in sorted(classes.items()) if len(cs)>=contract['minimum_repeated_cells'])
    if len(repeated)!=1:return None
    (core_value,core),cells=repeated[0]
    ys=tuple(sorted({c.bbox.top for c in cells}));xs=tuple(sorted({c.bbox.left for c in cells}))
    if min(len(ys),len(xs))<3:return None
    py=reduce(gcd,(b-a for a,b in zip(ys,ys[1:])))
    px=reduce(gcd,(b-a for a,b in zip(xs,xs[1:])))
    if not (core<=py<=contract['maximum_cell_extent'] and core<=px<=contract['maximum_cell_extent']):return None
    roots=tuple(c for c in components if c.bbox.top==0 and c.bbox.left==0 and c.bbox.right==frame.width-1
        and c.bbox.height*2>=frame.height and c.area>=contract['minimum_repeated_cells'])
    if len(roots)!=1:return None
    root=roots[0];rb=_box(root)
    fields=tuple(c for c in components if c.value not in (root.value,core_value)
        and c.area>=len(cells) and rb[0]<c.bbox.top<c.bbox.bottom<rb[2]
        and rb[1]<c.bbox.left<c.bbox.right<rb[3])
    if len(fields)!=1:return None
    floor_values=(core_value,fields[0].value)
    markers=tuple(c for c in components if c.area==px*py and c.bbox.width==px and c.bbox.height==py
        and c.value not in (*floor_values,root.value)
        and any((c.bbox.top==rb[0],c.bbox.bottom==rb[2],c.bbox.left==rb[1],c.bbox.right==rb[3])))
    if len(markers)!=1:return None
    marker=markers[0]
    compact=tuple(c for c in components if c.value==marker.value and 2<c.area<marker.area
        and max(c.bbox.width,c.bbox.height)<=contract['maximum_mask_extent']
        and rb[0]<c.bbox.top<=c.bbox.bottom<rb[2] and rb[1]<c.bbox.left<=c.bbox.right<rb[3])
    if len(compact)!=1:return None
    bright=compact[0];b=bright.bbox;occupied=[]
    for y in range(max(rb[0],b.top-1),min(rb[2],b.bottom+1)+1):
        for x in range(max(rb[1],b.left-1),min(rb[3],b.right+1)+1):
            if frame.rows[y][x] not in (*floor_values,root.value):occupied.append((y,x,frame.rows[y][x]))
    if not occupied or len(occupied)>contract['maximum_mask_pixels']:return None
    body_values=tuple(sorted({v for _,_,v in occupied}))
    if len(body_values)!=2:return None
    yy,xx=zip(*((y,x) for y,x,_ in occupied));body=(min(yy),min(xx),max(yy),max(xx))
    center=((body[0]+body[2])//2,(body[1]+body[3])//2)
    shape=tuple((y-center[0],x-center[1],v) for y,x,v in occupied)
    white=tuple((y,x) for y,x,v in occupied if v==marker.value)
    other=tuple((y,x) for y,x,v in occupied if v!=marker.value)
    moments=tuple(sum(p[axis] for p in white)*len(other)-sum(p[axis] for p in other)*len(white) for axis in (0,1))
    nonzero=tuple(i for i,n in enumerate(moments) if n)
    if len(nonzero)!=1:return None
    heading=tuple((1 if moments[i]>0 else -1) if i in nonzero else 0 for i in (0,1))
    posts=[]
    for c in components:
        t,l,v,r=_box(c)
        if c.value in (*floor_values,root.value,*body_values) or not (rb[0]<t<=v<rb[2] and rb[1]<l<=r<rb[3]):continue
        if not (contract['minimum_mask_pixels']<=c.area<=contract['maximum_mask_pixels']
                and max(c.bbox.width,c.bbox.height)<=contract['maximum_mask_extent']):continue
        cy,cx=(t+v)//2,(l+r)//2
        mask=tuple((y-cy,x-cx) for y,x in _pixels(frame,c))
        corners=tuple((p.bbox.top,p.bbox.left) for p in components if p.area==1 and p.value==marker.value
            and abs(p.bbox.top-cy)<=py and abs(p.bbox.left-cx)<=px)
        rows=tuple(sorted({p[0] for p in corners}));cols=tuple(sorted({p[1] for p in corners}))
        enclosure=(len(corners)==4 and len(rows)==len(cols)==2
            and rows[0]+rows[1]==2*cy and cols[0]+cols[1]==2*cx
            and set(corners)=={(y,x) for y in rows for x in cols})
        posts.append({'component_ref':c.component_id,'box':_box(c),'center':(cy,cx),'value':c.value,
            'mask':mask,'shape_token':stable_digest(mask),'four_corner_enclosure':enclosure,
            'row_counts':tuple(sum(y==dy for y,_ in mask) for dy in range(t-cy,v-cy+1))})
    if not contract['minimum_compact_members']<=len(posts)<=contract['maximum_compact_members']:return None
    return {'frame_size':(frame.height,frame.width),'pitch_yx':(py,px),'core_extent':core,
        'center_phase_yx':((ys[0]+core//2)%py,(xs[0]+core//2)%px),
        'field_values':floor_values,'root_box':rb,'root_value':root.value,
        'marker_box':_box(marker),'marker_value':marker.value,'body_box':body,'body_center':center,
        'body_mask':shape,'body_heading_vector':heading,'body_bright_count':len(white),'posts':tuple(posts)}


def measure_cardinal_packet_samples(frames,scene,contract):
    if len(frames)>contract['maximum_packet_frames']:return None
    shape=scene['body_mask'];bright=scene['marker_value'];heading=scene['body_heading_vector']
    templates=[]
    for _ in range(4):
        templates.append((shape,heading))
        shape=tuple((x,-y,v) for y,x,v in shape);heading=(heading[1],-heading[0])
    out=[]
    for index,frame in enumerate(frames):
        if frame.height*frame.width>contract['maximum_frame_pixels']:return None
        components=detect_components(ComponentExtractionInput(frame=frame)).components
        patches=tuple(c for c in components if c.value==bright and c.area==scene['body_bright_count'])
        found=set()
        for c in patches:
            b=c.bbox
            for mask,direction in templates:
                for y in range(b.top-1,b.bottom+2):
                    for x in range(b.left-1,b.right+2):
                        if all(0<=y+dy<frame.height and 0<=x+dx<frame.width
                            and frame.rows[y+dy][x+dx]==v for dy,dx,v in mask):found.add((y,x,*direction))
        out.append({'packet_index':index,'poses_yx_dydx':tuple(sorted(found)),
            'unique_cardinal_match':len(found)==1,'noncardinal_or_occluded_unresolved':len(found)!=1})
    return tuple(out)


def _turn(vector,quarters):
    y,x=vector
    for _ in range(quarters%4):y,x=x,-y
    return (y,x)


def measure_cardinal_turn_relations(scene,samples):
    """Fit only visible cardinal lines and supplied center correspondences.

    A fitted integer radius is a raster-relative candidate, not a recovered
    physical table or subpixel quantizer. Ambiguous correspondences stay open.
    """
    groups=[]
    for row in samples:
        if not row['unique_cardinal_match']:continue
        y,x,dy,dx=row['poses_yx_dydx'][0];direction=(dy,dx)
        if not groups or groups[-1]['direction']!=direction:
            groups.append({'direction':direction,'samples':[]})
        if not groups[-1]['samples'] or groups[-1]['samples'][-1][1:]!=(y,x):
            groups[-1]['samples'].append((row['packet_index'],y,x))
    groups=tuple(g for g in groups if len(g['samples'])>=2)
    relations=[]
    for before,after in zip(groups,groups[1:]):
        u,v=before['direction'],after['direction']
        if u==v:continue
        a,b=before['samples'][0],before['samples'][-1];c=after['samples'][0]
        matches=[]
        for post in scene['posts']:
            py,px=post['center']
            entry=(a[1],px) if u[0]==0 else (py,a[2])
            toward=(py-entry[0],px-entry[1])
            cross=u[1]*toward[0]-u[0]*toward[1]
            radius=abs(cross)
            if radius==0 or sum((entry[i]-a[i+1])*u[i] for i in (0,1))<0:continue
            if sum((entry[i]-b[i+1])*u[i] for i in (0,1))<0:continue
            sign=1 if cross>0 else -1
            for quarters in (1,2,3):
                if _turn(u,sign*quarters)!=v:continue
                offset=_turn((entry[0]-py,entry[1]-px),sign*quarters)
                exit_point=(py+offset[0],px+offset[1])
                if (exit_point[0]!=c[1] if v[0]==0 else exit_point[1]!=c[2]):continue
                if sum((c[i+1]-exit_point[i])*v[i] for i in (0,1))<0:continue
                matches.append({'shape_token':post['shape_token'],'center':post['center'],
                    'incoming_direction':u,'outgoing_direction':v,'entry':entry,'exit':exit_point,
                    'radius_integer_candidate':radius,'radius_twice_interval':(2*radius-1,2*radius+1),
                    'quarter_turns_candidate':quarters,'side_sign':sign,
                    'before_packet_index':b[0],'after_packet_index':c[0],
                    'fine_quantization_acquired':False})
        if len(matches)==1:relations.append(matches[0])
    return tuple(relations)
