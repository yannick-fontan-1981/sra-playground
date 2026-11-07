"""Current endpoint contact contrasts; no hidden object or action semantics."""
from copy import deepcopy
from .endpoints import enclosed,xybox

def pixels(rows,box):
 l,t,r,b=box;return [list(row[l:r+1]) for row in rows[t:b+1]]

def targets(scene,obs,rows,memories,methods,prior):
 out=[]
 for item in memories:
  arrival=item.get('arrival');box=item['source_bbox']
  if not arrival or item['level_epoch']!=obs['level_epoch'] or not enclosed(scene['body'],box):continue
  if pixels(rows,box)!=arrival['current_pixels'] or item.get('contact_attempted') or arrival.get('context_question_pending') or arrival.get('context_question_returned'):continue
  compatible=[m for m in methods if m.get('status')=='observed_local_operator_change' and m.get('evidence') and m['action']['action_ref'] in obs['available_action_refs']]
  actions={m['action']['action_ref'] for m in compatible}
  if len(actions)>1:continue
  method=compatible[-1] if compatible else None;cmd=method['action']['action_ref'] if method else prior['interaction']
  if cmd not in obs['available_action_refs'] or cmd in prior['directions']:continue
  out.append((item['source_cell'],{'current_changed_endpoint':arrival['changed_outside_control']>0,'current_nonreactive_selected_endpoint':arrival.get('status')=='distinct_endpoint_reached_without_outside_response','declared_local_operator_available':method is None,'observed_local_operator_revalidated':method is not None},{**deepcopy(item),'method_action':{'action_ref':cmd},'method':method or {},'evidence':arrival['evidence']+(method or {}).get('evidence',[]),'other_available_nondirectional_inputs':[a for a in obs['available_action_refs'] if a not in prior['directions'] and a!=cmd],'endpoint_contact':True}))
 return out

def reconcile(memories,methods,proposal,index,before,after,first,second,outcome,underlays=None):
 if not proposal or 'inventory_plan' not in proposal or before['level_epoch']!=after['level_epoch']:return None
 offer=proposal['inventory_plan']['offer'];kind=offer['kind'];target=offer['target'];step=proposal['steps'][index]
 # An observed arrival is distinct from the conjunction of predicted remote effects.
 position_matched=outcome.get('body_position_matched',outcome.get('matched'))
 if kind in ('endpoint_approach_candidate','context_reconfiguration_candidate') and step.get('expected_after') is not None and position_matched is True and tuple(step['to_cell'])==tuple(offer['route']['target_cell']):
  discrepancy=None if outcome.get('matched') is True else {'status':'other_expectations_not_confirmed','body_position_matched':True,'matched':outcome.get('matched'),'preservation_matched':outcome.get('preservation_matched')}
  box=target['source_bbox'];body=step['expected_after']['body_bbox'];old=step['body_before'];l,t,r,b=box
  changed=[(x,y) for y in range(t,b+1) for x in range(l,r+1) if first[y][x]!=second[y][x] and not enclosed([x,y,x,y],body) and not enclosed([x,y,x,y],old)]
  distinct_unchanged=not changed and target.get('endpoint_role')=='unknown' and target.get('cell_pixels') and len({v for row in target['cell_pixels'] for v in row})>1 and pixels(first,box)==target['cell_pixels'] and enclosed(body,box) and not enclosed(old,box)
  if not changed and not distinct_unchanged:return None
  for item in memories:
   if item['level_epoch']==after['level_epoch'] and tuple(item['source_cell'])==tuple(target['source_cell']):
    item['arrival']={'status':'changed_endpoint_reached' if changed else 'distinct_endpoint_reached_without_outside_response','selected_region_preimage':deepcopy(target.get('cell_pixels')),'unknown':['effect_under_control','nonlocal_effect','operator_role'],'evidence':[before['observation_ref'],after['observation_ref']],'changed_outside_control':len(changed),'current_pixels':pixels(second,box),'body_bbox':body,'remote_effects':deepcopy(outcome.get('remote_effects')),'effect_scope_reconciliation':deepcopy(outcome.get('effect_scope_reconciliation'))};item.pop('contact_attempted',None)
    if discrepancy:item['arrival']['prediction_discrepancy']=deepcopy(discrepancy)
    if kind=='context_reconfiguration_candidate':item['arrival']['context_question_pending']=deepcopy(target['context_question'])
    under=(underlays or {}).get(tuple(old),{});source_box=under.get('cell_bbox');patch=under.get('patch')
    if under.get('epoch')==before['level_epoch'] and source_box and patch and under.get('evidence'):
     sl,st,sr,sb=source_box
     if len(patch)==sb-st+1 and all(len(row)==sr-sl+1 for row in patch) and all(first[y][x]==patch[y-st][x-sl] for y in range(st,sb+1) for x in range(sl,sr+1) if not enclosed([x,y,x,y],old)):
      item['arrival']['entered_support']={'cell_bbox':deepcopy(source_box),'patch':deepcopy(patch),'evidence':deepcopy(under['evidence']),'control_signature':offer['scene']['body_signature']}
  event={'status':'changed_endpoint_reached' if changed else 'distinct_endpoint_reached_without_outside_response','local_changed_pixels':len(changed),'remote_effects':deepcopy(outcome.get('remote_effects')),'effect_scope_reconciliation':deepcopy(outcome.get('effect_scope_reconciliation')),'evidence':[before['observation_ref'],after['observation_ref']],'role':'unknown'}
  if discrepancy:event['prediction_discrepancy']=deepcopy(discrepancy)
  return event
 if kind=='context_reconfiguration_candidate' and step.get('expected_after') is None:
  # This is a return of the already bound question, never another entry or
  # a new support acquisition. Preserve the original entry/source evidence.
  question=target.get('context_question',{});box=target['source_bbox']
  for item in memories:
   arrival=item.get('arrival') or {};pending=arrival.get('context_question_pending') or {}
   if (item['level_epoch']!=after['level_epoch'] or tuple(item['source_cell'])!=tuple(target['source_cell']) or
       pending.get('association_ref')!=question.get('association_ref') or pending.get('context_key')!=question.get('context_key')):continue
   arrival.pop('context_question_pending',None)
   arrival['context_question_returned']={'association_ref':question['association_ref'],'context_key':question['context_key'],'evidence':[before['observation_ref'],after['observation_ref']],'local_contact_site_unchanged':pixels(first,box)==pixels(second,box),'other_compositions_preserved':outcome.get('preservation_matched') is True}
   if pixels(first,box)==pixels(second,box):
    arrival['current_pixels']=pixels(second,box)
    arrival['current_revalidation_evidence']=[before['observation_ref'],after['observation_ref']]
  return None
 if kind not in ('local_contact_probe_candidate','local_contact_recall_candidate'):return None
 box=target['source_bbox'];changed=pixels(first,box)!=pixels(second,box);preserved=outcome['preservation_matched'] is True
 outside_changes=sum(value!=second[y][x] and not enclosed([x,y,x,y],box) for y,row in enumerate(first) for x,value in enumerate(row))
 for item in memories:
  if item['level_epoch']==before['level_epoch'] and tuple(item['source_cell'])==tuple(target['source_cell']):item['contact_attempted']={'after':after['observation_ref'],'changed':changed,'other_compositions_preserved':preserved,'current_pixels':pixels(second,box)}
 event={'status':'observed_local_operator_change' if changed and preserved else 'local_contact_no_supported_effect','action':deepcopy(step['action']),'evidence':[before['observation_ref'],after['observation_ref']],'level_epoch':before['level_epoch'],'local_changed':changed,'visible_changes_outside_contact':outside_changes,'hidden_or_delayed_effect':'unknown','other_compositions_preserved':preserved,'remote_effects':deepcopy(outcome.get('remote_effects')),'effect_scope_reconciliation':deepcopy(outcome.get('effect_scope_reconciliation')),'unknown':['object_role','terminal_rule','utility','other_input_effects','effect_under_control','delayed_effect','missing_precondition','nonlocal_effect']}
 if changed and preserved:methods.append(deepcopy(event));del methods[:-16]
 return event


def departure_support(scene,obs,rows,memories,equivalence=None):
 """Revalidate a traversed support independently of a currently occupied motif."""
 candidates=[];descriptions=[]
 for item in memories:
  arrival=item.get('arrival') or {};source=arrival.get('entered_support');box=item['source_bbox'];attempt=item.get('contact_attempted')
  if item['level_epoch']!=obs['level_epoch'] or not source or not source.get('evidence') or not arrival.get('evidence') or not enclosed(scene['body'],box):continue
  if source['control_signature']!=scene['body_signature'] or (attempt and not attempt['other_compositions_preserved']):continue
  current=attempt['current_pixels'] if attempt else arrival['current_pixels']
  if pixels(rows,box)!=current or pixels(rows,source['cell_bbox'])!=source['patch']:continue
  patch=source['patch'];l,t,r,b=box;sl,st,sr,sb=source['cell_bbox'];bl,bt,br,bb=scene['body']
  if (r-l,b-t)!=(sr-sl,sb-st) or tuple(box)==tuple(source['cell_bbox']):continue
  exterior=[(x,y) for y in range(b-t+1) for x in range(r-l+1) if not(bl<=l+x<=br and bt<=t+y<=bb)]
  candidates.append({'level_epoch':obs['level_epoch'],'body_bbox':list(scene['body']),'cell_bbox':list(box),'prior_exterior':[[x,y,patch[y][x]] for x,y in exterior],'current_exterior':[[x,y,rows[t+y][l+x]] for x,y in exterior],'evidence':list(dict.fromkeys(source['evidence']+arrival['evidence']+arrival.get('current_revalidation_evidence',[])+([attempt['after']] if attempt else [])+[obs['observation_ref']])),'source_cell_bbox':source['cell_bbox'],'qualification':'entered_support_and_current_endpoint_revalidated_departure_still_conditional'})
  if equivalence:
   excluded=equivalence.get('descriptive_fields',[])
   candidates[-1]['current_witness_context']={k:deepcopy(v) for k,v in item.items() if k not in excluded}
   descriptions.append({k:deepcopy(item[k]) for k in excluded if k in item})
 if equivalence and equivalence.get('mode')=='identical_current_support_witnesses':
  unique=[]
  for candidate in candidates:
   if candidate not in unique:unique.append(candidate)
  if len(unique)==1 and len(candidates)>1:
   return {**unique[0],'equivalent_witnesses':{'declaration_ref':equivalence['id'],'descriptions_preserved':len(candidates),'retained_descriptions':descriptions,'all_current_facts_equal':True,'physical_object_identity_asserted':False}}
 return candidates[0] if len(candidates)==1 else None


def equivalent_current_contact_offers(options,declaration,digest):
 """Factor equal regional continuations; retain entity descriptions as evidence."""
 # The existing source digest is only a storage key, never an identity claim.
 groups={};unchanged=[]
 for option in options:
  target=option['target'];scene=option['scene'];arrival=target.get('arrival') or {}
  if option['kind'] not in declaration.get('kinds',[]) or not target.get('endpoint_contact') or not arrival.get('current_pixels') or not arrival.get('evidence') or arrival['evidence'][-1]!=scene['observation_ref'] or target['level_epoch']!=scene['level_epoch']:
   unchanged.append(option);continue
  meaning=deepcopy(option)
  for field in declaration['descriptive_fields']:meaning['target'].pop(field,None)
  groups.setdefault(digest(meaning),[]).append(option)
 for key,items in groups.items():
  if len(items)==1:unchanged.append(items[0]);continue
  # Every action, scoped pixel, effect, method, risk, resource and obligation
  # outside the declared descriptive fields is exactly equal, not merely nearby.
  chosen=deepcopy(items[0]);chosen['target']['equivalent_descriptions']=[deepcopy(item['target']) for item in items]
  chosen['target']['equivalence']={'declaration_ref':declaration['id'],'current_continuation_digest':key,'meaning':declaration['meaning'],'physical_object_identity_asserted':False}
  chosen['target']['evidence']=list(dict.fromkeys(ref for item in items for ref in item['target'].get('evidence',[])+[item['target']['observed_at']]))
  unchanged.append(chosen)
 return unchanged
