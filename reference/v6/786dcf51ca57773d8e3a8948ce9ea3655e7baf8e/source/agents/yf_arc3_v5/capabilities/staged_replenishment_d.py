"""One visible combat/recruitment input; ordered survivors persist between stages."""
from __future__ import annotations
from time import monotonic
from typing import ClassVar, Literal
from pydantic import Field, model_validator
from agents.yf_arc3_v5.logos.types import FrozenModel, Ref, FrozenMap
from .ordered_front_reduction_d import DuelOccurrenceD, HeadDuelRuleD, OrderedFrontReductionRequestD, measure_ordered_front_reduction_d
from .mechanical_family_contracts_d import DMechanicalRequest, DWorkBudget, DComputationInterrupted, d_validate_request, d_result, d_input_digest


class RecruitmentOptionD(FrozenModel):
    input_ref: Ref
    occurrence: DuelOccurrenceD
    quota_cost: int = Field(ge=1)
    resource_debit: int = Field(ge=0)
    admission_evidence_ref: Ref


class StagedReplenishmentRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.staged_replenishment_request_d.v1'
    phase_ref: Literal['ONE_COMBAT_OR_RECRUIT_INPUT']
    current_phase: Literal['COMBAT', 'REPLENISHMENT']
    native_input_kind: Literal['ENGAGE', 'RECRUIT']
    native_input_ref: Ref
    command_ref: Ref
    player_camp_ref: Ref
    enemy_camp_ref: Ref
    surviving_queue: tuple[DuelOccurrenceD, ...] = Field(default=(), max_length=4096)
    visible_enemy_queue: tuple[DuelOccurrenceD, ...] = Field(default=(), max_length=4096)
    enemy_suffix_unknown: bool
    head_rules: tuple[HeadDuelRuleD, ...] = Field(min_length=1, max_length=4096)
    tie_rule: Literal['REMOVE_BOTH', 'KEEP_LEFT', 'KEEP_RIGHT', 'STOP']
    recruitment_options: tuple[RecruitmentOptionD, ...] = Field(default=(), max_length=128)
    recruitment_quota: int = Field(ge=0)
    combat_complete_opens_recruitment: bool
    next_recruitment_quota: int = Field(ge=0)
    exhausted_quota_advances_stage: bool
    stage_index: int = Field(ge=0)
    final_stage_index: int | None = Field(default=None, ge=0)
    final_survival_minimum: int = Field(ge=0)
    progression_boundary: Literal['AFTER_COMBAT', 'AFTER_RECRUITMENT']
    next_opponent_visible: bool
    next_enemy_queue: tuple[DuelOccurrenceD, ...] = Field(default=(), max_length=4096)
    remaining_resource: int
    combat_debit: int = Field(ge=0)
    refused_debit: int = Field(ge=0)
    terminal_order: Literal['SURVIVAL_THEN_DEPLETION', 'DEPLETION_THEN_SURVIVAL']
    depletion_at_zero: bool
    queue_revision_ref: Ref
    enemy_revision_ref: Ref
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = (
        ('mechanics.typed_word_transduction.staged_replenishment_external_primitive', 'STEP'),)

    @model_validator(mode='after')
    def explicit_context_input(self):
        if (self.current_phase == 'COMBAT') != (self.native_input_kind == 'ENGAGE'):
            raise ValueError('native input must bind its actual phase')
        refs = [o.occurrence_ref for o in self.surviving_queue+self.visible_enemy_queue]
        if len(set(refs)) != len(refs): raise ValueError('ordered occurrence identities duplicated')
        if any(o.camp_ref != self.player_camp_ref for o in self.surviving_queue) or any(
                o.camp_ref != self.enemy_camp_ref for o in self.visible_enemy_queue+self.next_enemy_queue):
            raise ValueError('ordered camp membership invalid')
        if len({o.input_ref for o in self.recruitment_options}) != len(self.recruitment_options):
            raise ValueError('recruitment inputs must identify distinct options')
        if any(o.occurrence.camp_ref != self.player_camp_ref for o in self.recruitment_options):
            raise ValueError('recruitment camp mismatch')
        return self


def measure_staged_replenishment_d(request: StagedReplenishmentRequestD):
    refusal = d_validate_request(request)
    if refusal is not None: return refusal
    budget = DWorkBudget(request)
    try:
        digest = d_input_digest(request)
        child_frontier = FrozenMap()
        if request.resume_frontier:
            if request.resume_frontier.get('input_digest') != digest:
                return d_result(request, 'NEEDS_EVIDENCE', 'STAGED_RESUME_SCOPE_MISMATCH')
            child_frontier = request.resume_frontier.get('reduction_frontier', FrozenMap())
        queue, enemy = request.surviving_queue, request.visible_enemy_queue
        phase, quota, stage = request.current_phase, request.recruitment_quota, request.stage_index
        events, accepted, engagement_closed = [], True, False
        missing_next = False
        if phase == 'COMBAT':
            budget.visit({'stage': 'owned_visible_engagement'})
            nodes = request.node_bound-budget.examined
            ms = int(request.time_bound_ms-(monotonic()-budget.started)*1000)
            if min(nodes, ms) < 1: raise DComputationInterrupted('AGGREGATE_COMBAT_BOUND', {})
            child = OrderedFrontReductionRequestD(scope=request.scope,
                operation_ref='mechanics.typed_word_transduction.ordered_front_reduction', mode_ref='STEP_INTERNAL',
                requested_result_type='DMechanicalResult', node_bound=nodes, depth_bound=request.depth_bound,
                domain_bound=request.domain_bound, time_bound_ms=ms, resume_frontier=child_frontier,
                phase_ref='INTERNAL_ENGAGEMENT', left_queue=queue, right_queue=enemy,
                left_camp_ref=request.player_camp_ref, right_camp_ref=request.enemy_camp_ref,
                head_rules=request.head_rules, tie_rule=request.tie_rule, closure_scope='engagement',
                parent_command_ref=request.command_ref, left_queue_revision_ref=request.queue_revision_ref,
                right_queue_revision_ref=request.enemy_revision_ref, completed_duel_cursor=0)
            reduced = measure_ordered_front_reduction_d(child)
            budget.examined += reduced.examined_count
            if not reduced.domain_complete:
                return d_result(request, reduced.status, reduced.cause, examined=budget.examined,
                    values={'consumed_prefix': reduced.values}, frontier={'input_digest': digest,
                    'reduction_frontier': reduced.frontier, 'external_debit_reapplied': False})
            queue = tuple(DuelOccurrenceD.model_validate(o) for o in reduced.values['left_queue'])
            enemy = tuple(DuelOccurrenceD.model_validate(o) for o in reduced.values['right_queue'])
            events.extend(reduced.values['consumption_trace'])
            engagement_closed = not enemy and not request.enemy_suffix_unknown
            if not enemy and request.enemy_suffix_unknown: missing_next = True
            if engagement_closed and request.combat_complete_opens_recruitment:
                phase, quota = 'REPLENISHMENT', request.next_recruitment_quota
            debit = request.combat_debit
        else:
            budget.visit({'stage': 'append_one_admitted_recruit'})
            option = next((o for o in request.recruitment_options if o.input_ref == request.native_input_ref), None)
            accepted = option is not None and option.quota_cost <= quota and option.occurrence.occurrence_ref not in {
                o.occurrence_ref for o in queue}
            if accepted:
                queue = queue+(option.occurrence,)
                quota -= option.quota_cost
                events.append({'cause': 'RECRUIT_APPEND_AT_ACTUAL_END', 'occurrence_ref': option.occurrence.occurrence_ref,
                    'position': len(queue)-1, 'admission_evidence_ref': option.admission_evidence_ref})
            debit = option.resource_debit if accepted else request.refused_debit
        progressed = (request.progression_boundary == 'AFTER_COMBAT' and engagement_closed or
            request.progression_boundary == 'AFTER_RECRUITMENT' and request.current_phase == 'REPLENISHMENT' and
            accepted and quota == 0 and request.exhausted_quota_advances_stage)
        campaign_complete = bool(progressed and request.final_stage_index is not None and stage == request.final_stage_index
            and len(queue) >= request.final_survival_minimum)
        if progressed and not campaign_complete:
            stage += 1
            if request.next_opponent_visible:
                enemy, phase = request.next_enemy_queue, 'COMBAT'
            else: missing_next = True
        resource = request.remaining_resource-debit
        depleted = resource <= 0 if request.depletion_at_zero else resource < 0
        boundary = None
        for kind in (('SURVIVAL', 'DEPLETION') if request.terminal_order == 'SURVIVAL_THEN_DEPLETION' else ('DEPLETION', 'SURVIVAL')):
            if kind == 'SURVIVAL' and campaign_complete or kind == 'DEPLETION' and depleted:
                boundary = kind; break
        budget.finish()
        return d_result(request, 'NEEDS_EVIDENCE' if missing_next and boundary is None else 'COMPLETE',
            'NEXT_VISIBLE_OPPONENT_REQUIRED' if missing_next and boundary is None else 'STAGED_INPUT_SUCCESSOR',
            complete=not missing_next or boundary is not None, examined=budget.examined, values={
            'surviving_queue': queue, 'visible_enemy_queue': enemy, 'phase': phase, 'stage_index': stage,
            'remaining_recruitment_quota': quota, 'events': tuple(events), 'remaining_resource': resource,
            'input_accepted': accepted, 'engagement_complete': engagement_closed,
            'campaign_complete': campaign_complete, 'boundary': boundary, 'primitive_debit': debit,
            'unknown_enemy_suffix_imported': False, 'external_inputs': 1})
    except DComputationInterrupted as error:
        return d_result(request, 'BUDGET_REACHED', error.cause, examined=budget.examined,
            frontier={'restart_atomic_staged_packet': True, 'input_digest': d_input_digest(request), 'work': error.frontier})
