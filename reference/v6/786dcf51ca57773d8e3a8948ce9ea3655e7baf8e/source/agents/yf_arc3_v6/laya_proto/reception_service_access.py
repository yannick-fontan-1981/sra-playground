"""Current reception supposition using measured controls and bounded observation."""
import copy,time
from rooted_line_access import RootedLineAccess,input_candidates
from reception_service_projection import scene,carriers,path
from residual_access import ResidualAccess
from terminal_composition import identity
from src_bridge import plain
from agents.yf_arc3_v5.capabilities.reception_wait_contracts_d import ReceptionWaitBudgetD

class ReceptionServiceAccess(RootedLineAccess):
 def __init__(self):
  super().__init__();self.reception_memory={'epoch':None,'scene':None,'controls':{},'trials':{},'evidence':[],'wait_spent':0,'refuted':[],'residual_events':[]};self.reception_events=[]
 def retained_digest(self):return identity([super().retained_digest(),self.reception_memory,self.reception_events])
 def apply_event(self,e):
  if e.get('kind')!='observed_reception_service':return super().apply_event(e)
  self.reception_memory=copy.deepcopy(e['memory']);self.reception_events.append(e)
 def propose_graph(self,o,rows,inputs,limit,config):
  cfg=config.get('reception_service_question');m=copy.deepcopy(self.reception_memory);s=scene(rows,m['scene'])if cfg else None
  if s is None:return super().propose_graph(o,rows,inputs,limit,config)
  if time.perf_counter()>=config.get('level_deadline',float('inf')):return {'status':'unknown','reason':'reception_level_deadline','block_unrelated_probe':True}
  if m['epoch']!=o['level_epoch']:m.update(epoch=o['level_epoch'],scene=s,controls={},trials={},wait_spent=0,refuted=[])
  if m['refuted']:return {'status':'unknown','reason':'reception_control_projection_refuted','block_unrelated_probe':True}
  actors=carriers(rows,s);actor=actors[0]if len(actors)==1 else None;allowed={a['action_ref']for a in inputs if not a.get('data')};moves={k:v['delta']for k,v in m['controls'].items()if k in allowed};target=list(s['target']['anchor']);steps=[];kind='control_probe';why=cfg['control'];remaining=config.get('remaining_level_actions',limit)
  if actor and actor['anchor']!=target and moves:
   steps=path(rows,s,actor['anchor'],target,moves,remaining)or[]
   if steps:kind='access';why=cfg['access']+' '+cfg['preserve_other_contacts'];steps=steps[:min(limit,16)]
  if actor and actor['anchor']==target:
   outward=[k for k,d in moves.items()if [target[0]+d[0],target[1]+d[1]]not in s['cells']]
   if outward:
    key=sorted(outward)[0];confirmed=m.get('stationary',{}).get(key)==target;n=min(limit,16,remaining,cfg['wait_batch'])if confirmed else 1
    ledger=ReceptionWaitBudgetD(parent_goal_ref='G_official_completion',parent_contribution_ref='reception_support_experiment',consumer_request_ref='shape:'+s['counterparts'][0]['request_shape'],level_scope_ref=str(o['level_epoch']),restore_epoch=0,observed_clock=o['revision'],maximum_total_wait_primitives=config.get('level_action_cap',remaining+m['wait_spent']),spent_wait_primitives=m['wait_spent'],ledger_claim_ref='observed_wait:'+str(m['wait_spent']))
    n=min(n,ledger.maximum_total_wait_primitives-ledger.spent_wait_primitives);steps=[{'action_ref':key,'from':target,'to':target,'stationary_confirmed':confirmed}for _ in range(n)];kind='reception_observation';why=cfg['wait']
  if not steps:
   probes=[k for k in cfg['probe_order']if k in allowed and k not in m['controls']]
   if not probes:return {'status':'unknown','reason':'reception_access_or_control_unknown','block_unrelated_probe':True}
   key=min(probes,key=lambda k:(m['trials'].get(k,0),cfg['probe_order'].index(k)));steps=[{'action_ref':key,'from':actor['anchor']if actor else None,'to':None}]
  actions=[{'action_ref':x['action_ref']}for x in steps];v=plain({'scene':s,'memory':m,'actor':actor,'steps':steps,'commands':actions,'kind':kind,'why':why,'epoch':o['level_epoch'],'score':o['levels_completed'],'observation_ref':o['observation_ref'],'frame_digest':identity(rows),'source_rule':cfg['source_rule']});ref='reception-service:'+identity(v);evidence=[o['observation_ref']]+m['evidence'][-16:];comp={'id':ref,'observed':False,'open_question':why,'relations':['contributes_to:G_official_completion'],'properties':{'target':target,'request':s['counterparts'],'hypothesis':'distinct concave support plus request counterpart suggests a reception experiment, not a terminal law'}}
  return {'status':'proposed','kind':'reception_service','proposal_id':ref,'reception_service_plan':v,'actions':actions,'steps':[{'action':a,'expected_after':None}for a in actions],'facts':{'current_reception_supposition':True,'control_effects_are_conditional':True,'hidden_route_and_arrival_phase_unknown':True},'compositions':[comp],'question':{'reason':why,'hypothesis_refs':evidence},'route_refs':evidence,'binding':{'level_epoch':o['level_epoch'],'observation_ref':o['observation_ref']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','purpose':why,'evidence':evidence,'preconditions':{},'actions':actions,'outcome_guard':{'path':['value'],'contains':ref}}}
 def before(self,p,index,rows,**meta):
  v=p.get('reception_service_plan')
  if not v:return super().before(p,index,rows,**meta)
  s=scene(rows,v['scene']);a=carriers(rows,s)if s else[];step=v['steps'][index];ok=s is not None and s['layout']==v['scene']['layout']and(meta['epoch'],meta['score'])==(v['epoch'],v['score'])and p['actions']==v['commands']==p['bundle_template']['actions']and p['proposal_id']=='reception-service:'+identity(v)and step['action_ref']in meta['available']
  if index==0:ok=ok and identity(rows)==v['frame_digest']and meta['observation_ref']==v['observation_ref']
  else:ok=ok and len(a)==1 and a[0]['anchor']==step['from']
  return {'admitted':bool(ok),'reason':'current_reception_binding'if ok else'reception_context_changed'}
 def after(self,p,index,rows,later,**meta):
  v=p.get('reception_service_plan')
  if not v:return super().after(p,index,rows,later,**meta)
  s=scene(later,v['scene']);a=carriers(later,s)if s else[];boundary=(meta['epoch'],meta['score'])!=(v['epoch'],v['score']);expected=v['steps'][index]['to'];matched=None if boundary or expected is None or len(a)!=1 else a[0]['anchor']==expected
  return {'matched':matched,'seal_prefix':boundary or matched is not True,'reason':'reception_control_projection'if matched else'reception_boundary_unknown_or_divergence'}
 def record(self,before,command,after,rows,later,proposal,index):
  events=super().record(before,command,after,rows,later,proposal,index);v=proposal.get('reception_service_plan')
  if not v:return events
  m=copy.deepcopy(self.reception_memory)if self.reception_events else copy.deepcopy(v['memory']);s=scene(rows,v['scene']);t=scene(later,s);a=carriers(rows,s)if s else[];b=carriers(later,t)if t else[];boundary=before['level_epoch']!=after['level_epoch'];key=command['action_ref'];detail={'before':before['observation_ref'],'after':after['observation_ref'],'command':command,'kind':v['kind'],'boundary':boundary,'matched':None}
  residual=ResidualAccess()
  for e in m['residual_events']:residual.apply_event(e)
  new=residual.record(before,command,after,rows,later,proposal,index);m['residual_events']+=new
  if not boundary:
   m['trials'][key]=m['trials'].get(key,0)+1
   if len(a)==len(b)==1:
    delta=[b[0]['anchor'][i]-a[0]['anchor'][i]for i in(0,1)];detail['carrier_delta']=delta
    if v['kind']=='control_probe'and sum(x!=0 for x in delta)==1 and max(abs(x)for x in delta)==s['pitch']:m['controls'][key]={'delta':delta,'evidence':[before['observation_ref'],after['observation_ref']],'status':'provisional_observed_control'}
    expected=v['steps'][index]['to'];detail['matched']=None if expected is None else b[0]['anchor']==expected
    if expected is not None and detail['matched']is False:m['refuted'].append(detail)
    if v['kind']=='reception_observation'and delta==[0,0]:m.setdefault('stationary',{})[key]=b[0]['anchor']
   if v['kind']=='reception_observation':m['wait_spent']+=1
   if t:m['scene']=t
  m['evidence']=list(dict.fromkeys(m['evidence']+[before['observation_ref'],after['observation_ref']]));e=plain({'kind':'observed_reception_service','memory':m,'detail':detail});self.apply_event(e);events.append(e);return events
