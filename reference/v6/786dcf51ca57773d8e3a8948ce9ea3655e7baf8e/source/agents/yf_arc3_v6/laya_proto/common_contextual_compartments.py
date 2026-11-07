"""Acquire compartment controls from current frames and sealed local responses."""
from collections import Counter
from pathlib import Path
import json
from common_fixed_origin import parts,box
from common_multiscale_constraints import digest
from common_control_dependencies import ControlDependencies
from agents.yf_arc3_v5.capabilities.program_instruction_shape_d import measure_program_instruction_shape_d
from observed_input_domain import ObservedInputDomain
from src_bridge import plain

def measure(rows,mark=None):
 h,w=len(rows),len(rows[0]);background=Counter(v for row in rows for v in row).most_common(1)[0][0];frames=[]
 for c in parts(rows):
  l,t,r,b=box(c);ww=r-l+1;hh=b-t+1
  if c.value==background or not (3<=ww<=w//5 and hh>=max(7,ww+2) and hh<=h//2):continue
  pixels=set(c.pixels);sides=sum((y,x) in pixels for y in range(t,b+1) for x in (l,r))
  if sides<2*hh*2//3:continue
  shape=measure_program_instruction_shape_d(tuple(sorted(c.pixels)));closed=bool(shape.get('rectangle_border_only'))
  contents=Counter(rows[y][x] for y in range(t+1,b) for x in range(l+1,r) if rows[y][x] not in (background,c.value));filled=sum(contents.values())
  region=[max(0,l-2*ww),t,min(w-1,r),b];a,tt,rr,bb=region;local=digest([list(row[a:rr+1]) for row in rows[tt:bb+1]])
  frames.append({'box':[l,t,r,b],'border':c.value,'closed':closed,'filled':filled,'contents':sorted(contents.items()),'point':[(l+r)//2,(t+b)//2],'local':local,'region':region,'shape':digest([ww,hh,tuple(sorted(c.relative_pixels))])})
 if len(frames)<5:return None
 frames.sort(key=lambda f:f['box']);counts=Counter(f['border'] for f in frames);normal=counts.most_common(1)[0][0];marked=[v for v in frames if v['border']!=normal] if mark is None else [v for v in frames if v['border']==mark]
 if mark is None:
  if not marked or len({v['border'] for v in marked})!=1:return None
  mark=marked[0]['border']
 return {'frames':frames,'marked':marked,'mark':mark,'normal':normal,'background':background,'key':digest([[v['box'],v['border'],v['filled'],v['contents'],v['local']] for v in frames])}

class ContextualCompartments:
 def __init__(self):self.epoch=None;self.mark=None;self.refs=[];self.tried=set();self.pending=None;self.events=[];self.passed=[];self.transitions={};self.receipts=[];self.dependencies={};self.terminal_shapes=[];self.productive=set()
 def record(self,before,after,command,first,second,proposal=None,index=None,frames=None):
  self.events=[];a=measure(first,self.mark);b=measure(second,a['mark'] if a else self.mark)
  if not a:return {'status':'compartment_domain_absent','events':[]}
  if self.epoch!=before['level_epoch']:self.epoch=before['level_epoch'];self.pending=None;self.tried=set();self.dependencies={}
  owned=bool(proposal and proposal.get('support_plan',{}).get('contextual_compartments'))
  if after['levels_completed']>before['levels_completed']:
   if owned:
    control=proposal['steps'][index]['control'];self.terminal_shapes.append({'shape':control['shape'],'box':control['box'],'layout':[{'box':v['box'],'shape':v['shape']} for v in a['frames'] if v['closed']],'evidence':[before['observation_ref'],after['observation_ref']]})
   self.passed.append({'before':before['observation_ref'],'after':after['observation_ref'],'command':command,'method':'contextual_compartment_progression'});self.events=[{'kind':'compartment_official_boundary','before':before['observation_ref'],'after':after['observation_ref']}];self.pending=None;self.epoch=None;return {'status':'compartment_boundary','events':self.events}
  if not owned:return {'status':'compartment_unowned_observation','events':[]}
  chosen=proposal['steps'][index]['control'];key=proposal['steps'][index]['question_key'];self.tried.add(key);point=chosen['point'];l,t,r,bb=chosen['region'];changed=any(first[y][x]!=second[y][x] for y in range(t,bb+1) for x in range(l,r+1));self.mark=chosen['border'];self.refs.append(after['observation_ref'])
  if changed:self.productive.add(key)
  else:self.productive.discard(key)
  if b:
   old={tuple(v['box']):v for v in a['frames']};new={tuple(v['box']):v for v in b['frames']};related=self.dependencies.setdefault(tuple(chosen['box']),set())
   for position in old.keys() & new.keys():
    if position!=tuple(chosen['box']) and old[position]['contents']!=new[position]['contents']:related.add(position)
   current=new.get(tuple(chosen['box']))
   if related and current and current['contents']==chosen['contents'] and chosen['filled']:
    receivers=[{'box':v['box'],'contents':v['contents'],'border':v['border']} for v in b['frames'] if tuple(v['box']) in related]
    self.tried.add(ControlDependencies.question_key(before['level_epoch'],'contextual_compartment_control',{'box':current['box'],'local':current['local'],'filled':current['filled'],'receivers':receivers},[]))
  # A locally changing operation keeps one bounded question open. A repeated
  # unchanged local context closes it; no timer, yield or unseen job is invented.
  self.pending={'control':chosen,'local':digest([list(row[l:r+1]) for row in second[t:bb+1]]),'ref':after['observation_ref']} if changed and not chosen['filled'] else None
  effect={'kind':'contextual_compartment_response','before':before['observation_ref'],'after':after['observation_ref'],'control_box':chosen['box'],'local_changed':changed,'before_filled_pixels':chosen['filled'],'hypotheses':['contextual operation','selection or indication remains possible until transfer measured'],'unknowns':['native clock debit','freshness unit','recipe multiplicity','job duration']};self.receipts.append(effect);self.events=[effect]
  if b:
   signature=digest([a['key'],command]);entry={'before':a,'after':b,'action':command,'control':chosen,'evidence':[before['observation_ref'],after['observation_ref']]};prior=self.transitions.get(signature)
   if prior and prior['after']['key']!=b['key']:self.transitions[signature]={'ambiguous':True,'outcomes':[prior.get('after',{}).get('key'),b['key']]}
   elif not prior:self.transitions[signature]=entry
  return {'status':'compartment_response_retained','events':self.events}
 def choose(self,scene,obs):
  mark=self.mark if self.mark in {v['border'] for v in scene['frames']} else scene['mark'];candidates=[v for v in scene['frames'] if v['border']==mark]
  terminal=[]
  current={(tuple(v['box']),v['shape']) for v in scene['frames'] if v['closed']}
  for v in scene['frames']:
   for memory in self.terminal_shapes:
    if v['box'][2]-v['box'][0]!=memory['box'][2]-memory['box'][0]:continue
    dx=v['box'][0]-memory['box'][0];dy=v['box'][1]-memory['box'][1]
    expected={(tuple(z+(dx if i%2==0 else dy) for i,z in enumerate(a['box'])),a['shape']) for a in memory['layout']}
    if len(expected)>2 and expected<=current:terminal.append(v);break
  # A unique current homologue recalls the score-associated output. Its marked
  # adjacent left process is only a candidate enabling relation, not a recipe.
  def goal_rank(v):
   if len(terminal)!=1:return 1
   target=terminal[0];l,t,r,b=v['box'];ll,tt,rr,bb=target['box']
   return 0 if v is target or (0<ll-r<=2*(rr-ll+1) and min(b,bb)>=max(t,tt)) else 1
  candidates.sort(key=lambda v:(goal_rank(v),not v['closed'],not bool(v['filled']),v['box'][1],v['box'][0]))
  for candidate in candidates:
   receivers=[{'box':v['box'],'contents':v['contents'],'border':v['border']} for v in scene['frames'] if tuple(v['box']) in self.dependencies.get(tuple(candidate['box']),set())]
   key=ControlDependencies.question_key(obs['level_epoch'],'contextual_compartment_control',{'box':candidate['box'],'local':candidate['local'],'filled':candidate['filled'],'receivers':receivers},[])
   if key not in self.tried or (goal_rank(candidate)==0 and key in self.productive):return candidate,key
  if self.pending:
   candidate=dict(self.pending['control']);candidate['local']=self.pending['local'];key=ControlDependencies.question_key(obs['level_epoch'],'contextual_compartment_control',{'box':candidate['box'],'local':candidate['local'],'filled':candidate['filled']},[])
   if key not in self.tried:return candidate,key
  return None,None
 def propose(self,obs,rows,inputs,remaining):
  if not json.loads(Path(__file__).with_name('common_frontier_policy.drm.json').read_text()).get('contextual_compartments',{}).get('enabled') or 'ACTION6' not in obs['available_action_refs'] or remaining<1:return None
  scene=measure(rows,self.mark)
  if not scene:return None
  if self.epoch!=obs['level_epoch']:self.epoch=obs['level_epoch'];self.tried=set();self.pending=None;self.dependencies={}
  current=scene;steps=[];actions=[];seen=set()
  for unused in range(min(16,remaining)):
   chosen,key=self.choose(current,obs)
   if chosen is None or key in seen:break
   seen.add(key);action={'action_ref':'ACTION6','data':dict(zip(('x','y'),chosen['point']))};known=self.transitions.get(digest([current['key'],action]));known=known if known and not known.get('ambiguous') else None
   step={'action':action,'control':chosen,'question_key':key,'expected_before':current['key'],'expected_after':known['after']['key'] if known else None,'probe':not bool(known),'locus_witness':ObservedInputDomain.make_locus_witness(obs,rows,tuple(chosen['point']),reason='Test currently distinguished compartment control; no recipe or deadline supplied.',evidence=[obs['observation_ref']])};actions.append(action);steps.append(step)
   if not known:break
   current=known['after']
  if not actions:return None
  why='Revalidate any score-associated output through current compartment anchors, then test its marked enabling neighbor. Otherwise test a currently distinguished compartment. Highlight and adjacency remain revisable hypotheses. Preserve local progress; reopen a command only when its observed receiver or local premises change.';facts={'repeated_compartments_measured':True,'current_mark_contrast_present':True,'control_context_bound':True};ref='C_compartment_'+digest([obs['observation_ref'],actions])[:16];evidence=[obs['observation_ref']]+self.refs[-4:];plan={'contextual_compartments':True,'frame_hash':obs['frame_hash'],'scene_key':scene['key'],'mark':scene['mark'],'prior_boundaries':self.passed[-3:],'recalled_output_anchors':self.terminal_shapes[-3:],'receiver_dependencies':[{'control':list(k),'receivers':[list(v) for v in sorted(vs)]} for k,vs in self.dependencies.items()],'unknowns':['typed freshness calibration','complete job and recipe law','partial contour residual','causal necessity of adjacent process']}
  return {'status':'proposed','kind':'contextual_compartment_question','support_plan':plan,'actions':actions,'steps':steps,'facts':facts,'compositions':[{'id':ref,'role':'compartment_control_question','observed':False,'open_question':why,'properties':{'candidate_count':len(scene['marked'])},'relations':['contributes_to:G_official_completion']}],'question':{'reason':why,'hypothesis_refs':evidence},'route_refs':evidence,'binding':{'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'levels_completed':obs['levels_completed']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'purpose':why,'preconditions':facts,'evidence':evidence,'actions':actions,'frozen_support_plan':plain(plan),'outcome_guard':{'path':['value'],'contains':ref}}}
 def before(self,p,i,public,obs):
  s=measure(public.frame_rows,p['support_plan']['mark']);ok=s is not None and s['key']==p['steps'][i]['expected_before'] and public.level==p['binding']['level_epoch'] and public.levels_completed==p['binding']['levels_completed']
  if i==0:ok=ok and public.frame_hash==p['support_plan']['frame_hash']
  return {'admitted':bool(ok),'reason':'current_compartment_occurrences_and_context'}
 def after(self,p,i,before,after,first,second):
  if after['levels_completed']>before['levels_completed']:return {'matched':None,'seal_prefix':True,'reason':'official_boundary'}
  if p['steps'][i]['expected_after'] is None:return {'matched':None,'seal_prefix':True,'reason':'unknown_compartment_response'}
  s=measure(second,p['support_plan']['mark']);ok=s is not None and s['key']==p['steps'][i]['expected_after'];return {'matched':bool(ok),'seal_prefix':not ok,'reason':'remembered_local_composition' if ok else 'compartment_context_diverged'}
