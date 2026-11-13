"""Conditional joint occupation provider; geometric calculations have no release authority."""
from pathlib import Path
from copy import deepcopy
import hashlib,json,time
from joint_transport_geometry import measure,successor,exact_path

def digest(v):return hashlib.sha256(json.dumps(v,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def state_pair(s):return [list(s['player']),[list(x)for x in sorted(s['boxes'])]]
def layers(s):return {'scale':s['scale'],'offset':list(s['offset']),'floor':[list(x)for x in sorted(s['floor'])],'targets':[list(x)for x in sorted(s['targets'])]}
class JointTransport:
 def __init__(self):
  self.config=json.loads(Path(__file__).with_name('common_frontier_policy.drm.json').read_text())['joint_transport_question'];self.epoch=None;self.support=None;self.operators={};self.push_confirmed=False;self.refs=[];self.events=[];self.plan=[];self.authorizations={};self.method_origin=[];self.rejected=[];self.level_deadline=None
 def state(self):return deepcopy({k:getattr(self,k)for k in ['epoch','support','operators','push_confirmed','refs','events','plan','authorizations','method_origin','rejected']})
 def restore(self,s):
  for k in self.state():
   if k in s:setattr(self,k,deepcopy(s[k]))
 def enter(self,epoch):
  if self.epoch!=epoch:self.epoch=epoch;self.support=None;self.plan=[];self.authorizations={};self.rejected=[]
 def scene(self,rows,support=None):
  try:return measure(rows,[tuple(x)for x in (support or {}).get('targets',[])])
  except (ValueError,IndexError,TypeError):return None
 def propose(self,obs,rows,inputs,remaining):
  if remaining<1 or not self.config['enabled'] or self.level_deadline is None or time.perf_counter()>=self.level_deadline:return None
  self.enter(obs['level_epoch']);s=self.scene(rows,self.support)
  if not s or len(s['floor'])>self.config['maximum_floor_cells']or len(s['boxes'])>self.config['maximum_bodies']:return None
  current=layers(s);key=digest([current,state_pair(s)])
  if key in self.rejected:return None
  if self.support is not None and current!=self.support:return None
  directions=self.config['hypotheses']['action_directions'];available={a['action_ref']for a in inputs if not a.get('data')};directions={a:d for a,d in directions.items()if a in available}
  if not directions:return None
  if not self.plan or self.plan[0]['before']!=state_pair(s):
   try:path,states,dead=exact_path(s,directions,self.level_deadline)
   except ValueError:return None
   if not path or len(path)>remaining:return None
   before=state_pair(s);self.plan=[]
   for a,push,pair in path:
    after=[list(pair[0]),[list(x)for x in sorted(pair[1])]];self.plan.append({'action_ref':a,'push':push,'before':before,'after':after});before=after
  if len(self.plan)>remaining:return None
  self.support=current;prefix=[]
  for step in self.plan:
   if step['action_ref']not in available:return None
   prefix.append(step)
   if step['action_ref']not in self.operators or(step['push']and not self.push_confirmed)or len(prefix)>=min(16,remaining):break
  actions=[{'action_ref':x['action_ref']}for x in prefix];steps=[{'action':a,'expected_before':deepcopy(x['before']),'expected_after':deepcopy(x['after']),'unknown_method':x['action_ref']not in self.operators or(x['push']and not self.push_confirmed),'push':x['push']}for a,x in zip(actions,prefix)];probe=any(x['unknown_method']for x in steps)
  ref='C_joint_transport_'+digest([obs['observation_ref'],current,actions])[:20];evidence=[obs['observation_ref']]+self.refs[-6:];why='Prepare the required support faces while preserving a complete joint occupation route under the explicitly provisional single-body contact model; validate the first unknown command or contact before continuing.'
  binding={k:obs[k]for k in ['observation_ref','level_epoch','levels_completed','frame_hash']};plan={'joint_transport':True,'layers':current,'binding':binding,'hypotheses':deepcopy(self.config['hypotheses']),'remaining_joint_cost':len(self.plan),'recalled_method_refs':self.method_origin[-8:],'role_status':self.config['role_status'],'role_hypotheses':deepcopy(self.config['roles']),'context_key':key};auth=digest([binding,actions,steps,plan]);self.authorizations[ref]=auth;plan['authorization_ref']=ref
  facts={'current_joint_transport_geometry':True,'complete_conditional_joint_route':True,'first_unknown_input_seals':True};comp={'id':ref,'observed':False,'role':'conditional_joint_occupation','open_question':why,'properties':{'transported_count':len(s['boxes']),'target_count':len(s['targets']),'scope':current,'hypotheses':deepcopy(self.config['hypotheses']),'method_recall_evidence':self.method_origin[-8:]},'relations':['contributes_to:G_official_completion']}
  return {'status':'proposed','kind':'conditional_joint_transport','support_plan':plan,'actions':actions,'steps':steps,'facts':facts,'binding':binding,'compositions':[comp],'question':{'reason':why,'hypothesis_refs':evidence,'unknowns':['current command sign until tested','single body contact until tested','terminal role until official score']},'route_refs':evidence,'bundle_template':{'operation_key':'OP18'if probe else'OP28','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'purpose':why,'preconditions':facts,'evidence':evidence,'actions':actions,'outcome_guard':{'path':['value'],'contains':ref if probe else'B0'}}}
 def before(self,p,i,public,obs):
  plan=p['support_plan'];authplan={k:v for k,v in plan.items()if k!='authorization_ref'};ok=0<=i<len(p['steps']) and self.authorizations.get(plan['authorization_ref'])==digest([p['binding'],p['actions'],p['steps'],authplan])
  ok=ok and obs['level_epoch']==p['binding']['level_epoch']==public.level and obs['levels_completed']==p['binding']['levels_completed']==public.levels_completed and p['actions'][i]==p['steps'][i]['action'] and p['actions'][i]['action_ref']in public.available_action_refs and not p['actions'][i].get('data')
  if i==0:ok=ok and obs['observation_ref']==p['binding']['observation_ref'] and public.frame_hash==p['binding']['frame_hash']
  s=self.scene(public.frame_rows,plan['layers']);ok=ok and s is not None and layers(s)==plan['layers'] and state_pair(s)==p['steps'][i]['expected_before']
  return {'admitted':bool(ok),'reason':'current_joint_body_support_target_and_exact_input'if ok else'joint_transport_binding_or_preservation_changed'}
 def after(self,p,i,before,after,first,second):
  if after['levels_completed']>before['levels_completed']:return {'matched':None,'seal_prefix':True,'reason':'official_boundary_distinct_from_last_geometric_prediction'}
  s=self.scene(second,p['support_plan']['layers']);ok=s is not None and layers(s)==p['support_plan']['layers']and state_pair(s)==p['steps'][i]['expected_after'];unknown=p['steps'][i]['unknown_method']
  return {'matched':None if unknown else bool(ok),'seal_prefix':unknown or not ok,'geometry_matched':bool(ok),'reason':'joint_effect_observed_for_method_reconciliation'if ok else'joint_effect_or_preservation_contradiction'}
 def record(self,before,after,command,first,second,proposal=None,index=None,*,frames=None):
  if not proposal or not proposal.get('support_plan',{}).get('joint_transport'):return {'events':[]}
  i=0 if index is None else index
  if command!=proposal['actions'][i]:return {'events':[]}
  refs=[before['observation_ref'],after['observation_ref']];self.refs=list(dict.fromkeys(self.refs+refs));post=self.after(proposal,i,before,after,first,second)
  if after['level_epoch']!=before['level_epoch']:
   event={'status':'official_boundary','evidence':refs,'last_geometric_effect_unconfirmed':True,'method_preserved':True};self.enter(after['level_epoch'])
  elif post.get('geometry_matched'):
   self.operators[command['action_ref']]=deepcopy(self.config['hypotheses']['action_directions'][command['action_ref']]);self.push_confirmed|=proposal['steps'][i]['push'];self.method_origin=list(dict.fromkeys(self.method_origin+refs));self.plan=self.plan[1:] if self.plan and self.plan[0]['before']==proposal['steps'][i]['expected_before'] else [];event={'status':'observed_joint_translation','push':proposal['steps'][i]['push'],'evidence':refs,'model_universal':False}
  else:
   self.rejected.append(proposal['support_plan']['context_key']);self.plan=[];event={'status':'joint_model_contradiction','evidence':refs,'preservation_not_discarded':True}
  self.events=(self.events+[event])[-32:];return {'events':[event]}
