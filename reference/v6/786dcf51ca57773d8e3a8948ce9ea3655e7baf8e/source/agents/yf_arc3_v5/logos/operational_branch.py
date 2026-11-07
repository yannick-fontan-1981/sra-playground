"""Canonical execution-branch awareness; no invented goal or second planner."""
from typing import Literal

from .operational_reasoning import OperationalConsciousnessReasoningContext, OperationalConsciousnessReasoningOutcome
from .types import FrozenModel, Ref


class OperationalConsciousnessBranchState(FrozenModel):
    """Current accountable branch, projected from accepted Source artifacts.

    Completion is the actual workflow boundary, not achievement of a world goal.
    Questions are only those present in published operations or declared origin.
    Missing semantic motivation remains missing instead of using a workflow name.
    """
    context: OperationalConsciousnessReasoningContext
    entry_record_ref: Ref
    current_record_ref: Ref
    caller_context_ref: Ref | None
    origin_question_ref: Ref | None = None
    status: Literal['ready', 'active', 'suspended', 'blocked', 'failed', 'deferred', 'completed']
    current_frame_ref: Ref | None
    current_step_ref: Ref | None
    current_statement_ref: Ref | None
    pending_action_intent_ref: Ref | None = None
    pending_expectation_refs: tuple[Ref, ...] = ()
    declared_question_refs: tuple[Ref, ...] = ()
    responsibility_refs: tuple[Ref, ...] = ()
    latest_return_ref: Ref | None = None
    normative_key_binding: Literal['not_qualified_by_this_projection'] = 'not_qualified_by_this_projection'
    goal_completion: Literal['not_attested_by_branch_status'] = 'not_attested_by_branch_status'
    schema_version: Literal['operational_consciousness_branch_state.v1'] = 'operational_consciousness_branch_state.v1'


class OperationalConsciousnessBranchReturnState(FrozenModel):
    """Actual consumers of one branch outcome; inspection never means discharge."""
    outcome: OperationalConsciousnessReasoningOutcome
    accepted_return_receipt_refs: tuple[Ref, ...]
    refused_return_receipt_refs: tuple[Ref, ...]
    inspection_receipt_refs: tuple[Ref, ...]
    has_accepted_return_consumer: bool
    goal_completion: Literal['not_attested_by_consumption'] = 'not_attested_by_consumption'
    schema_version: Literal['operational_consciousness_branch_return_state.v1'] = 'operational_consciousness_branch_return_state.v1'


class OperationalConsciousnessContributionState(FrozenModel):
    """A durable question stays accountable after its requesting branch returns."""
    request_ref: Ref
    requester_context_ref: Ref
    question_ref: Ref
    parent_goal_ref: Ref | None
    dependency_refs: tuple[Ref, ...]
    accepted_receipt_refs: tuple[Ref, ...]
    refused_receipt_refs: tuple[Ref, ...]
    activation_receipt_refs: tuple[Ref, ...]
    awaiting_accepted_return: bool
    awaiting_explicit_activation: bool
    goal_completion: Literal['not_attested_by_contribution_status'] = 'not_attested_by_contribution_status'
    schema_version: Literal['operational_consciousness_contribution_state.v1'] = 'operational_consciousness_contribution_state.v1'
