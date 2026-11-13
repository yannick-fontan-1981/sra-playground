from pathlib import Path
from copy import deepcopy
import hashlib,json
from agents.yf_arc3_v5.capabilities import BoundingBox,ComponentExtractionInput,FrameGrid,InteractionProbeInput,detect_components
from agents.yf_arc3_v5.capabilities.interaction import _compatible_control_zone_cell_routes,_compact_body_perimeter_marker_accompaniment
from agents.yf_arc3_v5.logos.types import FrozenMap
from .policy import OutlinePolicy

def digest(value):return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def boxes(rows):
 out=[]
 for c in detect_components(ComponentExtractionInput(frame=FrameGrid(rows=tuple(map(tuple,rows))),connectivity=4)).components:
  b=c.bbox;w=b.width;h=b.height
  if not(3<=w<=16 and 3<=h<=16):continue
  rim={(y,x)for y in range(h)for x in range(w)if y in(0,h-1)or x in(0,w-1)}
  if set(c.relative_pixels)!=rim:continue
  out.append({'bbox':[b.left,b.top,b.right,b.bottom],'value':c.value,'width':w,'height':h,'signature':digest([w,h,c.value]),'interior':[list(row[b.left+1:b.right])for row in rows[b.top+1:b.bottom]],'component_ref':c.component_id})
 return out

def same_box(rows,box,value):
 l,t,r,b=box
 return 0<=l<=r<len(rows[0])and 0<=t<=b<len(rows)and all(rows[y][x]==value for y in range(t,b+1)for x in range(l,r+1)if x in(l,r)or y in(t,b))

class OutlineService:
 def __init__(self):
  self.policy=OutlinePolicy();self.config=self.policy.config;self.epoch=None;self.control=None;self.tracks={};self.methods=[];self.attempts={};self.last=None;self.last_event=None
 def state(self):return deepcopy({'epoch':self.epoch,'control':self.control,'tracks':self.tracks,'methods':self.methods,'attempts':self.attempts,'last':self.last,'last_event':self.last_event})
 def restore(self,v):
  for k in ('epoch','control','tracks','methods','attempts','last','last_event'):
   if k in v:setattr(self,k,deepcopy(v[k]))
 def scope(self,obs,rows):
  if self.epoch==obs['level_epoch']:return
  prior=self.control;self.epoch=obs['level_epoch'];self.tracks={};self.attempts={};self.control=None;self.last=None
  if prior:
   current=[b for b in boxes(rows)if b['signature']==prior['signature']]
   if len(current)==1:self.control={**current[0],'controls':{},'transitions':[],'interior_contrast':False,'evidence':[],'recalled_method':{'source_epoch':prior['level_epoch'],'source_signature':prior['signature'],'evidence':prior['evidence']},'level_epoch':self.epoch,'status':'recalled_outline_hypothesis_current_unique'}
 def current(self,obs,rows):
  if not self.control:return None
  matches=[b for b in boxes(rows)if b['signature']==self.control['signature']]
  return matches[0]if len(matches)==1 else None
 def measure(self,obs,rows):
  current=self.current(obs,rows)
  if not current:return None
  l,t,r,b=current['bbox'];box=BoundingBox(left=l,top=t,right=r,bottom=b);frame=FrameGrid(rows=tuple(map(tuple,rows)));components=detect_components(ComponentExtractionInput(frame=frame,connectivity=4))
  controls=self.control.get('controls',{});prior=self.config['interface_prior'];refs=self.control['evidence']
  transitions=[v for v in self.control.get('transitions',[])if v['level_epoch']==obs['level_epoch']]
  control_facts={'current_outline_revalidated':True,'current_transition_evidence':bool(transitions),'interior_contrast_observed':bool(self.control.get('interior_contrast')),'recalled_method_current_unique':bool(self.control.get('recalled_method'))}
  binding,binding_workflow=self.policy.bind_control(control_facts)
  if binding['status']!='unique':return None
  role=binding['conclusions'][0]
  current_transitions=[v for v in transitions if v['after']==obs['observation_ref']]
  current_boxes=[BoundingBox(left=v['to'][0],top=v['to'][1],right=v['to'][2],bottom=v['to'][3])for v in current_transitions]
  distinct_count=current_transitions[-1]['distinct_translated_count']if current_transitions else 0
  # The term carries only the observed/revalidated controlled outline, never a game role.
  value=InteractionProbeInput(route_generation_policy=self.policy.route_config,frame=frame,components=components,available_action_refs=tuple(obs['available_action_refs']),canonical_provisional_control_term_facts=(FrozenMap({'term_ref':role['term_ref']+':'+current['signature'],'entity_ref':current['component_ref']}),),canonical_provisional_control_geometry_bboxes=(box,),input_aligned_entity_bboxes=(box,),current_action_conditioned_control_outline_bboxes=(box,),translated_entity_bboxes=tuple(current_boxes),observed_translated_entity_bboxes=tuple(current_boxes),observed_distinct_translated_entity_count=distinct_count,observed_controlled_translation_count=len(transitions),known_action_translation_deltas=tuple((a,v['delta'][1],v['delta'][0])for a,v in controls.items()),interface_action_translation_deltas=tuple((a,d[1],d[0])for a,d in prior['directions'].items()),last_action_ref=(self.last or{}).get('action_ref'))
  routes,zone=_compatible_control_zone_cell_routes(value);accompaniment,relation=_compact_body_perimeter_marker_accompaniment(value)
  key=digest([obs['level_epoch'],current['bbox'],current['interior'],zone.get('compatible_control_zone_cell_middle_positions')])
  facts={'current_scope_and_observation':True,'exact_locus':bool(zone.get('current_body_exactly_occupies_compatible_control_zone_cell')),'unique_locus_route':len(routes)==1,'unique_mobile_correspondence':len(accompaniment)==1,'local_operator_observed':any(m['status']=='observed_local_change'for m in self.methods),'immediate_other_contact':relation.get('other_compact_body_marker_immediate_contact_count',0)>0,'lead_on_announced_cell':bool(relation.get('controlled_lead_bbox_matches_cardinal_marker_cell')),'untried_current_context':key not in self.attempts}
  return {'control_binding':binding,'control_workflow':binding_workflow,'current_transitions':transitions,'current':current,'routes':routes,'zone':zone,'accompaniment':accompaniment,'relation':relation,'facts':facts,'context_key':key}
 def propose(self,obs,rows,inputs,remaining):
  self.scope(obs,rows)
  if not self.control or remaining<1:return None
  measured=self.measure(obs,rows)
  if not measured:return None
  decision,receipt=self.policy.evaluate(measured['facts'])
  if decision['status']!='unique':return None
  meaning=decision['conclusions'][0];kind=meaning['kind'];prior=self.config['interface_prior'];current=measured['current'];operator=kind in('local_operator_hypothesis','local_obstruction_hypothesis')
  if operator:commands=[prior['interaction']]
  elif kind=='locus_access_hypothesis':commands=list(next(iter(measured['routes'].values()))['compatible_control_zone_cell_route_action_refs'])
  else:commands=[next(iter(measured['accompaniment']))]
  if len(commands)>min(remaining,16)or any(a not in obs['available_action_refs']for a in commands):return None
  actions=[{'action_ref':a}for a in commands];steps=[];position=current['bbox'][:]
  for i,a in enumerate(commands):
   before=position[:];delta=prior['directions'].get(a)
   if delta:
    actual=self.control.get('controls',{}).get(a,{}).get('delta',[delta[0]*current['width'],delta[1]*current['height']]);position=[position[0]+actual[0],position[1]+actual[1],position[2]+actual[0],position[3]+actual[1]]
   steps.append({'action':actions[i],'body_before':before,'expected_after':None if operator else {'body_bbox':position[:],'qualification':'conditional_control_displacement'},'seal_after':i==len(commands)-1})
  locus_patch=[]
  if kind=='locus_access_hypothesis':
   locus_ref=next(iter(measured['routes'].values()))['compatible_control_zone_cell_component_ref']
   found=[c for c in detect_components(ComponentExtractionInput(frame=FrameGrid(rows=tuple(map(tuple,rows))),connectivity=4)).components if c.component_id==locus_ref]
   if len(found)!=1:return None
   z=found[0].bbox;locus_patch=[[x,y,rows[y][x]]for y in range(z.top,z.bottom+1)for x in range(z.left,z.right+1)]
  evidence=list(dict.fromkeys(self.control['evidence']+[obs['observation_ref']]));focus='composition:outline_service:'+digest([obs['observation_ref'],meaning,measured['zone'],measured['relation']]);facts={'current_outline_service_bound':True};binding={k:obs[k]for k in('observation_ref','level_epoch','levels_completed','frame_hash')}
  return {'status':'proposed','kind':'public_outline_service','actions':actions,'steps':steps,'facts':facts,'binding':binding,'outline_plan':{'measurement':measured,'meaning':meaning,'workflow':receipt,'operator':operator,'locus_patch':locus_patch,'control':deepcopy(self.control),'drm_sha256':hashlib.sha256((Path(__file__).parent/'outline.drm').read_bytes()).hexdigest()},'route_refs':evidence,'compositions':[{'id':focus,'role':meaning['role'],'observed':False,'things':[current['signature']],'properties':{'conditional':True,'current_measurement':measured,'recalled_control_method':self.control.get('recalled_method'),'unknown':['local_effect','autonomous_policy','terminal_rule','contact_consequence'],'falsifiers':['outline_did_not_follow','locus_changed','ambiguous_control','current_preservation_violated']},'relations':['contributes_to:'+self.config['goal']],'open_question':meaning['question']}],'question':{'reason':meaning['question'],'hypothesis_refs':[meaning['rule_ref'],meaning['mechanism_ref']]},'bundle_template':{'operation_key':meaning['operation'],'composition_ref':focus,'objective_ref':self.config['goal'],'purpose':meaning['question'],'preconditions':facts,'evidence':evidence,'actions':actions,'preserve_refs':[],'preservation_evidence':{},'outcome_guard':{'path':['value'],'contains':focus}}}
 def bind(self,proposal,preserve):
  if not proposal.get('steps')or [s.get('action')for s in proposal['steps']]!=proposal.get('actions'):raise ValueError('outline actions/steps mismatch')
  return None
 def locus_current(self,proposal,rows,body):
  l,t,r,b=body
  masked={(x,y)for y in range(t,b+1)for x in range(l,r+1)if x in(l,r)or y in(t,b)}
  return all((x,y)in masked or rows[y][x]==v for x,y,v in proposal['outline_plan'].get('locus_patch',[]))
 def before(self,proposal,index,public,obs):
  if obs['level_epoch']!=proposal['binding']['level_epoch']:return {'admitted':False,'reason':'scope_changed'}
  if index==0 and obs['frame_hash']!=proposal['binding']['frame_hash']:return {'admitted':False,'reason':'stale_frame'}
  if [s.get('action')for s in proposal.get('steps',[])]!=proposal.get('actions')or not 0<=index<len(proposal['steps']):return {'admitted':False,'reason':'action_step_binding_changed'}
  step=proposal['steps'][index];value=proposal['outline_plan']['measurement']['current']['value'];rows=public.frame_rows
  okay=same_box(rows,step['body_before'],value)and self.locus_current(proposal,rows,step['body_before'])and step['action']['action_ref']in obs['available_action_refs']
  return {'admitted':okay,'reason':'current_outline_and_sealed_action'if okay else'outline_or_command_changed'}
 def after(self,proposal,index,before,after,first,second):
  if before['level_epoch']!=after['level_epoch']:return {'matched':None,'seal_prefix':True,'reason':'official_boundary'}
  expected=proposal['steps'][index]['expected_after'];value=proposal['outline_plan']['measurement']['current']['value']
  if expected is None:return {'matched':None,'preservation_matched':None,'seal_prefix':True,'reason':'unknown_local_operator_effect_compare_public_return'}
  match=same_box(second,expected['body_bbox'],value)
  locus=self.locus_current(proposal,second,expected['body_bbox'])
  return {'matched':match,'preservation_matched':locus,'seal_prefix':not(match and locus),'reason':'conditional_outline_translation_compared'}
 def record(self,before,after,action,first,second,proposal=None,index=0):
  self.scope(before,first);earlier=boxes(first);later=boxes(second);cmd=action['action_ref'];refs=[before['observation_ref'],after['observation_ref']];event=None
  if before['level_epoch']!=after['level_epoch']:
   self.scope(after,second);return {'status':'boundary','evidence':refs}
  prior=self.config['interface_prior']['directions']
  # Count exact uniquely corresponding translated components separately from
  # the controlled-outline hypothesis. Autonomous movers are not discarded.
  before_components=detect_components(ComponentExtractionInput(frame=FrameGrid(rows=tuple(map(tuple,first))),connectivity=4)).components
  after_components=detect_components(ComponentExtractionInput(frame=FrameGrid(rows=tuple(map(tuple,second))),connectivity=4)).components
  def identity(c):return(c.value,tuple(c.relative_pixels))
  translated_count=0
  for c in before_components:
   same=[z for z in after_components if identity(z)==identity(c)];old=[z for z in before_components if identity(z)==identity(c)]
   if len(same)==len(old)==1 and c.bbox!=same[0].bbox:translated_count+=1
  if cmd in prior:
   for old in earlier:
    m=[x for x in later if x['signature']==old['signature']];p=[x for x in earlier if x['signature']==old['signature']]
    if len(m)!=1 or len(p)!=1:continue
    new=m[0];dx=new['bbox'][0]-old['bbox'][0];dy=new['bbox'][1]-old['bbox'][1]
    if not(dx or dy)or(dx!=0 and dy!=0):continue
    direction=prior[cmd]
    if (dx and (direction[0]==0 or dx*direction[0]<0))or(dy and(direction[1]==0 or dy*direction[1]<0)):continue
    track=self.tracks.setdefault(old['signature'],{'evidence':[],'controls':{},'interior_contrast':False,'transitions':[]});track['evidence']=list(dict.fromkeys(track['evidence']+refs));track['controls'][cmd]={'delta':[dx,dy],'evidence':refs};track['interior_contrast']|=old['interior']!=new['interior'];track['current']=new;track['transitions'].append({'before':before['observation_ref'],'after':after['observation_ref'],'action':cmd,'from':old['bbox'],'to':new['bbox'],'delta':[dx,dy],'level_epoch':before['level_epoch'],'distinct_translated_count':translated_count})
   eligible=[t for t in self.tracks.values()if t['interior_contrast']and len(t['evidence'])>=3]
   if len(eligible)==1:
    t=eligible[0];self.control={**t['current'],'controls':deepcopy(t['controls']),'transitions':deepcopy(t['transitions']),'interior_contrast':t['interior_contrast'],'evidence':t['evidence'],'level_epoch':self.epoch,'status':'translated_perimeter_with_observed_interior_contrast'}
  if proposal and proposal.get('outline_plan')and proposal['outline_plan']['operator']:
   plan=proposal['outline_plan'];l,t,r,b=plan['measurement']['current']['bbox'];changes=[(x,y,first[y][x],second[y][x])for y in range(t,b+1)for x in range(l,r+1)if first[y][x]!=second[y][x]]
   event={'status':'observed_local_change'if changes else'no_visible_local_change','evidence':refs,'action':action,'local_delta_sha256':digest(changes),'local_count':len(changes),'remote_change_count':sum(a!=b for y,(u,v)in enumerate(zip(first,second))for x,(a,b)in enumerate(zip(u,v))if not(l<=x<=r and t<=y<=b)),'scope':self.epoch,'unknown':['effect_cause','delayed_effect','autonomous_policy','terminal_rule']}
   self.attempts[plan['measurement']['context_key']]=event;self.methods.append(event);self.methods=self.methods[-32:]
  self.last=deepcopy(action);self.last_event=event;return event
