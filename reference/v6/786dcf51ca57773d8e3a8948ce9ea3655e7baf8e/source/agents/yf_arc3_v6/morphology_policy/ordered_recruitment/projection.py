from itertools import product
from .geometry import digest
from agents.yf_arc3_v5.capabilities.ordered_front_reduction_d import DuelOccurrenceD,HeadDuelRuleD,OrderedFrontReductionRequestD,measure_ordered_front_reduction_d
from agents.yf_arc3_v5.capabilities.mechanical_family_contracts_d import DMechanicalScope
from agents.yf_arc3_v6.morphology_policy.src_runtime import plain

def summary(m):
 r=m['rooms'][m['current']]
 return {'room':m['current'],'phase':m['phase_hypothesis'],'quota':m['quota'],'queue':[u['type']for u in r['left']],'enemy':[u['type']for u in r['right']]}

def alternatives(m,cfg,obs,remaining):
 if cfg['queue_order_hypothesis']!='front_spiral_inward' or cfg['append_hypothesis']!='tail' or cfg['winner_hypothesis']!='KEEP':return [],{'truncated':False,'cause':'unsupported_declared_model'}
 pairs=m['legend']['pairs'];ids={v:i for i,p in enumerate(pairs)for v in p};wins={(ids[r['left'][0]],ids[r['right'][0]])for r in m['legend']['relations']};rules=[]
 for a,b in product(range(len(pairs)),repeat=2):
  outcome='TIE'if a==b else'LEFT'if(a,b)in wins else'RIGHT'if(b,a)in wins else None
  if outcome is None:return [],{'truncated':False,'cause':'incomplete_relation_hypothesis'}
  rules.append(HeadDuelRuleD(left_type_ref='type:'+str(a),right_type_ref='type:'+str(b),result=outcome,winner_rank_rule=cfg['winner_hypothesis'],winner_rank_value=None,law_evidence_ref='hypothesis:current_legend:'+digest(m['legend'])))
 scope=DMechanicalScope(request_ref='ordered_projection:'+obs['observation_ref'],caller_ref='ordered_recruitment',parent_consumer_ref='G_official_completion',parent_goal_ref='G_official_completion',parent_contribution_ref='visible_room_survival_hypothesis',caller_next_item_ref='choose_current_bound_input',epoch=obs['level_epoch'],evidence_revision_ref=obs['observation_ref'],model_revision_ref=digest([cfg,m['legend']]),model_status_ref='conditional_not_acquired_full_law',event_owner_ref='current_public_question',input_domain_complete=True,assumption_refs=tuple(cfg['hypotheses']))
 cache={};visited=0;truncated=False
 def reduce(queue,enemy):
  key=(tuple(queue),tuple(enemy))
  if key in cache:return cache[key]
  left=tuple(DuelOccurrenceD(occurrence_ref='ally:'+str(i),type_ref='type:'+str(t),camp_ref='player',rank=i)for i,t in enumerate(queue));right=tuple(DuelOccurrenceD(occurrence_ref='enemy:'+str(i),type_ref='type:'+str(t),camp_ref='enemy',rank=i)for i,t in enumerate(enemy))
  req=OrderedFrontReductionRequestD(scope=scope,operation_ref='mechanics.typed_word_transduction.ordered_front_reduction',mode_ref='STEP_INTERNAL',requested_result_type='DMechanicalResult',node_bound=4096,depth_bound=4096,domain_bound=4096,time_bound_ms=1000,phase_ref='INTERNAL_ENGAGEMENT',left_queue=left,right_queue=right,left_camp_ref='player',right_camp_ref='enemy',head_rules=tuple(rules),tie_rule=cfg['tie_hypothesis'],closure_scope='engagement',parent_command_ref='hypothetical_engage',left_queue_revision_ref=obs['observation_ref'],right_queue_revision_ref=obs['observation_ref'],completed_duel_cursor=0)
  result=measure_ordered_front_reduction_d(req)
  if not result.domain_complete:return None
  values=plain(result.values);answer=([int(u['type_ref'].split(':')[-1])for u in values['left_queue']],[int(u['type_ref'].split(':')[-1])for u in values['right_queue']],values['consumption_trace']);cache[key]=answer;return answer
 plans=[];rooms=m['rooms'];buttons={b['type']:b for b in m['buttons']}
 def visit(room,phase,quota,queue,steps,trace):
  nonlocal visited,truncated
  visited+=1
  if visited>cfg['search_bound']:truncated=True;return
  if len(steps)>remaining:return
  if phase=='COMBAT':
   enemy=[u['type']for u in rooms[room]['right']];result=reduce(queue,enemy)
   if result is None or not result[0]or result[1]:return
   survivors,_,events=result;before={'room':room,'phase':'COMBAT','quota':None,'queue':queue,'enemy':enemy};final=room==len(rooms)-1;nextquota=rooms[room]['quota_hypothesis']
   after=None if final else{'room':room,'phase':'RECRUIT','quota':nextquota,'queue':survivors,'enemy':[]};step={'action':{'action_ref':cfg['engage_prior']},'expected_context':before,'projected_context':after,'kind':'engage','type':None};chain=steps+[step]
   if final:
    if len(chain)<=remaining:plans.append({'steps':chain,'cost':len(chain),'survivors':len(survivors),'trace':trace+events,'status':'conditional_all_visible_stages_not_actual_success'})
   elif nextquota>0:visit(room,'RECRUIT',nextquota,survivors,chain,trace+events)
  else:
   if quota is None or quota<1 or quota>cfg['quota_bound']:return
   for typ in sorted(buttons):
    queue2=queue+[typ];last=quota==1;nextroom=room+1 if last else room
    if nextroom>=len(rooms):continue
    after={'room':nextroom,'phase':'COMBAT'if last else'RECRUIT','quota':None if last else quota-1,'queue':queue2,'enemy':[u['type']for u in rooms[nextroom]['right']]if last else[]};b=buttons[typ];step={'action':{'action_ref':cfg['point_action'],'data':{'x':b['point'][0],'y':b['point'][1]}},'expected_context':{'room':room,'phase':'RECRUIT','quota':quota,'queue':queue,'enemy':[]},'projected_context':after,'kind':'assign','type':typ};visit(nextroom,after['phase'],after['quota'],queue2,steps+[step],trace)
 s=summary(m);visit(s['room'],s['phase'],s['quota'],s['queue'],[],[])
 return plans,{'visited':visited,'truncated':truncated,'incompleteness_is_not_impossibility':True,'reused':'measure_ordered_front_reduction_d'}
