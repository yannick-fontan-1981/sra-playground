from collections import Counter
from agents.yf_arc3_v6.morphology_policy.region_intervention.geometry import components,digest

def measured_substrate(rows):
 from agents.yf_arc3_v5.capabilities.contracts import FrameGrid,PeriodicCellGridInput
 from agents.yf_arc3_v5.capabilities.frame import enumerate_periodic_cell_grids
 grids=enumerate_periodic_cell_grids(PeriodicCellGridInput(frame=FrameGrid(rows=tuple(map(tuple,rows)))))
 candidates=[(c.pattern_occurrence_count,tuple(sorted(c.palette_values)))for g in grids.candidates for c in g.cells if c.palette_value_count==2 and c.pattern_occurrence_count>=3]
 if not candidates:return None
 best=max(n for n,p in candidates);pairs={p for n,p in candidates if n==best}
 return set(next(iter(pairs)))if len(pairs)==1 else None

def supported_boundary_ring(rows,ring,background):
 if not ring:return False
 boundary={tuple(p)for c in components(rows)if c['area']>=len(rows)and (c['bbox'][0]==0 or c['bbox'][1]==0 or c['bbox'][2]==len(rows[0])-1 or c['bbox'][3]==len(rows)-1)for p in c['pixels']}
 values=[rows[y][x]for x,y in ring]
 return any(v in background for v in values)and all(rows[y][x]in background or(x,y)in boundary for x,y in ring)

def sample(rows,value):
 ps=[[x,y]for y,row in enumerate(rows)for x,v in enumerate(row)if v==value]
 if not ps:return None
 x=min(p[0]for p in ps);y=min(p[1]for p in ps)
 return {'origin':[x,y],'shape':sorted([[a-x,b-y]for a,b in ps]),'pixels':ps}

def measure(first,frames):
 if len(frames)<3:return None
 hist=Counter(v for row in first for v in row);tracks=[]
 for value,count in hist.items():
  if not 2<=count<=16:continue
  initial=sample(first,value);samples=[sample(f,value)for f in frames]
  if not all(s and s['shape']==initial['shape']for s in samples):continue
  positions=[initial['origin']]+[s['origin']for s in samples];distinct=set(map(tuple,positions))
  if len(distinct)<3:continue
  deltas=[[b[0]-a[0],b[1]-a[1]]for a,b in zip(positions,positions[1:])if a!=b]
  if not deltas or not all((dx==0)!=(dy==0)for dx,dy in deltas):continue
  tracks.append({'value':value,'shape':initial['shape'],'positions':positions,'deltas':deltas,'pixels':[p for s in samples for p in s['pixels']]})
 if len(tracks)!=1:return None
 background=measured_substrate(first)
 if not background:return None
 candidates=[];h=len(first);w=len(first[0]);track=tracks[0]
 for c in components(first):
  if c['value']in background or not 3<=c['area']<=32:continue
  x0,y0,x1,y1=c['bbox'];width=x1-x0+1;height=y1-y0+1
  if max(width,height)>2*min(width,height)or min(x0,y0)<1 or x1>=w-1 or y1>=h-1:continue
  ps=set(map(tuple,c['pixels']));ring={(x+dx,y+dy)for x,y in ps for dx,dy in ((1,0),(-1,0),(0,1),(0,-1))} - ps
  if not supported_boundary_ring(first,ring,background):continue
  if not all(f[y][x]==c['value']for f in frames for x,y in ps):continue
  # The observed moving trace must be distinct from the candidate support.
  if ps.intersection(map(tuple,track['pixels'])):continue
  distance=min((x-a)**2+(y-b)**2 for x,y in ps for a,b in track['pixels'])
  center=min(c['pixels'],key=lambda p:((2*p[0]-x0-x1)**2+(2*p[1]-y0-y1)**2,p))
  candidates.append({**c,'center':center,'distance':distance,'support':[[x,y,first[y][x]]for x,y in sorted(ring)],'ref':'stationary:'+digest(c)})
 if not candidates:return None
 return {'track':track,'candidates':candidates,'frame_count':len(frames),'initial_rows':first,'source_digest':digest(first),'frame_digests':[digest(f)for f in frames],'unknown':['editable_role','terminal_role','trajectory_cause','launch_failure_cause']}

def revalidate(c,rows):
 return all(rows[y][x]==c['value']for x,y in c['pixels'])and all(rows[y][x]==v for x,y,v in c['support'])


def current_occurrence(c,rows):
 old=c['pixels'];x0=min(x for x,y in old);y0=min(y for x,y in old);shape=sorted([x-x0,y-y0]for x,y in old)
 matches=[q for q in components(rows)if q['value']==c['value']and q['area']==c['area']and sorted([x-q['bbox'][0],y-q['bbox'][1]]for x,y in q['pixels'])==shape]
 if len(matches)!=1:return None
 q=matches[0];q['center']=[c['center'][0]+q['bbox'][0]-x0,c['center'][1]+q['bbox'][1]-y0];return q

def composite_and_lateral(m,c,current_rows):
 from agents.yf_arc3_v5.capabilities.contracts import FrameGrid,PeriodicCellGridInput
 from agents.yf_arc3_v5.capabilities.frame import enumerate_periodic_cell_grids
 if any(not revalidate(q,current_rows)for q in m['candidates']if q['ref']!=c['ref']):return None
 first=m['initial_rows'];background=measured_substrate(first)
 if not background:return None
 origin=m['track']['positions'][0];offset=m['track']['shape'][0];seed=[origin[i]+offset[i]for i in (0,1)];body=[list(p)for p in m.get('revalidated_body',[])];q=[]if body else[tuple(seed)];seen=set(q)
 while q:
  x,y=q.pop();body.append([x,y,first[y][x]])
  for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
   a,b=x+dx,y+dy
   if 0<=a<len(first[0])and 0<=b<len(first)and(a,b)not in seen and first[b][a]not in background:seen.add((a,b));q.append((a,b))
 if len(body)>32 or not all(current_rows[y][x]==v for x,y,v in body):return None
 bx=[p[0]for p in body];by=[p[1]for p in body];center=[(min(bx)+max(bx))//2,(min(by)+max(by))//2];origin=m['track']['positions'][0];delta=next((d for d in m['track']['deltas']if d!=[0,0]),None)
 if delta is None:return None
 h=[(v>0)-(v<0)for v in delta];normal=[-h[1],h[0]];positions=[]
 for pos in m['track']['positions']:
  p=[center[i]+pos[i]-origin[i]for i in (0,1)]
  if positions and p!=positions[-1]and sum((p[i]-positions[-1][i])*h[i]for i in (0,1))<=0:break
  if not positions or p!=positions[-1]:positions.append(p)
 if len(positions)<3:return None
 grids=enumerate_periodic_cell_grids(PeriodicCellGridInput(frame=FrameGrid(rows=tuple(map(tuple,first)))))
 periods=sorted({g.row_pitch for g in grids.candidates if g.row_pitch==g.col_pitch and g.row_pitch>1})
 # Require a single visual period also compatible with the observed sampling displacement;
 # this is not a motion quantum or an orbital radius.
 periods=[v for v in periods if abs(delta[0])+abs(delta[1])==v]
 if len(periods)!=1:return None
 pitch=periods[0];anchor=positions[-2];side=sum((c['center'][i]-anchor[i])*normal[i]for i in (0,1));side=(side>0)-(side<0)
 if not side:return None
 target=[anchor[i]+side*pitch*normal[i]for i in (0,1)];dx=target[0]-c['center'][0];dy=target[1]-c['center'][1];mask=[[x+dx,y+dy]for x,y in c['pixels']]
 if any(not(0<=x<len(first[0])and 0<=y<len(first))or current_rows[y][x]not in background for x,y in mask):return None
 if set(map(tuple,mask)).intersection((x,y)for x,y,v in body):return None
 return {'target':target,'body':body,'other_occurrence_pixels':[[x,y,q['value']]for q in m['candidates']if q['ref']!=c['ref']for x,y in q['pixels']],'heading_hypothesis':h,'observed_centers':positions,'visual_period':pitch,'lateral_offset_is_hypothesis':True,'sampling_stride_not_motion_quantum':True,'mask':mask,'grid_calculator':'frame.enumerate_periodic_cell_grids'}
