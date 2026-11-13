"""Observed regional reconfiguration questions, never inverse transition laws."""
from copy import deepcopy
import hashlib,json
from .endpoints import enclosed,xybox
from .local_contact import pixels
from agents.yf_arc3_v6.morphology_policy.guarded_binding.family import locate

def digest(value):return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()

def record(methods,proposal,index,before,after,first,second,maximum_regions):
 if not proposal or not proposal.get('inventory_plan') or before['level_epoch']!=after['level_epoch']:return None
 offer=proposal['inventory_plan']['offer'];step=proposal['steps'][index];kind=offer['kind']
 if step.get('expected_after') is not None:return None
 if kind not in ('local_contact_probe_candidate','local_contact_recall_candidate','context_reconfiguration_candidate'):return None
 body=step['body_before'];site=offer['target']['source_bbox'];scene=offer['scene'];domain=scene.get('support_effect_scope')
 if not domain or locate(first,offer['core'])!=body or locate(second,offer['core'])!=body:return None
 if kind=='context_reconfiguration_candidate':
  context=offer['target']['context_question'];prior=next((m for m in methods if m.get('id')==context['association_ref']),None)
  if prior is None:return None
  outcomes=[{'region_ref':r['ref'],'equals_prior':pixels(second,r['bbox'])==r['before'],'equals_pre_probe':pixels(second,r['bbox'])==pixels(first,r['bbox'])} for r in prior['regions']]
  result={'status':'context_intervention_observed','context_key':context['context_key'],'evidence':[before['observation_ref'],after['observation_ref']],'regional_outcomes':outcomes,'context_visible_samples':[[x,y,first[y][x]] for r in prior['regions'] for y in range(r['bbox'][1],r['bbox'][3]+1) for x in range(r['bbox'][0],r['bbox'][2]+1) if not enclosed([x,y,x,y],body)],'official_level_delta':after['levels_completed']-before['levels_completed'],'unknown':['mechanical_identity','hidden_effect','causal_law','repeatability','terminal_necessity']}
  prior.setdefault('attempts',[]).append(result);prior['attempts']=prior['attempts'][-16:]
  return result
 l,t,r,b=site;anchor=[[x,y,first[y][x]] for y in range(t,b+1) for x in range(l,r+1) if not enclosed([x,y,x,y],body)]
 if not anchor or any(second[y][x]!=value for x,y,value in anchor):return None
 regions=[]
 for cell in scene['grids'][0]['cells']:
  box=xybox(cell)
  if not enclosed(box,domain['bbox']) or box==site or enclosed(body,box):continue
  a=pixels(first,box);z=pixels(second,box)
  if a!=z:regions.append({'ref':'region:'+digest([before['level_epoch'],box])[:20],'cell':[cell['row'],cell['col']],'bbox':box,'before':a,'after':z,'before_nonuniform':len({v for row in a for v in row})>1})
 if not 2<=len(regions)<=maximum_regions:return None
 evidence=[before['observation_ref'],after['observation_ref']];ident='context-association:'+digest([evidence,step['action'],regions])
 if any(m.get('id')==ident for m in methods):return None
 association={'id':ident,'status':'observed_multi_region_context_association','level_epoch':before['level_epoch'],'source_cell':deepcopy(offer['target']['source_cell']),'source_bbox':deepcopy(site),'site_anchor':anchor,'body_signature':scene['body_signature'],'action':deepcopy(step['action']),'regions':regions,'evidence':evidence,'predictive_use_allowed':False,'attempts':[],'unknown':['segmentation_or_appearance_change','mechanical_identity','common_cause','operator_law','inverse','terminal_necessity']}
 methods.append(association);del methods[:-16]
 return {'status':'regional_association_retained','association_ref':ident,'regions':len(regions),'evidence':evidence,'prediction_authorized':False}

def unchanged_visible_context(attempt,rows,body):
 # A moving body is not a changed enabling condition. Compare only the
 # overlapping visible measurements; hidden portions remain unresolved.
 samples=[(x,y,value) for x,y,value in attempt.get('context_visible_samples',[]) if not enclosed([x,y,x,y],body)]
 return bool(samples) and all(rows[y][x]==value for x,y,value in samples)

def targets(scene,obs,rows,memories,methods,ordinary_targets):
 if ordinary_targets or len(scene.get('grids',[]))!=1:return []
 out=[]
 for method in methods:
  if method.get('status')!='observed_multi_region_context_association' or method['level_epoch']!=obs['level_epoch'] or method['body_signature']!=scene['body_signature'] or method['action']['action_ref'] not in obs['available_action_refs']:continue
  cell=next((c for c in scene['grids'][0]['cells'] if [c['row'],c['col']]==method['source_cell']),None)
  if cell is None or xybox(cell)!=method['source_bbox']:continue
  if any(rows[y][x]!=value for x,y,value in method['site_anchor'] if not enclosed([x,y,x,y],scene['body'])):continue
  unanswered=[]
  for region in method['regions']:
   known=[m for m in memories if m['level_epoch']==obs['level_epoch'] and m['source_bbox']==region['bbox'] and m.get('cell_pixels')==region['before'] and not m.get('contact_attempted')]
   if known and region['before_nonuniform'] and pixels(rows,region['bbox'])==region['after'] and region['after']!=region['before']:
    unanswered.append({'region_ref':region['ref'],'bbox':region['bbox'],'prior_patch_sha256':digest(region['before']),'current_patch_sha256':digest(region['after']),'prior_observation':method['evidence'][0],'mechanical_identity':'unknown'})
  if not unanswered:continue
  current=[pixels(rows,region['bbox']) for region in method['regions']]
  key=digest([method['id'],current,[[x,y,rows[y][x]] for x,y,_ in method['site_anchor']]])
  if any(a['context_key']==key or unchanged_visible_context(a,rows,scene['body']) for a in method.get('attempts',[])):continue
  relations=[[u['region_ref'],'prior_appearance_available_under_unknown_context',method['id']] for u in unanswered]
  question={'association_ref':method['id'],'context_key':key,'unanswered_regions':unanswered,'relations':relations,'blocking_unknown':'previously_distinct_unexamined_regions_do_not_match_their_current_appearances','frontier_scope':'currently_examined_contributions_only','predictions':{'prior_appearances_reappear':{'matched_prior_regions':[u['region_ref'] for u in unanswered]},'unchanged_visible_configuration':{'matched_prior_regions':[]},'different_configuration':{'matched_prior_regions':'other_or_partial'}},'risks':['unknown_effect_on_other_compositions','return_not_proven','changed_appearance_does_not_prove_object_identity'],'evidence':method['evidence']+[obs['observation_ref']]}
  out.append((method['source_cell'],{'observed_context_association_current':True,'unexamined_prior_regions_currently_different':True,'no_current_ordinary_contribution':True},{'source_cell':deepcopy(method['source_cell']),'source_bbox':deepcopy(method['source_bbox']),'method_action':deepcopy(method['action']),'context_question':question,'evidence':question['evidence'],'level_epoch':obs['level_epoch'],'endpoint_role':'unknown','cell_pixels':pixels(rows,method['source_bbox'])}))
 return out

def decorate(proposal,obs):
 offer=proposal['inventory_plan']['offer'];question=offer['target'].get('context_question')
 if not question:return
 target='composition:context-question:'+digest([obs['level_epoch'],question['association_ref'],question['unanswered_regions']])[:24]
 focus=proposal['compositions'][0];focus['properties']['context_question']=deepcopy(question);focus['relations'].append('accesses:'+target)
 proposal['compositions'].append({'id':target,'role':'information_objective','observed':False,'things':[u['region_ref'] for u in question['unanswered_regions']],'properties':{'tested_relations':question['relations'],'blocking_unknown':question['blocking_unknown'],'frontier_scope':question['frontier_scope'],'predictions_are_unconfirmed_alternatives':question['predictions']},'relations':['contributes_to:'+proposal['bundle_template']['objective_ref']]})
 proposal['question']['information_target']=target
 if len(proposal['actions'])==1 and proposal['steps'][0]['expected_after'] is None:
  focus['relations'].append('investigates:'+target)
  proposal['question']['context_intervention']={'association_ref':question['association_ref'],'context_key':question['context_key'],'reconciliation_owner':'observed_inventory.context_intervention.record','observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'action':deepcopy(proposal['actions'][0]),'distinct_outcomes':3,'relations':question['relations'],'predictions':question['predictions'],'evidence':question['evidence'],'risks':question['risks'],'return_steps':None,'tree_key':'composition.priority.information_value','question':'Can a currently revalidated intervention expose previously unexamined appearances? No inverse or repeatability is assumed.'}
