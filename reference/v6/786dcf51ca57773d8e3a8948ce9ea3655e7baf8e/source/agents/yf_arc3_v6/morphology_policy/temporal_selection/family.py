from copy import deepcopy
from .geometry import measure,revalidate,digest,current_occurrence,composite_and_lateral
from .policy import SelectionPolicy
from .response import observe_deviation,target_question,played_scope_frames,poses,recall_launch
class TemporalSelection:
 def __init__(self):self.policy=SelectionPolicy();self.epoch=None;self.measurement=None;self.attempts={};self.receipts=[];self.portable=[];self.edit=None;self.pending=None;self.launch_attempts={};self.response=None;self.response_closed=False;self.launch_methods=[];self.boundary_reviews=[]
 def state(self):return {k:deepcopy(getattr(self,k))for k in ('epoch','measurement','attempts','receipts','portable','edit','pending','launch_attempts','response','response_closed','launch_methods','boundary_reviews')}
 def restore(self,s):
  for k,v in s.items():setattr(self,k,deepcopy(v))
 def scope(self,obs):
  if self.epoch==obs['level_epoch']:return
  if self.receipts:self.portable.append({'epoch':self.epoch,'receipts':self.receipts,'status':'historical_not_current_permit'})
  self.epoch=obs['level_epoch'];self.measurement=None;self.attempts={};self.receipts=[];self.edit=None;self.pending=None;self.launch_attempts={};self.response=None;self.response_closed=False
 def _offers_current(self,obs,rows):
  self.scope(obs)
  if not self.measurement:
   alternatives=[]
   for method in self.launch_methods:
    current=recall_launch(method,rows)
    if current:
     attempt_key='recall:'+digest([obs['level_epoch'],digest(rows),method['command'],current['body']])
     if attempt_key in self.launch_attempts:continue
     x,y=current['center'];candidate={'center':[x,y],'bbox':[x,y,x,y],'ref':'recalled-launch:'+digest(method['body']),'distance':0};alternatives.append({'kind':'recalled_launch','attempt_key':attempt_key,'candidate':candidate,'center':[x,y],'context':digest(rows),'geometry':{'body':current['body'],'stage':'rebind_animation'},'evidence':[obs['observation_ref'],*method['evidence']],'facts':{'animation_observed':True,'current_supports':True,'untried_current_context':True},'launch_command':method['command'],'current_revalidation':current})
   unique={digest({'action':o['launch_command'],'body':o['geometry']['body']}):o for o in alternatives}
   return list(unique.values())if len(unique)==1 else[]

  context=digest(rows);basefacts={'animation_observed':True,'current_supports':True,'untried_current_context':True}
  if self.response:
   if self.response_closed:return []
   candidates=[c for c in self.measurement['candidates']if c['ref']!=self.response['edited_candidate']['ref']]
   options=[]
   for c in candidates:
    now=current_occurrence(c,rows)
    if now is None:continue
    if self.pending and self.pending.get('candidate_ref')==c['ref']and now['center']==self.pending['geometry']['target']and context not in self.launch_attempts:
     g=self.pending['geometry']
     if all(rows[y][x]==v for x,y,v in [*g['body'],*g['other_occurrence_pixels']]):options.append({'kind':'launch_changed_arrangement','candidate':c,'center':now['center'],'context':context,'geometry':g,'evidence':[*self.response['evidence'],*self.pending['evidence']],'facts':basefacts,'launch_command':self.measurement['command']})
     continue
    g=target_question(self.response,c,rows,self.policy.config['second_locus_question'])
    if not g:continue
    receipt=next((r for r in reversed(self.receipts)if r['candidate']['ref']==c['ref']),None)
    selected=receipt and receipt.get('overlay')and all(rows[now['center'][1]+dy][now['center'][0]+dx]==v for dx,dy,v in receipt['overlay'])
    kind='lateral_edit_experiment'if selected else'point_control'
    options.append({'kind':kind,'candidate':c,'center':g['target']if selected else now['center'],'context':context,'geometry':g,'current_occurrence':now,'evidence':[*self.response['evidence'],*(receipt['evidence']if receipt else[])],'facts':basefacts,'edit_method_recalled_from':self.edit['evidence']if selected and self.edit else[]})
   return options if len(options)==1 else []
  if self.edit:
   c=self.edit['original'];now=current_occurrence(c,rows)
   if now is None:return []
   overlay=self.edit.get('overlay',[])
   if not overlay or any(rows[now['center'][1]+dy][now['center'][0]+dx]!=v for dx,dy,v in overlay):return []
   if self.pending and now['center']==self.pending['geometry']['target']and context not in self.launch_attempts:
    g=self.pending['geometry']
    if all(rows[y][x]==v for x,y,v in [*g['body'],*g['other_occurrence_pixels']]):return [{'kind':'launch_changed_arrangement','candidate':c,'center':now['center'],'context':context,'geometry':g,'evidence':[*self.measurement['evidence'],*self.edit['evidence'],*self.pending['evidence']],'facts':basefacts,'launch_command':self.measurement['command']}]
   if self.pending:return []
   g=composite_and_lateral(self.measurement,c,rows)
   if g and now['center']!=g['target']:return [{'kind':'lateral_edit_experiment','candidate':c,'center':g['target'],'context':context,'geometry':g,'current_occurrence':now,'evidence':[*self.measurement['evidence'],*self.edit['evidence']],'facts':basefacts}]
  if self.receipts:return []
  return [{'kind':'point_control','center':c['center'],'candidate':c,'context':context,'evidence':self.measurement['evidence'],'facts':basefacts}for c in self.measurement['candidates']if revalidate(c,rows)and context+c['ref']not in self.attempts]

 def offers(self,obs,rows):
  offers=self._offers_current(obs,rows)
  for offer in offers:
   action=offer['launch_command']['action_ref'] if offer['kind'] in ('launch_changed_arrangement','recalled_launch') else self.policy.config['point_action']
   offer['facts']['current_input_publicly_available']=action in obs['available_action_refs']
  return offers
 def propose(self,obs,rows,inputs,remaining):
  if remaining<1:return None
  offers=self.offers(obs,rows)
  if not offers:return None
  choice,workflow=self.policy.choose(offers)
  if choice['status']!='selected':return None
  o=offers[choice['index']];c=o['candidate'];x,y=o['center'];a=deepcopy(o['launch_command'])if o['kind']in('launch_changed_arrangement','recalled_launch')else {'action_ref':self.policy.config['point_action'],'data':{'x':x,'y':y}};focus='composition:temporal-selection:'+digest([obs['level_epoch'],c['ref']]);facts={'temporal_selection_current':True,'current_input_publicly_available':o['facts']['current_input_publicly_available']};evidence=[obs['observation_ref'],*o['evidence']]
  result={'status':'proposed','kind':'public_temporal_selection','actions':[a],'steps':[{'action':a,'expected_after':None,'point_binding':{'entity_ref':c['ref'],'observation_ref':obs['observation_ref'],'signature':digest(c),'bbox':[x,y,x,y],'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash'],'point':[x,y],'palette_value':rows[y][x],'source':'currently_supported_stationary_occurrence'}}],'facts':facts,'binding':{k:obs[k]for k in ('observation_ref','level_epoch','frame_hash')},'temporal_selection_plan':{'offer':o,'choice':choice,'workflow':workflow,'drm_hash':self.policy.loaded.source_hash},'compositions':[{'id':focus,'role':'conditional_point_control_question','observed':False,'things':[c['ref']],'properties':o,'relations':['contributes_to:G_official_completion'],'open_question':choice['reason']}],'question':{'reason':choice['reason'],'hypothesis_refs':choice['hypotheses']},'route_refs':evidence,'bundle_template':{'operation_key':'OP18','composition_ref':focus,'objective_ref':'G_official_completion','purpose':choice['reason'],'preconditions':facts,'evidence':evidence,'actions':[a],'preserve_refs':[],'preservation_evidence':{},'outcome_guard':{'path':['value'],'contains':focus}}}
  if o['kind']in('launch_changed_arrangement','recalled_launch'):result['steps'][0].pop('point_binding')
  return result
 def bind(self,p,preserve):
  if len(p['actions'])!=1 or p['actions']!=[s.get('action')for s in p['steps']]:raise ValueError('temporal actionset mismatch')
 def before(self,p,index,public,obs):
  self.bind(p,None)
  if index!=0 or any(obs[k]!=p['binding'][k]for k in p['binding']):return {'admitted':False,'reason':'scope_changed'}
  o=p['temporal_selection_plan']['offer'];matches=[q for q in self.offers(obs,public.frame_rows)if q==o]
  x,y=matches[0]['center']if len(matches)==1 else (None,None)
  expected=matches[0]['launch_command']if len(matches)==1 and matches[0]['kind']in('launch_changed_arrangement','recalled_launch')else {'action_ref':self.policy.config['point_action'],'data':{'x':x,'y':y}}
  return {'admitted':len(matches)==1 and p['actions']==[expected],'reason':'current_stationary_occurrence_and_exact_payload'}
 def after(self,p,index,before,after,first,second):return {'matched':None,'preservation_matched':None,'seal_prefix':True,'reason':'point_control_effect_unknown'}
 def record(self,before,after,command,first,second,proposal=None,index=0,frames=None):
  self.scope(before)
  if before['level_epoch']!=after['level_epoch']:
   reviews=[]
   if proposal and 'temporal_selection_plan'in proposal:
    offer=proposal['temporal_selection_plan']['offer'];geometry=offer.get('geometry',{});body=geometry.get('body',[])
    if body and self.measurement:
     masks=[]
     for candidate in self.measurement['candidates']:
      now=current_occurrence(candidate,first)
      if now:masks.append([[x,y,now['value']]for x,y in now['pixels']])
     scoped=played_scope_frames(first,frames or [],masks)if masks else[]
     reviews={'played_epoch':before['level_epoch'],'official_score_delta':after['levels_completed']-before['levels_completed'],'frame_indices':[i for i,f in scoped],'poses':poses(body,[f for i,f in scoped]),'evidence':[before['observation_ref'],after['observation_ref']],'method_unknowns':['unseen_curve_samples','type_universality','cross_level_effect'],'new_canonical_not_used_as_old_effect':True};self.boundary_reviews.append(reviews)
     if scoped:self.launch_methods.append({'body':body,'command':deepcopy(command),'evidence':reviews['evidence'],'played_epoch':before['level_epoch'],'review_digest':digest(reviews),'status':'portable_method_not_current_permit'})
   self.scope(after);return {'status':'official_boundary','review':reviews,'new_scope_effect_unknown':True}

  refs=[before['observation_ref'],after['observation_ref']]
  if self.receipts and command.get('action_ref')==self.policy.config['point_action']:
   c=self.receipts[-1]['candidate'];a=current_occurrence(c,first);b=current_occurrence(c,second);data=command.get('data',{})
   if a and b and a['center']!=b['center']and b['center']==[data.get('x'),data.get('y')]:
    regions=[a['bbox'],b['bbox']];changed=[[x,y]for y,row in enumerate(first)for x,v in enumerate(row)if second[y][x]!=v]
    confined=all(any(l-3<=x<=r+3 and t-3<=y<=bottom+3 for l,t,r,bottom in regions)for x,y in changed)
    if confined:self.edit={'original':c,'current':b,'evidence':[*self.receipts[-1]['evidence'],*refs],'point_destination_observed':True,'other_pixels_preserved':True,'overlay':self.receipts[-1].get('overlay',[])}

  if frames and len(frames)>=3:
   m=measure(first,frames)
   if m and not self.measurement:
    self.measurement={**m,'evidence':refs,'command':deepcopy(command)}
    if proposal and proposal.get('temporal_selection_plan',{}).get('offer',{}).get('kind')=='recalled_launch':
     offer=proposal['temporal_selection_plan']['offer'];self.measurement['revalidated_body']=deepcopy(offer['geometry']['body']);self.measurement['body_evidence']=list(offer['evidence']);self.measurement['body_status']='current_scope_template_revalidated_before_launch_not_foreign_pose'

  if proposal and 'temporal_selection_plan'in proposal:
   o=proposal['temporal_selection_plan']['offer'];c=o['candidate']
   if o['kind']=='recalled_launch':
    event={'status':'recalled_launch_returned','evidence':refs,'current_animation_acquired':self.measurement is not None,'not_old_scope_permit':True,'attempt_key':o['attempt_key']}
    self.launch_attempts[o['attempt_key']]=event
    return event
   if o['kind']=='lateral_edit_experiment':
    now=current_occurrence(c,second)
    if now and now['center']==o['center']and all(second[y][x]==v for x,y,v in [*o['geometry']['body'],*o['geometry']['other_occurrence_pixels']]):self.pending={'geometry':o['geometry'],'candidate_ref':c['ref'],'evidence':refs,'edit_result':'measured_target_arrival_not_trajectory_prediction'}
    return {'status':'edit_response','expected_center_observed':bool(now and now['center']==o['center']),'evidence':refs}
   if o['kind']=='launch_changed_arrangement':
    self.launch_attempts[o['context']]={'evidence':refs,'frame_count':len(frames or [])}
    if o['geometry'].get('stage')=='second_locus':self.response_closed=True
    else:self.response=observe_deviation(o,frames or [],refs)
    return {'status':'arrangement_launch_returned','evidence':refs,'frame_count':len(frames or []),'trajectory_law_unknown':True}
   changed=[[x,y]for y,row in enumerate(first)for x,v in enumerate(row)if second[y][x]!=v];self.attempts[o['context']+c['ref']]={'evidence':refs,'changed_count':len(changed)}
   x0,y0,x1,y1=c['bbox'];local_changes=[[x,y]for x,y in changed if x0-2<=x<=x1+2 and y0-2<=y<=y1+2]
   explained_old=set()
   for receipt in self.receipts:
    previous=current_occurrence(receipt['candidate'],first)
    if previous:
     for dx,dy,v in receipt.get('overlay',[]):
      x,y=previous['center'][0]+dx,previous['center'][1]+dy
      if first[y][x]==v and second[y][x]==self.measurement['initial_rows'][y][x]:explained_old.add((x,y))
   local=bool(local_changes)and all([x,y]in local_changes or(x,y)in explained_old for x,y in changed);retained=all(second[y][x]==c['value']for x,y in c['pixels'])
   event={'status':'point_response','evidence':refs,'changed_count':len(changed),'local_effect':local,'old_occurrence_pixels_retained':retained,'candidate':c,'control_meaning_unknown':True,'overlay':[[x-c['center'][0],y-c['center'][1],second[y][x]]for x,y in local_changes]}
   if local and retained:self.receipts.append(event)
   return event
  return {'status':'animation_track_measured','evidence':refs,'candidate_count':len(self.measurement['candidates'])}if frames and self.measurement else None
