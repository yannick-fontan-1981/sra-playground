from copy import deepcopy
from .geometry import measure,inventory,scene,decoded,route,digest
from .policy import ChartPolicy
class ChartNavigation:
 def __init__(self):self.policy=ChartPolicy();self.epoch=None;self.chart=None;self.position=None;self.positions=[];self.position_status=None;self.visited=[];self.grants=[];self.gains=[];self.views={};self.blocked=[];self.evidence=[];self.portable=[];self.last=None;self.method_use=None
 def state(self):return deepcopy({k:getattr(self,k)for k in('epoch','chart','position','positions','position_status','visited','grants','gains','views','blocked','evidence','portable','last','method_use')})
 def restore(self,state):
  for k,v in state.items():
   if hasattr(self,k):setattr(self,k,deepcopy(v))
 def scope(self,obs):
  if self.epoch==obs['level_epoch']:return
  if self.chart and self.evidence:self.portable.append({'source_epoch':self.epoch,'signature':self.signature(self.chart),'evidence':self.evidence,'authority':'tested_chart_interpretation_not_current_room_or_permit'})
  self.epoch=obs['level_epoch'];self.chart=None;self.position=None;self.positions=[];self.position_status=None;self.visited=[];self.grants=[];self.gains=[];self.views={};self.blocked=[];self.evidence=[];self.last=None;self.method_use=None
 def signature(self,c):return {'node_size':c['nodes'][0]['size'],'corners_separate':True,'slot_size':c['slots'][0]['size']}
 def current(self,obs,rows):
  self.scope(obs);fresh=measure(rows,obs)
  if fresh:
   if self.chart and [(n['center'],n['inside'])for n in fresh['nodes']]!=[(n['center'],n['inside'])for n in self.chart['nodes']]:self.visited=[];self.grants=[];self.gains=[];self.views={};self.blocked=[]
   fresh['initial_scene_hash']=scene(rows,fresh);self.chart=fresh;self.position=fresh['current'];self.positions=[fresh['current']];self.position_status='current_corner_anchor_hypothesis';self.chart['decoded']=decoded(fresh,obs)
   method=next((m for m in reversed(self.portable)if m['signature']==self.signature(fresh)),None);self.method_use={'method':method,'current_ref':obs['observation_ref'],'current_signature':self.signature(fresh),'status':'current_morphology_revalidated_not_world_state'}if method else None
  return self.chart
 def offers(self,obs,rows):
  c=self.current(obs,rows)
  if not c or not self.positions:return []
  cfg=self.policy.config
  if cfg['semantics']['goal']!='same_interior_annotation_as_current_anchor'or cfg['semantics']['dependency']!='node_annotation_matches_link_annotation':return []
  goals=[n for n in c['nodes']if n['center']!=c['origin']and n['inside']==c['goal_annotation_hypothesis']]
  if len(goals)!=1:return []
  held=inventory(rows,c);colors={e['annotation']for e in c['links']};deps=[n for n in c['nodes']if n['inside']is not None and n['inside']in colors and n['inside']!=c['goal_annotation_hypothesis']];out=[]
  for kind,n in [('annotation_dependency',n)for n in deps if n['center']not in self.visited]+[('homologous_marker',goals[0])]:
   excluded={tuple(z['center'])for z in c['nodes']if z['inside']is not None and z['center']not in(c['origin'],self.position,n['center'])and z['center']not in self.visited and z['inside']!=c['goal_annotation_hypothesis']};blocked=list(self.blocked)
   for e in c['links']:
    if any(d['inside']==e['annotation']for d in deps)and e['annotation']not in held and (str(e['from'])+'>'+str(e['to']))not in [g['edge']for g in self.grants]:blocked.append(str(e['from'])+'>'+str(e['to']))
   paths=[route(c,origin,n['center'],excluded,blocked)for origin in self.positions]
   if not paths or any(not path for path in paths)or len(self.positions)>cfg['max_location_alternatives']:continue
   if len({tuple(path[0]['delta'])for path in paths})!=1:continue
   path=max(paths,key=len);priors=[x for x in cfg['directions']if x['delta']==path[0]['delta']and x['action']in obs['available_action_refs']]
   if len(priors)!=1:continue
   out.append({'kind':kind,'facts':{'current_scope':c['epoch']==obs['level_epoch'],'conditional_route_nonempty':True,'common_action_for_locations':True},'action':priors[0]['action'],'distance':len(path),'route':path,'route_alternatives':paths,'target':n,'held':held,'position':self.position,'location_alternatives':self.positions,'position_status':self.position_status,'chart_ref':c['evidence'][0],'method_use':self.method_use,'unknown':['chart_direction_control_until_observed','room_correspondence_beyond_anchor','moved_or_stayed_when_scene_equal','inventory_entry_effect','permission_transaction','goal_role']})
  return out
 def propose(self,obs,rows,inputs,remaining):
  if remaining<1:return None
  offers=self.offers(obs,rows)
  if not offers:return None
  choice,workflow=self.policy.choose(offers)
  if choice['status']!='selected':return None
  o=offers[choice['index']];a={'action_ref':o['action']};focus='composition:charted:'+digest([obs['level_epoch'],o['target']['center'],o['kind']]);ev=[obs['observation_ref'],o['chart_ref'],*self.evidence];facts={'chart_question_current':True}
  return {'status':'proposed','kind':'public_chart_navigation','actions':[a],'steps':[{'action':a,'expected_after':None}],'facts':facts,'binding':{k:obs[k]for k in('observation_ref','level_epoch','frame_hash','levels_completed')},'chart_plan':{'offer':o,'choice':choice,'workflow':workflow,'drm_hash':self.policy.loaded.source_hash},'compositions':[{'id':focus,'role':'conditional_chart_access','observed':False,'things':['chart-node:'+digest(o['target']['center'])],'properties':o,'relations':['contributes_to:'+self.policy.config['goal']],'open_question':choice['reason']}],'question':{'reason':choice['reason'],'hypothesis_refs':choice['hypotheses']},'route_refs':ev,'bundle_template':{'operation_key':'OP18','composition_ref':focus,'objective_ref':self.policy.config['goal'],'purpose':choice['reason'],'preconditions':facts,'evidence':ev,'actions':[a],'preserve_refs':[],'preservation_evidence':{},'outcome_guard':{'path':['value'],'contains':focus}}}
 def bind(self,p,preserve):
  if len(p['actions'])!=1 or p['actions']!=[s.get('action')for s in p['steps']]:raise ValueError('chart actionset mismatch')
 def before(self,p,index,public,obs):
  self.bind(p,None)
  if index!=0 or any(obs[k]!=p['binding'][k]for k in('observation_ref','level_epoch','frame_hash')):return {'admitted':False,'reason':'scope_changed'}
  o=p['chart_plan']['offer'];offers=self.offers(obs,public.frame_rows);match=[a for a in offers if a['kind']==o['kind']and a['route']==o['route']and a['location_alternatives']==o['location_alternatives']and a['route_alternatives']==o['route_alternatives']and a['held']==o['held']and a['action']==o['action']]
  return {'admitted':len(match)==1 and p['actions']==[{'action_ref':o['action']}],'reason':'current_anchor_or_scoped_transition_hypothesis_and_route_revalidated'}
 def after(self,p,index,before,after,first,second):return {'matched':None,'preservation_matched':None,'seal_prefix':True,'reason':'new_room_and_inventory_effect_unknown'}
 def returned_view(self,c,e,v,frames,second,after):
  dx,dy=e['delta'];width=len(second[0]);height=c['field_bottom'];thickness=2*c['nodes'][0]['size']
  for ordinal,frame in enumerate(frames or ()):
   if len(frame)!=len(second)or any(len(a)!=len(b)for a,b in zip(frame,second)):continue
   region=lambda x,y:(x>=width-thickness if dx>0 else x<thickness if dx<0 else y>=height-thickness if dy>0 else y<thickness)
   if any(frame[y][x]!=second[y][x]for y in range(height)for x in range(width)if not region(x,y)):continue
   pixels=[(x,y)for y in range(height)for x in range(width)if region(x,y)and frame[y][x]==v]
   if pixels and all(second[y][x]!=v for x,y in pixels):return {'pixels':pixels,'observation_ref':after['observation_ref']+':returned-frame:'+str(ordinal)+':'+digest(frame),'edge':str(e.get('from'))+'>'+str(e.get('to')),'frame_ordinal':ordinal,'outside_boundary_equal_to_canonical':True}
  return None
 def record(self,before,after,command,first,second,proposal=None,index=0,frames=None):
  self.scope(before)
  if not self.chart:return None
  if before['level_epoch']!=after['level_epoch']:
   delta=after['levels_completed']-before['levels_completed'];result={'status':'official_boundary_return'if delta>0 else'new_scope_uninterpreted','events':[],'actual_score_delta':delta,'evidence':[before['observation_ref'],after['observation_ref']],'old_scene_effect':'unknown_without_identified_old_scope_frame','new_epoch_pixels_not_old_scope_evidence':True,'parent_goal_unchanged':True}
   self.evidence.extend(result['evidence']);self.scope(after);return result
  c=self.chart;prior=inventory(first,c);now=inventory(second,c);gain=[v for v in now if v not in prior];lost=[v for v in prior if v not in now];changed=scene(first,c)!=scene(second,c);events=[];relevant=proposal and'chart_plan'in proposal
  if not relevant and changed:
   self.position=None;self.positions=[];self.position_status='unknown_after_unattributed_scene_change';result={'status':'chart_position_withdrawn','events':['unattributed_scene_change_requires_current_anchor'],'evidence':[before['observation_ref'],after['observation_ref']],'chart_and_prior_evidence_preserved':True};self.last=result;return result
  if relevant:
   o=proposal['chart_plan']['offer'];edge=o['route'][0]
   destinations=[path[0]['to']for path in o['route_alternatives']];alternatives=destinations if changed else [*o['location_alternatives'],*destinations];self.positions=[list(x)for x in sorted(set(map(tuple,alternatives)))];self.position=self.positions[0]if len(self.positions)==1 else None;self.position_status='conditional_arrival_scene_changed_not_unique_world_proof'if len(self.positions)==1 else'indistinguishable_scene_location_alternatives'
   events.append('scene_change_after_direction'if changed else'scene_equal_retains_stay_and_arrival_alternatives')
   returned=measure(second,after);initial_return=scene(second,c)==c.get('initial_scene_hash');contradiction=returned is not None and returned['current']not in self.positions
   if contradiction:
    self.position=returned['current'];self.positions=[returned['current']];self.position_status='current_anchor_refutes_predicted_arrival';self.visited=[];self.grants=[];events.append('predicted_arrival_refuted_by_current_anchor')
   context_bound=changed
   if not contradiction and not initial_return and len(self.positions)>1 and len(lost)==1 and self.policy.config.get('conditional_boundary_anchor')=='match_explicit_link_annotation':
    v=lost[0];observed=[]
    for direction in self.policy.config['directions']:
     view=self.returned_view(c,{'delta':direction['delta']},v,frames,second,after)
     if view:observed.append((direction['delta'],view))
    if len(observed)==1:
     delta,view=observed[0];matches=[];unknown=[];refuted=[]
     for location in self.positions:
      links=[e for e in c['links']if e['from']==location and e['delta']==delta]
      if len(links)!=1:unknown.append(location)
      elif links[0]['annotation']==v:matches.append(location)
      else:refuted.append({'location':location,'explicit_link_annotation':links[0]['annotation'],'observed_boundary_annotation':v})
     if len(matches)==1 and not unknown:
      self.positions=matches;self.position=matches[0];self.position_status='conditional_current_boundary_annotation_anchor';context_bound=True;events.append({'conditional_boundary_anchor':{'retained':matches,'refuted_under_chart_hypothesis':refuted,'evidence':view['observation_ref'],'not_universal_room_identity':True}})
   for v in gain:
    occurrence=next((n for n in c['nodes']if n['center']==self.position and n['inside']==v),None)if len(self.positions)==1 else None
    receipt={'value':v,'current_occurrence':occurrence['center']if occurrence else None,'evidence':[before['observation_ref'],after['observation_ref']],'status':'peripheral_gain_observed_ownership_role_hypothetical'};self.gains.append(receipt)
    if occurrence and changed and not contradiction and len(self.positions)==1:self.visited.append(occurrence['center'])
    events.append({'peripheral_value_gained':receipt})
   for v in lost:
    events.append({'peripheral_value_lost':v,'evidence':[before['observation_ref'],after['observation_ref']],'interpretation':'unexplained_until_local_context_bound','quantity_unknown':True})
    candidates=[e for e in c['links']if e['from']==self.position and e['annotation']==v]
    prior_view=self.views.get(str(self.position),{});view=prior_view.get(str(v));removed=[tuple(p)for p in view['pixels']if second[p[1]][p[0]]!=v]if view else []
    if view is None and context_bound and not initial_return and not contradiction and len(candidates)==1:
     view=self.returned_view(c,candidates[0],v,frames,second,after)
     if view:removed=view['pixels']
    if context_bound and not initial_return and not contradiction and len(candidates)==1 and view and len(removed)==len(view['pixels'])and removed and view['edge']==str(candidates[0]['from'])+'>'+str(candidates[0]['to']):
     e=candidates[0];dx,dy=e['delta'];width=len(first[0]);height=c['field_bottom'];thickness=2*c['nodes'][0]['size'];side=all((x>=width-thickness if dx>0 else x<thickness if dx<0 else y>=height-thickness if dy>0 else y<thickness)for x,y in removed)
     if side:
      receipt={'edge':str(e['from'])+'>'+str(e['to']),'from':e['from'],'to':e['to'],'value':v,'removed_boundary_bbox':[min(x for x,y in removed),min(y for x,y in removed),max(x for x,y in removed),max(y for x,y in removed)],'evidence':[view['observation_ref'],before['observation_ref'],after['observation_ref']],'returned_frame_context':{k:view[k]for k in('frame_ordinal','outside_boundary_equal_to_canonical')if k in view},'position_association':'scoped_conditional_chart_correspondence','status':'local_permission_hypothesis_not_confirmed_transaction'};self.grants.append(receipt);events.append({'inventory_loss_and_local_boundary_change':receipt})
   if context_bound and not contradiction and len(self.positions)==1:
    views={};width=len(second[0]);height=c['field_bottom'];thickness=2*c['nodes'][0]['size']
    for e in c['links']:
     if e['from']!=self.position:continue
     dx,dy=e['delta'];v=e['annotation'];pixels=[(x,y)for y in range(height)for x in range(width)if second[y][x]==v and(x>=width-thickness if dx>0 else x<thickness if dx<0 else y>=height-thickness if dy>0 else y<thickness)]
     if pixels:views[str(v)]={'pixels':pixels,'observation_ref':after['observation_ref'],'edge':str(e['from'])+'>'+str(e['to'])}
    self.views[str(self.position)]=views
   self.evidence.extend([before['observation_ref'],after['observation_ref']])
  result={'status':'observed_chart_transition','events':events,'position':self.position,'position_status':self.position_status,'location_alternatives':self.positions,'actual_score_delta':after['levels_completed']-before['levels_completed'],'evidence':[before['observation_ref'],after['observation_ref']],'annotations_do_not_restore_inventory':True};self.last=result
  if before['level_epoch']!=after['level_epoch']:self.scope(after)
  return result
