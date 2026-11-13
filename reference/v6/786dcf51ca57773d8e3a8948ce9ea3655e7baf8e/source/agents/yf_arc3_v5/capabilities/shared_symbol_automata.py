"""Bounded shared emissions over caller-owned complete prefix vectors.

No word, input vocabulary, conflict/latch law, future goal or priority is inferred.
Each external command costs once, even when several groups accept its symbol.
"""
from collections import deque
from typing import Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, immutable_json_data
from .mechanical_family_contracts_a import MechanicalFamilyScope, MechanicalFamilyResult, family_result, missing_supplied_fields
from .identity_contact_authentication import ContactPixel, ContactLayerTemplate, ContactLayerSample, _candidate_layers as measure_translated_layers


class SymbolGroup(FrozenModel):
    group_ref: Ref
    word: tuple[Ref,...] = Field(min_length=1,max_length=128)
    prefix: int = Field(ge=0,le=128)
    acquired: bool
    @model_validator(mode="after")
    def position(self):
        if self.prefix>len(self.word):raise ValueError("prefix belongs to the complete ordered word")
        if self.acquired and self.prefix!=len(self.word):raise ValueError("acquisition retains the completed prefix")
        return self


class SymbolState(FrozenModel):
    groups: tuple[SymbolGroup,...] = Field(max_length=64)
    remaining_budget: int = Field(ge=0,le=65536)
    level_scope_ref: Ref
    restore_epoch: int = Field(ge=0)
    input_tick: int = Field(ge=0)
    status: Literal["ACTIVE","WIN","LOCAL_STOP","GAME_OVER"]
    @model_validator(mode="after")
    def identities(self):
        if len({g.group_ref for g in self.groups})!=len(self.groups):raise ValueError("group identities are unique")
        return self


class SymbolInput(FrozenModel):
    input_ref: Ref
    action_ref: Ref
    payload: FrozenMap
    symbol_ref: Ref
    cost: int = Field(ge=0,le=65536)


class SymbolInputMap(FrozenModel):
    map_ref: Ref
    inputs: tuple[SymbolInput,...] = Field(min_length=1,max_length=128)
    @model_validator(mode="after")
    def actions(self):
        if len({i.input_ref for i in self.inputs})!=len(self.inputs):raise ValueError("input bindings retain their identity")
        if len({(i.action_ref,i.payload) for i in self.inputs})!=len(self.inputs):raise ValueError("one exact action/payload binding per whole input map")
        return self


class SymbolTransactionLaw(FrozenModel):
    law_ref: Ref
    nonmatching_when_any_match: Literal["KEEP","RESET_OPEN"]
    all_miss: Literal["KEEP","RESET_OPEN"]
    completed_groups_latch: bool
    terminal_resource_priority: Literal["COMPLETION_FIRST","EXHAUSTION_FIRST"]
    exhaustion_outcome: Literal["LOCAL_STOP","GAME_OVER","RESTORE"]


class SymbolWorldModel(FrozenModel):
    model_ref: Ref
    input_map: SymbolInputMap
    law: SymbolTransactionLaw
    restored_state: SymbolState | None = None


class SymbolObservation(FrozenModel):
    observation_ref: Ref
    sealed: bool
    event_owner_ref: Ref
    epoch: int = Field(ge=0)
    before: SymbolState
    after: SymbolState
    action_ref: Ref
    payload: FrozenMap
    observed_group_refs: tuple[Ref,...] = Field(max_length=64)
    resource_status_observed: bool


class SymbolLayerTemplate(ContactLayerTemplate):
    component: Literal["FRAME","SYMBOL","FOCUS","COMPLETION","SLOT_BACKGROUND","TUTORIAL"]
    group_ref: Ref | None = None
    occurrence: int | None = Field(default=None,ge=0,le=127)
    symbol_ref: Ref | None = None
    @model_validator(mode="after")
    def occurrence_owner(self):
        if self.component in ("SYMBOL","FOCUS","SLOT_BACKGROUND") and (self.group_ref is None or self.occurrence is None):raise ValueError("ranked geometry retains group and occurrence")
        if self.component=="SYMBOL" and self.symbol_ref is None:raise ValueError("symbol glyph has a caller-bound symbol identity")
        return self


class SharedSymbolRequest(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.shared_symbol_request.v1"
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None = None
    maximum_states: int = Field(ge=1,le=4096)
    maximum_depth: int = Field(ge=0,le=128)
    maximum_witnesses: int = Field(ge=1,le=3)
    maximum_evaluations: int = Field(default=65536,ge=1,le=65536)
    state: SymbolState | None = None
    models: tuple[SymbolWorldModel,...] = Field(default=(),max_length=128)
    bound_model_ref: Ref | None = None
    input_ref: Ref | None = None
    observations: tuple[SymbolObservation,...] = Field(default=(),max_length=256)
    requested_group_refs: tuple[Ref,...] = Field(default=(),max_length=64)
    command_word: tuple[Ref,...] = Field(default=(),max_length=128)
    bound_symbol_word: tuple[Ref,...] = Field(default=(),max_length=128)
    exploratory_word: tuple[Ref,...] = Field(default=(),max_length=128)
    sacrifice_group_refs: tuple[Ref,...] = Field(default=(),max_length=64)
    expected_state: SymbolState | None = None
    actual_state: SymbolState | None = None
    raw_layer_pixels: tuple[ContactPixel,...] = Field(default=(),max_length=65536)
    layer_templates: tuple[SymbolLayerTemplate,...] = Field(default=(),max_length=4096)
    layer_samples: tuple[ContactLayerSample,...] = Field(default=(),max_length=4096)
    @model_validator(mode="after")
    def domains(self):
        if len({m.model_ref for m in self.models})!=len(self.models):raise ValueError("whole input/law models retain unique identities")
        if self.state is not None and (not set(self.requested_group_refs)<={g.group_ref for g in self.state.groups} or not set(self.sacrifice_group_refs)<={g.group_ref for g in self.state.groups}):raise ValueError("consumer group references belong to the current state")
        if len({p.point for p in self.raw_layer_pixels})!=len(self.raw_layer_pixels) or len({t.template_ref for t in self.layer_templates})!=len(self.layer_templates):raise ValueError("raw layer evidence identities are unique")
        return self


OPERATION_MODES={"group_focus_measurement":"MEASURE","symbol_input_fit":"FIT","conflict_latch_fit":"FIT",
    "shared_emission_step":"STEP","prefix_product":"DOMAIN","handoff_candidates":"INVERSE_DOMAIN",
    "temporary_prefix_release":"PRECONDITION","completion_word":"COMPILE","learning_budget":"PRECONDITION","prefix_compare":"COMPARE"}


def _step(request,state,model,input):
    if state.status!="ACTIVE":return state,(),("active_current_emission_scope",),False
    if input.cost>state.remaining_budget:return state,(),("affordable_actual_emission",),False
    law=model.law;matches={g.group_ref for g in state.groups if (not g.acquired or not law.completed_groups_latch)
        and g.prefix<len(g.word) and g.word[g.prefix]==input.symbol_ref}
    groups=[];events=[]
    for group in state.groups:
        if group.acquired and law.completed_groups_latch:
            groups.append(group);events.append((group.group_ref,"retained_acquisition",group.prefix,group.prefix));continue
        if group.group_ref in matches:
            prefix=group.prefix+1;changed=group.model_copy(update={"prefix":prefix,"acquired":prefix==len(group.word)})
            events.append((group.group_ref,"advanced_once",group.prefix,prefix));groups.append(changed)
        else:
            reset=(law.nonmatching_when_any_match=="RESET_OPEN" if matches else law.all_miss=="RESET_OPEN")
            changed=group.model_copy(update={"prefix":0,"acquired":False}) if reset else group
            events.append((group.group_ref,"erased_nonempty_prefix" if reset and group.prefix else "all_miss_or_zero_unchanged",group.prefix,changed.prefix));groups.append(changed)
    budget=state.remaining_budget-input.cost;completed=bool(groups) and all(g.acquired for g in groups);exhausted=budget==0
    after=state.model_copy(update={"groups":tuple(groups),"remaining_budget":budget,"input_tick":state.input_tick+1})
    completion_first=law.terminal_resource_priority=="COMPLETION_FIRST"
    if completed and (completion_first or not exhausted):after=after.model_copy(update={"status":"WIN"})
    elif exhausted:
        if law.exhaustion_outcome=="RESTORE":
            restored=model.restored_state
            if restored is None or restored.restore_epoch<=state.restore_epoch or restored.level_scope_ref!=state.level_scope_ref:
                return state,tuple(events),("qualified_new_epoch_symbol_restoration",),False
            after=restored
        else:after=after.model_copy(update={"status":law.exhaustion_outcome})
    return after,tuple(events),(),True


def _bound_model(request):
    return next((m for m in request.models if m.model_ref==request.bound_model_ref),None)


def _replay(request,state,model,word,budget):
    bindings={i.input_ref:i for i in model.input_map.inputs};trace=[];cost=0;count=0
    for index,input_ref in enumerate(word):
        work=max(1,len(state.groups))
        if count+work>budget:return state,tuple(trace),cost,count,(),{"next_command_index":index,"remaining_word":word[index:]}
        input=bindings.get(input_ref)
        if input is None:return state,tuple(trace),cost,count,("current_exact_input_binding",),{}
        count+=work;before=state;state,events,missing,applied=_step(request,state,model,input)
        if missing:return before,tuple(trace),cost,count,missing,{}
        if applied:cost+=input.cost
        trace.append({"command":input,"before":before,"after":state,"group_events":events,
            "event_owner_ref":request.scope.event_owner_ref,"model_ref":model.model_ref,"primitive_count":1})
        if state.status!="ACTIVE" or state.restore_epoch!=before.restore_epoch:
            return state,tuple(trace),cost,count,(),{"scope_boundary_suffix":word[index+1:]} if index+1<len(word) else {}
    return state,tuple(trace),cost,count,(),{}


def _layers(request):
    result=measure_translated_layers(request)
    if result.computation_bound_reached:return result
    templates={t.template_ref:t for t in request.layer_templates};groups={};backgrounds=[];tutorial=[]
    for row in result.values.get("measured_layer_alternatives",()):
        t=templates[row["template_ref"]];entry=(t.occurrence,t.symbol_ref,t.layer_ref,row["measurement"]["support"])
        if t.component=="SLOT_BACKGROUND":backgrounds.append((t.group_ref,entry))
        elif t.component=="TUTORIAL":tutorial.append(entry)
        elif t.group_ref is not None:groups.setdefault(t.group_ref,[]).append((t.component,entry))
    return family_result(request,values={"group_occurrence_layers":tuple((ref,tuple(sorted(rows,key=lambda row:(row[1][0] if row[1][0] is not None else -1,row[0],row[1][2])))) for ref,rows in sorted(groups.items())),
        "independent_slot_backgrounds":tuple(backgrounds),"tutorial_layers":tuple(tutorial),
        "unresolved_templates":result.values.get("possible_layer_alternatives",()),"refutations":result.values.get("refutations",()),
        "adjacent_equal_symbols_fused":False,"filled_background_treated_as_glyph":False},examined_count=result.examined_count,
        prerequisite_refs=result.prerequisite_refs)


def _fit(request):
    compatible=[];refutations=[];unknown=[];count=0
    if not request.observations or not request.models:return family_result(request,prerequisite_refs=("owned_observations_and_whole_symbol_models",),domain_complete=False)
    for model_index,model in enumerate(request.models):
        first=None;unresolved=[];evidence=[]
        for observation_index,observation in enumerate(request.observations):
            if not observation.sealed or observation.epoch!=request.scope.epoch or observation.event_owner_ref!=request.scope.event_owner_ref:
                unresolved.append((observation.observation_ref,"sealed_current_owner_epoch"));continue
            if not observation.observed_group_refs and not observation.resource_status_observed:
                unresolved.append((observation.observation_ref,"at_least_one_actual_prefix_or_resource_observation"));continue
            unknown_before=len(unresolved)
            inputs=tuple(i for i in model.input_map.inputs if i.action_ref==observation.action_ref and i.payload==observation.payload)
            if not inputs:unresolved.append((observation.observation_ref,"supplied_actual_action_symbol_binding"));continue
            predictions=[]
            for input_index,input in enumerate(inputs):
                work=max(1,len(observation.before.groups))
                if count+work>request.maximum_evaluations:
                    return family_result(request,values={"compatible_models":tuple(compatible),"first_refutations":tuple(refutations)},
                        examined_count=count,domain_complete=False,computation_bound_reached=True,
                        frontier={"model_index":model_index,"observation_index":observation_index,"input_index":input_index})
                count+=work;after,events,missing,applied=_step(request,observation.before,model,input)
                if missing:unresolved.extend((observation.observation_ref,ref) for ref in missing);continue
                expected={g.group_ref:g for g in after.groups};actual={g.group_ref:g for g in observation.after.groups}
                fits=all(ref in expected and ref in actual and expected[ref]==actual[ref] for ref in observation.observed_group_refs)
                if observation.resource_status_observed:fits=fits and all(getattr(after,name)==getattr(observation.after,name) for name in ("remaining_budget","restore_epoch","level_scope_ref","status"))
                if fits:predictions.append((input.input_ref,input.symbol_ref,events))
            if not predictions and len(unresolved)==unknown_before:first=(observation.observation_ref,"joint_prefix_or_resource_effect");break
            evidence.append((observation.observation_ref,tuple(predictions)))
        if first:refutations.append((model.model_ref,first));continue
        compatible.append({"model":model,"matching_observation_bindings":tuple(evidence),"unresolved_evidence":tuple(unresolved)})
        unknown.extend(unresolved)
    return family_result(request,values={"compatible_models":tuple(compatible),"first_refutations":tuple(refutations),
        "unresolved_evidence":tuple(unknown),"directional_action_proves_spatial_motion":False,
        "red_flash_at_zero_proves_lost_progress":False},examined_count=count,
        prerequisite_refs=("current_symbol_or_conflict_latch_observation",) if unknown else ())


def _symbol_predecessor_word_d(parents,index,remaining):
    word=[];work=0
    while parents[index] is not None:
        parent,input_ref=parents[index]
        work+=1
        if work>remaining:return None,work
        word.append(input_ref);index=parent
    return tuple(reversed(word)),work


def _product(request):
    states=[];parents=[];lookup={};queue=deque();edges=[];witnesses=[];pending=[];missing=[];count=0
    for model_index,model in enumerate(request.models):
        if len(states)>=request.maximum_states:pending.append(("model_origin",model_index));continue
        index=len(states);states.append((model.model_ref,request.state));parents.append(None);lookup[(model_index,request.state)]=index;queue.append((model_index,index,0,0))
    while queue:
        model_index,index,depth,cost=queue.popleft();model=request.models[model_index];state=states[index][1]
        if (state.restore_epoch,state.level_scope_ref)!=(request.state.restore_epoch,request.state.level_scope_ref):continue
        if state.status=="WIN":
            if not state.groups or not all(g.acquired for g in state.groups):
                missing.append('authoritative_completion_with_whole_group_conjunction');continue
            if len(witnesses)<request.maximum_witnesses:
                word,work=_symbol_predecessor_word_d(parents,index,request.maximum_evaluations-count)
                if word is None:pending.append((model_index,index,'witness_reconstruction_bound'));continue
                count+=work;witnesses.append((model.model_ref,index,word,cost))
            continue
        if state.status!="ACTIVE" or state.restore_epoch!=request.state.restore_epoch:continue
        if depth>=request.maximum_depth:pending.append((model_index,index,depth,cost,"depth_bound"));continue
        for input_index,input in enumerate(model.input_map.inputs):
            work=max(1,len(state.groups))
            if count+work>request.maximum_evaluations:
                pending.append((model_index,index,depth,cost,input_index));pending.extend(tuple(queue));queue.clear();break
            count+=work;after,events,unresolved,applied=_step(request,state,model,input)
            if unresolved:
                if unresolved!=("affordable_actual_emission",):missing.extend(unresolved)
                continue
            key=(model_index,after);destination=lookup.get(key)
            if destination is None:
                if len(states)>=request.maximum_states:pending.append((model_index,index,input_index,after));continue
                destination=len(states);states.append((model.model_ref,after));parents.append((index,input.input_ref));lookup[key]=destination
                queue.append((model_index,destination,depth+1,cost+input.cost))
            edges.append((index,destination,input,events))
    return family_result(request,values={"full_prefix_vector_states":tuple(states),"owned_emission_edges":tuple(edges),
        "conditional_completion_witnesses":tuple(witnesses),"total_slot_count_used_as_state":False,
        "robust_strategy_proved":False,"minimum_cost_proved":False,
        "rejected_executable_word_bank_retained":False},prerequisite_refs=tuple(dict.fromkeys(missing)),examined_count=count,
        domain_complete=not missing and not pending,computation_bound_reached=bool(pending),frontier={"pending_work":tuple(pending)} if pending else {})


def _handoffs(request):
    groups=tuple(g for g in request.state.groups if not g.acquired);candidates=[];focus={};count=0
    for group in groups:
        if group.prefix<len(group.word):focus.setdefault(group.word[group.prefix],[]).append(group.group_ref)
    for i,left in enumerate(groups):
        a=left.word[left.prefix:]
        for j,right in enumerate(groups):
            if i==j:continue
            b=right.word[right.prefix:]
            for overlap in range(min(len(a),len(b))+1):
                if count>=request.maximum_evaluations:
                    return family_result(request,values={"candidate_symbol_schedules":tuple(candidates)},examined_count=count,
                        domain_complete=False,computation_bound_reached=True,frontier={"left_index":i,"right_index":j,"overlap":overlap})
                count+=1
                if overlap==0 or a[-overlap:]==b[:overlap]:candidates.append((left.group_ref,right.group_ref,overlap,a+b[overlap:]))
    return family_result(request,values={"candidate_symbol_schedules":tuple(candidates),
        "common_focus_opportunities":tuple((symbol,tuple(refs)) for symbol,refs in sorted(focus.items())),
        "exact_conflict_latch_replay_required":True,"completion_proved":False},examined_count=count)


def _compile(request):
    model=_bound_model(request)
    if model is None:return family_result(request,prerequisite_refs=("current_bound_whole_symbol_model",),domain_complete=False)
    symbols=tuple(next((i.symbol_ref for i in model.input_map.inputs if i.input_ref==ref),None) for ref in request.command_word)
    if symbols!=request.bound_symbol_word:return family_result(request,prerequisite_refs=("actual_input_word_matches_bound_symbol_occurrences",),domain_complete=False)
    after,trace,cost,count,missing,frontier=_replay(request,request.state,model,request.command_word,request.maximum_evaluations)
    return family_result(request,values={"primitive_commands":tuple(row["command"] for row in trace),"joint_update_trace":trace,
        "after_state":after,"actual_cost":cost,"one_command_per_emission_occurrence":True,
        "joint_completion_reached":after.status=="WIN" and bool(after.groups) and all(g.acquired for g in after.groups)
            and (after.level_scope_ref,after.restore_epoch)==(request.state.level_scope_ref,request.state.restore_epoch)
            and not missing and not frontier},prerequisite_refs=missing,examined_count=count,
        domain_complete=not missing and not frontier,computation_bound_reached="next_command_index" in frontier,frontier=frontier)


def _release_or_budget(request):
    model=_bound_model(request)
    if model is None:return family_result(request,prerequisite_refs=("current_bound_conflict_latch_and_input_model",),domain_complete=False)
    current={g.group_ref:g for g in request.state.groups}
    if any(ref not in current or current[ref].acquired for ref in request.sacrifice_group_refs):
        return family_result(request,prerequisite_refs=('current_nonacquired_named_prefix_release',),domain_complete=False)
    after_exploration,trace,explore_cost,count,missing,frontier=_replay(request,request.state,model,request.exploratory_word,request.maximum_evaluations)
    if missing or frontier:return family_result(request,values={"exploration_trace":trace},prerequisite_refs=missing,
        examined_count=count,domain_complete=False,computation_bound_reached="next_command_index" in frontier,frontier=frontier)
    after,completion,completion_cost,visits,missing,frontier=_replay(request,after_exploration,model,request.command_word,request.maximum_evaluations-count)
    original={g.group_ref:g for g in request.state.groups};middle={g.group_ref:g for g in after_exploration.groups};final={g.group_ref:g for g in after.groups}
    sacrificed=tuple(ref for ref in request.sacrifice_group_refs if ref in original and not original[ref].acquired and middle[ref].prefix<original[ref].prefix)
    protected=all(not g.acquired or all(next((h for h in row["after"].groups if h.group_ref==g.group_ref),None)==g
        for row in trace+completion) for g in request.state.groups)
    completed=bool(after.groups) and all(g.acquired for g in after.groups) and after.status=="WIN"
    same_scope=after.level_scope_ref==request.state.level_scope_ref and after.restore_epoch==request.state.restore_epoch
    return family_result(request,values={"exploration_trace":trace,"completion_trace":completion,"after_state":after,
        "sacrificed_prefix_refs":sacrificed,"exploration_cost":explore_cost,"jointly_executable_completion_cost":completion_cost,
        "budget_margin":request.state.remaining_budget-explore_cost-completion_cost,
        "viable_suffix_found":completed and (protected or not model.law.completed_groups_latch) and same_scope and not missing and not frontier,
        "completed_groups_preserved_within_evidenced_scope":protected and same_scope and model.law.completed_groups_latch,
        "reconstruction_obligations":tuple((ref,original[ref].prefix,middle[ref].prefix,final[ref].prefix) for ref in sacrificed),
        "lower_bound_used_as_found_suffix":False},prerequisite_refs=missing,examined_count=count+visits,
        domain_complete=not missing and not frontier,computation_bound_reached="next_command_index" in frontier,frontier=frontier)


def _compare(request):
    from .articulated_dependency_measurement_c import _nodes
    expected=request.expected_state;actual=request.actual_state
    work=_nodes(immutable_json_data((expected,actual)),request.maximum_evaluations)
    if work is None:return family_result(request,domain_complete=False,computation_bound_reached=True,
        frontier={'phase':'full_group_occurrence_and_resource_compare'})
    a={g.group_ref:g for g in expected.groups};b={g.group_ref:g for g in actual.groups}
    changes=tuple((ref,a.get(ref),b.get(ref)) for ref in sorted(set(a)|set(b)) if a.get(ref)!=b.get(ref))
    resource=tuple((name,getattr(expected,name),getattr(actual,name)) for name in ("remaining_budget","restore_epoch","level_scope_ref","input_tick","status") if getattr(expected,name)!=getattr(actual,name))
    return family_result(request,values={"per_group_changes":changes,"resource_scope_changes":resource,
        "first_full_vector_divergence":changes[0] if changes else resource[0] if resource else None,
        "erased_nonempty_prefix_refs":tuple(ref for ref in sorted(set(a)&set(b)) if a[ref].prefix>0 and b[ref].prefix<a[ref].prefix),
        "unchanged_acquired_group_refs":tuple(ref for ref in sorted(set(a)&set(b)) if a[ref].acquired and a[ref]==b[ref]),
        "same_total_slot_count_proves_equal_state":False},examined_count=work)


def measure_shared_symbol_automata(request: SharedSymbolRequest) -> MechanicalFamilyResult:
    if request.mode is None or OPERATION_MODES.get(request.operation_ref)!=request.mode:return family_result(request,signature_supported=False,domain_complete=False)
    required={"group_focus_measurement":("raw_layer_pixels","layer_templates"),"symbol_input_fit":("models","observations"),
        "conflict_latch_fit":("models","observations"),"shared_emission_step":("state","models","bound_model_ref","input_ref"),
        "prefix_product":("state","models"),"handoff_candidates":("state",),
        "temporary_prefix_release":("state","models","bound_model_ref","exploratory_word","command_word","sacrifice_group_refs"),
        "completion_word":("state","models","bound_model_ref","bound_symbol_word","command_word"),
        "learning_budget":("state","models","bound_model_ref","exploratory_word","command_word"),
        "prefix_compare":("expected_state","actual_state")}
    missing=missing_supplied_fields(request,required[request.operation_ref])
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    op=request.operation_ref
    if op=="group_focus_measurement":return _layers(request)
    if op in ("symbol_input_fit","conflict_latch_fit"):return _fit(request)
    if op=="prefix_product":return _product(request)
    if op=="handoff_candidates":return _handoffs(request)
    if op=="completion_word":return _compile(request)
    if op in ("temporary_prefix_release","learning_budget"):return _release_or_budget(request)
    if op=="prefix_compare":return _compare(request)
    if len(request.state.groups)>request.maximum_evaluations:
        return family_result(request,domain_complete=False,computation_bound_reached=True,
            frontier={"phase":"shared_prefix_update","next_group_index":0})
    model=_bound_model(request)
    if model is None:return family_result(request,prerequisite_refs=("bound_whole_symbol_model",),domain_complete=False)
    input=next((i for i in model.input_map.inputs if i.input_ref==request.input_ref),None)
    if input is None:return family_result(request,prerequisite_refs=("current_actual_symbol_input_binding",),domain_complete=False)
    after,events,missing,applied=_step(request,request.state,model,input)
    return family_result(request,values={"after_state":after,"joint_group_events":events,"primitive_applied":applied,
        "external_command_count":1 if applied else 0,"actual_cost":input.cost if applied else 0,
        "model_ref":model.model_ref,"event_owner_ref":request.scope.event_owner_ref,
        "reset_group_reconsumed_same_symbol":False},prerequisite_refs=missing,examined_count=len(request.state.groups))
