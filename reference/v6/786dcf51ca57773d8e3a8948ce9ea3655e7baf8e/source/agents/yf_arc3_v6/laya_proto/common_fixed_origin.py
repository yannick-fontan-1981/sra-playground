"""Bind current placement/program observations to retained finite-program methods."""
import json
from pathlib import Path
from collections import Counter,defaultdict
from itertools import product
from agents.yf_arc3_v5.capabilities import ComponentExtractionInput,FrameGrid,detect_components
from agents.yf_arc3_v5.capabilities.program_instruction_shape_d import measure_program_instruction_shape_d
from agents.yf_arc3_v5.capabilities.fixed_program_origin import FixedProgramModel,FixedProgramRequest,ProgramPose,measure_fixed_program_origin
from common_control_dependencies import ControlDependencies
from common_multiscale_constraints import digest
from agents.yf_arc3_v5.capabilities.mechanical_family_contracts_d import DMechanicalScope
from observed_input_domain import ObservedInputDomain
from src_bridge import plain
from agents.yf_arc3_v5.capabilities.digital_topology import _components as connected_components

def parts(rows):return detect_components(ComponentExtractionInput(frame=FrameGrid(rows=tuple(map(tuple,rows))),connectivity=4)).components
def box(c):return [c.bbox.left,c.bbox.top,c.bbox.right,c.bbox.bottom]
def fill(rows,b):
 l,t,r,d=b;v={rows[y][x] for y in range(t,d+1) for x in range(l,r+1)}
 return next(iter(v)) if len(v)==1 else None
def scene(rows):
 components=parts(rows);rects=defaultdict(list);borders=defaultdict(list)
 for c in components:
  h,w=c.bbox.height,c.bbox.width
  if c.area==h*w and min(h,w)>1:rects[h,w].append(c)
  if c.area==2*(h+w)-4 and min(h,w)>3:
   measured=measure_program_instruction_shape_d(tuple(sorted(c.pixels)))
   if measured.get('rectangle_border_only'):borders[h,w].append(c)
 groups=[v for v in borders.values() if len(v)>=2]
 if len(groups)!=1:return None
 panels=sorted(groups[0],key=lambda c:(c.bbox.top,c.bbox.left));top=min(c.bbox.top for c in panels)
 nodesets=[[c for c in v if c.bbox.bottom<top] for v in rects.values()];nodesets=[v for v in nodesets if len(v)>=3]
 if not nodesets:return None
 nodes=max(nodesets,key=len)
 if sum(len(v)==len(nodes) for v in nodesets)!=1:return None
 nodes=sorted(nodes,key=lambda c:(c.bbox.top,c.bbox.left));boxes=[box(c) for c in panels];word=[]
 for b in boxes:
  l,t,r,d=b;counts=Counter(rows[y][x] for y in range(t+1,d) for x in range(l+1,r));background=counts.most_common(1)[0][0]
  support=tuple((y-t-1,x-l-1) for y in range(t+1,d) for x in range(l+1,r) if rows[y][x]!=background)
  if not support:return None
  word.append(digest(support))
 return {'nodes':[box(c) for c in nodes],'boxes':boxes,'word':word,'common_fill':Counter(c.value for c in nodes).most_common(1)[0][0],'shape':[nodes[0].bbox.width,nodes[0].bbox.height]}
def active(rows,layout):
 values=[rows[b[1]][b[0]] for b in layout['boxes']];counts=Counter(values);indices=[i for i,v in enumerate(values) if counts[v]==1]
 return indices[0] if len(indices)==1 else None

class FixedOrigin:
 def __init__(self):
  self.policy=json.loads(Path(__file__).with_name('common_frontier_policy.drm.json').read_text())['fixed_origin_acquisition']
  self.port_policy=json.loads(Path(__file__).with_name('common_frontier_policy.drm.json').read_text())['fixed_origin_ports']
  self.link_policy=json.loads(Path(__file__).with_name('common_frontier_policy.drm.json').read_text())['fixed_origin_link_ports']
  if self.link_policy['enabled']:self.port_policy['hypotheses']+=self.link_policy['hypotheses']
  self.epoch=None;self.pending=None;self.questions=ControlDependencies();self.inert=set();self.actor_color=None;self.executions=[];self.events=[];self.scored_targets=[];self.origin_attempts=set()
 def state(self):
  return plain({'format':'fixed_origin_state.v1','epoch':self.epoch,'pending':self.pending,'inert':sorted(self.inert),'actor_color':self.actor_color,'executions':self.executions,'events':self.events,'scored_targets':self.scored_targets,'origin_attempts':sorted(self.origin_attempts),'questions':{'pending':self.questions.pending,'attempted':sorted(self.questions.attempted)}})
 def restore(self,state):
  if state.get('format')!='fixed_origin_state.v1':raise ValueError('Unknown fixed-origin state contract')
  required={'format','epoch','pending','inert','actor_color','executions','events','scored_targets','origin_attempts','questions'}
  if set(state)!=required or set(state['questions'])!={'pending','attempted'}:raise ValueError('Incomplete fixed-origin state contract')
  value=json.loads(json.dumps(state))
  for key in ('epoch','pending','actor_color','executions','events','scored_targets'):setattr(self,key,value[key])
  self.inert=set(value['inert']);self.origin_attempts=set(value['origin_attempts']);self.questions=ControlDependencies();self.questions.pending=value['questions']['pending'];self.questions.attempted=set(value['questions']['attempted'])
 def record(self,before,after,command,first,second,proposal=None,index=None,frames=None):
  self.events=[]
  if 'ACTION6' not in before['available_action_refs'] or len(set(before['available_action_refs'])-{'ACTION6','ACTION7'})!=1:return {'status':'interface_not_applicable','events':[]}
  if before['level_epoch']!=after['level_epoch']:
   if after['levels_completed']>before['levels_completed'] and proposal and proposal.get('support_plan',{}).get('origin_access'):
    self.scored_targets.append(proposal['support_plan']['target_color'])
   self.epoch=after['level_epoch'];self.pending=None;self.inert=set();self.actor_color=None
   return {'status':'fixed_origin_boundary','events':[]}
  a,b=scene(first),scene(second)
  if not a or not b or a['nodes']!=b['nodes'] or a['word']!=b['word']:return {'status':'no_fixed_interface','events':[]}
  if not command.get('data') and first==second:self.inert.add(command['action_ref'])
  if command.get('data'):
   changes=[(i,fill(first,bb),fill(second,bb)) for i,bb in enumerate(a['nodes']) if fill(first,bb)!=fill(second,bb)]
   if len(changes)==1 and changes[0][2] is not None and changes[0][1]==a['common_fill']:
    self.actor_color=changes[0][2];self.pending={'ref':after['observation_ref'],'frame':after['frame_hash'],'layout':b,'node':changes[0][0],'placement':command,'evidence':[before['observation_ref'],after['observation_ref']]}
    self.events=[{'kind':'placement_changed_with_unchanged_word','before':before['observation_ref'],'after':after['observation_ref'],'node':changes[0][0],'program_word_length':len(b['word'])}]
  elif proposal and proposal.get('support_plan',{}).get('fixed_origin'):
   p=proposal['support_plan']
   if p.get('origin_access'):self.origin_attempts.add(p['question_key'])
   else:self.questions.record_attempt(p['question_key'])
   layout=p['layout'];trace=[]
   for frame in [first]+list(frames or [second]):
    nodes=[i for i,bb in enumerate(layout['nodes']) if fill(frame,bb)==self.actor_color]
    trace.append({'active':active(frame,layout),'node':nodes[0] if len(nodes)==1 else None})
   result={'kind':'fixed_program_public_execution','before':before['observation_ref'],'after':after['observation_ref'],'command':command,'layout':layout,'actor_color':self.actor_color,'trace':trace,'link_ports':{str(direction):connected_ports(first,layout['nodes'],direction) for direction in (-1,1)},'stroke_ports':{str(direction):stroke_ports(first,layout['nodes'],direction) for direction in (-1,1)},'node_fills':[fill(first,bb) for bb in layout['nodes']],'exclusive_control_semantics':False}
   self.executions.append(result);self.events=[result];self.pending=None
  return {'status':'fixed_origin_observed','events':self.events}
 def propose(self,obs,rows,inputs,remaining):
  if not self.policy['enabled'] or remaining<=0:return None
  if self.executions:
   access=self.origin_offer(obs,rows,inputs,remaining)
   if access:return access
  if not self.pending:return None
  p=self.pending
  if p['ref']!=obs['observation_ref'] or p['frame']!=obs['frame_hash']:return None
  actions=[a for a in inputs if not a.get('data') and a['action_ref'] in self.inert]
  if len(actions)!=1:return None
  command=actions[0];key=self.questions.question_key(obs['level_epoch'],'program_response_after_placement',{'layout':p['layout'],'node':p['node']},command)
  if key in self.questions.attempted:return None
  plan={'fixed_origin':True,'question_key':key,'layout':p['layout'],'frame_hash':obs['frame_hash'],'actor_color':self.actor_color,'placement':p['placement']}
  ref='C_fixed_origin_'+key[:16];why='A point intervention changed one repeated node while preserving the displayed word. Re-test the previously inert non-point input once in this current context; its response is unknown.'
  facts={'current_placement_observed':True,'word_geometry_unchanged':True,'input_previously_inert':True,'control_after_placement_unknown':True};evidence=p['evidence']
  return {'status':'proposed','kind':'fixed_origin_dependency','support_plan':plan,'actions':[command],'steps':[{'action':command,'expected_before':{'frame_hash':obs['frame_hash']},'expected_after':{'status':'unknown'}}],'facts':facts,'compositions':[{'id':ref,'role':'information_question','observed':False,'open_question':why,'properties':{'parent_method':'fixed program origin applicability'},'relations':['contributes_to:G_official_completion']}],'question':{'reason':why,'hypothesis_refs':evidence},'route_refs':evidence,'binding':{'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'levels_completed':obs['levels_completed']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'purpose':why,'preconditions':facts,'evidence':evidence,'actions':[command],'frozen_support_plan':plan,'outcome_guard':{'path':['value'],'contains':ref}}}
 def before(self,p,i,public,o):
  b=p['binding'];plan=p['support_plan'];ok=public.level==b['level_epoch'] and public.levels_completed==b['levels_completed']
  if plan.get('origin_access') and i:
   current=scene(public.frame_rows);ok=ok and current is not None and current['word']==plan['layout']['word'] and fill(public.frame_rows,plan['layout']['nodes'][plan['origin']])==plan['marker_color_hypothesis']
  else:ok=ok and public.frame_hash==plan['frame_hash']
  return {'admitted':ok,'reason':'current_fixed_word_and_placement_context' if ok else 'placement_context_changed'}
 def after(self,p,i,before,after,first,second):
  plan=p['support_plan']
  if plan.get('origin_access') and i==0:
   current=scene(second);matched=current is not None and current['word']==plan['layout']['word'] and fill(second,plan['layout']['nodes'][plan['origin']])==plan['marker_color_hypothesis']
   return {'matched':matched,'seal_prefix':not matched,'reason':'revalidate_placement_before_known_program_control'}
  return {'matched':None,'seal_prefix':True,'reason':'observe_fixed_program_response'}

 def origin_offer(self,obs,rows,inputs,remaining):
  if remaining<2:return None
  layout=scene(rows)
  if not layout:return None
  rules=defaultdict(list);evidence=[]
  for execution in self.executions:
   examples=program_samples(execution)
   for label,samples in examples.items():
    hypotheses=list(self.port_policy['hypotheses'])
    for direction,styles in execution.get('stroke_ports',{}).items():
     hypotheses.extend(('stroke_priority',int(direction),color) for color in styles)
    candidates=fit_port_rules(execution['layout']['nodes'],samples,hypotheses,execution.get('link_ports'),execution.get('stroke_ports'))
    if not candidates:return None
    rules[label].append(set(candidates))
   evidence.append(execution['after'])
  alternatives={label:set.intersection(*sets) for label,sets in rules.items()};learned={}
  for label,options in alternatives.items():
   supported={rule for rule in options if rule[0]=='connected_neighboring_band'}
   if not supported:supported={rule for rule in options if rule[0]=='stroke_priority'}
   learned[label]=supported if supported else options
  if any(label not in learned or len(learned[label])!=1 for label in layout['word']):return None
  fills=[fill(rows,b) for b in layout['nodes']];common=layout['common_fill'];marker=self.actor_color if self.actor_color is not None else self.executions[-1]['actor_color']
  targets=[i for i,v in enumerate(fills) if v not in (None,common,marker) and (not self.scored_targets or v in self.scored_targets)]
  if len(targets)!=1:return None
  target=targets[0];nodes=tuple(str(i) for i in range(len(fills)));port_domains=[]
  for label in dict.fromkeys(layout['word']):
   rule=next(iter(learned[label]));mapping=port_rule(layout['nodes'],rule,{str(d):connected_ports(rows,layout['nodes'],d) for d in (-1,1)},{str(d):stroke_ports(rows,layout['nodes'],d) for d in (-1,1)})
   options=connected_ports(rows,layout['nodes'],rule[1],alternatives=True) if rule[0]=='connected_neighboring_band' else [(v,) for v in mapping]
   port_domains.extend((str(i),label,tuple(str(v) if v is not None else None for v in choices)) for i,choices in enumerate(options))
  count=1
  for start,label,options in port_domains:count*=len(options)
  if count>32:return None
  port_variants=[tuple((start,label,end) for (start,label,options),end in zip(port_domains,choice)) for choice in product(*(item[2] for item in port_domains))];ports=port_variants[0]
  domains=[];hits=[]
  for i,b in enumerate(layout['nodes']):
   if fills[i]!=common:continue
   choices=[a for a in inputs if a.get('data') and b[0]<=a['data']['x']<=b[2] and b[1]<=a['data']['y']<=b[3]]
   if choices:domains.append((i,choices[0]));hits.append((str(i),str(i)))
  if not domains:return None
  launch=self.executions[-1]['command']['action_ref']
  model=FixedProgramModel(model_ref='conditional_geometric_port_transfer',nodes=nodes,ports=tuple(ports),word=tuple(layout['word']),placement_nodes=tuple(str(i) for i,a in domains),placement_hits=tuple(hits),target_nodes=(str(target),),arrival_updates_memory=True,cancelled_updates_memory=False,closure_after_cancelled=False,closure_after_self_loop=False,neighbor_updates_memory=False,launch_memory_law='clear_on_launch',placement_cost=1,launch_cost=1,launch_action_ref=launch)
  scope=DMechanicalScope(request_ref='current_origin_preimages',caller_ref='common_fixed_origin',parent_consumer_ref='SupportNavigation',parent_goal_ref='G_official_completion',parent_contribution_ref='conditional_fixed_origin',caller_next_item_ref='current_placement',epoch=obs['level_epoch'],evidence_revision_ref=obs['observation_ref'],model_revision_ref=evidence[-1],model_status_ref='observed_edges_fit_geometric_transfer_hypothesis',event_owner_ref='whole_program_control',input_domain_complete=True,assumption_refs=('complete_enumeration_of_conditional_model_not_complete_physical_knowledge','unobserved_ports_follow_current_relational_rule','distinct_node_is_terminal_hypothesis','no_unobserved_forced_effect'))
  models=tuple(model.model_copy(update={'model_ref':model.model_ref+':'+str(i),'ports':variant}) for i,variant in enumerate(port_variants))
  request=FixedProgramRequest(scope=scope,operation_ref='mechanics.fixed_program_origin.robust_origin_domain',mode_ref='DOMAIN',requested_result_type='DMechanicalResult',node_bound=100000,depth_bound=4096,domain_bound=4096,time_bound_ms=300000,models=models,observed_word=model.word)
  result=measure_fixed_program_origin(request)
  if result.status!='COMPLETE':return None
  safe=set(result.values['common_observable_hits']);effect_hypothesis=None
  # A public interrupted program supplies a local failed-contact class, not an oracle role.
  stopped_colors=set()
  for execution in self.executions:
   if execution['layout']['nodes']!=layout['nodes']:continue
   reached=[v for v in execution['trace'] if v['active'] is not None and v['node'] is not None]
   if reached and max(v['active'] for v in reached)<len(execution['layout']['word'])-1 and execution['trace'][-1]['node'] is None:
    terminal_node=reached[-1]['node'];color=execution.get('node_fills',[None]*len(fills))[terminal_node]
    if color not in (None,common,marker,fills[target]):stopped_colors.add(color)
  uncertain_colors=set(fills)-{None,common,marker,fills[target]}-stopped_colors
  if stopped_colors and len(uncertain_colors)==1:
   hazards=tuple(str(i) for i,v in enumerate(fills) if v in stopped_colors);repeat_color=next(iter(uncertain_colors));repeats=tuple(str(i) for i,v in enumerate(fills) if v==repeat_color)
   candidates=tuple(m.model_copy(update={'hazard_nodes':hazards,'repeat_nodes':repeats,'effect_priority':('repeat','neighbor')}) for m in models)
   alternative=measure_fixed_program_origin(request.model_copy(update={'models':candidates}))
   if alternative.status=='COMPLETE' and alternative.values['common_observable_hits']:
    safe=set(alternative.values['common_observable_hits']);models=candidates;effect_hypothesis={'status':'unverified_discriminating_composition','failed_contact_palette':sorted(stopped_colors),'repeat_palette_candidate':repeat_color,'alternatives':['no_effect','repeat_previous_direction'],'why':'A different observable class is on a complete target-reaching program only under an existing V5 repeat-effect model; execute to discriminate, not to assert the law.'}
  mappings=[{(start,label):end for start,label,end in variant} for variant in port_variants]
  offers=[]
  for origin,command in domains:
   if str(origin) not in safe:continue
   traces=[]
   for mapping in mappings:
    at=str(origin);trace=[]
    for label in model.word:
     at=mapping.get((at,label));trace.append(at)
     if at is None:break
    if at is None:break
    traces.append(trace)
   if len(traces)!=len(mappings):continue
   key=self.questions.question_key(obs['level_epoch'],'fixed_program_origin',{'word':layout['word'],'target':target,'origin':origin,'ports':ports,'effect_hypothesis':effect_hypothesis},launch)
   if key not in self.origin_attempts:offers.append((origin,command,key,traces))
  if not offers:return None
  origin,command,key,traces=min(offers,key=lambda v:v[0]);trace=traces[0];plan={'fixed_origin':True,'origin_access':True,'question_key':key,'layout':layout,'frame_hash':obs['frame_hash'],'origin':origin,'target':target,'target_color':fills[target],'marker_color_hypothesis':marker,'ports':ports,'expected_instruction_nodes':trace,'expected_instruction_node_alternatives':traces,'v5_status':result.status,'v5_cause':result.cause,'current_port_models':len(models),'port_rules':{label:list(next(iter(options))) for label,options in learned.items()},'compatible_alternatives':{label:[list(rule) for rule in sorted(options)] for label,options in alternatives.items()}}
  if effect_hypothesis:
   predicted=measure_fixed_program_origin(request.model_copy(update={'operation_ref':'mechanics.fixed_program_origin.program_image','mode_ref':'EVALUATE','models':models,'state':ProgramPose(node_ref=str(origin),memory_ref=None)}))
   if predicted.status!='COMPLETE':return None
   plan['effect_predictions']=plain(predicted.values);plan['nominal_instruction_nodes']=trace
   trace=[]
   for k in range(len(layout['word'])):
    transitions=[e for e in predicted.values['model_correlated_results'][0]['result']['trace'] if e.get('instruction_index')==k and 'after_node' in e]
    trace.append(transitions[-1]['after_node'] if transitions else None)
   plan['expected_instruction_nodes']=trace;plan['expected_instruction_node_alternatives']=[trace]
  why='Use the V5 relational origin preimage of the complete displayed word under port rules fitted to actual instruction responses. Placement revalidates the marker before execution; unknown transferred ports and terminal role remain falsifiable hypotheses.'
  plan['effect_hypothesis']=effect_hypothesis
  if effect_hypothesis:why+=' '+effect_hypothesis['why']
  actions=[command,{'action_ref':launch}];steps=[{'action':command,'expected_before':{'frame_hash':obs['frame_hash']},'expected_after':{'placed_node':origin},'locus_witness':ObservedInputDomain.make_locus_witness(obs,rows,(command['data']['x'],command['data']['y']),reason=why,evidence=evidence)}, {'action':actions[1],'expected_before':{'placed_node':origin,'word':layout['word']},'expected_after':{'instruction_nodes':trace,'target_hypothesis':target}}]
  ref='C_origin_access_'+key[:16];facts={'actual_program_response_observed':True,'current_display_word_bound':True,'relational_port_model_matches_samples':True,'origin_preimage_returned_by_v5':True,'unseen_ports_are_conditional':True};proof=[obs['observation_ref']]+evidence
  return {'status':'proposed','kind':'fixed_program_origin_access','support_plan':plain(plan),'steps':steps,'actions':actions,'facts':facts,'compositions':[{'id':ref,'role':'information_question','observed':False,'open_question':why,'properties':{'target_status':'morphological hypothesis'},'relations':['contributes_to:G_official_completion']}],'question':{'reason':why,'hypothesis_refs':proof},'route_refs':proof,'binding':{'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'levels_completed':obs['levels_completed']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'purpose':why,'preconditions':facts,'evidence':proof,'actions':actions,'frozen_support_plan':plain(plan),'outcome_guard':{'path':['value'],'contains':ref}}}

def bands(nodes):
 groups=[]
 for i,b in sorted(enumerate(nodes),key=lambda v:v[1][1]):
  if groups and b[1]<=max(nodes[j][3] for j in groups[-1])+1:groups[-1].append(i)
  else:groups.append([i])
 return [sorted(g,key=lambda i:nodes[i][0]) for g in groups]
def port_rule(nodes,rule,link_ports=None,stroke_tables=None):
 kind,direction,tie=rule;groups=bands(nodes);where={i:(g,k) for g,ids in enumerate(groups) for k,i in enumerate(ids)};out=[]
 if kind=='connected_neighboring_band':return (link_ports or {}).get(str(direction),[None]*len(nodes))
 if kind=='stroke_priority':
  styles=(stroke_tables or {}).get(str(direction),{});out=[]
  for i in range(len(nodes)):
   primary=styles.get(str(tie),[None]*len(nodes))[i];other={ports[i] for color,ports in styles.items() if ports[i] is not None}
   out.append(primary if primary is not None else next(iter(other)) if len(other)==1 else None)
  return out
 for i,b in enumerate(nodes):
  g,k=where[i]
  if kind=='cyclic_order':out.append(groups[g][(k+direction)%len(groups[g])]);continue
  destination=g+direction
  if not 0<=destination<len(groups):out.append(None);continue
  choices=groups[destination];distance=min(abs(nodes[j][0]-b[0]) for j in choices);nearest=[j for j in choices if abs(nodes[j][0]-b[0])==distance]
  out.append(min(nearest,key=lambda j:tie*nodes[j][0]))
 return out
def fit_port_rules(nodes,samples,hypotheses,link_ports=None,stroke_tables=None):
 domain=[tuple(x) for x in hypotheses]
 return [rule for rule in domain if all(port_rule(nodes,rule,link_ports,stroke_tables)[a]==b for a,b in samples)]
def program_samples(execution):
 word=execution['layout']['word'];trace=execution['trace'];start=next((x['node'] for x in trace if x['node'] is not None),None);samples=defaultdict(list)
 for i,label in enumerate(word):
  values=[x['node'] for x in trace if x['active']==i and x['node'] is not None]
  if not values or start is None:break
  end=values[-1];samples[label].append((start,end));start=end
 return dict(samples)

def stroke_ports(rows,nodes,direction):
 groups=bands(nodes);where={i:g for g,ids in enumerate(groups) for i in ids};background=Counter(v for row in rows for v in row).most_common(1)[0][0];found=defaultdict(lambda:defaultdict(set));height,width=len(rows),len(rows[0])
 for src,a in enumerate(nodes):
  g=where[src]+direction
  if not 0<=g<len(groups):continue
  for dst in groups[g]:
   b=nodes[dst];anchors=[{(y,x) for y in range(v[1],v[3]+1) for x in range(v[0],v[2]+1)} for v in (a,b)];shells=[{(y,x) for y in range(max(0,v[1]-1),min(height,v[3]+2)) for x in range(max(0,v[0]-1),min(width,v[2]+2))} for v in (a,b)];counts=Counter(rows[y][x] for sh,anc in zip(shells,anchors) for y,x in sh-anc if rows[y][x]!=background)
   if not counts:continue
   outline=counts.most_common(1)[0][0];by_color=defaultdict(set)
   for y in range(max(0,min(a[1],b[1])-1),min(height,max(a[3],b[3])+2)):
    for x in range(max(0,min(a[0],b[0])-1),min(width,max(a[2],b[2])+2)):
     if rows[y][x]!=background:by_color[rows[y][x]].add((y,x))
   ends=(shells[0]|shells[1])&by_color.get(outline,set())
   for color,pixels in by_color.items():
    if color==outline:continue
    if any(c&anchors[0] and c&anchors[1] for c in connected_components(pixels|ends|anchors[0]|anchors[1],8)):found[str(color)][src].add(dst)
 return {color:[next(iter(edges[i])) if len(edges[i])==1 else None for i in range(len(nodes))] for color,edges in found.items()}

def connected_ports(rows,nodes,direction,alternatives=False):
 groups=bands(nodes);where={i:g for g,ids in enumerate(groups) for i in ids};background=Counter(v for row in rows for v in row).most_common(1)[0][0];ports=[];shell=Counter()
 height,width=len(rows),len(rows[0])
 for l,t,r,b in nodes:
  for y in range(max(0,t-1),min(height,b+2)):
   for x in range(max(0,l-1),min(width,r+2)):
    if not(l<=x<=r and t<=y<=b) and rows[y][x]!=background:shell[rows[y][x]]+=1
 if not shell:return [(None,)]*len(nodes) if alternatives else [None]*len(nodes)
 outline=shell.most_common(1)[0][0]
 for i,a in enumerate(nodes):
  g=where[i]+direction
  if not 0<=g<len(groups):ports.append((None,) if alternatives else None);continue
  distance=min(abs(nodes[j][0]-a[0]) for j in groups[g]);nearest=[j for j in groups[g] if abs(nodes[j][0]-a[0])==distance];connected=[]
  for j in nearest:
   b=nodes[j];top,bottom=max(0,min(a[1],b[1])-1),min(height-1,max(a[3],b[3])+1);left,right=max(0,min(a[0],b[0])-1),min(width-1,max(a[2],b[2])+1)
   anchors=[{(y,x) for y in range(v[1],v[3]+1) for x in range(v[0],v[2]+1)} for v in (a,b)];by_color=defaultdict(set)
   for y in range(top,bottom+1):
    for x in range(left,right+1):
     if rows[y][x]!=background:by_color[rows[y][x]].add((y,x))
   spans=[]
   for color,pixels in by_color.items():
    if color==outline:continue
    supported=set(pixels)|by_color.get(outline,set())|anchors[0]|anchors[1]
    spans.extend(c for c in connected_components(supported,8) if c&anchors[0] and c&anchors[1])
   if spans:connected.append(j)
  ports.append(tuple(connected) if connected else (None,)) if alternatives else ports.append(connected[0] if len(connected)==1 else None)
 return ports
