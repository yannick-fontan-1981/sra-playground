"""Conditional visual configuration-to-service experiments with current bindings."""
import copy
from relational_chamber_access import RelationalChamberAccess,input_candidates as inherited_inputs
from panel_service_projection import scene
from terminal_composition import identity
from src_bridge import plain

def projection(s):
 return [{'id':p['id'],'material':p['material'],'room_marker':p['room_marker'],'activity':[c['row']for c in p['activity_controls']if c['outline']==p['selection_color']],'parameters':[[c['row'],c['col']]for c in p['cells']if c['col']>=2 and c['outline']is not None]}for p in s['panels']]
def input_candidates(rows,available):
 values=list(inherited_inputs(rows,available));s=scene(rows)
 if s and 'ACTION6'in available:values.extend({'action_ref':'ACTION6','data':dict(zip(('x','y'),c['point']))}for p in s['panels']for c in p['cells'])
 return list({identity(a):a for a in values}.values())
class PanelServiceAccess(RelationalChamberAccess):
 def __init__(self):super().__init__();self.panel_memory={'symbols':[],'evidence':[],'selection_observed':False,'effects':[],'failed':[]};self.panel_events=[]
 def retained_digest(self):return identity([super().retained_digest(),self.panel_memory,self.panel_events])
 def apply_event(self,e):
  if e.get('kind')!='observed_panel_service':return super().apply_event(e)
  self.panel_memory=copy.deepcopy(e['memory']);self.panel_events.append(e)
 def propose_graph(self,o,rows,inputs,limit,config):
  cfg=config.get('panel_service_question');s=scene(rows,self.panel_memory['symbols'])
  if not cfg or not s:return super().propose_graph(o,rows,inputs,limit,config)
  if 'ACTION6'not in o['available_action_refs']:return {'status':'unknown','reason':'panel_pointing_unavailable','block_unrelated_probe':True}
  m=copy.deepcopy(self.panel_memory)
  for p in s['panels']:
   for op in p['services']:
    if op['symbol']not in m['symbols']:m['symbols'].append(op['symbol'])
  prepared=[];unresolved=[];contributions=[]
  receivers=[(p,a)for p in s['panels']for a in p['services']if a['kind']=='displayed_receiver']
  for p in s['panels']:
   direct=[a for a in p['operators']if a['kind']=='displayed_receiver'and a['input']==p['material']]
   rewrite=[a for a in p['operators']if a['kind']=='displayed_rewrite'and a['input']==p['material']and any(a['output']==r['input']for r in p['services']if r['kind']=='displayed_receiver')]
   operator=None;parameter=None;why=None
   if len(direct)==1:operator=direct[0]['control'];why='current_material_matches_local_receiver'
   elif len(rewrite)==1:operator=rewrite[0]['control'];why='displayed_rewrite_prepares_local_receiver'
   else:
    destinations=[q for q,a in receivers if a['input']==p['material']and q['room_marker']!=p['room_marker']]
    choices=[]
    if len(destinations)==1:
     for c in p['activity_controls']:
      params=[a for a in p['cells']if a['row']==c['row']and a['col']>=2 and a['solid']and a['color']==destinations[0]['room_marker']]
      if len(params)==1:choices.append((c,params[0]))
    if len(choices)==1:operator,parameter=choices[0];why='test_room_parameter_to_prepare_matching_receiver'
   if operator is None:unresolved.append(p['id']);continue
   contributions.append({'panel':p['id'],'reason':why,'material':p['material'],'operator_symbol':operator['pattern'],'parameter':parameter})
   if operator['outline']!=p['selection_color']:prepared.append({'panel':p['id'],'cell':operator,'field':'activity','reason':why})
   if parameter is not None and parameter['outline']is None:prepared.append({'panel':p['id'],'cell':parameter,'field':'parameter','reason':why})
  if unresolved:return {'status':'unknown','reason':'panel_service_correspondence_unresolved','missing_panels':unresolved,'block_unrelated_probe':True}
  actions=[];steps=[];expected=projection(s);kind='configuration'
  for edit in prepared[:min(limit,16)]:
   command={'action_ref':'ACTION6','data':dict(zip(('x','y'),edit['cell']['point']))};trial=identity([o['level_epoch'],projection(s),command])
   if trial in m['failed']:return {'status':'unknown','reason':'panel_configuration_refused_in_context','block_unrelated_probe':True}
   p=next(v for v in expected if v['id']==edit['panel']);c=edit['cell']
   if edit['field']=='activity':p['activity']=[c['row']]
   else:p['parameters']=[v for v in p['parameters']if v[0]!=c['row']]+[[c['row'],c['col']]];p['parameters'].sort()
   actions.append(command);steps.append({'edit':edit,'expected':copy.deepcopy(expected),'trial':trial})
   if not m['selection_observed']:break
  if not prepared:
   candidates=sorted(a['action_ref']for a in inputs if a['action_ref']!='ACTION6'and a['action_ref']in o['available_action_refs'])
   if not candidates:return {'status':'unknown','reason':'shared_application_control_unknown','block_unrelated_probe':True}
   command={'action_ref':candidates[0]};trial=identity([o['level_epoch'],projection(s),command])
   if trial in m['failed']:return {'status':'unknown','reason':'shared_application_no_information','block_unrelated_probe':True}
   actions=[command];steps=[{'edit':None,'expected':None,'trial':trial}];kind='application'
  why=cfg[kind];evidence=list(dict.fromkeys(m['evidence']+[o['observation_ref']]))
  v=plain({'scene':s,'memory':m,'commands':actions,'steps':steps,'contributions':contributions,'kind':kind,'why':why,'epoch':o['level_epoch'],'score':o['levels_completed'],'observation_ref':o['observation_ref'],'frame_digest':identity(rows)})
  ref='panel-service:'+identity(v)
  return {'status':'proposed','kind':'panel_service','proposal_id':ref,'panel_service_plan':v,'actions':actions,'steps':[{'action':a,'expected_after':None}for a in actions],'facts':{'current_panel_symbols_measured':True,'service_goal_is_library_hypothesis':True,'shared_turn_law_unknown':True},'compositions':[{'id':ref,'observed':False,'open_question':why,'relations':['contributes_to:G_official_completion']}],'question':{'reason':why,'hypothesis_refs':evidence},'route_refs':evidence,'binding':{'level_epoch':o['level_epoch'],'observation_ref':o['observation_ref']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','purpose':why,'evidence':evidence,'preconditions':{},'actions':actions,'outcome_guard':{'path':['value'],'contains':ref}}}
 def before(self,p,index,rows,**meta):
  v=p.get('panel_service_plan')
  if not v:return super().before(p,index,rows,**meta)
  s=scene(rows,v['memory']['symbols']);ok=s is not None and s['layout']==v['scene']['layout']and(meta['epoch'],meta['score'])==(v['epoch'],v['score'])and p['actions']==v['commands']==p['bundle_template']['actions']and p['proposal_id']=='panel-service:'+identity(v)and v['commands'][index]['action_ref']in meta['available']
  if index==0:ok=ok and identity(rows)==v['frame_digest']and meta['observation_ref']==v['observation_ref']
  else:ok=ok and projection(s)==v['steps'][index-1]['expected']
  edit=v['steps'][index]['edit']
  if ok and edit:
   panel=next((a for a in s['panels']if a['id']==edit['panel']),None);c=edit['cell'];current=next((a for a in panel['cells']if a['point']==c['point']),None)if panel else None
   ok=current is not None and current['pattern']==c['pattern']and current['color']==c['color']and v['commands'][index]['data']==dict(zip(('x','y'),current['point']))
  return {'admitted':bool(ok),'reason':'current_panel_service_bound'if ok else'panel_service_binding_changed'}
 def after(self,p,index,rows,later,**meta):
  v=p.get('panel_service_plan')
  if not v:return super().after(p,index,rows,later,**meta)
  s=scene(later,v['memory']['symbols']);boundary=(meta['epoch'],meta['score'])!=(v['epoch'],v['score']);expected=v['steps'][index]['expected'];matched=None if boundary or expected is None or s is None else projection(s)==expected
  return {'matched':matched,'seal_prefix':boundary or matched is not True,'reason':'panel_selection_projection'if matched else'shared_response_requires_reconciliation'}
 def record(self,before,command,after,rows,later,proposal,index):
  events=super().record(before,command,after,rows,later,proposal,index);v=proposal.get('panel_service_plan')
  if not v:return events
  m=copy.deepcopy(self.panel_memory)if self.panel_events else copy.deepcopy(v['memory']);m['symbols']=v['memory']['symbols'];s=scene(later,m['symbols']);step=v['steps'][index];boundary=before['level_epoch']!=after['level_epoch'];changed=identity(rows)!=identity(later)
  detail={'before':before['observation_ref'],'after':after['observation_ref'],'kind':v['kind'],'command':command,'boundary':boundary,'pixel_changed':changed,'prediction_matched':None,'score_delta':after['levels_completed']-before['levels_completed']}
  if not boundary and step['expected']is not None and s is not None:
   matched=projection(s)==step['expected'];detail['prediction_matched']=matched
   if matched:m['selection_observed']=True
   else:m['failed'].append(step['trial'])
  elif not changed or (not boundary and v['kind']=='application'and s is not None and projection(s)==projection(v['scene'])):m['failed'].append(step['trial']);detail['no_panel_service_information']=True
  m['evidence']=list(dict.fromkeys(m['evidence']+[before['observation_ref'],after['observation_ref']]))
  m['effects'].append(detail);event=plain({'kind':'observed_panel_service','memory':m,'detail':detail});self.apply_event(event);events.append(event);return events
