"""Sealed subset feedback versus labelled read-only predictions."""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result


class FaultAssignmentD(FrozenModel):
    assignment_ref: Ref
    law_ref: Ref
    fault_member_refs: tuple[Ref,...] = Field(min_length=1,max_length=4096)

    @model_validator(mode='after')
    def distinct_members(self):
        if len(set(self.fault_member_refs))!=len(self.fault_member_refs):
            raise ValueError('fault assignment repeats a member')
        return self


class SubsetLawD(FrozenModel):
    law_ref: Ref
    predicate: Literal['ANY','ALL','COUNT','PARITY']
    # Explicit observed-law output labels, including their transient order.
    feedback_by_value: tuple[tuple[int,tuple[Ref,...]],...] = Field(min_length=1,max_length=4096)
    law_evidence_ref: Ref

    @model_validator(mode='after')
    def finite_function(self):
        values = [v for v,_ in self.feedback_by_value]
        if len(set(values))!=len(values) or any(v<0 or not sequence or len(sequence)>64 for v,sequence in self.feedback_by_value):
            raise ValueError('feedback law must be a finite single-valued sequence function')
        return self


class SubsetReceiptD(FrozenModel):
    receipt_ref: Ref
    epoch: int = Field(ge=0)
    evidence_revision_ref: Ref
    tested_member_refs: tuple[Ref,...] = Field(default=(),max_length=4096)
    ordered_feedback: tuple[Ref,...] = Field(min_length=1,max_length=64)
    sealed: bool
    positive_singleton_confirmation: bool

    @model_validator(mode='after')
    def actual_subset(self):
        if len(set(self.tested_member_refs))!=len(self.tested_member_refs):
            raise ValueError('actual tested subset repeats a member')
        if self.positive_singleton_confirmation and len(self.tested_member_refs)!=1:
            raise ValueError('positive singleton confirmation must concern one member')
        return self


class SubsetObservationRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.subset_observation_request_d.v1'
    phase_ref: Literal['SEALED_FEEDBACK','READ_ONLY_PREDICTION']
    member_refs: tuple[Ref,...] = Field(min_length=1,max_length=4096)
    assignments: tuple[FaultAssignmentD,...] = Field(min_length=1,max_length=4096)
    laws: tuple[SubsetLawD,...] = Field(min_length=1,max_length=128)
    tested_member_refs: tuple[Ref,...] = Field(default=(),max_length=4096)
    query_currently_realizable: bool
    receipts: tuple[SubsetReceiptD,...] = Field(default=(),max_length=4096)
    filter_receipt_ref: Ref | None
    positive_singleton_confirmation_required: bool
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = tuple(
        ('mechanics.feedback_code_identification.subset_observation',mode)
        for mode in ('FIT','EVALUATE','FILTER','PARTITION'))

    @model_validator(mode='after')
    def domains(self):
        members,laws = set(self.member_refs),{l.law_ref for l in self.laws}
        if len(members)!=len(self.member_refs) or len(laws)!=len(self.laws) or len({a.assignment_ref for a in self.assignments})!=len(self.assignments):
            raise ValueError('feedback domain identities duplicated')
        if not set(self.tested_member_refs)<=members or len(set(self.tested_member_refs))!=len(self.tested_member_refs):
            raise ValueError('actual tested subset outside member domain')
        for assignment in self.assignments:
            if assignment.law_ref not in laws or not set(assignment.fault_member_refs)<=members or len(set(assignment.fault_member_refs))!=len(assignment.fault_member_refs):
                raise ValueError('fault/law correlation outside domain')
        for law in self.laws:
            values = [v for v,_ in law.feedback_by_value]
            if len(set(values))!=len(values) or any(v<0 or not sequence or len(sequence)>64 for v,sequence in law.feedback_by_value):
                raise ValueError('feedback law is not a finite function')
        if len({r.receipt_ref for r in self.receipts})!=len(self.receipts) or any(not set(r.tested_member_refs)<=members for r in self.receipts):
            raise ValueError('receipt identity/subset outside domain')
        if self.mode_ref in ('FIT','FILTER') and self.phase_ref!='SEALED_FEEDBACK':
            raise ValueError('posterior operations require the sealed-observation phase')
        if self.mode_ref in ('EVALUATE','PARTITION') and self.phase_ref!='READ_ONLY_PREDICTION':
            raise ValueError('predictions cannot masquerade as actual feedback')
        return self


def _predict_subset(assignment,law,tested):
    count = len(set(assignment.fault_member_refs)&set(tested))
    if law.predicate=='ANY':
        value = int(count>0)
    elif law.predicate=='ALL':
        value = int(set(assignment.fault_member_refs)<=set(tested))
    elif law.predicate=='PARITY':
        value = count%2
    else:
        value = count
    return dict(law.feedback_by_value).get(value)


def measure_subset_observation_d(request: SubsetObservationRequestD):
    refusal = d_validate_request(request)
    if refusal is not None:
        return refusal
    if max(len(request.member_refs),len(request.assignments),len(request.receipts),sum(len(l.feedback_by_value) for l in request.laws))>request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    if request.resume_frontier:
        return d_result(request,'NEEDS_EVIDENCE','RESTART_FEEDBACK_FROM_BOUND_INPUT')
    budget = DWorkBudget(request)
    try:
        receipts = [r for r in request.receipts if r.sealed and r.epoch==request.scope.epoch and
            r.evidence_revision_ref==request.scope.evidence_revision_ref]
        ignored = tuple(r.receipt_ref for r in request.receipts if r not in receipts)
        if request.mode_ref=='FILTER':
            receipts = [r for r in receipts if r.receipt_ref==request.filter_receipt_ref]
        posterior = request.mode_ref in ('FIT','FILTER')
        if posterior and not receipts:
            return d_result(request,'NEEDS_EVIDENCE','SEALED_ACTUAL_TEST_REQUIRED',examined=budget.examined,
                values={'ignored_receipt_refs':ignored})
        if request.mode_ref=='PARTITION' and not request.query_currently_realizable:
            return d_result(request,'NEEDS_EVIDENCE','QUERY_NOT_CURRENTLY_REALIZABLE')
        laws = {l.law_ref:l for l in request.laws}
        retained,eliminations,predictions,unresolved = [],[],[],[]
        for assignment in request.assignments:
            budget.visit({'stage':'fault_law_assignment','assignment_ref':assignment.assignment_ref})
            law = laws[assignment.law_ref]
            contradictions,missing = [],False
            if posterior:
                for receipt in receipts:
                    budget.visit({'stage':'sealed_test','receipt_ref':receipt.receipt_ref,'assignment_ref':assignment.assignment_ref})
                    feedback = _predict_subset(assignment,law,receipt.tested_member_refs)
                    if feedback is None:
                        missing = True
                    elif feedback != receipt.ordered_feedback:
                        contradictions.append(receipt.receipt_ref)
                if contradictions:
                    eliminations.append({'assignment_ref':assignment.assignment_ref,'law_ref':law.law_ref,
                        'contradicting_receipt_refs':tuple(contradictions)})
                else:
                    retained.append(assignment.assignment_ref)
                    if missing:
                        unresolved.append(assignment.assignment_ref)
            else:
                feedback = _predict_subset(assignment,law,request.tested_member_refs)
                predictions.append({'assignment_ref':assignment.assignment_ref,'law_ref':law.law_ref,
                    'tested_member_refs':request.tested_member_refs,'predicted_ordered_feedback':feedback,
                    'actual_receipt':False})
                retained.append(assignment.assignment_ref)
                if feedback is None:
                    unresolved.append(assignment.assignment_ref)
        groups = {}
        for prediction in predictions:
            feedback = prediction['predicted_ordered_feedback']
            if feedback is not None:
                groups.setdefault(feedback,[]).append(prediction['assignment_ref'])
        surviving = [a for a in request.assignments if a.assignment_ref in set(retained)]
        fault_sets = {tuple(sorted(a.fault_member_refs)) for a in surviving}
        known_fault = next(iter(fault_sets))[0] if len(fault_sets)==1 and len(next(iter(fault_sets)))==1 else None
        confirmed = (known_fault is not None and any(r.positive_singleton_confirmation and
            tuple(r.tested_member_refs)==(known_fault,) for r in receipts))
        budget.finish()
        contradiction = posterior and not retained
        return d_result(request,'NEEDS_EVIDENCE' if unresolved else 'COMPLETE',
            'MODEL_CONTRADICTION' if contradiction else ('FEEDBACK_LAW_INCOMPLETE' if unresolved else 'SUBSET_RESULT'),
            complete=not unresolved,examined=budget.examined,values={
                'retained_assignment_refs':tuple(retained),'retained_law_refs':tuple(sorted({a.law_ref for a in surviving})),
                'elimination_certificates':tuple(eliminations),'predictions':tuple(predictions),
                'partitions':tuple({'predicted_ordered_feedback':key,'assignment_refs':tuple(groups[key])} for key in sorted(groups)),
                'unresolved_assignment_refs':tuple(unresolved),'ignored_receipt_refs':ignored,
                'latent_singleton_member_ref':known_fault,'positive_singleton_confirmed':bool(confirmed),
                'outstanding_positive_confirmation':request.positive_singleton_confirmation_required and not confirmed,
                'posterior_updated_from_actual_receipts':posterior,'predictions_are_actual_receipts':False,
                'physical_no_solution_proved':False})
    except DComputationInterrupted as error:
        return d_result(request,'NEEDS_EVIDENCE',error.cause,examined=budget.examined,
            frontier={'restart_feedback':True,'work':error.frontier})
