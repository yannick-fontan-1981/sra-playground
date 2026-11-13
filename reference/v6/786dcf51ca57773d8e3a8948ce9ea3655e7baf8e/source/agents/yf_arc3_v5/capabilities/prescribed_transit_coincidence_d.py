"""Date policy-fixed routes; first-arrival events are not exit occupancy."""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result, d_input_digest


class EntryGateD(FrozenModel):
    cell_ref: Ref
    period: int = Field(ge=1)
    open_phases: tuple[int,...] = Field(default=(),max_length=4096)

    @model_validator(mode='after')
    def phases(self):
        if len(set(self.open_phases))!=len(self.open_phases) or any(p<0 or p>=self.period for p in self.open_phases):
            raise ValueError('gate phase domain invalid')
        return self


class FixedTransitActorD(FrozenModel):
    actor_ref: Ref
    route: tuple[Ref,...] = Field(min_length=1,max_length=4096)
    departure_tick: int = Field(ge=0)
    transition_ticks: tuple[int,...] = Field(default=(),max_length=4096)
    exit_ref: Ref
    prior_first_arrival_tick: int | None = Field(default=None,ge=0)

    @model_validator(mode='after')
    def durations(self):
        if len(self.transition_ticks)!=len(self.route)-1 or any(t<0 for t in self.transition_ticks):
            raise ValueError('each prescribed route transition needs its exact duration')
        return self


class PrescribedTransitCoincidenceRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.prescribed_transit_coincidence_request_d.v1'
    phase_ref: Literal['PRESCRIBED_TIMED_ROUTES']
    actors: tuple[FixedTransitActorD,...] = Field(min_length=1,max_length=128)
    gates: tuple[EntryGateD,...] = Field(default=(),max_length=4096)
    dwell_ticks: tuple[tuple[Ref,int],...] = Field(default=(),max_length=4096)
    timing_rule: Literal['CHECK_DEPARTURE_THEN_TRAVEL','CHECK_ARRIVAL_BEFORE_ENTRY']
    required_actor_refs: tuple[Ref,...] = Field(min_length=1,max_length=128)
    stop_actor_at_first_arrival: bool
    commanded_edit_count: int = Field(ge=0)
    elapsed_tick_limit: int = Field(ge=0)
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = (
        ('mechanics.clock_event_model.prescribed_transit_coincidence','EVALUATE'),
    )

    @model_validator(mode='after')
    def identities(self):
        ids={a.actor_ref for a in self.actors}
        if len(ids)!=len(self.actors) or len({g.cell_ref for g in self.gates})!=len(self.gates):
            raise ValueError('actor/gate identity duplicated')
        if not set(self.required_actor_refs)<=ids or len(set(self.required_actor_refs))!=len(self.required_actor_refs):
            raise ValueError('coincidence actor domain invalid')
        if len({r for r,_ in self.dwell_ticks})!=len(self.dwell_ticks) or any(t<0 for _,t in self.dwell_ticks):
            raise ValueError('destination dwell must be a finite nonnegative function')
        return self


def measure_prescribed_transit_coincidence_d(request: PrescribedTransitCoincidenceRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:
        return refusal
    if max(sum(len(a.route) for a in request.actors),sum(len(g.open_phases) for g in request.gates),len(request.dwell_ticks))>request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    budget,rows=DWorkBudget(request),[]
    if request.resume_frontier:
        f=request.resume_frontier
        if f.get('input_digest')!=d_input_digest(request):
            return d_result(request,'NEEDS_EVIDENCE','RESUME_INPUT_OR_REVISION_MISMATCH')
        rows=list(f.get('completed_actor_rows',()))
        if len(rows)>len(request.actors) or any(r['actor_ref']!=a.actor_ref for r,a in zip(rows,request.actors)):
            return d_result(request,'NEEDS_EVIDENCE','RESUME_ACTOR_PREFIX_MISMATCH')
    try:
        gates={g.cell_ref:g for g in request.gates}
        dwell=dict(request.dwell_ticks)
        bounded=False
        for actor in request.actors[len(rows):]:
            tick=actor.departure_tick
            first=actor.prior_first_arrival_tick
            itinerary,cause=[],None
            for rank,duration in enumerate(actor.transition_ticks):
                if first is not None and request.stop_actor_at_first_arrival:
                    break
                if rank>=request.depth_bound:
                    cause='ROUTE_DEPTH_BOUND'
                    bounded=True
                    break
                budget.visit({'stage':'attempted_entry','actor_ref':actor.actor_ref,'route_index':rank+1})
                destination=actor.route[rank+1]
                attempt=tick if request.timing_rule=='CHECK_DEPARTURE_THEN_TRAVEL' else tick+duration
                wait=0
                gate=gates.get(destination)
                if gate is not None:
                    if not gate.open_phases:
                        cause='PERMANENTLY_CLOSED_ENTRY_GATE'
                        break
                    waits=[]
                    for phase in gate.open_phases:
                        budget.visit({'stage':'entry_gate_phase','actor_ref':actor.actor_ref,'cell_ref':destination})
                        waits.append((phase-attempt%gate.period)%gate.period)
                    wait=min(waits)
                arrival=attempt+wait+(duration if request.timing_rule=='CHECK_DEPARTURE_THEN_TRAVEL' else 0)
                if arrival-actor.departure_tick>request.elapsed_tick_limit:
                    cause='ELAPSED_TICK_BOUND'
                    bounded=True
                    break
                if destination==actor.exit_ref and first is None:
                    first=arrival
                itinerary.append({'from_ref':actor.route[rank],'to_ref':destination,'attempt_tick':attempt,
                    'required_gate_wait_ticks':wait,'travel_ticks':duration,'arrival_tick':arrival,
                    'destination_dwell_ticks':dwell.get(destination,0)})
                tick=arrival+dwell.get(destination,0)
            rows.append({'actor_ref':actor.actor_ref,'dated_itinerary':tuple(itinerary),'first_arrival_tick':first,
                'route_edge_count':len(actor.transition_ticks),'dated_transition_count':len(itinerary),
                'elapsed_ticks':tick-actor.departure_tick,'nonarrival_or_bound_cause':cause if cause else
                    ('NO_FIRST_ARRIVAL_EVENT' if first is None else None)})
            if bounded:
                break
        cohorts={}
        for row in rows:
            if row['first_arrival_tick'] is not None:
                cohorts.setdefault(row['first_arrival_tick'],[]).append(row['actor_ref'])
        by_actor={r['actor_ref']:r for r in rows}
        required=[r for r in rows if r['actor_ref'] in request.required_actor_refs]
        missing=tuple(ref for ref in request.required_actor_refs if ref not in by_actor or by_actor[ref]['first_arrival_tick'] is None)
        coincidence=None if bounded else (not missing and len({r['first_arrival_tick'] for r in required})==1)
        budget.finish()
        return d_result(request,'NEEDS_EVIDENCE' if bounded else 'COMPLETE',
            'TIMED_ROUTE_BOUND' if bounded else 'FIRST_ARRIVAL_COINCIDENCE_RESULT',complete=not bounded,examined=budget.examined,
            values={'actor_rows':tuple(rows),'first_arrival_cohorts':tuple({'tick':t,'actor_refs':tuple(cohorts[t])} for t in sorted(cohorts)),
                'missing_first_arrival_actor_refs':missing,'required_first_arrivals_coincide':coincidence,
                'commanded_edit_count':request.commanded_edit_count,'extra_world_passes':0,'movement_debits_added':0},
            frontier={'input_digest':d_input_digest(request),'completed_actor_rows':tuple(rows[:-1]),
                'restart_unfinished_actor':True} if bounded else {})
    except DComputationInterrupted as error:
        return d_result(request,'NEEDS_EVIDENCE',error.cause,examined=budget.examined,
            frontier={'input_digest':d_input_digest(request),'completed_actor_rows':tuple(rows),'restart_unfinished_actor':True,'work':error.frontier})
