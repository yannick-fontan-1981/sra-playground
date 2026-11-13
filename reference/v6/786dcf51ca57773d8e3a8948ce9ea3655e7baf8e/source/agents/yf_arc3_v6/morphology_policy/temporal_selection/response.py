from .geometry import components,digest,current_occurrence,measured_substrate,supported_boundary_ring
from agents.yf_arc3_v5.capabilities.station_gated_cargo import _rotate_point

def poses(body,frames):
 cx=(min(x for x,y,v in body)+max(x for x,y,v in body))//2;cy=(min(y for x,y,v in body)+max(y for x,y,v in body))//2
 masks=[[( *_rotate_point((x-cx,y-cy),(0,0),t),v)for x,y,v in body]for t in range(4)];out=[]
 for frame in frames:
  found=[]
  for turn,mask in enumerate(masks):
   minx=min(x for x,y,v in mask);maxx=max(x for x,y,v in mask);miny=min(y for x,y,v in mask);maxy=max(y for x,y,v in mask)
   for y in range(-miny,len(frame)-maxy):
    for x in range(-minx,len(frame[0])-maxx):
     if all(frame[y+dy][x+dx]==v for dx,dy,v in mask):found.append([x,y,turn])
  out.append(found[0]if len(found)==1 else None)
 return out

def observe_deviation(o,frames,refs):
 geometry=o['geometry'];ps=poses(geometry['body'],frames);initial=next((p for p in ps if p),None)
 if initial is None:return None
 changed=[p for p in ps if p and p[2]!=initial[2]]
 if len(changed)<3 or len({p[2]for p in changed})!=1:return None
 heading=_rotate_point(tuple(geometry['heading_hypothesis']),(0,0),(changed[0][2]-initial[2])%4)
 if any((b[0]-a[0])*heading[0]+(b[1]-a[1])*heading[1]<0 for a,b in zip(changed,changed[1:])):return None
 center=geometry['target'];normal=[-heading[1],heading[0]];distance=abs(sum((changed[0][i]-center[i])*normal[i]for i in(0,1)))
 if not distance:return None
 return {'poses':ps,'new_corridor':changed,'new_heading':list(heading),'lateral_distance_observed':distance,'edited_candidate':o['candidate'],'edited_center':center,'body':geometry['body'],'visual_period':geometry['visual_period'],'evidence':refs,'status':'local_deviation_observed_circle_model_only_compatible','unknown':['curve_between_samples','type_law','radius_universality','failure_cause']}

def target_question(response,c,rows,config):
 h=response['new_heading'];axis=0 if h[0] else 1;cross=1-axis;radius=response['lateral_distance_observed'];period=response['visual_period'];line=response['new_corridor'];body=response['body'];first=response['edited_candidate'];fc=response['edited_center'];shift=[fc[i]-first['center'][i]for i in(0,1)];protected=[*body,*[[x+shift[0],y+shift[1],first['value']]for x,y in first['pixels']]]
 if any(rows[y][x]!=v for x,y,v in protected):return None
 cs=components(rows);wall=[q for q in cs if q['bbox'][0]==0 and q['bbox'][1]==0 and q['bbox'][2]==len(rows[0])-1 and q['area']>len(rows)*2]
 if len(wall)!=1:return None
 w=wall[0];floor=measured_substrate(rows)
 if not floor:return None
 gaps=[]
 for q in cs:
  l,t,r,b=q['bbox'];width=r-l+1;height=b-t+1
  if q['area']!=width*height or min(width,height)<2 or max(width,height)>2*min(width,height):continue
  if q['value']==w['value']or q['value']in floor:continue
  bounds=q['bbox'];side=(bounds[axis+2]==w['bbox'][axis+2]and h[axis]<0)or(bounds[axis]==w['bbox'][axis]and h[axis]>0)
  if not side:continue
  lo,hi=bounds[cross],bounds[cross+2];phase=line[0][cross]%period;axes=[v for v in range(lo,hi+1)if v%period==phase]
  for target_axis in axes:
   if abs(target_axis-line[0][cross])!=config['diameter_multiplier']*radius:continue
   gaps.append((q,target_axis))
 if len(gaps)!=1:return None
 gap,target_axis=gaps[0];middle=(target_axis+line[0][cross])//2;choices=[];phase=c['center'][axis]%period
 # Candidate tangent centers lie within the actually observed new corridor.
 lower=min(p[axis]for p in line);upper=max(p[axis]for p in line)
 for along in range(lower,upper+1):
  if along%period!=phase:continue
  center=[0,0];center[axis]=along;center[cross]=middle;dx=center[0]-c['center'][0];dy=center[1]-c['center'][1];mask=[[x+dx,y+dy]for x,y in c['pixels']]
  if any(not(0<=x<len(rows[0])and 0<=y<len(rows))or rows[y][x]not in floor for x,y in mask):continue
  # Conservative square swept envelope around the hypothetical half-turn, all on observed support.
  reach=radius+max(max(abs(x-body[0][0]),abs(y-body[0][1]))for x,y,v in body)
  if any(not(0<=x<len(rows[0])and 0<=y<len(rows))or rows[y][x]not in floor for y in range(center[1]-reach,center[1]+reach+1)for x in range(center[0]-reach,center[0]+reach+1)):continue
  choices.append((sum(abs(center[i]-c['center'][i])for i in(0,1)),center,mask))
 if not choices:return None
 best=min(d for d,p,m in choices);selected=[(p,m)for d,p,m in choices if d==best]
 if len(selected)!=1:return None
 center,mask=selected[0]
 return {'target':center,'body':body,'other_occurrence_pixels':[*protected[len(body):],*[[x,y,gap['value']]for x,y in gap['pixels']]],'heading_hypothesis':h,'observed_centers':[p[:2]for p in line],'visual_period':period,'mask':mask,'candidate_opening':{'bbox':gap['bbox'],'pixels':gap['pixels'],'value':gap['value']},'diameter_model':config['diameter_multiplier'],'candidate_half_turn_not_type_law':True,'target_role_hypothetical':True,'model_alternatives':config['alternatives'],'evidence':response['evidence'],'stage':'second_locus'}


def played_scope_frames(first,frames,candidates):
 # The old arrangement is a public scope anchor, not the new canonical image.
 accepted=[]
 for index,frame in enumerate(frames):
  if all(all(frame[y][x]==v for x,y,v in mask)for mask in candidates):accepted.append((index,frame))
 return accepted

def recall_launch(method,rows):
 body=method['body'];matches=poses(body,[rows])
 if not matches or matches[0]is None:return None
 x,y,turn=matches[0];cx=(min(a for a,b,v in body)+max(a for a,b,v in body))//2;cy=(min(b for a,b,v in body)+max(b for a,b,v in body))//2
 current_body=[[x+dx,y+dy,v]for a,b,v in body for dx,dy in[_rotate_point((a-cx,b-cy),(0,0),turn)]]
 from collections import Counter
 background=measured_substrate(rows)
 if not background:return None
 occupied={(a,b)for a,b,v in current_body};candidates=[]
 for c in components(rows):
  if c['value']in background or not 3<=c['area']<=32 or set(map(tuple,c['pixels']))&occupied:continue
  l,t,r,b=c['bbox']
  if min(l,t)<1 or r>=len(rows[0])-1 or b>=len(rows)-1 or max(r-l+1,b-t+1)>2*min(r-l+1,b-t+1):continue
  ps=set(map(tuple,c['pixels']));ring={(a+dx,b+dy)for a,b in ps for dx,dy in((1,0),(-1,0),(0,1),(0,-1))}-ps
  if supported_boundary_ring(rows,ring,background):candidates.append(c)
 if not candidates:return None
 return {'body':current_body,'center':[x,y],'current_stationary_count':len(candidates),'prior_method':method,'scope_status':'current_geometry_revalidated_effect_in_new_scope_unknown'}
