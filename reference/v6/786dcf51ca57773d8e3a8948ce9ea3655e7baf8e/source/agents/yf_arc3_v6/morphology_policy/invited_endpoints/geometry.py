from collections import Counter,deque
from hashlib import sha256
import json
from agents.yf_arc3_v5.capabilities.contracts import FrameGrid,PeriodicCellGridInput
from agents.yf_arc3_v5.capabilities.frame import enumerate_periodic_cell_grids
from agents.yf_arc3_v5.capabilities.endpoint_navigation_d import LandingNodeD,LandingRelationModelD,_relation

def digest(v):return sha256(json.dumps(v,sort_keys=True).encode()).hexdigest()
def tile(rows,b):return [list(r[b[0]:b[2]+1])for r in rows[b[1]:b[3]+1]]
def shape(t,value):return [(x,y)for y,r in enumerate(t)for x,v in enumerate(r)if v==value]
def hollow(points):
 if not points:return False
 x0=min(x for x,y in points);x1=max(x for x,y in points);y0=min(y for x,y in points);y1=max(y for x,y in points)
 return x1-x0>=2 and y1-y0>=2 and set(points)=={(x,y)for y in range(y0,y1+1)for x in range(x0,x1+1)if x in(x0,x1)or y in(y0,y1)}
def measure(rows,body_context=None):
 if not rows or len({rows[y][x]for x,y in[(0,0),(len(rows[0])-1,0),(0,len(rows)-1),(len(rows[0])-1,len(rows)-1)]})!=1:return None
 bg=rows[0][0];answers=[]
 for g in enumerate_periodic_cell_grids(PeriodicCellGridInput(frame=FrameGrid(rows=tuple(map(tuple,rows))))).candidates:
  if g.cell_width!=g.cell_height or g.col_pitch!=g.row_pitch or g.cell_width<3:continue
  cells=[]
  for c in g.cells:
   b=[c.bbox.left,c.bbox.top,c.bbox.right,c.bbox.bottom];t=tile(rows,b);cnt=Counter(v for r in t for v in r);cells.append({'bbox':b,'point':[b[0]+g.cell_width//2,b[1]+g.cell_height//2],'tile':t,'values':dict(cnt),'uniform':next(iter(cnt))if len(cnt)==1 else None,'ref':str(len(cells))})
  for goal in cells:
   for ink in goal['values']:
    if ink==bg or not hollow(shape(goal['tile'],ink)):continue
    actors=[]
    for c in cells:
     pts=shape(c['tile'],ink)
     retained=bool(body_context and c['point']==body_context['point']and g.cell_width==body_context['size']and g.col_pitch==body_context['pitch']and ink==body_context['ink']and c['tile']==body_context['expected_tile'])
     if retained:pts=[tuple(p)for p in body_context['actor_mask']]
     if (len(c['values'])!=2 and not retained)or len(pts)<5 or hollow(pts):continue
     bx,by=c['bbox'][:2]
     if any(0<=bx+x+dx<len(rows[0]) and 0<=by+y+dy<len(rows) and not(0<=x+dx<g.cell_width and 0<=y+dy<g.cell_height) and rows[by+y+dy][bx+x+dx]==ink for x,y in pts for dx,dy in[(0,1),(0,-1),(1,0),(-1,0)]):continue
     if max(x for x,y in pts)-min(x for x,y in pts)>=g.cell_width-1 or max(y for x,y in pts)-min(y for x,y in pts)>=g.cell_height-1:continue
     floor=body_context['floor']if retained else next(v for v in c['values']if v!=ink)
     if floor==bg:continue
     actors.append((c,floor))
    if len(actors)!=1:continue
    actor,floor=actors[0]
    solids=Counter(c['uniform']for c in cells if c['uniform']not in(None,bg,floor))
    for invitation,count in solids.items():
     invited=[c for c in cells if c['uniform']==invitation]
     offsets=[]
     for c in invited:
      dx=c['point'][0]-actor['point'][0];dy=c['point'][1]-actor['point'][1]
      if dx%g.col_pitch or dy%g.row_pitch:break
      offsets.append((dx//g.col_pitch,dy//g.row_pitch))
     else:
      metrics={tuple(sorted(map(abs,d)))for d in offsets}
      if len(metrics)!=1 or not offsets or 0 in next(iter(metrics)):continue
      invited=[c for c in cells if all(v==invitation for v in c['tile'][0]+[r[0]for r in c['tile']])]
      passable=[c for c in cells if floor in c['values']or c in invited or c is goal]
      if goal not in passable:continue
      for c in passable:c['coord']=[(c['point'][0]-actor['point'][0])//g.col_pitch,(c['point'][1]-actor['point'][1])//g.row_pitch]
      answers.append({'grid_ref':g.candidate_ref,'pitch':g.col_pitch,'size':g.cell_width,'actor':actor,'goal':goal,'ink':ink,'floor':floor,'background':bg,'invitation':invitation,'invited':invited,'cells':passable,'all_cells':cells,'offsets':offsets,'metric':list(next(iter(metrics)))})
 return answers[0]if len(answers)==1 else None

def obligations(m,configuration):
 if configuration.get('goal_badge_hypothesis')!='visit_all_current_homologues_before_framed_candidate':return None
 badge=set(m['goal']['values'])-{m['floor'],m['ink']}
 # The frame's outside color is a background, not an interior obligation.
 t=m['goal']['tile'];pts=shape(t,m['ink']);x0=min(x for x,y in pts);x1=max(x for x,y in pts);y0=min(y for x,y in pts);y1=max(y for x,y in pts)
 interior={t[y][x]for y in range(y0+1,y1)for x in range(x0+1,x1)}
 badge=interior-{m['floor'],m['background'],m['ink']}
 if not badge:return {'cells':[],'status':'no_current_badge'}
 if len(badge)!=1:return None
 value=next(iter(badge));matches=[c for c in m['cells']if c is not m['goal']and c is not m['actor']and value in c['values']and c['uniform']is None]
 if not matches:return None
 masks={digest(shape(c['tile'],value))for c in matches}
 if len(masks)!=1:return None
 return {'cells':matches,'status':'hypothetical_collective_dependency','badge_value':value,'witness_mask':shape(matches[0]['tile'],value),'unknown':['visit_credit','persistence','necessity','frame_admission_after_visits']}

def route(m,configuration,required_override=None,goal_override=None,source_override=None,check_first_admission=True):
 if configuration['offset_hypothesis']!='signed_axis_permutations_of_current_invitation_metric':raise ValueError('missing symmetry authority')
 required=required_override if required_override is not None else obligations(m,configuration)
 if required is None:return None
 a,b=m['metric'];offsets=sorted({(sx*x,sy*y)for x,y in[(a,b),(b,a)]for sx in(-1,1)for sy in(-1,1)})
 model=LandingRelationModelD(model_ref='hypothesis.current_invitation_orbit',control_side='SOURCE',relation='FINITE_OFFSET',offsets=tuple(offsets))
 nodes={c['ref']:LandingNodeD(node_ref='cell.'+c['ref'],point=tuple(c['coord']))for c in m['cells']};lookup={c['ref']:c for c in m['cells']};start=(source_override or m['actor'])['ref'];goal=(goal_override or m['goal'])['ref'];invited={c['ref']for c in m['invited']};required_refs={c['ref']for c in required['cells']};q=deque([(start,frozenset(),[])]);seen={(start,frozenset())};edges={r:[other for other in nodes if _relation(model,nodes[r],nodes[other],{},(),offsets)[0]]for r in nodes}
 while q:
  r,visited,path=q.popleft()
  if r==goal and required_refs<=visited:return {'cells':[lookup[v]for v in path],'model':model.model_dump(mode='json'),'hypothesis':True,'obligations':required,'expanded_states':len(seen)}
  if len(seen)>configuration['joint_search_bound']:return None
  for other in edges[r]:
   if check_first_admission and not path and other not in invited:continue
   reached=visited|({other}if other in required_refs else set())
   if other==goal and not required_refs<=reached:continue
   key=(other,frozenset(reached))
   if key in seen:continue
   seen.add(key);q.append((other,frozenset(reached),path+[other]))
 return None

def reconfiguration_routes(m,configuration):
 if configuration.get('blocked_frontier_question')!='shared_marker_between_excluded_region_and_accessible_support':return []
 required=obligations(m,configuration)
 if required is None:return []
 excluded=[];base={m['floor'],m['ink'],m['background'],m['invitation']};groups={}
 x0=min(c['bbox'][0]for c in m['cells']);x1=max(c['bbox'][2]for c in m['cells']);y0=min(c['bbox'][1]for c in m['cells']);y1=max(c['bbox'][3]for c in m['cells'])
 for c in m['all_cells']:
  if c in m['cells']or c['uniform']is not None or not(x0<=c['bbox'][0]<=x1 and y0<=c['bbox'][1]<=y1):continue
  dominant=max(c['values'],key=c['values'].get)
  if dominant in base:continue
  groups.setdefault((dominant,digest(c['tile'])),[]).append(c)
 found=[]
 for (dominant,_),blocked in groups.items():
  if len(blocked)<2:continue
  rails=[c for c in m['cells']if c['uniform']is None and c not in(required['cells']+[m['actor'],m['goal']])and len(set(c['values'])-base)==1]
  rail_values={next(iter(set(c['values'])-base))for c in rails}
  controls=[c for c in m['cells']if dominant in c['values']and any(v in c['values']and v!=dominant for v in rail_values)]
  if not controls:continue
  expanded={**m,'cells':m['cells']+[{**c,'coord':[(c['point'][i]-m['actor']['point'][i])//m['pitch']for i in range(2)]}for c in blocked]}
  possible=route(expanded,configuration)
  if possible is None:continue
  for control in controls:
   access=route(m,configuration,{'cells':[],'status':'local_context_question'},control)
   if not access or not access['cells']:continue
   witness={'target':control,'blocked':blocked,'accessible_markers':[c for c in rails if next(iter(set(c['values'])-base))in control['values']],'parent_obligations':required,'hypothetical_reconnected_route_cost':len(possible['cells']),'not_a_prediction_of_opening':True}
   residual=route(expanded,configuration,source_override=control,check_first_admission=False)
   if residual is None:continue
   witness['hypothetical_residual_cost_from_control']=len(residual['cells'])
   witness['residual_cost_not_current_permission']=True
   found.append({**access,'context_question':witness,'target_point':control['point'],'unknown':['role_of_composite_glyph','effect_on_excluded_regions','phase_or_reversibility','global_effects']})
 return found

def landing_body_context(m,cell,obs):
 mask=shape(m['actor']['tile'],m['ink'])
 expected=[[m['ink']if(x,y)in mask else m['floor']if value==m['invitation']else value for x,value in enumerate(row)]for y,row in enumerate(cell['tile'])]
 return {'point':cell['point'],'bbox':cell['bbox'],'size':m['size'],'pitch':m['pitch'],'ink':m['ink'],'floor':m['floor'],'actor_mask':[list(p)for p in mask],'expected_tile':expected,'underlay_before':cell['tile'],'evidence':[obs['observation_ref']],'epoch':obs['level_epoch'],'status':'conditional_overlay_requires_exact_current_pixels'}

def current_body_layer(rows,receipt):
 if receipt is None:return None
 current=tile(rows,receipt['bbox']);mask={tuple(p)for p in receipt['actor_mask']};prior=receipt['expected_tile'];underlay=receipt['underlay_before'];values={v for row in underlay for v in row};changes=[]
 for y,row in enumerate(current):
  for x,value in enumerate(row):
   if value==prior[y][x]:continue
   # Only a separately observed underlay mark sharing the body ink may change here.
   # The body footprint itself and all other underlay pixels remain exact.
   if (x,y)in mask or prior[y][x]!=receipt['ink']or underlay[y][x]!=receipt['ink']or value not in values:return None
   changes.append({'offset':[x,y],'before':prior[y][x],'after':value,'inside_body':False})
 return {**receipt,'expected_tile':current,'source_expected_tile':prior,'underlay_discrepancy':changes,'underlay_effect_unknown':bool(changes)}
