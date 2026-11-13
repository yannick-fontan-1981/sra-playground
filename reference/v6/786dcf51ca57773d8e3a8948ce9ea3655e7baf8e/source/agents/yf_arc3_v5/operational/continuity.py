"""Prepared operational context, referencing one immutable canonical intention.

The context preserves declared purpose and attempt; it is not a planner or an
action permit. Live scope, dependencies and release checks remain mandatory.
"""
from dataclasses import dataclass
from enum import Enum

from agents.yf_arc3_v5.logos.operations import ActionIntent
from agents.yf_arc3_v5.logos.operational_responsibility import (
    validate_action_responsibility,
)
from .continuity_scope import validate_current_action_responsibility_scope


@dataclass(frozen=True, slots=True)
class OperationalContinuityContext:
    action_intent: ActionIntent

    @classmethod
    def prepare(cls, intent: ActionIntent):
        if not isinstance(intent, ActionIntent):
            raise TypeError('operational continuity requires a typed action intention')
        validate_action_responsibility(intent)
        return cls(action_intent=intent)

    def matches(self, intent: ActionIntent) -> bool:
        # Object identity deliberately excludes copies with changed WHY/action.
        return self.action_intent is intent

    def require_current_scope(self, world_context):
        return validate_current_action_responsibility_scope(self.action_intent, world_context)


@dataclass(slots=True)
class OperationalContinuityRuntimeState:
    """Non-authoritative cache and costs, excluded from canonical transactions."""
    context: OperationalContinuityContext | None = None
    context_preparations: int = 0
    context_reuses: int = 0
    guard_count: int = 0
    guard_total_ns: int = 0
    guard_max_ns: int = 0


@dataclass(frozen=True, slots=True)
class OperationalControlTransitionContext:
    """One source-measured control transition; not a planner or ACT permit."""
    action_ref: str
    before_frame_ref: str
    after_frame_ref: str
    before_input_ref: str
    after_input_ref: str
    subject_refs: tuple[str, ...]
    before_bboxes: tuple[tuple[int, int, int, int], ...]
    after_bboxes: tuple[tuple[int, int, int, int], ...]
    measured_delta: tuple[int, int] | None

    def matches(self, *, action_ref, before_frame_ref, after_frame_ref,
                before_input_ref, after_input_ref, expected_delta, planned_before_bboxes):
        if (not all((before_frame_ref, after_frame_ref, before_input_ref, after_input_ref))
                or not self.subject_refs or self.measured_delta is None
                or expected_delta == (0, 0)
                or self.action_ref != action_ref
                or (self.before_frame_ref, self.after_frame_ref,
                    self.before_input_ref, self.after_input_ref) !=
                   (before_frame_ref, after_frame_ref, before_input_ref, after_input_ref)
                or len(self.before_bboxes) != 1 or len(self.after_bboxes) != 1
                or self.before_bboxes != planned_before_bboxes
                or self.measured_delta != expected_delta):
            return False
        row, col = self.measured_delta
        top, left, bottom, right = self.before_bboxes[0]
        return self.after_bboxes[0] == (top + row, left + col, bottom + row, right + col)


class OperationalContinuityRoute(str, Enum):
    TRANSPORT_RECOVERY = 'root.transport_recovery'
    RECONCILE_RESULT = 'root.reconcile_sealed_path'
    INTERPRET_FAILURE = 'root.interpret_official_failure'
    COMPLETE_SUCCESS = 'root.run_winning_retrospection'
    CONTINUE_ATTEMPT = 'root.continue_active_path'
    PROCESS_EVIDENCE = 'root.process_eligible_evidence'
    OBSERVE_MISSING_REPRESENTATION = 'root.build_minimum_representation'
    ANSWER_CURRENT_QUESTION = 'root.acquire_named_information'
    ADVANCE_GOAL = 'root.advance_objective'


@dataclass(frozen=True, slots=True)
class OperationalContinuityInputs:
    transport_acknowledgement_unresolved: bool
    release_requalification_required: bool
    sealed_path_response_pending: bool
    official_failure_uninterpreted: bool
    official_success_needs_retrospection: bool
    active_committed_path_has_authorized_action: bool
    eligible_evidence_event_pending: bool
    minimum_representation_missing: bool
    named_information_question_pending: bool

    def route(self) -> OperationalContinuityRoute:
        """Route current work directly; never infer a goal or authorize action.

        The order preserves the former root guards. In particular, pending
        results, invalid release and official boundaries precede continuation.
        """
        if self.transport_acknowledgement_unresolved or self.release_requalification_required:
            return OperationalContinuityRoute.TRANSPORT_RECOVERY
        if self.sealed_path_response_pending:
            return OperationalContinuityRoute.RECONCILE_RESULT
        if self.official_failure_uninterpreted:
            return OperationalContinuityRoute.INTERPRET_FAILURE
        if self.official_success_needs_retrospection:
            return OperationalContinuityRoute.COMPLETE_SUCCESS
        if self.active_committed_path_has_authorized_action:
            return OperationalContinuityRoute.CONTINUE_ATTEMPT
        if self.eligible_evidence_event_pending:
            return OperationalContinuityRoute.PROCESS_EVIDENCE
        if self.minimum_representation_missing:
            return OperationalContinuityRoute.OBSERVE_MISSING_REPRESENTATION
        if self.named_information_question_pending:
            return OperationalContinuityRoute.ANSWER_CURRENT_QUESTION
        return OperationalContinuityRoute.ADVANCE_GOAL


@dataclass(frozen=True, slots=True)
class OperationalContinuityDispatch:
    timeline_ref: str
    frame_ref: str
    inputs: OperationalContinuityInputs
    route: OperationalContinuityRoute
