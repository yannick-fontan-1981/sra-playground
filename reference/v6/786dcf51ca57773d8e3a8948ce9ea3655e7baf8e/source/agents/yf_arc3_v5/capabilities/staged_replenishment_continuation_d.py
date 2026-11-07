"""Bounded conditional continuations after one already-owned external input.

This PATH calculation returns feasibility, not an action or a physical plan.
Every successor uses the existing atomic STEP kernel; the prefix is never
applied again.  The projection preserves stage, phase, quota, ordered typed
camp/rank words and resource.  It is unsuitable for occurrence-specific goals.
"""
from collections import deque
from time import monotonic
from typing import ClassVar, Literal

from pydantic import Field, model_validator

from agents.yf_arc3_v5.logos.types import FrozenMap, Ref, stable_digest
from .mechanical_family_contracts_d import (
    DComputationInterrupted, DMechanicalRequest, DMechanicalResult,
    DWorkBudget, d_result, d_validate_request,
)
from .ordered_front_reduction_d import DuelOccurrenceD
from .staged_replenishment_d import (
    RecruitmentOptionD, StagedReplenishmentRequestD, measure_staged_replenishment_d,
)


class StagedReplenishmentContinuationRequestD(DMechanicalRequest):
    schema_version: Ref = 'yf_arc3_v5.staged_replenishment_continuation_request_d.v1'
    phase_ref: Literal['CONTINUATION_AFTER_OWNED_INPUT']
    prefix_request: StagedReplenishmentRequestD
    prefix_result: DMechanicalResult
    stage_enemy_queues: tuple[tuple[DuelOccurrenceD, ...], ...] = Field(min_length=1, max_length=128)
    stage_recruitment_quotas: tuple[int, ...] = Field(min_length=1, max_length=128)
    recruitment_options: tuple[RecruitmentOptionD, ...] = Field(min_length=1, max_length=128)
    combat_input_ref: Ref
    goal_kind: Literal['NONEMPTY_PREFIX_THROUGH_ALL_STAGES']
    signature_pairs: ClassVar[tuple[tuple[str, str], ...]] = (
        ('mechanics.typed_word_transduction.staged_replenishment_continuation', 'PATH'),)

    @model_validator(mode='after')
    def retain_owned_prefix_and_complete_stage_domain(self):
        p, r = self.prefix_request, self.prefix_result
        if len(self.stage_enemy_queues) != len(self.stage_recruitment_quotas):
            raise ValueError('each observed stage needs its own recruitment quota')
        if any(q < 0 for q in self.stage_recruitment_quotas):
            raise ValueError('negative stage quota')
        if p.final_stage_index != len(self.stage_enemy_queues)-1 or p.final_survival_minimum < 1:
            raise ValueError('continuation requires a complete stage domain and positive survival goal')
        if r.scope != p.scope or r.operation_ref != p.operation_ref or r.mode_ref != 'STEP':
            raise ValueError('continuation prefix must be the exact returned atomic input')
        if any(getattr(self.scope, k) != getattr(p.scope, k) for k in
               ('epoch', 'evidence_revision_ref', 'model_revision_ref', 'event_owner_ref')):
            raise ValueError('continuation cannot change the prefix model or event ownership')
        if len({o.input_ref for o in self.recruitment_options}) != len(self.recruitment_options):
            raise ValueError('continuation recruitment domain contains duplicate inputs')
        return self


def _state_key(values):
    word = lambda name: tuple((o['type_ref'], o['camp_ref'], o['rank']) for o in values[name])
    return (values['stage_index'], values['phase'], values['remaining_recruitment_quota'],
            word('surviving_queue'), word('visible_enemy_queue'), values['remaining_resource'])


def measure_staged_replenishment_continuation_d(request: StagedReplenishmentContinuationRequestD):
    refusal = d_validate_request(request)
    if refusal is not None:
        return refusal
    prefix = request.prefix_result
    if prefix.values.get('input_accepted') is False:
        return d_result(request, 'COMPLETE', 'OWNED_PREFIX_INPUT_REFUSED', complete=True,
            values={'continuation_exists': False, 'conditional_suffix_witness': (),
                    'domain_exhausted': True, 'prefix_input_reapplied': False})
    if 'surviving_queue' in prefix.values and not prefix.values['surviving_queue']:
        return d_result(request, 'COMPLETE', 'NONEMPTY_PREFIX_GOAL_ALREADY_FALSE', complete=True,
            values={'continuation_exists': False, 'conditional_suffix_witness': (),
                    'domain_exhausted': True, 'prefix_input_reapplied': False})
    if prefix.status != 'COMPLETE' or not prefix.domain_complete:
        return d_result(request, 'NEEDS_EVIDENCE', 'COMPLETE_OWNED_PREFIX_REQUIRED')
    budget = DWorkBudget(request)
    pending = deque(((prefix.values, 0, ()),))
    seen = set()
    witness = None
    terminal_count = 0
    incomplete = False
    try:
        while pending:
            values, depth, path = pending.popleft()
            budget.visit({'pending': len(pending), 'visited': len(seen)})
            # An empty allied queue cannot open a later replenishment branch.
            if not values['surviving_queue']:
                terminal_count += 1
                continue
            if values['campaign_complete']:
                terminal_count += 1
                if witness is None:
                    witness = path
                continue
            key = _state_key(values)
            if key in seen:
                continue
            if len(seen) >= request.domain_bound:
                raise DComputationInterrupted('CONTINUATION_DOMAIN_BOUND', {'visited': len(seen)})
            seen.add(key)
            if depth >= request.depth_bound:
                raise DComputationInterrupted('CONTINUATION_DEPTH_BOUND', {'depth': depth})
            stage = int(values['stage_index'])
            if not 0 <= stage < len(request.stage_enemy_queues):
                incomplete = True
                continue
            combat = values['phase'] == 'COMBAT'
            if not combat and (values['phase'] != 'REPLENISHMENT' or values['remaining_recruitment_quota'] <= 0):
                incomplete = True
                continue
            choices = (None,) if combat else request.recruitment_options
            for ordinal, option in enumerate(choices):
                nodes = request.node_bound-budget.examined
                milliseconds = int(request.time_bound_ms-(monotonic()-budget.started)*1000)
                if min(nodes, milliseconds) < 1:
                    raise DComputationInterrupted('CONTINUATION_AGGREGATE_BOUND', {'visited': len(seen)})
                final = stage == len(request.stage_enemy_queues)-1
                native_ref = request.combat_input_ref if combat else option.input_ref
                recruit = ()
                if option is not None:
                    occurrence = option.occurrence.model_copy(update={'occurrence_ref':
                        'measurement:conditional-recruit:'+stable_digest((request.scope.request_ref, key, depth, ordinal))[:24]})
                    recruit = (option.model_copy(update={'occurrence': occurrence}),)
                child_scope = request.scope.model_copy(update={'request_ref':
                    'request:conditional-staged-input:'+stable_digest((request.scope.request_ref, key, ordinal))[:24]})
                child = request.prefix_request.model_copy(update={
                    'scope': child_scope, 'node_bound': nodes, 'time_bound_ms': milliseconds,
                    'resume_frontier': FrozenMap(), 'current_phase': 'COMBAT' if combat else 'REPLENISHMENT',
                    'native_input_kind': 'ENGAGE' if combat else 'RECRUIT', 'native_input_ref': native_ref,
                    'surviving_queue': tuple(DuelOccurrenceD.model_validate(x) for x in values['surviving_queue']),
                    'visible_enemy_queue': tuple(DuelOccurrenceD.model_validate(x) for x in values['visible_enemy_queue']),
                    'recruitment_options': recruit,
                    'recruitment_quota': int(values['remaining_recruitment_quota']),
                    'next_recruitment_quota': request.stage_recruitment_quotas[stage],
                    'stage_index': stage, 'next_opponent_visible': not final,
                    'next_enemy_queue': request.stage_enemy_queues[stage+1] if not final else (),
                    'progression_boundary': 'AFTER_COMBAT' if combat and final else 'AFTER_RECRUITMENT',
                    'remaining_resource': int(values['remaining_resource']),
                })
                result = measure_staged_replenishment_d(child)
                budget.examined += result.examined_count
                if 'surviving_queue' in result.values and not result.values['surviving_queue']:
                    terminal_count += 1
                    continue
                if result.status != 'COMPLETE' or not result.domain_complete:
                    incomplete = True
                    continue
                if not result.values['input_accepted']:
                    terminal_count += 1
                    continue
                pending.append((result.values, depth+1, (*path, native_ref)))
        budget.finish()
        return d_result(request, 'NEEDS_EVIDENCE' if incomplete else 'COMPLETE',
            'CONTINUATION_ATOM_INCOMPLETE' if incomplete else 'BOUNDED_SURVIVING_SUFFIX_DOMAIN',
            complete=not incomplete, examined=budget.examined, values={
                'continuation_exists': witness is not None,
                'conditional_suffix_witness': witness if witness is not None else (),
                'visited_states': len(seen), 'terminal_count': terminal_count,
                'domain_exhausted': not incomplete, 'prefix_input_reapplied': False,
                'physical_release_authorized': False,
            })
    except DComputationInterrupted as error:
        return d_result(request, 'BUDGET_REACHED', error.cause, examined=budget.examined,
            frontier={'visited_states': len(seen), 'pending_states': len(pending),
                      'domain_exhausted': False, 'prefix_input_reapplied': False})
