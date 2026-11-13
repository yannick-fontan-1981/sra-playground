"""Nearest-occupant short/ray captures with distinct passage and landing laws."""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result


class CaptureBodyD(FrozenModel):
    member_ref: Ref
    type_ref: Ref
    rank: int
    origin: tuple[int,int]
    occupied_offsets: tuple[tuple[int,int],...] = Field(min_length=1,max_length=4096)


class ShortCaptureRelationD(FrozenModel):
    relation_ref: Ref
    intermediate_delta: tuple[int,int]
    landing_delta: tuple[int,int]


class RayCaptureDomainRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.ray_capture_domain_request_d.v1'
    phase_ref: Literal['CURRENT_CAPTURE_DOMAIN']
    population: tuple[CaptureBodyD,...] = Field(min_length=1,max_length=4096)
    native_focus_ref: Ref
    board_cells: tuple[tuple[int,int],...] = Field(min_length=1,max_length=4096)
    ray_passage_cells: tuple[tuple[int,int],...] = Field(default=(),max_length=4096)
    landing_support_cells: tuple[tuple[int,int],...] = Field(default=(),max_length=4096)
    eligible_victim_refs: tuple[Ref,...] = Field(default=(),max_length=4096)
    range_kind: Literal['SHORT','RAY']
    range_law_evidence_ref: Ref
    range_law_rank: int
    directions: tuple[tuple[int,int],...] = Field(default=(),max_length=64)
    short_relations: tuple[ShortCaptureRelationD,...] = Field(default=(),max_length=128)
    maximum_ray_distance: int | None = Field(default=None,ge=1)
    proposed_landing: tuple[int,int] | None
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = (
        ('mechanics.typed_jump_carriers.ray_capture_domain','DOMAIN'),
        ('mechanics.typed_jump_carriers.ray_capture_domain','PRECONDITION'),
    )

    @model_validator(mode='after')
    def population_domain(self):
        members={b.member_ref for b in self.population}
        if len(members)!=len(self.population) or self.native_focus_ref not in members or not set(self.eligible_victim_refs)<=members:
            raise ValueError('capture population/focus identity invalid')
        if any(v==(0,0) or max(abs(v[0]),abs(v[1]))!=1 for v in self.directions):
            raise ValueError('ray directions must be supplied unit lattice directions')
        occupied=[]
        for body in self.population:
            if len(set(body.occupied_offsets))!=len(body.occupied_offsets):
                raise ValueError('physical body footprint duplicated')
            occupied.extend((body.origin[0]+x,body.origin[1]+y) for x,y in body.occupied_offsets)
        if len(set(occupied))!=len(occupied):
            raise ValueError('overlapping logical occupant masks require separate model assignments')
        return self


def _capture_landings(request,budget):
    bodies={b.member_ref:b for b in request.population}
    actor=bodies[request.native_focus_ref]
    if actor.rank!=request.range_law_rank:
        return [],[{'code':'RANGE_LAW_RANK_SCOPE_MISMATCH'}],False
    board,passage,support=set(request.board_cells),set(request.ray_passage_cells),set(request.landing_support_cells)
    occupied={}
    for body in request.population:
        for x,y in body.occupied_offsets:
            budget.visit({'stage':'logical_occupancy','member_ref':body.member_ref})
            occupied[(body.origin[0]+x,body.origin[1]+y)]=body.member_ref
    rows,witnesses=[],[]

    def append_landing(victim,point,relation_ref,distance):
        footprint=[]
        for x,y in actor.occupied_offsets:
            budget.visit({'stage':'complete_landing_mask','victim_ref':victim})
            footprint.append((point[0]+x,point[1]+y))
        rejected=tuple(sorted(set(footprint)-support))
        collision=tuple(p for p in footprint if occupied.get(p) not in (None,actor.member_ref,victim))
        if rejected or collision:
            witnesses.append({'code':'LANDING_PERMISSION_OR_OCCUPANCY','landing':point,'rejected_support_cells':rejected,'collision_cells':collision})
        else:
            rows.append({'actor_ref':actor.member_ref,'victim_ref':victim,'landing':point,
                'relation_ref':relation_ref,'ray_distance':distance})

    if request.range_kind=='SHORT':
        for relation in request.short_relations:
            budget.visit({'stage':'short_capture','relation_ref':relation.relation_ref})
            middle=(actor.origin[0]+relation.intermediate_delta[0],actor.origin[1]+relation.intermediate_delta[1])
            landing=(actor.origin[0]+relation.landing_delta[0],actor.origin[1]+relation.landing_delta[1])
            victim=occupied.get(middle)
            if middle not in board or landing not in board or occupied.get(landing) is not None or victim not in request.eligible_victim_refs or victim==actor.member_ref:
                witnesses.append({'code':'SHORT_INTERMEDIATE_INELIGIBLE','relation_ref':relation.relation_ref,'intermediate':middle,'victim_ref':victim})
            else:
                append_landing(victim,landing,relation.relation_ref,None)
    else:
        for direction in request.directions:
            victim=None
            stopped=False
            for distance in range(1,request.depth_bound+1):
                budget.visit({'stage':'ordered_ray','direction':direction,'distance':distance})
                point=(actor.origin[0]+distance*direction[0],actor.origin[1]+distance*direction[1])
                if request.maximum_ray_distance is not None and distance>request.maximum_ray_distance:
                    stopped=True
                    break
                if point not in board or point not in passage:
                    witnesses.append({'code':'RAY_BOUNDARY_OR_PASSAGE','point':point,'direction':direction})
                    stopped=True
                    break
                occupant=occupied.get(point)
                if occupant==actor.member_ref or occupant is not None and occupant==victim:
                    continue
                if occupant is not None:
                    if victim is not None or occupant not in request.eligible_victim_refs:
                        witnesses.append({'code':'NEAREST_OR_SECOND_OCCUPANT_BLOCKS','point':point,'member_ref':occupant,'direction':direction})
                        stopped=True
                        break
                    victim=occupant
                elif victim is not None:
                    append_landing(victim,point,None,distance)
            if not stopped and (request.maximum_ray_distance is None or request.depth_bound<request.maximum_ray_distance):
                raise DComputationInterrupted('RAY_DEPTH_BOUND',{'direction':direction})
    return rows,witnesses,True


def measure_ray_capture_domain_d(request: RayCaptureDomainRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:
        return refusal
    if max(len(request.board_cells),len(request.ray_passage_cells),len(request.landing_support_cells),sum(len(b.occupied_offsets) for b in request.population))>request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    if request.mode_ref=='PRECONDITION' and request.proposed_landing is None:
        return d_result(request,'NEEDS_EVIDENCE','PROPOSED_LANDING_NOT_BOUND')
    if request.resume_frontier:
        return d_result(request,'NEEDS_EVIDENCE','RESTART_CAPTURE_DOMAIN_FROM_BOUND_POPULATION')
    budget=DWorkBudget(request)
    try:
        rows,witnesses,qualified=_capture_landings(request,budget)
        budget.finish()
        return d_result(request,'COMPLETE' if qualified else 'NEEDS_EVIDENCE','CAPTURE_DOMAIN' if qualified else 'RANGE_LAW_SCOPE_MISMATCH',
            complete=qualified,examined=budget.examined,values={'capture_incidences':tuple(rows),'limiting_witnesses':tuple(witnesses),
                'proposed_landing_admitted':None if request.proposed_landing is None else any(r['landing']==request.proposed_landing for r in rows),
                'later_terminal_class_not_evaluated':True,'adversarial_turn_added':False})
    except DComputationInterrupted as error:
        return d_result(request,'NEEDS_EVIDENCE',error.cause,examined=budget.examined,
            frontier={'restart_capture_domain':True,'work':error.frontier})
