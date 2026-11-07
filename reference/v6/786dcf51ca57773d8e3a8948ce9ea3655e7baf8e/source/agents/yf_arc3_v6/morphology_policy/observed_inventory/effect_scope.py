"""Geometric support scope and unexplained remote changes; no HUD/game role."""
import hashlib,json
from copy import deepcopy
from agents.yf_arc3_v5.capabilities.contour_domains import measure_contour_domain
from agents.yf_arc3_v6.morphology_policy.guarded_binding.geometry import revalidate_frame

def inside(box,outer):return outer[0]<=box[0]<=box[2]<=outer[2] and outer[1]<=box[1]<=box[3]<=outer[3]

def measure(components,underlays,epoch,body,observation):
 candidates=[]
 for component in components.components:
  box=[component.bbox.left,component.bbox.top,component.bbox.right,component.bbox.bottom]
  if not inside(body,box):continue
  supports=[(bbox,entry) for bbox,entry in underlays.items() if entry.get('epoch')==epoch and entry.get('evidence') and set(entry.get('values',[]))=={component.value} and inside(bbox,box)]
  if len({tuple(bbox) for bbox,_ in supports})<2:continue
  domain=measure_contour_domain(component)
  if not domain or not domain['exact_rectangular_domain']:continue
  l,t,r,b=box;perimeter=[[x,y,component.value] for y in range(t,b+1) for x in range(l,r+1) if x in (l,r) or y in (t,b)]
  # Only an actual complete visible perimeter witnesses this rectangular scope.
  points={(component.bbox.left+c,component.bbox.top+r) for r,c in component.relative_pixels}
  if any((x,y) not in points for x,y,_ in perimeter):continue
  candidates.append({'bbox':box,'value':component.value,'perimeter':perimeter,'level_epoch':epoch,'observation_ref':observation,'domain_digest':domain['domain_digest'],'entered_positions':len(supports),'evidence':list(dict.fromkeys([ref for _,entry in supports for ref in entry['evidence']]+[observation])),'qualification':'unique_closed_domain_of_repeated_entered_support_not_a_universal_playfield_or_collision_law'})
 return candidates[0] if len(candidates)==1 else None

def contrast(domain,before,after,first,second,allowed,body):
 if not domain or domain['level_epoch']!=before['level_epoch'] or before['level_epoch']!=after['level_epoch'] or not inside(body,domain['bbox']):return None
 # The measured pre-action domain must still be exact. Only the already
 # authorized contact/body regions may hide or transform its current contour.
 before_contour=revalidate_domain(domain,first,[allowed[1]] if len(allowed)>1 else [])
 after_contour=revalidate_domain(domain,second,allowed)
 if not before_contour or not after_contour:return None
 interior=[];remote=[]
 for y,row in enumerate(first):
  for x,value in enumerate(row):
   if value==second[y][x] or any(l<=x<=r and t<=y<=b for l,t,r,b in allowed):continue
   (interior if inside([x,y,x,y],domain['bbox']) else remote).append([x,y,value,second[y][x]])
 if not remote:return None
 xs=[p[0] for p in remote];ys=[p[1] for p in remote]
 return {'unauthorized_domain_changes':len(interior),'remote_effects':{'status':'unexplained_changes_outside_current_measured_support_domain','count':len(remote),'bbox':[min(xs),min(ys),max(xs),max(ys)],'delta_sha256':hashlib.sha256(json.dumps(remote,separators=(',',':')).encode()).hexdigest(),'evidence':[before['observation_ref'],after['observation_ref']],'unknown':['role','causal_necessity','relation_to_goal']},'domain_ref':domain['domain_digest'],'current_contour_revalidation':{'before':before_contour,'after':after_contour,'authorized_regions':allowed,'qualification':'same_measured_domain_outside_current_authorized_contact_regions'}}


def revalidate_domain(domain,rows,occluders=()):
 """Current visible perimeter, including previously observed authorized edits."""
 frame={'bbox':domain['bbox'],'palette_value':domain['value'],'corner_value':domain['value']}
 edits=[[x,y,x,y] for x,y,value in domain.get('current_perimeter',domain['perimeter']) if value!=domain['value']]
 current=revalidate_frame(frame,rows,occluders=list(occluders)+edits)
 if not current:return None
 for x,y,value in domain.get('current_perimeter',domain['perimeter']):
  if any(l<=x<=r and t<=y<=b for l,t,r,b in occluders):continue
  if rows[y][x]!=value:return None
 return {**current,'retained_edits_revalidated':len(edits)}


def recall(record,scene,obs,rows):
 if not record or not record.get('active'):return None
 domain=record['domain']
 if domain['level_epoch']!=obs['level_epoch']:
  record.update(active=False,refutation={'reason':'scope_changed','observation_ref':obs['observation_ref']});return None
 if record['body_signature']!=scene['body_signature'] or not inside(scene['body'],domain['bbox']):return None
 current=revalidate_domain(domain,rows,[scene['body']])
 if not current:
  record.update(active=False,refutation={'reason':'current_visible_perimeter_contradiction_or_insufficient_anchor','observation_ref':obs['observation_ref']});return None
 return {**deepcopy(domain),'observation_ref':obs['observation_ref'],'evidence':list(dict.fromkeys(record['evidence']+[obs['observation_ref']])),'retained_domain_revalidation':{'source_observation':record['after'],'current':current,'status':'current_perimeter_revalidated_hypothesis'}}


def retain(proposal,index,before,after,second,outcome,prior=None):
 if before['level_epoch']!=after['level_epoch']:return None
 offer=proposal.get('inventory_plan',{}).get('offer',{});domain=offer.get('scene',{}).get('support_effect_scope')
 if not domain or not(outcome.get('matched') is True or outcome.get('preservation_matched') is True):return None
 step=proposal['steps'][index];expected=step.get('expected_after');body=expected['body_bbox'] if expected else step['body_before']
 # Do not invent pixels hidden by a body along the boundary.
 if any(inside([x,y,x,y],body) for x,y,_ in domain['perimeter']):return None
 kept={k:deepcopy(domain[k]) for k in ('bbox','value','perimeter','level_epoch','domain_digest','qualification')}
 kept['current_perimeter']=[[x,y,second[y][x]] for x,y,_ in domain['perimeter']]
 if not revalidate_domain(kept,second):return None
 acquisition=deepcopy(domain.get('acquisition'))
 if not acquisition and prior and prior.get('active') and prior['body_signature']==offer['scene']['body_signature'] and all(prior['domain'][k]==domain[k] for k in ('bbox','value','level_epoch','domain_digest')):acquisition=deepcopy(prior['domain'].get('acquisition'))
 if not acquisition:
  if domain.get('retained_domain_revalidation'):return None
  source={k:domain[k] for k in ('bbox','value','perimeter','level_epoch','domain_digest','qualification')}
  acquisition={'observation_ref':domain['observation_ref'],'evidence':deepcopy(domain.get('evidence',[])),'domain_digest':domain['domain_digest'],'source_measurement_sha256':hashlib.sha256(json.dumps(source,sort_keys=True,separators=(',',':')).encode()).hexdigest(),'source_kind':'measured_complete_closed_support_contour'}
 recent=list(dict.fromkeys(domain.get('revalidation_evidence',[])+[before['observation_ref'],after['observation_ref']]))[-32:]
 evidence=list(dict.fromkeys(acquisition['evidence']+[acquisition['observation_ref']]+recent))
 kept.update(acquisition=acquisition,revalidation_evidence=recent,evidence=evidence,observation_ref=after['observation_ref'])
 return {'active':True,'domain':kept,'body_signature':offer['scene']['body_signature'],'evidence':evidence,'after':after['observation_ref'],'qualification':'observed_authorized_effect_kept_separate_from_future_action_permission'}
