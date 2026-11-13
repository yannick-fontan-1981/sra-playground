"""Dated growing pixel fronts, separate from the canonical return image."""
from collections import Counter,defaultdict
from math import atan2,cos,sin,hypot
from geometric_observer import components
from agents.yf_arc3_v6.morphology_policy.guarded_binding.geometry import revalidate_frame
from terminal_composition import identity

def frame_support(rows):
    candidates=[]
    for p in components(rows):
        l,t,r,b=p['bbox'];w,h=r-l+1,b-t+1
        if min(w,h)<8 or p['area']<2*w+2*h-4:continue
        frame={'bbox':p['bbox'],'corner_value':p['color'],'palette_value':p['color']}
        if revalidate_frame(frame,rows):candidates.append(p)
    if not candidates:return None
    area=lambda p:(p['bbox'][2]-p['bbox'][0])*(p['bbox'][3]-p['bbox'][1]);largest=max(map(area,candidates));best=[p for p in candidates if area(p)==largest]
    return best[0]['bbox']if len(best)==1 else None

def line_fit(points):
    if len(points)<2:return None
    mx=sum(x for x,y in points)/len(points);my=sum(y for x,y in points)/len(points)
    xx=sum((x-mx)**2 for x,y in points);yy=sum((y-my)**2 for x,y in points);xy=sum((x-mx)*(y-my)for x,y in points)
    theta=atan2(2*xy,xx-yy)/2;vx,vy=cos(theta),sin(theta)
    transverse=max(abs((x-mx)*vy-(y-my)*vx)for x,y in points)
    along=[(x-mx)*vx+(y-my)*vy for x,y in points]
    if transverse>1.0 or max(along)-min(along)<1:return None
    return {'center':[mx,my],'axis':[vx,vy],'transverse_error_pixels':transverse,'extent':max(along)-min(along)}

def measure_packet(before,frames,*,observation_ref,action_ref):
    bounds=frame_support(before)
    if bounds is None:return {'status':'unknown','reason':'unique_frame_support_not_measured'}
    l,t,r,b=bounds;area=(r-l-1)*(b-t-1);previous=before;events=[];runs=[];active=None
    for tick,frame in enumerate(frames):
        if len(frame)!=len(before)or any(len(a)!=len(c)for a,c in zip(frame,before)):return {'status':'unknown','reason':'packet_dimensions_changed'}
        bycolor=defaultdict(list)
        for y in range(t+1,b):
            for x in range(l+1,r):
                if frame[y][x]!=previous[y][x]:bycolor[frame[y][x]].append((x,y))
        count=sum(map(len,bycolor.values()));event={'frame_index':tick,'changed_pixels':count,'frame_digest':identity(frame),'fronts':[]}
        if count>area/4:
            event['kind']='broad_field_change';active=None
        else:
            for value,pts in bycolor.items():
                fit=line_fit(pts)
                if not fit:continue
                event['fronts'].append({'value':value,'count':len(pts),**fit})
                if active and active['value']==value:
                    merged=active['points']+pts;whole=line_fit(merged)
                    if whole:
                        dx=fit['center'][0]-active['last_center'][0];dy=fit['center'][1]-active['last_center'][1]
                        if hypot(dx,dy)>0:
                            active['points']=merged;active['last_center']=fit['center'];active['end_frame']=tick;active['fit']=whole;continue
                active={'value':value,'points':list(pts),'first_center':fit['center'],'last_center':fit['center'],'start_frame':tick,'end_frame':tick,'fit':fit};runs.append(active)
            if count and not event['fronts']:active=None
        events.append(event);previous=frame
    measured=[]
    for run in runs:
        if run['end_frame']<=run['start_frame']:continue
        dx=run['last_center'][0]-run['first_center'][0];dy=run['last_center'][1]-run['first_center'][1];norm=hypot(dx,dy)
        if norm<2:continue
        vx,vy=run['fit']['axis']
        if vx*dx+vy*dy<0:vx,vy=-vx,-vy
        measured.append({'value':run['value'],'start_frame':run['start_frame'],'end_frame':run['end_frame'],'first_center':run['first_center'],'last_center':run['last_center'],'direction':[vx,vy],'extent':run['fit']['extent'],'transverse_error_pixels':run['fit']['transverse_error_pixels'],'support_digest':identity(sorted(run['points']))})
    return {'status':'measured'if measured else'unknown','observation_ref':observation_ref,'action_ref':action_ref,'bounds':bounds,'frame_count':len(frames),'canonical_equal_initial':bool(frames and frames[-1]==before),'events':events,'segments':measured,'scope':'Dated collinear growing fronts only. No reflection/reemission, receiver identity, control law or reset semantics is inferred from returning to the initial image.'}
