"""Caller-bound ordered programs; editing is distinct from owned execution.

Native handlers retain complete actor stacks and copy each turn at its own
boundary. Source/DRM owns operation selection, interpretation and ACT release.
"""
from collections import deque
from heapq import heappop, heappush
from typing import Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, FrozenMap, Ref
from .mechanical_family_contracts_a import MechanicalFamilyScope, MechanicalFamilyResult, family_result, missing_supplied_fields, with_implementation_debt
from .mutable_kit_survival import KitEventTrace as ProgramEventTrace
from .identity_contact_authentication import ContactPixel, ContactLayerTemplate, ContactLayerSample, _candidate_layers as translated_layers
from agents.yf_arc3_v5.logos.types import immutable_json_data


class ProgramCell(FrozenModel):
    cell_ref: Ref
    x: int
    y: int
    terrain: Literal['SUPPORT','HOLE','EDIT_SUPPORT','BLOCKED','UNKNOWN']


class ProgramCard(FrozenModel):
    occurrence_ref: Ref
    instruction_ref: Ref
    removal_input_ref: Ref | None = None
    removal_action_ref: Ref | None = None
    removal_payload: FrozenMap | None = None


class ProgramActor(FrozenModel):
    actor_ref: Ref
    role: Literal['BENEFICIARY','ADVERSARY','NEUTRAL']
    x: int
    y: int
    alive: bool
    program: tuple[ProgramCard,...] = Field(max_length=128)
    @model_validator(mode='after')
    def occurrences(self):
        if len({c.occurrence_ref for c in self.program})!=len(self.program):raise ValueError('duplicate glyphs retain distinct card occurrences')
        return self


class ProgramState(FrozenModel):
    board: tuple[ProgramCell,...] = Field(max_length=4096)
    actors: tuple[ProgramActor,...] = Field(max_length=128)
    beneficiary_ref: Ref
    initiative: tuple[Ref,...] = Field(max_length=128)
    executing_actor_ref: Ref | None = None
    copied_program: tuple[ProgramCard,...] = Field(default=(),max_length=128)
    instruction_cursor: int = Field(default=0,ge=0,le=128)
    remaining_budget: int = Field(ge=0,le=65536)
    level_scope_ref: Ref
    restore_epoch: int = Field(ge=0)
    status: Literal['ACTIVE','WIN','LOCAL_STOP','GAME_OVER']
    @model_validator(mode='after')
    def identity(self):
        if len({a.actor_ref for a in self.actors})!=len(self.actors):raise ValueError('one current state per actor')
        if len({(c.x,c.y) for c in self.board})!=len(self.board):raise ValueError('one terrain per logical cell')
        if len({c.cell_ref for c in self.board})!=len(self.board):raise ValueError('distinct logical cell identities')
        cards=tuple(c.occurrence_ref for a in self.actors for c in a.program)
        if len(set(cards))!=len(cards):raise ValueError('physical card occurrences belong to one current actor')
        if self.beneficiary_ref not in {a.actor_ref for a in self.actors}:raise ValueError('beneficiary belongs to current actors')
        if any(ref not in {a.actor_ref for a in self.actors} for ref in self.initiative):raise ValueError('initiative names current actors')
        if self.instruction_cursor>len(self.copied_program):raise ValueError('cursor belongs to the copied current turn')
        if len(set(self.initiative))!=len(self.initiative):raise ValueError('one declared actor turn per activation')
        return self


class ProgramInstruction(FrozenModel):
    instruction_ref: Ref
    kind: Literal['MOVE','ATTACK','RADIAL_PUSH','NO_EFFECT','UNKNOWN']
    dx: int = 0
    dy: int = 0
    recipient_offsets: tuple[tuple[int,int],...] = Field(default=(),max_length=128)
    recipient_roles: tuple[Literal['BENEFICIARY','ADVERSARY','NEUTRAL'],...] = Field(default=(),max_length=3)
    evidence_ref: Ref | None = None


class ProgramAddition(FrozenModel):
    instruction_ref: Ref
    input_ref: Ref
    action_ref: Ref
    payload: FrozenMap
    available: bool


class ProgramModel(FrozenModel):
    model_ref: Ref
    instructions: tuple[ProgramInstruction,...] = Field(max_length=128)
    capacity: int = Field(ge=0,le=128)
    additions: tuple[ProgramAddition,...] = Field(max_length=128)
    insertion: Literal['APPEND','PREPEND','UNKNOWN']
    deletion: Literal['ARBITRARY_OCCURRENCE','TOP_ONLY','UNKNOWN']
    execution_order: Literal['STORED','REVERSED','UNKNOWN']
    edit_supports_required: bool
    edit_ticks_autonomous: bool
    add_cost: int = Field(ge=0,le=65536)
    remove_cost: int = Field(ge=0,le=65536)
    launch_cost: int = Field(ge=0,le=65536)
    outside_board: Literal['BLOCK','LETHAL','UNKNOWN']
    movement_collision: Literal['BLOCK','UNKNOWN']
    empty_program_after_edit: Literal['ALIVE','DEAD','UNKNOWN']
    empty_program_after_damage: Literal['ALIVE','DEAD','UNKNOWN']
    instruction_interruption: Literal['ON_EXECUTING_ACTOR_DEATH','ON_BENEFICIARY_DEATH','UNKNOWN']
    exhausted_budget: Literal['LOCAL_STOP','GAME_OVER','UNKNOWN']
    terminal_before_exhaustion: bool
    reset_state: ProgramState | None = None
    top_card: Literal['FIRST','LAST','UNKNOWN']
    hole_entry: Literal['LETHAL','BLOCK','UNKNOWN']
    push_hole_entry: Literal['LETHAL','BLOCK','UNKNOWN']
    push_collision: Literal['BLOCK','UNKNOWN']
    push_order: Literal['SIMULTANEOUS','ACTOR_ORDER','UNKNOWN']
    push_displacement: Literal['OFFSET','UNIT_SIGN','UNKNOWN']
    refusal_cost: Literal['NO_DEBIT','DECLARED_EDIT_COST','UNKNOWN']
    refused_edit_ticks: Literal['NONE','AS_ACCEPTED','UNKNOWN']
    edit_tick_actor_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    beneficiary_failure: Literal['GAME_OVER','RESTORE_DECLARED','UNKNOWN']
    @model_validator(mode='after')
    def maps(self):
        if len({x.instruction_ref for x in self.instructions})!=len(self.instructions):raise ValueError('distinct supplied instruction effect alternatives per model')
        if len({x.instruction_ref for x in self.additions})!=len(self.additions):raise ValueError('one grounded palette mapping per instruction')
        return self


class ProgramEdit(FrozenModel):
    actor_ref: Ref
    kind: Literal['ADD','REMOVE']
    card: ProgramCard
    input_ref: Ref
    action_ref: Ref
    payload: FrozenMap


class ProgramLayerTemplate(ContactLayerTemplate):
    component: Literal['CELL','HOLE','EDIT_SUPPORT','BODY','STACK_CARD','PALETTE_CARD','UNKNOWN']
    logical_x: int | None = None
    logical_y: int | None = None
    stack_ordinal: int | None = Field(default=None,ge=0,le=128)
    instruction_candidate_ref: Ref | None = None
    logical_projection_evidence_ref: Ref | None = None
    @model_validator(mode='after')
    def logical_calibration(self):
        if self.logical_projection_evidence_ref is not None and (self.logical_x is None or self.logical_y is None):raise ValueError('calibrated logical projection supplies both logical axes')
        return self


class ProgramObservation(FrozenModel):
    observation_ref: Ref
    input_ref: Ref
    kind: Literal['EDIT','INSTRUCTION','LAUNCH']
    before: ProgramState
    after: ProgramState
    event_owner_ref: Ref
    epoch: int = Field(ge=0)
    sealed: bool
    actor_ref: Ref | None = None
    instruction_ref: Ref | None = None
    edit: ProgramEdit | None = None
    trace: ProgramEventTrace | None = None


class ProgramRequest(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.editable_actor_program_request.v1'
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None = None
    maximum_evaluations: int = Field(ge=1,le=65536)
    maximum_states: int = Field(ge=1,le=4096)
    maximum_depth: int = Field(ge=0,le=256)
    maximum_witnesses: int = Field(default=3,ge=1,le=3)
    state: ProgramState | None = None
    models: tuple[ProgramModel,...] = Field(default=(),max_length=128)
    bound_model_ref: Ref | None = None
    actor_ref: Ref | None = None
    desired_program: tuple[Ref,...] | None = Field(default=None,max_length=128)
    edit: ProgramEdit | None = None
    expected_state: ProgramState | None = None
    actual_state: ProgramState | None = None
    expected_trace: ProgramEventTrace | None = None
    actual_trace: ProgramEventTrace | None = None
    instruction_ref: Ref | None = None
    observations: tuple[ProgramObservation,...] = Field(default=(),max_length=256)
    candidate_edits: tuple[ProgramEdit,...] = Field(default=(),max_length=256)
    preimage_states: tuple[ProgramState,...] = Field(default=(),max_length=4096)
    target_removed_refs: tuple[Ref,...] = Field(default=(),max_length=128)
    future_edit_consumer_ref: Ref | None = None
    raw_layer_pixels: tuple[ContactPixel,...] = Field(default=(),max_length=65536)
    layer_templates: tuple[ProgramLayerTemplate,...] = Field(default=(),max_length=4096)
    layer_samples: tuple[ContactLayerSample,...] = Field(default=(),max_length=4096)
    launch_input_ref: Ref | None = None
    launch_action_ref: Ref | None = None
    launch_payload: FrozenMap | None = None
    @model_validator(mode='after')
    def distinct_bound_models(self):
        if len({m.model_ref for m in self.models})!=len(self.models):raise ValueError('bound model references identify distinct alternatives')
        if len({t.template_ref for t in self.layer_templates})!=len(self.layer_templates):raise ValueError('distinct physical template alternatives')
        return self


OPERATION_MODES={'isometric_program_layers':'MEASURE','edit_protocol_fit':'FIT','instruction_fit':'FIT','local_program_edit':'STEP',
    'instruction_effect':'STEP_INTERNAL','actor_turn_copy':'STEP_INTERNAL','program_launch':'STEP','combat_preimages':'INVERSE_DOMAIN',
    'edit_distance':'DOMAIN','program_composition_domain':'DOMAIN','program_compare':'COMPARE'}


def _actor(state,ref):return next((a for a in state.actors if a.actor_ref==ref),None)


def _same_program_state(a,b):
    return {(c.x,c.y):c for c in a.board}=={(c.x,c.y):c for c in b.board} and all(getattr(a,n)==getattr(b,n) for n in type(a).model_fields if n!='board')


def _replace_actor(state,actor):
    return state.model_copy(update={'actors':tuple(actor if a.actor_ref==actor.actor_ref else a for a in state.actors)})


def _cell(state,x,y):return next((c for c in state.board if c.x==x and c.y==y),None)


def _destination(state,model,x,y,push=False):
    cell=_cell(state,x,y)
    if cell is None:return model.outside_board,()
    if cell.terrain=='UNKNOWN':return 'UNKNOWN',('current_destination_terrain',)
    if cell.terrain=='BLOCKED':return 'BLOCK',()
    if cell.terrain=='HOLE':return model.push_hole_entry if push else model.hole_entry,()
    return 'MOVE',()


def _instruction(state,model,actor_ref,instruction_ref,maximum,allow_hypothetical=False):
    actor=_actor(state,actor_ref);instruction=next((i for i in model.instructions if i.instruction_ref==instruction_ref),None)
    work=len(state.actors)+len(state.board)+len(model.instructions)
    if work>maximum:return state,(),(),0,{'phase':'instruction_context','actor_ref':actor_ref}
    if actor is None or not actor.alive:return state,(),('living_executing_actor',),work,{}
    if instruction is None or instruction.kind=='UNKNOWN' or instruction.evidence_ref is None and not allow_hypothetical:return state,(),('supported_current_instruction.'+instruction_ref,),work,{}
    before=state;events=[];debt=();current=state
    if instruction.kind=='MOVE':
        x,y=actor.x+instruction.dx,actor.y+instruction.dy;outcome,debt=_destination(state,model,x,y)
        if debt or outcome=='UNKNOWN':return state,(),debt or ('current_outside_or_hole_entry_law',),work,{}
        occupied=any(a.alive and a.actor_ref!=actor_ref and (a.x,a.y)==(x,y) for a in state.actors)
        if occupied:
            if model.movement_collision=='UNKNOWN':return state,(),('current_movement_collision_law',),work,{}
            outcome='BLOCK'
        if outcome=='MOVE':current=_replace_actor(state,actor.model_copy(update={'x':x,'y':y}))
        elif outcome=='LETHAL':current=_replace_actor(state,actor.model_copy(update={'x':x,'y':y,'alive':False}))
        events.append({'kind':'MOVE','actor_ref':actor_ref,'instruction_ref':instruction_ref,'destination':(x,y),'outcome':outcome,'collision_is_push':False})
    elif instruction.kind=='ATTACK':
        if model.top_card=='UNKNOWN':return state,(),('current_damage_top_card_order',),work,{}
        recipients=tuple(a for a in state.actors if a.alive and a.actor_ref!=actor_ref and a.role in instruction.recipient_roles and (a.x-actor.x,a.y-actor.y) in instruction.recipient_offsets)
        for recipient_index,recipient in enumerate(recipients):
            recipient_work=len(current.actors)+len(recipient.program)
            if work+recipient_work>maximum:return current,tuple(events),(),work,{'phase':'attack_recipients','next_recipient_index':recipient_index}
            work+=recipient_work
            if not recipient.program:events.append({'kind':'ATTACK_EMPTY','actor_ref':actor_ref,'recipient_ref':recipient.actor_ref});continue
            if len(recipient.program)==1 and model.empty_program_after_damage=='UNKNOWN':return current,tuple(events),('last_damage_card_lifecycle',),work,{}
            index=0 if model.top_card=='FIRST' else len(recipient.program)-1;removed=recipient.program[index];remaining=recipient.program[:index]+recipient.program[index+1:]
            changed=recipient.model_copy(update={'program':remaining,'alive':recipient.alive and (bool(remaining) or model.empty_program_after_damage=='ALIVE')})
            current=_replace_actor(current,changed);events.append({'kind':'ATTACK_REMOVE','actor_ref':actor_ref,'recipient_ref':recipient.actor_ref,'removed_occurrence':removed,'alive':changed.alive,'copied_turn_program_changed':False})
    elif instruction.kind=='RADIAL_PUSH':
        if model.push_order=='UNKNOWN' or model.push_displacement=='UNKNOWN':return state,(),('current_radial_push_order_and_vector',),work,{}
        recipients=tuple(a for a in state.actors if a.alive and a.actor_ref!=actor_ref and a.role in instruction.recipient_roles and (a.x-actor.x,a.y-actor.y) in instruction.recipient_offsets)
        proposals=[]
        for index,recipient in enumerate(recipients):
            context=state if model.push_order=='SIMULTANEOUS' else current
            dx,dy=recipient.x-actor.x,recipient.y-actor.y
            if model.push_displacement=='UNIT_SIGN':dx=(dx>0)-(dx<0);dy=(dy>0)-(dy<0)
            x,y=recipient.x+dx,recipient.y+dy;outcome,debt=_destination(context,model,x,y,True)
            work+=len(context.board)+len(context.actors)
            if work>maximum:return current,tuple(events),(),work-len(context.board)-len(context.actors),{'phase':'radial_push','next_recipient_index':index}
            if debt or outcome=='UNKNOWN':return current,tuple(events),debt or ('current_push_hole_or_outside_law',),work,{}
            occupied=any(a.alive and a.actor_ref!=recipient.actor_ref and (a.x,a.y)==(x,y) for a in context.actors)
            if occupied:
                if model.push_collision=='UNKNOWN':return current,tuple(events),('current_push_collision_law',),work,{}
                outcome='BLOCK'
            proposals.append((recipient,x,y,outcome))
            if model.push_order=='ACTOR_ORDER':
                changed=recipient.model_copy(update={'x':x,'y':y,'alive':False}) if outcome=='LETHAL' else recipient.model_copy(update={'x':x,'y':y}) if outcome=='MOVE' else recipient
                current=_replace_actor(current,changed);events.append({'kind':'RADIAL_PUSH','actor_ref':actor_ref,'recipient_ref':recipient.actor_ref,'destination':(x,y),'outcome':outcome})
        if model.push_order=='SIMULTANEOUS':
            destinations=[(x,y) for _,x,y,outcome in proposals if outcome=='MOVE']
            if len(set(destinations))!=len(destinations):return state,(),('simultaneous_push_destination_conflict_law',),work,{}
            for recipient,x,y,outcome in proposals:
                changed=recipient.model_copy(update={'x':x,'y':y,'alive':False}) if outcome=='LETHAL' else recipient.model_copy(update={'x':x,'y':y}) if outcome=='MOVE' else recipient
                current=_replace_actor(current,changed);events.append({'kind':'RADIAL_PUSH','actor_ref':actor_ref,'recipient_ref':recipient.actor_ref,'destination':(x,y),'outcome':outcome})
    else:events.append({'kind':'NO_EFFECT','actor_ref':actor_ref,'instruction_ref':instruction_ref})
    events.append({'kind':'INSTRUCTION_SNAPSHOT','actor_ref':actor_ref,'instruction_ref':instruction_ref,'before':before,'after':current})
    return current,tuple(events),(),work,{}


def _actor_turn(state,model,actor_ref,maximum):
    if state.executing_actor_ref is not None:return state,(),('idle_actor_turn_copy_scope',),0,{}
    actor=_actor(state,actor_ref)
    if actor is None:return state,(),('current_initiative_actor',),0,{}
    if not actor.alive:return state,({'kind':'SKIP_DEAD_TURN','actor_ref':actor_ref},),(),len(state.actors),{}
    if model.execution_order=='UNKNOWN' or model.instruction_interruption=='UNKNOWN':return state,(),('current_program_execution_and_interruption_order',),0,{}
    copied=actor.program if model.execution_order=='STORED' else tuple(reversed(actor.program))
    current=state.model_copy(update={'executing_actor_ref':actor_ref,'copied_program':copied,'instruction_cursor':0});events=[{'kind':'TURN_COPY','actor_ref':actor_ref,'copied_program':copied,'snapshot':current}];count=len(state.actors)+len(copied)
    if count>maximum:return state,(),(),0,{'phase':'turn_copy','actor_ref':actor_ref}
    for index,card in enumerate(copied):
        executing=_actor(current,actor_ref);beneficiary=_actor(current,current.beneficiary_ref)
        if executing is None or not executing.alive or model.instruction_interruption=='ON_BENEFICIARY_DEATH' and (beneficiary is None or not beneficiary.alive):events.append({'kind':'TURN_INTERRUPTED','actor_ref':actor_ref,'next_instruction_index':index});break
        current,trace,debt,work,cut=_instruction(current,model,actor_ref,card.instruction_ref,maximum-count);count+=work;events.extend(trace)
        if debt or cut:return current,tuple(events),debt,count,cut
        current=current.model_copy(update={'instruction_cursor':index+1})
    current=current.model_copy(update={'executing_actor_ref':None,'copied_program':(),'instruction_cursor':0});events.append({'kind':'TURN_SEALED','actor_ref':actor_ref,'after':current})
    return current,tuple(events),(),count,{}


def _terminal(state,model):
    beneficiary=_actor(state,state.beneficiary_ref)
    if beneficiary is None:return state,('current_beneficiary_identity',)
    if not beneficiary.alive:
        if model.beneficiary_failure=='UNKNOWN':return state,('current_beneficiary_failure_lifecycle',)
        if model.beneficiary_failure=='RESTORE_DECLARED':return (model.reset_state,()) if model.reset_state is not None else (state,('declared_program_restore_scope',))
        return state.model_copy(update={'status':'GAME_OVER'}),()
    victory=all(not a.alive for a in state.actors if a.role=='ADVERSARY')
    if victory and (model.terminal_before_exhaustion or state.remaining_budget>0):return state.model_copy(update={'status':'WIN'}),()
    if state.remaining_budget<=0:
        if model.exhausted_budget=='UNKNOWN':return state,('current_program_budget_exhaustion_law',)
        return state.model_copy(update={'status':model.exhausted_budget}),()
    return state,()


def _launch(state,model,maximum):
    if state.status!='ACTIVE' or state.executing_actor_ref is not None:return state,(),('active_idle_program_launch_scope',),0,{}
    if model.launch_cost>state.remaining_budget:return state,(),('funded_program_launch',),0,{}
    current=state.model_copy(update={'remaining_budget':state.remaining_budget-model.launch_cost});events=[{'kind':'LAUNCH_DEBIT','cost':model.launch_cost}];count=0
    order=(state.beneficiary_ref,)+tuple(ref for ref in state.initiative if ref!=state.beneficiary_ref)
    for index,ref in enumerate(order):
        current,trace,debt,work,cut=_actor_turn(current,model,ref,maximum-count);count+=work;events.extend(trace)
        if debt or cut:return current,tuple(events),debt,count,{'next_actor_index':index,**cut} if cut else {}
        beneficiary=_actor(current,current.beneficiary_ref)
        if beneficiary is None or not beneficiary.alive:break
    before_terminal=current;current,debt=_terminal(current,model);events.append({'kind':'COMPLETE_LAUNCH_TERMINAL','before':before_terminal,'after':current,'restoration':model.beneficiary_failure=='RESTORE_DECLARED' and _actor(before_terminal,before_terminal.beneficiary_ref) is not None and not _actor(before_terminal,before_terminal.beneficiary_ref).alive})
    return current,tuple(events),debt,count,{}


def _edit(state,model,edit,maximum):
    actor=_actor(state,edit.actor_ref);cost=model.add_cost if edit.kind=='ADD' else model.remove_cost;work=len(state.actors)+len(state.board)+len(model.additions)+sum(len(a.program) for a in state.actors)+(0 if actor is None else len(actor.program))
    if work>maximum:return state,(),(),0,{'phase':'local_edit_context'}
    if state.status!='ACTIVE' or state.executing_actor_ref is not None or actor is None or not actor.alive:return state,(),('active_idle_living_edit_actor',),work,{}
    refusal=None;program=actor.program
    if model.edit_supports_required:
        terrain=_cell(state,actor.x,actor.y)
        if terrain is None or terrain.terrain=='UNKNOWN':return state,(),('current_edit_support_evidence',),work,{}
        if terrain.terrain!='EDIT_SUPPORT':refusal='EDIT_LOCATION'
    if edit.kind=='ADD':
        if model.insertion=='UNKNOWN':return state,(),('current_card_insertion_order',),work,{}
        mapping=next((a for a in model.additions if a.instruction_ref==edit.card.instruction_ref),None)
        if mapping is None:return state,(),('current_card_palette_mapping',),work,{}
        if (mapping.input_ref,mapping.action_ref,mapping.payload)!=(edit.input_ref,edit.action_ref,edit.payload):return state,(),('exact_current_addition_payload',),work,{}
        if not mapping.available:refusal=refusal or 'CARD_UNAVAILABLE'
        if len(program)>=model.capacity:refusal=refusal or 'CAPACITY'
        if edit.card.occurrence_ref in {c.occurrence_ref for a in state.actors for c in a.program}:return state,(),('fresh_program_card_occurrence',),work,{}
        changed=program+(edit.card,) if model.insertion=='APPEND' else (edit.card,)+program
    else:
        index=next((i for i,c in enumerate(program) if c.occurrence_ref==edit.card.occurrence_ref),None)
        if index is None:return state,(),('current_removal_occurrence',),work,{}
        card=program[index]
        if (card.removal_input_ref,card.removal_action_ref,card.removal_payload)!=(edit.input_ref,edit.action_ref,edit.payload):return state,(),('exact_current_occurrence_removal_payload',),work,{}
        if model.deletion=='UNKNOWN' or model.deletion=='TOP_ONLY' and model.top_card=='UNKNOWN':return state,(),('current_removal_grammar_and_top',),work,{}
        top=0 if model.top_card=='FIRST' else len(program)-1
        if model.deletion=='TOP_ONLY' and index!=top:refusal=refusal or 'NOT_TOP_OCCURRENCE'
        changed=program[:index]+program[index+1:]
        if not changed and model.empty_program_after_edit=='UNKNOWN':return state,(),('empty_edit_program_lifecycle',),work,{}
    if refusal and model.refusal_cost=='UNKNOWN':return state,(),('current_refused_edit_cost',),work,{}
    actual_cost=0 if refusal and model.refusal_cost=='NO_DEBIT' else cost
    if actual_cost>state.remaining_budget:return state,(),('funded_program_edit',),work,{}
    current=state.model_copy(update={'remaining_budget':state.remaining_budget-actual_cost})
    if not refusal:current=_replace_actor(current,actor.model_copy(update={'program':changed,'alive':actor.alive and (bool(changed) or model.empty_program_after_edit!='DEAD')}))
    events=[{'kind':'EDIT_REFUSED' if refusal else 'EDIT_ACCEPTED','edit':edit,'refusal':refusal,'actual_cost':actual_cost,'before':state,'after':current}];count=work
    if refusal and model.refused_edit_ticks=='UNKNOWN':return current,tuple(events),('current_refused_edit_autonomous_tick',),count,{}
    ticks=model.edit_ticks_autonomous and (not refusal or model.refused_edit_ticks=='AS_ACCEPTED')
    if ticks:
        if not model.edit_tick_actor_refs:return current,tuple(events),('declared_edit_tick_initiative',),count,{}
        for index,ref in enumerate(model.edit_tick_actor_refs):
            current,trace,debt,work,cut=_actor_turn(current,model,ref,maximum-count);count+=work;events.extend(trace)
            if debt or cut:return current,tuple(events),debt,count,{'next_edit_tick_actor':index,**cut} if cut else {}
    beneficiary=_actor(current,current.beneficiary_ref)
    if beneficiary is None or not beneficiary.alive:
        current,debt=_terminal(current,model);events.append({'kind':'EDIT_BENEFICIARY_FAILURE','after':current});return current,tuple(events),debt,count,{}
    if current.remaining_budget<=0:
        if model.exhausted_budget=='UNKNOWN':return current,tuple(events),('current_program_budget_exhaustion_law',),count,{}
        current=current.model_copy(update={'status':model.exhausted_budget})
    return current,tuple(events),(),count,{}


def _edit_distance(request,model):
    state=request.state;actor=next((a for a in state.actors if a.actor_ref==request.actor_ref),None)
    if actor is None:return family_result(request,prerequisite_refs=('current_program_actor',),domain_complete=False)
    if model.insertion!='APPEND' or model.deletion!='ARBITRARY_OCCURRENCE':return with_implementation_debt(family_result(request,domain_complete=False),('bounded_other_edit_grammar_search',))
    current=actor.program;desired=request.desired_program;prefix=0;retained=[];deleted=[];count=0
    work_bound=len(state.actors)+2*len(current)+len(model.additions)+2*len(desired)+(len(state.board) if model.edit_supports_required else 0)
    if work_bound>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'exact_edit_script_work','required_work_upper_bound':work_bound})
    for index,card in enumerate(current):
        if count>=request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,examined_count=count,frontier={'phase':'retained_desired_prefix','next_occurrence_index':index,'retained_occurrences':tuple(retained),'desired_prefix_length':prefix})
        count+=1
        if prefix<len(desired) and card.instruction_ref==desired[prefix]:retained.append(card);prefix+=1
        else:deleted.append(card)
    additions={a.instruction_ref:a for a in model.additions};suffix=desired[prefix:];missing=[];script=[]
    if len(desired)>model.capacity:missing.append('desired_program_within_current_capacity')
    if model.edit_supports_required and not any(c.x==actor.x and c.y==actor.y and c.terrain=='EDIT_SUPPORT' for c in state.board):missing.append('current_edit_support')
    if not actor.alive:missing.append('living_editable_actor')
    if model.edit_ticks_autonomous:missing.append('edit_script_autonomous_survival_and_location_prediction')
    if not desired and model.empty_program_after_edit=='UNKNOWN':missing.append('empty_edit_program_lifecycle')
    if deleted and not retained and model.empty_program_after_edit!='ALIVE':missing.append('empty_intermediate_edit_prefix_preserves_actor')
    for card in deleted:
        if card.removal_input_ref is None or card.removal_action_ref is None or card.removal_payload is None:missing.append('grounded_removal.'+card.occurrence_ref)
        script.append({'kind':'REMOVE','occurrence_ref':card.occurrence_ref,'input_ref':card.removal_input_ref,'action_ref':card.removal_action_ref,'payload':card.removal_payload,'cost':model.remove_cost})
    for index,instruction in enumerate(suffix):
        mapping=additions.get(instruction)
        if mapping is None or not mapping.available:missing.append('current_available_addition.'+instruction)
        script.append({'kind':'ADD','instruction_ref':instruction,'desired_suffix_index':index,'input_ref':None if mapping is None else mapping.input_ref,'action_ref':None if mapping is None else mapping.action_ref,'payload':None if mapping is None else mapping.payload,'cost':model.add_cost,'created_occurrence_requires_reconciliation':True})
    cost=len(deleted)*model.remove_cost+len(suffix)*model.add_cost
    if cost>state.remaining_budget:missing.append('funded_exact_edit_script')
    return family_result(request,values={'desired_prefix_length':prefix,'retained_occurrences':tuple(retained),'deleted_occurrences':tuple(deleted),'appended_suffix':suffix,
        'minimum_edit_click_count':len(deleted)+len(suffix),'minimum_cost_within_supplied_grammar':cost,'grounded_edit_script':tuple(script),'retained_identity_unique_proved':False,
        'edit_location_and_capacity_prerequisites':tuple(missing),'examined_prefix_occurrences':count,'declared_work_upper_bound':work_bound,'program_execution_implied':False,'action_release':False},prerequisite_refs=tuple(dict.fromkeys(missing)),examined_count=count,domain_complete=not missing)


def _program_predecessor_word_d(parents,index,remaining):
    script=[];work=0;edit_cost=0;launch_cost=0;edit_count=0;launch_count=0
    while parents[index] is not None:
        parent,edge=parents[index]
        work+=1+len(edge['events'])
        if work>remaining:return None,work,{}
        script.append(edge)
        if edge['kind']=='EDIT':edit_cost+=edge['primitive_cost'];edit_count+=1
        else:launch_cost+=edge['primitive_cost'];launch_count+=1
        index=parent
    return tuple(reversed(script)),work,{'edit_cost':edit_cost,'launch_cost':launch_cost,'edit_count':edit_count,'launch_count':launch_count}


def _program_graph(request,model,edit_only=False):
    initial=request.state;nodes=[initial];parents=[None];costs=[0];depths=[0];seen={initial:0};queue=[(0,0)];edges=[];cuts=[];boundaries=[];goals=[];count=0
    while queue:
        distance,index=heappop(queue)
        if distance!=costs[index]:continue
        state=nodes[index]
        actor=_actor(state,request.actor_ref) if edit_only else None
        beneficiary=_actor(state,state.beneficiary_ref)
        goal=actor is not None and actor.alive and tuple(c.instruction_ref for c in actor.program)==request.desired_program if edit_only else (
            state.status=='WIN' and beneficiary is not None and beneficiary.alive
            and all(not a.alive for a in state.actors if a.role=='ADVERSARY'))
        if (state.level_scope_ref,state.restore_epoch)!=(initial.level_scope_ref,initial.restore_epoch):continue
        if goal and len(goals)<request.maximum_witnesses:
            script,work,metrics=_program_predecessor_word_d(parents,index,request.maximum_evaluations-count)
            if script is None:cuts.append({'node':index,'phase':'program_word_reconstruction_bound'});continue
            count+=work;goals.append({'node':index,'cost':distance,'external_script':script,'after_state':state,**metrics})
        if state.status!='ACTIVE':continue
        if depths[index]>=request.maximum_depth:cuts.append({'node':index,'phase':'external_program_depth'});continue
        choices=tuple(('EDIT',edit) for edit in request.candidate_edits if not edit_only or edit.actor_ref==request.actor_ref)+( () if edit_only else (('LAUNCH',None),))
        for choice_index,(kind,edit) in enumerate(choices):
            if kind=='EDIT':after,events,debt,work,cut=_edit(state,model,edit,request.maximum_evaluations-count)
            else:after,events,debt,work,cut=_launch(state,model,request.maximum_evaluations-count)
            count+=work
            if cut:cuts.append({'node':index,'next_choice_index':choice_index,**cut});queue.clear();break
            if debt:boundaries.append({'node':index,'kind':kind,'edit':edit,'missing_refs':debt,'after_prefix':after,'events':events});continue
            restored=any(e.get('restoration') or e.get('kind')=='EDIT_BENEFICIARY_FAILURE' and model.beneficiary_failure=='RESTORE_DECLARED' for e in events)
            if restored or (after.level_scope_ref,after.restore_epoch)!=(state.level_scope_ref,state.restore_epoch):boundaries.append({'node':index,'kind':kind,'after_prefix':after,'reason':'qualify_restored_execution_scope'});continue
            edgecost=next((e['actual_cost'] for e in events if e.get('kind') in ('EDIT_ACCEPTED','EDIT_REFUSED')),0) if kind=='EDIT' else model.launch_cost
            script={'kind':kind,'edit':edit,'input_ref':None if kind=='EDIT' else request.launch_input_ref,'action_ref':None if kind=='EDIT' else request.launch_action_ref,'payload':None if kind=='EDIT' else request.launch_payload,'primitive_cost':edgecost,'events':events}
            child=seen.get(after);newcost=distance+edgecost
            if child is None:
                if len(nodes)>=request.maximum_states:cuts.append({'node':index,'next_choice_index':choice_index,'phase':'program_state_bound'});continue
                child=len(nodes);seen[after]=child;nodes.append(after);parents.append((index,script));costs.append(newcost);depths.append(depths[index]+1);heappush(queue,(newcost,child))
            elif newcost<costs[child]:
                costs[child]=newcost;parents[child]=(index,script);depths[child]=depths[index]+1;heappush(queue,(newcost,child))
            edges.append({'from_node':index,'to_node':child,'kind':kind,'cost':edgecost,'events':events})
    return family_result(request,values={'complete_program_states':nodes,'external_edit_launch_edges':edges,'goal_scripts':goals,'minimum_cost_proved_in_declared_domain':bool(goals) and not cuts and not boundaries,
        'unknown_effect_or_payload_boundaries':boundaries,'declared_domain_exhausted':not goals and not cuts and not boundaries,'stack_height_is_future_state_signature':False,'action_release':False},
        examined_count=count,domain_complete=not cuts and not boundaries,computation_bound_reached=bool(cuts),frontier={'cuts':cuts,'pending_queue':tuple(queue)} if cuts else {})


def _fit(request):
    kind='EDIT' if request.operation_ref=='edit_protocol_fit' else 'INSTRUCTION';compatible=[];refuted=[];unknown=[];count=0;cuts=[]
    for model_index,model in enumerate(request.models):
        supported=[];bad=[];missing=[]
        for observation in request.observations:
            if observation.kind!=kind:continue
            if not observation.sealed or observation.event_owner_ref!=request.scope.event_owner_ref or observation.epoch!=request.scope.epoch:missing.append((observation.observation_ref,'current_owned_observation'));continue
            if kind=='EDIT':
                if observation.edit is None:missing.append((observation.observation_ref,'observed_exact_edit'));continue
                after,events,debt,work,cut=_edit(observation.before,model,observation.edit,request.maximum_evaluations-count)
            else:
                if observation.actor_ref is None or observation.instruction_ref is None:missing.append((observation.observation_ref,'isolated_or_distinguishable_instruction'));continue
                after,events,debt,work,cut=_instruction(observation.before,model,observation.actor_ref,observation.instruction_ref,request.maximum_evaluations-count,True)
            count+=work
            if cut:cuts.append({'phase':'program_fit','model_index':model_index,'observation_ref':observation.observation_ref,**cut});break
            if debt:missing.append((observation.observation_ref,debt));continue
            trace=observation.trace
            if trace is not None and (not trace.sealed or trace.input_ref!=observation.input_ref or trace.event_owner_ref!=request.scope.event_owner_ref or trace.epoch!=request.scope.epoch or trace.evidence_revision_ref!=request.scope.evidence_revision_ref or trace.model_revision_ref!=request.scope.model_revision_ref):missing.append((observation.observation_ref,'current_owned_instruction_or_edit_trace'));continue
            if not _same_program_state(after,observation.after) or trace is not None and immutable_json_data(events)!=trace.events:bad.append(observation.observation_ref)
            else:supported.append({'observation_ref':observation.observation_ref,'events':events})
        if cuts:break
        if bad:refuted.append({'model_ref':model.model_ref,'falsifiers':bad})
        elif supported:compatible.append({'model':model,'supported_observations':supported,'unknown_observations':missing})
        else:unknown.append({'model_ref':model.model_ref,'missing_refs':missing or ('current_edit_or_instruction_observation',)})
    return family_result(request,values={'scoped_edit_or_instruction_models':compatible,'refuted_models':refuted,'unknown_models':unknown,'one_launch_proves_full_instruction_set':False,'capacity_disabled_card_permanently_ineffective':False},
        examined_count=count,domain_complete=not cuts and not unknown and not any(row['unknown_observations'] for row in compatible),computation_bound_reached=bool(cuts),frontier={'cuts':cuts} if cuts else {})


def _preimages(request,model):
    means=[];unknown=[];count=0;cut={}
    for index,state in enumerate(request.preimage_states):
        if index>=request.maximum_states:cut={'phase':'combat_preimage_states','next_state_index':index};break
        after,events,debt,work,bound=_launch(state,model,request.maximum_evaluations-count);count+=work
        if bound:cut={'phase':'combat_preimage_launch','next_state_index':index,**bound};break
        if debt:unknown.append({'candidate_state':state,'missing_refs':debt,'events':events});continue
        beneficiary=_actor(after,after.beneficiary_ref);targets=tuple(_actor(after,ref) for ref in request.target_removed_refs)
        if beneficiary is None or not beneficiary.alive or any(t is None or t.alive for t in targets):continue
        if (after.level_scope_ref,after.restore_epoch)!=(state.level_scope_ref,state.restore_epoch):unknown.append({'candidate_state':state,'missing_refs':('current_unrestored_combat_result',)});continue
        terrain=_cell(after,beneficiary.x,beneficiary.y);returns=not model.edit_supports_required or terrain is not None and terrain.terrain=='EDIT_SUPPORT'
        needed=request.future_edit_consumer_ref is not None
        means.append({'prepared_state':state,'after_state':after,'ordered_events':events,'removed_refs':request.target_removed_refs,'beneficiary_survives_full_suffix':True,
            'future_edit_consumer_ref':request.future_edit_consumer_ref,'return_to_edit_service_required':needed,
            'return_to_edit_supported':returns,'return_to_edit_prerequisites':('route_to_current_edit_support',) if needed and not returns else (),
            'attack_by_beneficiary_required':False,'actual_primitive_cost':model.launch_cost})
    return family_result(request,values={'alternate_combat_preimages':means,'unknown_preimage_branches':unknown,'candidate_domain_is_caller_supplied':True,'action_release':False},examined_count=count,domain_complete=not unknown and not cut,computation_bound_reached=bool(cut),frontier=cut)


def _compare(request):
    from .articulated_dependency_measurement_c import _nodes
    from agents.yf_arc3_v5.logos.types import immutable_json_data
    a=request.expected_state;b=request.actual_state;expected=request.expected_trace;actual=request.actual_trace
    current=expected is not None and actual is not None and expected.sealed and actual.sealed and expected.event_owner_ref==actual.event_owner_ref==request.scope.event_owner_ref and expected.epoch==actual.epoch==request.scope.epoch and expected.input_ref==actual.input_ref and expected.evidence_revision_ref==actual.evidence_revision_ref==request.scope.evidence_revision_ref and expected.model_revision_ref==actual.model_revision_ref==request.scope.model_revision_ref
    count=_nodes(immutable_json_data((a,b)),request.maximum_evaluations);first=None;cut={}
    if count is None:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':'complete_program_population_terrain_compare'})
    if current:
        for index in range(max(len(expected.events),len(actual.events))):
            if count>=request.maximum_evaluations:cut={'phase':'program_event_compare','next_event_index':index};break
            count+=1;x=expected.events[index] if index<len(expected.events) else None;y=actual.events[index] if index<len(actual.events) else None
            if x!=y:first={'event_index':index,'expected':x,'actual':y};break
    return family_result(request,values={'first_instruction_edit_damage_or_terminal_mismatch':first,'state_mismatch':not _same_program_state(a,b),'expected_state':a,'actual_state':b,
        'same_position_proves_no_progress':False,'adversary_program_changes':tuple({'actor_ref':x.actor_ref,'before':x.program,'after':None if _actor(b,x.actor_ref) is None else _actor(b,x.actor_ref).program} for x in a.actors if x.role=='ADVERSARY' and (_actor(b,x.actor_ref) is None or x.program!=_actor(b,x.actor_ref).program))},
        prerequisite_refs=() if current else ('current_owned_sealed_program_prediction',),examined_count=count,domain_complete=current and not cut,computation_bound_reached=bool(cut),frontier=cut)


def measure_editable_actor_programs(request: ProgramRequest) -> MechanicalFamilyResult:
    if request.mode is None or OPERATION_MODES.get(request.operation_ref)!=request.mode:return family_result(request,signature_supported=False,domain_complete=False)
    op=request.operation_ref;required={'isometric_program_layers':('raw_layer_pixels','layer_templates'),'edit_protocol_fit':('models','observations'),'instruction_fit':('models','observations'),
        'local_program_edit':('state','models','bound_model_ref','edit'),'instruction_effect':('state','models','bound_model_ref','actor_ref','instruction_ref'),
        'actor_turn_copy':('state','models','bound_model_ref','actor_ref'),'program_launch':('state','models','bound_model_ref'),
        'combat_preimages':('models','bound_model_ref','preimage_states','target_removed_refs'),'edit_distance':('state','models','bound_model_ref','actor_ref','desired_program'),
        'program_composition_domain':('state','models','bound_model_ref','candidate_edits','launch_input_ref','launch_action_ref','launch_payload'),'program_compare':('expected_state','actual_state')}
    missing=missing_supplied_fields(request,required[op])
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    if op=='isometric_program_layers':
        measured=translated_layers(request);templates={t.template_ref:t for t in request.layer_templates};values=dict(measured.values);rows=values.get('measured_layer_alternatives',())+values.get('possible_layer_alternatives',())
        candidates=tuple({'measurement':r,'component':templates[r['template_ref']].component,'logical_cell':(templates[r['template_ref']].logical_x,templates[r['template_ref']].logical_y) if templates[r['template_ref']].logical_projection_evidence_ref is not None else None,
            'stack_ordinal':templates[r['template_ref']].stack_ordinal,'instruction_candidate_ref':templates[r['template_ref']].instruction_candidate_ref} for r in rows)
        return measured.model_copy(update={'values':immutable_json_data({**values,'logical_board_and_program_candidates':candidates,'screen_gap_is_lethal_hole':False,'duplicate_card_drawings_are_single_occurrence':False})})
    if op in ('edit_protocol_fit','instruction_fit'):return _fit(request)
    if op=='program_compare':return _compare(request)
    model=next((m for m in request.models if m.model_ref==request.bound_model_ref),None)
    if model is None:return family_result(request,prerequisite_refs=('bound_current_actor_program_model',),domain_complete=False)
    if op=='edit_distance':
        if model.insertion=='APPEND' and model.deletion=='ARBITRARY_OCCURRENCE':return _edit_distance(request,model)
        missing=missing_supplied_fields(request,('candidate_edits',))
        return family_result(request,prerequisite_refs=missing,domain_complete=False) if missing else _program_graph(request,model,True)
    if op=='program_composition_domain':return _program_graph(request,model)
    if op=='combat_preimages':return _preimages(request,model)
    if op=='local_program_edit':after,events,debt,count,cut=_edit(request.state,model,request.edit,request.maximum_evaluations)
    elif op=='instruction_effect':
        state=request.state
        if state.executing_actor_ref!=request.actor_ref or state.instruction_cursor>=len(state.copied_program) or state.copied_program[state.instruction_cursor].instruction_ref!=request.instruction_ref:return family_result(request,prerequisite_refs=('exact_current_copied_instruction_cursor',),domain_complete=False)
        after,events,debt,count,cut=_instruction(state,model,request.actor_ref,request.instruction_ref,request.maximum_evaluations)
        if not debt and not cut:after=after.model_copy(update={'instruction_cursor':state.instruction_cursor+1})
    elif op=='actor_turn_copy':after,events,debt,count,cut=_actor_turn(request.state,model,request.actor_ref,request.maximum_evaluations)
    else:after,events,debt,count,cut=_launch(request.state,model,request.maximum_evaluations)
    return family_result(request,values={'after_state':after,'ordered_owned_events':events,'external_command_count':1 if op in ('local_program_edit','program_launch') else 0,
        'actual_primitive_cost':next((e['actual_cost'] for e in events if e.get('kind') in ('EDIT_ACCEPTED','EDIT_REFUSED')),0) if op=='local_program_edit' else model.launch_cost if op=='program_launch' else 0,
        'action_release':False},prerequisite_refs=debt,examined_count=count,domain_complete=not debt and not cut,computation_bound_reached=bool(cut),frontier=cut)
