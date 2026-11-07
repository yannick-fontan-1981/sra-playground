"""Ordered head duels with consumed-prefix suspension, never a second command."""
from __future__ import annotations
from collections import deque
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result, d_input_digest


class DuelOccurrenceD(FrozenModel):
    occurrence_ref: Ref
    type_ref: Ref
    camp_ref: Ref
    rank: int


class HeadDuelRuleD(FrozenModel):
    left_type_ref: Ref
    right_type_ref: Ref
    result: Literal['LEFT','RIGHT','TIE']
    winner_rank_rule: Literal['KEEP','ADD_ONE','SET']
    winner_rank_value: int | None
    law_evidence_ref: Ref


class OrderedFrontReductionRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.ordered_front_reduction_request_d.v1'
    phase_ref: Literal['INTERNAL_ENGAGEMENT']
    left_queue: tuple[DuelOccurrenceD,...] = Field(default=(),max_length=4096)
    right_queue: tuple[DuelOccurrenceD,...] = Field(default=(),max_length=4096)
    left_camp_ref: Ref
    right_camp_ref: Ref
    head_rules: tuple[HeadDuelRuleD,...] = Field(min_length=1,max_length=4096)
    tie_rule: Literal['REMOVE_BOTH','KEEP_LEFT','KEEP_RIGHT','STOP']
    closure_scope: Literal['one_duel','engagement']
    parent_command_ref: Ref
    left_queue_revision_ref: Ref
    right_queue_revision_ref: Ref
    completed_duel_cursor: int = Field(ge=0)
    signature_pairs: ClassVar[tuple[tuple[str,str],...]] = (
        ('mechanics.typed_word_transduction.ordered_front_reduction','STEP_INTERNAL'),
    )

    @model_validator(mode='after')
    def ordered_identities(self):
        refs=[o.occurrence_ref for o in self.left_queue+self.right_queue]
        if len(set(refs))!=len(refs) or any(o.camp_ref!=self.left_camp_ref for o in self.left_queue) or any(
                o.camp_ref!=self.right_camp_ref for o in self.right_queue):
            raise ValueError('ordered occurrences/camps must be distinct and correctly scoped')
        pairs=[(r.left_type_ref,r.right_type_ref) for r in self.head_rules]
        if len(set(pairs))!=len(pairs) or any(r.winner_rank_rule=='SET' and r.winner_rank_value is None for r in self.head_rules):
            raise ValueError('head relation or supported winner-rank law is incomplete')
        return self


def measure_ordered_front_reduction_d(request: OrderedFrontReductionRequestD):
    refusal=d_validate_request(request)
    if refusal is not None:
        return refusal
    if max(len(request.left_queue)+len(request.right_queue),len(request.head_rules))>request.domain_bound:
        return d_result(request,'NEEDS_EVIDENCE','INPUT_DOMAIN_BOUND')
    left,right=deque(request.left_queue),deque(request.right_queue)
    trace=[]
    cursor=request.completed_duel_cursor
    if request.resume_frontier:
        f=request.resume_frontier
        if f.get('input_digest')!=d_input_digest(request) or f.get('parent_command_ref')!=request.parent_command_ref:
            return d_result(request,'NEEDS_EVIDENCE','RESUME_COMMAND_OR_REVISION_MISMATCH')
        left=deque(DuelOccurrenceD.model_validate(o) for o in f.get('left_queue',()))
        right=deque(DuelOccurrenceD.model_validate(o) for o in f.get('right_queue',()))
        trace=list(f.get('consumption_trace',()))
        cursor=int(f.get('completed_duel_cursor',request.completed_duel_cursor))
        for current,original in ((left,request.left_queue),(right,request.right_queue)):
            refs=[o.occurrence_ref for o in current]
            expected=[o.occurrence_ref for o in original][-len(refs):] if refs else []
            if refs!=expected:
                return d_result(request,'NEEDS_EVIDENCE','RESUME_ORDERED_SUFFIX_MISMATCH')
        if cursor!=request.completed_duel_cursor+len(trace):
            return d_result(request,'NEEDS_EVIDENCE','RESUME_DUEL_CURSOR_MISMATCH')
    budget=DWorkBudget(request)
    rules={(r.left_type_ref,r.right_type_ref):r for r in request.head_rules}
    cause='EMPTY_QUEUE_STOP'
    try:
        while left and right:
            if request.closure_scope=='one_duel' and trace:
                cause='ONE_DUEL_CLOSED'
                break
            if len(trace)>=request.depth_bound:
                raise DComputationInterrupted('ENGAGEMENT_DEPTH_BOUND',{})
            budget.visit({'stage':'current_heads','duel_cursor':cursor})
            a,b=left[0],right[0]
            rule=rules.get((a.type_ref,b.type_ref))
            if rule is None:
                raise DComputationInterrupted('HEAD_RELATION_NOT_BOUND',{'left_type_ref':a.type_ref,'right_type_ref':b.type_ref})
            outcome=rule.result
            if outcome=='TIE':
                outcome={'REMOVE_BOTH':'BOTH','KEEP_LEFT':'LEFT','KEEP_RIGHT':'RIGHT','STOP':'STOP'}[request.tie_rule]
            removed=[]
            if outcome in ('RIGHT','BOTH'):
                removed.append(left.popleft().occurrence_ref)
            if outcome in ('LEFT','BOTH'):
                removed.append(right.popleft().occurrence_ref)
            winner=left if outcome=='LEFT' else right if outcome=='RIGHT' else None
            if winner is not None:
                body=winner[0]
                rank=(body.rank+1 if rule.winner_rank_rule=='ADD_ONE' else rule.winner_rank_value if rule.winner_rank_rule=='SET' else body.rank)
                winner[0]=body.model_copy(update={'rank':rank})
            trace.append({'duel_cursor':cursor,'left_head_ref':a.occurrence_ref,'right_head_ref':b.occurrence_ref,
                'law_evidence_ref':rule.law_evidence_ref,'outcome':outcome,'consumed_occurrence_refs':tuple(removed)})
            cursor+=1
            if outcome=='STOP':
                cause='SUPPORTED_TIE_STOP'
                break
            if request.closure_scope=='one_duel':
                cause='ONE_DUEL_CLOSED'
                break
        budget.finish()
        return d_result(request,'COMPLETE',cause,complete=True,examined=budget.examined,values={
            'left_queue':tuple(left),'right_queue':tuple(right),'consumption_trace':tuple(trace),'completed_duel_cursor':cursor,
            'left_queue_empty':not left,'right_queue_empty':not right,'parent_command_ref':request.parent_command_ref,
            'new_external_inputs':0,'new_external_debits':0})
    except DComputationInterrupted as error:
        return d_result(request,'NEEDS_EVIDENCE',error.cause,examined=budget.examined,
            frontier={'input_digest':d_input_digest(request),'parent_command_ref':request.parent_command_ref,
                'left_queue':tuple(left),'right_queue':tuple(right),'consumption_trace':tuple(trace),
                'completed_duel_cursor':cursor,'work':error.frontier,'restart_engagement':False,'new_external_debit':False})
