"""Public periodic strips, sampled stacks, and scoped control questions."""
from collections import Counter,defaultdict,deque
from itertools import product
from pathlib import Path
import json
from common_fixed_origin import parts,box
from common_multiscale_constraints import digest
from observed_input_domain import ObservedInputDomain
from src_bridge import plain
from agents.yf_arc3_v5.capabilities.periodic_profile_preimages_d import PeriodicProfileLawD,ProfilePhaseAssignmentD,ProfileDetectorD,PeriodicProfilePreimagesRequestD,measure_periodic_profile_preimages_d
from agents.yf_arc3_v5.capabilities.mechanical_family_contracts_d import DMechanicalScope

def measure(rows):
 h,w=len(rows),len(rows[0]);cs=parts(rows);background=Counter(v for row in rows for v in row).most_common(1)[0][0];tracks=[]
 for color in set(v for row in rows for v in row)-{background}:
  ys=[y for y,row in enumerate(rows) if color in row];runs=[]
  for y in ys:
   if not runs or y>runs[-1][-1]+1:runs.append([])
   runs[-1].append(y)
  for run in runs:
   if len(run)<2 or len(run)>w//3:continue
   top,base=run[0],run[-1]+1;xx={x for y in run for x in range(w) if rows[y][x]==color}
   if len(xx)<w//3 or max(xx)-min(xx)<w*3//4 or base>=h:continue
   heights=[]
   for x in range(w):
    n=0
    while base-n-1>=top and rows[base-n-1][x]==color:n+=1
    heights.append(n)
   fits=[]
   for period in range(2,w//3+1):
    pattern=[Counter(heights[k::period]).most_common(1)[0][0] for k in range(period)]
    if len(set(pattern))<2 or max(pattern)<2:continue
    errors=[x for x,v in enumerate(heights) if v!=pattern[x%period]]
    if all(heights[x]+1==pattern[x%period] and rows[base-pattern[x%period]][x] not in (color,background) for x in errors):
     fits.append((period,pattern,errors));break
   if fits:
    period,pattern,errors=fits[0];tracks.append({'color':color,'base':base,'top':base-max(pattern),'period':period,'profile':pattern,'overlay_columns':errors})
 tracks.sort(key=lambda v:v['base'])
 if len(tracks)<2 or len(tracks)>4 or any(a['base']>=b['top'] for a,b in zip(tracks,tracks[1:])):return None
 colors={v['color'] for v in tracks};floor=tracks[-1]['base'];feet=[]
 for c in cs:
  l,t,r,b=box(c)
  if t>floor and t==b and 3<=r-l+1<w//2 and c.area==r-l+1 and c.value not in colors:feet.append((l,t,r,c.value))
 detectors=[]
 for l,base,r,color in feet:
  # Empty-stack endpoint marks can cover the two ends of the baseline.
  # Recover those ends only from two independently measured upright rails.
  left_rail=any(box(c)[0]==box(c)[2]==l-1 and box(c)[3]==base-1 and c.area>=2 for c in cs)
  right_rail=any(box(c)[0]==box(c)[2]==r+1 and box(c)[3]==base-1 and c.area>=2 for c in cs)
  if left_rail and right_rail:l-=1;r+=1
  x=(l+r)//2;left=[c for c in cs if box(c)[1]==box(c)[3] and box(c)[0]<l and box(c)[2] in (l-1,l) and floor<box(c)[1]<base]
  for c in left:
   a,y,b,unused=box(c);right=[q for q in cs if q.value==c.value and box(q)==[l+r-b,y,l+r-a,y]]
   if not right:continue
   total=0
   while base-total-1>floor and rows[base-total-1][x] in colors:total+=1
   contributions=[t['profile'][x%t['period']] for t in tracks]
   if sum(contributions)!=total:continue
   detectors.append({'x':x,'base':base,'target':base-y,'total':total,'contributions':contributions})
 if not detectors or len({d['x'] for d in detectors})!=len(detectors):return None
 detectors.sort(key=lambda d:d['x']);controls=[]
 for c in cs:
  l,t,r,b=box(c)
  if l==0 or r==w-1 or b>=tracks[0]['top'] or not 3<=c.area<=12 or r-l<1 or b-t<1:continue
  mask=tuple(sorted((x-l,y-t) for y,x in c.pixels));mirror=tuple(sorted((r-l-x,y) for x,y in mask))
  peers=[q for q in cs if q is not c and q.value==c.value and box(q)[1:4:2]==[t,b] and tuple(sorted((x-box(q)[0],y-box(q)[1]) for y,x in q.pixels))==mirror and box(q)[2]-box(q)[0]==r-l]
  if peers and mask!=mirror:controls.append({'box':[l,t,r,b],'shape':digest([r-l+1,b-t+1,mask]),'point':[(l+r)//2,(t+b)//2]})
 # Bracket corners on both viewport edges indicate the current strip focus.
 edge_pairs=[]
 for c in cs:
  l,t,r,b=box(c)
  if l==0 and 2<=c.area<=6 and r<=2:
   if any(q.value==c.value and box(q)[0]>=w-3 and box(q)[2]==w-1 and box(q)[1]==t and box(q)[3]==b for q in cs):edge_pairs.append((t,b))
 selected=[]
 for i,track in enumerate(tracks):
  if any(b<track['top'] for t,b in edge_pairs) and any(t>track['base'] for t,b in edge_pairs):
   above=max(b for t,b in edge_pairs if b<track['top']);below=min(t for t,b in edge_pairs if t>track['base'])
   if not any(j!=i and above<other['top'] and other['base']<below for j,other in enumerate(tracks)):selected.append(i)
 return {'tracks':tracks,'detectors':detectors,'controls':controls,'selected':selected[0] if len(selected)==1 else None,'layout':digest([[t['base'],t['period']] for t in tracks]+[[d['x'],d['base'],d['target']] for d in detectors])}

def offsets(a,b):
 if len(a['tracks'])!=len(b['tracks']):return None
 result=[]
 for first,second in zip(a['tracks'],b['tracks']):
  if (first['color'],first['period'],first['base'])!=(second['color'],second['period'],second['base']):return None
  p=first['period'];matches=[k for k in range(p) if all(second['profile'][x]==first['profile'][(x-k)%p] for x in range(p))]
  if len(matches)!=1:return None
  d=matches[0];result.append(d if d<=p//2 else d-p)
 return result

class _MeasuredPeriodicSums:
 def __init__(self):self.individual={};self.collective={};self.refs=[];self.selection=False;self.passed=[];self.tried=set();self.events=[];self.last_result=None
 def record(self,before,after,command,first,second,proposal=None,index=None,frames=None):
  self.events=[];a=measure(first)
  if not a:return {'status':'periodic_sums_absent','events':[]}
  b=measure(second)
  if after['levels_completed']>before['levels_completed']:
   b=next((s for r in (frames or []) if (s:=measure(r)) and s['layout']==a['layout']),None)
   self.passed.append({'before':before['observation_ref'],'after':after['observation_ref'],'method':'sampled_periodic_sum','control':command})
  if not b:return {'status':'periodic_response_unmeasured','events':[]}
  delta=offsets(a,b)
  if delta is None:return {'status':'periodic_profile_changed','events':[]}
  action=command['action_ref'];kind=None
  if action!='ACTION6' and a['selected'] is not None and delta[a['selected']] and all(not d for i,d in enumerate(delta) if i!=a['selected']):
   self.individual[action]=delta[a['selected']];kind='individual_phase_displacement'
  if action=='ACTION6':
   point=command.get('data',{});controls=[c for c in a['controls'] if c['box'][0]<=point.get('x',-1)<=c['box'][2] and c['box'][1]<=point.get('y',-1)<=c['box'][3]]
   if len(controls)==1 and any(delta):
    self.collective[controls[0]['shape']]={str(t['color']):d for t,d in zip(a['tracks'],delta)};kind='joint_phase_displacement'
   elif not any(delta) and b['selected'] is not None and b['selected']!=a['selected']:self.selection=True;kind='strip_focus_changed'
  if kind:
   self.refs.append(after['observation_ref']);self.events=[{'kind':kind,'command':command,'delta':delta,'before':before['observation_ref'],'after':after['observation_ref'],'scope':'current measured strips; gains and focus remain context-bound','official_boundary':after['levels_completed']>before['levels_completed']}]
  if proposal and proposal.get('support_plan',{}).get('periodic_sums') and proposal['steps'][index].get('probe'):self.tried.add(proposal['support_plan']['question_key'])
  return {'status':'periodic_response_recorded','events':self.events}
 def scope(self,obs):
  return DMechanicalScope(request_ref='profiles:'+obs['observation_ref'],caller_ref='common_periodic_sums',parent_consumer_ref='SupportNavigation',parent_goal_ref='G_official_completion',parent_contribution_ref='joint_sample_sum',caller_next_item_ref='native_phase_input',epoch=obs['level_epoch'],evidence_revision_ref=obs['observation_ref'],model_revision_ref=self.refs[-1],event_owner_ref='public_command_packet',model_status_ref='observed_periodic_strips_and_current_stack_correspondence',input_domain_complete=True,assumption_refs=('spatial_periodicity_is_conditional_not_universal','joint_stack_sum_is_candidate_terminal_until_official_score','controls_revalidated_in_current_strip_geometry'))
 def targets(self,scene,obs):
  tracks=scene['tracks'];laws=tuple(PeriodicProfileLawD(law_ref='law:'+str(i),track_ref=str(i),period=t['period'],samples=tuple(t['profile']),index_offset=0,phase_sign=-1) for i,t in enumerate(tracks));tuples=list(product(*(range(t['period']) for t in tracks)))
  if len(tuples)>4096:return None
  assignments=tuple(ProfilePhaseAssignmentD(assignment_ref=str(n),track_law_phases=tuple((str(i),'law:'+str(i),v) for i,v in enumerate(values))) for n,values in enumerate(tuples));detectors=tuple(ProfileDetectorD(detector_ref=str(j),column=d['x'],target_value=d['target']) for j,d in enumerate(scene['detectors']))
  request=PeriodicProfilePreimagesRequestD(scope=self.scope(obs),operation_ref='mechanics.coupled_value_constraints.periodic_profile_preimages',mode_ref='INVERSE_DOMAIN',requested_result_type='DMechanicalResult',node_bound=100000,depth_bound=4096,domain_bound=4096,time_bound_ms=60000,phase_ref='CORRELATED_PHASE_DOMAIN',track_refs=tuple(map(str,range(len(tracks)))),laws=laws,observed_samples=(),assignments=assignments,detectors=detectors,assignment_domain_complete=True)
  result=measure_periodic_profile_preimages_d(request);self.last_result={'status':result.status,'cause':result.cause,'assignment_count':len(assignments),'target_refs':plain(result.values.get('joint_preimage_assignment_refs',()))}
  return {tuples[int(k)] for k in result.values['joint_preimage_assignment_refs']} if result.status=='COMPLETE' else None
 def search(self,scene,targets,remaining):
  tracks=scene['tracks'];start=(tuple(0 for t in tracks),scene['selected']);queue=deque([(start,[])]);seen={start}
  while queue:
   (phases,selected),path=queue.popleft()
   if phases in targets and path:return path
   if len(path)>=remaining:continue
   nexts=[]
   for action,delta in self.individual.items():
    if selected is None:continue
    values=list(phases);values[selected]=(values[selected]+delta)%tracks[selected]['period'];nexts.append(((tuple(values),selected),{'action_ref':action,'delta':[delta if i==selected else 0 for i in range(len(tracks))]}))
   for control in scene['controls']:
    law=self.collective.get(control['shape'],{})
    if all(str(t['color']) in law for t in tracks):
     ds=[law[str(t['color'])] for t in tracks];values=tuple((v+d)%t['period'] for v,d,t in zip(phases,ds,tracks));nexts.append(((values,selected),{'action_ref':'ACTION6','data':dict(zip(('x','y'),control['point'])),'delta':ds}))
   for i,t in enumerate(tracks):
    if i!=selected:nexts.append(((phases,i),{'select':i,'action_ref':'ACTION6','data':{'x':len(t['profile'])//2,'y':t['base']-1},'delta':[0]*len(tracks)}))
   for state,command in nexts:
    if state not in seen:seen.add(state);queue.append((state,path+[command]))
  return None
 def propose(self,obs,rows,inputs,remaining):
  if not json.loads(Path(__file__).with_name('common_frontier_policy.drm.json').read_text()).get('periodic_sums',{}).get('enabled') or not self.refs or remaining<1:return None
  scene=measure(rows)
  if not scene or scene['selected'] is None:return None
  targets=self.targets(scene,obs)
  if targets is None:return None
  route=self.search(scene,targets,remaining);question='';mode='joint_phase_target'
  if not route:
   for c in sorted(scene['controls'],key=lambda c:c['point']):
    key=digest([obs['level_epoch'],scene['layout'],c['shape'],'channel'])
    if key not in self.tried and not all(str(t['color']) in self.collective.get(c['shape'],{}) for t in scene['tracks']):route=[{'action_ref':'ACTION6','data':dict(zip(('x','y'),c['point'])),'probe':True}];question=key;break
   if not route:
    for action in obs['available_action_refs']:
     if action in ('ACTION3','ACTION4') and action not in self.individual:
      key=digest([obs['level_epoch'],scene['layout'],action,'individual'])
      if key not in self.tried:route=[{'action_ref':action,'probe':True}];question=key;break
   mode='channel_question'
  if not route:return None
  profiles=[list(t['profile']) for t in scene['tracks']];selected=scene['selected'];steps=[];actions=[]
  for command in route[:16]:
   expected_before={'profiles':plain(profiles),'selected':selected};action={k:v for k,v in command.items() if k in ('action_ref','data')};probe=bool(command.get('probe'))
   if 'select' in command:selected=command['select'];probe=not self.selection
   if not probe:
    for i,d in enumerate(command.get('delta',[])):
     p=profiles[i];profiles[i]=[p[(x-d)%len(p)] for x in range(len(p))]
   step={'action':action,'expected_before':expected_before,'expected_after':None if probe else {'profiles':plain(profiles),'selected':selected},'probe':probe}
   if action['action_ref']=='ACTION6':step['locus_witness']=ObservedInputDomain.make_locus_witness(obs,rows,(action['data']['x'],action['data']['y']),reason='Measured strip focus or paired control occurrence; no semantic role from position alone.',evidence=[obs['observation_ref']])
   steps.append(step);actions.append(action)
   if probe:break
  why='Reach a joint preimage of all current sampled-stack targets using measured phase controls; selection costs and each receiver remain coupled. If a control is unknown, stop at its first response and retain rival channel hypotheses.';facts={'periodic_strips_measured':True,'stack_contributions_match':True,'current_focus_bound':True,'phase_preimages_computed':True};ref='C_profiles_'+digest([obs['observation_ref'],actions])[:16];evidence=[obs['observation_ref']]+self.refs[-4:];plan={'periodic_sums':True,'mode':mode,'frame_hash':obs['frame_hash'],'layout':scene['layout'],'question_key':question,'preimage_proof':self.last_result,'hypotheses':['measured finite periodic strips','current stack is sum of sampled strip heights','native controls retain their current scoped phase effects'],'passed':self.passed[-3:]}
  return {'status':'proposed','kind':'periodic_sum_'+mode,'support_plan':plan,'actions':actions,'steps':steps,'facts':facts,'compositions':[{'id':ref,'role':'joint_phase_preimage','observed':False,'open_question':why,'properties':{'receivers':len(scene['detectors'])},'relations':['contributes_to:G_official_completion']}],'question':{'reason':why,'hypothesis_refs':evidence},'route_refs':evidence,'binding':{'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'levels_completed':obs['levels_completed']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'purpose':why,'preconditions':facts,'evidence':evidence,'actions':actions,'frozen_support_plan':plain(plan),'outcome_guard':{'path':['value'],'contains':ref}}}
 def before(self,p,i,public,obs):
  s=measure(public.frame_rows);expected=p['steps'][i]['expected_before'];ok=s is not None and s['layout']==p['support_plan']['layout'] and [t['profile'] for t in s['tracks']]==expected['profiles'] and s['selected']==expected['selected'] and public.level==p['binding']['level_epoch'] and public.levels_completed==p['binding']['levels_completed']
  if i==0:ok=ok and public.frame_hash==p['support_plan']['frame_hash']
  return {'admitted':bool(ok),'reason':'current_profile_tuple_focus_and_receivers'}
 def after(self,p,i,before,after,first,second):
  if after['levels_completed']>before['levels_completed']:return {'matched':None,'seal_prefix':True,'reason':'official_boundary'}
  expected=p['steps'][i]['expected_after']
  if expected is None:return {'matched':None,'seal_prefix':True,'reason':'unknown_channel_response'}
  s=measure(second);ok=s is not None and s['layout']==p['support_plan']['layout'] and [t['profile'] for t in s['tracks']]==expected['profiles'] and s['selected']==expected['selected']
  return {'matched':bool(ok),'seal_prefix':not ok,'reason':'joint_phase_prediction' if ok else 'profile_focus_or_sum_diverged'}


def input_digest(p):
 return digest([p['binding'],p['actions'],[{k:v for k,v in s.items() if k!='point_binding'}for s in p['steps']]])

class PeriodicSums(_MeasuredPeriodicSums):
 """Activate a measured composition's missing control question, then reuse its method."""
 def __init__(self):
  super().__init__();self.bootstrap_attempts=set();self.authorizations={}
 def state(self):
  return plain({k:getattr(self,k) for k in ('individual','collective','refs','selection','passed','events','last_result','authorizations')} | {'tried':sorted(self.tried),'bootstrap_attempts':sorted(self.bootstrap_attempts)})
 def restore(self,state):
  state=json.loads(json.dumps(state))
  for k in ('individual','collective','refs','selection','passed','events','last_result','authorizations'):setattr(self,k,state[k])
  self.tried=set(state['tried']);self.bootstrap_attempts=set(state['bootstrap_attempts'])
 def propose(self,obs,rows,inputs,remaining):
  policy=json.loads(Path(__file__).with_name('common_frontier_policy.drm.json').read_text())['periodic_sums'];p=super().propose(obs,rows,inputs,remaining)
  if p is None and policy.get('enabled') and not self.refs and remaining>=1:
   scene=measure(rows);rule=policy['initial_control_question']
   if not rule['enabled'] or not scene or scene['selected'] is None or not any(d['total']!=d['target'] for d in scene['detectors']):return None
   available={v['action_ref'] for v in inputs if not v.get('data')};chosen=None
   for action in rule['ordered_input_hypotheses']:
    key=digest([obs['level_epoch'],scene['layout'],[t['profile']for t in scene['tracks']],scene['selected'],action,'initial_selected_strip_response'])
    if action in available and key not in self.bootstrap_attempts:chosen=(action,key);break
   if chosen is None:return None
   action,key=chosen;command={'action_ref':action};why=rule['meaning'];ref='C_profiles_initial_'+key[:16];evidence=[obs['observation_ref']]
   facts={'periodic_strips_measured':True,'stack_contributions_match':True,'current_focus_bound':True,'sampled_target_residual_present':True,'input_effect_is_unknown':True,'phase_preimages_computed':False}
   plan={'periodic_sums':True,'mode':'initial_control_question','frame_hash':obs['frame_hash'],'layout':scene['layout'],'question_key':key,'hypotheses':[rule['input_hypothesis']],'passed':[]}
   step={'action':command,'expected_before':{'profiles':[t['profile']for t in scene['tracks']],'selected':scene['selected']},'expected_after':None,'probe':True}
   p={'status':'proposed','kind':'periodic_sum_initial_control_question','support_plan':plan,'actions':[command],'steps':[step],'facts':facts,'compositions':[{'id':ref,'role':'information_question','observed':False,'open_question':why,'properties':{'receivers':len(scene['detectors'])},'relations':['contributes_to:G_official_completion']}],'question':{'reason':why,'hypothesis_refs':evidence},'route_refs':evidence,'binding':{'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'levels_completed':obs['levels_completed']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'purpose':why,'preconditions':facts,'evidence':evidence,'actions':[command],'frozen_support_plan':plain(plan),'outcome_guard':{'path':['value'],'contains':ref}}}
  if p is not None:
   token=input_digest(p);p['support_plan']['input_binding_ref']=token;self.authorizations[token]=input_digest(p);p['bundle_template']['frozen_support_plan']=plain(p['support_plan'])
  return p
 def before(self,p,i,public,obs):
  if not 0<=i<len(p['actions']):return {'admitted':False,'reason':'periodic_input_index_outside_set'}
  result=super().before(p,i,public,obs)
  token=p['support_plan'].get('input_binding_ref');exact=self.authorizations.get(token)==input_digest(p) and p['actions']==[s['action']for s in p['steps']] and p['actions']==p['bundle_template']['actions'] and 0<=i<len(p['actions']) and p['actions'][i]['action_ref']in public.available_action_refs and obs['level_epoch']==p['binding']['level_epoch']
  return {'admitted':bool(result['admitted']and exact),'reason':'current_periodic_scope_and_exact_authorized_input'if exact else'periodic_input_binding_changed'}
 def record(self,before,after,command,first,second,proposal=None,index=None,frames=None):
  result=super().record(before,after,command,first,second,proposal,index,frames)
  if proposal and proposal.get('support_plan',{}).get('mode')=='initial_control_question':
   self.bootstrap_attempts.add(proposal['support_plan']['question_key'])
   acquired=bool(result.get('events'))
   self.events.append({'kind':'initial_periodic_control_question_returned','before':before['observation_ref'],'after':after['observation_ref'],'question_key':proposal['support_plan']['question_key'],'mechanical_acquisition':acquired,'parent':'G_official_completion','remaining_unknowns':['unobserved controls and untested scope changes']})
   result={**result,'events':self.events}
  return result
