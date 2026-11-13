"""Pure K18 measurements for explicit physical/display regions and contact laws."""
from typing import Literal
from pydantic import Field,model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel,Ref
from .contracts import FrameGrid

Cell=tuple[int,int]


class SymbolRegionA(FrozenModel):
    region_ref: Ref
    frame: FrameGrid
    bounds: tuple[int,int,int,int]
    excluded_positions: tuple[Cell,...]=Field(default=(),max_length=4096)
    scale: tuple[int,int]=(1,1)
    evidence_refs: tuple[Ref,...]=Field(min_length=1,max_length=64)
    @model_validator(mode='after')
    def validate_extent(self):
        top,left,bottom,right=self.bounds
        if not(0<=top<=bottom<self.frame.height and 0<=left<=right<self.frame.width):raise ValueError('current region must be contained in its frame')
        if min(self.scale)<=0 or max(self.scale)>64:raise ValueError('positive bounded exact scale required')
        if len(set(self.excluded_positions))!=len(self.excluded_positions):raise ValueError('exclusions repeat a cell')
        if any(not(top<=r<=bottom and left<=c<=right) for r,c in self.excluded_positions):raise ValueError('exclusion must be within its current region')
        return self


class SymbolContactA(FrozenModel):
    contact_ref: Ref
    actor_before: tuple[Cell,...]=Field(min_length=1,max_length=4096)
    actor_after: tuple[Cell,...]=Field(min_length=1,max_length=4096)
    station_before: tuple[Cell,...]=Field(min_length=1,max_length=4096)
    station_after: tuple[Cell,...]=Field(min_length=1,max_length=4096)
    event_owner_ref: Ref
    epoch: int=Field(ge=0)
    checkpoint_ref: Ref
    trigger: Literal['ENTRY','DWELL','COARRIVAL','UNKNOWN']
    first_loaded_frame: bool
    blocked_command: bool
    last_processed_contact_ref: Ref|None=None
    law_evidence_refs: tuple[Ref,...]=Field(default=(),max_length=64)
    retained_law_assumption_ref: Ref|None=None


class SymbolPhysicalDisplayBindingA(FrozenModel):
    mover_before: tuple[tuple[Cell,int],...]=Field(min_length=1,max_length=4096)
    mover_after: tuple[tuple[Cell,int],...]=Field(min_length=1,max_length=4096)
    display_before: SymbolRegionA
    display_after: SymbolRegionA
    requirement_before: SymbolRegionA
    requirement_after: SymbolRegionA
    contact: SymbolContactA
    covered_underlay_before: tuple[tuple[Cell,int|None],...]=Field(default=(),max_length=4096)
    covered_underlay_after: tuple[tuple[Cell,int|None],...]=Field(default=(),max_length=4096)


def normalize_symbol_region_a(region):
    top,left,bottom,right=region.bounds;sy,sx=region.scale
    height,width=bottom-top+1,right-left+1
    if height%sy or width%sx:return None,('exact_uniform_scale_divides_current_region',)
    exclusions=frozenset(region.excluded_positions);matrix=[]
    for row in range(top,bottom+1,sy):
        values=[]
        for column in range(left,right+1,sx):
            positions=tuple((r,c) for r in range(row,row+sy) for c in range(column,column+sx))
            excluded=tuple(p in exclusions for p in positions)
            if all(excluded):values.append(None);continue
            if any(excluded):return None,('supported_exclusion_does_not_split_scaled_template_cell',)
            samples={region.frame.rows[r][c] for r,c in positions}
            if len(samples)!=1:return None,('scale_reduction_preserves_all_colored_and_empty_cells',)
            values.append(next(iter(samples)))
        matrix.append(tuple(values))
    return tuple(matrix),()


def _symbol_rotations_a(matrix):
    rows=matrix;rotations=[]
    for _ in range(4):
        rotations.append(rows);rows=tuple(tuple(row) for row in zip(*rows[::-1]))
    return tuple(rotations)


def measure_full_colored_symbol_pattern_a(first,second):
    a,ad=normalize_symbol_region_a(first);b,bd=normalize_symbol_region_a(second)
    if ad or bd:return {'compatible':None,'missing_refs':tuple(dict.fromkeys(ad+bd))}
    return {'first_oriented_matrix':a,'second_oriented_matrix':b,'actual_orientation_equal':a==b,
        'rotation_family_equal':b in _symbol_rotations_a(a),'discarded_palette_or_meaningful_empty_cells':False,
        'display_used_as_physical_collision_mask':False}


def measure_symbol_entry_a(contact,scope):
    if contact.event_owner_ref!=scope.event_owner_ref or contact.epoch!=scope.epoch:
        return {'triggered':None,'missing_refs':('current_same_owner_epoch_contact_checkpoint',)}
    if not contact.law_evidence_refs and contact.retained_law_assumption_ref not in scope.assumption_refs:
        return {'triggered':None,'missing_refs':('evidenced_or_retained_contact_trigger_law',)}
    if contact.trigger=='UNKNOWN':return {'triggered':None,'missing_refs':('current_contact_trigger_and_checkpoint',)}
    before=bool(set(contact.actor_before)&set(contact.station_before));after=bool(set(contact.actor_after)&set(contact.station_after))
    # Loaded presence cannot retrospectively become a physical entry.
    if contact.first_loaded_frame:triggered=False
    elif contact.trigger=='ENTRY':triggered=not before and after
    elif contact.trigger=='DWELL':triggered=after
    else:triggered=not before and after and (contact.actor_before!=contact.actor_after or contact.station_before!=contact.station_after)
    return {'before_contact':before,'after_contact':after,'triggered':triggered,'checkpoint_ref':contact.checkpoint_ref,
        'last_processed_contact_ref':contact.contact_ref if triggered else contact.last_processed_contact_ref,
        'initial_presence_replayed_as_entry':False,'blocked_position_equated_to_tick':False}


def measure_symbol_physical_display_binding_a(binding,scope):
    contact=measure_symbol_entry_a(binding.contact,scope)
    display=measure_full_colored_symbol_pattern_a(binding.display_before,binding.display_after)
    requirement=measure_full_colored_symbol_pattern_a(binding.requirement_before,binding.requirement_after)
    return {'physical_mover_before':binding.mover_before,'physical_mover_after':binding.mover_after,
        'physical_mover_unchanged':dict(binding.mover_before)==dict(binding.mover_after),'display_change':display,
        'framed_requirement_stable':requirement.get('actual_orientation_equal'),'requirement_comparison':requirement,
        'station_contact':contact,'covered_underlay_before':binding.covered_underlay_before,'covered_underlay_after':binding.covered_underlay_after,
        'distant_effect_conditioned_on_trigger':contact.get('triggered') is True,
        'display_fragmented_into_terrain':False,'hidden_underlay_inferred_from_display':False}

import hashlib,json
from .mechanical_family_contracts_a import MechanicalFamilyScope,MechanicalFamilyResult,family_result,missing_supplied_fields
from agents.yf_arc3_v5.logos.types import FrozenMap,immutable_json_data


class SymbolAspectStateA(FrozenModel):
    state_ref: Ref
    aspects: tuple[tuple[Ref,Ref],...]=Field(min_length=1,max_length=32)


class SymbolAspectEdgeA(FrozenModel):
    edge_ref: Ref
    operator_ref: Ref
    aspect_ref: Ref
    before_state_ref: Ref
    after_state_ref: Ref
    direction_ref: Ref
    precondition_refs: tuple[Ref,...]=Field(default=(),max_length=64)
    evidence_refs: tuple[Ref,...]=Field(default=(),max_length=64)
    assumption_ref: Ref|None=None


class SymbolCycleCandidateA(FrozenModel):
    candidate_ref: Ref
    aspect_ref: Ref
    edge_refs: tuple[Ref,...]=Field(min_length=1,max_length=128)


class SymbolWalkStateA(FrozenModel):
    node_ref: Ref
    symbol_state_ref: Ref
    reserve: int=Field(ge=0)
    used_refill_refs: tuple[Ref,...]=Field(default=(),max_length=128)
    acquired_target_refs: tuple[Ref,...]=Field(default=(),max_length=128)
    station_state: FrozenMap=Field(default_factory=FrozenMap)


class SymbolWalkStepA(FrozenModel):
    edge_ref: Ref
    action_ref: Ref
    before_node_ref: Ref
    after_node_ref: Ref
    before_symbol_ref: Ref
    after_symbol_ref: Ref
    contact: SymbolContactA|None=None
    cost: int=Field(ge=0)
    refill_ref: Ref|None=None
    refill_quantity: int|None=Field(default=None,ge=0)
    resource_order: Literal['COST_THEN_REFILL','REFILL_THEN_COST','UNKNOWN']
    minimum_reserve: int=Field(default=0,ge=0)
    acquisition_ref: Ref|None=None
    acquisition_evidence_refs: tuple[Ref,...]=Field(default=(),max_length=64)
    acquisition_latches: bool|None=None
    tick_before: int|None=Field(default=None,ge=0)
    tick_after: int|None=Field(default=None,ge=0)
    clock_ref: Ref|None=None
    checkpoint_ref: Ref
    visibility_decision_refs: tuple[Ref,...]=Field(default=(),max_length=64)
    station_before_state: FrozenMap|None=None
    station_after_state: FrozenMap|None=None
    evidence_refs: tuple[Ref,...]=Field(default=(),max_length=64)
    assumption_ref: Ref|None=None


class SymbolWalkCandidateA(FrozenModel):
    candidate_ref: Ref
    edge_refs: tuple[Ref,...]=Field(max_length=4096)
    requested_station_contact_ref: Ref|None=None
    required_contact_count: int|None=Field(default=None,ge=0)
    required_final_symbol_ref: Ref|None=None
    quotient_groups: tuple[tuple[int,int],...]=Field(default=(),max_length=4096)


class SymbolContinuationA(FrozenModel):
    phase: Literal['ROWS','WORD','UNSTARTED']
    input_digest: Ref
    next_item: int=Field(default=0,ge=0)
    next_step: int=Field(default=0,ge=0)
    state: SymbolWalkStateA|None=None
    events: tuple[FrozenMap,...]=()
    completed_rows: tuple[FrozenMap,...]=()
    prerequisite_refs: tuple[Ref,...]=()
    accounted_evaluations: int=Field(default=0,ge=0)


class SymbolNavigationRequestA(FrozenModel):
    schema_version: Ref='yf_arc3_v5.symbolic_navigation_extensions_request_a.v1'
    scope: MechanicalFamilyScope
    source_identity_ref: Ref
    operation_ref: Ref
    mode: Ref|None=None
    binding: SymbolPhysicalDisplayBindingA|None=None
    first_region: SymbolRegionA|None=None
    second_region: SymbolRegionA|None=None
    contact: SymbolContactA|None=None
    aspect_states: tuple[SymbolAspectStateA,...]=Field(default=(),max_length=4096)
    aspect_edges: tuple[SymbolAspectEdgeA,...]=Field(default=(),max_length=4096)
    cycle_candidates: tuple[SymbolCycleCandidateA,...]=Field(default=(),max_length=4096)
    satisfied_precondition_refs: tuple[Ref,...]=Field(default=(),max_length=128)
    state: SymbolWalkStateA|None=None
    walk_edges: tuple[SymbolWalkStepA,...]=Field(default=(),max_length=4096)
    walk_candidates: tuple[SymbolWalkCandidateA,...]=Field(default=(),max_length=3)
    maximum_evaluations: int=Field(default=65536,ge=1,le=65536)
    maximum_states: int=Field(default=4096,ge=1,le=4096)
    resume: SymbolContinuationA|None=None
    @model_validator(mode='after')
    def validate_domains(self):
        for refs in ([s.state_ref for s in self.aspect_states],[e.edge_ref for e in self.aspect_edges],
            [c.candidate_ref for c in self.cycle_candidates],[e.edge_ref for e in self.walk_edges],[c.candidate_ref for c in self.walk_candidates]):
            if len(refs)!=len(set(refs)):raise ValueError('state/edge/candidate identity domains must be unique')
        if any(len(s.aspects)!=len({a for a,v in s.aspects}) for s in self.aspect_states):raise ValueError('aspect schema must have unique keys')
        return self


SYMBOL_OPERATION_MODES={'physical_display_binding':('MEASURE',),'full_colored_pattern':('MATCH',),
    'cycles_and_aspect_independence':('FIT',),'entry_not_initial_presence':('STEP_INTERNAL',),
    'rearm_walk_effects':('COMPARE',),'event_route_quotient':('COMPARE',)}


def _symbol_digest_a(request):
    return hashlib.sha256(json.dumps(request.model_dump(mode='json',exclude={'resume','maximum_evaluations','maximum_states'}),
        sort_keys=True,separators=(',',':')).encode()).hexdigest()


def _symbol_resume_a(request,phase,**fields):
    for name in ('events','completed_rows'):fields[name]=tuple(immutable_json_data(row) for row in fields.get(name,()))
    return SymbolContinuationA(input_digest=_symbol_digest_a(request),phase=phase,**fields)


def _symbol_cycles_a(request):
    resume=request.resume if request.resume is not None and request.resume.phase=='ROWS' else None
    rows=list(resume.completed_rows) if resume is not None else [];count=resume.accounted_evaluations if resume is not None else 0
    debt=list(resume.prerequisite_refs) if resume is not None else []
    states={s.state_ref:s for s in request.aspect_states};edges={e.edge_ref:e for e in request.aspect_edges}
    for index in range(resume.next_item if resume is not None else 0,len(request.cycle_candidates)):
        candidate=request.cycle_candidates[index];work=1+len(candidate.edge_refs)*max(1,max((len(s.aspects) for s in request.aspect_states),default=1))
        if count+work>request.maximum_evaluations or len(rows)>=request.maximum_states:
            token=_symbol_resume_a(request,'ROWS',next_item=index,completed_rows=tuple(rows),prerequisite_refs=tuple(dict.fromkeys(debt)),accounted_evaluations=count)
            return family_result(request,values={'cycle_candidates':tuple(rows)},prerequisite_refs=tuple(dict.fromkeys(debt)),examined_count=count,
                domain_complete=False,computation_bound_reached=True,frontier={'continuation':token})
        count+=work;chain=[];missing=[];observed=True;other_preserved=True
        for ref in candidate.edge_refs:
            edge=edges.get(ref)
            if edge is None or edge.before_state_ref not in states or edge.after_state_ref not in states:
                missing.append('current_exact_aspect_edge_and_states');break
            if edge.aspect_ref!=candidate.aspect_ref or not set(edge.precondition_refs)<=set(request.satisfied_precondition_refs):
                missing.append('current_aspect_edge_preconditions');break
            if not edge.evidence_refs:
                observed=False
                if edge.assumption_ref not in request.scope.assumption_refs:missing.append('evidenced_or_retained_aspect_edge');break
            before,after=states[edge.before_state_ref],states[edge.after_state_ref]
            if chain and chain[-1].after_state_ref!=edge.before_state_ref:missing.append('connected_exact_cycle_edge_word');break
            a,b=dict(before.aspects),dict(after.aspects)
            if set(a)!=set(b) or candidate.aspect_ref not in a:missing.append('same_complete_aspect_schema');break
            other_preserved=other_preserved and all(a[k]==b[k] for k in a if k!=candidate.aspect_ref)
            chain.append(edge)
        closed=bool(chain) and not missing and states[chain[0].before_state_ref].aspects==states[chain[-1].after_state_ref].aspects
        directions=tuple(dict.fromkeys(e.direction_ref for e in chain))
        values=tuple(dict.fromkeys(dict(states[e.before_state_ref].aspects)[candidate.aspect_ref] for e in chain))
        rows.append({'candidate_ref':candidate.candidate_ref,'exact_return':closed,'observed_cycle_closed':closed and observed,
            'retained_hypothesis_cycle':closed and not observed,'tested_cardinality':len(values),'direction_refs':directions,
            'other_aspects_preserved_on_tested_edges':other_preserved,'universal_independence_or_commutation_proven':False,
            'unobserved_inverse_or_complete_graph_inferred':False,'missing_refs':tuple(missing)})
        debt.extend(missing)
    return family_result(request,values={'cycle_candidates':tuple(rows)},prerequisite_refs=tuple(dict.fromkeys(debt)),examined_count=count,
        domain_complete=not debt and request.scope.input_domain_complete)


def _symbol_walk_step_a(request,state,edge):
    if state.node_ref!=edge.before_node_ref or state.symbol_state_ref!=edge.before_symbol_ref:
        return state,{},('current_node_symbol_matches_bound_edge_prestate',)
    if not edge.evidence_refs and edge.assumption_ref not in request.scope.assumption_refs:
        return state,{},('evidenced_or_retained_full_walk_edge',)
    if edge.station_before_state is not None or edge.station_after_state is not None:
        if edge.station_before_state!=state.station_state or edge.station_after_state is None:
            return state,{},('complete_current_station_state_transition',)
    if edge.resource_order=='UNKNOWN':return state,{},('current_resource_debit_and_refill_order',)
    contact=None
    if edge.contact is not None:
        if edge.contact.checkpoint_ref!=edge.checkpoint_ref:return state,{},('same_declared_contact_event_checkpoint',)
        if edge.contact.trigger=='COARRIVAL' and (edge.clock_ref is None or edge.tick_before is None or edge.tick_after is None):
            return state,{},('current_k13_clock_and_tick_for_coarrival',)
        contact=measure_symbol_entry_a(edge.contact,request.scope)
        if contact.get('triggered') is None:return state,{},contact['missing_refs']
        if not contact['triggered'] and edge.after_symbol_ref!=edge.before_symbol_ref:
            return state,{},('symbol_change_requires_evidenced_contact_trigger',)
    elif edge.before_symbol_ref!=edge.after_symbol_ref:
        return state,{},('symbol_change_has_current_contact_owner',)
    reserve=state.reserve;used=list(state.used_refill_refs);events=[]
    def refill():
        nonlocal reserve
        if edge.refill_ref is None or edge.refill_ref in used:return ()
        if edge.refill_quantity is None:return ('known_refill_quantity_and_identity',)
        reserve=edge.refill_quantity;used.append(edge.refill_ref);events.append({'kind':'REFILL','refill_ref':edge.refill_ref,'reserve':reserve})
        return ()
    if edge.resource_order=='REFILL_THEN_COST':
        missing=refill()
        if missing:return state,{},missing
    reserve-=edge.cost;events.append({'kind':'DEBIT','cost':edge.cost,'reserve':reserve})
    if reserve<edge.minimum_reserve:return state,{},('resource_prefix_constraint_at_declared_checkpoint',)
    if edge.resource_order=='COST_THEN_REFILL':
        missing=refill()
        if missing:return state,{},missing
    acquired=list(state.acquired_target_refs)
    if edge.acquisition_ref is not None:
        if not edge.acquisition_evidence_refs or edge.acquisition_latches is None:return state,{},('supported_acquisition_and_latching_scope',)
        if edge.acquisition_latches and edge.acquisition_ref not in acquired:acquired.append(edge.acquisition_ref)
    after=state.model_copy(update={'node_ref':edge.after_node_ref,'symbol_state_ref':edge.after_symbol_ref,'reserve':reserve,
        'used_refill_refs':tuple(used),'acquired_target_refs':tuple(acquired),
        'station_state':edge.station_after_state if edge.station_after_state is not None else state.station_state})
    return after,{'edge_ref':edge.edge_ref,'action_ref':edge.action_ref,'before_state':state,'after_state':after,
        'contact':contact,'resource_events':tuple(events),'clock_ref':edge.clock_ref,'tick_before':edge.tick_before,'tick_after':edge.tick_after,
        'checkpoint_ref':edge.checkpoint_ref,'visibility_decision_refs':edge.visibility_decision_refs,'acquisition_ref':edge.acquisition_ref},()


def _symbol_quotient_a(candidate,events):
    groups=candidate.quotient_groups
    if not groups:return (),('explicit_complete_primitive_partition_for_quotient',)
    cursor=0;result=[]
    for start,end in groups:
        if start!=cursor or end<=start or end>len(events):return (),('contiguous_complete_primitive_partition',)
        segment=events[start:end];cursor=end
        # Event-bearing walks can be represented only with their full ledger.
        significant=tuple(index for index,event in enumerate(segment,start) if event.get('contact') is not None or event.get('visibility_decision_refs')
            or event.get('acquisition_ref') is not None or event.get('resource_events') or event.get('tick_before')!=event.get('tick_after'))
        result.append({'primitive_interval':(start,end),'expanded_action_word':tuple(e['action_ref'] for e in segment),
            'before_state':segment[0]['before_state'],'after_state':segment[-1]['after_state'],'full_event_ledger':tuple(segment),
            'event_indices':significant,'events_erased_by_compression':False})
    if cursor!=len(events):return (),('primitive_suffix_not_omitted_by_event_quotient',)
    return tuple(result),()


def _symbol_words_a(request,operation):
    resume=request.resume if request.resume is not None and request.resume.phase=='WORD' else None
    rows=list(resume.completed_rows) if resume is not None else [];count=resume.accounted_evaluations if resume is not None else 0
    debt=list(resume.prerequisite_refs) if resume is not None else [];edges={e.edge_ref:e for e in request.walk_edges}
    for index in range(resume.next_item if resume is not None else 0,len(request.walk_candidates)):
        candidate=request.walk_candidates[index];continuing=resume is not None and index==resume.next_item
        state=resume.state if continuing and resume.state is not None else request.state
        events=list(resume.events) if continuing else [];local=[]
        for part in range(resume.next_step if continuing else 0,len(candidate.edge_refs)+1):
            edge=edges.get(candidate.edge_refs[part]) if part<len(candidate.edge_refs) else None
            work=1+len(state.used_refill_refs)+len(state.acquired_target_refs)+len(events) if part==len(candidate.edge_refs) else (
                1+len(state.used_refill_refs)+len(state.acquired_target_refs)+(sum(len(p) for p in (edge.contact.actor_before,edge.contact.actor_after,edge.contact.station_before,edge.contact.station_after)) if edge is not None and edge.contact is not None else 0))
            if count+work>request.maximum_evaluations or len(rows)>=request.maximum_states:
                token=_symbol_resume_a(request,'WORD',next_item=index,next_step=part,state=state,events=tuple(events),completed_rows=tuple(rows),
                    prerequisite_refs=tuple(dict.fromkeys(debt)),accounted_evaluations=count)
                return family_result(request,values={'walk_candidates':tuple(rows)},prerequisite_refs=tuple(dict.fromkeys(debt)),examined_count=count,
                    domain_complete=False,computation_bound_reached=True,frontier={'continuation':token})
            count+=work
            if part==len(candidate.edge_refs):break
            if edge is None:local.append('current_known_walk_primitive_edge');break
            state,event,missing=_symbol_walk_step_a(request,state,edge)
            if missing:local.extend(missing);break
            events.append(immutable_json_data(event))
        triggers=tuple(e['contact'] for e in events if e.get('contact') is not None and e['contact'].get('triggered'))
        count_requested=sum(c['last_processed_contact_ref']==candidate.requested_station_contact_ref for c in triggers)
        final_symbol= candidate.required_final_symbol_ref is None or state.symbol_state_ref==candidate.required_final_symbol_ref
        row={'candidate_ref':candidate.candidate_ref,'after_state':state,'expanded_action_word':tuple(e['action_ref'] for e in events),
            'full_event_ledger':tuple(events),'requested_contact_count':count_requested,'contact_count_matches':candidate.required_contact_count is None or count_requested==candidate.required_contact_count,
            'required_final_symbol_matches':final_symbol,'neutral_rearm_preserves_symbol':state.symbol_state_ref==request.state.symbol_state_ref,
            'fully_executed':not local,'missing_refs':tuple(local),'physical_route_search_called':False}
        if operation=='event_route_quotient' and not local:
            quotient,missing=_symbol_quotient_a(candidate,events);row['event_graph_edges']=quotient;row['quotient_supported']=not missing;local.extend(missing)
            row['missing_refs']=tuple(local)
        debt.extend(local);rows.append(row);resume=None
    return family_result(request,values={'walk_candidates':tuple(rows)},prerequisite_refs=tuple(dict.fromkeys(debt)),examined_count=count,
        domain_complete=not debt and request.scope.input_domain_complete)


def _measure_symbolic_navigation_extensions_a(request):
    prefix='mechanics.symbolic_contact_navigation.'
    op=request.operation_ref[len(prefix):] if request.operation_ref.startswith(prefix) else ''
    if op not in SYMBOL_OPERATION_MODES or request.mode not in SYMBOL_OPERATION_MODES[op]:return family_result(request,signature_supported=False,domain_complete=False)
    fields={'physical_display_binding':('binding',),'full_colored_pattern':('first_region','second_region'),
        'cycles_and_aspect_independence':('aspect_states','aspect_edges','cycle_candidates','satisfied_precondition_refs'),
        'entry_not_initial_presence':('contact',),'rearm_walk_effects':('state','walk_edges','walk_candidates'),
        'event_route_quotient':('state','walk_edges','walk_candidates')}[op]
    missing=missing_supplied_fields(request,fields)
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    if op=='cycles_and_aspect_independence':return _symbol_cycles_a(request)
    if op in ('rearm_walk_effects','event_route_quotient'):return _symbol_words_a(request,op)
    regions=(request.first_region,request.second_region) if op=='full_colored_pattern' else (
        request.binding.display_before,request.binding.display_after,request.binding.requirement_before,request.binding.requirement_after) if op=='physical_display_binding' else ()
    contact=request.binding.contact if op=='physical_display_binding' else request.contact
    work=1+sum((r.bounds[2]-r.bounds[0]+1)*(r.bounds[3]-r.bounds[1]+1)*4+len(r.excluded_positions) for r in regions)
    if contact is not None:work+=sum(len(p) for p in (contact.actor_before,contact.actor_after,contact.station_before,contact.station_after))
    if work>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'required_work':work})
    if op=='full_colored_pattern':values=measure_full_colored_symbol_pattern_a(request.first_region,request.second_region);debt=values.get('missing_refs',())
    elif op=='entry_not_initial_presence':values=measure_symbol_entry_a(request.contact,request.scope);debt=values.get('missing_refs',())
    else:
        values=measure_symbol_physical_display_binding_a(request.binding,request.scope)
        debt=tuple(dict.fromkeys((*values['station_contact'].get('missing_refs',()),*values['display_change'].get('missing_refs',()),*values['requirement_comparison'].get('missing_refs',()))))
    return family_result(request,values=values,prerequisite_refs=debt,examined_count=work,domain_complete=not debt)


def measure_symbolic_navigation_extensions_a(request: SymbolNavigationRequestA) -> MechanicalFamilyResult:
    if request.resume is not None and request.resume.input_digest!=_symbol_digest_a(request):return family_result(request,prerequisite_refs=('same_source_scope_revision_and_symbolic_inputs',),domain_complete=False)
    result=_measure_symbolic_navigation_extensions_a(request)
    if result.computation_bound_reached and 'continuation' not in result.frontier:
        result=result.model_copy(update={'frontier':immutable_json_data({**dict(result.frontier),'continuation':_symbol_resume_a(request,'UNSTARTED')})})
    return result
