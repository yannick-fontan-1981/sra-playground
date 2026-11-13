"""Finite caller-owned push geometry. No raster color establishes a push law.

Actor walkability, relaxed crate admissibility and actual joint transport remain
separate domains. Costs, terminal priority and occurrence identity are explicit.
"""
from collections import deque
from heapq import heappop, heappush
from typing import Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref
from .mechanical_family_contracts_a import MechanicalFamilyScope, MechanicalFamilyResult, family_result, missing_supplied_fields
from .identity_contact_authentication import ContactPixel, ContactLayerTemplate, ContactLayerSample, _candidate_layers as measure_translated_layers
from .contracts import PeriodicCellGridInput
from .frame import enumerate_periodic_cell_grids

Point=tuple[int,int]
CARDINALS=((0,-1),(0,1),(-1,0),(1,0))


class PushTarget(FrozenModel):
    target_ref: Ref
    position: Point


class PushTerrain(FrozenModel):
    terrain_ref: Ref
    walkable: tuple[Point,...] = Field(min_length=1,max_length=4096)
    targets: tuple[PushTarget,...] = Field(max_length=16)
    topology_complete: bool
    all_crates_required: bool
    @model_validator(mode="after")
    def cells(self):
        if len(set(self.walkable))!=len(self.walkable):raise ValueError("terrain cells are unique")
        if len({t.target_ref for t in self.targets})!=len(self.targets) or len({t.position for t in self.targets})!=len(self.targets):raise ValueError("target occurrences remain distinct")
        if any(t.position not in self.walkable for t in self.targets):raise ValueError("each target belongs to supplied terrain")
        return self


class PushCrate(FrozenModel):
    crate_ref: Ref
    position: Point
    compatible_target_refs: tuple[Ref,...] = Field(max_length=16)
    fixed: bool
    @model_validator(mode="after")
    def targets(self):
        if len(set(self.compatible_target_refs))!=len(self.compatible_target_refs):raise ValueError("compatible targets retain unique occurrence identity")
        return self


class PushState(FrozenModel):
    actor: Point
    crates: tuple[PushCrate,...] = Field(max_length=16)
    remaining_budget: int = Field(ge=0,le=65536)
    input_tick: int = Field(ge=0)
    level_scope_ref: Ref
    restore_epoch: int = Field(ge=0)
    status: Literal["ACTIVE","WIN","LOCAL_STOP","GAME_OVER"]
    @model_validator(mode="after")
    def bodies(self):
        if len({c.crate_ref for c in self.crates})!=len(self.crates) or len({c.position for c in self.crates})!=len(self.crates):raise ValueError("crate identities and positions are distinct")
        if self.actor in {c.position for c in self.crates}:raise ValueError("actor and crate centers occupy distinct cells")
        return self


class PushCommand(FrozenModel):
    input_ref: Ref
    action_ref: Ref
    payload: FrozenMap
    direction: Point
    accepted_cost: int = Field(ge=0,le=65536)
    blocked_cost: int = Field(ge=0,le=65536)
    @model_validator(mode="after")
    def cardinal(self):
        if self.direction not in CARDINALS:raise ValueError("one cardinal attempt per input")
        return self


class PushModel(FrozenModel):
    model_ref: Ref
    clock_independent: Literal[True]
    push_distance: int = Field(ge=1,le=16)
    commands: tuple[PushCommand,...] = Field(min_length=1,max_length=4)
    completion_resource_priority: Literal["COMPLETION_FIRST","EXHAUSTION_FIRST"]
    exhaustion_outcome: Literal["LOCAL_STOP","GAME_OVER","RESTORE"]
    restored_state: PushState | None = None
    @model_validator(mode="after")
    def inputs(self):
        if len({c.input_ref for c in self.commands})!=len(self.commands) or len({c.direction for c in self.commands})!=len(self.commands) or len({(c.action_ref,c.payload) for c in self.commands})!=len(self.commands):raise ValueError("whole input map has unique references, directions and actual payloads")
        return self


class PushObservation(FrozenModel):
    observation_ref: Ref
    event_owner_ref: Ref
    epoch: int = Field(ge=0)
    sealed: bool
    before: PushState
    after: PushState
    action_ref: Ref
    payload: FrozenMap
    observed_crate_refs: tuple[Ref,...] = Field(max_length=16)
    actor_observed: bool
    resources_observed: bool
    context: Literal["FREE","CONTACT","BLOCKED_RECEIVER","DISENGAGEMENT"]


class PushLayerTemplate(ContactLayerTemplate):
    component: Literal["TERRAIN","TARGET","CRATE","ACTOR","STATE_COLOR","WALL_TEXTURE"]
    logical_cell: Point | None = None
    lattice_ref: Ref | None = None
    cell_offset: Point = (0,0)


class PushLattice(FrozenModel):
    lattice_ref: Ref
    origin: Point
    pitch: Point
    action_evidence_refs: tuple[Ref,...] = Field(min_length=1,max_length=32)
    @model_validator(mode="after")
    def spacing(self):
        if any(p<=0 for p in self.pitch):raise ValueError("positive measured cell pitch")
        return self


class RememberedPushTarget(FrozenModel):
    target: PushTarget
    lattice_ref: Ref
    level_scope_ref: Ref
    occluded: bool
    current_contradiction: bool
    evidence_ref: Ref


class PushMacro(FrozenModel):
    crate_ref: Ref
    direction: Point
    @model_validator(mode="after")
    def cardinal(self):
        if self.direction not in CARDINALS:raise ValueError("push macro direction is cardinal")
        return self


class PushRequest(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.push_request.v1"
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None = None
    maximum_states: int = Field(ge=1,le=4096)
    maximum_depth: int = Field(ge=0,le=256)
    maximum_evaluations: int = Field(ge=1,le=65536)
    maximum_witnesses: int = Field(default=3,ge=1,le=3)
    terrain: PushTerrain | None = None
    state: PushState | None = None
    models: tuple[PushModel,...] = Field(default=(),max_length=128)
    bound_model_ref: Ref | None = None
    input_ref: Ref | None = None
    observations: tuple[PushObservation,...] = Field(default=(),max_length=256)
    intended_push: PushMacro | None = None
    metric: Literal["EXTERNAL_COMMANDS","PUSHES"] | None = None
    command_word: tuple[Ref,...] | None = Field(default=None,max_length=512)
    push_macros: tuple[PushMacro,...] | None = Field(default=None,max_length=256)
    expected_state: PushState | None = None
    actual_outcome: PushObservation | None = None
    raw_layer_pixels: tuple[ContactPixel,...] = Field(default=(),max_length=65536)
    layer_templates: tuple[PushLayerTemplate,...] = Field(default=(),max_length=4096)
    layer_samples: tuple[ContactLayerSample,...] = Field(default=(),max_length=4096)
    lattice_candidates: tuple[PushLattice,...] = Field(default=(),max_length=32)
    remembered_targets: tuple[RememberedPushTarget,...] = Field(default=(),max_length=128)
    level_scope_ref: Ref | None = None
    grid_input: PeriodicCellGridInput | None = None
    exhaust_small_deadlock_domain: bool | None = None
    @model_validator(mode="after")
    def identities(self):
        for rows,name in ((self.models,"model_ref"),(self.observations,"observation_ref"),(self.layer_templates,"template_ref"),(self.lattice_candidates,"lattice_ref")):
            if len({getattr(r,name) for r in rows})!=len(rows):raise ValueError("candidate and evidence references are unique")
        if len({p.point for p in self.raw_layer_pixels})!=len(self.raw_layer_pixels):raise ValueError("one current raw token per pixel")
        return self


OPERATION_MODES={"board_layers":"MEASURE","push_law_fit":"FIT","actor_access":"PRECONDITION",
    "push_successor":"STEP","inverse_crate_domains":"INVERSE_DOMAIN","assignment_bound":"PROPAGATE",
    "dynamic_deadlock":"PRECONDITION","push_route_domain":"DOMAIN","parking_reassignment":"INVERSE_DOMAIN",
    "push_word_certificate":"COMPILE"}


def _add(p,d,n=1):return (p[0]+d[0]*n,p[1]+d[1]*n)
def _model(request):return next((m for m in request.models if m.model_ref==request.bound_model_ref),None)
def _state_valid(terrain,state):return state.actor in terrain.walkable and all(c.position in terrain.walkable and set(c.compatible_target_refs)<=set(t.target_ref for t in terrain.targets) for c in state.crates)


def _occupancy(terrain,state):
    bodies={c.position:c for c in state.crates}
    return tuple((t.target_ref,bodies[t.position].crate_ref) for t in terrain.targets if t.position in bodies and t.target_ref in bodies[t.position].compatible_target_refs)


def _complete(terrain,state):
    occupied=_occupancy(terrain,state)
    return len(occupied)==len(terrain.targets) and (not terrain.all_crates_required or len(occupied)==len(state.crates))


def _walk(terrain,state,destination,bound,materialize=True):
    """Actor-only BFS; no crate admissibility mask is applied to walking."""
    cells=set(terrain.walkable);blocked={c.position:c for c in state.crates};pending=deque([state.actor]);parents={state.actor:None};count=0
    while pending and count<bound:
        p=pending.popleft();count+=1
        if p==destination:
            if not materialize:return (),tuple(parents),count,False,()
            path=[]
            while parents[p] is not None:
                if count>=bound:return None,tuple(parents),count,True,()
                count+=1
                previous,d=parents[p];path.append(d);p=previous
            return tuple(reversed(path)),tuple(parents),count,False,()
        for d in CARDINALS:
            q=_add(p,d)
            if q in cells and q not in blocked and q not in parents:parents[q]=(p,d);pending.append(q)
    blockers=tuple((p,blocked[p].crate_ref) for p in sorted(blocked) if any(_add(p,d) in parents for d in CARDINALS))
    return None,tuple(parents),count,bool(pending),blockers


def _step(terrain,state,model,command):
    """One supplied attempt. Never invokes search or infers attachment/pulling."""
    if state.status!="ACTIVE":return state,False,False,(),"authoritative_terminal_state"
    cells=set(terrain.walkable);bypos={c.position:c for c in state.crates};destination=_add(state.actor,command.direction);crate=bypos.get(destination)
    pushed=False;free=destination in cells and crate is None;reason="free_walk" if free else "terrain_collision"
    if crate is not None:
        swept=tuple(_add(crate.position,command.direction,i) for i in range(1,model.push_distance+1))
        free=not crate.fixed and all(p in cells and p not in bypos for p in swept)
        pushed=free;reason="one_crate_push" if free else "fixed_crate" if crate.fixed else "receiving_cell_collision"
    cost=command.accepted_cost if free else command.blocked_cost
    if cost>state.remaining_budget:return state,False,False,(),"insufficient_budget_before_input"
    changes=tuple(c.model_copy(update={"position":_add(c.position,command.direction,model.push_distance)}) if pushed and c.crate_ref==crate.crate_ref else c for c in state.crates)
    after=state.model_copy(update={"actor":destination if free else state.actor,"crates":changes,"remaining_budget":state.remaining_budget-cost,"input_tick":state.input_tick+1})
    complete=_complete(terrain,after);exhausted=after.remaining_budget==0
    terminal="WIN" if complete and (model.completion_resource_priority=="COMPLETION_FIRST" or not exhausted) else model.exhaustion_outcome if exhausted else "ACTIVE"
    missing=()
    if terminal=="RESTORE":
        restored=model.restored_state
        if restored is None or restored.level_scope_ref!=state.level_scope_ref or restored.restore_epoch<=state.restore_epoch or not _state_valid(terrain,restored):missing=("qualified_same_level_new_epoch_restored_state",);after=after.model_copy(update={"status":"LOCAL_STOP"})
        else:after=restored
    else:after=after.model_copy(update={"status":terminal})
    return after,True,pushed,missing,reason


def _layers(request):
    measured=measure_translated_layers(request);values=dict(measured.values);lattices={x.lattice_ref:x for x in request.lattice_candidates}
    grids=enumerate_periodic_cell_grids(request.grid_input)
    compatible_lattices=tuple(l.lattice_ref for l in request.lattice_candidates if any(
        l.pitch==(g.cell_width+g.col_gap,g.cell_height+g.row_gap) and (l.origin[0]%l.pitch[0],l.origin[1]%l.pitch[1])==(g.col_offset%l.pitch[0],g.row_offset%l.pitch[1]) for g in grids.candidates))
    rows=values.get("measured_layer_alternatives",())+values.get("possible_layer_alternatives",());templates={t.template_ref:t for t in request.layer_templates}
    candidates=[]
    for row in rows:
        template=templates.get(row.get("template_ref"))
        if template is None:continue
        lattice=lattices.get(template.lattice_ref)
        grid_consistent=lattice is not None and template.logical_cell is not None and template.origin==_add(_add(lattice.origin,(template.logical_cell[0]*lattice.pitch[0],template.logical_cell[1]*lattice.pitch[1])),template.cell_offset)
        candidates.append({"measurement":row,"component":template.component,"logical_cell":template.logical_cell,
            "lattice_ref":template.lattice_ref,"action_grounded_lattice_consistent":grid_consistent,
            "role_candidate_only":True,"state_color_is_lock_proof":False})
    retained=tuple(r for r in request.remembered_targets if r.level_scope_ref==request.level_scope_ref and r.lattice_ref in lattices and r.occluded and not r.current_contradiction)
    return measured.model_copy(update={"values":family_result(request,values={**values,"board_layer_candidates":candidates,
        "retained_occluded_targets":retained,"withdrawn_contradicted_target_refs":tuple(r.target.target_ref for r in request.remembered_targets if r.current_contradiction),
        "lattice_candidates":request.lattice_candidates,"physical_periodic_grids":grids,
        "periodic_compatible_action_grounded_lattice_refs":compatible_lattices,
        "wall_texture_establishes_playable_lattice":False}).values})


def _fit(request):
    if not request.models or not request.observations:return family_result(request,prerequisite_refs=("whole_push_models_and_sealed_observations",),domain_complete=False)
    results=[];count=0;frontier={};missing=[]
    for mi,model in enumerate(request.models):
        refuted=[];contexts=[];usable=0
        for oi,row in enumerate(request.observations):
            work=max(1,len(row.before.crates))
            if count+work>request.maximum_evaluations:frontier={"next_model_index":mi,"next_observation_index":oi};break
            count+=work
            if not row.sealed or row.event_owner_ref!=request.scope.event_owner_ref or row.epoch!=request.scope.epoch:missing.append("current_sealed_owned_push_observation");continue
            command=next((c for c in model.commands if (c.action_ref,c.payload)==(row.action_ref,row.payload)),None)
            if command is None:refuted.append((row.observation_ref,"actual_input_map_mismatch"));continue
            if not _state_valid(request.terrain,row.before):missing.append("observed_state_in_bound_terrain");continue
            after,applied,pushed,debt,reason=_step(request.terrain,row.before,model,command)
            if debt:missing.extend(debt);continue
            a={c.crate_ref:c for c in after.crates};b={c.crate_ref:c for c in row.after.crates}
            if not set(row.observed_crate_refs)<=set(a)&set(b):missing.append("observed_crate_identity_present_before_after");continue
            difference=tuple(ref for ref in row.observed_crate_refs if a[ref].position!=b[ref].position)
            resources=(after.remaining_budget,after.input_tick,after.status,after.restore_epoch,after.level_scope_ref)!=(row.after.remaining_budget,row.after.input_tick,row.after.status,row.after.restore_epoch,row.after.level_scope_ref)
            if difference or row.actor_observed and after.actor!=row.after.actor or row.resources_observed and resources:refuted.append((row.observation_ref,reason,difference));continue
            if row.actor_observed and set(row.observed_crate_refs)==set(a):usable+=1;contexts.append(row.context)
        results.append({"model_ref":model.model_ref,"refutations":refuted,"fully_observed_intervals":usable,
            "measured_contexts":tuple(sorted(set(contexts))),"unmeasured_contexts":tuple(c for c in ("FREE","CONTACT","BLOCKED_RECEIVER","DISENGAGEMENT") if c not in contexts),
            "supported_whole_push_model":usable>0 and not refuted and set(contexts)=={"FREE","CONTACT","BLOCKED_RECEIVER","DISENGAGEMENT"},
            "retained_as_unrefuted_alternative":not refuted,"attachment_pull_chain_inferred":False})
        if frontier:break
    return family_result(request,values={"model_fit_rows":results},prerequisite_refs=tuple(dict.fromkeys(missing)),examined_count=count,
        domain_complete=not missing and not frontier,computation_bound_reached=bool(frontier),frontier=frontier)


def _access(request):
    crate=next((c for c in request.state.crates if c.crate_ref==request.intended_push.crate_ref),None)
    if crate is None:return family_result(request,prerequisite_refs=("bound_crate_occurrence",),domain_complete=False)
    support=_add(crate.position,request.intended_push.direction,-1)
    word,component,count,cut,blockers=_walk(request.terrain,request.state,support,request.maximum_evaluations)
    model=_model(request);bindings={c.direction:c for c in model.commands} if model else {}
    commands=tuple(bindings[d] for d in word if d in bindings) if word is not None else ()
    missing=("grounded_walk_input_bindings",) if word is not None and len(commands)!=len(word) else ()
    return family_result(request,values={"pushing_support":support,"reachable_component":component,"approach_directions":word,
        "actual_approach_commands":commands,"blockers":blockers,"support_reachable":word is not None,"crate_dead_square_is_actor_wall":False},
        prerequisite_refs=missing,examined_count=count,domain_complete=not cut and not missing,computation_bound_reached=cut,
        frontier={"actor_reached_cells":component,"destination":support} if cut else {})


def _inverse(terrain,model,bound):
    cells=set(terrain.walkable);domains=[];count=0;frontier={}
    for ti,target in enumerate(terrain.targets):
        distances={target.position:0};queue=deque([target.position])
        while queue:
            if count>=bound:frontier={"target_index":ti,"pending_cells":tuple(queue),"partial_distances":tuple(sorted(distances.items()))};break
            p=queue.popleft();count+=1
            for d in CARDINALS:
                old=_add(p,d,-model.push_distance);support=_add(old,d,-1)
                receiving=tuple(_add(old,d,i) for i in range(1,model.push_distance+1))
                if old in cells and support in cells and all(q in cells for q in receiving) and old not in distances:distances[old]=distances[p]+1;queue.append(old)
        domains.append({"target_ref":target.target_ref,"target_position":target.position,"distances":tuple(sorted(distances.items())),"complete":not frontier})
        if frontier:break
    return domains,count,frontier


def _assignment(terrain,state,domains,bound,maximum_states):
    """Distinct crate per required target; exact relaxed matching, never a route."""
    if len(domains)!=len(terrain.targets) or any(not row["complete"] for row in domains):return {"matching_complete":False,"missing_inverse_domains":True},0,{}
    if terrain.all_crates_required and len(state.crates)!=len(terrain.targets):return {"matching_complete":True,"relaxed_assignment_impossible":True,"count_mismatch":True},0,{}
    distance={row["target_ref"]:dict(row["distances"]) for row in domains};target_positions={t.target_ref:t.position for t in terrain.targets}
    edges=tuple(tuple((i,0 if crate.fixed else distance[t.target_ref][crate.position]) for i,crate in enumerate(state.crates)
        if t.target_ref in crate.compatible_target_refs and crate.position in distance[t.target_ref] and (not crate.fixed or crate.position==t.position)) for t in terrain.targets)
    layer={0:(0,())};count=0
    for ti,target in enumerate(terrain.targets):
        following={}
        for mask,(cost,assignment) in sorted(layer.items()):
            for ci,distance_cost in edges[ti]:
                if count>=bound:return {"matching_complete":False,"candidate_assignments":tuple(layer.values())},count,{"target_index":ti,"mask":mask,"partial_matching_layer":tuple(sorted(layer.items()))}
                count+=1
                if mask&(1<<ci):continue
                nextmask=mask|(1<<ci);candidate=(cost+distance_cost,assignment+((target.target_ref,state.crates[ci].crate_ref),))
                if nextmask not in following and len(following)>=maximum_states:return {"matching_complete":False},count,{"target_index":ti,"reason":"matching_state_bound","partial_matching_layer":tuple(sorted(following.items()))}
                if nextmask not in following or candidate[0]<following[nextmask][0]:following[nextmask]=candidate
        layer=following
        if not layer:return {"matching_complete":True,"relaxed_assignment_impossible":True,"first_unmatched_target_index":ti,"edges":edges},count,{}
    best=min(layer.values(),default=(0,()),key=lambda row:row[0])
    return {"matching_complete":True,"relaxed_assignment_impossible":False,"minimum_relaxed_pushes":best[0],"assignment":best[1],
        "dynamically_executable_proved":False,"crate_identity_permanently_acquired":False},count,{}


def _static(request,assignment=False):
    model=_model(request);domains,count,frontier=_inverse(request.terrain,model,request.maximum_evaluations)
    values={"inverse_domains":domains,"static_terrain_complete":request.terrain.topology_complete,"necessary_not_sufficient":True}
    if assignment and not frontier:
        result,visits,frontier=_assignment(request.terrain,request.state,domains,request.maximum_evaluations-count,request.maximum_states);count+=visits;values.update(result)
    missing=() if request.terrain.topology_complete else ("complete_static_terrain_for_exclusion_or_lower_bound",)
    return family_result(request,values=values,prerequisite_refs=missing,examined_count=count,domain_complete=not frontier and not missing,
        computation_bound_reached=bool(frontier),frontier=frontier)


def _frozen(request):
    cells=set(request.terrain.walkable);remaining={c.position:c for c in request.state.crates};count=0;cut=False
    while remaining:
        removed=[]
        for p,crate in sorted(remaining.items()):
            if count>=request.maximum_evaluations:cut=True;break
            count+=1
            if crate.fixed:continue
            for d in CARDINALS:
                support=_add(p,d,-1);receiving=tuple(_add(p,d,i) for i in range(1,_model(request).push_distance+1))
                if support in cells and support not in remaining and all(q in cells and q not in remaining for q in receiving):removed.append(p);break
        if cut or not removed:break
        for p in removed:remaining.pop(p)
    target_at={t.position:t for t in request.terrain.targets};bad=tuple(c.crate_ref for p,c in sorted(remaining.items()) if p not in target_at or target_at[p].target_ref not in c.compatible_target_refs)
    certificate=bool(bad) and request.terrain.all_crates_required and request.terrain.topology_complete and not cut
    values={"joint_frozen_crate_refs":tuple(c.crate_ref for p,c in sorted(remaining.items())),
        "off_compatible_target_frozen_refs":bad,"sound_deadlock_certificate":certificate,
        "certificate_scope":"all_crates_required_static_push_only" if certificate else "UNKNOWN",
        "absence_of_certificate_is_safe":False,"mutual_support_obstruction_considered":True}
    frontier={"remaining_frozen_candidates":tuple(remaining)} if cut else {};missing=()
    if request.exhaust_small_deadlock_domain is True and not certificate and not cut:
        if request.metric is None:missing=("explicit_small_domain_cost_metric",)
        elif count>=request.maximum_evaluations:cut=True;frontier={"phase":"small_joint_domain","next_state_index":0}
        else:
            bounded=request.model_copy(update={"maximum_evaluations":request.maximum_evaluations-count})
            nodes,edges,wins,cuts,visits,missing=_search(bounded);count+=visits;cut=bool(cuts)
            exhausted=not cuts and not missing and not wins and request.terrain.topology_complete and request.scope.input_domain_complete and _model(request).exhaustion_outcome!="RESTORE"
            values.update({"joint_domain_state_count":len(nodes),"joint_domain_exhausted_without_completion":exhausted,
                "sound_deadlock_certificate":exhausted,"certificate_scope":"exact_actor_crates_budget_no_restore_under_bound_model" if exhausted else "UNKNOWN"})
            if cuts:frontier={"cuts":cuts,"retained_nodes":nodes,"retained_edges":tuple((i,tuple(v)) for i,v in sorted(edges.items()))}
    return family_result(request,values=values,prerequisite_refs=missing,examined_count=count,
        domain_complete=not cut and not missing,computation_bound_reached=cut,frontier=frontier)


def _key(state):
    # Clock is a receipt; this declared push model has no clock-dependent law.
    return (state.actor,tuple((c.crate_ref,c.position,c.fixed,c.compatible_target_refs) for c in state.crates),state.remaining_budget,state.status,state.level_scope_ref,state.restore_epoch)


def _search(request):
    terrain=request.terrain;model=_model(request);initial=request.state;nodes=[(initial,None,0,0,None)];seen={_key(initial):0};queue=[(0,0)];edges={};wins=[];cuts=[];count=0;closed=set();missing=[]
    while queue:
        priority,index=heappop(queue);state,parent,pushes,depth,via=nodes[index]
        expected_priority=depth if request.metric=="EXTERNAL_COMMANDS" else pushes
        if index in closed or priority!=expected_priority:continue
        if seen.get(_key(state))!=index:continue
        closed.add(index)
        if (state.level_scope_ref,state.restore_epoch)!=(initial.level_scope_ref,initial.restore_epoch):continue
        if state.status=="WIN" and _complete(terrain,state):wins.append(index);continue
        if state.status!="ACTIVE" or (state.level_scope_ref,state.restore_epoch)!=(initial.level_scope_ref,initial.restore_epoch):continue
        if depth>=request.maximum_depth:cuts.append({"node_index":index,"reason":"depth_bound"});continue
        for ci,command in enumerate(model.commands):
            work=max(1,len(state.crates))
            if count+work>request.maximum_evaluations:cuts.append({"node_index":index,"next_command_index":ci,"reason":"evaluation_bound"});queue=[];break
            count+=work;after,applied,pushed,debt,reason=_step(terrain,state,model,command);missing.extend(debt)
            if not applied or debt:continue
            nextpushes=pushes+int(pushed);metric=depth+1 if request.metric=="EXTERNAL_COMMANDS" else nextpushes;key=_key(after);old=seen.get(key)
            if old is not None:
                oldnode=nodes[old];oldmetric=oldnode[3] if request.metric=="EXTERNAL_COMMANDS" else oldnode[2]
                if oldmetric<=metric:edges.setdefault(index,[]).append((old,command.input_ref));continue
            if len(nodes)>=request.maximum_states:cuts.append({"node_index":index,"input_ref":command.input_ref,"reason":"state_bound"});continue
            child=len(nodes);nodes.append((after,index,nextpushes,depth+1,command.input_ref));seen[key]=child;edges.setdefault(index,[]).append((child,command.input_ref));heappush(queue,(metric,child))
    return nodes,edges,wins,cuts,count,tuple(dict.fromkeys(missing))


def _push_predecessor_word_d(nodes,index,remaining):
    word=[];work=0
    while nodes[index][1] is not None:
        work+=1
        if work>remaining:return None,work
        word.append(nodes[index][4]);index=nodes[index][1]
    return tuple(reversed(word)),work


def _domain(request,parking=False):
    nodes,edges,wins,cuts,count,missing=_search(request);values={"metric":request.metric,"state_projection":"exact_actor_crates_budget_scope; clock-independent supplied law",
        "state_count":len(nodes),"clock_quotient_requires_supplied_clock_independent_law":True,"minimum_pushes_is_minimum_commands":False,"conditional_on_model_ref":request.bound_model_ref}
    if parking:
        reverse={}
        for parent,children in sorted(edges.items()):
            for child,command in children:
                if count>=request.maximum_evaluations:
                    return family_result(request,values=values,examined_count=count,domain_complete=False,
                        computation_bound_reached=True,frontier={'phase':'parking_reverse_graph','parent_node':parent})
                count+=1;reverse.setdefault(child,[]).append((parent,command))
        next_to_win={i:None for i in wins};queue=deque(wins)
        while queue:
            child=queue.popleft()
            for parent,command in reverse.get(child,()):
                if count>=request.maximum_evaluations:
                    return family_result(request,values=values,examined_count=count,domain_complete=False,
                        computation_bound_reached=True,frontier={'phase':'parking_completion_preimage','child_node':child})
                count+=1
                if parent not in next_to_win:next_to_win[parent]=(child,command);queue.append(parent)
        candidates=[];old_occupied=set(ref for ref,crate in _occupancy(request.terrain,request.state))
        original_crate=next((c for c in request.state.crates if c.crate_ref==request.intended_push.crate_ref),None)
        if original_crate is None:return family_result(request,prerequisite_refs=("bound_required_push_crate_occurrence",),domain_complete=False)
        for index,(state,parent,pushes,depth,via) in enumerate(nodes):
            if index not in next_to_win or state.status!="ACTIVE":continue
            crate=next((c for c in state.crates if c.crate_ref==request.intended_push.crate_ref),None)
            if crate is None or crate.position!=original_crate.position or crate.fixed:continue
            receiving=tuple(_add(crate.position,request.intended_push.direction,i) for i in range(1,_model(request).push_distance+1))
            if any(p not in request.terrain.walkable or p in {c.position for c in state.crates} for p in receiving):continue
            support=_add(crate.position,request.intended_push.direction,-1)
            approach,component,visits,cut,blockers=_walk(request.terrain,state,support,max(0,request.maximum_evaluations-count),False);count+=visits
            if cut:cuts.append({"node_index":index,"reason":"parking_support_bound"});break
            if approach is None:continue
            cursor=index;visited=set();replayed=state;replay_ok=True;bindings={c.input_ref:c for c in _model(request).commands}
            while next_to_win[cursor] is not None and cursor not in visited:
                visited.add(cursor);cursor,command_ref=next_to_win[cursor]
                work=max(1,len(replayed.crates))
                if count+work>request.maximum_evaluations:cuts.append({"node_index":index,"reason":"parking_suffix_replay_bound"});replay_ok=False;break
                count+=work;before=replayed;replayed,applied,pushed,debt,reason=_step(request.terrain,replayed,_model(request),bindings[command_ref])
                if not applied or debt or (replayed.level_scope_ref,replayed.restore_epoch)!=(before.level_scope_ref,before.restore_epoch):replay_ok=False;break
            if not replay_ok:continue
            if cursor not in wins or replayed.status!="WIN" or not _complete(request.terrain,replayed):continue
            occupancy=_occupancy(request.terrain,state);debt=tuple(sorted(old_occupied-set(ref for ref,owner in occupancy)))
            if depth==0:continue
            word,work=_push_predecessor_word_d(nodes,index,request.maximum_evaluations-count)
            if word is None:cuts.append({'node_index':index,'reason':'parking_prefix_reconstruction_bound'});break
            count+=work
            approach,component,visits,cut,blockers=_walk(request.terrain,state,support,max(0,request.maximum_evaluations-count));count+=visits
            if cut:cuts.append({'node_index':index,'reason':'parking_approach_reconstruction_bound'});break
            suffix=[];cursor=index;suffix_cut=False
            while next_to_win[cursor] is not None:
                if count>=request.maximum_evaluations:
                    cuts.append({'node_index':index,'reason':'parking_suffix_reconstruction_bound'});suffix_cut=True;break
                count+=1;cursor,command_ref=next_to_win[cursor];suffix.append(command_ref)
            if suffix_cut:break
            candidates.append({"parking_state":state,"actual_approach_word":word,"newly_accessible_push_support":support,
                "support_walk_directions":approach,"target_occupancy_restoration_debt":debt,"actual_completion_suffix":tuple(suffix),
                "complete_replacement_assignment":_occupancy(request.terrain,replayed),"completion_after_state":replayed,
                "original_crate_identity_restoration_required":False})
            if len(candidates)>=request.maximum_witnesses:break
        values["parking_candidates"]=candidates
    else:
        witnesses=[]
        for i in wins[:request.maximum_witnesses]:
            word,work=_push_predecessor_word_d(nodes,i,request.maximum_evaluations-count)
            if word is None:cuts.append({'node_index':i,'reason':'completion_word_reconstruction_bound'});break
            count+=work;witnesses.append({"command_word":word,"push_count":nodes[i][2],"external_command_count":nodes[i][3],"after_state":nodes[i][0]})
        values["completion_witnesses"]=tuple(witnesses)
        values["minimum_cost_proved_under_supplied_model"]=bool(wins) and not cuts and not missing and request.scope.input_domain_complete and request.terrain.topology_complete
    return family_result(request,values=values,prerequisite_refs=missing,examined_count=count,domain_complete=not cuts and not missing,
        computation_bound_reached=bool(cuts),frontier={"cuts":cuts,"retained_nodes":nodes,"retained_edges":tuple((i,tuple(v)) for i,v in sorted(edges.items()))} if cuts else {})


def _compile(request):
    model=_model(request);state=request.state;commands={c.input_ref:c for c in model.commands};directions={c.direction:c for c in model.commands};word=[];trace=[];count=0;pushes=0;missing=[];frontier={}
    proposals=[]
    if request.command_word is not None:proposals=[("INPUT",ref) for ref in request.command_word]
    elif request.push_macros is not None:proposals=[("PUSH",macro) for macro in request.push_macros]
    else:return family_result(request,prerequisite_refs=("actual_command_word_or_push_macros",),domain_complete=False)
    for pi,(kind,proposal) in enumerate(proposals):
        if state.status!="ACTIVE":frontier={"next_proposal_index":pi,"reason":"authoritative_terminal_interruption"};break
        if kind=="PUSH":
            crate=next((c for c in state.crates if c.crate_ref==proposal.crate_ref),None)
            if crate is None:missing.append("bound_macro_crate_occurrence");break
            support=_add(crate.position,proposal.direction,-1);approach,component,visits,cut,blockers=_walk(request.terrain,state,support,max(0,request.maximum_evaluations-count));count+=visits
            if cut:frontier={"next_proposal_index":pi,"reason":"macro_support_search_bound"};break
            if approach is None:missing.append("reachable_macro_pushing_support");break
            if any(d not in directions for d in approach+(proposal.direction,)):missing.append("grounded_macro_walk_and_push_bindings");break
            expanded=tuple(directions[d] for d in approach+(proposal.direction,))
        else:
            if proposal not in commands:missing.append("grounded_actual_input_ref");break
            expanded=(commands[proposal],)
        for ei,command in enumerate(expanded):
            work=max(1,len(state.crates))
            if count+work>request.maximum_evaluations:frontier={"next_proposal_index":pi,"next_expanded_input_index":ei,"reason":"evaluation_bound"};break
            count+=work;before=state;state,applied,pushed,debt,reason=_step(request.terrain,state,model,command);missing.extend(debt)
            if not applied:missing.append(reason);break
            word.append(command);pushes+=int(pushed);trace.append({"before":before,"command":command,"after":state,"pushed":pushed,"reason":reason,
                "charged_cost":command.accepted_cost if reason in ("free_walk","one_crate_push") else command.blocked_cost})
            if kind=="PUSH" and ei==len(expanded)-1 and not pushed:missing.append("macro_push_not_realized")
            if state.status!="ACTIVE" or state.restore_epoch!=before.restore_epoch:
                if ei+1<len(expanded) or pi+1<len(proposals):frontier={"next_proposal_index":pi+1,"unexecuted_expanded_input_refs":tuple(c.input_ref for c in expanded[ei+1:]),"reason":"authoritative_terminal_interruption"}
                break
        if missing or frontier or state.restore_epoch!=request.state.restore_epoch:break
    actual=request.actual_outcome
    actual_sealed=actual is not None and actual.sealed and actual.event_owner_ref==request.scope.event_owner_ref and actual.epoch==request.scope.epoch
    actual_crates={c.crate_ref:c for c in actual.after.crates} if actual_sealed else {};predicted_crates={c.crate_ref:c for c in state.crates}
    observed_differences=tuple(ref for ref in actual.observed_crate_refs if ref not in actual_crates or ref not in predicted_crates or actual_crates[ref].position!=predicted_crates[ref].position) if actual_sealed else ()
    resource_mismatch=actual_sealed and actual.resources_observed and any(getattr(actual.after,name)!=getattr(state,name) for name in ("remaining_budget","input_tick","status","restore_epoch","level_scope_ref"))
    mismatch=actual_sealed and (bool(observed_differences) or actual.actor_observed and actual.after.actor!=state.actor or resource_mismatch)
    return family_result(request,values={"actual_command_word":word,"trace":trace,"after_state":state,"external_command_count":len(word),
        "push_count":pushes,"actual_budget_cost":sum(row["charged_cost"] for row in trace),
        "expected_state_matches":None if request.expected_state is None else state==request.expected_state,
        "official_outcome_observed":actual_sealed and actual.resources_observed,"official_prediction_mismatch":mismatch,
        "observed_crate_mismatch_refs":observed_differences,
        "simultaneous_target_occupancy":_occupancy(request.terrain,state),"completion_model_predicted":state.status=="WIN"},
        prerequisite_refs=tuple(dict.fromkeys(missing)),examined_count=count,domain_complete=not missing and not frontier,
        computation_bound_reached=frontier.get("reason") in ("evaluation_bound","macro_support_search_bound"),frontier=frontier)


def measure_push_only_logistics(request: PushRequest) -> MechanicalFamilyResult:
    if request.mode is None or OPERATION_MODES.get(request.operation_ref)!=request.mode:return family_result(request,signature_supported=False,domain_complete=False)
    required={"board_layers":("raw_layer_pixels","layer_templates","lattice_candidates","remembered_targets","level_scope_ref","grid_input"),
        "push_law_fit":("terrain","models","observations"),"actor_access":("terrain","state","intended_push"),
        "push_successor":("terrain","state","models","bound_model_ref","input_ref"),"inverse_crate_domains":("terrain","models","bound_model_ref"),
        "assignment_bound":("terrain","state","models","bound_model_ref"),"dynamic_deadlock":("terrain","state","models","bound_model_ref"),
        "push_route_domain":("terrain","state","models","bound_model_ref","metric"),
        "parking_reassignment":("terrain","state","models","bound_model_ref","metric","intended_push"),
        "push_word_certificate":("terrain","state","models","bound_model_ref")}
    missing=missing_supplied_fields(request,required[request.operation_ref])
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    op=request.operation_ref
    if op=="board_layers":return _layers(request)
    if request.state is not None and not _state_valid(request.terrain,request.state):return family_result(request,prerequisite_refs=("current_actor_crates_and_target_compatibility_in_bound_terrain",),domain_complete=False)
    if op=="push_law_fit":return _fit(request)
    if op=="actor_access":return _access(request)
    model=_model(request)
    if model is None:return family_result(request,prerequisite_refs=("bound_whole_push_model",),domain_complete=False)
    if op in ("inverse_crate_domains","assignment_bound"):return _static(request,op=="assignment_bound")
    if op=="dynamic_deadlock":return _frozen(request)
    if op in ("push_route_domain","parking_reassignment"):return _domain(request,op=="parking_reassignment")
    if op=="push_word_certificate":return _compile(request)
    command=next((c for c in model.commands if c.input_ref==request.input_ref),None)
    if command is None:return family_result(request,prerequisite_refs=("grounded_actual_push_input",),domain_complete=False)
    if max(1,len(request.state.crates))>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={"next_crate_index":0})
    after,applied,pushed,missing,reason=_step(request.terrain,request.state,model,command)
    return family_result(request,values={"after_state":after,"primitive_applied":applied,"crate_pushed":pushed,"reason":reason,
        "external_command_count":int(applied),"actual_cost":(command.accepted_cost if reason in ("free_walk","one_crate_push") else command.blocked_cost) if applied else 0,
        "before_occupancy":_occupancy(request.terrain,request.state),"after_occupancy":_occupancy(request.terrain,after),
        "event_owner_ref":request.scope.event_owner_ref,"future_solvability_proved":False},prerequisite_refs=missing,examined_count=max(1,len(request.state.crates)))
