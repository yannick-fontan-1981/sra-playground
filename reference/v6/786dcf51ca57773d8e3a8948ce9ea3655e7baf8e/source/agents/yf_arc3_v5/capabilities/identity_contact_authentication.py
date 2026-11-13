"""Bounded identity/contact evidence under explicit caller-owned laws.

Displayed readiness never substitutes for causal preparation or official seal.
Authenticity alternatives remain hypotheses until a sealed verdict is supplied.
"""
from typing import Literal
from collections import deque
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .mechanical_family_contracts_a import (
    MechanicalFamilyScope, MechanicalFamilyResult, family_result,
    missing_supplied_fields, with_implementation_debt,
)

Point=tuple[int,int]


class ContactMotion(FrozenModel):
    model_ref: Ref
    path: tuple[Point,...] = Field(min_length=1,max_length=256)
    phase: int = Field(ge=0)
    cadence_ticks: int = Field(ge=1,le=65536)
    cadence_elapsed: int = Field(ge=0)
    pause_remaining: int = Field(ge=0,le=65536)
    arrival_pauses: tuple[int,...] = Field(max_length=256)
    trajectory_complete: bool
    path_mode: Literal["LOOP","STOP"]
    @model_validator(mode="after")
    def phase_domain(self):
        if self.phase>=len(self.path) or self.cadence_elapsed>=self.cadence_ticks:
            raise ValueError("motion phase and cadence must belong to their supplied domain")
        if len(self.arrival_pauses)!=len(self.path) or any(x<0 or x>65536 for x in self.arrival_pauses):
            raise ValueError("every path phase needs its bounded arrival pause")
        return self


class ContactCandidate(FrozenModel):
    identity_ref: Ref
    position: Point
    status: Literal["UNRESOLVED","ACQUIRED","DECOY"]
    authenticity_alternatives: tuple[Literal["AUTHENTIC","DECOY"],...] = Field(min_length=1,max_length=2)
    visible: bool
    motion: ContactMotion | None = None
    @model_validator(mode="after")
    def alternatives(self):
        if len(set(self.authenticity_alternatives))!=len(self.authenticity_alternatives):
            raise ValueError("authenticity alternatives must be distinct")
        if self.motion is not None and self.position!=self.motion.path[self.motion.phase]:
            raise ValueError("current position and motion phase must agree")
        return self


class IdentityPreparation(FrozenModel):
    owner_ref: Ref
    quantity: int = Field(ge=0,le=65536)


class ContactState(FrozenModel):
    actor_position: Point
    actor_mode_ref: Ref
    calibration_ref: Ref | None
    candidates: tuple[ContactCandidate,...] = Field(max_length=128)
    preparation_owner_ref: Ref | None
    preparation_count: int = Field(ge=0,le=65536)
    preparations: tuple[IdentityPreparation,...] | None = Field(default=None,max_length=128)
    remaining_budget: int = Field(ge=0,le=65536)
    entry_tick: int = Field(ge=0)
    restoration_epoch: int = Field(ge=0)
    level_ref: Ref | None = None
    execution_status: Literal["ACTIVE","WIN","LOCAL_STOP","GAME_OVER"] = "ACTIVE"
    @model_validator(mode="after")
    def ownership(self):
        refs=tuple(c.identity_ref for c in self.candidates)
        if len(set(refs))!=len(refs):
            raise ValueError("candidate identities must be unique")
        if self.preparation_owner_ref is not None and self.preparation_owner_ref not in refs:
            raise ValueError("preparation belongs to a supplied candidate")
        if self.preparation_owner_ref is None and self.preparation_count:
            raise ValueError("preparation quantity cannot lose its identity owner")
        if self.preparations is not None:
            owners=tuple(p.owner_ref for p in self.preparations)
            if len(set(owners))!=len(owners) or not set(owners)<=set(refs):
                raise ValueError("preparation ledger preserves unique supplied identities")
            current=next((p.quantity for p in self.preparations if p.owner_ref==self.preparation_owner_ref),0)
            if current!=self.preparation_count:
                raise ValueError("active preparation handle must agree with its identity ledger")
        return self


class ContactLayerSample(FrozenModel):
    layer_ref: Ref
    # Role assignments come from the caller's current source/DRM binding.
    role_ref: Ref
    owner_ref: Ref | None
    support: tuple[Point,...] = Field(max_length=4096)
    display_value_ref: Ref | None
    measured_quantity: int | None = Field(default=None,ge=0)
    @model_validator(mode="after")
    def support_points(self):
        if len(set(self.support))!=len(self.support):raise ValueError("measured layer support is unique")
        return self


class ContactPixel(FrozenModel):
    point: Point
    token_ref: Ref


class ContactLayerTemplate(FrozenModel):
    template_ref: Ref
    layer_ref: Ref
    role_ref: Ref
    owner_ref: Ref | None
    origin: Point
    positive_pixels: tuple[ContactPixel,...] = Field(min_length=1,max_length=4096)
    negative_pixels: tuple[ContactPixel,...] = Field(default=(),max_length=4096)
    display_value_ref: Ref | None
    measured_quantity: int | None = Field(default=None,ge=0)
    @model_validator(mode="after")
    def pixel_constraints(self):
        points=tuple(p.point for p in self.positive_pixels)
        if len(set(points))!=len(points):raise ValueError("positive template pixels are unique")
        if set((p.point,p.token_ref) for p in self.positive_pixels)&set((p.point,p.token_ref) for p in self.negative_pixels):
            raise ValueError("positive and negative template constraints must not contradict")
        return self


class ContextEffectRow(FrozenModel):
    context_ref: Ref
    effect_ref: Ref


class ActivationContextLaw(FrozenModel):
    law_ref: Ref
    action_ref: Ref
    priority: tuple[Ref,...] = Field(max_length=32)
    effects: tuple[ContextEffectRow,...] = Field(max_length=32)
    empty_effect_ref: Ref
    @model_validator(mode="after")
    def rows(self):
        if len(set(self.priority))!=len(self.priority):
            raise ValueError("context priority must not duplicate a context")
        refs=tuple(row.context_ref for row in self.effects)
        if len(set(refs))!=len(refs) or set(refs)!=set(self.priority):
            raise ValueError("context priority and effect rows must describe the same domain")
        return self


class ContextObservation(FrozenModel):
    evidence_ref: Ref
    action_ref: Ref
    present_context_refs: tuple[Ref,...] = Field(max_length=32)
    observed_effect_ref: Ref


class PreparationLaw(FrozenModel):
    law_ref: Ref
    activation_increment: int = Field(ge=1,le=64)
    clear_on_displacement: bool
    clear_on_departure: bool
    clear_on_blocked_move: bool
    clear_after_acquisition: bool
    identity_switch_effect: Literal["REPLACE_ACTIVE","KEEP_INDEPENDENT"] = "REPLACE_ACTIVE"


class PreparationObservation(FrozenModel):
    evidence_ref: Ref
    primitive_kind: Literal["MOVE","ACTIVATE","OTHER"]
    actor_before: Point
    actor_after: Point
    contact_before_ref: Ref | None
    contact_after_ref: Ref | None
    preparation_activation_ref: Ref | None
    acquired_identity_ref: Ref | None
    owner_before_ref: Ref | None
    owner_after_ref: Ref | None
    quantity_before: int = Field(ge=0,le=65536)
    quantity_after: int = Field(ge=0,le=65536)
    preparations_before: tuple[IdentityPreparation,...] | None = Field(default=None,max_length=128)
    preparations_after: tuple[IdentityPreparation,...] | None = Field(default=None,max_length=128)
    contact_after_refs: tuple[Ref,...] | None = Field(default=None,max_length=128)
    @model_validator(mode="after")
    def ledger_observations(self):
        for ledger,owner,quantity in ((self.preparations_before,self.owner_before_ref,self.quantity_before),
                                     (self.preparations_after,self.owner_after_ref,self.quantity_after)):
            if ledger is not None:
                refs=tuple(p.owner_ref for p in ledger)
                if len(set(refs))!=len(refs):raise ValueError("observed preparation identities must be unique")
                current=next((p.quantity for p in ledger if p.owner_ref==owner),0)
                if current!=quantity:raise ValueError("observed active handle and ledger must agree")
        return self


class AuthenticationLaw(FrozenModel):
    law_ref: Ref
    accessible_mode_refs: tuple[Ref,...] = Field(min_length=1,max_length=32)
    required_calibration_ref: Ref | None
    preparation_required: int = Field(ge=0,le=65536)
    activation_cost: int = Field(ge=0,le=65536)


class ContactCommand(FrozenModel):
    action_ref: Ref
    kind: Literal["MOVE","ACTIVATE"]
    displacement: Point
    cost: int = Field(ge=0,le=65536)


class ModeStation(FrozenModel):
    station_ref: Ref
    position: Point
    mode_cycle: tuple[Ref,...] = Field(min_length=1,max_length=32)
    @model_validator(mode="after")
    def distinct_modes(self):
        if len(set(self.mode_cycle))!=len(self.mode_cycle):raise ValueError("mode cycle is exact and unique")
        return self


class CalibrationStation(FrozenModel):
    station_ref: Ref
    position: Point
    calibration_ref: Ref
    accessible_mode_refs: tuple[Ref,...] = Field(min_length=1,max_length=32)


class ContactTransitionLaw(FrozenModel):
    law_ref: Ref
    phases: tuple[Literal["INPUT","MOBILE","CHECK_ACCEPTANCE","CHECK_BUDGET","TICK"],...] = Field(min_length=5,max_length=5)
    context_priority: tuple[Literal["MODE_STATION","CALIBRATOR","CANDIDATE"],...] = Field(min_length=3,max_length=3)
    preparation: PreparationLaw
    authentication: AuthenticationLaw
    clear_preparation_on_mode_change: bool
    clear_preparation_on_calibration_refusal: bool
    clear_preparation_on_calibration_change: bool
    clear_after_decoy_verdict: bool
    advance_acquired_candidates: bool
    required_acquired_count: int = Field(ge=1,le=128)
    acceptance_outcome: Literal["WIN","LOCAL_STOP","ENTER_NEXT"]
    exhaustion_outcome: Literal["ACTIVE","LOCAL_STOP","GAME_OVER"]
    advance_new_entry_in_remaining_phases: bool
    authenticate_on_threshold_activation: bool
    @model_validator(mode="after")
    def exact_phase_order(self):
        if set(self.phases)!={"INPUT","MOBILE","CHECK_ACCEPTANCE","CHECK_BUDGET","TICK"}:
            raise ValueError("each external-command phase occurs exactly once")
        if set(self.context_priority)!={"MODE_STATION","CALIBRATOR","CANDIDATE"}:
            raise ValueError("each contextual operation has an explicit priority")
        return self


class SensorContext(FrozenModel):
    contact_identity_ref: Ref | None
    actor_mode_ref: Ref
    calibration_ref: Ref | None
    unresolved_population: int = Field(ge=0,le=128)
    preparation_owner_ref: Ref | None
    preparation_count: int = Field(ge=0,le=65536)
    preparations: tuple[IdentityPreparation,...] | None = Field(default=None,max_length=128)


class SensorInterval(FrozenModel):
    context: SensorContext
    minimum: int
    maximum: int
    @model_validator(mode="after")
    def interval(self):
        if self.minimum>self.maximum:raise ValueError("sensor interval bounds are ordered")
        return self


class SensorLaw(FrozenModel):
    law_ref: Ref
    sensor_ref: Ref
    intervals: tuple[SensorInterval,...] = Field(max_length=512)


class SensorObservation(FrozenModel):
    evidence_ref: Ref
    sensor_ref: Ref
    context: SensorContext
    measured_value: int


class AuthenticationEvent(FrozenModel):
    evidence_ref: Ref
    event_owner_ref: Ref
    # These are sealed event labels supplied by source, never inferred from glow.
    kind: Literal["DECOY_VERDICT","CALIBRATION_REFUSAL","PREPARATION","SEAL","TIMING_MISS","COMPLETE_RESET"]
    identity_ref: Ref | None


class IdentityContactRequest(FrozenModel):
    schema_version: Ref = "yf_arc3_v5.identity_contact_request.v1"
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None = None
    maximum_states: int = Field(ge=1,le=4096)
    maximum_depth: int = Field(ge=0,le=64)
    maximum_witnesses: int = Field(ge=1,le=3)
    maximum_evaluations: int = Field(default=65536,ge=1,le=65536)
    state: ContactState | None = None
    before_state: ContactState | None = None
    observed_state: ContactState | None = None
    target_identity_ref: Ref | None = None
    layer_samples: tuple[ContactLayerSample,...] = Field(default=(),max_length=256)
    raw_layer_pixels: tuple[ContactPixel,...] = Field(default=(),max_length=4096)
    layer_templates: tuple[ContactLayerTemplate,...] = Field(default=(),max_length=256)
    context_laws: tuple[ActivationContextLaw,...] = Field(default=(),max_length=64)
    context_observations: tuple[ContextObservation,...] = Field(default=(),max_length=256)
    preparation_laws: tuple[PreparationLaw,...] = Field(default=(),max_length=64)
    preparation_observations: tuple[PreparationObservation,...] = Field(default=(),max_length=256)
    authentication_laws: tuple[AuthenticationLaw,...] = Field(default=(),max_length=64)
    sensor_laws: tuple[SensorLaw,...] = Field(default=(),max_length=64)
    sensor_observations: tuple[SensorObservation,...] = Field(default=(),max_length=256)
    sealed_events: tuple[AuthenticationEvent,...] = Field(default=(),max_length=256)
    motion_order: Literal["AUTHENTICATION_BEFORE_MOTION","MOTION_BEFORE_AUTHENTICATION"] | None = None
    required_activation_count: int | None = Field(default=None,ge=1,le=65536)
    window_activation_cost: int | None = Field(default=None,ge=0,le=65536)
    contact_probe_positions: tuple[Point,...] = Field(default=(),max_length=4096)
    target_motion_alternatives: tuple[ContactMotion,...] = Field(default=(),max_length=64)
    command: ContactCommand | None = None
    transition_law: ContactTransitionLaw | None = None
    walkable_positions: tuple[Point,...] = Field(default=(),max_length=4096)
    mode_stations: tuple[ModeStation,...] = Field(default=(),max_length=64)
    calibration_stations: tuple[CalibrationStation,...] = Field(default=(),max_length=64)
    next_level_entry: ContactState | None = None
    commands: tuple[ContactCommand,...] = Field(default=(),max_length=64)
    @model_validator(mode="after")
    def unique_models(self):
        for models in (self.context_laws,self.preparation_laws,self.authentication_laws,self.sensor_laws):
            refs=tuple(x.law_ref for x in models)
            if len(set(refs))!=len(refs):raise ValueError("law alternatives retain unique identities")
        motion_refs=tuple(x.model_ref for x in self.target_motion_alternatives)
        if len(set(motion_refs))!=len(motion_refs):raise ValueError("motion alternatives retain unique identities")
        command_refs=tuple(x.action_ref for x in self.commands)
        if len(set(command_refs))!=len(command_refs):raise ValueError("domain primitives retain unique binding identities")
        pixel_points=tuple(x.point for x in self.raw_layer_pixels)
        if len(set(pixel_points))!=len(pixel_points):raise ValueError("current raster evidence has one token per point")
        template_refs=tuple(x.template_ref for x in self.layer_templates)
        if len(set(template_refs))!=len(template_refs):raise ValueError("layer alternatives retain unique identities")
        return self


OPERATION_MODES={"candidate_sensor_layers":"MEASURE","activation_context_fit":"FIT",
    "preparation_lifetime":"FIT","authentication_precondition":"PRECONDITION",
    "mobile_window":"INVERSE_DOMAIN","sensor_contract":"FIT","authentication_step":"STEP",
    "access_authentication_domain":"DOMAIN","acquisition_preservation":"PRECONDITION",
    "authentication_compare":"COMPARE"}


def _advance_motion(motion):
    if motion.pause_remaining:
        return motion.model_copy(update={"pause_remaining":motion.pause_remaining-1})
    elapsed=motion.cadence_elapsed+1
    if elapsed<motion.cadence_ticks:
        return motion.model_copy(update={"cadence_elapsed":elapsed})
    phase=motion.phase+1
    if phase==len(motion.path):
        phase=0 if motion.path_mode=="LOOP" else motion.phase
    pause=motion.arrival_pauses[phase] if phase!=motion.phase else 0
    return motion.model_copy(update={"phase":phase,"cadence_elapsed":0,"pause_remaining":pause})


def _candidate_layers(request):
    pixels={sample.point:sample.token_ref for sample in request.raw_layer_pixels}
    measured=[];possible=[];refutations=[];count=0
    for template_index,template in enumerate(request.layer_templates):
        ox,oy=template.origin;unknown=[];mismatch=None
        for polarity,constraints in (("positive",template.positive_pixels),("negative",template.negative_pixels)):
            for constraint_index,pixel in enumerate(constraints):
                if count>=request.maximum_evaluations:
                    return family_result(request,values={"measured_layer_alternatives":tuple(measured),
                        "possible_layer_alternatives":tuple(possible),"refutations":tuple(refutations)},
                        examined_count=count,domain_complete=False,computation_bound_reached=True,
                        frontier={"template_index":template_index,"polarity":polarity,
                                  "constraint_index":constraint_index,"pending_template_refs":tuple(x.template_ref for x in request.layer_templates[template_index:])})
                count+=1;point=(pixel.point[0]+ox,pixel.point[1]+oy)
                if point not in pixels:unknown.append((point,polarity,pixel.token_ref));continue
                agrees=pixels[point]==pixel.token_ref
                if agrees!=(polarity=="positive"):
                    mismatch=(template.template_ref,point,polarity,pixel.token_ref,pixels[point]);break
            if mismatch:break
        if mismatch:refutations.append(mismatch);continue
        support=tuple((p.point[0]+ox,p.point[1]+oy) for p in template.positive_pixels)
        sample=ContactLayerSample(layer_ref=template.layer_ref,role_ref=template.role_ref,
            owner_ref=template.owner_ref,support=support,display_value_ref=template.display_value_ref,
            measured_quantity=template.measured_quantity)
        alternative={"template_ref":template.template_ref,"measurement":sample,
                     "unknown_pixel_constraints":tuple(unknown)}
        (possible if unknown else measured).append(alternative)
    return family_result(request,values={"measured_layer_alternatives":tuple(measured),
        "possible_layer_alternatives":tuple(possible),"refutations":tuple(refutations),
        "separate_prebound_samples":request.layer_samples,
        "official_acceptance_inferred_from_display":False,
        "canonical_role_assignment_written":False},examined_count=count,
        prerequisite_refs=("visible_pixels_for_unresolved_layer_constraints",) if possible else ())


def _mobile_windows(request):
    state=request.state
    target=next((c for c in state.candidates if c.identity_ref==request.target_identity_ref),None)
    if target is None:
        return family_result(request,prerequisite_refs=("current_candidate_identity",),domain_complete=False)
    if target.status!="UNRESOLVED":
        return family_result(request,values={"model_windows":(),"remaining_identity_request":False})
    if not request.target_motion_alternatives:
        return family_result(request,prerequisite_refs=("current_cadence_phase_pause_alternatives",),domain_complete=False)
    alternatives=[];pending=[];refutations=[];count=0;unknown=[]
    needed=request.required_activation_count
    affordable=state.remaining_budget//request.window_activation_cost if request.window_activation_cost else request.maximum_depth
    horizon=min(request.maximum_depth,affordable)
    for model_index,initial in enumerate(request.target_motion_alternatives):
        if initial.path[initial.phase]!=target.position:
            refutations.append((initial.model_ref,"current_phase_position_mismatch"));continue
        motion=initial;positions=[]
        for tick in range(horizon):
            if count>=request.maximum_evaluations:
                pending.extend(x.model_ref for x in request.target_motion_alternatives[model_index:])
                return family_result(request,values={"model_windows":tuple(alternatives),
                    "refutations":tuple(refutations),"pending_model_refs":tuple(pending)},
                    examined_count=count,domain_complete=False,computation_bound_reached=True,
                    frontier={"model_index":model_index,"tick":tick,"motion":motion,
                              "partial_contact_positions":tuple(positions)})
            count+=1
            if request.motion_order=="MOTION_BEFORE_AUTHENTICATION":motion=_advance_motion(motion)
            positions.append(motion.path[motion.phase])
            if request.motion_order=="AUTHENTICATION_BEFORE_MOTION":motion=_advance_motion(motion)
        windows=[];probes=set(request.contact_probe_positions)
        start=0;point=positions[0] if positions else None
        for tick,position in enumerate(tuple(positions)+(None,)):
            if position!=point:
                if point in probes and tick-start>=needed:windows.append((point,start,tick-1,tick-start))
                point=position;start=tick
        alternatives.append((initial.model_ref,tuple(windows),tuple(positions)))
        if not initial.trajectory_complete:unknown.append(initial.model_ref)
    per_model=[{(point,start,end) for point,start,end,length in windows}
               for _,windows,_ in alternatives]
    possible=set().union(*per_model) if per_model else set()
    # Intersect actual command-start windows, not merely equal run endpoints.
    starts=[]
    for _,windows,_ in alternatives:
        starts.append({(point,tick) for point,start,end,length in windows
                       for tick in range(start,end-needed+2)})
    robust=set.intersection(*starts) if starts and not pending and not unknown else set()
    return family_result(request,values={"model_windows":tuple(alternatives),
        "possible_contact_intervals":tuple(sorted(possible)),
        "robust_activation_starts":tuple(sorted(robust)),"refutations":tuple(refutations),
        "required_activation_count":needed,"command_horizon":horizon,
        "entry_tick":state.entry_tick,"activation_cost":request.window_activation_cost,
        "motion_order":request.motion_order,"unknown_trajectory_models":tuple(unknown)},
        prerequisite_refs=("complete_trajectory_for_robust_window_proof",) if unknown else (),
        examined_count=count,domain_complete=not unknown)


def _preparation_records(state):
    if state.preparations is not None:return state.preparations
    return (IdentityPreparation(owner_ref=state.preparation_owner_ref,quantity=state.preparation_count),) if state.preparation_owner_ref is not None else ()


def _preparation_quantity(state,identity_ref):
    return next((p.quantity for p in _preparation_records(state) if p.owner_ref==identity_ref),0)


def _clear_preparation(state,owner_ref=None):
    records=tuple(p for p in _preparation_records(state) if owner_ref is not None and p.owner_ref!=owner_ref)
    clear_active=owner_ref is None or state.preparation_owner_ref==owner_ref
    return state.model_copy(update={"preparation_owner_ref":None if clear_active else state.preparation_owner_ref,
        "preparation_count":0 if clear_active else state.preparation_count,
        "preparations":records if state.preparations is not None else None})


def _set_preparation(state,owner_ref,quantity,law):
    records=tuple(p for p in _preparation_records(state) if p.owner_ref!=owner_ref) if law.identity_switch_effect=="KEEP_INDEPENDENT" else ()
    records=records+(IdentityPreparation(owner_ref=owner_ref,quantity=quantity),)
    records=tuple(sorted(records,key=lambda p:p.owner_ref))
    return state.model_copy(update={"preparation_owner_ref":owner_ref,"preparation_count":quantity,
                                    "preparations":records if state.preparations is not None else None})


def _contact_retention(state,law,*,displaced=False,blocked=False):
    if displaced and law.clear_on_displacement or blocked and law.clear_on_blocked_move:
        return _clear_preparation(state)
    if law.clear_on_departure:
        positions={c.identity_ref:c.position for c in state.candidates}
        for record in _preparation_records(state):
            if positions.get(record.owner_ref)!=state.actor_position:state=_clear_preparation(state,record.owner_ref)
    return state


def _input_successors(request,state):
    command=request.command;law=request.transition_law;auth=law.authentication
    if command.kind=="MOVE":
        dx,dy=command.displacement;x,y=state.actor_position;position=(x+dx,y+dy)
        admitted=position in request.walkable_positions
        moved=state.model_copy(update={"actor_position":position}) if admitted else state
        moved=_contact_retention(moved,law.preparation,displaced=moved.actor_position!=state.actor_position,blocked=not admitted)
        return ((moved,"movement_admitted" if admitted else "movement_blocked"),),()
    switches=tuple(s for s in request.mode_stations if s.position==state.actor_position)
    calibrators=tuple(s for s in request.calibration_stations if s.position==state.actor_position)
    candidates=tuple(c for c in state.candidates if c.position==state.actor_position and c.status=="UNRESOLVED")
    contexts={"MODE_STATION":switches,"CALIBRATOR":calibrators,"CANDIDATE":candidates}
    context=next((name for name in law.context_priority if contexts[name]),None)
    if context is None:return ((state,"empty_activation"),),()
    matches=contexts[context]
    if len(matches)!=1:return (), ("unambiguous_current_activation_receiver",)
    receiver=matches[0]
    if context=="MODE_STATION":
        if state.actor_mode_ref not in receiver.mode_cycle:return (), ("current_mode_in_station_cycle",)
        mode=receiver.mode_cycle[(receiver.mode_cycle.index(state.actor_mode_ref)+1)%len(receiver.mode_cycle)]
        changed=state.model_copy(update={"actor_mode_ref":mode})
        if mode!=state.actor_mode_ref and law.clear_preparation_on_mode_change:changed=_clear_preparation(changed)
        return ((changed,"mode_cycle"),),()
    if context=="CALIBRATOR":
        if state.actor_mode_ref not in receiver.accessible_mode_refs:return ((state,"calibrator_mode_refusal"),),()
        changed=state.model_copy(update={"calibration_ref":receiver.calibration_ref})
        if state.calibration_ref!=receiver.calibration_ref and law.clear_preparation_on_calibration_change:
            changed=_clear_preparation(changed)
        return ((changed,"calibration"),),()
    if command.cost!=auth.activation_cost:return (), ("command_matches_candidate_activation_cost",)
    if state.actor_mode_ref not in auth.accessible_mode_refs:return ((state,"candidate_mode_refusal"),),()
    if auth.required_calibration_ref is not None and state.calibration_ref!=auth.required_calibration_ref:
        changed=_clear_preparation(state) if law.clear_preparation_on_calibration_refusal else state
        return ((changed,"missing_calibration_refusal"),),()
    quantity=_preparation_quantity(state,receiver.identity_ref)
    if quantity<auth.preparation_required:
        quantity+=law.preparation.activation_increment
        if quantity>65536:return (), ("preparation_quantity_within_declared_domain",)
        state=_set_preparation(state,receiver.identity_ref,quantity,law.preparation)
        if quantity<auth.preparation_required or not law.authenticate_on_threshold_activation:
            return ((state,"identity_preparation"),),()
    successors=[]
    for authenticity in receiver.authenticity_alternatives:
        status="ACQUIRED" if authenticity=="AUTHENTIC" else "DECOY"
        bodies=tuple(c.model_copy(update={"status":status,"authenticity_alternatives":(authenticity,)})
                     if c.identity_ref==receiver.identity_ref else c for c in state.candidates)
        changed=state.model_copy(update={"candidates":bodies})
        if law.preparation.clear_after_acquisition and status=="ACQUIRED":changed=_clear_preparation(changed,receiver.identity_ref)
        if law.clear_after_decoy_verdict and status=="DECOY":changed=_clear_preparation(changed,receiver.identity_ref)
        successors.append((changed,"seal" if status=="ACQUIRED" else "decoy_verdict"))
    return tuple(successors),()


def _authentication_step(request):
    initial=request.state;command=request.command;law=request.transition_law
    if law.preparation.identity_switch_effect=="KEEP_INDEPENDENT" and initial.preparations is None:
        return family_result(request,prerequisite_refs=("identity_preparation_ledger_for_independent_retention",),domain_complete=False)
    if initial.execution_status!="ACTIVE":
        return family_result(request,values={"successors":(initial,),"primitive_applied":False,
            "terminal_state_preserved":True},examined_count=0)
    if initial.level_ref is None:
        return family_result(request,prerequisite_refs=("current_level_identity",),domain_complete=False)
    if command.cost>initial.remaining_budget:
        return family_result(request,values={"successors":(initial,),"primitive_applied":False,
            "budget_sufficient":False,"required_cost":command.cost},examined_count=0)
    # Cost belongs to this single external command, never to internal phases/replies.
    charged=initial.model_copy(update={"remaining_budget":initial.remaining_budget-command.cost})
    branches=[(charged,(),False)];missing=[];unresolved_branches=[];count=0
    for phase in law.phases:
        expanded=[]
        for branch_index,(state,events,entered) in enumerate(branches):
            if state.execution_status!="ACTIVE":expanded.append((state,events,entered));continue
            if count>=request.maximum_evaluations:
                return family_result(request,values={"partial_successors":tuple(s for s,_,_ in branches),
                    "primitive_applied":True,"actual_cost":command.cost},examined_count=count,
                    domain_complete=False,computation_bound_reached=True,
                    frontier={"next_phase":phase,"next_branch_index":branch_index,
                              "completed_in_current_phase":tuple(expanded),
                              "pending_in_current_phase":tuple(branches[branch_index:])})
            count+=1;before=state;outcomes=();effect=phase.lower()
            if phase=="INPUT":
                outcomes,unresolved=_input_successors(request,state);missing.extend(unresolved)
            elif phase=="MOBILE":
                if entered and not law.advance_new_entry_in_remaining_phases:
                    outcomes=((state,"new_entry_not_advanced_by_remaining_mobile_phase"),)
                else:
                    bodies=[];unresolved=[]
                    for candidate in state.candidates:
                        if candidate.status=="ACQUIRED" and not law.advance_acquired_candidates:
                            bodies.append(candidate);continue
                        if candidate.motion is None or not candidate.motion.trajectory_complete:
                            unresolved.append(candidate.identity_ref);continue
                        motion=_advance_motion(candidate.motion)
                        bodies.append(candidate.model_copy(update={"motion":motion,"position":motion.path[motion.phase]}))
                    if unresolved:missing.extend(("current_mobile_path_cadence_phase_pause",)+tuple(unresolved))
                    else:
                        changed=state.model_copy(update={"candidates":tuple(bodies)})
                        outcomes=((_contact_retention(changed,law.preparation),effect),)
            elif phase=="CHECK_ACCEPTANCE":
                acquired=sum(c.status=="ACQUIRED" for c in state.candidates)
                if not entered and acquired>=law.required_acquired_count:
                    if law.acceptance_outcome=="ENTER_NEXT":
                        if request.next_level_entry is None:missing.append("whole_next_level_entry_state")
                        elif (request.next_level_entry.level_ref is None
                              or request.next_level_entry.level_ref==state.level_ref
                              or request.next_level_entry.execution_status!="ACTIVE"):
                            missing.append("qualified_new_level_entry_scope")
                        else:
                            state=request.next_level_entry;entered=True;outcomes=((state,"next_level_entry"),)
                    else:outcomes=((state.model_copy(update={"execution_status":law.acceptance_outcome}),"acceptance"),)
                else:outcomes=((state,"acceptance_not_reached"),)
            elif phase=="CHECK_BUDGET":
                changed=state.model_copy(update={"execution_status":law.exhaustion_outcome}) if state.remaining_budget==0 else state
                outcomes=((changed,effect),)
            else:
                changed=state if entered and not law.advance_new_entry_in_remaining_phases else state.model_copy(update={"entry_tick":state.entry_tick+1})
                outcomes=((changed,effect),)
            for after,event in outcomes:
                expanded.append((after,events+({"phase":phase,"effect_ref":event,"before":before,
                    "after":after,"event_owner_ref":request.scope.event_owner_ref,
                    "model_revision_ref":request.scope.model_revision_ref},),entered))
            if not outcomes:unresolved_branches.append((phase,before,events,entered))
        branches=expanded
        if missing:break
    return family_result(request,values={"successors":tuple(state for state,_,_ in branches),
        "ordered_phase_receipts":tuple(events for _,events,_ in branches),
        "next_level_entered":tuple(entered for _,_,entered in branches),
        "unresolved_phase_branches":tuple(unresolved_branches),
        "primitive_applied":True,"actual_cost":command.cost,"command_ref":command.action_ref,
        "acceptance_law_ref":law.authentication.law_ref,"transition_law_ref":law.law_ref},
        prerequisite_refs=tuple(dict.fromkeys(missing)),examined_count=count,domain_complete=not missing)


def _contact_predecessor_word_d(parents,index,remaining):
    word=[];work=0
    while parents[index] is not None:
        parent,command=parents[index]
        work+=1
        if work>remaining:return None,work
        word.append(command);index=parent
    return tuple(reversed(word)),work


def _access_domain(request):
    # Expose a finite conditional state graph to the caller's composition;
    # witnesses remain model-conditioned and never authorize a command.
    states=[request.state];parents=[None];by_state={request.state:0};front=deque([(0,0,0)])
    edges=[];witnesses=[];entry_witnesses=[];pending=[];missing=[];evaluations=0;depth_limited=False
    while front:
        index,depth,cost=front.popleft();state=states[index]
        if state.level_ref!=request.state.level_ref:
            if len(witnesses)+len(entry_witnesses)<request.maximum_witnesses:
                word,work=_contact_predecessor_word_d(parents,index,request.maximum_evaluations-evaluations)
                if word is None:pending.append((index,'entry_witness_reconstruction_bound'));continue
                evaluations+=work
                entry_witnesses.append({"state_index":index,"action_schedule":word,"cost":cost,
                    "next_entry_state":state,"new_execution_scope_required":True})
            continue
        if state.restoration_epoch!=request.state.restoration_epoch:continue
        if state.execution_status=="WIN":
            if sum(c.status=='ACQUIRED' for c in state.candidates)<request.transition_law.required_acquired_count:
                missing.append('terminal_receipt_with_required_identity_quota');continue
            if len(witnesses)+len(entry_witnesses)<request.maximum_witnesses:
                word,work=_contact_predecessor_word_d(parents,index,request.maximum_evaluations-evaluations)
                if word is None:pending.append((index,'quota_witness_reconstruction_bound'));continue
                evaluations+=work
                witnesses.append({"state_index":index,"action_schedule":word,"cost":cost,
                    "conditional_state":state})
            continue
        if state.execution_status!="ACTIVE":continue
        if depth>=request.maximum_depth:
            depth_limited=True;pending.append((index,depth,cost,"depth_bound"));continue
        for command_index,command in enumerate(request.commands):
            if command.cost>state.remaining_budget:continue
            if evaluations>=request.maximum_evaluations:
                pending.append((index,depth,cost,command_index));pending.extend(tuple(front));front.clear();break
            budget=request.maximum_evaluations-evaluations
            result=_authentication_step(request.model_copy(update={"state":state,"command":command,
                                                                    "maximum_evaluations":budget}))
            evaluations+=result.examined_count
            if result.prerequisite_refs or result.computation_bound_reached:
                missing.extend(result.prerequisite_refs)
                pending.append((index,depth,cost,command_index,result));continue
            successors=tuple(ContactState.model_validate(value) for value in result.values.get("successors",()))
            if not result.values.get("primitive_applied"):continue
            destinations=[]
            for successor_index,successor in enumerate(successors):
                destination=by_state.get(successor)
                if destination is None:
                    if len(states)>=request.maximum_states:
                        pending.append((index,depth,cost,command_index,successor_index,successor));continue
                    destination=len(states);states.append(successor);parents.append((index,command));by_state[successor]=destination
                    front.append((destination,depth+1,cost+command.cost))
                destinations.append(destination)
            edges.append({"from_state":index,"command":command,"successor_states":tuple(destinations),
                "outcome_domain_complete":len(destinations)==len(successors),
                "phase_receipts":result.values.get("ordered_phase_receipts",())})
    bound_reached=bool(pending) and not missing
    return family_result(request,values={"states":tuple(states),"conditional_edges":tuple(edges),
        "route_and_activation_witnesses":tuple(witnesses),"requested_primitive_domain":request.commands,
        "next_level_entry_witnesses":tuple(entry_witnesses),
        'global_executable_witness_count':len(witnesses)+len(entry_witnesses),
        'rejected_executable_word_bank_retained':False,
        "primitive_depth_bound":request.maximum_depth,"depth_bound_reached":depth_limited,
        "minimum_cost_proved":False,"robust_strategy_proved":False,
        "offline_authenticity_used_as_runtime_truth":False},
        prerequisite_refs=tuple(dict.fromkeys(missing)),examined_count=evaluations,
        domain_complete=not pending and not missing,computation_bound_reached=bound_reached,
        frontier={"pending_work":tuple(pending),"state_count":len(states)} if pending else {})


def _context_fit(request):
    compatible=[];refutations=[];unknown=[];count=0
    for law_index,law in enumerate(request.context_laws):
        rows={row.context_ref:row.effect_ref for row in law.effects};mismatch=None;unresolved=[]
        for observation_index,observation in enumerate(request.context_observations):
            if observation.action_ref!=law.action_ref:continue
            if count>=request.maximum_evaluations:
                return family_result(request,values={"compatible_context_laws":tuple(compatible),
                    "refutations":tuple(refutations),"unmodeled_context_observations":tuple(unknown),
                    "pending_law_refs":tuple(x.law_ref for x in request.context_laws[law_index:])},
                    examined_count=count,domain_complete=False,computation_bound_reached=True,
                    frontier={"law_index":law_index,"observation_index":observation_index})
            count+=1
            if not set(observation.present_context_refs)<=set(law.priority):
                unresolved.append(observation.evidence_ref);continue
            contact=next((ref for ref in law.priority if ref in observation.present_context_refs),None)
            prediction=law.empty_effect_ref if contact is None else rows[contact]
            if prediction!=observation.observed_effect_ref:
                mismatch=(law.law_ref,observation.evidence_ref,prediction,observation.observed_effect_ref);break
        if mismatch:refutations.append(mismatch)
        else:compatible.append(law);unknown.extend((law.law_ref,ref) for ref in unresolved)
    return family_result(request,values={"compatible_context_laws":tuple(compatible),
        "refutations":tuple(refutations),"unmodeled_context_observations":tuple(unknown),
        "empty_context_does_not_exhaust_other_contexts":True},examined_count=count,
        prerequisite_refs=("context_effect_rows_for_unmodeled_contexts",) if unknown else ())


def _preparation_fit(request):
    compatible=[];refutations=[];unknown=[];count=0
    for law_index,law in enumerate(request.preparation_laws):
        mismatch=None;law_unknown=[]
        for observation_index,observation in enumerate(request.preparation_observations):
            if count>=request.maximum_evaluations:
                return family_result(request,values={"compatible_preparation_laws":tuple(compatible),
                    "refutations":tuple(refutations),
                    "pending_law_refs":tuple(x.law_ref for x in request.preparation_laws[law_index:])},
                    examined_count=count,domain_complete=False,computation_bound_reached=True,
                    frontier={"law_index":law_index,"observation_index":observation_index})
            count+=1;owner=observation.owner_before_ref;quantity=observation.quantity_before
            if law.identity_switch_effect=="KEEP_INDEPENDENT" and (observation.preparations_before is None or observation.preparations_after is None):
                law_unknown.append((law.law_ref,observation.evidence_ref));continue
            records={p.owner_ref:p.quantity for p in observation.preparations_before} if observation.preparations_before is not None else ({owner:quantity} if owner is not None else {})
            displaced=observation.actor_before!=observation.actor_after
            departed=owner is not None and observation.contact_after_ref!=owner
            blocked=observation.primitive_kind=="MOVE" and not displaced
            if displaced and law.clear_on_displacement or blocked and law.clear_on_blocked_move:
                records={};owner=None;quantity=0
            elif law.clear_on_departure:
                contacts=set(observation.contact_after_refs) if observation.contact_after_refs is not None else ({observation.contact_after_ref} if observation.contact_after_ref is not None else set())
                records={ref:value for ref,value in sorted(records.items()) if ref in contacts}
                departed=owner is not None and owner not in contacts
                if departed:owner=None;quantity=0
            if observation.primitive_kind=="ACTIVATE" and observation.preparation_activation_ref is not None:
                owner=observation.preparation_activation_ref;quantity=records.get(owner,0)
                quantity+=law.activation_increment
                records=({} if law.identity_switch_effect=="REPLACE_ACTIVE" else records)
                records[owner]=quantity
            if law.clear_after_acquisition and observation.acquired_identity_ref is not None:
                records.pop(observation.acquired_identity_ref,None)
                if observation.acquired_identity_ref==owner:owner=None;quantity=0
            ledger_after={p.owner_ref:p.quantity for p in observation.preparations_after} if observation.preparations_after is not None else None
            if (owner,quantity)!=(observation.owner_after_ref,observation.quantity_after) or ledger_after is not None and records!=ledger_after:
                mismatch=(law.law_ref,observation.evidence_ref,owner,quantity);break
        if mismatch:refutations.append(mismatch)
        else:compatible.append(law);unknown.extend(law_unknown)
    return family_result(request,values={"compatible_preparation_laws":tuple(compatible),
        "refutations":tuple(refutations),"unobserved_preparation_ledgers":tuple(unknown),
        "blocked_move_is_not_an_activation":True},examined_count=count,
        prerequisite_refs=("per_identity_preparation_observations",) if unknown else ())


def _precondition(request):
    state=request.state;target=next((c for c in state.candidates if c.identity_ref==request.target_identity_ref),None)
    if target is None:return family_result(request,prerequisite_refs=("current_candidate_identity",),domain_complete=False)
    if not request.authentication_laws:
        return family_result(request,prerequisite_refs=("current_acceptance_law",),domain_complete=False)
    outcomes=[]
    for law in request.authentication_laws:
        missing=[]
        if target.status!="UNRESOLVED":missing.append("unresolved_identity")
        if state.actor_position!=target.position:missing.append("current_identity_contact")
        if state.actor_mode_ref not in law.accessible_mode_refs:missing.append("accessible_mode")
        if law.required_calibration_ref is not None and state.calibration_ref!=law.required_calibration_ref:
            missing.append("required_calibration")
        quantity=_preparation_quantity(state,target.identity_ref)
        shortage=max(0,law.preparation_required-quantity)
        if shortage:missing.append("identity_owned_preparation")
        if state.remaining_budget<law.activation_cost:missing.append("activation_budget")
        outcomes.append({"law_ref":law.law_ref,"missing_conditions":tuple(missing),
            "preparation_shortage":shortage,"activation_eligible":not missing,
            "authenticity_alternatives":target.authenticity_alternatives,
            "acceptance_guaranteed_under_supplied_law":not missing and target.authenticity_alternatives==("AUTHENTIC",)})
    return family_result(request,values={"identity_ref":target.identity_ref,"law_outcomes":tuple(outcomes),
        "readiness_display_used_as_acceptance":False},examined_count=len(outcomes))


def _sensor_fit(request):
    compatible=[];refutations=[];uncovered=[];count=0
    for law_index,law in enumerate(request.sensor_laws):
        mismatch=None;missing=[];observed_count=0
        for observation_index,observation in enumerate(request.sensor_observations):
            if observation.sensor_ref!=law.sensor_ref:continue
            observed_count+=1
            if count>=request.maximum_evaluations:
                return family_result(request,values={"compatible_sensor_laws":tuple(compatible),
                    "refutations":tuple(refutations),"uncovered_contexts":tuple(uncovered),
                    "pending_law_refs":tuple(x.law_ref for x in request.sensor_laws[law_index:])},
                    examined_count=count,domain_complete=False,computation_bound_reached=True,
                    frontier={"law_index":law_index,"observation_index":observation_index})
            count+=1;intervals=tuple(x for x in law.intervals if x.context==observation.context)
            if not intervals:missing.append(observation.evidence_ref);continue
            if not any(x.minimum<=observation.measured_value<=x.maximum for x in intervals):
                mismatch=(law.law_ref,observation.evidence_ref);break
        if not observed_count:
            uncovered.append((law.law_ref,'observed_current_sensor_relation'));continue
        if mismatch:refutations.append(mismatch)
        else:compatible.append(law);uncovered.extend((law.law_ref,ref) for ref in missing)
    return family_result(request,values={"compatible_sensor_laws":tuple(compatible),
        "refutations":tuple(refutations),"uncovered_contexts":tuple(uncovered),
        "global_quota_completion_proved":False},examined_count=count,
        prerequisite_refs=("sensor_intervals_for_uncovered_contexts",) if uncovered else ())


def _preservation(request):
    before=request.before_state;after=request.observed_state
    acquired_before={c.identity_ref for c in before.candidates if c.status=="ACQUIRED"}
    acquired_after={c.identity_ref for c in after.candidates if c.status=="ACQUIRED"}
    remaining=tuple(c.identity_ref for c in after.candidates if c.status=="UNRESOLVED")
    held=after.preparation_owner_ref if after.preparation_owner_ref in remaining and after.preparation_count else None
    held_owners=tuple(p.owner_ref for p in _preparation_records(after) if p.owner_ref in remaining and p.quantity)
    return family_result(request,values={"acquired_identities":tuple(sorted(acquired_after)),
        "preserved_acquisitions":tuple(sorted(acquired_before&acquired_after)),
        "missing_prior_acquisitions":tuple(sorted(acquired_before-acquired_after)),
        "remaining_identity_requests":remaining,"still_required_preparation_owner":held,
        "still_required_preparation_owners":held_owners,
        "per_identity_preparations":_preparation_records(after),
        "released_preparation_owners":tuple(sorted(acquired_after)),
        "restoration_epoch_changed":before.restoration_epoch!=after.restoration_epoch},examined_count=len(after.candidates))


def _compare(request):
    from .articulated_dependency_measurement_c import _nodes
    from agents.yf_arc3_v5.logos.types import immutable_json_data
    before=request.before_state;after=request.observed_state
    events=request.sealed_events
    work=_nodes(immutable_json_data((before,after,events)),request.maximum_evaluations)
    if work is None:return family_result(request,domain_complete=False,computation_bound_reached=True,
        frontier={'phase':'full_owned_identity_preparation_sensor_event_compare'})
    wrong=tuple(e.evidence_ref for e in events if e.event_owner_ref!=request.scope.event_owner_ref)
    mismatches=[];by_ref={c.identity_ref:c for c in after.candidates}
    for event in events:
        candidate=by_ref.get(event.identity_ref)
        if event.kind=="SEAL" and (candidate is None or candidate.status!="ACQUIRED"):
            mismatches.append((event.evidence_ref,"seal_without_acquired_identity"))
        if event.kind=="DECOY_VERDICT" and (candidate is None or candidate.status!="DECOY"):
            mismatches.append((event.evidence_ref,"verdict_without_decoy_status"))
        if event.kind=="COMPLETE_RESET" and after.restoration_epoch<=before.restoration_epoch:
            mismatches.append((event.evidence_ref,"reset_without_new_restoration_epoch"))
    return family_result(request,values={"sealed_events":events,"event_state_mismatches":tuple(mismatches),
        "first_divergence":mismatches[0] if mismatches else None,
        "actor_displaced":before.actor_position!=after.actor_position,
        "mode_changed":before.actor_mode_ref!=after.actor_mode_ref,
        "calibration_changed":before.calibration_ref!=after.calibration_ref,
        "preparation_before":(before.preparation_owner_ref,before.preparation_count),
        "preparation_after":(after.preparation_owner_ref,after.preparation_count),
        "per_identity_preparations_before":_preparation_records(before),
        "per_identity_preparations_after":_preparation_records(after),
        "budget_delta":after.remaining_budget-before.remaining_budget,
        "refusal_is_not_a_decoy_verdict":not any(e.kind=="DECOY_VERDICT" for e in events)},
        prerequisite_refs=wrong,examined_count=work,domain_complete=not wrong)


IMPLEMENTATION_DEBTS={}


def measure_identity_contact_authentication(request: IdentityContactRequest) -> MechanicalFamilyResult:
    if request.mode is None or OPERATION_MODES.get(request.operation_ref)!=request.mode:
        return family_result(request,signature_supported=False,domain_complete=False)
    required={"candidate_sensor_layers":("raw_layer_pixels","layer_templates"),
        "activation_context_fit":("context_laws","context_observations"),
        "preparation_lifetime":("preparation_laws","preparation_observations"),
        "authentication_precondition":("state","target_identity_ref","authentication_laws"),
        "mobile_window":("state","target_identity_ref","target_motion_alternatives",
                         "contact_probe_positions","required_activation_count","window_activation_cost","motion_order"),
        "authentication_step":("state","command","transition_law","walkable_positions","mode_stations","calibration_stations"),
        "access_authentication_domain":("state","commands","transition_law","walkable_positions","mode_stations","calibration_stations"),
        "sensor_contract":("sensor_laws","sensor_observations"),
        "acquisition_preservation":("before_state","observed_state"),
        "authentication_compare":("before_state","observed_state","sealed_events")}
    missing=missing_supplied_fields(request,required.get(request.operation_ref,()))
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    op=request.operation_ref
    if op in IMPLEMENTATION_DEBTS:
        return with_implementation_debt(family_result(request,domain_complete=False),IMPLEMENTATION_DEBTS[op])
    if op=="candidate_sensor_layers":
        return _candidate_layers(request)
    if op=="activation_context_fit":return _context_fit(request)
    if op=="preparation_lifetime":return _preparation_fit(request)
    if op=="authentication_precondition":return _precondition(request)
    if op=="mobile_window":return _mobile_windows(request)
    if op=="authentication_step":return _authentication_step(request)
    if op=="access_authentication_domain":return _access_domain(request)
    if op=="sensor_contract":return _sensor_fit(request)
    if op=="acquisition_preservation":return _preservation(request)
    return _compare(request)
