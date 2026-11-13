"""Conscious ownership of reasoning before an action intention exists.

A Source task is not a world goal. Unknown goal interpretation remains explicit;
only an actual Source FOR clause or a compiled Source declaration supplies one.
"""
from typing import Literal, get_args
from pydantic import Field, model_validator

from .types import FrozenMap, FrozenModel, Ref, stable_digest

CompiledReasoningReturnStatus = Literal['completed', 'blocked', 'failed', 'deferred']


class OperationalConsciousnessDependencySnapshot(FrozenModel):
    """Exact versions of declared dependencies, not an inferred usefulness relation."""
    problem_ref: Ref
    bindings: FrozenMap
    unresolved_refs: tuple[Ref, ...] = ()
    schema_version: Literal['operational_consciousness_dependency_snapshot.v1'] = 'operational_consciousness_dependency_snapshot.v1'

    @model_validator(mode='after')
    def unresolved_in_domain(self):
        if self.problem_ref not in self.bindings or not set(self.unresolved_refs).issubset(self.bindings):
            raise ValueError('operational consciousness: unresolved dependency left its declared domain')
        return self


class OperationalConsciousnessReasoningContext(FrozenModel):
    context_ref: Ref
    root_context_ref: Ref
    parent_context_ref: Ref | None
    # Interpreted checkpoint or canonical compiled entry/current receipt.
    parent_checkpoint_ref: Ref | None
    composition_edge_ref: Ref | None
    run_ref: Ref
    timeline_ref: Ref
    owner_workflow_ref: Ref
    source_workflow_ref: Ref
    source_hash: Ref
    origin_frame_ref: Ref | None
    entry_kind: Literal['source_workflow', 'compiled_source_workflow', 'compiled_replay_validation',
                        'compiled_source_child', 'compiled_replay_child']
    # Technical task identity is not promoted into a solved or selected goal.
    world_goal_interpretation: Literal['not_established_by_entry'] = 'not_established_by_entry'
    schema_version: Literal['operational_consciousness_reasoning_context.v1'] = 'operational_consciousness_reasoning_context.v1'

    @model_validator(mode='after')
    def explicit_parent_or_root(self):
        parent_fields = (self.parent_context_ref, self.parent_checkpoint_ref, self.composition_edge_ref)
        if any(parent_fields) != all(parent_fields):
            raise ValueError('operational consciousness: incomplete reasoning parent link')
        if not any(parent_fields) and self.root_context_ref != self.context_ref:
            raise ValueError('operational consciousness: root context has a foreign root')
        if self.entry_kind in ('compiled_source_workflow', 'compiled_replay_validation') and any(parent_fields):
            raise ValueError('operational consciousness: compiled root cannot invent a parent')
        if self.entry_kind in ('compiled_source_child', 'compiled_replay_child') and not all(parent_fields):
            raise ValueError('operational consciousness: compiled child lost its declared parent')
        if any(parent_fields) and (self.parent_context_ref == self.context_ref or self.root_context_ref == self.context_ref):
            raise ValueError('operational consciousness: a child cannot be its own parent or root')
        expected = reasoning_context_ref(run_ref=self.run_ref, timeline_ref=self.timeline_ref,
            owner_workflow_ref=self.owner_workflow_ref, source_workflow_ref=self.source_workflow_ref,
            source_hash=self.source_hash)
        if self.context_ref != expected:
            raise ValueError('operational consciousness: reasoning context identity differs from its origin')
        return self


class OperationalConsciousnessReasoningOperation(FrozenModel):
    context: OperationalConsciousnessReasoningContext
    operation_ref: Ref
    statement_ref: Ref
    current_frame_ref: Ref | None
    declared_question_ref: Ref | None
    schema_version: Literal['operational_consciousness_reasoning_operation.v1'] = 'operational_consciousness_reasoning_operation.v1'


class OperationalConsciousnessAdmissionError(ValueError):
    """A named admission guard, distinct from an unexpected implementation error."""

    def __init__(self, guard_ref: str, detail: str):
        super().__init__(detail)
        self.guard_ref = guard_ref


class OperationalConsciousnessReasoningEntryRefusal(FrozenModel):
    """An attempted child entry, without fabricating an executed child outcome."""

    initiating_operation: OperationalConsciousnessReasoningOperation
    requested_workflow_ref: Ref
    requested_source_hash: Ref
    run_ref: Ref
    timeline_ref: Ref
    frame_ref: Ref | None
    failed_guard_refs: tuple[Ref, ...] = Field(min_length=1)
    checked_child_checkpoint_ref: Ref | None = None
    detail: str = Field(max_length=2048)
    grants_action: Literal[False] = False
    automatic_retry_authorized: Literal[False] = False
    schema_version: Literal['operational_consciousness_reasoning_entry_refusal.v1'] = 'operational_consciousness_reasoning_entry_refusal.v1'


class OperationalConsciousnessContributionOrigin(FrozenModel):
    """The actual requesting instruction and its Source-declared question.

    A question can be epistemic without an established world-goal beneficiary.
    It does not acquire a parent merely by being called from another workflow.
    """
    requesting_operation: OperationalConsciousnessReasoningOperation
    question_ref: Ref
    grants_action: Literal[False] = False
    schema_version: Literal['operational_consciousness_contribution_origin.v1'] = 'operational_consciousness_contribution_origin.v1'


class OperationalConsciousnessSourceOperation(FrozenModel):
    """An instruction extracted from qualified SRC, never a goal invented by Python."""
    step_ref: Ref
    statement_ref: Ref
    operation_ref: Ref
    declared_question_ref: Ref | None


class OperationalConsciousnessReasoningOutcome(FrozenModel):
    """An actual reasoning boundary, never a claim that the world goal succeeded."""
    producer_record_ref: Ref
    context: OperationalConsciousnessReasoningContext
    recipient_context_ref: Ref
    current_frame_ref: Ref | None
    boundary_kind: Literal['workflow_checkpoint', 'compiled_return']
    status: Literal['completed', 'blocked', 'failed', 'deferred', 'suspended']
    evidence_refs: tuple[Ref, ...] = Field(min_length=1)
    grants_action: Literal[False] = False
    goal_completion: Literal['not_attested_by_reasoning_status'] = 'not_attested_by_reasoning_status'
    schema_version: Literal['operational_consciousness_reasoning_outcome.v1'] = 'operational_consciousness_reasoning_outcome.v1'


class OperationalConsciousnessOutcomeConsumption(FrozenModel):
    """Link a consumer decision to the returned activity and separately inspected failures."""
    consumer_context: OperationalConsciousnessReasoningContext
    basis: Literal['source_return', 'unqualified_source_return', 'domain_evidence']
    returned_outcome_ref: Ref | None
    examined_outcome_refs: tuple[Ref, ...] = ()
    grants_action: Literal[False] = False
    schema_version: Literal['operational_consciousness_outcome_consumption.v1'] = 'operational_consciousness_outcome_consumption.v1'

    @model_validator(mode='after')
    def exact_basis(self):
        if (self.basis == 'source_return') != (self.returned_outcome_ref is not None):
            raise ValueError('operational consciousness: source consumption lacks its exact returned outcome')
        if self.basis != 'source_return' and self.examined_outcome_refs:
            raise ValueError('operational consciousness: unqualified consumption cannot discharge another outcome')
        return self


class OperationalConsciousnessReasoningReturn(FrozenModel):
    """Actual reasoning boundary; delivery is not semantic consumption."""
    entry_ref: Ref
    context: OperationalConsciousnessReasoningContext
    operations: tuple[OperationalConsciousnessReasoningOperation, ...]
    outcome: OperationalConsciousnessReasoningOutcome
    grants_action: Literal[False] = False
    consumption: Literal['not_attested_by_return'] = 'not_attested_by_return'
    schema_version: Literal['operational_consciousness_reasoning_return.v2'] = 'operational_consciousness_reasoning_return.v2'

    @model_validator(mode='after')
    def preserve_origin(self):
        if not self.operations and self.outcome.status != 'failed':
            raise ValueError('operational consciousness: only a failed entry can return without visited operations')
        if any(op.context != self.context for op in self.operations):
            raise ValueError('operational consciousness: reasoning return changed its context')
        if (self.outcome.context != self.context or self.outcome.boundary_kind != 'compiled_return'
                or self.outcome.status not in get_args(CompiledReasoningReturnStatus)):
            raise ValueError('operational consciousness: compiled return changed its outcome')
        return self


def bind_checkpoint_reasoning_outcome(*, context, record_ref, status, frame_ref, evidence_refs):
    if status not in {'completed', 'blocked', 'failed', 'deferred', 'suspended'}:
        return None
    return OperationalConsciousnessReasoningOutcome(producer_record_ref=record_ref,
        context=context, recipient_context_ref=context.parent_context_ref or context.context_ref,
        current_frame_ref=frame_ref, boundary_kind='workflow_checkpoint', status=status,
        evidence_refs=evidence_refs)


def reasoning_context_ref(*, run_ref, timeline_ref, owner_workflow_ref, source_workflow_ref, source_hash):
    return 'operational-reasoning:' + stable_digest((
        run_ref, timeline_ref, owner_workflow_ref, source_workflow_ref, source_hash))


def create_reasoning_context(*, run_ref, timeline_ref, owner_workflow_ref, source_workflow_ref,
                             source_hash, origin_frame_ref, parent=None, composition_edge_ref=None,
                             parent_context=None, parent_record_ref=None,
                             entry_kind='source_workflow'):
    ref = reasoning_context_ref(run_ref=run_ref, timeline_ref=timeline_ref,
        owner_workflow_ref=owner_workflow_ref, source_workflow_ref=source_workflow_ref, source_hash=source_hash)
    if parent is not None and (parent_context is not None or parent_record_ref is not None):
        raise ValueError('operational consciousness: parent has two competing binding forms')
    inherited = parent.operational_consciousness_context if parent is not None else parent_context
    origin_record_ref = parent.id if parent is not None else parent_record_ref
    if (inherited is None) != (origin_record_ref is None):
        raise ValueError('operational consciousness: parent context needs its canonical record')
    if inherited is not None and (inherited.run_ref != run_ref or inherited.timeline_ref != timeline_ref
                                  or not composition_edge_ref):
        raise ValueError('operational consciousness: reasoning parent has another scope or no declared edge')
    if inherited is None and composition_edge_ref is not None:
        raise ValueError('operational consciousness: reasoning edge has no parent')
    return OperationalConsciousnessReasoningContext(
        context_ref=ref, root_context_ref=inherited.root_context_ref if inherited is not None else ref,
        parent_context_ref=inherited.context_ref if inherited is not None else None,
        parent_checkpoint_ref=origin_record_ref,
        composition_edge_ref=composition_edge_ref, run_ref=run_ref, timeline_ref=timeline_ref,
        owner_workflow_ref=owner_workflow_ref, source_workflow_ref=source_workflow_ref,
        source_hash=source_hash, origin_frame_ref=origin_frame_ref, entry_kind=entry_kind)


def bind_reasoning_operation(context, *, operation_ref, statement_ref, frame_ref, declared_question_ref=None):
    return OperationalConsciousnessReasoningOperation(context=context, operation_ref=operation_ref,
        statement_ref=statement_ref, current_frame_ref=frame_ref, declared_question_ref=declared_question_ref)
