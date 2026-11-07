"""Current rooted reference -> observed control -> V5 conditional contact plan."""
import copy,time
from panel_service_access import PanelServiceAccess,input_candidates
from rooted_line_projection import scene,physical,projected,configuration
from rooted_line_mechanics import effect,plan
from terminal_composition import identity
from src_bridge import plain

class RootedLineAccess(PanelServiceAccess):
 def __init__(self):super().__init__();self.line_memory={'controls':{},'tried':[],'evidence':[],'current':None,'epoch':None,'refuted':[]};self.line_events=[]
 def retained_digest(self):return identity([super().retained_digest(),self.line_memory,self.line_events])
 def apply_event(self,e):
  if e.get('kind')!='observed_rooted_line':return super().apply_event(e)
  self.line_memory=copy.deepcopy(e['memory']);self.line_events.append(e)
 def propose_graph(self,o,rows,inputs,limit,config):
  cfg=config.get('rooted_line_question');s=scene(rows)
  if not cfg or s is None:return super().propose_graph(o,rows,inputs,limit,config)
  if time.perf_counter()>=config.get('level_deadline',float('inf')):return {'status':'unknown','reason':'rooted_line_level_deadline','block_unrelated_probe':True}
  m=copy.deepcopy(self.line_memory)
  if m['epoch']!=o['level_epoch']:m['current']=None;m['tried']=[];m['epoch']=o['level_epoch']
  if any(x['epoch']==o['level_epoch']for x in m['refuted']):return {'status':'unknown','reason':'conditional_contact_model_refuted','block_unrelated_probe':True}
  available=set(o['available_action_refs']);unmeasured=[a for a in cfg['probe_order']if a in available and a not in m['controls']and a not in m['tried']];actions=[];predictions=[];configurations=[];search=None
  if unmeasured:
   actions=[{'action_ref':unmeasured[0]}];predictions=[None];configurations=[None];why=cfg['control'];kind='calibrate'
  elif len(m['controls'])<len([a for a in cfg['probe_order']if a in available]):
   return {'status':'unknown','reason':'rooted_control_effect_unresolved','block_unrelated_probe':True}
  else:
   bounds={**cfg,'max_depth':min(cfg['max_depth'],config.get('remaining_level_actions',cfg['max_depth']))}
   c,result=plan(s,o,m['controls'],bounds,m['current']);search={'nodes':result.expanded_node_count,'truncated':result.truncated,'missing':list(result.missing_premise_refs),'bounds':list(result.exhausted_bound_refs),'plans':len(result.plans),'conditional_model':cfg['conditional_model'],'kernel':'V5.piercing_plan.search_piercing_plans'}
   candidates=[p for p in result.plans if p.effects]
   if not candidates:return {'status':'unknown','reason':'rooted_contact_plan_unresolved','search':search,'block_unrelated_probe':True}
   chosen=min(candidates,key=lambda p:len(p.effects));count=min(limit,16,len(chosen.effects));actions=[{'action_ref':e.action_ref}for e in chosen.effects[:count]];predictions=[projected(st.configuration)for st in chosen.steps[:count]];configurations=[plain(st.configuration.model_dump())for st in chosen.steps[:count]];why=cfg['compose'];kind='conditional_composition'
  v=plain({'scene':s,'memory':m,'commands':actions,'predictions':predictions,'configurations':configurations,'search':search,'why':why,'kind':kind,'epoch':o['level_epoch'],'score':o['levels_completed'],'observation_ref':o['observation_ref'],'frame_digest':identity(rows)})
  ref='rooted-line:'+identity(v);evidence=list(dict.fromkeys(m['evidence']+[o['observation_ref']]))
  return {'status':'proposed','kind':'rooted_line','proposal_id':ref,'rooted_line_plan':v,'actions':actions,'steps':[{'action':a,'expected_after':None}for a in actions],'facts':{'homologous_root_reference_measured':True,'target_order_is_library_hypothesis':True,'conditional_contact_model_not_universal_law':True},'compositions':[{'id':ref,'observed':False,'open_question':why,'relations':['contributes_to:G_official_completion']}],'question':{'reason':why,'hypothesis_refs':evidence},'route_refs':evidence,'binding':{'level_epoch':o['level_epoch'],'observation_ref':o['observation_ref']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','purpose':why,'evidence':evidence,'preconditions':{},'actions':actions,'outcome_guard':{'path':['value'],'contains':ref}}}
 def before(self,p,index,rows,**meta):
  v=p.get('rooted_line_plan')
  if not v:return super().before(p,index,rows,**meta)
  s=scene(rows);ok=s is not None and s['layout']==v['scene']['layout']and(meta['epoch'],meta['score'])==(v['epoch'],v['score'])and p['actions']==v['commands']==p['bundle_template']['actions']and p['proposal_id']=='rooted-line:'+identity(v)and v['commands'][index]['action_ref']in meta['available']
  if index==0:ok=ok and identity(rows)==v['frame_digest']and meta['observation_ref']==v['observation_ref']
  else:ok=ok and v['predictions'][index-1]is not None and physical(s)==v['predictions'][index-1]
  return {'admitted':bool(ok),'reason':'current_rooted_reference_and_projection'if ok else'rooted_line_context_changed'}
 def after(self,p,index,rows,later,**meta):
  v=p.get('rooted_line_plan')
  if not v:return super().after(p,index,rows,later,**meta)
  s=scene(later);boundary=(meta['epoch'],meta['score'])!=(v['epoch'],v['score']);expected=v['predictions'][index];matched=None if boundary or expected is None or s is None else physical(s)==expected
  return {'matched':matched,'seal_prefix':boundary or matched is not True,'reason':'rooted_line_projection'if matched else'rooted_line_unknown_or_refuted'}
 def record(self,before,command,after,rows,later,proposal,index):
  events=super().record(before,command,after,rows,later,proposal,index);v=proposal.get('rooted_line_plan')
  if not v:return events
  m=copy.deepcopy(self.line_memory)if self.line_events else copy.deepcopy(v['memory']);a=scene(rows);b=scene(later);boundary=before['level_epoch']!=after['level_epoch'];detail={'before':before['observation_ref'],'after':after['observation_ref'],'command':command,'boundary':boundary,'kind':v['kind'],'matched':None}
  if m['epoch']!=before['level_epoch']:m['epoch']=before['level_epoch'];m['current']=None;m['tried']=[]
  if not boundary and a and b:
   if v['kind']=='calibrate':
    e=effect(command['action_ref'],a,b,[before['observation_ref'],after['observation_ref']]);m['tried'].append(command['action_ref'])
    if e is not None:m['controls'][command['action_ref']]=plain(e.model_dump());detail['observed_effect']={'root_translation':list(e.root_translation),'extent_delta':e.extent_delta}
   else:
    matched=physical(b)==v['predictions'][index];detail['matched']=matched
    if matched:m['current']=v['configurations'][index]
    else:m['current']=None;m['refuted'].append({'epoch':before['level_epoch'],'before':before['observation_ref'],'after':after['observation_ref'],'command':command,'expected':v['predictions'][index],'observed':physical(b)})
  if boundary:m['current']=None;m['epoch']=after['level_epoch'];m['tried']=[]
  m['evidence']=list(dict.fromkeys(m['evidence']+[before['observation_ref'],after['observation_ref']]))
  event=plain({'kind':'observed_rooted_line','memory':m,'detail':detail});self.apply_event(event);events.append(event);return events
