"""K28 supplied finite trait words, conditional effects and staged checkpoints."""
from typing import Literal
from pydantic import Field,model_validator
import hashlib,json
from agents.yf_arc3_v5.logos.types import FrozenModel,FrozenMap,Ref,immutable_json_data,stable_digest
from .contracts import ComponentDescription
from .ordered_traits import measure_ordered_trait_arrays
from .mechanical_family_contracts_a import MechanicalFamilyScope,MechanicalFamilyResult,family_result,missing_supplied_fields


class DeviceSlot(FrozenModel):
    slot_ref: Ref
    region_ref: Ref
    trait_refs: tuple[Ref,...] = Field(min_length=1,max_length=16)
    values: tuple[Ref | None,...] = Field(min_length=1,max_length=16)
    loaded: tuple[bool,...] = Field(min_length=1,max_length=16)
    hit_regions: tuple[tuple[tuple[int,int],...],...] = Field(min_length=1,max_length=16)
    @model_validator(mode='after')
    def whole_word(self):
        if len(self.trait_refs)!=len(self.values) or len(self.loaded)!=len(self.values) or len(self.hit_regions)!=len(self.values):raise ValueError('complete ordered traits, load and click-domain vectors')
        if len(set(self.trait_refs))!=len(self.trait_refs):raise ValueError('one actual trait per ordered address')
        return self


class DeviceActor(FrozenModel):
    actor_ref: Ref
    type_ref: Ref
    position: tuple[int,int]
    size: tuple[int,int]
    contour_ref: Ref
    orientation_ref: Ref
    aspect_ref: Ref
    mask_offsets: tuple[tuple[int,int],...] = Field(min_length=1,max_length=4096)


class DeviceState(FrozenModel):
    region_ref: Ref
    actor: DeviceActor
    program: tuple[DeviceSlot,...] = Field(max_length=16)
    saved_actor: DeviceActor | None
    remaining_budget: int = Field(ge=0,le=65536)
    clock: int = Field(ge=0)
    status: Literal['ACTIVE','INTERRUPTED','FAILED','STOPPED']
    saved_properties: FrozenMap = Field(default_factory=FrozenMap)
    saved_program: tuple[DeviceSlot,...] | None = Field(default=None,max_length=16)


class DeviceEffect(FrozenModel):
    code_ref: Ref
    word: tuple[Ref,...] = Field(min_length=1,max_length=16)
    kind: Literal['TRANSLATION','POSE','SIZE','ASPECT','NEUTRAL','UNKNOWN']
    translation_delta: tuple[int,int]
    size_to: tuple[int,int] | None
    contour_to: Ref | None
    orientation_to: Ref | None
    aspect_to: Ref | None
    mask_offsets_to: tuple[tuple[int,int],...] | None = Field(default=None,max_length=4096)
    resource_cost: int | None = Field(ge=0,le=65536)
    evidence_ref: Ref | None
    assumption_ref: Ref | None = None
    size_delta: tuple[int,int] | None = None
    orientation_transitions: tuple[tuple[Ref,Ref],...] = Field(default=(),max_length=128)


class DeviceTarget(FrozenModel):
    target_ref: Ref
    position: tuple[int,int]
    size: tuple[int,int]
    contour_ref: Ref
    orientation_ref: Ref
    aspect_ref: Ref
    required_properties: tuple[Literal['position','size','contour_ref','orientation_ref','aspect_ref'],...] = Field(min_length=1,max_length=5)
    evidence_ref: Ref | None


class DeviceCheckpointLaw(FrozenModel):
    at_program_end: bool
    saved_properties: tuple[Literal['position','size','contour_ref','orientation_ref','aspect_ref','mask_offsets'],...] = Field(max_length=6)
    restored_properties: tuple[Literal['position','size','contour_ref','orientation_ref','aspect_ref','mask_offsets'],...] = Field(max_length=6)
    edited_code_retained: bool | None
    evidence_ref: Ref | None


class DeviceHazardFrame(FrozenModel):
    clock: int = Field(ge=0,le=65536)
    positions: tuple[tuple[int,int],...] = Field(max_length=8192)


class DeviceHazardSchedule(FrozenModel):
    schedule_ref: Ref
    clock_origin: int = Field(ge=0,le=65536)
    period: int | None = Field(default=None,ge=1,le=65536)
    frames: tuple[DeviceHazardFrame,...] = Field(min_length=1,max_length=4096)
    evidence_ref: Ref
    contact_policy: Literal['FAIL']
    @model_validator(mode='after')
    def unique_clock_domain(self):
        clocks=tuple(frame.clock for frame in self.frames)
        if len(set(clocks))!=len(clocks):raise ValueError('one complete hazard occupancy per declared tick')
        if self.period is not None and any(clock>=self.period for clock in clocks):
            raise ValueError('periodic hazard phases are offsets inside the evidenced period')
        return self


class DeviceModel(FrozenModel):
    model_ref: Ref
    real_region_ref: Ref
    demo_region_ref: Ref
    trait_order: tuple[Ref,...] = Field(min_length=1,max_length=16)
    effects: tuple[DeviceEffect,...] = Field(max_length=128)
    phase_order: tuple[Literal['CODE','COLLISION','CLOCK','HAZARD','TARGET'],...] = Field(min_length=1,max_length=5)
    phase_order_evidence_ref: Ref | None
    clock_step: int | None = Field(default=None,ge=0,le=4096)
    clock_evidence_ref: Ref | None = None
    blocked_policy: Literal['REJECT_LOCAL','INTERRUPT','FAIL','UNKNOWN']
    collision_evidence_ref: Ref | None
    obstacle_positions: tuple[tuple[int,int],...] = Field(max_length=8192)
    admissible_positions: tuple[tuple[int,int],...] = Field(max_length=8192)
    hazard_positions: tuple[tuple[int,int],...] = Field(max_length=8192)
    hazard_evidence_ref: Ref | None
    hazard_schedule: DeviceHazardSchedule | None = None
    target: DeviceTarget | None
    target_interrupts_at_phase: bool | None
    checkpoint: DeviceCheckpointLaw | None
    @model_validator(mode='after')
    def declared_schedule(self):
        if len(set(self.phase_order))!=len(self.phase_order):raise ValueError('each declared phase is owned once')
        if self.real_region_ref==self.demo_region_ref:raise ValueError('real legality and demo evidence retain distinct regions')
        return self


class DeviceDemo(FrozenModel):
    observation_ref: Ref
    region_ref: Ref
    slot: DeviceSlot
    before_actor: DeviceActor
    after_actor: DeviceActor
    sealed: bool
    event_owner_ref: Ref
    epoch: int = Field(ge=0)


class DeviceCandidate(FrozenModel):
    candidate_ref: Ref
    program: tuple[DeviceSlot,...] = Field(max_length=16)
    required_end_actor: DeviceActor | None
    next_start_actor: DeviceActor | None
    trial_start_position: tuple[int,int] | None = None
    trial_start_clock: int | None = Field(default=None,ge=0,le=65536)


class DeviceContinuation(FrozenModel):
    input_digest: Ref
    phase: Literal['PROGRAM','STAGES','UNSTARTED']
    next_slot: int = Field(default=0,ge=0,le=16)
    candidate_index: int = Field(default=0,ge=0,le=4096)
    current_state: DeviceState | None = None
    events: tuple[FrozenMap,...] = Field(default=(),max_length=4096)
    completed_rows: tuple[FrozenMap,...] = Field(default=(),max_length=4096)
    prerequisite_refs: tuple[Ref,...] = Field(default=(),max_length=4096)
    accounted_evaluations: int = Field(default=0,ge=0)


class DeviceRequest(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.finite_instruction_device_request.v1'
    scope: MechanicalFamilyScope
    source_identity_ref: Ref
    operation_ref: Ref
    mode: Ref | None = None
    maximum_evaluations: int = Field(ge=1,le=65536)
    maximum_states: int = Field(ge=1,le=4096)
    maximum_slots: int = Field(ge=0,le=16)
    state: DeviceState | None = None
    model: DeviceModel | None = None
    slots: tuple[DeviceSlot,...] = Field(default=(),max_length=16)
    desired_slots: tuple[DeviceSlot,...] = Field(default=(),max_length=16)
    slot: DeviceSlot | None = None
    components: tuple[ComponentDescription,...] = Field(default=(),max_length=128)
    demos: tuple[DeviceDemo,...] = Field(default=(),max_length=256)
    candidates: tuple[DeviceCandidate,...] = Field(default=(),max_length=4096)
    generate_programs: bool = False
    preparatory_domain: bool = False
    derive_temporal_starts: bool = False
    trial_start_positions: tuple[tuple[int,int],...] = Field(default=(),max_length=128)
    trial_start_clocks: tuple[int,...] = Field(default=(),max_length=128)
    checkpoint_applies: bool | None = None
    rollback_requested: bool | None = None
    resume: DeviceContinuation | None = None


DEVICE_OPERATION_MODES={
    'code_read':('MEASURE',),'edit_difference':('MEASURE',),'demo_fit':('FIT',),
    'instruction_successor':('STEP_INTERNAL',),'program_successor':('STEP_INTERNAL',),
    'checkpoint_transition':('STEP_INTERNAL',),'stage_domains':('INVERSE_DOMAIN',),'typed_match':('PRECONDITION',),
}


def _device_digest(request):
    data=request.model_dump(mode='json',exclude={'resume','maximum_evaluations','maximum_states','maximum_slots'})
    return hashlib.sha256(json.dumps(data,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()).hexdigest()


def _device_resume(request,phase,**fields):
    for key in ('events','completed_rows'):
        if key in fields:fields[key]=tuple(immutable_json_data(row) for row in fields[key])
    return DeviceContinuation(input_digest=_device_digest(request),phase=phase,**fields)


def _device_word(slot,model):
    if slot.trait_refs!=model.trait_order or any(not loaded or value is None for loaded,value in zip(slot.loaded,slot.values)):return None
    return tuple(slot.values)


def _device_actor(effect,actor):
    if effect.kind=='UNKNOWN':return actor,('supported_whole_code_effect',)
    if effect.size_to is not None and effect.size_delta is not None:return actor,('unambiguous_absolute_or_relative_size_effect',)
    size=effect.size_to if effect.size_to is not None else tuple(a+b for a,b in zip(actor.size,effect.size_delta)) if effect.size_delta is not None else actor.size
    orientation=actor.orientation_ref if effect.orientation_to is None else effect.orientation_to
    if effect.orientation_transitions:
        targets=tuple(after for before,after in effect.orientation_transitions if before==actor.orientation_ref)
        if len(targets)!=1:return actor,('supported_current_orientation_code_transition',)
        orientation=targets[0]
    if min(size)<=0:return actor,('positive_supported_actor_size',)
    changed=actor.model_copy(update={'position':(actor.position[0]+effect.translation_delta[0],actor.position[1]+effect.translation_delta[1]),
        'size':size,'contour_ref':actor.contour_ref if effect.contour_to is None else effect.contour_to,
        'orientation_ref':orientation,'aspect_ref':actor.aspect_ref if effect.aspect_to is None else effect.aspect_to})
    geometric=changed.size!=actor.size or changed.contour_ref!=actor.contour_ref or changed.orientation_ref!=actor.orientation_ref
    if geometric and effect.mask_offsets_to is None:return actor,('whole_actor_mask_for_changed_pose_size_or_contour',)
    if effect.mask_offsets_to is not None:changed=changed.model_copy(update={'mask_offsets':effect.mask_offsets_to})
    return changed,()


def _device_match(actor,target):
    return None if target is None or target.evidence_ref is None else all(getattr(actor,name)==getattr(target,name) for name in target.required_properties)


def _device_instruction(request,state,slot,model):
    word=_device_word(slot,model)
    if state.region_ref!=model.real_region_ref or slot.region_ref!=state.region_ref:return state,(),('real_region_instruction_legality_not_demo_projection',)
    if word is None:return state,(),('loaded_complete_ordered_trait_word',)
    effects=tuple(effect for effect in model.effects if effect.word==word)
    if len(effects)!=1:return state,(),('one_supported_or_separately_retained_codebook_effect',)
    effect=effects[0]
    if effect.evidence_ref is None and (effect.assumption_ref is None or effect.assumption_ref not in request.scope.assumption_refs+request.scope.retained_alternative_refs):
        return state,(),('supported_or_caller_retained_instruction_effect',)
    if model.phase_order_evidence_ref is None or 'CODE' not in model.phase_order or 'CLOCK' not in model.phase_order or model.clock_step is None or model.clock_evidence_ref is None or effect.resource_cost is None:
        return state,(),('instruction_phase_resource_and_clock_contract',)
    before=state;current=state;events=[]
    for phase in model.phase_order:
        if phase=='CODE':
            if effect.resource_cost>current.remaining_budget:return before,tuple(events),('funded_instruction_resource_at_declared_code_phase',)
            actor,debt=_device_actor(effect,current.actor)
            if debt:return before,tuple(events),debt
            current=current.model_copy(update={'actor':actor,'remaining_budget':current.remaining_budget-effect.resource_cost})
        elif phase=='CLOCK':current=current.model_copy(update={'clock':current.clock+model.clock_step})
        elif phase=='COLLISION':
            mask={(current.actor.position[0]+r,current.actor.position[1]+c) for r,c in current.actor.mask_offsets}
            if model.collision_evidence_ref is None:return before,tuple(events),('real_collision_model',)
            if mask&set(model.obstacle_positions) or not mask.issubset(set(model.admissible_positions)):
                if model.blocked_policy=='UNKNOWN':return before,tuple(events),('instruction_blocked_effect_policy',)
                if model.blocked_policy=='REJECT_LOCAL':current=current.model_copy(update={'actor':before.actor})
                else:current=current.model_copy(update={'status':'INTERRUPTED' if model.blocked_policy=='INTERRUPT' else 'FAILED'})
        elif phase=='HAZARD':
            hazards=model.hazard_positions
            schedule=model.hazard_schedule
            if schedule is None and model.hazard_evidence_ref is None:return before,tuple(events),('internal_hazard_order_and_contact_model',)
            if schedule is not None:
                tick=current.clock-schedule.clock_origin
                if tick<0:
                    events.append({'phase':'HAZARD_NEEDS_EVIDENCE','clock':current.clock,'schedule_ref':schedule.schedule_ref,
                        'clock_origin':schedule.clock_origin,'required_tick':None,'missing_ref':'hazard_clock_not_before_evidenced_origin'})
                    return before,tuple(events),('hazard_clock_not_before_evidenced_origin',)
                if schedule.period is not None:tick%=schedule.period
                matches=tuple(frame for frame in schedule.frames if frame.clock==tick)
                if len(matches)!=1:
                    events.append({'phase':'HAZARD_NEEDS_EVIDENCE','clock':current.clock,'schedule_ref':schedule.schedule_ref,
                        'clock_origin':schedule.clock_origin,'required_tick':tick,'missing_ref':'hazard_occupancy_at_current_internal_clock'})
                    return before,tuple(events),('hazard_occupancy_at_current_internal_clock',)
                hazards=matches[0].positions
            if any((current.actor.position[0]+r,current.actor.position[1]+c) in hazards for r,c in current.actor.mask_offsets):current=current.model_copy(update={'status':'FAILED'})
        else:
            matched=_device_match(current.actor,model.target)
            if matched is None:return before,tuple(events),('current_typed_target_acceptance_predicate',)
            if matched:
                if model.target_interrupts_at_phase is None:return before,tuple(events),('established_target_interruption_boundary',)
                if model.target_interrupts_at_phase:current=current.model_copy(update={'status':'INTERRUPTED'})
        events.append({'phase':phase,'code_ref':effect.code_ref,'actor':current.actor,'clock':current.clock,'remaining_budget':current.remaining_budget,'status':current.status})
        if current.status!='ACTIVE':break
    return current,tuple(events),()


def _device_checkpoint(request,state,model):
    law=model.checkpoint
    if request.checkpoint_applies is None or request.rollback_requested is None:return state,('actual_checkpoint_trigger_and_rollback_boundary',)
    if law is None or law.evidence_ref is None or law.edited_code_retained is None:return state,('checkpoint_retention_and_rollback_scope',)
    retained=dict(state.saved_properties)
    if state.saved_actor is not None:retained.update({name:getattr(state.saved_actor,name) for name in law.saved_properties})
    actor=state.actor
    if request.rollback_requested:
        if any(name not in retained for name in law.restored_properties):return state,('actual_known_saved_properties_for_rollback',)
        actor=actor.model_copy(update={name:retained[name] for name in law.restored_properties})
    saved=state.saved_actor
    if request.checkpoint_applies:
        retained.update({name:getattr(actor,name) for name in law.saved_properties})
        complete=set(DeviceActor.model_fields)-{'actor_ref','type_ref'}
        if complete.issubset(set(retained)):saved=actor.model_copy(update={name:retained[name] for name in sorted(complete)})
    program=state.program
    if not law.edited_code_retained:
        if state.saved_program is None:return state,('actual_saved_program_for_checkpoint_code_rollback',)
        program=state.saved_program
    return state.model_copy(update={'actor':actor,'saved_actor':saved,'saved_properties':immutable_json_data(retained),'program':program}),()


def _device_work(state,model):
    schedule=model.hazard_schedule
    temporal=0 if schedule is None else len(schedule.frames)+sum(len(frame.positions) for frame in schedule.frames)
    return 1+len(model.effects)+len(model.obstacle_positions)+len(model.admissible_positions)+len(model.hazard_positions)+temporal+3*len(state.actor.mask_offsets)


def _device_validation_boundary(state,events,model,missing):
    if missing or state.status in ('FAILED','STOPPED'):return False
    if state.status=='ACTIVE':return True
    return (state.status=='INTERRUPTED' and model.target_interrupts_at_phase is True
        and bool(events) and events[-1].get('phase')=='TARGET')


def _device_evidence_frontier(events):
    return tuple(event for event in events if event.get('phase')=='HAZARD_NEEDS_EVIDENCE')


def _device_physical_events(events):
    return tuple(event for event in events if event.get('phase')!='HAZARD_NEEDS_EVIDENCE')


def _device_program(request,state,model,resume=None):
    current=resume.current_state if resume is not None else state
    events=list(resume.events) if resume is not None else [];count=resume.accounted_evaluations if resume is not None else 0
    for slot_index in range(resume.next_slot if resume is not None else 0,len(state.program)):
        if current.status!='ACTIVE':return current,tuple(events),(),count,{},slot_index
        work=_device_work(current,model)
        if slot_index>=request.maximum_slots or count+work>request.maximum_evaluations:
            token=_device_resume(request,'PROGRAM',next_slot=slot_index,current_state=current,events=tuple(events),accounted_evaluations=count)
            return current,tuple(events),(),count,{'phase':'program_slots','next_slot':slot_index,'continuation':token},slot_index
        count+=work;after,trace,debt=_device_instruction(request,current,state.program[slot_index],model)
        if debt:
            events.extend({'slot_ref':state.program[slot_index].slot_ref,**event}
                for event in trace if event.get('phase')=='HAZARD_NEEDS_EVIDENCE')
            return current,tuple(events),debt,count,{},slot_index
        current=after;events.extend({'slot_ref':state.program[slot_index].slot_ref,**event} for event in trace)
    if model.checkpoint is not None and model.checkpoint.at_program_end:
        current,debt=_device_checkpoint(request,current,model)
        if debt:return current,tuple(events),debt,count,{},len(state.program)
    return current,tuple(events),(),count,{},len(state.program)


def _device_program_preimage(request,program,match_start=True):
    """Backward typed actor requirements; full K28 phases still check legality."""
    target=request.model.target
    required={name:getattr(target,name) for name in target.required_properties}
    requirements=[];work=0
    for slot in reversed(program):
        effects=tuple(effect for effect in request.model.effects if effect.word==slot.values)
        work+=len(request.model.effects)+len(required)+1
        if len(effects)!=1:return True,(),work
        effect=effects[0];after=FrozenMap(required);possible=True
        if effect.kind=='UNKNOWN' or effect.size_to is not None and effect.size_delta is not None:return True,(),work
        if 'position' in required:
            required['position']=tuple(value-delta for value,delta in zip(required['position'],effect.translation_delta))
        if 'size' in required:
            if effect.size_to is not None:
                if required['size']!=effect.size_to:possible=False
                else:required.pop('size')
            elif effect.size_delta is not None:
                required['size']=tuple(value-delta for value,delta in zip(required['size'],effect.size_delta))
                if min(required['size'])<=0:possible=False
        for name,value in (('contour_ref',effect.contour_to),('aspect_ref',effect.aspect_to)):
            if name in required and value is not None:
                if required[name]!=value:possible=False
                else:required.pop(name)
        if 'orientation_ref' in required:
            if effect.orientation_transitions:
                predecessors=tuple(before for before,after_orientation in effect.orientation_transitions if after_orientation==required['orientation_ref'])
                if not predecessors:possible=False
                elif len(set(predecessors))==1:required['orientation_ref']=predecessors[0]
                else:return True,(),work
            elif effect.orientation_to is not None:
                if required['orientation_ref']!=effect.orientation_to:possible=False
                else:required.pop('orientation_ref')
        requirements.append(FrozenMap({'slot_ref':slot.slot_ref,'code_ref':effect.code_ref,
            'after_required_properties':after,'before_required_properties':FrozenMap(required)}))
        if not possible:return False,tuple(reversed(requirements)),work
    if not match_start:return True,tuple(reversed(requirements)),work
    starts=request.trial_start_positions or (request.state.actor.position,)
    compatible=any(all((position if name=='position' else getattr(request.state.actor,name))==value
        for name,value in sorted(required.items())) for position in starts)
    return compatible,tuple(reversed(requirements)),work


def _device_stages(request):
    candidates=request.candidates;generation_work=0;preimages={};preimage_applied=False
    if request.generate_programs:
        if candidates:return family_result(request,prerequisite_refs=('one_program_candidate_domain_authority',),domain_complete=False)
        slots=request.slots
        if (not slots or len(slots)>request.maximum_slots or len({slot.slot_ref for slot in slots})!=len(slots)
                or tuple(slot.slot_ref for slot in slots)!=tuple(slot.slot_ref for slot in request.state.program)
                or any(slot.region_ref!=request.model.real_region_ref or slot.trait_refs!=request.model.trait_order
                    or not all(slot.loaded) or any(value is None for value in slot.values) for slot in slots)):
            return family_result(request,prerequisite_refs=('complete_acquired_ordered_program_capacity',),domain_complete=False)
        words=tuple(sorted(set(effect.word for effect in request.model.effects if effect.kind!='UNKNOWN'
            and (effect.evidence_ref is not None or effect.assumption_ref in request.scope.assumption_refs+request.scope.retained_alternative_refs))))
        if not words:return family_result(request,prerequisite_refs=('supported_whole_codeword_program_domain',),domain_complete=False)
        if any(len(word)!=len(request.model.trait_order) for word in words):
            return family_result(request,prerequisite_refs=('whole_word_matches_current_trait_schema',),domain_complete=False)
        inverse_licensed=False
        if not request.preparatory_domain and request.model.target is not None and request.model.target.evidence_ref is not None:
            # This is a property preimage, not an inverse physical collision
            # law. Rollback and early interruption can change which suffix
            # executes; retain the full domain in those cases.
            inverse_licensed=(request.model.blocked_policy!='REJECT_LOCAL'
                and request.model.target_interrupts_at_phase is False
                and not (request.model.checkpoint is not None and request.model.checkpoint.at_program_end
                    and request.rollback_requested is not False))
        programs=((),)
        if inverse_licensed:
            # Extend suffixes from the target backwards. Impossible setters
            # disappear before a complete codeword product is materialized.
            for slot in reversed(slots):
                following=[]
                for suffix in programs:
                    for word in words:
                        program=(slot.model_copy(update={'values':word}),*suffix)
                        compatible,_requirements,work=_device_program_preimage(request,program,match_start=False)
                        generation_work+=work+1+len(program)*len(request.model.trait_order)
                        if generation_work>=request.maximum_evaluations or len(following)>=4096:
                            return family_result(request,prerequisite_refs=('complete_backward_program_construction_bound',),
                                examined_count=min(generation_work,request.maximum_evaluations),domain_complete=False)
                        if compatible:following.append(program)
                programs=tuple(following)
        else:
            domain_size=len(words)**len(slots)
            generation_work=domain_size*(1+len(slots)*len(request.model.trait_order))
            if domain_size>4096 or generation_work>=request.maximum_evaluations:
                return family_result(request,prerequisite_refs=('bounded_complete_generated_program_domain',),domain_complete=False)
            for slot in slots:
                programs=tuple((*prefix,slot.model_copy(update={'values':word})) for prefix in programs for word in words)
        candidates=tuple(DeviceCandidate(candidate_ref='device.generated.'+stable_digest(program),program=program,
            required_end_actor=None,next_start_actor=None) for program in programs)
        if inverse_licensed:
            preimage_applied=True
            filtered=[];inverse_work=0
            for candidate in candidates:
                compatible,requirements,work=_device_program_preimage(request,candidate.program)
                inverse_work+=work
                if generation_work+inverse_work>=request.maximum_evaluations:
                    return family_result(request,prerequisite_refs=('complete_target_preimage_work_bound',),domain_complete=False)
                if compatible:
                    filtered.append(candidate);preimages[candidate.candidate_ref]=requirements
            candidates=tuple(filtered);generation_work+=inverse_work
    trials=bool(request.trial_start_positions or request.trial_start_clocks)
    positions=request.trial_start_positions or (request.state.actor.position,)
    clocks=request.trial_start_clocks or (request.state.clock,)
    temporal_projection_work=0
    if request.derive_temporal_starts:
        schedule=request.model.hazard_schedule
        if schedule is None or request.model.clock_step is None or request.trial_start_clocks:
            return family_result(request,prerequisite_refs=('one_current_evidenced_temporal_start_domain',),domain_complete=False)
        # Each evidenced phase supplies a candidate departure, never proof
        # that the later internal ticks needed by its program are also known.
        candidates_clocks=[]
        phases=request.model.phase_order
        hazard_index=phases.index('HAZARD') if 'HAZARD' in phases else None
        clock_before_hazard=hazard_index is not None and 'CLOCK' in phases and phases.index('CLOCK')<hazard_index
        capacity=max((len(candidate.program) for candidate in candidates),default=len(request.slots))
        offsets=tuple((index+int(clock_before_hazard))*request.model.clock_step for index in range(capacity))
        required_temporal_work=len(schedule.frames)*max(1,len(offsets))
        if generation_work+required_temporal_work>=request.maximum_evaluations:
            return family_result(request,prerequisite_refs=('complete_temporal_departure_projection_work_bound',),domain_complete=False)
        for frame in schedule.frames:
            for offset in offsets or (0,):
                clock=schedule.clock_origin+frame.clock-offset
                if schedule.period is not None and clock<request.state.clock:
                    clock+=((request.state.clock-clock+schedule.period-1)//schedule.period)*schedule.period
                if request.state.clock<=clock<=65536:candidates_clocks.append(clock)
        clocks=tuple(sorted(set((request.state.clock,*candidates_clocks))))
        temporal_projection_work=len(schedule.frames)*max(1,len(offsets))+len(clocks)
        trials=True
        if len(clocks)>128:return family_result(request,prerequisite_refs=('bounded_complete_temporal_departure_domain',),domain_complete=False)
    if len(set(positions))!=len(positions) or len(set(clocks))!=len(clocks) or any(type(clock) is not int or not 0<=clock<=65536 for clock in clocks):
        return family_result(request,prerequisite_refs=('unique_finite_trial_start_position_and_clock_domain',),domain_complete=False)
    if len(positions)*len(clocks)*len(candidates)>4096:
        return family_result(request,prerequisite_refs=('bounded_complete_trial_start_candidate_product',),domain_complete=False)
    if trials and any(candidate.trial_start_position is not None or candidate.trial_start_clock is not None for candidate in candidates):
        return family_result(request,prerequisite_refs=('one_explicit_trial_start_domain_authority',),domain_complete=False)
    projection_work=generation_work+temporal_projection_work+(len(positions)*len(clocks)*sum(1+len(candidate.program) for candidate in candidates) if trials else 0)
    if projection_work>=request.maximum_evaluations:
        return family_result(request,prerequisite_refs=('complete_trial_start_product_projection_work',),examined_count=0,domain_complete=False)
    candidates=tuple(candidate.model_copy(update={
        'trial_start_position':position,'trial_start_clock':clock})
        for candidate in candidates for position_index,position in enumerate(positions) for clock_index,clock in enumerate(clocks)) if trials else candidates
    resume=request.resume if request.resume is not None and request.resume.phase=='STAGES' else None
    rows=list(resume.completed_rows) if resume is not None else [];debt=list(resume.prerequisite_refs) if resume is not None else []
    count=(resume.accounted_evaluations if resume is not None else 0)+projection_work;cut={}
    for index in range(resume.candidate_index if resume is not None else 0,len(candidates)):
        candidate=candidates[index];initial=request.state.model_copy(update={'program':candidate.program})
        if candidate.trial_start_position is not None:
            initial=initial.model_copy(update={'actor':initial.actor.model_copy(update={'position':candidate.trial_start_position})})
        if candidate.trial_start_clock is not None:initial=initial.model_copy(update={'clock':candidate.trial_start_clock})
        continuing=resume is not None and index==resume.candidate_index and resume.current_state is not None
        token=_device_resume(request,'PROGRAM',next_slot=resume.next_slot,current_state=resume.current_state,events=resume.events,accounted_evaluations=0) if continuing else None
        if len(rows)>=request.maximum_states:
            cut={'phase':'stage_rows','continuation':_device_resume(request,'STAGES',candidate_index=index,current_state=initial,completed_rows=tuple(rows),accounted_evaluations=count,prerequisite_refs=tuple(dict.fromkeys(debt)))};break
        if count>=request.maximum_evaluations:
            cut={'phase':'stage_work','continuation':_device_resume(request,'STAGES',candidate_index=index,current_state=initial,completed_rows=tuple(rows),accounted_evaluations=count,prerequisite_refs=tuple(dict.fromkeys(debt)))};break
        bounded=request.model_copy(update={'maximum_evaluations':max(1,request.maximum_evaluations-count)})
        after,events,missing,work,bound,position=_device_program(bounded,initial,request.model,token);count+=work
        if missing:debt.extend(missing)
        if bound:
            cut={'phase':'stage_program','continuation':_device_resume(request,'STAGES',candidate_index=index,next_slot=position,current_state=after,events=events,
                completed_rows=tuple(rows),accounted_evaluations=count,prerequisite_refs=tuple(dict.fromkeys(debt)))};break
        rows.append({'candidate_ref':candidate.candidate_ref,'program_after':after.program,'after_state':after,'events':_device_physical_events(events),
            'required_hazard_measurements':_device_evidence_frontier(events),
            'program_before':candidate.program,
            'backward_actor_requirements':preimages.get(candidate.candidate_ref,()),
            'trial_ref':'device.trial.'+stable_digest((candidate.candidate_ref,initial.actor.position,initial.clock)),
            'trial_ordinal':index,'typed_target_compatible':_device_match(after.actor,request.model.target),
            'program_validation_boundary_reached':not bound and _device_validation_boundary(after,events,request.model,missing),
            'full_program_status':after.status,'domain_only_no_start_reachability_proved':True,
            'trial_start_position':initial.actor.position,'trial_start_clock':initial.clock,
            'trial_start_is_current_physical_state':initial.actor==request.state.actor and initial.clock==request.state.clock,
            'trial_start_requires_existing_reachability_and_waiting_guard':initial.actor!=request.state.actor or initial.clock!=request.state.clock,
            'checkpoint_reached':after.saved_actor is not None or bool(after.saved_properties),'required_end_compatible':None if candidate.required_end_actor is None else after.actor==candidate.required_end_actor,
            'next_start_compatible':None if candidate.next_start_actor is None or after.saved_actor is None else after.saved_actor==candidate.next_start_actor,'missing_refs':missing,'recursive_route_search_called':False})
    return family_result(request,values={'stage_fragments':tuple(rows),'k09_composition_interface_only':True,
        'program_candidates_generated':request.generate_programs,'generated_domain_complete':request.generate_programs and not debt and not cut,
        'program_generation_metric':'complete_ordered_whole_codeword_domain',
        'backward_target_preimage_applied':preimage_applied,
        'temporal_start_clocks_derived':request.derive_temporal_starts,'temporal_start_clock_domain':clocks,
        'preparatory_domain_retains_non_target_starts':request.preparatory_domain,
        'target_compatible_trial_refs':tuple(row['trial_ref'] for row in rows if row.get('typed_target_compatible') is True
            and row.get('program_validation_boundary_reached') is True and not row.get('missing_refs')),
        'candidate_domain_is_current_supported_codebook_only':True,'unknown_encodings_exhausted':False},prerequisite_refs=tuple(dict.fromkeys(debt)),
        examined_count=count,domain_complete=not debt and not cut,computation_bound_reached=bool(cut),frontier=cut)


def _measure_finite_instruction_device(request):
    prefix='mechanics.finite_instruction_device.'
    operation=request.operation_ref[len(prefix):] if request.operation_ref.startswith(prefix) else ''
    if operation not in DEVICE_OPERATION_MODES or request.mode not in DEVICE_OPERATION_MODES[operation]:return family_result(request,signature_supported=False,domain_complete=False)
    fields={'code_read':('model','slots'),'edit_difference':('model','slots','desired_slots'),'demo_fit':('model','demos'),
        'instruction_successor':('model','state','slot'),'program_successor':('model','state'),'checkpoint_transition':('model','state','checkpoint_applies','rollback_requested'),
        'stage_domains':('model','state','candidates'),'typed_match':('model','state')}[operation]
    missing=missing_supplied_fields(request,fields)
    if operation=='stage_domains' and request.generate_programs:
        missing=missing_supplied_fields(request,('model','state','slots'))
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    if operation=='stage_domains':return _device_stages(request)
    if operation=='program_successor':
        resume=request.resume if request.resume is not None and request.resume.phase=='PROGRAM' else None
        after,events,debt,count,cut,index=_device_program(request,request.state,request.model,resume)
        return family_result(request,values={'after_state':after,'full_program_events':_device_physical_events(events),
            'program_validation_boundary_reached':not cut and _device_validation_boundary(after,events,request.model,debt),
            'required_hazard_measurements':_device_evidence_frontier(events),'first_unsupported_slot_index':index if debt else None},
            prerequisite_refs=debt,examined_count=count,domain_complete=not debt and not cut,computation_bound_reached=bool(cut),frontier=cut)
    work=1+sum(len(s.values) for s in request.slots+request.desired_slots)+len(request.components)**2+(
        sum(len(d.before_actor.mask_offsets)+len(d.after_actor.mask_offsets) for d in request.demos) if operation=='demo_fit' else _device_work(request.state,request.model) if request.state is not None else 0)
    if work>request.maximum_evaluations:return family_result(request,domain_complete=False,computation_bound_reached=True,frontier={'phase':operation,'required_work':work})
    if operation=='code_read':
        rows=tuple({'slot_ref':slot.slot_ref,'region_ref':slot.region_ref,'whole_word':_device_word(slot,request.model) if slot.region_ref in (request.model.real_region_ref,request.model.demo_region_ref) else None,'trait_order':slot.trait_refs,'unknown_trait_refs':tuple(ref for ref,value,loaded in zip(slot.trait_refs,slot.values,slot.loaded) if value is None or not loaded)} for slot in request.slots)
        debt=('loaded_known_whole_trait_word',) if any(row['whole_word'] is None for row in rows) else ()
        geometry=measure_ordered_trait_arrays(request.components) if request.components else {}
        return family_result(request,values={'ordered_words':rows,'measured_trait_geometry':geometry,'numeric_binary_semantics_inferred':False},prerequisite_refs=debt,examined_count=work,domain_complete=not debt)
    if operation=='edit_difference':
        if len(request.slots)!=len(request.desired_slots):return family_result(request,prerequisite_refs=('same_ordered_program_slot_domain',),domain_complete=False)
        edits=[];unknown=[]
        for old,new in zip(request.slots,request.desired_slots):
            if old.slot_ref!=new.slot_ref or old.region_ref!=new.region_ref or old.trait_refs!=new.trait_refs or old.trait_refs!=request.model.trait_order:unknown.append(old.slot_ref);continue
            for index,(a,b,loaded,new_loaded) in enumerate(zip(old.values,new.values,old.loaded,new.loaded)):
                if a is None or b is None or not loaded or not new_loaded:unknown.append(old.trait_refs[index]);continue
                if a!=b:
                    if not old.hit_regions[index]:unknown.append(old.trait_refs[index]);continue
                    edits.append({'slot_ref':old.slot_ref,'trait_ref':old.trait_refs[index],'before':a,'after':b,'hit_region':old.hit_regions[index]})
        return family_result(request,values={'bit_or_trait_edits':tuple(edits),'exact_edit_cost':len(edits),'unknown_bits':tuple(unknown)},prerequisite_refs=tuple(unknown),examined_count=work,domain_complete=not unknown)
    if operation=='demo_fit':
        rows=[];unknown=[]
        for demo in request.demos:
            if demo.region_ref!=request.model.demo_region_ref or demo.slot.region_ref!=demo.region_ref or not demo.sealed or demo.event_owner_ref!=request.scope.event_owner_ref or demo.epoch!=request.scope.epoch:
                unknown.append(demo.observation_ref);continue
            word=_device_word(demo.slot,request.model)
            fits=[]
            for effect in request.model.effects:
                if word is None or effect.word!=word:continue
                predicted,debt=_device_actor(effect,demo.before_actor)
                fits.append({'code_ref':effect.code_ref,'descriptive_effect':effect.kind,'matches_demo':None if debt else predicted==demo.after_actor,'missing_refs':debt})
            rows.append({'observation_ref':demo.observation_ref,'effect_alternatives':tuple(fits),'real_world_legality_inferred':False})
            if word is None or not fits:unknown.append(demo.observation_ref)
            for fit in fits:
                unknown.extend(fit['missing_refs'])
        return family_result(request,values={'demo_effect_fits':tuple(rows)},prerequisite_refs=tuple(unknown),examined_count=work,domain_complete=not unknown)
    if operation=='typed_match':
        matched=_device_match(request.state.actor,request.model.target)
        return family_result(request,values={'typed_target_match':matched,'persistent_actor_identity':request.state.actor.type_ref,'validation_recolour_used_as_identity':False},
            prerequisite_refs=('supplied_typed_target_predicate',) if matched is None else (),examined_count=work,domain_complete=matched is not None)
    if operation=='checkpoint_transition':
        after,debt=_device_checkpoint(request,request.state,request.model)
        return family_result(request,values={'after_state':after,'program_retained':after.program==request.state.program,'untested_saved_properties_inferred':False},
            prerequisite_refs=debt,examined_count=work,domain_complete=not debt)
    after,events,debt=_device_instruction(request,request.state,request.slot,request.model)
    return family_result(request,values={'after_state':after,'instruction_events':_device_physical_events(events),
        'required_hazard_measurements':_device_evidence_frontier(events),'geometry_noop_implies_no_clock':False},
        prerequisite_refs=debt,examined_count=work,domain_complete=not debt)


def measure_finite_instruction_device(request: DeviceRequest) -> MechanicalFamilyResult:
    if request.resume is not None and request.resume.input_digest!=_device_digest(request):return family_result(request,prerequisite_refs=('same_source_scope_revision_and_device_inputs',),domain_complete=False)
    offset=request.resume.accounted_evaluations if request.resume is not None and request.resume.phase=='UNSTARTED' else 0
    if offset>=request.maximum_evaluations:return family_result(request,examined_count=offset,domain_complete=False,computation_bound_reached=True,frontier={'phase':'resumed_atomic_budget','continuation':request.resume})
    bounded=request.model_copy(update={'maximum_evaluations':request.maximum_evaluations-offset}) if offset else request
    result=_measure_finite_instruction_device(bounded)
    if offset:result=result.model_copy(update={'examined_count':result.examined_count+offset})
    if result.computation_bound_reached and 'continuation' not in result.frontier:
        result=result.model_copy(update={'frontier':immutable_json_data({**dict(result.frontier),'continuation':_device_resume(request,'UNSTARTED',accounted_evaluations=result.examined_count)})})
    return result
