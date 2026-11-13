"""Bounded ordered-member transactions under explicit caller-owned laws.

The logical held member is absent from stacks even if it remains drawn on its
source. External clicks, counted transfers and budget charges are independent.
"""
from collections import deque
from typing import Literal
from pydantic import Field,model_validator
from .ordered_continuation_contracts_d import OrderedBudgetContinuationD
from .ordered_continuation_d import measure_ordered_budget_continuation_d
from agents.yf_arc3_v5.logos.types import FrozenMap,FrozenModel,Ref,immutable_json_data
from .mechanical_family_contracts_a import MechanicalFamilyScope,MechanicalFamilyResult,family_result,missing_supplied_fields
from .identity_contact_authentication import ContactPixel,ContactLayerTemplate,ContactLayerSample,_candidate_layers as measure_translated_layers
from .contracts import FrameGrid,ComponentExtractionResult
from .ordered_supports import measure_ordered_support_geometry


class OrderedMember(FrozenModel):
    member_ref: Ref
    size: int = Field(ge=1,le=65536)


class OrderedStack(FrozenModel):
    support_ref: Ref
    available: bool
    members: tuple[Ref,...] = Field(max_length=16)


class OrderedState(FrozenModel):
    stacks: tuple[OrderedStack,...] = Field(min_length=1,max_length=8)
    held_member_ref: Ref | None
    held_source_ref: Ref | None
    transfer_count: int = Field(ge=0)
    click_count: int = Field(ge=0)
    remaining_budget: int = Field(ge=0,le=65536)
    level_scope_ref: Ref
    restore_epoch: int = Field(ge=0)
    status: Literal['ACTIVE','WIN','LOCAL_STOP','GAME_OVER']
    @model_validator(mode='after')
    def occurrences(self):
        if len({s.support_ref for s in self.stacks})!=len(self.stacks):raise ValueError('persistent supports have distinct identities')
        occurrences=tuple(ref for stack in self.stacks for ref in stack.members)
        if len(occurrences)>16 or len(set(occurrences))!=len(occurrences):raise ValueError('member occurrences are unique and bounded')
        if (self.held_member_ref is None)!=(self.held_source_ref is None):raise ValueError('held identity retains its source')
        if self.held_member_ref is not None and (self.held_member_ref in occurrences or self.held_source_ref not in {s.support_ref for s in self.stacks}):raise ValueError('a drawn held ghost is not a second member')
        return self


class OrderedGoal(FrozenModel):
    target_support_ref: Ref
    required_bottom_to_top: tuple[Ref,...] = Field(min_length=1,max_length=16)
    other_supports_empty: bool


class OrderedClick(FrozenModel):
    input_ref: Ref
    support_ref: Ref
    action_ref: Ref
    payload: FrozenMap


class OrderedLaw(FrozenModel):
    law_ref: Ref
    counter_independent: Literal[True]
    strict_order: bool
    same_source_click: Literal['CANCEL','REJECT']
    rejection: Literal['RETAIN_HELD','RETURN_TO_SOURCE']
    counted_events: tuple[Literal['SELECT','CANCEL','TRANSFER','REJECT','EMPTY','UNAVAILABLE'],...] = Field(max_length=6)
    select_cost: int = Field(ge=0,le=65536)
    cancel_cost: int = Field(ge=0,le=65536)
    transfer_cost: int = Field(ge=0,le=65536)
    reject_cost: int = Field(ge=0,le=65536)
    empty_cost: int = Field(ge=0,le=65536)
    unavailable_cost: int = Field(ge=0,le=65536)
    budget_charge: Literal['COMMAND_COST','COUNTED_TRANSFER']
    budget_admission: Literal['REFUSE_BEFORE_INPUT','ALLOW_EXHAUSTING_INPUT']
    completion_resource_priority: Literal['COMPLETION_FIRST','EXHAUSTION_FIRST']
    exhaustion_outcome: Literal['LOCAL_STOP','GAME_OVER','RESTORE']
    completion_check_events: tuple[Literal['SELECT','CANCEL','TRANSFER','REJECT','EMPTY','UNAVAILABLE'],...] = Field(max_length=6)
    exhaustion_check_events: tuple[Literal['SELECT','CANCEL','TRANSFER','REJECT','EMPTY','UNAVAILABLE'],...] = Field(max_length=6)
    @model_validator(mode='after')
    def counts(self):
        if len(set(self.counted_events))!=len(self.counted_events):raise ValueError('count each supplied transaction event at most once')
        return self


class OrderedModel(FrozenModel):
    model_ref: Ref
    law: OrderedLaw
    goal: OrderedGoal
    clicks: tuple[OrderedClick,...] = Field(min_length=1,max_length=64)
    restored_state: OrderedState | None = None
    @model_validator(mode='after')
    def hit_map(self):
        if len({c.input_ref for c in self.clicks})!=len(self.clicks) or len({(c.action_ref,c.payload) for c in self.clicks})!=len(self.clicks):raise ValueError('one exact support owner per actual click payload')
        if len(set(self.goal.required_bottom_to_top))!=len(self.goal.required_bottom_to_top):raise ValueError('goal preserves member occurrence order')
        return self


class OrderedObservation(FrozenModel):
    observation_ref: Ref
    event_owner_ref: Ref
    epoch: int = Field(ge=0)
    sealed: bool
    before: OrderedState
    after: OrderedState
    action_ref: Ref
    payload: FrozenMap
    observed_support_refs: tuple[Ref,...] = Field(max_length=8)
    held_observed: bool
    counters_observed: bool


class OrderedLayerTemplate(ContactLayerTemplate):
    component: Literal['SHAFT','BASE','MEMBER_WING','MEMBER_FULL','HELD_GHOST','TARGET_GHOST']
    ensemble_ref: Ref
    geometry_model_ref: Ref
    member_ref: Ref | None = None
    extent_left: int | None = None
    extent_right: int | None = None
    @model_validator(mode='after')
    def measured_extent(self):
        if self.component in ('MEMBER_WING','MEMBER_FULL','HELD_GHOST') and self.member_ref is None:raise ValueError('member fragments require an explicit occurrence hypothesis')
        if (self.extent_left is None)!=(self.extent_right is None):raise ValueError('paired member extent endpoints')
        if self.extent_left is not None and self.extent_left>self.extent_right:raise ValueError('ordered member endpoints')
        return self


class OrderedMacro(FrozenModel):
    member_ref: Ref
    source_ref: Ref
    receiver_ref: Ref


class OrderedRequest(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.ordered_request.v1'
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None = None
    maximum_states: int = Field(ge=1,le=4096)
    maximum_depth: int = Field(ge=0,le=256)
    maximum_evaluations: int = Field(ge=1,le=65536)
    maximum_transfers: int = Field(ge=1,le=256)
    state: OrderedState | None = None
    members: tuple[OrderedMember,...] = Field(default=(),max_length=16)
    models: tuple[OrderedModel,...] = Field(default=(),max_length=128)
    bound_model_ref: Ref | None = None
    input_ref: Ref | None = None
    requested_member_ref: Ref | None = None
    source_ref: Ref | None = None
    receiver_ref: Ref | None = None
    strict_order: bool | None = None
    subtower_bottom_to_top: tuple[Ref,...] | None = Field(default=None,max_length=16)
    macros: tuple[OrderedMacro,...] | None = Field(default=None,max_length=256)
    observations: tuple[OrderedObservation,...] = Field(default=(),max_length=256)
    expected_state: OrderedState | None = None
    actual_state: OrderedState | None = None
    budget_continuation: OrderedBudgetContinuationD | None = None
    raw_layer_pixels: tuple[ContactPixel,...] = Field(default=(),max_length=65536)
    layer_templates: tuple[OrderedLayerTemplate,...] = Field(default=(),max_length=4096)
    layer_samples: tuple[ContactLayerSample,...] = Field(default=(),max_length=4096)
    frame: FrameGrid | None = None
    components: ComponentExtractionResult | None = None
    @model_validator(mode='after')
    def identities(self):
        for rows,name in ((self.members,'member_ref'),(self.models,'model_ref'),(self.observations,'observation_ref'),(self.layer_templates,'template_ref')):
            if len({getattr(r,name) for r in rows})!=len(rows):raise ValueError('each supplied occurrence/model/evidence keeps unique identity')
        if len({r.point for r in self.raw_layer_pixels})!=len(self.raw_layer_pixels):raise ValueError('one current token per raw pixel')
        return self


OPERATION_MODES={'support_member_measurement':'MEASURE','selection_deposit_fit':'FIT','accessible_frontier':'PRECONDITION',
    'ordered_deposit':'PRECONDITION','click_successor':'STEP','transfer_graph':'DOMAIN','clearance_dependencies':'INVERSE_DOMAIN',
    'subtower_decomposition':'DOMAIN','compile_transfer_cost':'COMPILE','stack_compare':'COMPARE'}


def _model(request):return next((m for m in request.models if m.model_ref==request.bound_model_ref),None)
def _sizes(request):return {m.member_ref:m.size for m in request.members}
def _positions(state):return {s.support_ref:s for s in state.stacks}
def _well_bound(request,state,model):
    sizes=_sizes(request);supports=_positions(state);refs=tuple(ref for s in state.stacks for ref in s.members)+((state.held_member_ref,) if state.held_member_ref is not None else ())
    return set(refs)==set(sizes) and model.goal.target_support_ref in supports and set(model.goal.required_bottom_to_top)<=set(sizes) and all(c.support_ref in supports for c in model.clicks)


def _admissible(sizes,strict_order,member,stack):
    return stack.available and (not stack.members or (sizes[member]<sizes[stack.members[-1]] if strict_order else sizes[member]<=sizes[stack.members[-1]]))


def _goal(state,goal):
    return state.held_member_ref is None and any(s.support_ref==goal.target_support_ref and s.members==goal.required_bottom_to_top for s in state.stacks) and (not goal.other_supports_empty or all(not s.members for s in state.stacks if s.support_ref!=goal.target_support_ref))


def _step(request,state,model,click):
    """One actual click; no graph search or hidden additional external command."""
    if state.status!='ACTIVE':return state,False,'TERMINAL',0,0,('authoritative_transaction_terminal',)
    supports=_positions(state);stack=supports[click.support_ref];held=state.held_member_ref;source=state.held_source_ref;changed=dict(supports);law=model.law
    if not stack.available:event='UNAVAILABLE'
    elif held is None:
        if not stack.members:event='EMPTY'
        else:event='SELECT';held=stack.members[-1];source=stack.support_ref;changed[source]=stack.model_copy(update={'members':stack.members[:-1]})
    elif click.support_ref==source:
        event='CANCEL' if law.same_source_click=='CANCEL' else 'REJECT'
        if event=='CANCEL':changed[source]=stack.model_copy(update={'members':stack.members+(held,)});held=None;source=None
    elif _admissible(_sizes(request),law.strict_order,held,stack):
        event='TRANSFER';changed[stack.support_ref]=stack.model_copy(update={'members':stack.members+(held,)});held=None;source=None
    else:event='REJECT'
    if event=='REJECT' and held is not None and law.rejection=='RETURN_TO_SOURCE':
        old=changed[source];changed[source]=old.model_copy(update={'members':old.members+(held,)});held=None;source=None
    cost=getattr(law,event.lower()+'_cost');counted=int(event in law.counted_events);charge=cost if law.budget_charge=='COMMAND_COST' else counted
    if charge>state.remaining_budget and law.budget_admission=='REFUSE_BEFORE_INPUT':return state,False,event,0,0,('remaining_transaction_budget',)
    after=state.model_copy(update={'stacks':tuple(changed[s.support_ref] for s in state.stacks),'held_member_ref':held,'held_source_ref':source,
        'click_count':state.click_count+1,'transfer_count':state.transfer_count+counted,'remaining_budget':max(0,state.remaining_budget-charge)})
    completed=_goal(after,model.goal) and event in law.completion_check_events;exhausted=after.remaining_budget==0 and event in law.exhaustion_check_events
    outcome='WIN' if completed and (law.completion_resource_priority=='COMPLETION_FIRST' or not exhausted) else law.exhaustion_outcome if exhausted else 'ACTIVE';missing=()
    if outcome=='RESTORE':
        reset=model.restored_state
        if reset is None or reset.level_scope_ref!=state.level_scope_ref or reset.restore_epoch<=state.restore_epoch or not _well_bound(request,reset,model):missing=('qualified_same_level_new_epoch_ordered_restore',);after=after.model_copy(update={'status':'LOCAL_STOP'})
        else:after=reset
    else:after=after.model_copy(update={'status':outcome})
    return after,True,event,cost,charge,missing


def _layers(request):
    measured=measure_translated_layers(request);values=dict(measured.values);templates={t.template_ref:t for t in request.layer_templates}
    if measured.computation_bound_reached:return measured
    rows=values.get('measured_layer_alternatives',())+values.get('possible_layer_alternatives',());groups={}
    for row in rows:
        template=templates[row['template_ref']];groups.setdefault((template.geometry_model_ref,template.ensemble_ref,template.member_ref),[]).append((template,row))
    grouped=tuple({'geometry_model_ref':model,'ensemble_ref':ensemble,'member_ref':member,'parts':tuple({'component':t.component,'template_ref':t.template_ref,'measurement':row,'extent_left':t.extent_left,'extent_right':t.extent_right} for t,row in parts),
        'template_extent_hypotheses':tuple((t.extent_left,t.extent_right) for t,row in parts if t.extent_left is not None),
        'disconnected_wings_are_distinct_members':False,'ghost_is_additional_stock':False} for (model,ensemble,member),parts in sorted(groups.items(),key=lambda r:(r[0][0],r[0][1],r[0][2] or '')))
    pixels={p.point:p.token_ref for p in request.raw_layer_pixels};extents=[];count=measured.examined_count;frontier={}
    for group_index,((model,ensemble,member),parts) in enumerate(sorted(groups.items(),key=lambda r:(r[0][0],r[0][1],r[0][2] or ''))):
        if member is None:continue
        work=sum(len(t.positive_pixels) for t,row in parts)
        if count+work>request.maximum_evaluations:frontier={'phase':'member_extent','next_group_index':group_index};break
        count+=work
        visible=tuple((p.point[0]+t.origin[0],p.point[1]+t.origin[1]) for t,row in parts for p in t.positive_pixels if pixels.get((p.point[0]+t.origin[0],p.point[1]+t.origin[1]))==p.token_ref)
        if not visible:continue
        left=min(p[0] for p in visible);right=max(p[0] for p in visible)
        complete=any(t.extent_left==left and t.extent_right==right for t,row in parts)
        extents.append({'geometry_model_ref':model,'ensemble_ref':ensemble,'member_ref':member,'observed_span':(left,right),'outer_endpoints_measured':complete,'width':right-left+1})
    relations=[]
    if not frontier:
        for ai,a in enumerate(extents):
            for bi,b in enumerate(extents):
                if count>=request.maximum_evaluations:frontier={'phase':'width_relation','left_index':ai,'right_index':bi};break
                count+=1
                if a['geometry_model_ref']==b['geometry_model_ref'] and a['outer_endpoints_measured'] and b['outer_endpoints_measured'] and a['width']<b['width']:relations.append((a['geometry_model_ref'],a['member_ref'],b['member_ref'],'horizontal_span_less_than'))
            if frontier:break
    geometry=None;geometry_charge=0
    if not frontier and request.frame is not None and request.components is not None:
        # Conservative input-work admission charge, not an exact profiler count.
        geometry_charge=(request.frame.height*request.frame.width)**2+len(request.components.components)**2
        if count+geometry_charge>request.maximum_evaluations:frontier={'phase':'legacy_geometry','conservative_work_charge':geometry_charge}
        else:count+=geometry_charge;geometry=measure_ordered_support_geometry(request.frame,request.components)
    return measured.model_copy(update={'values':immutable_json_data({**values,'support_member_ensembles':grouped,'legacy_conservative_geometry':geometry,
        'member_extent_measurements':extents,'conditional_width_order_relations':relations,
        'legacy_geometry_conservative_work_charge':geometry_charge,'legacy_nested_work_exact_count':'UNMEASURED',
        'support_occlusion_does_not_shorten_template_extent':True,'canonical_roles_written':False}),
        'examined_count':count,'domain_complete':measured.domain_complete and not frontier,'computation_bound_reached':bool(frontier),
        'frontier':immutable_json_data(frontier),'descriptive_facts':FrozenMap({**measured.descriptive_facts,'domain_complete':measured.domain_complete and not frontier,'computation_bound_reached':bool(frontier)})})


def _fit(request):
    count=0;fits=[];missing=[];frontier={}
    if not request.models or not request.observations:return family_result(request,prerequisite_refs=('ordered_models_and_sealed_observations',),domain_complete=False)
    for mi,model in enumerate(request.models):
        failures=[];supported=[];events=[]
        for oi,row in enumerate(request.observations):
            work=max(1,len(row.before.stacks)+len(request.members))
            if count+work>request.maximum_evaluations:frontier={'next_model_index':mi,'next_observation_index':oi};break
            count+=work
            if not row.sealed or row.event_owner_ref!=request.scope.event_owner_ref or row.epoch!=request.scope.epoch:missing.append('current_sealed_owned_ordered_interval');continue
            if not row.observed_support_refs and not row.held_observed and not row.counters_observed:missing.append('ordered_observed_fields_mask');continue
            click=next((c for c in model.clicks if (c.action_ref,c.payload)==(row.action_ref,row.payload)),None)
            if click is None:failures.append((row.observation_ref,'hit_map_mismatch'));continue
            if not _well_bound(request,row.before,model):missing.append('before_state_exact_member_support_domain');continue
            after,applied,event,cost,charge,debt=_step(request,row.before,model,click)
            if debt and applied:missing.extend(debt);continue
            a=_positions(after);b=_positions(row.after)
            if not set(row.observed_support_refs)<=set(a)&set(b):missing.append('observed_support_occurrence_domain');continue
            stack_difference=tuple(ref for ref in row.observed_support_refs if a[ref].members!=b[ref].members)
            held_difference=row.held_observed and (after.held_member_ref,after.held_source_ref)!=(row.after.held_member_ref,row.after.held_source_ref)
            count_difference=row.counters_observed and any(getattr(after,n)!=getattr(row.after,n) for n in ('click_count','transfer_count','remaining_budget','status','restore_epoch','level_scope_ref'))
            if stack_difference or held_difference or count_difference:failures.append((row.observation_ref,event,stack_difference,held_difference,count_difference))
            else:
                supported.append(row.observation_ref)
                if row.held_observed and set(row.observed_support_refs)==set(a):events.append(event)
        fits.append({'model_ref':model.model_ref,'compatible_observation_refs':tuple(supported),'refutations':tuple(failures),'measured_event_kinds':tuple(sorted(set(events))),
            'unmeasured_event_kinds':tuple(e for e in ('SELECT','CANCEL','TRANSFER','REJECT') if e not in events),'retained_as_unfalsified_model':not failures})
        if frontier:break
    return family_result(request,values={'transaction_fit_rows':fits},prerequisite_refs=tuple(dict.fromkeys(missing)),examined_count=count,
        domain_complete=not missing and not frontier,computation_bound_reached=bool(frontier),frontier=frontier)


def _frontier(request,deposit=False):
    state=request.state;sizes=_sizes(request);held=state.held_member_ref
    if deposit and held is None:return family_result(request,prerequisite_refs=('current_held_member_and_source',),domain_complete=False)
    rows=[]
    for stack in state.stacks:
        rows.append({'support_ref':stack.support_ref,'top_member_ref':stack.members[-1] if stack.members else None,
            'selectable':not deposit and held is None and stack.available and bool(stack.members),
            'deposit_admissible':deposit and stack.support_ref!=state.held_source_ref and _admissible(sizes,request.strict_order,held,stack),
            'blocker_ref':'held_transaction_active' if not deposit and held is not None else 'support_unavailable' if not stack.available else 'receiving_order' if deposit and stack.members and not _admissible(sizes,request.strict_order,held,stack) else None})
    return family_result(request,values={'support_rows':rows,'held_member_ref':held,'held_source_ref':state.held_source_ref,'remaining_solution_certified':False},examined_count=len(rows))


def _key(state):
    # No time/counter-dependent transition law exists in this explicit model.
    return (state.stacks,state.held_member_ref,state.held_source_ref,state.remaining_budget,state.status,state.level_scope_ref,state.restore_epoch)


def _graph(request):
    model=_model(request);initial=request.state;nodes=[(initial,0,None,None,None)];queue=deque([0]);seen={_key(initial):0};edges=[];cuts=[];count=0;missing=[]
    while queue:
        index=queue.popleft();state,depth,_,_,_=nodes[index]
        if state.status!='ACTIVE' or state.restore_epoch!=initial.restore_epoch:continue
        if depth>=request.maximum_depth:cuts.append({'state_index':index,'reason':'click_depth_bound'});continue
        for ci,click in enumerate(model.clicks):
            work=max(1,len(state.stacks)+len(request.members))
            if count+work>request.maximum_evaluations:cuts.append({'state_index':index,'next_click_index':ci,'reason':'evaluation_bound'});queue.clear();break
            count+=work;after,applied,event,cost,charge,debt=_step(request,state,model,click);missing.extend(debt)
            if not applied or debt:continue
            key=_key(after);child=seen.get(key)
            if child is None:
                if len(nodes)>=request.maximum_states:cuts.append({'state_index':index,'input_ref':click.input_ref,'reason':'state_bound'});continue
                child=len(nodes);seen[key]=child;nodes.append((after,depth+1,index,click.input_ref,event));queue.append(child)
            edges.append({'from_state_index':index,'to_state_index':child,'input_ref':click.input_ref,'event_ref':event,'external_click_cost':cost,'budget_charge':charge,'counted_transfer_delta':after.transfer_count-state.transfer_count if after.restore_epoch==state.restore_epoch else int(event in model.law.counted_events)})
    return nodes,edges,cuts,count,tuple(dict.fromkeys(missing))


def _materialize_ordered_predecessor_word_d(nodes,index):
    word=[];events=[]
    while nodes[index][2] is not None:
        _,_,parent,input_ref,event=nodes[index]
        word.append(input_ref);events.append(event);index=parent
    return tuple(reversed(word)),tuple(reversed(events))


def _domain(request,clearance=False):
    nodes,edges,cuts,count,missing=_graph(request)
    rows=tuple({'state':state,'depth':depth,'predecessor_state_index':parent,
        'incoming_input_ref':input_ref,'incoming_event_ref':event} for state,depth,parent,input_ref,event in nodes)
    values={'nodes':rows,'edges':edges,'executable_word_per_domain_node_retained':False,
        'arrangements_are_not_route_permutations':True,'counter_quotient_only_under_counter_independent_law':True,'minimum_cost_proved':False}
    if clearance:
        initial=_positions(request.state);source=next((s for s in request.state.stacks if request.requested_member_ref in s.members),None)
        if source is None:return family_result(request,prerequisite_refs=('requested_base_member_on_current_support',),domain_complete=False)
        if source.support_ref==request.receiver_ref:return family_result(request,prerequisite_refs=('distinct_base_source_and_required_receiver',),domain_complete=False)
        rank=source.members.index(request.requested_member_ref);blockers=source.members[rank+1:];candidates=[]
        for index,(state,depth,_,_,_) in enumerate(nodes):
            current=_positions(state).get(source.support_ref);receiver=_positions(state).get(request.receiver_ref)
            if state.status!='ACTIVE' or state.held_member_ref is not None or current is None or receiver is None or not current.members or current.members[-1]!=request.requested_member_ref:continue
            if not _admissible(_sizes(request),_model(request).law.strict_order,request.requested_member_ref,receiver):continue
            if count+5*depth>request.maximum_evaluations:
                cuts.append({'state_index':index,'reason':'clearance_witness_reconstruction_bound'});break
            count+=5*depth;word,events=_materialize_ordered_predecessor_word_d(nodes,index)
            candidates.append({'actual_clearance_input_word':word,'event_word':events,'blocking_member_refs':blockers,'temporary_stacks':state.stacks,
                'reconstruction_obligations':tuple({'support_ref':s.support_ref,'original_bottom_to_top':initial[s.support_ref].members,'current_bottom_to_top':s.members} for s in state.stacks if s.members!=initial[s.support_ref].members),
                'base_source_ref':source.support_ref,'receiver_ref':request.receiver_ref,
                'parent_goal_ref':request.scope.parent_goal_ref,'consumer_ref':request.scope.parent_contribution_ref,
                'retained_full_target_contract':_model(request).goal,
                'complete_remaining_solution_proved':False})
            if len(candidates)>=3:break
        values['clearance_candidates']=tuple(candidates)
    return family_result(request,values=values,prerequisite_refs=missing,examined_count=count,domain_complete=not cuts and not missing,
        computation_bound_reached=bool(cuts),frontier={'cuts':cuts,'retained_nodes':rows,'retained_edges':edges} if cuts else {})


def _compile(request,macros=None):
    model=_model(request);state=request.state;word=[];trace=[];missing=[];frontier={};count=0
    proposals=request.macros if macros is None else macros
    for mi,macro in enumerate(proposals):
        if state.status!='ACTIVE':frontier={'next_macro_index':mi,'reason':'authoritative_terminal_interruption'};break
        positions=_positions(state);source=positions.get(macro.source_ref);receiver=positions.get(macro.receiver_ref)
        if source is None or receiver is None or source==receiver:missing.append('distinct_current_macro_supports');break
        supports=[]
        if state.held_member_ref is None:
            if not source.available or not source.members or source.members[-1]!=macro.member_ref:missing.append('macro_accessible_source_top');break
            supports.append(macro.source_ref)
        elif (state.held_member_ref,state.held_source_ref)!=(macro.member_ref,macro.source_ref):missing.append('macro_current_held_identity_and_source');break
        if not _admissible(_sizes(request),model.law.strict_order,macro.member_ref,receiver):missing.append('macro_receiving_order_and_availability');break
        supports.append(macro.receiver_ref)
        for si,support in enumerate(supports):
            click=next((c for c in model.clicks if c.support_ref==support),None)
            if click is None:missing.append('currently_bound_support_click_payload');break
            work=max(1,len(state.stacks)+len(request.members))
            if count+work>request.maximum_evaluations:frontier={'next_macro_index':mi,'next_support_click_index':si,'reason':'evaluation_bound'};break
            count+=work;before=state;state,applied,event,cost,charge,debt=_step(request,state,model,click);missing.extend(debt)
            if not applied:missing.append('macro_input_not_applied');break
            word.append(click);trace.append({'before':before,'after':state,'event_ref':event,'input':click,'external_cost':cost,'budget_charge':charge})
            if event not in ('SELECT','TRANSFER'):missing.append('macro_transaction_effect_mismatch');break
            if state.status!='ACTIVE' or state.restore_epoch!=before.restore_epoch:
                if si+1<len(supports) or mi+1<len(proposals):frontier={'next_macro_index':mi+1,'unexecuted_current_macro_support_refs':tuple(supports[si+1:]),'reason':'authoritative_terminal_interruption'}
                break
        if missing or frontier or state.restore_epoch!=request.state.restore_epoch:break
    work=max(1,len(state.stacks)+len(model.goal.required_bottom_to_top))
    if count+work>request.maximum_evaluations:
        frontier={'reason':'evaluation_bound','phase':'whole_family_completion'};family_complete=None
    else:count+=work;family_complete=_goal(state,model.goal)
    values={'actual_click_word':word,'trace':trace,'after_state':state,'external_click_count':len(word),
        'command_cost':sum(t['external_cost'] for t in trace),'budget_charge':sum(t['budget_charge'] for t in trace),
        'legal_transfer_event_count':sum(t['event_ref']=='TRANSFER' for t in trace),'counted_transfer_delta':sum(t['event_ref'] in model.law.counted_events for t in trace),
        'model_terminal_status':state.status,'assumption_refs':request.scope.assumption_refs,
        'actual_required_family_complete':family_complete,
        'retained_full_target_contract':model.goal,'parent_goal_ref':request.scope.parent_goal_ref,
        'consumer_ref':request.scope.parent_contribution_ref}
    if request.budget_continuation is not None:
        budget_work=16+2*len(request.scope.assumption_refs)
        if count+budget_work>request.maximum_evaluations:
            frontier={'reason':'evaluation_bound','phase':'continuation_budget'}
        else:
            count+=budget_work;budget=measure_ordered_budget_continuation_d(request,values)
            missing.extend(budget['missing_refs'])
            complete=not missing and not frontier and family_complete is True and state.status=='WIN'
            if not complete:missing.append('ordered.complete_remaining_goal_witness')
            if not budget['recomputed_word_inside_allowance']:
                missing.append('ordered.complete_continuation_inside_declared_allowance')
            complete=complete and budget['recomputed_word_inside_allowance']
            values['continuation_budget']=FrozenMap.overlay({'remaining_complete_witness_validated':complete},budget)
    return family_result(request,values=values,prerequisite_refs=tuple(dict.fromkeys(missing)),examined_count=count,
        domain_complete=not missing and not frontier,computation_bound_reached=frontier.get('reason')=='evaluation_bound',frontier=frontier)


def _subtower(request):
    model=_model(request);state=request.state;sizes=_sizes(request);tower=request.subtower_bottom_to_top;positions=_positions(state)
    applicable=len(state.stacks)==3 and all(s.available for s in state.stacks) and model.law.strict_order
    if not applicable:
        result=family_result(request,values={'recurrence_applicable':False,'reason_ref':'exact_three_support_strict_order_recurrence_required'},domain_complete=False)
        return result.model_copy(update={'descriptive_facts':FrozenMap({**result.descriptive_facts,'operation_applicable':False})})
    source=positions.get(request.source_ref);receiver=positions.get(request.receiver_ref)
    if not tower or source is None or receiver is None or source==receiver or any(r not in sizes for r in tower):return family_result(request,prerequisite_refs=('bound_subtower_source_receiver_and_member_domain',),domain_complete=False)
    logical=source.members+((state.held_member_ref,) if state.held_source_ref==source.support_ref else ())
    if logical[-len(tower):]!=tower or any(sizes[a]<=sizes[b] for a,b in zip(tower,tower[1:])):return family_result(request,prerequisite_refs=('strict_current_contiguous_subtower',),domain_complete=False)
    auxiliary=next(s for s in state.stacks if s.support_ref not in (source.support_ref,receiver.support_ref))
    if any(s.members and sizes[s.members[-1]]<=sizes[tower[0]] for s in (receiver,auxiliary)):return family_result(request,prerequisite_refs=('receiving_and_auxiliary_base_clearance',),domain_complete=False)
    pending=[('CALL',len(tower),source.support_ref,receiver.support_ref,auxiliary.support_ref)];macros=[];count=0
    while pending and count<request.maximum_evaluations and len(macros)<request.maximum_transfers:
        tag,n,start,end,aux=pending.pop();count+=1
        if tag=='MOVE':macros.append(OrderedMacro(member_ref=tower[len(tower)-n],source_ref=start,receiver_ref=end));continue
        if n==1:pending.append(('MOVE',1,start,end,aux))
        else:pending.extend((('CALL',n-1,aux,end,start),('MOVE',n,start,end,aux),('CALL',n-1,start,aux,end)))
    # Recursive rank is counted from the smallest member, not raster position.
    macros=tuple(macros)
    if pending:return family_result(request,values={'macro_prefix':macros,'recurrence_applicable':True},examined_count=count,domain_complete=False,
        computation_bound_reached=True,frontier={'recursive_pending_calls':tuple(pending),'generated_macro_count':len(macros)})
    if count>=request.maximum_evaluations:return family_result(request,values={'macros':macros},examined_count=count,domain_complete=False,computation_bound_reached=True,frontier={'phase':'verify_recursive_macro'})
    compiled=_compile(request.model_copy(update={'maximum_evaluations':request.maximum_evaluations-count}),macros)
    values=dict(compiled.values);after=OrderedState.model_validate(values['after_state']);target=_positions(after).get(request.receiver_ref)
    verified=not compiled.prerequisite_refs and not compiled.frontier and target is not None and target.members[-len(tower):]==tower and after.held_member_ref is None
    return compiled.model_copy(update={'values':immutable_json_data({**values,'macros':macros,'recurrence_applicable':True,'verified_subtower_macro':verified}),
        'examined_count':compiled.examined_count+count})


def _compare(request):
    expected=request.expected_state;actual=request.actual_state;a=_positions(expected);b=_positions(actual)
    stacks=tuple((ref,a.get(ref),b.get(ref)) for ref in sorted(set(a)|set(b)) if a.get(ref)!=b.get(ref))
    fields=tuple((n,getattr(expected,n),getattr(actual,n)) for n in ('held_member_ref','held_source_ref','transfer_count','click_count','remaining_budget','status','restore_epoch','level_scope_ref') if getattr(expected,n)!=getattr(actual,n))
    model=_model(request);sizes=_sizes(request)
    legality=tuple((s.support_ref,all(sizes[x]>sizes[y] if model.law.strict_order else sizes[x]>=sizes[y] for x,y in zip(s.members,s.members[1:]))) for s in actual.stacks) if set(r for s in actual.stacks for r in s.members)<=set(sizes) else ()
    return family_result(request,values={'stack_changes':stacks,'transaction_counter_scope_changes':fields,'first_divergence':stacks[0] if stacks else fields[0] if fields else None,
        'local_order_legality':legality,'actual_required_family_complete':_goal(actual,model.goal),'budget_remaining':actual.remaining_budget,
        'actual_status':actual.status,'selection_retained':actual.held_member_ref is not None,'remaining_solution_proved':False},examined_count=len(a)+len(fields))


def measure_ordered_support_transfer(request: OrderedRequest) -> MechanicalFamilyResult:
    if request.mode is None or OPERATION_MODES.get(request.operation_ref)!=request.mode:return family_result(request,signature_supported=False,domain_complete=False)
    if request.budget_continuation is not None and request.operation_ref not in ('compile_transfer_cost','subtower_decomposition'):
        return family_result(request,prerequisite_refs=('ordered.continuation_budget_requires_complete_compile_word',),domain_complete=False)
    required={'support_member_measurement':('raw_layer_pixels','layer_templates'),'selection_deposit_fit':('members','models','observations'),
        'accessible_frontier':('state',),'ordered_deposit':('state','members','strict_order'),
        'click_successor':('state','members','models','bound_model_ref','input_ref'),'transfer_graph':('state','members','models','bound_model_ref'),
        'clearance_dependencies':('state','members','models','bound_model_ref','requested_member_ref','receiver_ref'),
        'subtower_decomposition':('state','members','models','bound_model_ref','source_ref','receiver_ref','subtower_bottom_to_top'),
        'compile_transfer_cost':('state','members','models','bound_model_ref','macros'),
        'stack_compare':('members','models','bound_model_ref','expected_state','actual_state')}
    missing=missing_supplied_fields(request,required[request.operation_ref])
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    op=request.operation_ref
    if op=='support_member_measurement':return _layers(request)
    if op=='selection_deposit_fit':return _fit(request)
    if op=='accessible_frontier':return _frontier(request)
    if op=='ordered_deposit':
        known=tuple(r for s in request.state.stacks for r in s.members)+((request.state.held_member_ref,) if request.state.held_member_ref is not None else ())
        if not set(known)<=set(_sizes(request)):return family_result(request,prerequisite_refs=('current_member_size_relation',),domain_complete=False)
        return _frontier(request,True)
    model=_model(request)
    if model is None:return family_result(request,prerequisite_refs=('bound_whole_ordered_model',),domain_complete=False)
    states=(request.expected_state,request.actual_state) if op=='stack_compare' else (request.state,)
    if any(not _well_bound(request,s,model) for s in states):return family_result(request,prerequisite_refs=('exact_current_member_and_support_domain',),domain_complete=False)
    if op in ('transfer_graph','clearance_dependencies'):return _domain(request,op=='clearance_dependencies')
    if op=='subtower_decomposition':return _subtower(request)
    if op=='compile_transfer_cost':return _compile(request)
    if op=='stack_compare':return _compare(request)
    click=next((c for c in model.clicks if c.input_ref==request.input_ref),None)
    if click is None:return family_result(request,prerequisite_refs=('grounded_ordered_support_click',),domain_complete=False)
    work=max(1,len(request.state.stacks)+len(request.members))
    if work>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'next_click_index':0})
    after,applied,event,cost,charge,missing=_step(request,request.state,model,click)
    return family_result(request,values={'after_state':after,'primitive_applied':applied,'event_ref':event,'external_click_count':int(applied),
        'external_command_cost':cost,'budget_charge':charge,'counted_transfer_event':applied and event in model.law.counted_events,
        'event_owner_ref':request.scope.event_owner_ref,'remaining_solution_certified':False},prerequisite_refs=missing,examined_count=work)
