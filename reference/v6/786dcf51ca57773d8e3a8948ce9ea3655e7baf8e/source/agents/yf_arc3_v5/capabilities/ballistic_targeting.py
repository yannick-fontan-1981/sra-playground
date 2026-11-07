"""Exact rational flight segments under finite caller-supplied launch laws.

The clock, collision masks, event priority and portal checkpoints are model
inputs. Drawing layers never become logical collision masks implicitly.
"""
from fractions import Fraction
from typing import Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref, immutable_json_data
from .mechanical_family_contracts_a import MechanicalFamilyScope, MechanicalFamilyResult, family_result, missing_supplied_fields
from .identity_contact_authentication import ContactPixel, ContactLayerTemplate, ContactLayerSample, _candidate_layers as translated_layers
from .mutable_kit_survival import KitEventTrace as ShotEventTrace

Vector = tuple[str, str]


def _v(value):
    return tuple(Fraction(x) for x in value)


def _wire(value):
    return tuple(str(x) for x in value)


def _add(a, b):
    return tuple(x+y for x, y in zip(a, b))


def _scale(a, n):
    return tuple(x*n for x in a)


def _finite(value):
    for number in _v(value):
        if abs(number)>10**9 or number.denominator>10**9:
            raise ValueError('rational geometry exceeds the declared DTO domain')


class ShotMask(FrozenModel):
    mask_ref: Ref
    kind: Literal['TARGET', 'TERRAIN', 'PORTAL']
    # Rectangles are a supplied logical center-collision field, not a drawing.
    rectangles: tuple[tuple[str, str, str, str], ...] = Field(min_length=1, max_length=256)
    @model_validator(mode='after')
    def geometry(self):
        for row in self.rectangles:
            x0,y0,x1,y1=map(Fraction,row)
            _finite((row[0],row[1]));_finite((row[2],row[3]))
            if x0>x1 or y0>y1:raise ValueError('ordered logical collision rectangle')
        return self


class ShotMotion(FrozenModel):
    position: Vector
    velocity: Vector
    acceleration: Vector
    tick: int = Field(ge=0)
    cooldown_ticks: int = Field(ge=0, le=4096)
    @model_validator(mode='after')
    def rational(self):
        for row in (self.position,self.velocity,self.acceleration):_finite(row)
        return self


class ShotPortal(FrozenModel):
    entry_mask_ref: Ref
    exit_ref: Ref
    exit_center: Vector
    exit_offset: Vector
    # Affine exit mapping is independently supplied for each directed passage.
    entry_anchor: Vector
    position_matrix: tuple[Vector, Vector]
    velocity_matrix: tuple[Vector, Vector]
    cooldown_ticks: int = Field(ge=0, le=4096)
    eligible_ticks: tuple[int, ...] | None = Field(default=None, max_length=4096)
    @model_validator(mode='after')
    def rational(self):
        for row in (self.exit_center,self.exit_offset,self.entry_anchor,*self.position_matrix,*self.velocity_matrix):_finite(row)
        if self.eligible_ticks is not None and any(t<0 for t in self.eligible_ticks):raise ValueError('nonnegative eligible physical ticks')
        return self


class ShotLaunch(FrozenModel):
    launch_ref: Ref
    ray_ref: Ref
    aim_payload_ref: Ref
    power_ref: Ref
    adjustment_from_power_ref: Ref
    motion: ShotMotion
    power_adjustment_inputs: tuple[Ref, ...] = Field(max_length=128)
    fire_input_ref: Ref
    command_payload_refs: tuple[Ref, ...] = Field(max_length=129)
    @model_validator(mode='after')
    def commands(self):
        if len(self.command_payload_refs)!=len(self.power_adjustment_inputs)+1:raise ValueError('one exact payload binding per adjustment and fire command')
        return self


class ShotModel(FrozenModel):
    model_ref: Ref
    source: Vector
    launch_offset: Vector
    clock_ref: Ref
    dt: str
    update_order: Literal['MOVE_THEN_ACCELERATE','ACCELERATE_THEN_MOVE']
    contact_velocity_rule: Literal['PROPOSED_TICK_VELOCITY']
    bounds: tuple[str, str, str, str]
    masks: tuple[ShotMask, ...] = Field(max_length=256)
    # Every mask and the world bound has a declared rank, including ties.
    contact_priority: tuple[Ref, ...] = Field(min_length=1,max_length=257)
    portals: tuple[ShotPortal, ...] = Field(max_length=128)
    portal_remainder: Literal['DISCARD_SEGMENT']
    exit_contact_check: bool
    launches: tuple[ShotLaunch, ...] = Field(max_length=256)
    angular_unresolved_refs: tuple[Ref, ...] = Field(max_length=128)
    geometry_complete: bool
    launch_domain_complete: bool
    near_horizontal_rule_ref: Ref
    miss_restoration: Literal['RETAIN','RESTORE_DECLARED','NEW_SCOPE','UNKNOWN']
    restored_motion: ShotMotion | None = None
    restored_power_ref: Ref | None = None
    restored_geometry_ref: Ref | None = None
    restored_scope_ref: Ref | None = None
    trial_cost: int = Field(ge=0, le=4096)
    restoration_inputs: tuple[Ref, ...] = Field(max_length=128)
    @model_validator(mode='after')
    def references(self):
        _finite(self.source);_finite(self.launch_offset)
        if Fraction(self.dt)<=0 or Fraction(self.dt)>10**9 or Fraction(self.dt).denominator>10**9:raise ValueError('supported positive rational physical time base')
        b=tuple(map(Fraction,self.bounds))
        if b[0]>=b[2] or b[1]>=b[3]:raise ValueError('nonempty flight bounds')
        refs=tuple(m.mask_ref for m in self.masks)
        if len(set(refs))!=len(refs) or len(set(self.contact_priority))!=len(self.contact_priority) or set(self.contact_priority)!=set(refs)|{'WORLD_BOUNDS'}:raise ValueError('exact collision identity and priority domain')
        if len({p.entry_mask_ref for p in self.portals})!=len(self.portals) or any(p.entry_mask_ref not in {m.mask_ref for m in self.masks if m.kind=='PORTAL'} for p in self.portals):raise ValueError('one directed transport law for each supplied entry')
        if len({r.launch_ref for r in self.launches})!=len(self.launches):raise ValueError('distinct calibrated launch candidates')
        return self


class ShotObservation(FrozenModel):
    observation_ref: Ref
    event_owner_ref: Ref
    epoch: int = Field(ge=0)
    clock_ref: Ref
    tick: int = Field(ge=0)
    interval_ref: Ref
    center_alternatives: tuple[Vector, ...] = Field(min_length=1,max_length=128)
    launch_ref: Ref | None = None
    is_repeated_hold_frame: bool
    portal_checkpoint: bool
    uninterrupted_free_interval: bool
    @model_validator(mode='after')
    def rational(self):
        for row in self.center_alternatives:_finite(row)
        return self


class ShotFreeCandidate(FrozenModel):
    parameter_ref: Ref
    model_ref: Ref
    interval_ref: Ref
    start: ShotMotion


class ShotSnapshot(FrozenModel):
    power_ref: Ref
    geometry: tuple[ShotMask, ...] = Field(max_length=256)
    layout_revision_ref: Ref
    level_scope_ref: Ref
    remaining_trials: int = Field(ge=0, le=65536)
    source: Vector | None = None
    launch_offset: Vector | None = None
    portals: tuple[ShotPortal,...] | None = Field(default=None,max_length=128)
    bounds: tuple[str,str,str,str] | None = None
    @model_validator(mode='after')
    def current_geometry(self):
        if self.source is not None:_finite(self.source)
        if self.launch_offset is not None:_finite(self.launch_offset)
        if self.bounds is not None:
            bounds=tuple(map(Fraction,self.bounds))
            if bounds[0]>=bounds[2] or bounds[1]>=bounds[3]:raise ValueError('nonempty restored flight bounds')
        return self


class ShotLayerTemplate(ContactLayerTemplate):
    component: Literal['SOURCE','TARGET','TRANSIENT_MASK','AIM_MARK','TERRAIN','PORTAL','UNKNOWN']
    center_offset: Vector | None = None
    @model_validator(mode='after')
    def center(self):
        if self.center_offset is not None:_finite(self.center_offset)
        return self


class BallisticRequest(FrozenModel):
    schema_version: Ref = 'yf_arc3_v5.ballistic_request.v1'
    scope: MechanicalFamilyScope
    operation_ref: Ref
    mode: Ref | None = None
    maximum_ticks: int = Field(ge=0, le=256)
    maximum_evaluations: int = Field(ge=1, le=65536)
    models: tuple[ShotModel, ...] = Field(default=(),max_length=128)
    bound_model_ref: Ref | None = None
    motion: ShotMotion | None = None
    next_center: Vector | None = None
    input_launch_ref: Ref | None = None
    portal_entry_ref: Ref | None = None
    free_candidates: tuple[ShotFreeCandidate, ...] = Field(default=(),max_length=256)
    observations: tuple[ShotObservation, ...] = Field(default=(),max_length=512)
    required_portal_sequences: tuple[tuple[Ref, ...], ...] | None = Field(default=None,max_length=128)
    current_power_ref: Ref | None = None
    remaining_trials: int | None = Field(default=None,ge=0,le=65536)
    command_budget: int | None = Field(default=None,ge=0,le=65536)
    retained_trial_reserve: int | None = Field(default=None,ge=0,le=65536)
    future_trial_command_reserve: int | None = Field(default=None,ge=0,le=65536)
    trial_reserve_claim_ref: Ref | None = None
    expected_trace: ShotEventTrace | None = None
    actual_trace: ShotEventTrace | None = None
    expected_snapshot: ShotSnapshot | None = None
    actual_snapshot: ShotSnapshot | None = None
    raw_layer_pixels: tuple[ContactPixel, ...] = Field(default=(),max_length=65536)
    layer_templates: tuple[ShotLayerTemplate, ...] = Field(default=(),max_length=4096)
    layer_samples: tuple[ContactLayerSample, ...] = Field(default=(),max_length=4096)
    @model_validator(mode='after')
    def references(self):
        if len({m.model_ref for m in self.models})!=len(self.models):raise ValueError('distinct whole ballistic models')
        if self.next_center is not None:_finite(self.next_center)
        return self


OPERATION_MODES={'flight_layers':'MEASURE','launch_map':'FIT','free_flight_fit':'FIT','swept_contacts':'STEP_INTERNAL','portal_transport':'STEP_INTERNAL',
    'shot_successor':'STEP','target_preimages':'INVERSE_DOMAIN','parameter_discrimination':'DOMAIN','costed_aim_domain':'DOMAIN','shot_compare_restore':'COMPARE'}


def _advance(motion,model):
    dt=Fraction(model.dt);p=_v(motion.position);v=_v(motion.velocity);a=_v(motion.acceleration)
    new_v=_add(v,_scale(a,dt));new_p=_add(p,_scale(new_v if model.update_order=='ACCELERATE_THEN_MOVE' else v,dt))
    return motion.model_copy(update={'position':_wire(new_p),'velocity':_wire(new_v),'tick':motion.tick+1,'cooldown_ticks':max(0,motion.cooldown_ticks-1)})


def _segment_box(start,end,box):
    """Closed logical rectangle entry parameter on one supported free segment."""
    p=_v(start);q=_v(end);bounds=tuple(map(Fraction,box));lo=Fraction(0);hi=Fraction(1)
    for axis in range(2):
        delta=q[axis]-p[axis];lower=bounds[axis];upper=bounds[axis+2]
        if delta==0:
            if not lower<=p[axis]<=upper:return None
        else:
            a=(lower-p[axis])/delta;b=(upper-p[axis])/delta
            lo=max(lo,min(a,b));hi=min(hi,max(a,b))
            if lo>hi:return None
    return lo if lo<=hi else None


def _bound_exit(start,end,box):
    p=_v(start);q=_v(end);b=tuple(map(Fraction,box))
    if any(p[a]<b[a] or p[a]>b[a+2] for a in range(2)):return Fraction(0)
    values=[]
    for a in range(2):
        if q[a]<b[a]:values.append((b[a]-p[a])/(q[a]-p[a]))
        if q[a]>b[a+2]:values.append((b[a+2]-p[a])/(q[a]-p[a]))
    return min(values) if values else None


def _contacts(motion,end,model,remaining,include_portals=True):
    # A partial sweep cannot attest the earliest contact of the full mask set.
    cost=1+sum(len(m.rectangles) for m in model.masks)
    if cost>remaining:return None,0,{'phase':'swept_contacts','next_mask_index':0},()
    candidates=[];portals={p.entry_mask_ref:p for p in model.portals};debt=[]
    for mask in model.masks:
        values=tuple(t for rect in mask.rectangles if (t:=_segment_box(motion.position,end,rect)) is not None)
        if not values:continue
        if mask.kind=='PORTAL':
            if not include_portals or motion.cooldown_ticks:continue
            portal=portals.get(mask.mask_ref)
            if portal is None:debt.append('transport_for_'+mask.mask_ref)
            elif portal.eligible_ticks is not None and motion.tick not in portal.eligible_ticks:continue
        candidates.append((min(values),model.contact_priority.index(mask.mask_ref),mask.kind,mask.mask_ref))
    t=_bound_exit(motion.position,end,model.bounds)
    if t is not None:candidates.append((t,model.contact_priority.index('WORLD_BOUNDS'),'BOUNDARY','WORLD_BOUNDS'))
    first=min(candidates) if candidates else None
    if first is None:return None,cost,{},tuple(debt)
    a=_v(motion.position);delta=tuple(y-x for x,y in zip(a,_v(end)));center=_wire(_add(a,_scale(delta,first[0])))
    return {'fraction':str(first[0]),'kind':first[2],'mask_ref':first[3],'center':center},cost,{},tuple(debt)


def _transport(motion,model,entry_ref):
    portal=next((p for p in model.portals if p.entry_mask_ref==entry_ref),None)
    if portal is None:return None,('directed_portal_transform',)
    if motion.cooldown_ticks or (portal.eligible_ticks is not None and motion.tick not in portal.eligible_ticks):return None,('eligible_current_portal_checkpoint',)
    mask=next(m for m in model.masks if m.mask_ref==entry_ref)
    if not any(_segment_box(motion.position,motion.position,r) is not None for r in mask.rectangles):return None,('entry_center_in_logical_aperture',)
    offset=tuple(a-b for a,b in zip(_v(motion.position),_v(portal.entry_anchor)))
    position_delta=tuple(sum(a*b for a,b in zip(_v(row),offset)) for row in portal.position_matrix)
    center=_add(_add(_v(portal.exit_center),_v(portal.exit_offset)),position_delta)
    velocity=tuple(sum(a*b for a,b in zip(_v(row),_v(motion.velocity))) for row in portal.velocity_matrix)
    after=motion.model_copy(update={'position':_wire(center),'velocity':_wire(velocity),'cooldown_ticks':portal.cooldown_ticks})
    return after,()


def _shot(request,model,launch,remaining):
    motion=launch.motion;events=[];count=0;portals=[];debt=[];cut={};outcome='UNKNOWN'
    if _v(motion.position)!=_add(_v(model.source),_v(model.launch_offset)):
        return {'outcome':'UNKNOWN','events':(),'after_motion':motion,'portal_sequence':(),'trial_cost':0},0,('current_source_launch_offset',),{}
    for step in range(request.maximum_ticks):
        proposed=_advance(motion,model)
        contact,work,frontier,missing=_contacts(motion,proposed.position,model,remaining-count)
        count+=work;debt.extend(missing)
        if frontier:cut={'next_flight_tick':step,**frontier};break
        if missing:break
        if contact is None:
            events.append({'kind':'FREE','before':motion,'after':proposed});motion=proposed;continue
        at=proposed.model_copy(update={'position':contact['center'],'cooldown_ticks':motion.cooldown_ticks,'tick':motion.tick})
        events.append({'kind':'CONTACT','before':motion,'contact':contact,'arrival_velocity':proposed.velocity})
        if contact['kind']=='PORTAL':
            transported,missing=_transport(at,model,contact['mask_ref']);debt.extend(missing)
            if missing:break
            motion=transported.model_copy(update={'tick':proposed.tick})
            portals.append(contact['mask_ref']);events.append({'kind':'PORTAL','entry':at,'after':motion})
            if model.exit_contact_check:
                exit_contact,work,frontier,missing=_contacts(motion,motion.position,model,remaining-count,False);count+=work;debt.extend(missing)
                if frontier:cut={'next_flight_tick':step,'checkpoint':'PORTAL_EXIT',**frontier};break
                if missing:break
                if exit_contact:
                    events.append({'kind':'EXIT_CONTACT','contact':exit_contact});outcome='HIT' if exit_contact['kind']=='TARGET' else 'MISS';break
        else:
            motion=proposed.model_copy(update={'position':contact['center']});outcome='HIT' if contact['kind']=='TARGET' else 'MISS';break
    else:cut={'phase':'flight_horizon','next_flight_tick':request.maximum_ticks,'motion':motion}
    restoration=None
    if outcome=='MISS':
        if model.miss_restoration=='UNKNOWN':debt.append('current_trial_restoration_law')
        elif model.miss_restoration=='RESTORE_DECLARED':
            if model.restored_motion is None or model.restored_power_ref is None or model.restored_geometry_ref is None:debt.append('declared_reset_geometry_motion_and_power')
            else:restoration={'motion':model.restored_motion,'power_ref':model.restored_power_ref,'geometry_ref':model.restored_geometry_ref}
        elif model.miss_restoration=='NEW_SCOPE':
            if model.restored_scope_ref is None:debt.append('reset_level_scope')
            else:restoration={'level_scope_ref':model.restored_scope_ref,'old_scope_interrupted':True}
        else:restoration={'retained_motion':motion,'retained_geometry':True,'retained_power_ref':launch.power_ref}
    if not model.geometry_complete:debt.append('complete_logical_collision_field')
    return {'launch_ref':launch.launch_ref,'outcome':outcome,'events':events,'after_motion':motion,'portal_sequence':tuple(portals),'trial_cost':model.trial_cost,'restoration':restoration,'internal_frames_are_commands':False},count,tuple(dict.fromkeys(debt)),cut


def _fit(request,free=False):
    observations=tuple(o for o in request.observations if not o.is_repeated_hold_frame)
    if any(o.event_owner_ref!=request.scope.event_owner_ref or o.epoch!=request.scope.epoch for o in observations):return family_result(request,prerequisite_refs=('current_owned_flight_observations',),domain_complete=False)
    models={m.model_ref:m for m in request.models};accepted=[];rejected=[];unknown=[];count=0;cut={}
    candidates=request.free_candidates if free else tuple((m.model_ref,l) for m in request.models for l in m.launches)
    for index,candidate in enumerate(candidates):
        model=models.get(candidate.model_ref) if free else models[candidate[0]]
        if model is None:unknown.append({'candidate_index':index,'reason':'bound_free_flight_model'});continue
        motion=candidate.start if free else candidate[1].motion
        if not free and _v(motion.position)!=_add(_v(model.source),_v(model.launch_offset)):
            unknown.append({'candidate_index':index,'reason':'current_source_launch_offset'});continue
        relevant=tuple(o for o in observations if o.interval_ref==candidate.interval_ref) if free else tuple(o for o in observations if o.launch_ref==candidate[1].launch_ref)
        if not relevant or any(o.clock_ref!=model.clock_ref or o.portal_checkpoint or not o.uninterrupted_free_interval for o in relevant):unknown.append({'candidate_index':index,'reason':'uninterrupted_supported_physical_interval'});continue
        ordered=tuple(sorted(relevant,key=lambda o:o.tick));matches=True;residuals=[]
        if ordered[0].tick<motion.tick:unknown.append({'candidate_index':index,'reason':'interval_start_precedes_candidate'});continue
        required=ordered[-1].tick-motion.tick+len(ordered)
        if required>request.maximum_evaluations-count or ordered[-1].tick-motion.tick>request.maximum_ticks:cut={'phase':'flight_fit','next_candidate_index':index};break
        for observation in ordered:
            while motion.tick<observation.tick:motion=_advance(motion,model);count+=1
            equal=any(_v(motion.position)==_v(p) for p in observation.center_alternatives);count+=1
            residuals.append({'observation_ref':observation.observation_ref,'predicted_center':motion.position,'in_center_alternatives':equal});matches=matches and equal
        row={'parameter_ref':candidate.parameter_ref,'start':candidate.start,'model_ref':model.model_ref,'residuals':residuals} if free else {'launch':candidate[1],'model_ref':model.model_ref,'residuals':residuals,'distance_is_speed':False,'near_horizontal_rule_ref':model.near_horizontal_rule_ref}
        (accepted if matches else rejected).append(row)
    intervals={}
    if free and accepted:
        for name in ('velocity','acceleration'):
            intervals[name]=tuple((str(min(_v(getattr(row['start'],name))[a] for row in accepted)),str(max(_v(getattr(row['start'],name))[a] for row in accepted))) for a in range(2))
    return family_result(request,values={'retained_candidates':accepted,'refuted_candidates':rejected,'unknown_candidates':unknown,'parameter_envelope':intervals,
        'unresolved_angular_ranges':tuple((m.model_ref,m.angular_unresolved_refs) for m in request.models),'obstructed_range_extrapolated':False},examined_count=count,
        domain_complete=not cut and not unknown,computation_bound_reached=bool(cut),frontier=cut)


def _domain(request,operation):
    candidates=[];count=0;cuts=[];boundaries=[];witnesses=[]
    for model in request.models:
        if not model.launch_domain_complete:boundaries.append({'model_ref':model.model_ref,'reason':'calibrated_launch_domain_incomplete'})
        for index,launch in enumerate(model.launches):
            commands=launch.power_adjustment_inputs+(launch.fire_input_ref,)
            command_cost=len(commands)+len(model.restoration_inputs)
            if operation=='costed_aim_domain':
                if request.current_power_ref is None or request.remaining_trials is None or request.command_budget is None:return family_result(request,prerequisite_refs=('current_power_trials_command_budget',),domain_complete=False)
                if (request.retained_trial_reserve is None or request.future_trial_command_reserve is None
                        or request.trial_reserve_claim_ref not in request.scope.assumption_refs):
                    return family_result(request,prerequisite_refs=('current_supported_future_trial_and_command_reserve',),domain_complete=False)
                # Exact adjustment word is calibrated from this current power.
                if launch.adjustment_from_power_ref!=request.current_power_ref or (not launch.power_adjustment_inputs and launch.power_ref!=request.current_power_ref):boundaries.append({'launch_ref':launch.launch_ref,'reason':'power_adjustment_word'});continue
                if (request.remaining_trials-model.trial_cost<request.retained_trial_reserve
                        or command_cost+request.future_trial_command_reserve>request.command_budget):continue
            packet,work,debt,cut=_shot(request,model,launch,request.maximum_evaluations-count);count+=work
            if cut:cuts.append({'model_ref':model.model_ref,'next_launch_index':index,'frontier':cut})
            if debt:boundaries.append({'launch_ref':launch.launch_ref,'prerequisite_refs':debt})
            sequence_ok=request.required_portal_sequences is None or packet['portal_sequence'] in request.required_portal_sequences
            row={'model_ref':model.model_ref,'launch_ref':launch.launch_ref,'ray_ref':launch.ray_ref,
                'aim_payload_ref':launch.aim_payload_ref,'power_ref':launch.power_ref,
                'initial_motion':launch.motion,'command_cost_on_hit':len(commands),'command_reserve_with_restore':command_cost,
                'packet':packet,'portal_sequence_satisfied':sequence_ok,'complete_conditional_flight':not debt and not cut,
                'retained_trial_reserve':request.retained_trial_reserve,
                'future_trial_command_reserve':request.future_trial_command_reserve,'reset_power_ref':model.restored_power_ref}
            if operation=='parameter_discrimination' or (packet['outcome']=='HIT' and sequence_ok and not debt and not cut):
                candidates.append(row)
                if operation!='parameter_discrimination' and len(witnesses)<3:
                    witnesses.append({'model_ref':model.model_ref,'launch_ref':launch.launch_ref,
                        'command_word':commands,'command_payload_refs':launch.command_payload_refs,
                        'outcome':packet['outcome'],'portal_sequence':packet['portal_sequence']})
            if count>=request.maximum_evaluations:
                cuts.append({'phase':'launch_domain','model_ref':model.model_ref,'next_launch_index':index+1});break
        if count>=request.maximum_evaluations:break
    probes=[]
    if operation=='parameter_discrimination':
        keys=tuple(dict.fromkeys((row['aim_payload_ref'],row['power_ref']) for row in candidates))
        for key_index,key in enumerate(keys):
            if count+len(candidates)>request.maximum_evaluations:
                cuts.append({'phase':'parameter_probe_join','next_key_index':key_index});break
            count+=len(candidates)
            rows=tuple(row for row in candidates if (row['aim_payload_ref'],row['power_ref'])==key)
            complete=all(row['complete_conditional_flight'] for row in rows) and len({row['model_ref'] for row in rows})==len(request.models)
            signatures=tuple((row['model_ref'],row['packet']['outcome'],row['packet']['portal_sequence'],row['packet']['after_motion'].position) for row in rows)
            distinguishing=complete and len({s[1:] for s in signatures})>1
            probes.append({'aim_power':key,'predicted_outcomes':signatures,'discriminates_supplied_models':distinguishing,'obstacle_stop_is_unobserved_range':False,'command_reserves':tuple(row['command_reserve_with_restore'] for row in rows)})
    contrasts=[]
    if operation=='parameter_discrimination':
        from .ballistic_parameter_contrasts_d import measure_ballistic_parameter_contrasts_d
        contrasts,work,bounded=measure_ballistic_parameter_contrasts_d(candidates,request.maximum_evaluations-count)
        count+=work
        if bounded:cuts.append({'phase':'separate_parameter_contrasts'})
    return family_result(request,values={'launch_candidates':candidates,'executable_witnesses':witnesses,
        'parameter_probes':probes,'separate_parameter_contrasts':contrasts,
        'observation_boundaries':boundaries,'minimum_cost_proved':False,'robust_coverage_proved':False},examined_count=count,
        domain_complete=not cuts and not boundaries,computation_bound_reached=bool(cuts),frontier={'cuts':cuts} if cuts else {})


def _compare(request):
    a=request.expected_trace;b=request.actual_trace
    current=(a is not None and b is not None and a.sealed and b.sealed and a.event_owner_ref==b.event_owner_ref==request.scope.event_owner_ref
        and a.epoch==b.epoch==request.scope.epoch and a.input_ref==b.input_ref and a.evidence_revision_ref==b.evidence_revision_ref==request.scope.evidence_revision_ref
        and a.model_revision_ref==b.model_revision_ref==request.scope.model_revision_ref)
    count=0;first=None;cut={}
    if current:
        for i in range(max(len(a.events),len(b.events))):
            if count>=request.maximum_evaluations:cut={'phase':'shot_compare','next_event_index':i};break
            left=a.events[i] if i<len(a.events) else None;right=b.events[i] if i<len(b.events) else None;count+=1
            if left!=right:first={'event_index':i,'expected':left,'actual':right};break
    def geometry(snapshot):
        return tuple(sorted((m.mask_ref,m.kind,tuple(sorted(tuple(map(Fraction,r)) for r in m.rectangles))) for m in snapshot.geometry))
    from .articulated_dependency_measurement_c import _nodes
    geometry_work=_nodes(immutable_json_data((request.expected_snapshot,request.actual_snapshot)),request.maximum_evaluations-count)
    if geometry_work is None or count+2*geometry_work>request.maximum_evaluations:
        return family_result(request,domain_complete=False,computation_bound_reached=True,
            frontier={'phase':'complete_restored_geometry_comparison'},examined_count=count)
    count+=2*geometry_work
    a_snapshot=request.expected_snapshot;b_snapshot=request.actual_snapshot
    geometry_changed=geometry(a_snapshot)!=geometry(b_snapshot)
    complete_geometry=all(getattr(snapshot,name) is not None for snapshot in (a_snapshot,b_snapshot)
        for name in ('source','launch_offset','portals','bounds'))
    from .ballistic_parameter_contrasts_d import canonical_ballistic_geometry_d
    full_geometry_changed=geometry_changed or canonical_ballistic_geometry_d(a_snapshot)!=canonical_ballistic_geometry_d(b_snapshot)
    fields=[]
    for name in ('power_ref','geometry','source','launch_offset','portals','bounds','level_scope_ref','remaining_trials'):
        left=getattr(request.expected_snapshot,name);right=getattr(request.actual_snapshot,name)
        if geometry_changed if name=='geometry' else left!=right:fields.append((name,left,right))
    return family_result(request,values={'first_owned_flight_divergence':first,'actual_restore_differences':fields,'geometry_changed':geometry_changed,
        'full_geometry_changed':full_geometry_changed,'complete_current_restore_geometry':complete_geometry,
        'revision_counter_is_geometry_change':False,'owned_sealed_trace_current':current},
        prerequisite_refs=tuple((*(() if current else ('current_owned_sealed_shot_trace',)),
            *(() if complete_geometry else ('current_source_terrain_target_portal_restore_geometry',)))),
        examined_count=count,domain_complete=current and complete_geometry and not cut,computation_bound_reached=bool(cut),frontier=cut)


def measure_ballistic_targeting(request: BallisticRequest) -> MechanicalFamilyResult:
    if request.mode is None or OPERATION_MODES.get(request.operation_ref)!=request.mode:return family_result(request,signature_supported=False,domain_complete=False)
    op=request.operation_ref
    required={'flight_layers':('raw_layer_pixels','layer_templates'),'launch_map':('models','observations'),'free_flight_fit':('models','free_candidates','observations'),
        'swept_contacts':('models','bound_model_ref','motion','next_center'),'portal_transport':('models','bound_model_ref','motion','portal_entry_ref'),
        'shot_successor':('models','bound_model_ref','input_launch_ref'),'target_preimages':('models',),'parameter_discrimination':('models',),
        'costed_aim_domain':('models','current_power_ref','remaining_trials','command_budget'),'shot_compare_restore':('expected_snapshot','actual_snapshot')}
    missing=missing_supplied_fields(request,required[op])
    if missing:return family_result(request,prerequisite_refs=missing,domain_complete=False)
    if op=='flight_layers':
        # Keep all translated sprite-center alternatives; role labels remain hypotheses.
        measured=translated_layers(request)
        values=dict(measured.values);templates={t.template_ref:t for t in request.layer_templates};rows=values.get('measured_layer_alternatives',())+values.get('possible_layer_alternatives',())
        centers=[]
        for row in rows:
            template=templates[row['template_ref']]
            center=None if template.center_offset is None else _wire(_add(tuple(Fraction(x) for x in template.origin),_v(template.center_offset)))
            centers.append({'physical_measurement':row,'component_candidate':template.component,'center_candidate':center,'logical_collision_mask_inferred':False})
        return measured.model_copy(update={'values':immutable_json_data({**values,'tracked_center_alternatives':centers,'drawing_is_collision_mask':False,'edge_is_projectile_center':False})})
    if op!='shot_compare_restore' and not request.models:return family_result(request,prerequisite_refs=('supplied_ballistic_models',),domain_complete=False)
    if op in ('launch_map','free_flight_fit'):return _fit(request,op=='free_flight_fit')
    if op in ('target_preimages','parameter_discrimination','costed_aim_domain'):return _domain(request,op)
    if op=='shot_compare_restore':return _compare(request)
    model=next((m for m in request.models if m.model_ref==request.bound_model_ref),None)
    if model is None:return family_result(request,prerequisite_refs=('bound_whole_ballistic_model',),domain_complete=False)
    if op=='swept_contacts':
        contact,count,cut,debt=_contacts(request.motion,request.next_center,model,request.maximum_evaluations)
        if not model.geometry_complete:debt=debt+('complete_logical_collision_field',)
        return family_result(request,values={'earliest_contact':contact,'external_command_count':0},prerequisite_refs=debt,examined_count=count,domain_complete=not cut and not debt,computation_bound_reached=bool(cut),frontier=cut)
    if op=='portal_transport':
        after,debt=_transport(request.motion,model,request.portal_entry_ref)
        return family_result(request,values={'after_motion':after,'jump_swept_through_terrain':False,'external_command_count':0},prerequisite_refs=debt)
    launch=next((l for l in model.launches if l.launch_ref==request.input_launch_ref),None)
    if launch is None:return family_result(request,prerequisite_refs=('grounded_calibrated_launch',),domain_complete=False)
    packet,count,debt,cut=_shot(request,model,launch,request.maximum_evaluations)
    return family_result(request,values={'shot_packet':packet,'external_command_count':len(launch.power_adjustment_inputs)+1,'event_owner_ref':request.scope.event_owner_ref},prerequisite_refs=debt,
        examined_count=count,domain_complete=not cut and not debt,computation_bound_reached=bool(cut),frontier=cut)
