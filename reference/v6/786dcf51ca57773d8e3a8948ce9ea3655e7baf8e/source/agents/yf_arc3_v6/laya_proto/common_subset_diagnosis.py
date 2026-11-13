"""Bind repeated public occurrences, transient scope tests and V5 subset beliefs."""
import json
from pathlib import Path
from collections import defaultdict,Counter
from agents.yf_arc3_v5.capabilities import ComponentExtractionInput,FrameGrid,detect_components
from agents.yf_arc3_v5.capabilities.subset_observation_d import FaultAssignmentD,SubsetLawD,SubsetReceiptD,SubsetObservationRequestD,measure_subset_observation_d
from agents.yf_arc3_v5.capabilities.hierarchical_probe_d import HierarchyNodeD,HierarchyNavigationD,HierarchicalProbeRequestD,measure_hierarchical_probe_d
from agents.yf_arc3_v5.capabilities.mechanical_family_contracts_d import DMechanicalScope
from common_control_dependencies import ControlDependencies
from common_multiscale_constraints import digest
from observed_input_domain import ObservedInputDomain
from src_bridge import plain

def components(rows):return detect_components(ComponentExtractionInput(frame=FrameGrid(rows=tuple(map(tuple,rows))),connectivity=4)).components
def shape(c):return [c.bbox.width,c.bbox.height,sorted([y-c.bbox.top,x-c.bbox.left] for y,x in c.pixels)]
def bounds(c):return [c.bbox.left,c.bbox.top,c.bbox.right,c.bbox.bottom]

def measured_scene(rows):
 parts=components(rows);groups=defaultdict(list);candidates=[]
 for c in parts:
  if c.bbox.width==c.bbox.height and c.area==c.bbox.width*c.bbox.height:groups[c.value,c.bbox.width].append(c)
 for (color,size),group in groups.items():
  if len(group)<4:continue
  xs=sorted({c.bbox.left for c in group});ys=sorted({c.bbox.top for c in group})
  if len(xs)*len(ys)!=len(group):continue
  if len(xs)>2 and len({b-a for a,b in zip(xs,xs[1:])})!=1:continue
  if len(ys)>2 and len({b-a for a,b in zip(ys,ys[1:])})!=1:continue
  if len(xs)==1 or len(ys)==1:continue
  extent=(xs[-1]-xs[0]+size)*(ys[-1]-ys[0]+size);candidates.append((extent,color,size,group,xs,ys))
 if not candidates:return None
 extent,color,size,group,xs,ys=max(candidates,key=lambda v:v[0])
 if sum(c[0]==extent for c in candidates)>1:return None
 group=sorted(group,key=lambda c:(c.bbox.top,c.bbox.left));boxes=[bounds(c) for c in group];pitchx=min(b-a for a,b in zip(xs,xs[1:]));pitchy=min(b-a for a,b in zip(ys,ys[1:]));left=max(0,xs[0]-pitchx//2);right=min(len(rows[0])-1,xs[-1]+size+pitchx//2);top=max(0,ys[0]-pitchy//2);bottom=min(len(rows)-1,ys[-1]+size+pitchy//2)
 palettes=defaultdict(list)
 for y in range(top,bottom+1):
  for x in range(left,right+1):palettes[rows[y][x]].append((x,y))
 scopes={}
 for value,pixels in palettes.items():
  if value==color:continue
  l=min(x for x,y in pixels);r=max(x for x,y in pixels);t=min(y for x,y in pixels);b=max(y for x,y in pixels)
  members=[i for i,bb in enumerate(boxes) if l<=(bb[0]+bb[2])/2<=r and t<=(bb[1]+bb[3])/2<=b]
  if 0<len(members)<len(boxes):scopes[str(value)]=members
 controls=[]
 for c in parts:
  if str(c.value) not in scopes or c.bbox.bottom>=top or c.area<min(size*size,4):continue
  controls.append({'color':str(c.value),'bbox':bounds(c),'shape':shape(c),'area':c.area})
 if not controls or len(scopes)<2:return None
 return {'boxes':boxes,'palette':color,'scope_members':scopes,'controls':controls,'universe_ref':digest(boxes),'focus':sorted(set(i for ids in scopes.values() for i in ids)),'body_size':size}

def feedback(rows,frames,scene):
 boxes=scene['boxes'];universe=set(range(len(boxes)));background=Counter(v for row in rows for v in row).most_common(1)[0][0];trajectory=[]
 for f in frames:
  if Counter(v for row in f for v in row).most_common(1)[0][0]!=background:continue
  changed=[];valid=True
  for i,(l,t,r,b) in enumerate(boxes):
   values={f[y][x] for y in range(t,b+1) for x in range(l,r+1)}
   if len(values)!=1:valid=False;break
   if next(iter(values))!=scene['palette']:changed.append(i)
  if valid and changed:trajectory.append(set(changed))
 if not trajectory:return None
 tested=trajectory[0]
 if any(v==universe for v in trajectory):label='GLOBAL'
 elif all(v<=tested for v in trajectory):label='LOCAL'
 else:return {'status':'partial_propagation_unknown','tested':sorted(tested)}
 return {'status':'sealed_scope_feedback','tested':sorted(tested),'label':label,'peak_changed':max(map(len,trajectory)),'transient_first_subset_bound':True}

def scope(obs,evidence):return DMechanicalScope(request_ref='subset:'+obs['observation_ref'],caller_ref='common_subset_diagnosis',parent_consumer_ref='SupportNavigation',parent_goal_ref='G_official_completion',parent_contribution_ref='conditional_repeated_scope_identification',caller_next_item_ref='next_scope_question',epoch=obs['level_epoch'],evidence_revision_ref=obs['observation_ref'],model_revision_ref=evidence,event_owner_ref='public_input_packet',model_status_ref='unique_fixed_member_is_explicit_conditional_hypothesis',input_domain_complete=True,assumption_refs=('finite_candidates_under_one_fixed_member_hypothesis','transient_local_global_interpretation_revisable','multiple_defects_and_noise_not_excluded_universally'))

class _HistoricalSubsetDiagnosis:
 def __init__(self):
  self.policy=json.loads(Path(__file__).with_name('common_frontier_policy.drm.json').read_text())['subset_diagnosis'];self.epoch=None;self.universe=None;self.candidates=None;self.press_shapes=[];self.nav_shapes=[];self.receipts=[];self.events=[];self.questions=ControlDependencies();self.tested=set();self.confirmed_epochs=[];self.method_refs=[]
 def reset_domain(self,obs,scene):
  if self.epoch!=obs['level_epoch'] or self.universe!=scene['universe_ref']:
   self.epoch=obs['level_epoch'];self.universe=scene['universe_ref'];self.candidates=set(range(len(scene['boxes'])));self.receipts=[];self.tested=set()
 def law(self,ref):return SubsetLawD(law_ref='conditional_unique_member',predicate='ANY',feedback_by_value=((0,('LOCAL',)),(1,('GLOBAL',))),law_evidence_ref=ref)
 def assignments(self):return tuple(FaultAssignmentD(assignment_ref='candidate:'+str(i),law_ref='conditional_unique_member',fault_member_refs=(str(i),)) for i in sorted(self.candidates))
 def request(self,obs,scene,mode,tested,receipt=None):
  return SubsetObservationRequestD(scope=scope(obs,self.method_refs[-1] if self.method_refs else obs['observation_ref']),operation_ref='mechanics.feedback_code_identification.subset_observation',mode_ref=mode,requested_result_type='DMechanicalResult',node_bound=100000,depth_bound=4096,domain_bound=4096,time_bound_ms=60000,phase_ref='SEALED_FEEDBACK' if receipt else 'READ_ONLY_PREDICTION',member_refs=tuple(map(str,range(len(scene['boxes'])))),assignments=self.assignments(),laws=(self.law(obs['observation_ref']),),tested_member_refs=tuple(map(str,tested)),query_currently_realizable=True,receipts=(receipt,) if receipt else (),filter_receipt_ref=receipt.receipt_ref if receipt else None,positive_singleton_confirmation_required=True)
 def record(self,before,after,command,first,second,proposal=None,index=None,frames=None):
  self.events=[]
  if command['action_ref']!='ACTION6':return {'status':'subset_not_applicable','events':[]}
  a=measured_scene(first)
  if not a:return {'status':'subset_scene_unknown','events':[]}
  self.reset_domain(before,a);result=feedback(first,frames or [second],a)
  if result and result['status']=='sealed_scope_feedback':
   tested=result['tested'];label=result['label'];point=command.get('data',{});colors=[c for c,members in a['scope_members'].items() if members==tested]
   for color in colors:
    controls=[c for c in a['controls'] if c['color']==color]
    if controls and 'x' in point:
     nearest=min(controls,key=lambda c:max(c['bbox'][0]-point['x'],point['x']-c['bbox'][2],0)+max(c['bbox'][1]-point['y'],point['y']-c['bbox'][3],0))
     if nearest['shape'] not in self.press_shapes:self.press_shapes.append(nearest['shape'])
   old=sorted(self.candidates);receipt=SubsetReceiptD(receipt_ref=after['observation_ref']+':scope',epoch=before['level_epoch'],evidence_revision_ref=after['observation_ref'],tested_member_refs=tuple(map(str,tested)),ordered_feedback=(label,),sealed=True,positive_singleton_confirmation=len(tested)==1 and after['levels_completed']>before['levels_completed'])
   # A boundary is official evidence but the old-epoch filter remains separate.
   scoped=dict(after);scoped['level_epoch']=before['level_epoch'];calculation=measure_subset_observation_d(self.request(scoped,a,'FILTER',tested,receipt))
   if calculation.status!='COMPLETE':raise RuntimeError('Subset receipt calculation unresolved: '+calculation.cause)
   surviving={int(v.split(':')[-1]) for v in calculation.values['retained_assignment_refs']}
   if not surviving:raise RuntimeError('Contradiction under conditional unique-member hypothesis; preserve receipt')
   self.candidates=surviving;self.receipts.append(receipt.model_dump(mode='json'));self.method_refs.append(after['observation_ref']);self.tested.add((tuple(sorted(old)),tuple(tested)))
   self.events=[{'kind':'public_subset_feedback','before':before['observation_ref'],'after':after['observation_ref'],'tested':tested,'feedback':label,'candidates_before':old,'candidates_after':sorted(surviving),'calculation':plain(calculation.values),'press_shapes':self.press_shapes,'hypothesis_scope':'conditional unique fixed member, not universal fault law'}]
   if after['levels_completed']>before['levels_completed']:self.confirmed_epochs.append(before['level_epoch']);self.epoch=None;self.candidates=None
   return {'status':'subset_feedback_observed','events':self.events}
  if proposal and proposal.get('support_plan',{}).get('subset_diagnosis'):
   p=proposal['support_plan'];b=measured_scene(second)
   if p['mode']=='navigation' and b and b['universe_ref']==a['universe_ref']:
    matched=set(b['focus'])==set(p['tested']);self.questions.record_attempt(p['question_key'])
    if matched and p['control_shape'] not in self.nav_shapes:self.nav_shapes.append(p['control_shape'])
    self.events=[{'kind':'scope_navigation_response','before':before['observation_ref'],'after':after['observation_ref'],'expected_focus':p['tested'],'observed_focus':b['focus'],'matched':matched,'nav_shapes':self.nav_shapes,'candidates_unchanged':sorted(self.candidates)}]
  return {'status':'subset_navigation_or_unknown','events':self.events}
 def propose(self,obs,rows,inputs,remaining):
  if not self.policy['enabled'] or 'ACTION6' not in obs['available_action_refs'] or not self.press_shapes or remaining<1:return None
  scene=measured_scene(rows)
  if not scene:return None
  self.reset_domain(obs,scene);candidates=set(self.candidates);offers=[];controls=[]
  for c in scene['controls']:
   if c['shape'] in self.press_shapes:controls.append(c)
  for c in controls:
   tested=scene['scope_members'][c['color']];inside=candidates&set(tested)
   if not inside or (inside==candidates and len(tested)>1):continue
   if (tuple(sorted(candidates)),tuple(tested)) in self.tested:continue
   b=c['bbox'];command={'action_ref':'ACTION6','data':{'x':(b[0]+b[2])//2,'y':(b[1]+b[3])//2}};offers.append((max(len(inside),len(candidates-inside)),0,tested,command,c['shape']))
  # If the current partition cannot discriminate a larger candidate subset,
  # acquire/recall its access before spending singleton tests independently.
  nav=[]
  if not offers and len(candidates)>2:
   for color,tested in scene['scope_members'].items():
    if not candidates<=set(tested) or not set(tested)<set(scene['focus']):continue
    for c in scene['controls']:
     if c['color']!=color or c['shape'] in self.press_shapes:continue
     b=c['bbox'];command={'action_ref':'ACTION6','data':{'x':(b[0]+b[2])//2,'y':(b[1]+b[3])//2}};key=self.questions.question_key(obs['level_epoch'],'scope_navigation',{'universe':scene['universe_ref'],'focus':scene['focus'],'desired':tested},command)
     if key not in self.questions.attempted:nav.append((len(tested),tested,command,c['shape'],key))
  mode='query';navigation_proof=None
  if nav:
   unused,tested,command,control_shape,key=min(nav,key=lambda v:(v[0],v[2]['data']['x'],v[2]['data']['y']));mode='navigation'
   if control_shape in self.nav_shapes:
    universe=tuple(map(str,range(len(scene['boxes']))));focus=tuple(map(str,scene['focus']));target=tuple(map(str,tested));nodes=[HierarchyNodeD(node_ref='U',parent_ref=None,member_refs=universe,native_query_input_ref=None)];current='U'
    if focus!=universe:nodes.append(HierarchyNodeD(node_ref='F',parent_ref='U',member_refs=focus,native_query_input_ref=None));current='F'
    nodes.append(HierarchyNodeD(node_ref='Q',parent_ref=current,member_refs=target,native_query_input_ref=None));navrequest=HierarchicalProbeRequestD(scope=scope(obs,self.method_refs[-1]),operation_ref='mechanics.feedback_code_identification.hierarchical_probe',mode_ref='STEP',requested_result_type='DMechanicalResult',node_bound=100000,depth_bound=4096,domain_bound=4096,time_bound_ms=60000,phase_ref='EXTERNAL_INPUT_PREDICTION',nodes=tuple(nodes),navigation=(HierarchyNavigationD(source_ref=current,destination_ref='Q',native_input_ref='bound_navigation',debit=1),),root_ref='U',native_focus_ref=current,assignments=self.assignments(),laws=(self.law(obs['observation_ref']),),bound_native_input_ref='bound_navigation',remaining_resource=remaining,query_debit=1,submitted_debit=0,refusal_debit=0,positive_singleton_confirmation_required=True,transient_display_rule='RELEASE_AT_RESPONSE')
    calculated=measure_hierarchical_probe_d(navrequest)
    if calculated.status!='COMPLETE':return None
    navigation_proof=plain(calculated.values)
  else:
   for i in sorted(candidates):
    b=scene['boxes'][i];command={'action_ref':'ACTION6','data':{'x':(b[0]+b[2])//2,'y':(b[1]+b[3])//2}};offers.append((max(1,len(candidates)-1),1,[i],command,None))
   if not offers:return None
   unused,kind,tested,command,control_shape=min(offers,key=lambda v:(v[0],v[1],v[2]));key=self.questions.question_key(obs['level_epoch'],'subset_information',{'universe':scene['universe_ref'],'candidates':sorted(candidates),'tested':tested},command)
  prediction=measure_subset_observation_d(self.request(obs,scene,'PARTITION',tested))
  if prediction.status!='COMPLETE':return None
  why=('Preserve the conditional candidate set while accessing a smaller current geometric scope; this control shares the observed scope binding but its navigation effect must be checked.' if mode=='navigation' else 'Test the bound subset that separates the current conditional candidates. Preserve the complete transient response; a local result excludes this subset, a global result includes it under the explicit fixed-member hypothesis. A deduced singleton still requires a physical terminal test.')
  ref='C_subset_'+key[:16];evidence=[obs['observation_ref']]+self.method_refs[-8:];plan={'subset_diagnosis':True,'mode':mode,'frame_hash':obs['frame_hash'],'universe_ref':scene['universe_ref'],'focus':scene['focus'],'tested':tested,'candidates':sorted(candidates),'question_key':key,'control_shape':control_shape,'partitions':plain(prediction.values),'navigation_prediction':navigation_proof,'conditional_model':'one fixed influential member; multiple/noisy/changing causes remain outside this hypothesis','terminal_evidence_epochs':self.confirmed_epochs}
  facts={'current_occurrences_measured':True,'actual_transient_feedback_retained':True,'current_query_or_navigation_address_bound':True,'fixed_member_model_is_conditional':True};step={'action':command,'expected_before':{'frame_hash':obs['frame_hash']},'expected_after':{'status':'unknown_feedback_or_partition'},'locus_witness':ObservedInputDomain.make_locus_witness(obs,rows,(command['data']['x'],command['data']['y']),reason=why,evidence=evidence)}
  return {'status':'proposed','kind':'subset_scope_'+mode,'support_plan':plan,'actions':[command],'steps':[step],'facts':facts,'compositions':[{'id':ref,'role':'information_question','observed':False,'open_question':why,'properties':{'candidate_count':len(candidates),'tested_count':len(tested)},'relations':['contributes_to:G_official_completion']}],'question':{'reason':why,'hypothesis_refs':evidence},'route_refs':evidence,'binding':{'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'levels_completed':obs['levels_completed']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'purpose':why,'preconditions':facts,'evidence':evidence,'actions':[command],'frozen_support_plan':plain(plan),'outcome_guard':{'path':['value'],'contains':ref}}}
 def before(self,p,i,public,o):
  plan=p['support_plan'];s=measured_scene(public.frame_rows);ok=public.level==p['binding']['level_epoch'] and public.levels_completed==p['binding']['levels_completed'] and public.frame_hash==plan['frame_hash'] and s is not None and s['universe_ref']==plan['universe_ref'] and s['focus']==plan['focus']
  return {'admitted':ok,'reason':'current_subset_and_control_scope' if ok else 'subset_scope_changed'}
 def after(self,p,i,before,after,first,second):return {'matched':None,'seal_prefix':True,'reason':'complete_transient_feedback_or_new_partition_required'}


class SubsetDiagnosis(_HistoricalSubsetDiagnosis):
 """Preserve the measured procedure through JSON; rebind every released point."""
 def state(self):
  return json.loads(json.dumps({k:getattr(self,k) for k in ('epoch','universe','press_shapes','nav_shapes','receipts','events','confirmed_epochs','method_refs')} | {'candidates':None if self.candidates is None else sorted(self.candidates),'tested':sorted(self.tested),'questions':{'pending':self.questions.pending,'attempted':sorted(self.questions.attempted)}}))
 def restore(self,state):
  state=json.loads(json.dumps(state))
  for k in ('epoch','universe','press_shapes','nav_shapes','receipts','events','confirmed_epochs','method_refs'):setattr(self,k,state[k])
  self.candidates=None if state['candidates'] is None else set(state['candidates'])
  self.tested={(tuple(a),tuple(b)) for a,b in state['tested']}
  self.questions.pending=state['questions']['pending'];self.questions.attempted=set(state['questions']['attempted'])
 def before(self,p,i,public,o):
  original=super().before(p,i,public,o)
  if not original['admitted']:return original
  plan=p['support_plan'];s=measured_scene(public.frame_rows);actions=p.get('actions',[]);steps=p.get('steps',[])
  ok=i==0 and len(actions)==len(steps)==1 and actions[0]==steps[0].get('action') and actions==p['bundle_template']['actions'] and actions[0].get('action_ref') in public.available_action_refs and actions[0].get('action_ref')=='ACTION6' and plan['candidates']==sorted(self.candidates or ()) and o['level_epoch']==p['binding']['level_epoch']
  if ok:
   mode=plan['mode'];features={'universe':s['universe_ref'],'focus':s['focus'],'desired':plan['tested']} if mode=='navigation' else {'universe':s['universe_ref'],'candidates':sorted(self.candidates),'tested':plan['tested']}
   relation='scope_navigation' if mode=='navigation' else 'subset_information'
   ok=self.questions.question_key(o['level_epoch'],relation,features,actions[0])==plan['question_key']
  return {'admitted':bool(ok),'reason':'current_subset_control_and_exact_declared_question' if ok else 'subset_question_binding_changed'}
