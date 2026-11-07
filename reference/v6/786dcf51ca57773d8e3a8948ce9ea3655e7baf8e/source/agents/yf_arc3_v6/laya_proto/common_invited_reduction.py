"""Measured invitations, consumed intermediates, and conditional population reduction."""
from collections import Counter,deque
from math import gcd
from itertools import product
import json
from pathlib import Path
from common_fixed_origin import parts,box
from common_multiscale_constraints import digest,rows_digest
from src_bridge import plain
from observed_input_domain import ObservedInputDomain
from agents.yf_arc3_v5.capabilities.ray_capture_domain_d import RayCaptureDomainRequestD,CaptureBodyD,ShortCaptureRelationD,measure_ray_capture_domain_d
from agents.yf_arc3_v5.capabilities.mechanical_family_contracts_d import DMechanicalScope

def scene(rows):
 cs=parts(rows);squares=[c for c in cs if c.area>=9 and c.bbox.right-c.bbox.left==c.bbox.bottom-c.bbox.top and c.area==(c.bbox.right-c.bbox.left+1)**2]
 groups=Counter((c.value,c.bbox.right-c.bbox.left+1)for c in squares);options=[]
 for (value,pitch),n in groups.items():
  if n<4:continue
  ss=[c for c in squares if c.value==value and c.bbox.right-c.bbox.left+1==pitch];x0=min(c.bbox.left for c in ss);y0=min(c.bbox.top for c in ss);x1=max(c.bbox.right for c in ss);y1=max(c.bbox.bottom for c in ss)
  if any((c.bbox.left-x0)%pitch or (c.bbox.top-y0)%pitch for c in ss):continue
  # Repeated complementary cells may extend the checker boundary by one cell.
  token=[]
  for c in cs:
   w=c.bbox.right-c.bbox.left+1;h=c.bbox.bottom-c.bbox.top+1
   if w==h==pitch-2 and w*w/2<c.area<w*w and x0-pitch<c.bbox.left<=x1 and y0-pitch<c.bbox.top<=y1:
    token.append(c)
  if len(token)<2:continue
  masks=Counter(tuple(sorted((r-c.bbox.top,col-c.bbox.left)for r,col in c.pixels))for c in token);mask,amount=masks.most_common(1)[0]
  if amount<2:continue
  tx=min(c.bbox.left-1 for c in token);ty=min(c.bbox.top-1 for c in token)
  if tx<x0 and x0-tx==pitch:x0=tx
  if ty<y0 and y0-ty==pitch:y0=ty
  cells={};bodies={};templates={};half=pitch//2
  for y in range(y0,y1+1,pitch):
   for x in range(x0,x1+1,pitch):
    if x+pitch>len(rows[0])or y+pitch>len(rows):continue
    p=((x-x0)//pitch,(y-y0)//pitch);cut=tuple(tuple(row[x:x+pitch])for row in rows[y:y+pitch]);cells[p]=cut
    values=[rows[y+1+r][x+1+c]for r,c in mask];v,count=Counter(values).most_common(1)[0]
    corners=[rows[y+1+r][x+1+c]for r,c in ((0,0),(0,pitch-3),(pitch-3,0),(pitch-3,pitch-3))]
    if count>=len(mask)*.6 and all(z!=v for z in corners):
     pattern=tuple(int(z!=v)for z in values);rank=digest(pattern)[:12];bodies[p]=(int(v),rank);templates[rank]=pattern
  if len(bodies)>=2:options.append({'pitch':pitch,'origin':(x0,y0),'cells':cells,'bodies':bodies,'templates':templates,'mask':mask})
 return options[0]if len(options)==1 else None

def point(s,p):return(s['origin'][0]+p[0]*s['pitch']+s['pitch']//2,s['origin'][1]+p[1]*s['pitch']+s['pitch']//2)
def geometry(s):
 return {'pitch':s['pitch'],'origin':list(s['origin']),'mask':plain(s['mask']),'cells':[list(p)for p in s['cells']],'anchors':[[list(p),cut[0][0]]for p,cut in s['cells'].items()if len({v for row in cut for v in row})==1]}
def retained_scene(rows,h):
 if not h:return scene(rows)
 pitch=h['pitch'];x0,y0=h['origin'];cells={};bodies={};templates={};mask=h['mask']
 for p in h['cells']:
  p=tuple(p);x=x0+p[0]*pitch;y=y0+p[1]*pitch
  if x<0 or y<0 or x+pitch>len(rows[0])or y+pitch>len(rows):return None
  cut=tuple(tuple(row[x:x+pitch])for row in rows[y:y+pitch]);cells[p]=cut
  values=[cut[1+r][1+c]for r,c in mask];v,count=Counter(values).most_common(1)[0];corners=[cut[1+r][1+c]for r,c in ((0,0),(0,pitch-3),(pitch-3,0),(pitch-3,pitch-3))]
  if count>=len(mask)*.6 and all(z!=v for z in corners):
   pattern=tuple(int(z!=v)for z in values);rank=digest(pattern)[:12];bodies[p]=(int(v),rank);templates[rank]=pattern
 if not h['anchors']or any(any(z!=v for row in cells[tuple(p)]for z in row)for p,v in h['anchors']):return None
 return {'pitch':pitch,'origin':(x0,y0),'cells':cells,'bodies':bodies,'mask':mask,'templates':templates}
def click(s,p):return {'action_ref':'ACTION6','data':dict(zip(('x','y'),point(s,p)))}
def packed(b):return sorted([list(p)+list(v)for p,v in b.items()])
def cell(s,command):
 d=command.get('data',{});x=d.get('x',-999)-s['origin'][0];y=d.get('y',-999)-s['origin'][1];p=(x//s['pitch'],y//s['pitch']);return p if p in s['cells']else None

class InvitedReduction:
 def __init__(self):
  self.epoch=None;self.focus=None;self.invites=[];self.relations={};self.rays={};self.refs=[];self.events=[];self.goal=False;self.tried=set();self.selected=False;self.base_values=set();self.control_marks=[];self.hint=None;self.invitation_value=None
 def state(self):
  return plain({'schema':'invited_reduction_state.v1','epoch':self.epoch,'focus':self.focus,'invites':self.invites,'relations':{k:sorted(v)for k,v in self.relations.items()},'rays':self.rays,'refs':self.refs,'events':self.events,'goal':self.goal,'tried':sorted(self.tried),'selected':self.selected,'base_values':sorted(self.base_values),'control_marks':self.control_marks,'hint':self.hint,'invitation_value':self.invitation_value})
 def restore(self,state):
  if state.get('schema')!='invited_reduction_state.v1':raise ValueError('Invited reduction memory schema mismatch')
  for key in ('epoch','refs','events','goal','selected','hint','invitation_value'):setattr(self,key,state[key])
  self.focus=tuple(state['focus'])if state['focus']is not None else None
  self.invites=[tuple(x)for x in state['invites']];self.tried={tuple(x)for x in state['tried']};self.base_values=set(state['base_values']);self.control_marks=[tuple(x)for x in state['control_marks']]
  self.relations={k:{(tuple(u),tuple(v))for u,v in entries}for k,entries in state['relations'].items()};self.rays={k:tuple(v)for k,v in state['rays'].items()}
 def enter(self,epoch,s):
  self.epoch=epoch;self.hint=geometry(s);self.focus=None;self.invites=[];self.tried=set();self.control_marks=[];self.base_values={Counter(z for row in cut for z in row).most_common(1)[0][0]for p,cut in s['cells'].items()if p not in s['bodies']}
 def current_invites(self,s):
  return [p for p,cut in s['cells'].items()if p not in s['bodies']and Counter(z for row in cut for z in row).most_common(1)[0][0]not in self.base_values]
 def record(self,before,after,command,first,second,proposal=None,index=None,frames=None):
  self.events=[];a=retained_scene(first,self.hint)if self.epoch==before['level_epoch']else scene(first);b=retained_scene(second,self.hint)if self.epoch==before['level_epoch']else scene(second)
  if not a:return {'status':'invited_reduction_absent','events':[]}
  if self.epoch!=before['level_epoch']:self.enter(before['level_epoch'],a)
  target=cell(a,command)
  if after['levels_completed']>before['levels_completed']:
   self.goal=True;self.refs.append(after['observation_ref']);self.events=[{'kind':'reduction_official_boundary','evidence':after['observation_ref']}];self.focus=None;self.invites=[];return {'status':'invited_reduction_boundary','events':self.events}
  if not b or a['pitch']!=b['pitch']or a['origin']!=b['origin']:return {'status':'invited_reduction_scope_changed','events':[]}
  A=a['bodies'];B=b['bodies']
  if A==B and target in A:
   changed=self.current_invites(b)
   if changed:
    self.focus=target;self.invites=changed;self.selected=True
    values={b['cells'][p][b['pitch']//2][b['pitch']//2]for p in changed};self.invitation_value=next(iter(values))if len(values)==1 else None
    self.control_marks=[(r,c,z)for r,row in enumerate(b['cells'][target])for c,z in enumerate(row)if a['cells'][target][r][c]!=z and (r in (0,a['pitch']-1)or c in (0,a['pitch']-1))]
   elif self.focus==target:self.focus=None;self.invites=[]
   self.tried.add(target);self.refs.append(after['observation_ref']);self.events=[{'kind':'current_selection_domain','focus':self.focus,'invitations':self.invites,'evidence':after['observation_ref'],'effect_status':'selection hypothesis, no capture law implied'}]
  elif len(B)==len(A)-1 and self.focus in A:
   removed=set(A)-set(B);added=set(B)-set(A)
   if self.focus in removed and len(removed)==2 and len(added)==1:
    destination=next(iter(added));victim=next(iter(removed-{self.focus}));rank=A[self.focus][1];u=tuple(victim[k]-self.focus[k]for k in (0,1));v=tuple(destination[k]-self.focus[k]for k in (0,1))
    if B[destination]==A[self.focus] and target==destination:
     self.relations.setdefault(rank,set()).add((u,v));g=gcd(abs(v[0]),abs(v[1]));self.refs.append(after['observation_ref'])
     if g>2:self.rays[rank]=tuple(z//g for z in v)
     self.focus=destination;self.invites=self.current_invites(b)
     self.events=[{'kind':'observed_consumed_intermediate','relation':[u,v],'rank':rank,'evidence':after['observation_ref'],'scope':'local public transaction; symmetric extension is provisional'}]
  return {'status':'invited_reduction_response','events':self.events}
 def domain(self,s,b,focus,obs):
  rank=b[focus][1];relations=self.relations.get(rank)
  if not relations:return []
  expanded=set()
  for u,v in relations:
   for swap in (False,True):
    for sx,sy in product((-1,1),repeat=2):
     U=u[::-1]if swap else u;V=v[::-1]if swap else v;expanded.add(((sx*U[0],sy*U[1]),(sx*V[0],sy*V[1])))
  scope=DMechanicalScope(request_ref='capture:'+obs['observation_ref'],caller_ref='common_invited_reduction',parent_consumer_ref='SupportNavigation',parent_goal_ref='G_official_completion',parent_contribution_ref='preserve_reduction_continuation',caller_next_item_ref='current_capture_domain',epoch=obs['level_epoch'],evidence_revision_ref=obs['observation_ref'],model_revision_ref=self.refs[-1],model_status_ref='observed_reduction_with_conditional_symmetries',event_owner_ref='public_response',input_domain_complete=True,assumption_refs=('same_pattern_rank','spatial_symmetry_provisional','no_hidden_goal'))
  request=RayCaptureDomainRequestD(scope=scope,operation_ref='mechanics.typed_jump_carriers.ray_capture_domain',mode_ref='DOMAIN',requested_result_type='capture_incidences',node_bound=10000,depth_bound=64,domain_bound=4096,time_bound_ms=1000,phase_ref='CURRENT_CAPTURE_DOMAIN',population=tuple(CaptureBodyD(member_ref=str(p),type_ref=v[1],rank=0,origin=p,occupied_offsets=((0,0),))for p,v in b.items()),native_focus_ref=str(focus),board_cells=tuple(s['cells']),ray_passage_cells=tuple(s['cells']),landing_support_cells=tuple(s['cells']),eligible_victim_refs=tuple(str(p)for p in b if p!=focus),range_kind='RAY'if rank in self.rays else 'SHORT',range_law_evidence_ref=self.refs[-1],range_law_rank=0,directions=tuple(sorted({tuple(z//gcd(abs(v[0]),abs(v[1]))for z in v)for u,v in expanded})),short_relations=tuple(ShortCaptureRelationD(relation_ref=str(i),intermediate_delta=u,landing_delta=v)for i,(u,v)in enumerate(sorted(expanded))),proposed_landing=None)
  request=request.model_copy(update={'requested_result_type':'DMechanicalResult'})
  result=measure_ray_capture_domain_d(request)
  if result.status!='COMPLETE':return []
  mapping={str(p):p for p in b};return [(mapping[x['victim_ref']],tuple(x['landing']))for x in result.values['capture_incidences']]
 def propose(self,obs,rows,inputs,remaining):
  policy=json.loads((Path(__file__).parent/'common_frontier_policy.drm.json').read_text()).get('invited_reduction',{})
  if not policy.get('enabled'):return None
  if not self.selected and not policy.get("initial_selection_question",{}).get("enabled"):return None
  s=retained_scene(rows,self.hint)if self.epoch==obs['level_epoch']else scene(rows)
  if not s or 'ACTION6'not in obs['available_action_refs']:return None
  if self.epoch!=obs['level_epoch']:self.enter(obs['level_epoch'],s)
  b=s['bodies'];actions=[];steps=[];why='';cur=dict(b);focus=self.focus
  # Joint reduction search keeps source/victim/landing dependence; unknown types remain questions.
  goal_colors={c.value for c in parts(rows)if c.bbox.bottom<s['origin'][1] and c.bbox.right-c.bbox.left>=2 and c.bbox.bottom-c.bbox.top>=2 and c.area==(c.bbox.right-c.bbox.left+1)*(c.bbox.bottom-c.bbox.top+1) and c.value in {v[0]for v in b.values()}}
  def terminal(B):return len(B)==1 or len(goal_colors)==1 and all(v[0]in goal_colors for v in B.values())
  queue=deque([(dict(b),focus,[])]);seen=set();winning=None
  if self.relations:
   while queue and len(seen)<8192:
    B,F,path=queue.popleft();key=(str(packed(B)),F)
    if key in seen:continue
    seen.add(key)
    if path and terminal(B):winning=path;break
    if len(path)>=min(16,remaining):continue
    for src in sorted(B):
     for victim,dst in self.domain(s,B,src,obs):
      nxt=dict(B);v=nxt.pop(src);nxt.pop(victim);nxt[dst]=v;new=path+([]if F==src else [('select',src,None)])+[('capture',dst,(src,victim))]
      if len(new)<=min(16,remaining):queue.append((nxt,dst,new))
  plan=winning
  if plan:why='conditional complete population reduction; preserve intermediate services and current selection'
  elif focus in b and self.invites:
   dst=next((p for p in sorted(self.invites)if p not in b),None)
   if dst is not None:plan=[('probe',dst,None)];why='consume current invitation; distinguish selection from a population transaction'
  if not plan:
   candidates=[p for p in sorted(b,key=lambda p:(p[1],p[0]))if p!=focus and p not in self.tried]
   if not candidates:return None
   plan=[('select',candidates[0],None)];why=policy['initial_selection_question']['purpose'] if not self.selected else 'bind one current repeated occurrence to its public command domain'
  for mode,p,relation in plan:
   expected=packed(cur);actions.append(click(s,p));prior_focus=focus
   if mode=='capture':src,victim=relation;value=cur.pop(src);cur.pop(victim);cur[p]=value
   focus=p
   steps.append({'action':actions[-1],'expected_before':expected,'expected_after':None if mode=='probe'else packed(cur),'mode':mode,'focus_before':list(prior_focus)if prior_focus is not None else None,'focus_after':list(focus),'control_marks':plain(self.control_marks),'locus_witness':ObservedInputDomain.make_locus_witness(obs,rows,point(s,p),reason=why,evidence=[obs['observation_ref']]+self.refs[-3:])})
   if len(steps)>1 and mode=='capture'and self.invitation_value is not None:
    witness=steps[-1]['locus_witness'];witness.update(palette_value=self.invitation_value,projected_rows_digest=rows_digest([[self.invitation_value]]),scope='conditional_invitation_pixel_after_bound_selection_or_capture',source_observed_palette_value=rows[point(s,p)[1]][point(s,p)[0]])
   steps[-1]['geometry']=self.hint
  ref='C_reduction_'+digest([obs['observation_ref'],actions])[:16];evidence=[obs['observation_ref']]+self.refs[-4:];facts={'repeated_population_bound':True,'current_invitation_or_conditional_reduction':True,'joint_continuation_preserved':True};payload={'invited_reduction':True,'frame_hash':obs['frame_hash'],'pitch':s['pitch'],'origin':list(s['origin']),'hypothesis':why,'goal_status':'residual cardinality/class hypothesis; official return only','search_states':len(seen),'search_exhausted':not queue,'unknowns':['unseen range types','exclusive symmetry','terminal class quantifier']}
  return {'status':'proposed','kind':'invited_population_reduction','support_plan':payload,'actions':actions,'steps':steps,'facts':facts,'compositions':[{'id':ref,'role':'conditional_population_reduction','observed':False,'open_question':why,'properties':{'population':len(b)},'relations':['contributes_to:G_official_completion']}],'question':{'reason':why,'hypothesis_refs':evidence},'route_refs':evidence,'binding':{'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'levels_completed':obs['levels_completed']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'purpose':why,'preconditions':facts,'evidence':evidence,'actions':actions,'frozen_support_plan':payload,'outcome_guard':{'path':['value'],'contains':ref}}}
 def before(self,p,i,public,obs):
  s=retained_scene(public.frame_rows,p['steps'][i]['geometry']);ok=bool(s and public.level==p['binding']['level_epoch']and public.levels_completed==p['binding']['levels_completed']and packed(s['bodies'])==p['steps'][i]['expected_before']and list(s['origin'])==p['support_plan']['origin']and s['pitch']==p['support_plan']['pitch'])
  if i==0:ok=ok and public.frame_hash==p['support_plan']['frame_hash']
  step=p['steps'][i]
  if ok and step['mode']in ('capture','probe') and step['control_marks']:
   cut=s['cells'].get(tuple(step['focus_before']),());ok=bool(cut and all(cut[r][c]==v for r,c,v in step['control_marks']))
  return {'admitted':ok,'reason':'current_population_selection_and_lattice'}
 def after(self,p,i,before,after,first,second):
  if after['levels_completed']>before['levels_completed']:return {'matched':True,'seal_prefix':True,'reason':'official_boundary'}
  expected=p['steps'][i]['expected_after'];s=retained_scene(second,p['steps'][i]['geometry'])
  if expected is None:return {'matched':None,'seal_prefix':True,'reason':'invitation_transaction_requires_reconciliation'}
  ok=bool(s and packed(s['bodies'])==expected);step=p['steps'][i]
  if ok and step['control_marks']:
   cut=s['cells'].get(tuple(step['focus_after']),());ok=bool(cut and all(cut[r][c]==v for r,c,v in step['control_marks']))
  return {'matched':ok,'seal_prefix':not ok,'reason':'joint_population_prediction'if ok else 'population_or_control_contradiction'}
