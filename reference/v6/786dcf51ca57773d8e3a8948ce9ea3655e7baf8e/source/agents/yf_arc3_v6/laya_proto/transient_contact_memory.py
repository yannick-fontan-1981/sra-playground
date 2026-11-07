"""Retain measured public trajectory geometry; relocate only recognized occurrences."""
from agents.yf_arc3_v5.capabilities.contracts import FrameGrid,ComponentExtractionInput,ComponentDescription,BoundingBox
from agents.yf_arc3_v5.capabilities.components import detect_components
from agents.yf_arc3_v5.capabilities.transition import _ballistic_contact_click,measure_scalar_fill_display
from terminal_composition import identity
from math import gcd

def components(rows):return detect_components(ComponentExtractionInput(frame=FrameGrid(rows=tuple(map(tuple,rows))))).components
def center(c):return(c.bbox.top+c.bbox.bottom,c.bbox.left+c.bbox.right)
def signature(c):return identity([c.value,c.relative_pixels])
def acquire(rows,frames,measurement,epoch,evidence,command,retained_models=()):
    if not measurement.get('unique_moving_transient_component_path_present')or not measurement.get('unique_transient_path_curved'):return None
    old={c.component_id:c for c in components(rows)};source=old.get(measurement.get('unique_transient_path_source_component_ref'));peer=old.get(measurement.get('unique_transient_path_source_morphology_peer_ref'))
    peer_binding='current_measured_peer'
    if peer is None:
        signatures={m['peer_signature']for m in retained_models};matches={c.component_id:c for c in old.values()if signature(c)in signatures and(source is None or c.component_id!=source.component_id)}
        if len(matches)==1:peer=next(iter(matches.values()));peer_binding='retained_peer_exactly_revalidated_in_current_frame'
    if source is None or peer is None:return None
    track=[];expected=(measurement['unique_transient_path_start_center_row_twice'],measurement['unique_transient_path_start_center_column_twice'])
    for frame in frames:
        candidates=[c for c in components(frame)if c.value==measurement['unique_transient_path_palette_value']and not c.touches_frame_boundary and 0<c.area<=128]
        if not candidates:break
        distances=[(sum((a-b)**2 for a,b in zip(center(c),expected)),c)for c in candidates];distance=min(d for d,c in distances);nearest=[c for d,c in distances if d==distance]
        if len(nearest)!=1:return None
        chosen=nearest[0]
        if not track and center(chosen)!=expected:return None
        track.append(chosen);expected=center(chosen)
    if len(track)!=measurement['unique_transient_path_frame_count']:return None
    fill=measure_scalar_fill_display(FrameGrid(rows=tuple(map(tuple,rows))))
    aim_delta=[2*command['data']['y']-center(source)[0],2*command['data']['x']-center(source)[1]]
    return {'model_ref':'transient-fit:'+identity([epoch,evidence]),'acquisition_epoch':epoch,'status':'conditional_model','source_signature':signature(source),'peer_signature':signature(peer),'peer_binding':peer_binding,'source_center_twice':center(source),'source_template':source.model_dump(mode='json'),'aim_delta_twice':aim_delta,'track':[c.model_dump(mode='json')for c in track],'fill':fill,'evidence':evidence,'scope':'Measured frame-order curve. Across epochs same recognizable occurrences and displayed parameter support only a falsifiable hypothesis, never inherited action authority.'}
def source_role_probe(model,rows):
    if 'source_template'not in model:return None
    current=components(rows);peers=[c for c in current if signature(c)==model['peer_signature']]
    if len(peers)!=1:return None
    old=ComponentDescription.model_validate(model['source_template']);candidates=[c for c in current if c.component_id!=peers[0].component_id and c.value==old.value and old.area*2<=c.area*3<=old.area*5 and max(c.bbox.width,c.bbox.height)<=max(old.bbox.width,old.bbox.height)*2 and c.area*2>=c.bbox.width*c.bbox.height and not c.touches_frame_boundary]
    if len(candidates)!=1:return None
    source=candidates[0];dy,dx=model['aim_delta_twice'];divisor=gcd(abs(dy),abs(dx))
    if not divisor:return None
    uy,ux=dy//divisor,dx//divisor;origin=center(source);points=[]
    for k in range(1,max(len(rows),len(rows[0]))*2):
        y,x=origin[0]+k*uy,origin[1]+k*ux
        if y%2 or x%2:continue
        if 0<=y//2<len(rows)and 0<=x//2<len(rows[0]):points.append((abs(k-divisor),k,{'x':x//2,'y':y//2}))
    if not points:return None
    return {'point':min(points,key=lambda p:(p[0],p[1]))[2],'source_candidate':source.component_id,'recognized_peer':peers[0].component_id,'source_identity':'unconfirmed_compatible_shape','acquired_model_ref':model['model_ref'],'scope':'Same retained material and compatible compact geometry near an exactly recognized peer suggest a source role only. The next transient origin must confirm or refute this candidate.'}
def calibration(model,rows):
    current=components(rows);sources=[c for c in current if signature(c)==model['source_signature']];peers=[c for c in current if signature(c)==model['peer_signature']]
    if len(sources)!=1 or len(peers)!=1:return None
    point=[a+b for a,b in zip(center(sources[0]),model['aim_delta_twice'])]
    if any(v%2 for v in point):return None
    y,x=(v//2 for v in point)
    return {'x':x,'y':y}if 0<=y<len(rows)and 0<=x<len(rows[y])else None
def project(model,rows):
    frame=FrameGrid(rows=tuple(map(tuple,rows)));current=components(rows);sources=[c for c in current if signature(c)==model['source_signature']];peers=[c for c in current if signature(c)==model['peer_signature']]
    if len(sources)!=1 or len(peers)!=1:return {'status':'unknown','reason':'current_source_peer_not_unique'}
    fill=measure_scalar_fill_display(frame)
    if fill.get('scalar_fill_count')!=model['fill'].get('scalar_fill_count')or not fill.get('scalar_fill_display_present'):return {'status':'unknown','reason':'current_display_parameter_differs'}
    source,peer=sources[0],peers[0];delta=[a-b for a,b in zip(center(source),model['source_center_twice'])]
    if any(v%2 for v in delta):return {'status':'unknown','reason':'nonintegral_retained_support_translation'}
    dy,dx=(v//2 for v in delta);track=[]
    for raw in model['track']:
        c=ComponentDescription.model_validate(raw);track.append(c.model_copy(update={'pixels':tuple((y+dy,x+dx)for y,x in c.pixels),'bbox':BoundingBox(top=c.bbox.top+dy,left=c.bbox.left+dx,bottom=c.bbox.bottom+dy,right=c.bbox.right+dx)}))
    contact,disclosure=_ballistic_contact_click(tuple(track),source,peer,current,frame)
    return {'status':'measured','contact_solution':contact,'curve_disclosure':disclosure,'source_ref':source.component_id,'peer_ref':peer.component_id,'model_ref':model['model_ref'],'acquisition_epoch':model['acquisition_epoch'],'scope':'Old measured curve translated to current recognized source; current terrain and peer recomputed. Model utility and terminal role remain hypotheses.'}
