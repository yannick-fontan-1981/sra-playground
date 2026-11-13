"""Exact periodic sampling and correlated finite phase preimages."""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result, d_input_digest


class PeriodicProfileLawD(FrozenModel):
    law_ref: Ref
    track_ref: Ref
    period: int = Field(ge=1,le=4096)
    samples: tuple[int,...] = Field(min_length=1,max_length=4096)
    index_offset: int
    phase_sign: Literal[-1,1]

    @model_validator(mode='after')
    def full_period(self):
        if len(self.samples)!=self.period:
            raise ValueError('candidate law requires one complete indexed period')
        return self


class ProfileSampleReceiptD(FrozenModel):
    evidence_ref: Ref
    track_ref: Ref
    index: int
    value: int
    sealed: bool
    epoch: int = Field(ge=0)


class ProfilePhaseAssignmentD(FrozenModel):
    assignment_ref: Ref
    track_law_phases: tuple[tuple[Ref,Ref,int],...] = Field(min_length=1,max_length=128)


class ProfileDetectorD(FrozenModel):
    detector_ref: Ref
    column: int
    target_value: int | None


class PeriodicProfilePreimagesRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.periodic_profile_preimages_request_d.v1'
    phase_ref: Literal['SEALED_PROFILE_FIT','CORRELATED_PHASE_DOMAIN']
    track_refs: tuple[Ref,...] = Field(min_length=1,max_length=128)
    laws: tuple[PeriodicProfileLawD,...] = Field(min_length=1,max_length=128)
    observed_samples: tuple[ProfileSampleReceiptD,...] = Field(default=(),max_length=4096)
    assignments: tuple[ProfilePhaseAssignmentD,...] = Field(default=(),max_length=4096)
    detectors: tuple[ProfileDetectorD,...] = Field(default=(),max_length=128)
    assignment_domain_complete: bool
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = tuple(
        ('mechanics.coupled_value_constraints.periodic_profile_preimages',mode)
        for mode in ('FIT','EVALUATE','INVERSE_DOMAIN'))

    @model_validator(mode='after')
    def correlated_domain(self):
        tracks,laws = set(self.track_refs),{l.law_ref:l for l in self.laws}
        if len(tracks)!=len(self.track_refs) or len(laws)!=len(self.laws) or any(l.track_ref not in tracks for l in self.laws):
            raise ValueError('profile identity domain invalid')
        if len({a.assignment_ref for a in self.assignments})!=len(self.assignments) or len({d.detector_ref for d in self.detectors})!=len(self.detectors):
            raise ValueError('assignment/detector identity duplicated')
        for assignment in self.assignments:
            rows=assignment.track_law_phases
            if len(rows)!=len(tracks) or {r[0] for r in rows}!=tracks or any(law not in laws or laws[law].track_ref!=track or
                    phase<0 or phase>=laws[law].period for track,law,phase in rows):
                raise ValueError('assignment must bind each persistent track to its own admitted profile and phase')
        if any(s.track_ref not in tracks for s in self.observed_samples):
            raise ValueError('observed sample track absent')
        if self.mode_ref=='FIT' and self.phase_ref!='SEALED_PROFILE_FIT' or self.mode_ref!='FIT' and self.phase_ref!='CORRELATED_PHASE_DOMAIN':
            raise ValueError('profile operation phase mismatch')
        return self


def measure_periodic_profile_preimages_d(request: PeriodicProfilePreimagesRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:
        return refusal
    if max(len(request.assignments),len(request.observed_samples),sum(len(l.samples) for l in request.laws))>request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    budget=DWorkBudget(request)
    rows,index=[],0
    if request.resume_frontier:
        f=request.resume_frontier
        if f.get('input_digest')!=d_input_digest(request):
            return d_result(request,'NEEDS_EVIDENCE','RESUME_INPUT_OR_REVISION_MISMATCH')
        rows=list(f.get('completed_rows',()))
        index=len(rows)
    try:
        if request.mode_ref=='FIT':
            actual=[s for s in request.observed_samples if s.sealed and s.epoch==request.scope.epoch]
            if not actual:
                return d_result(request,'NEEDS_EVIDENCE','SEALED_PROFILE_SAMPLES_REQUIRED')
            if index>len(request.laws) or any(r['law_ref']!=law.law_ref for r,law in zip(rows,request.laws)):
                return d_result(request,'NEEDS_EVIDENCE','RESUME_PROFILE_PREFIX_MISMATCH')
            for law in request.laws[index:]:
                contradictions,checked=[],[]
                for sample in actual:
                    if sample.track_ref!=law.track_ref:
                        continue
                    budget.visit({'stage':'observed_period','law_ref':law.law_ref,'evidence_ref':sample.evidence_ref})
                    checked.append(sample.evidence_ref)
                    if law.samples[(sample.index+law.index_offset)%law.period]!=sample.value:
                        contradictions.append(sample.evidence_ref)
                rows.append({'law_ref':law.law_ref,'track_ref':law.track_ref,'period':law.period,
                    'checked_evidence_refs':tuple(checked),'contradicting_evidence_refs':tuple(contradictions)})
            values={'law_results':tuple(rows),'consistent_law_refs':tuple(r['law_ref'] for r in rows if not r['contradicting_evidence_refs']),
                'unique_period_proved':False}
        else:
            if not request.assignments or not request.detectors or not request.assignment_domain_complete:
                return d_result(request,'NEEDS_EVIDENCE','CORRELATED_ASSIGNMENT_OR_DETECTOR_DOMAIN_INCOMPLETE')
            if request.mode_ref=='INVERSE_DOMAIN' and any(d.target_value is None for d in request.detectors):
                return d_result(request,'NEEDS_EVIDENCE','TARGET_VALUES_NOT_BOUND')
            if index>len(request.assignments) or any(r['assignment_ref']!=a.assignment_ref for r,a in zip(rows,request.assignments)):
                return d_result(request,'NEEDS_EVIDENCE','RESUME_ASSIGNMENT_PREFIX_MISMATCH')
            laws={l.law_ref:l for l in request.laws}
            for assignment in request.assignments[index:]:
                effects=[]
                for detector in request.detectors:
                    contributions=[]
                    for track,ref,phase in assignment.track_law_phases:
                        budget.visit({'stage':'wrapped_sample','assignment_ref':assignment.assignment_ref,'detector_ref':detector.detector_ref,'track_ref':track})
                        law=laws[ref]
                        coordinate=(detector.column+law.index_offset+law.phase_sign*phase)%law.period
                        contributions.append({'track_ref':track,'law_ref':ref,'phase':phase,'sample_index':coordinate,'value':law.samples[coordinate]})
                    total=sum(c['value'] for c in contributions)
                    effects.append({'detector_ref':detector.detector_ref,'contributions':tuple(contributions),'total':total,
                        'target_hit':None if detector.target_value is None else total==detector.target_value})
                rows.append({'assignment_ref':assignment.assignment_ref,'detector_results':tuple(effects),
                    'all_target_hits':all(e['target_hit'] is True for e in effects)})
            values={'correlated_assignment_results':tuple(rows),'joint_preimage_assignment_refs':tuple(r['assignment_ref'] for r in rows if r['all_target_hits']),
                'equal_totals_merge_phase_states':False,'domain_is_independently_supplied_not_a_collective_orbit':True}
        budget.finish()
        return d_result(request,'COMPLETE','PERIODIC_PROFILE_RESULT',complete=True,examined=budget.examined,values=values)
    except DComputationInterrupted as error:
        return d_result(request,'NEEDS_EVIDENCE',error.cause,examined=budget.examined,
            frontier={'input_digest':d_input_digest(request),'completed_rows':tuple(rows),'restart_unfinished_row':True,'work':error.frontier})
