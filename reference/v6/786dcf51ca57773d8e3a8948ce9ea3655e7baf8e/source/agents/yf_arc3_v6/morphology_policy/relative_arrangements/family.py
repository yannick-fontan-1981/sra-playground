from pathlib import Path
from copy import deepcopy
from terminal_composition import identity
from agents.yf_arc3_v5.drm.loader import load_drm_document
from agents.yf_arc3_v6.morphology_policy.src_runtime import SrcProgram
from .geometry import project,translated_targets,effect
from .planner import options
HERE=Path(__file__).resolve().parent

class RelativeArrangements:
 def __init__(self):
  declaration,=load_drm_document(HERE/'relative_arrangements.drm').document.declarations;self.config=dict(declaration.configuration)
  self.models=[];self.events=[];self.failed=set();self.selection_ref=None;self.epoch=None;self.last_layout=None;self.last=None
  self.src=SrcProgram(HERE/'relative_arrangements.src','v6.relative_arrangements.choose',{'arrangement.measure':self.measure,'arrangement.compose':self.compose,'arrangement.bind':self.select})
 def measure(self,request):
  obs,rows,inputs,remaining=self.context
  if self.epoch!=obs['level_epoch']:
   self.models=[];self.failed=set();self.selection_ref=None;self.epoch=obs['level_epoch']
  self.last_layout=project(obs,rows)
  return {'qualified':self.last_layout is not None,'remaining':remaining}
 def compose(self,measured):
  if not measured['qualified'] or measured['remaining']<1:return {'options':[]}
  return {'options':options(self.last_layout,translated_targets(self.last_layout),self.models,self.selection_ref,self.failed,self.config)}
 def select(self,composed):
  self.last={'status':'conditional_offer' if composed['options'] else 'no_bound_geometric_experiment','alternatives':len(composed['options'])}
  self.picked=composed['options'][0] if composed['options'] else None
  return {'selected':bool(self.picked)}
 def propose(self,obs,rows,inputs,remaining):
  self.context=(obs,rows,inputs,remaining);answer,receipt=self.src.run({'request':{'observation_ref':obs['observation_ref']}})
  if not answer['selected'] or 'ACTION6' not in obs['available_action_refs']:return None
  offer=self.picked;x,y=offer['point'];action={'action_ref':'ACTION6','data':{'x':x,'y':y}};focus='composition:relative_arrangement:'+identity([obs['observation_ref'],offer['goal']['target']])[:20]
  supports=[e for e in obs['entities'] if e['bbox'][0]<=x<=e['bbox'][2] and e['bbox'][1]<=y<=e['bbox'][3] and [x-e['position'][0],y-e['position'][1]] in [list(p) for p in e['mask']]]
  if len(supports)!=1:return None
  support=supports[0]
  refs=[obs['observation_ref'],*offer['model_evidence']];facts={'relative_model_current':True,'actuator_experiment_current':True}
  plan={'offer':offer,'projection':self.last_layout,'workflow':receipt,'question':self.config['question']}
  return {'status':'proposed','kind':'public_relative_arrangement','actions':[action],
   'steps':[{'action':action,'expected_before':{'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash']},'expected_after':None,
    'point_binding':{'observation_ref':obs['observation_ref'],'entity_ref':support['id'],'signature':support['signature'],'bbox':list(support['bbox']),
      'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash'],'point':[x,y],'palette_value':rows[y][x],'source':'measured_arrangement_participant_or_actuator'}}],
   'facts':facts,'binding':{'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'levels_completed':obs['levels_completed'],'frame_hash':obs['frame_hash']},'arrangement_plan':plan,
   'compositions':[{'id':focus,'role':'information_question','observed':False,'things':['measured_participants','visible_relative_model','current_actuator'],
    'properties':{'target':offer['goal']['target'],'assumptions':offer['assumptions'],'risks':offer['risks'],'falsifiers':offer['falsifiers']},'relations':['contributes_to:G_official_completion'],'open_question':self.config['question']}],
   'question':{'reason':self.config['question'],'hypothesis_refs':refs},'route_refs':refs,
   'bundle_template':{'operation_key':'OP18','composition_ref':focus,'objective_ref':'G_official_completion','preserve_refs':[],
    'purpose':self.config['question'],'preconditions':facts,'evidence':refs,'actions':[action],'outcome_guard':{'path':['value'],'contains':focus}}}
 def bind(self,proposal,domain):
  # Explicit composition-derived loci are already bound by measured pixels and full scope.
  for action,step in zip(proposal['actions'],proposal['steps'],strict=True):
   if step['point_binding']['point']!=[action['data']['x'],action['data']['y']]:raise ValueError('Unbound arrangement point')
 def before(self,proposal,index,public,obs):
  bind=proposal['binding'];action=proposal['actions'][index];step=proposal['steps'][index];plan=proposal['arrangement_plan'];point=action['data']
  scope=public.level==bind['level_epoch'] and public.levels_completed==bind['levels_completed'] and public.frame_hash==bind['frame_hash'] and obs['observation_ref']==bind['observation_ref']
  ok=scope and action==step['action'] and action['action_ref'] in public.available_action_refs and [point['x'],point['y']]==plan['offer']['point'] and public.frame_rows[point['y']][point['x']]==step['point_binding']['palette_value']
  return {'admitted':ok,'reason':'current_arrangement_and_control_locus' if ok else 'arrangement_or_control_scope_changed'}
 def after(self,proposal,index,before,after,first,second):return {'matched':None,'seal_prefix':True,'reason':'measure_selected_participant_and_actuator_effect'}
 def record(self,before,after,command,first,second,proposal,index):
  if command!=proposal['actions'][index] or before['observation_ref']!=proposal['binding']['observation_ref']:raise ValueError('Unbound arrangement response')
  plan=proposal['arrangement_plan'];old=plan['projection'];new=project(after,second)
  if after['levels_completed']>before['levels_completed']:event={'status':'official_boundary','hypothesis':plan['offer']['goal']['target'],'evidence':[before['observation_ref'],after['observation_ref']]}
  else:
   event=effect(old,new,command)
   if event['status']=='selection_observed':self.selection_ref=after['observation_ref']
   if event['status']=='single_object_and_actuator_displacement':
    event['selection_ref']=self.selection_ref;self.models.append(deepcopy(event))
   elif 'trial' in plan['offer']:
    trial=plan['offer']['trial'];self.failed.add((tuple(trial[0]),trial[1],tuple(trial[2]),tuple(trial[3])))
  event['expected']=plan['offer']['predictions'];event['risks']=plan['offer']['risks'];self.events.append(event);return event
 def state(self):return {'models':deepcopy(self.models),'events':deepcopy(self.events),'failed':list(self.failed),'selection_ref':self.selection_ref,'epoch':self.epoch}
 def restore(self,state):
  self.models=deepcopy(state['models']);self.events=deepcopy(state['events']);self.failed={(tuple(t[0]),t[1],tuple(t[2]),tuple(t[3])) for t in state['failed']};self.selection_ref=state['selection_ref'];self.epoch=state['epoch']
