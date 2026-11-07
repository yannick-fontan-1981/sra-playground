"""Paid object edits and provisional catalogue submissions, without oracle answers."""
from __future__ import annotations
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result


class CatalogueObjectD(FrozenModel):
    subject_ref: Ref
    origin: tuple[int, int]
    full_offsets: tuple[tuple[int, int], ...] = Field(min_length=1, max_length=4096)


class CatalogueEditD(FrozenModel):
    operator_ref: Ref
    subject_ref: Ref
    from_origin: tuple[int, int]
    to_origin: tuple[int, int]
    debit: int = Field(ge=0)
    admission_evidence_ref: Ref


class CatalogueAnswerD(FrozenModel):
    subject_ref: Ref
    answer_ref: Ref


class CatalogueVerdictD(FrozenModel):
    receipt_ref: Ref
    epoch: int = Field(ge=0)
    answer_rows: tuple[CatalogueAnswerD, ...] = Field(min_length=1, max_length=4096)
    verdict: Literal['ACCEPTED', 'REJECTED']
    boundary_ref: Ref


class CataloguePrimitiveRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.catalogue_primitive_request_d.v1'
    phase_ref: Literal['EXTERNAL_COMMAND']
    objects: tuple[CatalogueObjectD, ...] = Field(min_length=1, max_length=4096)
    native_focus_ref: Ref | None
    answer_catalogue_refs: tuple[Ref, ...] = Field(min_length=1, max_length=4096)
    provisional_answers: tuple[CatalogueAnswerD, ...] = Field(default=(), max_length=4096)
    edits: tuple[CatalogueEditD, ...] = Field(default=(), max_length=4096)
    channel: Literal['SELECT', 'TRANSLATE', 'RECORD_ANSWER', 'RESET']
    bound_subject_ref: Ref | None
    bound_operator_ref: Ref | None
    bound_answer_ref: Ref | None
    remaining_budget: int = Field(ge=0)
    submitted_debit: int = Field(ge=0)
    selection_debit: int = Field(ge=0)
    answer_debit: int = Field(ge=0)
    refused_debit: int = Field(ge=0)
    all_subjects_trigger_joint_verdict: bool
    observed_joint_verdict: CatalogueVerdictD | None
    rejected_verdict_restores: bool
    restored_origins: tuple[tuple[Ref,int,int], ...] = Field(default=(), max_length=4096)
    restored_answers: tuple[CatalogueAnswerD, ...] = Field(default=(), max_length=4096)
    restored_native_focus_ref: Ref | None
    signature_pairs: ClassVar[tuple[tuple[str,str], ...]] = (
        ('mechanics.editable_configuration_graph.catalogue_external_primitive', 'STEP'),
    )

    @model_validator(mode='after')
    def identities(self):
        ids = {o.subject_ref for o in self.objects}
        if len(ids) != len(self.objects):
            raise ValueError('object identity duplicated')
        for ref in (self.native_focus_ref,self.bound_subject_ref,self.restored_native_focus_ref):
            if ref is not None and ref not in ids:
                raise ValueError('bound object identity absent')
        for answers in (self.provisional_answers,self.restored_answers,
                self.observed_joint_verdict.answer_rows if self.observed_joint_verdict else ()):
            refs = [a.subject_ref for a in answers]
            if len(set(refs)) != len(refs) or not set(refs) <= ids or any(a.answer_ref not in self.answer_catalogue_refs for a in answers):
                raise ValueError('answer map is not one provisional catalogue binding per subject')
        if any(e.subject_ref not in ids for e in self.edits) or len({e.operator_ref for e in self.edits}) != len(self.edits):
            raise ValueError('edit operator domain invalid')
        if self.restored_origins and ({r[0] for r in self.restored_origins} != ids or len(self.restored_origins) != len(ids)):
            raise ValueError('restored configuration is incomplete or duplicated')
        return self


def measure_catalogue_primitive_d(request: CataloguePrimitiveRequestD):
    refusal = d_validate_request(request)
    if refusal is not None:
        return refusal
    if sum(len(o.full_offsets) for o in request.objects)+len(request.edits)+len(request.answer_catalogue_refs) > request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    if request.resume_frontier:
        return d_result(request,'NEEDS_EVIDENCE','ATOMIC_COMMAND_REQUIRES_RESTART_FROM_BOUND_INPUT')
    budget = DWorkBudget(request)
    poses = {o.subject_ref:o.origin for o in request.objects}
    answers = {a.subject_ref:a.answer_ref for a in request.provisional_answers}
    selected, debit, cause = request.native_focus_ref, request.submitted_debit, 'UNCHANGED'
    verdict, boundary = None, None
    try:
        budget.visit({'stage':'decode_bound_input'})
        edit = next((e for e in request.edits if e.operator_ref==request.bound_operator_ref),None)
        valid, extra = True, 0
        if request.channel == 'SELECT':
            valid, extra = request.bound_subject_ref is not None, request.selection_debit
        elif request.channel == 'TRANSLATE':
            valid = edit is not None and selected == edit.subject_ref and poses[edit.subject_ref] == edit.from_origin
            extra = edit.debit if valid else 0
        elif request.channel == 'RECORD_ANSWER':
            valid = selected is not None and selected == request.bound_subject_ref and request.bound_answer_ref in request.answer_catalogue_refs
            extra = request.answer_debit
        elif not request.restored_origins:
            return d_result(request,'NEEDS_EVIDENCE','RESET_LAW_MISSING',examined=budget.examined)
        if not valid or debit+extra > request.remaining_budget:
            debit += request.refused_debit
            cause = 'INPUT_REFUSAL' if not valid else 'BUDGET_REFUSAL'
        else:
            debit += extra
            if request.channel == 'SELECT':
                selected, cause = request.bound_subject_ref, 'OBJECT_SELECTED'
            elif request.channel == 'TRANSLATE':
                poses[edit.subject_ref], cause = edit.to_origin, 'PAID_TRANSLATION'
            elif request.channel == 'RECORD_ANSWER':
                answers[selected], cause = request.bound_answer_ref, 'PROVISIONAL_ANSWER_RECORDED'
            else:
                poses = {r:(x,y) for r,x,y in request.restored_origins}
                answers = {a.subject_ref:a.answer_ref for a in request.restored_answers}
                selected, cause = request.restored_native_focus_ref, 'RESTORED_CONFIGURATION'
        pre_verdict = {'poses':dict(poses),'provisional_answers':dict(answers)}
        pending = False
        if cause == 'PROVISIONAL_ANSWER_RECORDED' and request.all_subjects_trigger_joint_verdict and len(answers)==len(poses):
            receipt = request.observed_joint_verdict
            if receipt is None:
                pending = True
            elif receipt.epoch != request.scope.epoch or {a.subject_ref:a.answer_ref for a in receipt.answer_rows} != answers:
                return d_result(request,'NEEDS_EVIDENCE','JOINT_VERDICT_RECEIPT_SCOPE_MISMATCH',examined=budget.examined,
                    values={'submitted_configuration':pre_verdict})
            else:
                verdict, boundary = receipt.verdict, receipt.boundary_ref
                if verdict == 'REJECTED' and request.rejected_verdict_restores:
                    if not request.restored_origins:
                        return d_result(request,'NEEDS_EVIDENCE','JOINT_VERDICT_RESTORE_LAW_MISSING',examined=budget.examined,
                            values={'submitted_configuration':pre_verdict,'joint_verdict':verdict})
                    poses = {r:(x,y) for r,x,y in request.restored_origins}
                    answers = {a.subject_ref:a.answer_ref for a in request.restored_answers}
                    selected = request.restored_native_focus_ref
        visible = {}
        for obj in request.objects:
            cells = []
            for x,y in obj.full_offsets:
                budget.visit({'stage':'physical_projection','subject_ref':obj.subject_ref})
                cells.append((poses[obj.subject_ref][0]+x,poses[obj.subject_ref][1]+y))
            visible[obj.subject_ref] = tuple(cells)
        budget.finish()
        return d_result(request,'NEEDS_EVIDENCE' if pending else 'COMPLETE',
            'JOINT_VERDICT_OBSERVATION_REQUIRED' if pending else cause,complete=not pending,examined=budget.examined,
            values={'poses':poses,'physical_projections':visible,'native_focus_ref':selected,'provisional_answers':answers,
                'pre_verdict_configuration':pre_verdict,'joint_verdict':verdict,'boundary_ref':boundary,
                'individual_correctness_receipts':(), 'debit':debit,'remaining_budget':max(0,request.remaining_budget-debit),
                'depletion':debit>request.remaining_budget,'complete_response_boundary_count':0 if pending else 1,
                'unfinished_phase':'JOINT_VERDICT' if pending else None})
    except DComputationInterrupted as interruption:
        return d_result(request,'NEEDS_EVIDENCE',interruption.cause,examined=budget.examined,
            frontier={'restart_atomic_command':True,'work':interruption.frontier})
