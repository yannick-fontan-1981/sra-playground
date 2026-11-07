"""Observed partial axis relations, finite inverse constraints, guarded edits."""
import copy,json
from types import SimpleNamespace as NS
from exposed_reception_access import ExposedReceptionAccess,input_candidates as inherited_inputs
from relational_chamber_projection import scene,projection
from terminal_composition import identity
from src_bridge import plain
from agents.yf_arc3_v5.capabilities.finite_relation_network import RelationVariable,RelationComponent,FiniteRelationAlternative,FiniteRelationRow,_network_domain

def row_key(values):return json.dumps(values,separators=(',',':'))
def fresh():return {'rows':{},'edges':{},'evidence':[],'conflicts':[],'failed':[],'boundaries':[]}
def learn(s,m,ref):
 values={c['id']:c['value']for c in s['controls']}
 for a in s['axes']:
  table=m['rows'].setdefault(a['context'],{});key=row_key([values[x]for x in a['inputs']]);old=table.get(key)
  if old and old['value']!=a['value']:
   conflict={'context':a['context'],'inputs':key,'old':old['value'],'new':a['value'],'evidence':ref}
   if conflict not in m['conflicts']:m['conflicts'].append(conflict)
  elif not old:table[key]={'value':a['value'],'evidence':[ref]}
  elif ref not in old['evidence']:old['evidence'].append(ref)
 if ref not in m['evidence']:m['evidence'].append(ref)
 return m
def predict(s,m,settings):
 axes=[]
 for a in s['axes']:
  row=m['rows'].get(a['context'],{}).get(row_key([settings[x]for x in a['inputs']]))
  if row is None:return None
  axes.append([a['id'],row['value']])
 return {'settings':[[c['id'],settings[c['id']]]for c in s['controls']],'axes':axes}
def inverse(s,m,cfg):
 values=tuple(sorted({c['value']for c in s['controls']}|{v for table in m['rows'].values()for key in table for v in json.loads(key)}));targets=[a for a in s['axes']if a['target']is not None]
 if len(values)!=2 or len(s['controls'])>cfg['max_variables']:return None
 variables=[RelationVariable(variable_ref=c['id'],values=values,source=True)for c in s['controls']]
 components=[];contexts={}
 for a in targets:
  variables.append(RelationVariable(variable_ref=a['id'],values=('-1','0','1'),source=False));context=a['context'];contexts[context]=len(a['inputs']);components.append(RelationComponent(component_ref='constraint:'+a['id'],model_scope_ref=context,signature_ref=context,context_ref=context,ordered_input_refs=tuple(a['inputs']),output_ref=a['id']))
 models=[]
 for context,arity in contexts.items():
  rows=[FiniteRelationRow(inputs=tuple(json.loads(key)),outputs=(row['value'],))for key,row in m['rows'].get(context,{}).items()]
  models.append(FiniteRelationAlternative(model_ref='observed:'+context,model_scope_ref=context,signature_ref=context,context_ref=context,arity=arity,rows=tuple(rows),table_complete=False,deterministic=True))
 request=NS(variables=tuple(variables),components=tuple(components),models=tuple(models),domain_offset=0,maximum_states=cfg['max_states'],maximum_relation_checks=cfg['max_checks'])
 domain=_network_domain(request,{a['id']:a['target']for a in targets});current={c['id']:c['value']for c in s['controls']};candidates=[]
 for state in domain['states']:
  assignment=dict(state['assignment']);changes=[c['id']for c in s['controls']if assignment[c['id']]!=current[c['id']]]
  if changes:candidates.append({'settings':{c['id']:assignment[c['id']]for c in s['controls']},'changes':changes,'unknown_rows':plain(state['unknown_rows'])})
 candidates.sort(key=lambda c:(len(c['unknown_rows']),len(c['changes']),c['changes']))
 return {'candidates':candidates,'enumerated':domain['enumerated_assignments'],'checks':domain['relation_checks'],'complete_finite_domain':domain['complete'],'bounded':domain['bounded']}
def input_candidates(rows,available):
 values=list(inherited_inputs(rows,available));s=scene(rows)
 if s and 'ACTION6'in available:values +=[{'action_ref':'ACTION6','data':dict(zip(('x','y'),c['point']))}for c in s['controls']]
 return list({identity(a):a for a in values}.values())

class RelationalChamberAccess(ExposedReceptionAccess):
 def __init__(self):super().__init__();self.relation_memory=fresh();self.relation_events=[]
 def retained_digest(self):return identity([super().retained_digest(),self.relation_memory,self.relation_events])
 def apply_event(self,event):
  if event.get('kind')=='observed_chamber_relations':self.relation_memory=copy.deepcopy(event['memory']);self.relation_events.append(event);return
  return super().apply_event(event)
 def propose_graph(self,o,rows,inputs,limit,config):
  cfg=config.get('relational_chamber_question');s=scene(rows)
  if not cfg or not s:return super().propose_graph(o,rows,inputs,limit,config)
  if 'ACTION6'not in o['available_action_refs']:return {'status':'unknown','reason':'pointing_unavailable','block_unrelated_probe':True}
  m=learn(s,copy.deepcopy(self.relation_memory),o['observation_ref']);contexts={a['context']for a in s['axes']}
  if any(c['context']in contexts for c in m['conflicts']):return {'status':'unknown','reason':'shared_relation_rows_contradicted','block_unrelated_probe':True}
  domain=inverse(s,m,cfg)
  if not domain or not domain['candidates']:return {'status':'unknown','reason':'relation_inverse_unresolved','block_unrelated_probe':True}
  remaining=config.get('remaining_level_actions',limit);candidate=next((c for c in domain['candidates']if len(c['changes'])<=remaining),domain['candidates'][0]);byid={c['id']:c for c in s['controls']};settings={c['id']:c['value']for c in s['controls']};actions=[];predicted=[];edits=[];why=cfg['contribute'];kind='conditional_relation_contribution'
  for ref in candidate['changes'][:min(16,limit)]:
   c=byid[ref];old=settings[ref];new=candidate['settings'][ref];trial=identity([s['layout'],projection(s),ref,new])
   if trial in m['failed']:continue
   command={'action_ref':'ACTION6','data':dict(zip(('x','y'),c['point']))};edge=row_key([len(c['support']),old,new]);known=edge in m['edges'];settings[ref]=new;expected=predict(s,m,settings);actions.append(command);predicted.append(expected);edits.append({'id':ref,'old':old,'new':new,'edge':edge,'known':known,'trial':trial,'point':c['point']})
   if not known or expected is None:why=cfg['experiment'];kind='relation_experiment';break
  if not actions:return {'status':'unknown','reason':'relation_trials_exhausted','block_unrelated_probe':True}
  v=plain({'scene':s,'memory':m,'domain':{k:domain[k]for k in('enumerated','checks','complete_finite_domain','bounded')},'candidate':candidate,'commands':actions,'predicted':predicted,'edits':edits,'why':why,'kind':kind,'epoch':o['level_epoch'],'score':o['levels_completed'],'observation_ref':o['observation_ref'],'frame_digest':identity(rows)})
  ref='chamber-relations:'+identity(v);evidence=m['evidence']
  return {'status':'proposed','kind':'chamber_relations','proposal_id':ref,'chamber_relation_plan':v,'actions':actions,'steps':[{'action':a,'expected_after':None}for a in actions],'facts':{'current_chamber_axes_measured':True,'relation_tables_partial':True,'v5_finite_domain_kernel_used':True,'target_frame_is_library_hypothesis':True,'no_force_formula_supplied':True},'compositions':[{'id':ref,'observed':False,'open_question':why,'relations':['contributes_to:G_official_completion']}],'question':{'reason':why,'hypothesis_refs':evidence},'route_refs':evidence,'binding':{'level_epoch':o['level_epoch'],'observation_ref':o['observation_ref']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','purpose':why,'evidence':evidence,'preconditions':{},'actions':actions,'outcome_guard':{'path':['value'],'contains':ref}}}
 def before(self,p,index,rows,**meta):
  if 'chamber_relation_plan'not in p:return super().before(p,index,rows,**meta)
  v=p['chamber_relation_plan'];s=scene(rows);ok=p['proposal_id']=='chamber-relations:'+identity(v)and p['actions']==v['commands']==p['bundle_template']['actions']and(meta['epoch'],meta['score'])==(v['epoch'],v['score'])and'ACTION6'in meta['available']and s is not None and s['layout']==v['scene']['layout']
  if index==0:ok=ok and identity(rows)==v['frame_digest']and meta['observation_ref']==v['observation_ref']
  else:ok=ok and v['predicted'][index-1]is not None and projection(s)==v['predicted'][index-1]
  if ok:
   edit=v['edits'][index];c=next((c for c in s['controls']if c['id']==edit['id']),None);ok=c is not None and c['point']==edit['point']and c['value']==edit['old']and all(str(rows[y][x])==c['value']for x,y in c['support'])
  return {'admitted':bool(ok),'reason':'current_relation_control_bound'if ok else'relation_binding_changed'}
 def after(self,p,index,rows,later,**meta):
  if 'chamber_relation_plan'not in p:return super().after(p,index,rows,later,**meta)
  v=p['chamber_relation_plan'];s=scene(later);boundary=(meta['epoch'],meta['score'])!=(v['epoch'],v['score']);expected=v['predicted'][index];matched=None
  if s and not boundary and expected is not None:matched=s['layout']==v['scene']['layout']and projection(s)==expected
  return {'matched':matched,'seal_prefix':boundary or matched is not True,'reason':'observed_relation_projection'if matched else'unknown_or_changed_relation_scope'}
 def record(self,before,command,after,rows,later,proposal,index):
  events=super().record(before,command,after,rows,later,proposal,index);v=proposal.get('chamber_relation_plan')
  if not v:return events
  a=scene(rows);b=scene(later);m=copy.deepcopy(self.relation_memory)if self.relation_events else copy.deepcopy(v['memory']);m=learn(a,m,before['observation_ref'])if a else m;detail={'before':before['observation_ref'],'after':after['observation_ref'],'command':command}
  if before['level_epoch']!=after['level_epoch']:
   m['boundaries'].append({'before':before['observation_ref'],'after':after['observation_ref'],'score':after['levels_completed']});detail['boundary_not_same_scope_effect']=True
  elif a and b and a['layout']==b['layout']:
   av={c['id']:c['value']for c in a['controls']};bv={c['id']:c['value']for c in b['controls']};changed=[k for k in av if av[k]!=bv[k]];edit=v['edits'][index]
   if changed==[edit['id']]and bv[edit['id']]==edit['new']:
    m['edges'][edit['edge']]={'evidence':[before['observation_ref'],after['observation_ref']],'status':'observed_edit_under_current_binding'}
   else:m['failed'].append(edit['trial']);detail['edit_contradiction']={'changed':changed,'expected':edit['id']}
   expected=v['predicted'][index];detail['prediction_matched']=None if expected is None else projection(b)==expected;detail['changed_controls']=changed;m=learn(b,m,after['observation_ref'])
  else:detail['projection_or_layout_unknown']=True
  event=plain({'kind':'observed_chamber_relations','memory':m,'detail':detail});self.apply_event(event);events.append(event);return events
