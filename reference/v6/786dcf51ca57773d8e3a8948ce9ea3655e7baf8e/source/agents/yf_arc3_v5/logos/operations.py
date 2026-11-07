"""Typed canonical records surrounding the nine Logos operators."""

from __future__ import annotations
from .operational_information_opportunity import OperationalConsciousnessInformationOpportunity
from .operator_support import OperatorSurfaceAccessTarget, ObservedCompositionAccessReturn

from enum import Enum
from collections.abc import Mapping
from .operational_reevaluation import OperationalConsciousnessGoalConsumptionUse
from typing import ClassVar, Literal

from pydantic import Field, model_serializer, model_validator
from .contact_experiment import ContactExperimentWitness
from .operational_goal_hypothesis import OperationalConsciousnessGoalHypothesis
from .operational_experiment_admission import OperationalConsciousnessExperimentAdmissionObligation, OperationalConsciousnessSelectionFrontier
from .operational_acquisition import OperationalConsciousnessNativeAcquisition, OperationalConsciousnessExperimentAssessmentLink
from .operational_observation import (OperationalConsciousnessObservedApplication,
    OperationalConsciousnessMeasuredEffect, OperationalConsciousnessParticipantMeasurement)
from .operational_reasoning import (CompiledReasoningReturnStatus, OperationalConsciousnessReasoningContext, OperationalConsciousnessReasoningOperation,
    OperationalConsciousnessSourceOperation, OperationalConsciousnessReasoningReturn,
    OperationalConsciousnessReasoningOutcome, OperationalConsciousnessOutcomeConsumption,
    OperationalConsciousnessDependencySnapshot)
from .operational_reevaluation import (OperationalConsciousnessReevaluationDemand,
    OperationalConsciousnessDeliberationOutcome)
from agents.yf_arc3_v5.logos.source_completion import SourceTerminalBinding, SourceCallRefusal, SourceCallDeferral
from agents.yf_arc3_v5.logos.goal_frontier import GoalAcquisitionFrontier, GoalFrontierBranchReview
from agents.yf_arc3_v5.logos.operational_responsibility import DeclaredSeriesContributionBinding, OperationalConsciousnessActionBinding, OperationalConsciousnessReceiverBinding, OperationalConsciousnessQuestionResponse, OperationalConsciousnessNativeQuestionResponse, OperationalObservedReturn, validate_action_responsibility

from agents.yf_arc3_v5.logos.types import (
    Cardinality,
    EffectClass,
    FrozenMap,
    FrozenModel,
    NonNegativeRevision,
    OperatorName,
    PositiveSequence,
    Ref,
    require_unique,
    stable_digest,
)


class OperationStatus(str, Enum):
    COMPLETED = "completed"
    BLOCKED = "blocked"
    UNRESOLVED = "unresolved"
    FAILED = "failed"


class WorkflowStatus(str, Enum):
    READY = "ready"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    DEFERRED = "deferred"
    BLOCKED = "blocked"
    COMPLETED = "completed"
    FAILED = "failed"


class ViabilityStatus(str, Enum):
    VIABLE = "viable"
    CONDITIONAL = "conditional"
    BLOCKED = "blocked"
    UNDETERMINED = "undetermined"


class Reversibility(str, Enum):
    REVERSIBLE = "reversible"
    RECOVERABLE = "recoverable"
    IRREVERSIBLE = "irreversible"
    UNKNOWN = "unknown"


class CommitmentKind(str, Enum):
    COMMIT = "commit"
    REVISE = "revise"
    DEFER = "defer"
    REJECT = "reject"


class AuthorityKind(str, Enum):
    RULE = "rule"
    MODEL = "model"
    CRITERION = "criterion"
    POLICY = "policy"


class AppliedPrincipleStatus(str, Enum):
    PROPOSED = "proposed"
    SUPPORTED = "supported"
    ESTABLISHED = "established"
    DEFEATED = "defeated"


class WorkflowLifecycleKind(str, Enum):
    STARTED = "started"
    STEP_CHANGED = "step_changed"
    SUSPENDED = "suspended"
    RESUMED = "resumed"
    COMPLETED = "completed"
    DEFERRED = "deferred"
    BLOCKED = "blocked"
    FAILED = "failed"


class WorkflowBlockKind(str, Enum):
    STEP = "step"
    BODY = "body"
    ELSE = "else"
    MATCH_ARM = "match_arm"
    FOR_EACH = "for_each"
    WHILE = "while"
    TRANSACTION = "transaction"


class LineagedRecord(FrozenModel):
    record_kind: Ref
    id: Ref
    source_unit: Ref
    source_hash: Ref
    state_revision: NonNegativeRevision
    workflow_definition_id: Ref | None = None
    workflow_instance_id: Ref | None = None
    workflow_step_id: Ref | None = None
    timeline_id: Ref | None = None
    frame_id: Ref | None = None
    provenance: tuple[Ref, ...] = ()
    schema_version: Ref

    @model_validator(mode="after")
    def validate_lineage(self) -> "LineagedRecord":
        require_unique(self.provenance, "provenance")
        if self.workflow_step_id and not self.workflow_instance_id:
            raise ValueError("workflow_step_id requires workflow_instance_id")
        return self


class AlternativeSet(FrozenModel):
    selected: Ref | None = None
    live_alternatives: tuple[Ref, ...] = Field(min_length=1)
    cardinality: Cardinality = Cardinality.SINGULAR
    schema_version: Ref = "yf_arc3_v5.alternative_set.v1"

    @model_validator(mode="after")
    def validate_alternatives(self) -> "AlternativeSet":
        require_unique(self.live_alternatives, "live_alternatives")
        if self.selected and self.selected not in self.live_alternatives:
            raise ValueError("selected must be one of the live alternatives")
        if self.cardinality is Cardinality.SPECIAL and len(self.live_alternatives) < 2:
            raise ValueError("special cardinality requires multiple live alternatives")
        return self

    def revise_falsified_scope(
        self,
        falsified_alternative_refs: tuple[Ref, ...],
    ) -> "AlternativeSet":
        """Mechanically remove only explicitly named falsified alternatives."""

        require_unique(falsified_alternative_refs, "falsified_alternative_refs")
        unknown = tuple(
            ref
            for ref in falsified_alternative_refs
            if ref not in self.live_alternatives
        )
        if unknown:
            raise ValueError(
                "falsified alternatives must belong to the current live scope: "
                f"{unknown!r}"
            )
        retained = tuple(
            ref
            for ref in self.live_alternatives
            if ref not in falsified_alternative_refs
        )
        if not retained:
            raise ValueError("falsification cannot remove every live alternative")
        return AlternativeSet(
            selected=self.selected if self.selected in retained else None,
            live_alternatives=retained,
            cardinality=(
                Cardinality.SPECIAL if len(retained) > 1 else Cardinality.SINGULAR
            ),
        )


class UnresolvedQuestion(FrozenModel):
    id: Ref
    statement: Ref
    scope: FrozenMap = Field(default_factory=FrozenMap)
    missing_evidence: tuple[Ref, ...] = ()
    falsifiers: tuple[Ref, ...] = ()
    alternatives: AlternativeSet | None = None
    schema_version: Ref = "yf_arc3_v5.unresolved_question.v1"


class OperatorInvocation(LineagedRecord):
    record_kind: Literal["operator_invocation"] = "operator_invocation"
    operator: OperatorName
    operational_consciousness: OperationalConsciousnessReasoningOperation
    input_refs: tuple[Ref, ...] = ()
    authority_ref: Ref | None = None
    authority_source_unit: Ref | None = None
    authority_source_hash: Ref | None = None
    attributes: FrozenMap = Field(default_factory=FrozenMap)
    schema_version: Ref = "yf_arc3_v5.operator_invocation.v2"

    @model_validator(mode="after")
    def validate_authority_lineage(self) -> "OperatorInvocation":
        context = self.operational_consciousness.context
        if (context.owner_workflow_ref != self.workflow_instance_id
                or context.source_workflow_ref != self.workflow_definition_id
                or context.source_hash != self.source_hash or context.timeline_ref != self.timeline_id
                or self.operational_consciousness.current_frame_ref != self.frame_id
                or self.operational_consciousness.operation_ref != self.operator.value):
            raise ValueError('operational consciousness: invocation has another reasoning owner')
        if bool(self.authority_source_unit) != bool(self.authority_source_hash):
            raise ValueError("authority source unit and hash must appear together")
        if self.authority_source_hash and not self.authority_ref:
            raise ValueError("authority source lineage requires authority_ref")
        return self


class OperatorResult(LineagedRecord):
    record_kind: Literal["operator_result"] = "operator_result"
    invocation_id: Ref
    operator: OperatorName
    status: OperationStatus
    output_refs: tuple[Ref, ...] = ()
    reason_refs: tuple[Ref, ...] = ()
    attributes: FrozenMap = Field(default_factory=FrozenMap)
    schema_version: Ref = "yf_arc3_v5.operator_result.v1"


class RuleOrModel(FrozenModel):
    id: Ref
    kind: AuthorityKind
    input_schema: Ref
    output_schema: Ref
    reads: tuple[Ref, ...] = ()
    effect_class: EffectClass = EffectClass.PURE
    applicability: tuple[Ref, ...] = ()
    invariants: tuple[Ref, ...] = ()
    falsifiers: tuple[Ref, ...] = ()
    pure: bool = True
    source_unit: Ref
    source_hash: Ref
    generalization_layer: Ref
    schema_version: Ref = "yf_arc3_v5.rule_or_model.v1"

    @model_validator(mode="after")
    def validate_purity(self) -> "RuleOrModel":
        effect_is_pure = self.effect_class is EffectClass.PURE
        if self.pure != effect_is_pure:
            raise ValueError("purity flag and effect class must agree")
        return self


class CapabilityDefinition(FrozenModel):
    id: Ref
    input_schema: Ref
    output_schema: Ref
    reads: tuple[Ref, ...] = ()
    effect_class: EffectClass
    applicability: tuple[Ref, ...] = ()
    invariants: tuple[Ref, ...] = ()
    falsifiers: tuple[Ref, ...] = ()
    source_unit: Ref
    source_hash: Ref
    generalization_layer: Ref
    schema_version: Ref = "yf_arc3_v5.capability_definition.v1"


class WorkflowControlFrame(FrozenModel):
    """One durable interpreter frame; executable statements stay in compiled SRC."""

    block_kind: WorkflowBlockKind
    owner_id: Ref
    next_statement_index: NonNegativeRevision = 0
    iteration_index: NonNegativeRevision = 0
    control_data: FrozenMap = Field(default_factory=FrozenMap)
    schema_version: Ref = "yf_arc3_v5.workflow_control_frame.v1"


class WorkflowInstanceRecord(LineagedRecord):
    record_kind: Literal["workflow_instance"] = "workflow_instance"
    operational_consciousness_context: OperationalConsciousnessReasoningContext
    operational_consciousness_outcome: OperationalConsciousnessReasoningOutcome | None = None
    checkpoint_sequence: PositiveSequence
    status: WorkflowStatus
    current_step_id: Ref
    current_statement_id: Ref | None = None
    control_stack: tuple[WorkflowControlFrame, ...] = ()
    local_bindings: FrozenMap = Field(default_factory=FrozenMap)
    local_binding_updates: FrozenMap = Field(default_factory=FrozenMap)
    local_binding_removals: tuple[Ref, ...] = ()
    local_bindings_complete: bool = True
    pending_expectation_refs: tuple[Ref, ...] = ()
    module_source_hash: Ref
    awaiting_frame_binding: Ref | None = None
    pending_action_intent_id: Ref | None = None
    pending_action_release_permit_id: Ref | None = None
    pending_environment_adapter_ref: Ref | None = None
    pending_world_context: FrozenMap | None = None
    pre_action_snapshot_digest: Ref | None = None
    suspension_frame_id: Ref | None = None
    consumed_observation_refs: tuple[Ref, ...] = ()
    terminal_result: Ref | None = None
    source_terminal_binding: SourceTerminalBinding | None = None
    schema_version: Ref = "yf_arc3_v5.workflow_instance.v3"

    @model_validator(mode="after")
    def validate_checkpoint(self) -> "WorkflowInstanceRecord":
        context = self.operational_consciousness_context
        if (context.owner_workflow_ref != self.workflow_instance_id
                or context.source_workflow_ref != self.workflow_definition_id
                or context.source_hash != self.source_hash or context.timeline_ref != self.timeline_id):
            raise ValueError('operational consciousness: checkpoint has another reasoning owner')
        outcome = self.operational_consciousness_outcome
        requires_outcome = self.status.value in {'completed', 'blocked', 'failed', 'deferred', 'suspended'}
        if requires_outcome != (outcome is not None):
            raise ValueError('operational consciousness: checkpoint lost its actual boundary outcome')
        if outcome is not None and (outcome.context != context or outcome.producer_record_ref != self.id
                or outcome.status != self.status.value or outcome.current_frame_ref != self.frame_id
                or outcome.boundary_kind != 'workflow_checkpoint'
                or outcome.recipient_context_ref != (context.parent_context_ref or context.context_ref)):
            raise ValueError('operational consciousness: checkpoint outcome differs from its actual boundary')
        if self.source_terminal_binding is not None:
            required_status = {
                "stop": WorkflowStatus.COMPLETED,
                "block": WorkflowStatus.BLOCKED,
                "defer": WorkflowStatus.DEFERRED,
                "fail": WorkflowStatus.FAILED,
                "call_refusal": WorkflowStatus.BLOCKED,
                "call_deferral": WorkflowStatus.DEFERRED,
                "technical_failure": WorkflowStatus.FAILED,
            }[self.source_terminal_binding.kind]
            if self.status is not required_status:
                raise ValueError("terminal binding differs from its Source checkpoint status")
        require_unique(self.local_binding_removals, "local binding removals")
        if self.local_bindings_complete:
            if self.local_binding_updates or self.local_binding_removals:
                raise ValueError("complete checkpoint cannot also carry binding deltas")
        elif self.local_bindings:
            raise ValueError("delta checkpoint cannot repeat complete local bindings")
        if set(self.local_binding_updates) & set(self.local_binding_removals):
            raise ValueError("one binding cannot be both updated and removed")
        require_unique(self.pending_expectation_refs, "pending expectations")
        require_unique(self.consumed_observation_refs, "consumed observations")
        for description, source_hash in (
            ("workflow transitive source hash", self.source_hash),
            ("workflow module source hash", self.module_source_hash),
        ):
            if len(source_hash) != 64 or any(
                character not in "0123456789abcdef" for character in source_hash
            ):
                raise ValueError(f"{description} must be a lowercase SHA-256 digest")
        terminal = self.status in {
            WorkflowStatus.DEFERRED,
            WorkflowStatus.BLOCKED,
            WorkflowStatus.COMPLETED,
            WorkflowStatus.FAILED,
        }
        if terminal:
            if self.control_stack:
                raise ValueError("terminal workflow cannot retain a control stack")
            if not self.terminal_result:
                raise ValueError("terminal workflow requires a typed result")
        elif not self.control_stack:
            raise ValueError("non-terminal workflow requires a control stack")
        pending_values = (
            self.pending_action_intent_id,
            self.pending_action_release_permit_id,
            self.pending_environment_adapter_ref,
            self.pending_world_context,
            self.pre_action_snapshot_digest,
        )
        if any(pending_values) and not all(pending_values):
            raise ValueError("pending action lineage must be complete")
        if self.status is WorkflowStatus.SUSPENDED:
            if not all(pending_values):
                raise ValueError("suspended workflow requires pending action lineage")
            if not self.awaiting_frame_binding or not self.suspension_frame_id:
                raise ValueError(
                    "suspended workflow requires an exact frame continuation"
                )
        elif self.awaiting_frame_binding or self.suspension_frame_id:
            raise ValueError("only a suspended workflow may await a frame")
        return self


class WorkflowBindingValueRecord(LineagedRecord):
    """One content-addressed immutable value shared by checkpoint deltas."""

    record_kind: Literal["workflow_binding_value"] = "workflow_binding_value"
    value_digest: Ref
    payload: FrozenMap
    schema_version: Ref = "yf_arc3_v5.workflow_binding_value.v1"

    @model_validator(mode="after")
    def validate_value_digest(self) -> "WorkflowBindingValueRecord":
        if set(self.payload) != {"value"}:
            raise ValueError("workflow binding value payload must contain only value")
        if self.value_digest != stable_digest(self.payload["value"]):
            raise ValueError("workflow binding value digest mismatch")
        return self


class OperationalConsciousnessReasoningEntryRecord(LineagedRecord):
    record_kind: Literal['operational_consciousness_reasoning_entry'] = 'operational_consciousness_reasoning_entry'
    context: OperationalConsciousnessReasoningContext
    module_source_hash: Ref
    declared_operations: tuple[OperationalConsciousnessSourceOperation, ...] = Field(min_length=1)
    initiating_operation: OperationalConsciousnessReasoningOperation | None = None
    replay_of_record_ref: Ref | None = None
    grants_action: Literal[False] = False
    schema_version: Literal['operational_consciousness_reasoning_entry.v1'] = 'operational_consciousness_reasoning_entry.v1'

    @model_validator(mode='after')
    def preserve_entry_origin(self):
        if (self.context.entry_kind in ('compiled_replay_validation', 'compiled_replay_child')) != (self.replay_of_record_ref is not None):
            raise ValueError('operational consciousness: replay validation lost its historical subject')
        if (self.context.owner_workflow_ref != self.workflow_instance_id
                or self.context.source_workflow_ref != self.workflow_definition_id
                or self.context.source_hash != self.source_hash
                or self.context.timeline_ref != self.timeline_id
                or self.context.origin_frame_ref != self.frame_id):
            raise ValueError('operational consciousness: compiled entry changed its origin')
        require_unique(tuple(op.statement_ref for op in self.declared_operations), 'conscious SRC instructions')
        if self.context.entry_kind in ('compiled_source_child', 'compiled_replay_child'):
            if (self.initiating_operation is None
                    or self.context.parent_context_ref != self.initiating_operation.context.context_ref
                    or self.context.root_context_ref != self.initiating_operation.context.root_context_ref
                    or self.context.composition_edge_ref != self.initiating_operation.statement_ref):
                raise ValueError('operational consciousness: compiled child lost its initiating lineage')
        if self.initiating_operation is not None:
            origin = self.initiating_operation
            if (origin.context.run_ref != self.context.run_ref
                    or origin.context.timeline_ref != self.context.timeline_ref
                    or origin.current_frame_ref != self.frame_id):
                raise ValueError('operational consciousness: compiled contribution lost its initiating scope')
        return self


class ConsciousCompiledRecord(LineagedRecord):
    operational_consciousness: OperationalConsciousnessReasoningReturn
    expected_outcome_status: ClassVar[CompiledReasoningReturnStatus] = 'completed'

    @model_validator(mode='after')
    def preserve_conscious_return(self):
        context = self.operational_consciousness.context
        if (self.operational_consciousness.outcome.status != self.expected_outcome_status
                or self.operational_consciousness.outcome.producer_record_ref != self.id
                or context.owner_workflow_ref != self.workflow_instance_id
                or context.source_workflow_ref != self.workflow_definition_id
                or context.source_hash != self.source_hash or context.timeline_ref != self.timeline_id
                or any(op.current_frame_ref != self.frame_id for op in self.operational_consciousness.operations)):
            raise ValueError('operational consciousness: compiled result lost its reasoning origin')
        return self


class OperationalConsciousnessPublicReturnRecord(LineagedRecord):
    """An actual public delivery, distinct from consuming or resolving its cause."""
    record_kind: Literal['operational_consciousness_public_return'] = 'operational_consciousness_public_return'
    returned_outcome: OperationalConsciousnessReasoningOutcome
    request_method_ref: Ref
    public_kind: Literal['operational_consciousness_wait', 'operational_consciousness_refusal',
                         'operational_consciousness_failure']
    exception_type_ref: Ref | None = None
    automatic_retry_authorized: Literal[False] = False
    grants_action: Literal[False] = False
    consumption: Literal['not_attested_by_publication'] = 'not_attested_by_publication'
    schema_version: Literal['operational_consciousness_public_return.v1'] = 'operational_consciousness_public_return.v1'

    @model_validator(mode='after')
    def preserve_public_return_origin(self):
        outcome = self.returned_outcome
        context = outcome.context
        allowed = {'operational_consciousness_wait': ('deferred',),
            'operational_consciousness_refusal': ('blocked', 'failed'),
            'operational_consciousness_failure': ('failed',)}
        if (outcome.status not in allowed[self.public_kind]
                or (self.exception_type_ref is not None) != (self.public_kind == 'operational_consciousness_failure')
                or self.workflow_instance_id != context.owner_workflow_ref
                or self.workflow_definition_id != context.source_workflow_ref
                or self.source_hash != context.source_hash or self.timeline_id != context.timeline_ref
                or self.frame_id != outcome.current_frame_ref
                or self.id == outcome.producer_record_ref):
            raise ValueError('operational consciousness: public delivery changed its returned cause or scope')
        return self


class OperationalConsciousnessReplayValidationRecord(ConsciousCompiledRecord):
    """Current replay result, never a replacement of the historical completion."""
    record_kind: Literal['operational_consciousness_replay_validation'] = 'operational_consciousness_replay_validation'
    historical_record_ref: Ref
    historical_result_digest: Ref = Field(pattern='^[0-9a-f]{64}$')
    replayed_result_digest: Ref = Field(pattern='^[0-9a-f]{64}$')
    grants_action: Literal[False] = False
    schema_version: Literal['operational_consciousness_replay_validation.v1'] = 'operational_consciousness_replay_validation.v1'

    @model_validator(mode='after')
    def preserve_historical_result(self):
        if (self.operational_consciousness.context.entry_kind not in ('compiled_replay_validation', 'compiled_replay_child')
                or self.historical_record_ref == self.id
                or self.historical_result_digest != self.replayed_result_digest):
            raise ValueError('operational consciousness: replay did not reproduce its independent historical result')
        return self


class OperationalConsciousnessReasoningFailureRecord(ConsciousCompiledRecord):
    """Actual technical failure, without model falsification or ACT permission."""
    expected_outcome_status: ClassVar[str] = 'failed'
    record_kind: Literal['operational_consciousness_reasoning_failure'] = 'operational_consciousness_reasoning_failure'
    exception_type_ref: Ref
    attempted_result_ref: Ref | None = None
    automatic_retry_authorized: Literal[False] = False
    schema_version: Literal['operational_consciousness_reasoning_failure.v1'] = 'operational_consciousness_reasoning_failure.v1'


class OperationalConsciousnessReasoningCallRefusalRecord(ConsciousCompiledRecord):
    """A compiled caller retains the same typed refusal as an interpreted CALL."""
    expected_outcome_status: ClassVar[str] = 'blocked'
    record_kind: Literal['operational_consciousness_reasoning_call_refusal'] = 'operational_consciousness_reasoning_call_refusal'
    call_refusal: SourceCallRefusal
    direct_call_operation: OperationalConsciousnessReasoningOperation | None = None
    schema_version: Literal['operational_consciousness_reasoning_call_refusal.v1'] = 'operational_consciousness_reasoning_call_refusal.v1'

    @model_serializer(mode='wrap')
    def preserve_child_refusal_history(self, handler):
        data = handler(self)
        if self.direct_call_operation is None:
            data.pop('direct_call_operation', None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if name != 'direct_call_operation' or self.direct_call_operation is not None)

    @model_validator(mode='after')
    def actual_refused_call(self):
        returned, refusal = self.operational_consciousness, self.call_refusal
        if (refusal.workflow_instance_ref != returned.context.owner_workflow_ref
                or not any(operation.statement_ref == refusal.statement_ref
                    and operation.operation_ref == refusal.callee_ref for operation in returned.operations)):
            raise ValueError('operational consciousness: compiled refusal has no actual requesting instruction')
        if (refusal.reasoning_entry_refusal is not None
                and refusal.reasoning_entry_refusal.initiating_operation not in returned.operations):
            raise ValueError('operational consciousness: refused entry differs from the actual requesting operation')
        if self.direct_call_operation is not None:
            operation = self.direct_call_operation
            if (refusal.child_failure_checkpoint_ref is not None
                    or refusal.child_reasoning_outcome_ref is not None
                    or refusal.reasoning_entry_refusal is not None):
                raise ValueError('operational consciousness: direct refusal cannot claim a child cause')
            if (operation.context != returned.context or operation not in returned.operations
                    or operation.statement_ref != refusal.statement_ref
                    or operation.operation_ref != refusal.callee_ref):
                raise ValueError('operational consciousness: direct refusal changed its actual invocation')
        return self


class OperationalConsciousnessReasoningCallDeferralRecord(ConsciousCompiledRecord):
    """An unresolved child remains a scoped wait, never a technical failure."""
    expected_outcome_status: ClassVar[str] = 'deferred'
    record_kind: Literal['operational_consciousness_reasoning_call_deferral'] = 'operational_consciousness_reasoning_call_deferral'
    call_deferral: SourceCallDeferral
    automatic_retry_authorized: Literal[False] = False
    schema_version: Literal['operational_consciousness_reasoning_call_deferral.v1'] = 'operational_consciousness_reasoning_call_deferral.v1'

    @model_validator(mode='after')
    def actual_deferred_call(self):
        returned, deferral = self.operational_consciousness, self.call_deferral
        if (deferral.workflow_instance_ref != returned.context.owner_workflow_ref
                or not any(operation.statement_ref == deferral.statement_ref
                    and operation.operation_ref == deferral.callee_ref for operation in returned.operations)
                or not (deferral.child_deferred_checkpoint_ref or deferral.child_reasoning_outcome_ref)):
            raise ValueError('operational consciousness: compiled wait has no actual requesting instruction or child')
        return self


class OperationalConsciousnessReasoningRefusalRecord(ConsciousCompiledRecord):
    """A DRM non-selection is a returned uncertainty, with every alternative retained."""
    expected_outcome_status: ClassVar[str] = 'blocked'
    record_kind: Literal['operational_consciousness_reasoning_refusal'] = 'operational_consciousness_reasoning_refusal'
    policy_ref: Ref
    drm_source_hash: Ref
    alternative_refs: tuple[Ref, ...]
    selection_result: FrozenMap
    schema_version: Ref = 'operational_consciousness_reasoning_refusal.v1'

    @model_validator(mode='after')
    def exact_non_selection(self):
        from agents.yf_arc3_v5.operators.contracts import SelectionResult
        result = SelectionResult.model_validate(self.selection_result)
        operations = self.operational_consciousness.operations
        if result.selected_ref is not None or operations[-1].operation_ref != 'SELECT':
            raise ValueError('operational consciousness: refusal is not an actual unresolved SELECT')
        if len(self.alternative_refs) != len(set(self.alternative_refs)):
            raise ValueError('operational consciousness: refusal repeats its alternative domain')
        return self


class CompiledSelectionDecisionRecord(ConsciousCompiledRecord):
    """Canonical output of one source-bound compiled SRC/DRM selection path."""

    record_kind: Literal["compiled_selection_decision"] = "compiled_selection_decision"
    operational_consciousness: OperationalConsciousnessReasoningReturn | None = None
    run_ref: Ref | None = None
    workflow_definition_id: Ref
    workflow_instance_id: Ref
    module_source_hash: Ref
    drm_source_hashes: tuple[Ref, ...] = Field(min_length=1, max_length=8)
    path: tuple[tuple[Ref, Ref], ...] = Field(min_length=1, max_length=8)
    terminal_ref: Ref
    assessment: FrozenMap
    descriptive_facts: FrozenMap
    schema_version: Ref = "yf_arc3_v5.compiled_selection_decision.v3"

    @property
    def execution_run_ref(self):
        return (self.operational_consciousness.context.run_ref
                if self.operational_consciousness is not None else self.run_ref)

    @model_validator(mode='after')
    def preserve_conscious_return(self):
        if self.operational_consciousness is not None:
            super().preserve_conscious_return()
            if self.run_ref is not None and self.run_ref != self.execution_run_ref:
                raise ValueError('compiled selection changed its execution run')
        elif self.run_ref is None or self.timeline_id is None or self.frame_id is None:
            raise ValueError('direct compiled selection requires its explicit execution scope')
        return self

    @model_validator(mode="after")
    def validate_compiled_selection(self) -> "CompiledSelectionDecisionRecord":
        for source_hash in (self.source_hash, self.module_source_hash, *self.drm_source_hashes):
            if len(source_hash) != 64 or any(char not in "0123456789abcdef" for char in source_hash):
                raise ValueError("compiled selection requires exact source hashes")
        if self.workflow_step_id != self.path[-1][0]:
            raise ValueError("compiled selection terminal step must end its path")
        alternatives = self.assessment.get("alternatives")
        if not isinstance(alternatives, FrozenMap) or alternatives.get("selected") != self.terminal_ref:
            raise ValueError("compiled selection assessment and terminal disagree")
        if not self.assessment.get("reason_refs"):
            raise ValueError("compiled selection requires inspectable reasons")
        return self


class CompiledCalculationFailureRecord(LineagedRecord):
    """Durable failure of a source-bound calculation, without a child activity."""
    record_kind: Literal['compiled_calculation_failure'] = 'compiled_calculation_failure'
    run_ref: Ref
    workflow_definition_id: Ref
    workflow_instance_id: Ref
    workflow_step_id: Ref
    timeline_id: Ref
    frame_id: Ref
    module_source_hash: Ref
    status: Literal['blocked', 'deferred', 'failed']
    exception_type_ref: Ref
    detail: str = Field(max_length=2048)
    selection_refusal: FrozenMap | None = None
    schema_version: Ref = 'yf_arc3_v5.compiled_calculation_failure.v1'


class CompiledCalculationPublicReturnRecord(LineagedRecord):
    """Actual delivery of a calculation failure, separate from its resolution."""
    record_kind: Literal['compiled_calculation_public_return'] = 'compiled_calculation_public_return'
    run_ref: Ref
    calculation_record_ref: Ref
    request_method_ref: Ref
    schema_version: Ref = 'yf_arc3_v5.compiled_calculation_public_return.v1'


class CompiledSceneAssimilationRecord(ConsciousCompiledRecord):
    """Small source-bound witness for a mechanically measured scene."""

    record_kind: Literal["compiled_scene_assimilation"] = "compiled_scene_assimilation"
    workflow_definition_id: Ref
    workflow_instance_id: Ref
    workflow_step_id: Ref
    frame_id: Ref
    module_source_hash: Ref
    raw_input_ref: Ref
    scene_scope_ref: Literal["scene_scope.full", "scene_scope.block_grid"] = (
        "scene_scope.full"
    )
    action_conditioned_grid_evidence: bool
    retained_grid_geometry: tuple[str | int, ...] | None = None
    retained_grid_separator_consistency_ppm: int = 0
    path: tuple[Ref, Ref, Ref]
    scene_digest: Ref
    schema_version: Ref = "yf_arc3_v5.compiled_scene_assimilation.v2"

    @model_validator(mode="after")
    def validate_compiled_scene(self) -> "CompiledSceneAssimilationRecord":
        for source_hash in (self.source_hash, self.module_source_hash, self.scene_digest):
            if len(source_hash) != 64 or any(char not in "0123456789abcdef" for char in source_hash):
                raise ValueError("compiled scene requires exact source and scene hashes")
        if self.workflow_step_id != self.path[-1]:
            raise ValueError("compiled scene terminal step must end its path")
        return self


class CompiledTemporalTrackingRecord(ConsciousCompiledRecord):
    """Small witness for source-declared mechanical temporal identity matching."""

    record_kind: Literal["compiled_temporal_tracking"] = "compiled_temporal_tracking"
    workflow_definition_id: Ref
    workflow_instance_id: Ref
    workflow_step_id: Ref
    frame_id: Ref
    module_source_hash: Ref
    previous_frame_ref: Ref | None = None
    action_ref: Ref
    reset_correspondence: bool
    tracking_scope_ref: Literal[
        "tracking_scope.full_blocks",
        "tracking_scope.retained_grid_unique_multivalue_cells",
        "tracking_scope.retained_grid_informative_cells",
        "tracking_scope.retained_grid_delta_cells",
    ] = "tracking_scope.full_blocks"
    scoped_component_refs: tuple[Ref, ...] = Field(default=(), max_length=64)
    scene_digest: Ref
    tracking_input_digest: Ref
    tracking_digest: Ref
    participant_measurements: tuple[OperationalConsciousnessParticipantMeasurement, ...] = ()
    schema_version: Ref = "yf_arc3_v5.compiled_temporal_tracking.v3"

    @model_validator(mode="after")
    def validate_compiled_tracking(self) -> "CompiledTemporalTrackingRecord":
        require_unique(tuple(row.entity_ref for row in self.participant_measurements), 'measured participant identities')
        for source_hash in (
            self.source_hash, self.module_source_hash,
            self.scene_digest, self.tracking_input_digest, self.tracking_digest,
        ):
            if len(source_hash) != 64 or any(char not in "0123456789abcdef" for char in source_hash):
                raise ValueError("compiled tracking requires exact source and value hashes")
        if self.previous_frame_ref == self.frame_id:
            raise ValueError("compiled tracking predecessor must be an earlier frame")
        if (
            self.tracking_scope_ref == "tracking_scope.full_blocks"
            and self.scoped_component_refs
        ):
            raise ValueError("full tracking scope must not duplicate component refs")
        if (
            self.tracking_scope_ref != "tracking_scope.full_blocks"
            and not self.scoped_component_refs
        ):
            raise ValueError("retained-grid tracking scope requires exact component refs")
        return self

    @model_serializer(mode='wrap')
    def preserve_prior_tracking_shape(self, handler):
        data = handler(self)
        if 'participant_measurements' not in self.model_fields_set:
            data.pop('participant_measurements', None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if name != 'participant_measurements' or name in self.model_fields_set)


class CompiledInteractionEffectRecord(ConsciousCompiledRecord):
    """Compact witness for one source-declared interaction classification."""

    record_kind: Literal["compiled_interaction_effect"] = (
        "compiled_interaction_effect"
    )
    workflow_definition_id: Ref
    workflow_instance_id: Ref
    workflow_step_id: Ref
    frame_id: Ref
    module_source_hash: Ref
    drm_source_hashes: tuple[Ref, ...] = Field(min_length=1, max_length=8)
    path: tuple[Ref, ...] = Field(min_length=4, max_length=5)
    effect_ref: Ref
    transient_evidence_ref: Ref
    measurement_digest: Ref
    contextual_claim_refs: tuple[Ref, ...] = Field(min_length=1)
    transient_claim_refs: tuple[Ref, ...] = ()
    state_revision_before: NonNegativeRevision
    operational_physical_effect: OperationalConsciousnessMeasuredEffect | None = None
    schema_version: Ref = "yf_arc3_v5.compiled_interaction_effect.v2"

    @model_validator(mode="after")
    def validate_compiled_interaction_effect(
        self,
    ) -> "CompiledInteractionEffectRecord":
        for source_hash in (
            self.source_hash,
            self.module_source_hash,
            *self.drm_source_hashes,
            self.measurement_digest,
        ):
            if len(source_hash) != 64 or any(
                character not in "0123456789abcdef" for character in source_hash
            ):
                raise ValueError(
                    "compiled interaction effect requires exact source hashes"
                )
        if self.workflow_step_id != self.path[-1]:
            raise ValueError("compiled interaction path must end at its recorded step")
        if self.state_revision_before > self.state_revision:
            raise ValueError("compiled interaction revisions are reversed")
        require_unique(self.contextual_claim_refs, "contextual interaction claims")
        require_unique(self.transient_claim_refs, "transient interaction claims")
        measured = self.operational_physical_effect
        if measured is not None and (measured.after_frame_ref != self.frame_id
                or measured.measurement_digest != self.measurement_digest
                or (measured.before_raw_input_ref, measured.after_raw_input_ref) != self.provenance):
            raise ValueError('compiled physical effect changed its measured inputs or result')
        return self

    @model_serializer(mode='wrap')
    def preserve_prior_effect_shape(self, handler):
        data = handler(self)
        if 'operational_physical_effect' not in self.model_fields_set:
            data.pop('operational_physical_effect', None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if name != 'operational_physical_effect' or name in self.model_fields_set)


class StateChange(FrozenModel):
    target_ref: Ref
    before_digest: Ref | None = None
    after_digest: Ref
    update_policy_ref: Ref
    invalidates: tuple[Ref, ...] = ()
    recalculates: tuple[Ref, ...] = ()
    schema_version: Ref = "yf_arc3_v5.state_change.v1"


class StateChangeProposal(LineagedRecord):
    record_kind: Literal["state_change_proposal"] = "state_change_proposal"
    source_change_id: Ref
    changes: tuple[StateChange, ...] = Field(min_length=1)
    evidence_refs: tuple[Ref, ...] = Field(min_length=1)
    schema_version: Ref = "yf_arc3_v5.state_change_proposal.v1"


class ViabilityAssessment(LineagedRecord):
    record_kind: Literal["viability_assessment"] = "viability_assessment"
    change_ref: Ref
    status: ViabilityStatus
    principles_preserved: tuple[Ref, ...] = ()
    principles_violated: tuple[Ref, ...] = ()
    unresolved_conditions: tuple[Ref, ...] = ()
    missing_evidence: tuple[Ref, ...] = ()
    resource_consequences: FrozenMap = Field(default_factory=FrozenMap)
    reversibility: Reversibility = Reversibility.UNKNOWN
    alternatives_preserved: tuple[Ref, ...] = ()
    schema_version: Ref = "yf_arc3_v5.viability_assessment.v1"


class CommitmentDecision(LineagedRecord):
    record_kind: Literal["commitment_decision"] = "commitment_decision"
    change_ref: Ref
    decision: CommitmentKind
    viability_assessment_id: Ref
    policy_ref: Ref
    reason_refs: tuple[Ref, ...] = Field(min_length=1)
    alternatives_preserved: tuple[Ref, ...] = ()
    schema_version: Ref = "yf_arc3_v5.commitment_decision.v1"


class PropagationReport(LineagedRecord):
    record_kind: Literal["propagation_report"] = "propagation_report"
    source_change_id: Ref
    affected_refs: tuple[Ref, ...] = ()
    invalidated_refs: tuple[Ref, ...] = ()
    recomputed_refs: tuple[Ref, ...] = ()
    fixpoint_reached: bool
    blocking_contradiction_ref: Ref | None = None
    schema_version: Ref = "yf_arc3_v5.propagation_report.v1"

    @model_validator(mode="after")
    def validate_stop_result(self) -> "PropagationReport":
        if self.fixpoint_reached and self.blocking_contradiction_ref:
            raise ValueError(
                "fixpoint and blocking contradiction are mutually exclusive"
            )
        if not self.fixpoint_reached and not self.blocking_contradiction_ref:
            raise ValueError(
                "non-fixpoint propagation requires a blocking contradiction"
            )
        return self


class MemoryReuseContract(FrozenModel):
    """Source-declared recall, current revalidation and frozen proof versions.

    A read is not reuse. This contract is consultative, not an executable old
    route, and cannot establish an unobserved mechanism or terminal relation.
    """

    contract_ref: Ref
    recalled_claim_refs: tuple[Ref, ...] = Field(min_length=1, max_length=32)
    current_support_claim_refs: tuple[Ref, ...] = Field(min_length=1, max_length=32)
    observation_ref: Ref
    claim_digests: FrozenMap
    schema_version: Ref = "yf_arc3_v5.memory_reuse_contract.v1"

    @model_validator(mode="after")
    def validate_proof_sets(self) -> "MemoryReuseContract":
        require_unique(self.recalled_claim_refs, "recalled memory claims")
        require_unique(self.current_support_claim_refs, "current memory support claims")
        if set(self.recalled_claim_refs).intersection(self.current_support_claim_refs):
            raise ValueError("recalled evidence cannot substitute for current revalidation")
        if set(self.claim_digests) != set((*self.recalled_claim_refs, *self.current_support_claim_refs)):
            raise ValueError("memory reuse requires exact frozen versions of every proof")
        if any(not isinstance(value, str) or len(value) != 64
                or any(character not in "0123456789abcdef" for character in value)
                for _reference, value in self.claim_digests.canonical_items()):
            raise ValueError("memory proof versions must be bounded SHA-256 digests")
        return self


class ControlEvidenceSignature(FrozenModel):
    """Exact scene-local binding of a declared control observation.

    Receiver references are a set. Appearance and a shared action name never
    substitute for any field; None means the entire addressed control.
    """

    modality_ref: Ref
    action_kind_ref: Ref
    addressed_control_ref: Ref
    addressed_subpart_ref: Ref | None = None
    receiver_refs: tuple[Ref, ...] = Field(min_length=1, max_length=64)
    mode_ref: Ref
    local_frame_ref: Ref

    @model_validator(mode="after")
    def validate_receivers(self) -> "ControlEvidenceSignature":
        require_unique(self.receiver_refs, "control evidence receivers")
        return self

    def scope_key(self) -> tuple:
        return (self.modality_ref, self.action_kind_ref, self.addressed_control_ref,
                self.addressed_subpart_ref, tuple(sorted(self.receiver_refs)),
                self.mode_ref, self.local_frame_ref)

    def response_recall_key(self) -> tuple:
        """Compare historical response candidates, never current ACT authority.

        Observation frames remain in each witness. A hypothetical recalled
        response still requires a new current scope binding before release.
        """
        return (self.modality_ref, self.action_kind_ref, self.addressed_control_ref,
                self.addressed_subpart_ref, tuple(sorted(self.receiver_refs)), self.mode_ref)


class ParentQuestionBinding(FrozenModel):
    """Canonical local continuation whose parent and question must reach WHY."""

    continuation_workflow_ref: Ref
    continuation_checkpoint_ref: Ref
    consumption_receipt_ref: Ref
    question_checkpoint_ref: Ref
    parent_goal_ref: Ref
    question_goal_ref: Ref
    timeline_id: Ref
    frame_id: Ref | None
    question_product_ref: Ref | None = None
    question_product_digest: Ref | None = None

    @model_validator(mode="after")
    def validate_product_seal(self):
        if (self.question_product_ref is None) != (self.question_product_digest is None):
            raise ValueError("question product identity and digest must be bound together")
        return self

    @model_serializer(mode="wrap")
    def serialize_original_optional_product_shape(self, handler):
        data = handler(self)
        for name in ("question_product_ref", "question_product_digest"):
            if getattr(self, name) is None:
                data.pop(name, None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if name not in ("question_product_ref", "question_product_digest")
            or getattr(self, name) is not None)


class OperationalConsciousnessReevaluationRecord(LineagedRecord):
    record_kind: Literal['operational_consciousness_reevaluation'] = 'operational_consciousness_reevaluation'
    demand: OperationalConsciousnessReevaluationDemand
    previous_record_ref: Ref | None = None
    status: Literal['pending', 'consumed', 'waiting', 'superseded']
    consumption_ref: Ref | None = None
    measured_input_digest: Ref | None = None
    projection_digest: Ref | None = None
    projection_facts: FrozenMap | None = None
    projection_input_facts: FrozenMap | None = None
    dependency_goal_facts: FrozenMap | None = None
    wake_dependency_versions: FrozenMap | None = None
    wake_reason_ref: Ref | None = None
    successor_work_refs: tuple[Ref, ...] = ()
    grants_action: Literal[False] = False
    schema_version: Literal['operational_consciousness_reevaluation.v1'] = 'operational_consciousness_reevaluation.v1'

    @model_serializer(mode='wrap')
    def preserve_pre_recall_basis_shape(self, handler):
        data = handler(self)
        if self.projection_input_facts is None:
            data.pop('projection_input_facts', None)
        if self.dependency_goal_facts is None:
            data.pop('dependency_goal_facts', None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if (name != 'projection_input_facts' or self.projection_input_facts is not None)
            and (name != 'dependency_goal_facts' or self.dependency_goal_facts is not None))

    @model_validator(mode='after')
    def exact_progress(self):
        if self.projection_input_facts is not None and (self.status != 'consumed'
                or self.demand.kind != 'goal_dependency_admission'
                or set(self.projection_input_facts) != {self.demand.problem_ref}):
            raise ValueError('operational consciousness: recall basis must belong to the consumed goal')
        if self.projection_input_facts is not None:
            basis = self.projection_input_facts[self.demand.problem_ref]
            premises = self.demand.semantic_inputs.get('goal_facts', FrozenMap())
            if not isinstance(basis, Mapping) or any(key not in basis or basis[key] != value for key, value in sorted(premises.items())
                    if key != '__admission_policy_digest'):
                raise ValueError('operational consciousness: recall basis changed its declared goal premises')
        if self.dependency_goal_facts is not None:
            if (self.projection_input_facts is None
                    or self.dependency_goal_facts.get(self.demand.problem_ref)
                        != self.projection_input_facts[self.demand.problem_ref]
                    or not set(self.dependency_goal_facts) <= set(self.demand.dependency_versions)
                    or any(not isinstance(row, Mapping) for _, row in sorted(self.dependency_goal_facts.items()))):
                raise ValueError('operational consciousness: dependency basis lost its declared goal domain')
        if self.timeline_id != self.demand.origin_context.timeline_ref:
            raise ValueError('operational consciousness: work crossed its original timeline')
        if self.status != 'consumed' and any(value is not None for value in (
                self.consumption_ref, self.measured_input_digest, self.projection_digest, self.projection_facts)):
            raise ValueError('operational consciousness: only consumed work carries a consumption projection')
        if self.status != 'waiting' and (self.wake_reason_ref is not None or self.wake_dependency_versions is not None):
            raise ValueError('operational consciousness: only waiting work carries a wake condition')
        if self.status != 'superseded' and self.successor_work_refs:
            raise ValueError('operational consciousness: only superseded work delegates to successors')
        if len(set(self.successor_work_refs)) != len(self.successor_work_refs):
            raise ValueError('operational consciousness: successor responsibilities must be unique')
        if self.status == 'consumed' and (not self.consumption_ref or not self.projection_digest or not self.measured_input_digest):
            raise ValueError('operational consciousness: work requires its actual measured consumption')
        if self.status == 'consumed' and (self.consumption_ref != self.id
                or self.projection_facts is None or stable_digest(self.projection_facts) != self.projection_digest):
            raise ValueError('operational consciousness: consumption must retain its exact canonical projection')
        if self.status == 'waiting' and (not self.wake_reason_ref or self.wake_dependency_versions is None):
            raise ValueError('operational consciousness: waiting work lost its wake condition')
        if self.status == 'superseded' and not self.successor_work_refs:
            raise ValueError('operational consciousness: superseded work lost its replacement')
        return self


class OperationalConsciousnessGoalWatchRecord(LineagedRecord):
    """Last examined premises of a scoped goal, independently of the acting parent."""
    record_kind: Literal['operational_consciousness_goal_watch'] = 'operational_consciousness_goal_watch'
    operational_consciousness_context: OperationalConsciousnessReasoningContext
    goal_ref: Ref
    execution_scope: FrozenMap
    previous_record_ref: Ref | None
    goal_present: bool
    dependency_snapshot: OperationalConsciousnessDependencySnapshot
    semantic_inputs: FrozenMap
    changed_dependency_refs: tuple[Ref, ...]
    disposition_ref: Ref
    reevaluation_required: bool
    reevaluation_work_ref: Ref | None = None
    grants_action: Literal[False] = False
    schema_version: Literal['operational_consciousness_goal_watch.v1'] = 'operational_consciousness_goal_watch.v1'

    @model_validator(mode='after')
    def preserve_watched_problem(self):
        if (self.goal_ref != self.dependency_snapshot.problem_ref
                or self.timeline_id != self.operational_consciousness_context.timeline_ref
                or (self.reevaluation_required and (
                    not self.goal_present
                    or (self.previous_record_ref is None
                        and self.disposition_ref != 'goal_watch.initialize')))
                or self.reevaluation_required != (self.reevaluation_work_ref is not None)):
            raise ValueError('operational consciousness: goal watch lost its examined problem or prior premises')
        return self


class OperationalConsciousnessContinuationReviewRecord(LineagedRecord):
    record_kind: Literal['operational_consciousness_continuation_review'] = 'operational_consciousness_continuation_review'
    operational_consciousness_context: OperationalConsciousnessReasoningContext
    intent_ref: Ref
    identity: FrozenMap
    selection_frontier: OperationalConsciousnessSelectionFrontier | None
    measured_facts: FrozenMap
    projection_facts: FrozenMap
    review_policy_hash: Ref
    native_preparation_evidence_by_request: FrozenMap = Field(default_factory=FrozenMap)
    native_command_budget_by_request: FrozenMap = Field(default_factory=FrozenMap)
    native_admission_witnesses: FrozenMap = Field(default_factory=FrozenMap)
    grants_action: Literal[False] = False
    schema_version: Literal['operational_consciousness_continuation_review.v1'] = 'operational_consciousness_continuation_review.v1'

    @model_validator(mode='after')
    def bind_review_identity(self):
        context = self.operational_consciousness_context
        if (context.owner_workflow_ref != self.workflow_instance_id
                or context.source_workflow_ref != self.workflow_definition_id
                or context.source_hash != self.source_hash or context.timeline_ref != self.timeline_id
                or self.identity.get('timeline_ref') != self.timeline_id
                or self.identity.get('frame_ref') != self.frame_id):
            raise ValueError('continuation review lost its exact selection scope')
        return self

    @model_serializer(mode='wrap')
    def preserve_historical_preparation_shape(self, handler):
        data = handler(self)
        for name in ('native_preparation_evidence_by_request', 'native_command_budget_by_request', 'native_admission_witnesses'):
            if name not in self.model_fields_set:
                data.pop(name, None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if name not in ('native_preparation_evidence_by_request', 'native_command_budget_by_request', 'native_admission_witnesses') or name in self.model_fields_set)


class OperationalUnderstandingAssessmentRecord(LineagedRecord):
    record_kind: Literal['operational_understanding_assessment'] = 'operational_understanding_assessment'
    operational_consciousness_context: OperationalConsciousnessReasoningContext
    goal_ref: Ref
    question_ref: Ref
    scope_ref: Ref
    epoch: int = Field(ge=0)
    input_signature: Ref
    previous_record_ref: Ref | None
    decision: FrozenMap
    consumed_observation_ref: Ref | None = None
    answer_established: Literal[False] = False
    grants_action: Literal[False] = False
    schema_version: Literal['operational_understanding_assessment.v1'] = 'operational_understanding_assessment.v1'

    @model_validator(mode='after')
    def preserve_question(self):
        if self.consumed_observation_ref is not None:
            incoming = self.decision.get('frozen_request', FrozenMap()).get('observed_return')
            if (incoming is None or incoming.get('record_ref') != self.consumed_observation_ref
                    or self.decision.get('source_disposition_ref') not in (
                        'experiment.review_observed_result', 'experiment.end_cost_limited_trial')):
                raise ValueError('understanding observation receipt has no actual Source consumption')
            if (self.decision.get('source_disposition_ref') == 'experiment.end_cost_limited_trial'
                    and self.decision['frozen_measurement']['facts'].get('observed_understanding_cost_limit_reached') is not True):
                raise ValueError('understanding cost boundary has no current measured cost proof')
        goal = self.decision.get('understanding_goal')
        request = self.decision.get('frozen_request', {})
        if (goal is None or request.get('understanding_goal') != goal
                or any(goal.get(key) != getattr(self, key) for key in ('goal_ref','question_ref','scope_ref','epoch'))
                or self.decision.get('understanding_record_ref') != self.id
                or self.decision.get('understanding_consumption_ref') is not None
                or self.timeline_id != self.operational_consciousness_context.timeline_ref):
            raise ValueError('operational consciousness: understanding assessment lost its exact question')
        return self


class OperationalUnderstandingConsumptionRecord(LineagedRecord):
    record_kind: Literal['operational_understanding_consumption'] = 'operational_understanding_consumption'
    operational_consciousness_context: OperationalConsciousnessReasoningContext
    assessment_ref: Ref
    input_signature: Ref
    source_disposition_ref: Ref | None = None
    unavailable_evidence_refs: tuple[Ref, ...] | None = None
    cost_missing_fields: tuple[Ref, ...] | None = None
    admission_obligations: tuple[OperationalConsciousnessExperimentAdmissionObligation, ...] | None = None
    conscious_reasoning_basis_digest: Ref | None = None
    goal_contribution_review: FrozenMap | None = None
    answer_established: Literal[False] = False
    grants_action: Literal[False] = False
    schema_version: Literal['operational_understanding_consumption.v1'] = 'operational_understanding_consumption.v1'

    @model_serializer(mode='wrap')
    def preserve_historical_consumption_shape(self, handler):
        data = handler(self)
        for name in ('source_disposition_ref', 'unavailable_evidence_refs', 'cost_missing_fields', 'admission_obligations', 'conscious_reasoning_basis_digest', 'goal_contribution_review'):
            if name not in self.model_fields_set:
                data.pop(name, None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if name not in ('source_disposition_ref', 'unavailable_evidence_refs', 'cost_missing_fields', 'admission_obligations', 'conscious_reasoning_basis_digest', 'goal_contribution_review')
            or name in self.model_fields_set)


class OperationalUnderstandingObservationRecord(LineagedRecord):
    record_kind: Literal['operational_understanding_observation'] = 'operational_understanding_observation'
    operational_consciousness_context: OperationalConsciousnessReasoningContext
    assessment_ref: Ref
    previous_record_ref: Ref | None
    returned: FrozenMap
    grants_action: Literal[False] = False
    schema_version: Literal['operational_understanding_observation.v1'] = 'operational_understanding_observation.v1'

    @model_validator(mode='after')
    def preserve_observed_question(self):
        if (self.returned.get('record_ref') != self.id
                or self.returned.get('request', FrozenMap()).get('assessment_ref') != self.assessment_ref
                or self.returned.get('measured', FrozenMap()).get('assessment_ref') != self.assessment_ref
                or self.operational_consciousness_context.timeline_ref != self.timeline_id):
            raise ValueError('understanding observation lost its exact question and publication')
        return self


class OperationalConsciousnessInquiryRecord(LineagedRecord):
    """Question state and actual parent delivery are independent obligations."""
    record_kind: Literal['operational_consciousness_inquiry'] = 'operational_consciousness_inquiry'
    schema_version: Literal['operational_consciousness_inquiry.v1', 'operational_consciousness_inquiry.v2'] = 'operational_consciousness_inquiry.v1'
    operational_consciousness_context: OperationalConsciousnessReasoningContext
    scope_kind: Literal['mechanical_goal', 'simulation_application'] = 'mechanical_goal'
    inquiry_scope: FrozenMap
    question_ref: Ref
    evaluation: FrozenMap
    previous_record_ref: Ref | None
    phase: Literal['evaluated', 'parent_consumed']
    producer_record_ref: Ref | None = None
    needs_evidence: bool
    grants_action: Literal[False] = False

    @model_validator(mode='after')
    def preserve_inquiry(self):
        scope_fields = (('parent_goal_ref','episode_ref','level_scope_ref','epoch','condition_signature')
            if self.scope_kind == 'mechanical_goal' else
            ('parent_goal_ref','scope_ref','contract_ref','epoch','input_revision_ref','input_digest'))
        if self.scope_kind == 'simulation_application' and self.schema_version != 'operational_consciousness_inquiry.v2':
            raise ValueError('operational consciousness: simulation inquiry requires its typed v2 scope')
        if (self.timeline_id != self.operational_consciousness_context.timeline_ref
                or self.question_ref != self.evaluation.get('question_ref')
                or self.inquiry_scope.get('parent_goal_ref') != self.evaluation.get('principal_goal_ref')
                or self.needs_evidence != self.evaluation.get('requires_application_evidence')
                or self.evaluation.get('grants_action') is not False
                or self.evaluation.get('utility_established') is not False
                or any(self.inquiry_scope.get(key) is None for key in scope_fields)):
            raise ValueError('operational consciousness: inquiry lost its scoped question or outstanding evidence')
        expected=self.id if self.phase == 'evaluated' else self.producer_record_ref
        if (self.evaluation.get('evaluation_record_ref') != expected
                or (self.phase == 'parent_consumed' and not self.producer_record_ref)):
            raise ValueError('operational consciousness: inquiry lost its canonical producer')
        return self


class OperationalConsciousnessDeliberationRecord(LineagedRecord):
    record_kind: Literal['operational_consciousness_deliberation'] = 'operational_consciousness_deliberation'
    operational_consciousness_context: OperationalConsciousnessReasoningContext
    outcome: OperationalConsciousnessDeliberationOutcome
    schema_version: Literal['operational_consciousness_deliberation.v1'] = 'operational_consciousness_deliberation.v1'


class GoalFrontierReviewRecord(LineagedRecord):
    """Observed acquisition consumed as a review, never as goal achievement."""
    record_kind: Literal["goal_frontier_review"] = "goal_frontier_review"
    observation_ref: Ref
    action_intent_ref: Ref
    frontier_digest: Ref
    review_input_digest: Ref
    operational_consciousness_context: OperationalConsciousnessReasoningContext
    branches: tuple[GoalFrontierBranchReview, ...]
    observed_application: OperationalConsciousnessObservedApplication | None = None
    observed_application_missing_refs: tuple[Ref, ...] = ()
    grants_act: Literal[False] = False
    establishes_instrumental_relation: Literal[False] = False
    schema_version: Ref = "yf_arc3_v5.goal_frontier_review.v2"

    @model_validator(mode='after')
    def exact_dependency_review_owner(self):
        context = self.operational_consciousness_context
        if (context.owner_workflow_ref != self.workflow_instance_id
                or context.source_hash != self.source_hash or context.timeline_ref != self.timeline_id
                or context.source_workflow_ref != self.workflow_definition_id):
            raise ValueError('operational consciousness: dependency review lost its Source owner')
        if any(row.current_dependency_snapshot.problem_ref != row.goal_ref for row in self.branches):
            raise ValueError('operational consciousness: dependency review changed its problem')
        application = self.observed_application
        if any(association.observation_ref != self.observation_ref
                for branch in self.branches for association in branch.application_associations):
            raise ValueError('operational consciousness: association crossed observed returns')
        if (('observed_application' in self.model_fields_set or 'observed_application_missing_refs' in self.model_fields_set)
                and application is None and not self.observed_application_missing_refs):
            raise ValueError('operational consciousness: current observation requires a witness or explicit missing evidence')
        if application is not None and (self.observed_application_missing_refs
                or application.observation_ref != self.observation_ref or application.intent_ref != self.action_intent_ref
                or application.timeline_ref != self.timeline_id or application.after_frame_ref != self.frame_id
                or application.goal_frontier_digest != self.frontier_digest):
            raise ValueError('operational consciousness: goal review changed its observed application')
        return self

    @model_serializer(mode='wrap')
    def preserve_pre_application_shape(self, handler):
        result = handler(self)
        for field in ('observed_application', 'observed_application_missing_refs'):
            if field not in self.model_fields_set:
                result.pop(field, None)
        return result

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if name not in ('observed_application', 'observed_application_missing_refs') or name in self.model_fields_set)


class OperationalConsciousnessDependencyReassessmentRecord(LineagedRecord):
    """An actual Source admission pass, including problems outside its domain."""
    record_kind: Literal['operational_consciousness_dependency_reassessment'] = 'operational_consciousness_dependency_reassessment'
    operational_consciousness_context: OperationalConsciousnessReasoningContext
    review_ref: Ref
    review_input_digest: Ref
    projection_digest: Ref
    attempted_problem_refs: tuple[Ref, ...]
    projected_problem_refs: tuple[Ref, ...]
    unprojected_problem_refs: tuple[Ref, ...]
    admissible_alternative_count: int = Field(ge=0)
    grants_act: Literal[False] = False
    establishes_instrumental_relation: Literal[False] = False
    schema_version: Ref = 'operational_consciousness_dependency_reassessment.v1'

    @model_validator(mode='after')
    def exact_reassessment(self):
        context = self.operational_consciousness_context
        if (context.owner_workflow_ref != self.workflow_instance_id
                or context.source_hash != self.source_hash or context.timeline_ref != self.timeline_id
                or context.source_workflow_ref != self.workflow_definition_id):
            raise ValueError('operational consciousness: reassessment lost its actual consumer')
        projected, missing = set(self.projected_problem_refs), set(self.unprojected_problem_refs)
        if projected & missing or projected | missing != set(self.attempted_problem_refs):
            raise ValueError('operational consciousness: reassessment lost a requested problem')
        return self


class OperationalConsciousnessExperimentResourceReturn(FrozenModel):
    """Current conditional resource evidence, distinct from an execution allowance."""
    measured: FrozenMap
    projection: FrozenMap
    policy_ref: Ref
    policy_hash: Ref
    open_obligation_refs: tuple[Ref, ...] = (
        'experiment.complete_execution_cost', 'experiment.recovery_cost',
        'experiment.current_preservation_evidence')
    recovery_cost_known: Literal[False] = False
    preservation_proven: Literal[False] = False
    executable_experiment_bound: Literal[False] = False
    grants_action: Literal[False] = False


class OperationalConsciousnessExperimentCommitmentReturn(FrozenModel):
    """Source's revision of viability, consumed before wisdom and ACT release."""
    measured: FrozenMap
    projection: FrozenMap
    source_viability: ViabilityAssessment
    revised_viability_digest: Ref
    policy_ref: Ref
    policy_hash: Ref
    grants_action: Literal[False] = False


class OperationalConsciousnessExperimentControlReturn(FrozenModel):
    """Inline receipt consumed by the exact intent, not a new action permit."""
    return_ref: Ref
    intent_ref: Ref
    timeline_ref: Ref
    frame_ref: Ref
    goal_ref: Ref
    native_review_ref: Ref
    nomination_ref: Ref | None
    domain_ref: Ref | None
    candidate_refs: tuple[Ref, ...]
    action_ref: Ref
    action_data: FrozenMap
    control_signature: ControlEvidenceSignature | None
    control_claim_ref: Ref | None
    control_claim_digest: Ref | None
    input_digest: Ref
    source_policy_ref: Ref
    source_policy_hash: Ref
    disposition_ref: Ref
    missing_refs: tuple[Ref, ...]
    current_control_bound: bool
    grants_action: Literal[False] = False
    executable_experiment_bound: Literal[False] = False
    resource_return: OperationalConsciousnessExperimentResourceReturn | None = None
    commitment_return: OperationalConsciousnessExperimentCommitmentReturn | None = None
    acquisition_contract: OperationalConsciousnessNativeAcquisition | None = None
    frontier_assessment: OperationalConsciousnessExperimentAssessmentLink | None = None

    @model_validator(mode='after')
    def preserve_resource_observation_scope(self):
        if self.frontier_assessment is not None and (self.acquisition_contract is None
                or self.frontier_assessment.nomination_ref != self.nomination_ref
                or self.frontier_assessment.acquisition_contract_ref != self.acquisition_contract.contract_ref):
            raise ValueError('native experiment assessment lost its exact acquisition question')
        if self.acquisition_contract is not None:
            contract = self.acquisition_contract
            action = contract.execution.actions[0]
            if (contract.goal_ref != self.goal_ref or contract.nomination_ref != self.nomination_ref
                    or contract.domain_ref != self.domain_ref or contract.timeline_ref != self.timeline_ref
                    or contract.before_frame_ref != self.frame_ref or action.action_ref != self.action_ref
                    or action.action_data != self.action_data):
                raise ValueError('native acquisition changed its question, command or scope')
        if self.resource_return is not None:
            measured = self.resource_return.measured
            if any(measured.get(name) != getattr(self, name) for name in ('intent_ref', 'timeline_ref', 'frame_ref')):
                raise ValueError('experiment resource receipt crossed its prepared intent or observation')
        if self.commitment_return is not None:
            measured = self.commitment_return.measured['descriptive_by_ref']['experiment.commitment']
            if any(measured.get(name) != getattr(self, name) for name in ('intent_ref', 'timeline_ref', 'frame_ref')):
                raise ValueError('experiment commitment receipt crossed its prepared intent or observation')
        return self

    @model_serializer(mode='wrap')
    def preserve_prior_control_receipt(self, handler):
        result = handler(self)
        for name in ('resource_return', 'commitment_return', 'acquisition_contract', 'frontier_assessment'):
            if name not in self.model_fields_set:
                result.pop(name, None)
        return result

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if name not in ('resource_return', 'commitment_return', 'acquisition_contract', 'frontier_assessment') or name in self.model_fields_set)


class ActionIntent(LineagedRecord):
    record_kind: Literal["action_intent"] = "action_intent"
    operational_consciousness: OperationalConsciousnessActionBinding
    operational_goal_consumptions: tuple[OperationalConsciousnessGoalConsumptionUse, ...] = ()
    action_ref: Ref
    available_action_ref: Ref
    # Optional immutable payload for a precommitted action series.  It keeps
    # action-specific coordinates/data with the intent so CONTINUE does not
    # rebuild a WorldContext between triggers.
    action_data: FrozenMap = Field(default_factory=FrozenMap)
    # A series identity and ordinal are transport lineage, not a new semantic
    # choice.  They let the action boundary verify a predeclared burst while
    # keeping every primitive intent independently auditable.
    declared_series_ref: Ref | None = None
    declared_series_index: NonNegativeRevision | None = None
    world_context_ref: Ref
    commitment_decision_id: Ref
    expectation_refs: tuple[Ref, ...] = ()
    # Declarative grounding payload.  Legacy callers may leave it empty while
    # the migration progressively closes the anti-errance firewall.
    active_goal_ref: Ref | None = None
    active_terminal_goal_ref: Ref | None = None
    declared_terminal_goal_ref: Ref | None = None
    subgoal_ref: Ref | None = None
    goal_graph_edge_refs: tuple[Ref, ...] = ()
    goal_dependency_chain_refs: tuple[Ref, ...] = ()
    declared_dependency_chain_refs: tuple[Ref, ...] = ()
    advances_active_goal_chain: bool | None = None
    inherited_priority_from_terminal_goal: bool = False
    priority_class_ref: Ref | None = None
    selection_principle_ref: Ref | None = None
    premise_claim_refs: tuple[Ref, ...] = ()
    # Source may require a subset to resolve to live canonical proofs rather
    # than static symbolic declarations. The obligation travels with intent.
    canonical_premise_claim_refs: tuple[Ref, ...] = Field(default=(), max_length=64)
    memory_reuse_required: bool = False
    memory_reuse_contract: MemoryReuseContract | None = None
    control_evidence_binding_required: bool = False
    control_evidence_signature: ControlEvidenceSignature | None = None
    control_evidence_claim_ref: Ref | None = None
    control_evidence_claim_digest: Ref | None = None
    operational_experiment_control_returns: tuple[OperationalConsciousnessExperimentControlReturn, ...] = ()
    inherited_experiment_control_returns: tuple[OperationalConsciousnessExperimentControlReturn, ...] = ()
    operational_information_opportunities: tuple[OperationalConsciousnessInformationOpportunity, ...] = ()
    expected_effect_class: Ref | None = None
    expected_configuration_or_goal_delta_ref: Ref | None = None
    falsifier_refs: tuple[Ref, ...] = ()
    committed_plan_ref: Ref | None = None
    discriminating_experiment_ref: Ref | None = None
    # Exact producer-owned fields selected by DRM. The immutable action intent
    # carries these through permits, dispatch and observation by its identity.
    contribution_contracts: tuple[FrozenMap, ...] = Field(default=(), max_length=64)
    series_contribution_binding: DeclaredSeriesContributionBinding | None = None
    parent_question_binding: ParentQuestionBinding | None = None
    goal_acquisition_frontier: GoalAcquisitionFrontier | None = None
    contact_experiment_witnesses: tuple[ContactExperimentWitness, ...] = Field(default=(), max_length=16)
    operator_trial_context: FrozenMap = Field(default_factory=FrozenMap)
    contribution_target_context: FrozenMap = Field(default_factory=FrozenMap)
    lifecycle_engagement_ref: Ref | None = None
    declared_plan_ref: Ref | None = None
    declared_plan_stage_refs: tuple[Ref, ...] = ()
    declared_plan_ordered_member_refs: tuple[Ref, ...] = ()
    declared_plan_ordered_member_values: tuple[int, ...] = ()
    declared_plan_current_stage_ref: Ref | None = None
    declared_plan_cursor_ordinal: NonNegativeRevision | None = None
    declared_plan_member_count: NonNegativeRevision | None = None
    remaining_action_bound: NonNegativeRevision | None = None
    reconciliation_checkpoint_ref: Ref | None = None
    schema_version: Ref = "yf_arc3_v5.action_intent.v2"

    @model_validator(mode="after")
    def validate_contribution_transport(self) -> "ActionIntent":
        access_return = self.operator_trial_context.get('composition_access_return')
        if access_return:
            receipt = ObservedCompositionAccessReturn.model_validate(dict(access_return))
            if (self.action_ref != receipt.operator_action_ref
                    or self.operator_trial_context.get('context_ref') != receipt.current_context_ref
                    or self.operator_trial_context.get('recipe_token') != receipt.recipe_token):
                raise ValueError('Composition access return must be consumed by its current operator trial')
        if self.contribution_target_context.get('target_kind') == 'operator_surface_access_only':
            access = OperatorSurfaceAccessTarget.model_validate(dict(self.contribution_target_context))
            if self.action_ref == access.operator_action_ref or self.operator_trial_context:
                raise ValueError('An access target requires a fresh experiment binding on arrival')
        validate_action_responsibility(self)
        require_unique(tuple(row.consumption_ref for row in self.operational_goal_consumptions), 'goal consumptions')
        for row in self.operational_goal_consumptions:
            if (row.action_goal_ref != self.active_goal_ref
                    or row.execution_scope != self.operational_consciousness.responsibility.execution_scope):
                raise ValueError('goal consumption changed its declared action owner or scope')
        returns = self.operational_experiment_control_returns
        require_unique(tuple(row.return_ref for row in returns), 'experiment control returns')
        for row in returns:
            if (row.intent_ref != self.id or row.timeline_ref != self.timeline_id or row.frame_ref != self.frame_id
                    or row.action_ref != self.action_ref or row.action_data != self.action_data
                    or row.control_signature != self.control_evidence_signature
                    or row.control_claim_ref != self.control_evidence_claim_ref
                    or row.control_claim_digest != self.control_evidence_claim_digest):
                raise ValueError('experiment control return changed its consuming action or current control')
        if any(witness.frame_ref != self.frame_id for witness in self.contact_experiment_witnesses):
            raise ValueError("contact experiment witness changed its observation frame")
        frontier = self.goal_acquisition_frontier
        for row in returns:
            if frontier is None or not any(branch.goal_ref == row.goal_ref
                    and row.native_review_ref in branch.native_means_review_refs for branch in frontier.branches):
                raise ValueError('experiment control return lost its parent native question')
        for row in self.inherited_experiment_control_returns:
            if (self.declared_series_ref is None or self.declared_series_index is None
                    or row.intent_ref not in self.provenance or row.timeline_ref != self.timeline_id):
                raise ValueError('historical experiment control return lost its declared series origin')
        if frontier is not None and (
            frontier.timeline_ref != self.timeline_id or frontier.state_revision > self.state_revision
        ):
            raise ValueError("goal acquisition frontier changed execution scope")
        # frontier.frame_ref identifies its observation, not the future frame of
        # each authorized series member. It conveys no current action authority.
        binding = self.parent_question_binding
        if binding is not None:
            if binding.timeline_id != self.timeline_id or binding.frame_id != self.frame_id:
                raise ValueError("parent question transport changed execution scope")
            goal_refs = {
                self.active_goal_ref, self.active_terminal_goal_ref,
                self.declared_terminal_goal_ref, self.subgoal_ref,
                *self.goal_dependency_chain_refs, *self.declared_dependency_chain_refs,
            }
            if binding.parent_goal_ref not in goal_refs:
                raise ValueError("parent question transport lost its parent in action WHY")
            if binding.question_goal_ref not in goal_refs:
                raise ValueError("parent question transport lost its selected question in action WHY")
        series_binding = self.series_contribution_binding
        if series_binding is not None:
            ordinal = self.declared_series_index
            if (not self.contribution_contracts
                    or series_binding.series_ref != self.declared_series_ref
                    or ordinal is None or ordinal >= len(series_binding.action_refs)
                    or series_binding.action_refs[ordinal] != self.action_ref
                    or series_binding.source_action_ref != series_binding.action_refs[0]
                    or series_binding.source_intent_ref not in self.provenance
                    or series_binding.source_contribution_digest != stable_digest(self.contribution_contracts)):
                raise ValueError('action contribution lost its declared series binding')
        for receipt in self.contribution_contracts:
            if receipt.get("valid") is not True:
                raise ValueError("action intent carries an invalid contribution contract")
            fields = receipt.get("preserved_values")
            if not isinstance(fields, Mapping) or not fields:
                raise ValueError("action contribution has no frozen producer fields")
            changed = tuple(name for name, value in sorted(fields.items())
                            if not hasattr(self, name) or (
                                series_binding.source_action_ref
                                if name == 'action_ref' and series_binding is not None
                                else getattr(self, name)
                            ) != value)
            if changed:
                raise ValueError("action contribution transport changed fields: " + ",".join(changed))
        return self

    @model_serializer(mode='wrap')
    def preserve_prior_experiment_shape(self, handler):
        data = handler(self)
        for name in ('operational_experiment_control_returns', 'inherited_experiment_control_returns', 'operational_information_opportunities', 'operational_goal_consumptions'):
            if name not in self.model_fields_set:
                data.pop(name, None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields if
            name not in ('operational_experiment_control_returns', 'inherited_experiment_control_returns', 'operational_information_opportunities', 'operational_goal_consumptions') or name in self.model_fields_set)


class ConcentrationLeaseState(str, Enum):
    """SRC-owned lifecycle states for the unique action-releasing focus."""

    ACQUIRED = "acquired"
    VALIDATED = "validated"
    RELEASED = "released"
    OBSERVED = "observed"
    RECONCILED = "reconciled"
    SUSPENDED = "suspended"
    INTERRUPTED = "interrupted"
    INVALIDATED = "invalidated"
    EXPIRED = "expired"


class ConcentrationOperation(str, Enum):
    """SRC-owned focus operation; vocabulary is separate from lease state."""

    ATTRIBUTE = "attribute"
    MAINTAIN = "maintain"
    ENGAGE = "engage"
    ACTUALIZE = "actualize"
    DELEGATE = "delegate"
    RETURN = "return"
    ESCALATE = "escalate"
    RETROCEDE = "retrocede"
    HANDOFF = "handoff"
    SUSPEND = "suspend"
    WAIT = "wait"
    YIELD = "yield"
    PREEMPT = "preempt"
    RESUME = "resume"
    REORIENT = "reorient"
    RETRY = "retry"
    CLOSE = "close"
    REOPEN = "reopen"
    REVOKE = "revoke"
    RESET = "reset"


class ConcentrationTransformation(str, Enum):
    """Change to the problem or knowledge, never an implicit ownership change."""

    DECOMPOSE = "decompose"
    MUTUALIZE = "mutualize"
    SPLIT = "split"
    REFRAME = "reframe"
    REATTACH = "reattach"
    REVISE_INVALIDATE = "revise_invalidate"
    CAPITALIZE = "capitalize"


class ConcentrationOutcome(str, Enum):
    """Result of the committed path, distinct from mechanism enrichment."""

    SATISFIED = "satisfied"
    REFUTED = "refuted"
    PARTIAL = "partial"
    BLOCKED = "blocked"
    INCONCLUSIVE_BUDGET_EXHAUSTED = "inconclusive_budget_exhausted"
    CANCELLED_ABANDONED = "cancelled_abandoned"
    SUPERSEDED_IRRELEVANT = "superseded_irrelevant"
    TECHNICAL_ERROR = "technical_error"


class ConcentrationInvariant(str, Enum):
    UNIQUE_AUTHORITY = "unique_authority"
    ATOMIC_TRANSFER = "atomic_transfer"
    WHY_PRESERVED = "why_preserved"
    OBLIGATIONS_PRESERVED = "obligations_preserved"
    RESULTS_COUNTED_ONCE = "results_counted_once"
    RESUMPTION_REVALIDATED = "resumption_revalidated"
    BUDGET_INHERITED = "budget_inherited"
    RECONCILE_AT_COMMITTED_PATH_END = "reconcile_at_committed_path_end"
    WAIT_HAS_WAKE_CONDITION = "wait_has_wake_condition"
    HISTORY_PRESERVED = "history_preserved"


class ConcentrationReviewMotive(str, Enum):
    DEADLINE_EXCEEDED = "deadline_exceeded"
    REPETITION_WITHOUT_GAIN = "repetition_without_gain"
    CONTRADICTION_IGNORED = "contradiction_ignored"
    LOOP = "loop"
    SUBPROBLEM_UNNECESSARY = "subproblem_unnecessary"
    LOCAL_PROGRESS_NO_PARENT_CONTRIBUTION = "local_progress_no_parent_contribution"
    BUDGET_EXCEEDED = "budget_exceeded"
    OBLIGATION_NEGLECTED = "obligation_neglected"
    SERIOUS_ALTERNATIVE_IGNORED = "serious_alternative_ignored"


class ConcentrationMeasure(str, Enum):
    PERSISTENCE = "persistence"
    STAGNATION = "stagnation"
    DISPERSION = "dispersion"
    DEPRIVATION = "deprivation"
    OBSTINATION = "obstination"


class ConcentrationSignal(str, Enum):
    REQUEST_LEASE = "request_lease"
    PROPOSE_PRIORITY = "propose_priority"
    NOTIFY_RESULT = "notify_result"
    REFUSE_REQUEST = "refuse_request"


class ConcentrationAim(str, Enum):
    MEANS = "means"
    SUBGOAL = "subgoal"
    FINALITY = "finality"


class ConcentrationMeasures(FrozenModel):
    """Separate counters; unknown measures are never silently treated as zero."""

    persistence_actions: NonNegativeRevision | None = None
    stagnation_actions: NonNegativeRevision | None = None
    dispersion_events: NonNegativeRevision | None = None
    deprivation_actions: NonNegativeRevision | None = None
    obstination_actions: NonNegativeRevision = 0
    schema_version: Ref = "yf_arc3_v5.concentration_measures.v1"


class ConcentrationGovernanceRecord(LineagedRecord):
    """Orthogonal source-selected facets of one focus decision or notification.

    The record does not execute a vocabulary entry. Only SRC may give an
    operation control effect; DRM supplies any priority or relevance judgment.
    """

    record_kind: Literal["concentration_governance"] = "concentration_governance"
    concentration_lease_id: Ref
    why_contract_ref: Ref
    reason_ref: Ref
    operation: ConcentrationOperation | None = None
    transformations: tuple[ConcentrationTransformation, ...] = ()
    outcome: ConcentrationOutcome | None = None
    review_motives: tuple[ConcentrationReviewMotive, ...] = ()
    signal: ConcentrationSignal | None = None
    aim: ConcentrationAim | None = None
    invariant_refs: tuple[ConcentrationInvariant, ...] = ()
    carried_obligation_refs: tuple[Ref, ...] = ()
    committed_path_ref: Ref | None = None
    result_ref: Ref | None = None
    wake_condition_ref: Ref | None = None
    target_ref: Ref | None = None
    inherited_action_budget: NonNegativeRevision | None = None
    measures: ConcentrationMeasures | None = None
    schema_version: Ref = "yf_arc3_v5.concentration_governance.v1"

    @model_validator(mode="after")
    def validate_governance(self) -> "ConcentrationGovernanceRecord":
        if not any((self.operation, self.transformations, self.outcome,
                    self.review_motives, self.signal, self.measures)):
            raise ValueError("concentration governance needs a declared facet")
        require_unique(self.transformations, "concentration transformations")
        require_unique(self.review_motives, "concentration review motives")
        require_unique(self.invariant_refs, "concentration invariants")
        require_unique(self.carried_obligation_refs, "concentration obligations")
        if self.operation in {ConcentrationOperation.WAIT, ConcentrationOperation.SUSPEND}:
            if not self.wake_condition_ref:
                raise ValueError("waiting or suspended focus needs a wake condition")
        if self.operation is ConcentrationOperation.REORIENT and self.aim is None:
            raise ValueError("focus reorientation must name means, subgoal or finality")
        if self.operation in {ConcentrationOperation.HANDOFF, ConcentrationOperation.PREEMPT}:
            if not self.target_ref:
                raise ValueError("focus transfer must name its target")
        return self


class ConcentrationActionAccountingRecord(LineagedRecord):
    """One DRM-assessed action; Python checks only exact integer accounting."""

    record_kind: Literal["concentration_action_accounting"] = (
        "concentration_action_accounting"
    )
    concentration_lease_id: Ref
    pursuit_ref: Ref
    action_intent_id: Ref
    attempt_variant_ref: Ref | None = None
    relevance_decision_ref: Ref
    relevant_to_pursuit: bool
    review_due_unhandled: bool
    obstination_count: NonNegativeRevision
    schema_version: Ref = "yf_arc3_v5.concentration_action_accounting.v1"


class OperationalConsciousnessContributionRequestRecord(LineagedRecord):
    """Persist the exact request before producing or consuming its answer."""
    record_kind: Literal['operational_consciousness_contribution_request'] = 'operational_consciousness_contribution_request'
    request: FrozenMap
    schema_version: Literal['operational_consciousness_contribution_request.v1'] = 'operational_consciousness_contribution_request.v1'

    @model_validator(mode='after')
    def validate_request_origin(self):
        # Lazy import avoids coupling the canonical record module to scheduler startup.
        from agents.yf_arc3_v5.scheduler.contribution_contract import ContributionRequest
        # Validate the common header while retaining the full typed payload,
        # including appearance-acquisition fields, in the canonical record.
        request = ContributionRequest.model_validate({key: self.request[key]
            for key in ContributionRequest.model_fields if key in self.request})
        origin = request.operational_consciousness.requesting_operation
        if (request.request_ref != self.id or request.requested_at_revision != self.state_revision
                or origin.context.owner_workflow_ref != self.workflow_instance_id
                or origin.context.source_workflow_ref != self.workflow_definition_id
                or origin.context.source_hash != self.source_hash
                or origin.context.timeline_ref != self.timeline_id
                or origin.current_frame_ref != self.frame_id):
            raise ValueError('operational consciousness: canonical request differs from its producer')
        return self


class ContributionConsumptionRecord(LineagedRecord):
    """Durable consumer decision, distinct from a producer return and ACT permit."""

    record_kind: Literal["contribution_consumption"] = "contribution_consumption"
    operational_consciousness: OperationalConsciousnessOutcomeConsumption
    request_ref: Ref
    recipient_workflow_ref: Ref
    return_digest: Ref
    disposition_ref: Ref
    accepted: bool
    prior_consumption_ref: Ref | None = None
    activation_evidence_refs: tuple[Ref, ...] = ()
    examined_product_refs: tuple[Ref, ...] = ()
    applied_dependency_refs: tuple[Ref, ...] = ()
    enabled_continuation_refs: tuple[Ref, ...] = ()
    repair_requirement_refs: tuple[Ref, ...] = ()
    comparison_facts: FrozenMap = Field(default_factory=FrozenMap)
    schema_version: Ref = "yf_arc3_v5.contribution_consumption.v2"

    @model_validator(mode='after')
    def validate_conscious_consumer(self):
        binding = self.operational_consciousness
        context = binding.consumer_context
        if (context.owner_workflow_ref != self.workflow_instance_id
                or context.source_workflow_ref != self.workflow_definition_id
                or context.source_hash != self.source_hash or context.timeline_ref != self.timeline_id):
            raise ValueError('operational consciousness: consumption lost its actual consumer')
        if binding.basis == 'unqualified_source_return' and self.accepted:
            raise ValueError('operational consciousness: unqualified return cannot be accepted')
        return self


class OperationalConsciousnessConsumptionRecord(LineagedRecord):
    """A returned consequence applied to a Source-selected continuation.

    This consumes the continuation decision only; it does not attest that the
    next child executed, the parent goal succeeded, or an action is permitted.
    """
    record_kind: Literal['operational_consciousness_consumption'] = 'operational_consciousness_consumption'
    consequence_record_refs: tuple[Ref, ...] = Field(min_length=1)
    consequences: tuple[OperationalObservedReturn, ...] = Field(min_length=1)
    receiver_bindings: tuple[OperationalConsciousnessReceiverBinding, ...] = Field(min_length=1)
    consumer_workflow_ref: Ref
    disposition_ref: Ref
    selection_digest: Ref
    continuation_facts: FrozenMap
    question_response_claim_refs: tuple[Ref, ...] | None = None
    question_responses: tuple[OperationalConsciousnessNativeQuestionResponse | OperationalConsciousnessQuestionResponse, ...] | None = None
    consequence_boundary_refs: tuple[Ref, ...] | None = None
    question_response_measurement_lookup: Literal['exact_observed_interval'] | None = None
    question_response_scope: Literal['all_declared_questions', 'all_declared_question_owners'] | None = None
    consumption_scope: Literal['declared_continuation_decision'] = 'declared_continuation_decision'
    grants_action: Literal[False] = False
    schema_version: Literal['operational_consciousness_consumption.v1'] = 'operational_consciousness_consumption.v1'

    @model_validator(mode='after')
    def exact_consequence_partition(self):
        if self.consequence_boundary_refs is not None:
            require_unique(self.consequence_boundary_refs, 'operational consequence boundaries')
        if (self.question_responses is None) != (self.question_response_claim_refs is None):
            raise ValueError('question consumption requires both its source interpretation domain and responses')
        if self.question_response_scope is not None and self.question_responses is None:
            raise ValueError('declared-question scope requires its explicit response partition')
        require_unique(self.consequence_record_refs, 'operational consequence records')
        if len(self.consequence_record_refs) != len(self.consequences):
            raise ValueError('operational consciousness: incomplete consequence partition')
        if len(self.receiver_bindings) != len(self.consequences):
            raise ValueError('operational consciousness: incomplete receiver partition')
        for consequence, binding in zip(self.consequences, self.receiver_bindings):
            if (binding.recipient_workflow_ref != consequence.recipient_workflow_ref
                    or binding.consumer_workflow_ref != self.consumer_workflow_ref):
                raise ValueError('operational consciousness: receiver changed the problem owner')
        require_unique(tuple(row.observation_ref for row in self.consequences), 'operational consequence observations')
        if self.consumer_workflow_ref != self.workflow_instance_id:
            raise ValueError('operational consciousness: foreign consumer')
        if not self.continuation_facts.get('dispatch_ref'):
            raise ValueError('operational consciousness: no declared continuation dispatch')
        return self

    @model_serializer(mode='wrap')
    def preserve_prior_question_response_shape(self, handler):
        data = handler(self)
        for name in ('question_response_claim_refs', 'question_responses', 'consequence_boundary_refs',
                'question_response_measurement_lookup', 'question_response_scope'):
            if getattr(self, name) is None:
                data.pop(name, None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if name not in ('question_response_claim_refs', 'question_responses', 'consequence_boundary_refs',
                'question_response_measurement_lookup', 'question_response_scope') or getattr(self, name) is not None)


class ActionPreparationRefusal(LineagedRecord):
    """A Source-owned refused boundary, retained without authorizing any ACT."""

    record_kind: Literal["action_preparation_refusal"] = "action_preparation_refusal"
    selected_ref: Ref
    phase_ref: Ref
    requirement_refs: tuple[Ref, ...] = Field(min_length=1)
    measured_facts: FrozenMap
    schema_version: Literal["yf_arc3_v5.action_preparation_refusal.v1"] = "yf_arc3_v5.action_preparation_refusal.v1"


class OperationalConsciousnessPreparationResult(FrozenModel):
    """Exact Source result before ACT, including the canonical refusal when false."""
    producer_workflow_ref: Ref
    intent_ref: Ref
    intent_digest: Ref
    selected_ref: Ref
    grounding_valid: bool
    continuation_revalidation_required: bool
    refusal_ref: Ref | None = None
    grants_action: Literal[False] = False

    @model_validator(mode='after')
    def refusal_is_explicit(self):
        if (self.grounding_valid != (self.refusal_ref is None)
                or (self.grounding_valid and self.continuation_revalidation_required)):
            raise ValueError('operational consciousness: preparation result lost its refusal')
        return self


class OperationalConsciousnessPreparationConsumptionRecord(LineagedRecord):
    """Before-action variant of consumption, using the common reasoning outcome."""
    record_kind: Literal['operational_consciousness_preparation_consumption'] = 'operational_consciousness_preparation_consumption'
    operational_consciousness: OperationalConsciousnessOutcomeConsumption
    preparation_result: OperationalConsciousnessPreparationResult
    producer_checkpoint_ref: Ref
    disposition_ref: Ref
    before_agenda_digest: Ref
    after_agenda_digest: Ref
    selected_preserved: bool
    prior_consumption_ref: Ref | None = None
    grants_action: Literal[False] = False
    schema_version: Literal['operational_consciousness_preparation_consumption.v1'] = 'operational_consciousness_preparation_consumption.v1'

    @model_validator(mode='after')
    def exact_refusal_consumer(self):
        binding = self.operational_consciousness
        context = binding.consumer_context
        if (self.preparation_result.grounding_valid or binding.basis != 'source_return'
                or binding.returned_outcome_ref != self.producer_checkpoint_ref
                or context.owner_workflow_ref != self.workflow_instance_id
                or context.source_workflow_ref != self.workflow_definition_id
                or context.source_hash != self.source_hash or context.timeline_ref != self.timeline_id):
            raise ValueError('operational consciousness: preparation consumption lost its exact returned refusal')
        return self


class ParentGoalWhyContract(FrozenModel):
    """Original declared parent WHY, independent of bounded ACT leases.

    This packet carries references and typed proposed purposes. It grants no action authority and
    does not classify the current truth of its premises or the goal's status.
    """

    parent_goal_ref: Ref
    source_activation_ref: Ref
    canonical_origin_refs: tuple[Ref, ...] = ()
    canonical_scope_proof_refs: tuple[Ref, ...] = ()
    guiding_principle_ref: Ref
    premise_claim_refs: tuple[Ref, ...] = Field(min_length=1)
    support_claim_refs: tuple[Ref, ...] = ()
    activation_reason_refs: tuple[Ref, ...] = ()
    falsifier_refs: tuple[Ref, ...] = ()
    access_condition_refs: tuple[Ref, ...] = ()
    expected_goal_delta_refs: tuple[Ref, ...] = ()
    expected_effect_signature_refs: tuple[Ref, ...] = ()
    parent_goal_refs: tuple[Ref, ...] = ()
    prerequisite_goal_refs: tuple[Ref, ...] = ()
    declared_parent_goal_pairs: tuple[tuple[Ref, Ref], ...] = ()
    declared_goal_falsifier_pairs: tuple[tuple[Ref, Ref], ...] = ()
    operational_goal_hypotheses: tuple[OperationalConsciousnessGoalHypothesis, ...] = ()

    @model_validator(mode='after')
    def preserve_hypothesis_owner(self):
        if any(row.goal_ref != self.parent_goal_ref for row in self.operational_goal_hypotheses):
            raise ValueError('parent WHY contains a hypothesis owned by another goal')
        return self

    @model_serializer(mode='wrap')
    def preserve_unannotated_why_shape(self, handler):
        data = handler(self)
        if not self.operational_goal_hypotheses:
            data.pop('operational_goal_hypotheses', None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if name != 'operational_goal_hypotheses' or self.operational_goal_hypotheses)


class ReasoningContextFrame(FrozenModel):
    """One declared context on the active path; never an action permission."""

    context_ref: Ref
    goal_ref: Ref
    parent_context_ref: Ref | None = None
    parent_goal_why_contract: ParentGoalWhyContract | None = None
    local_why_contract: FrozenMap = Field(default_factory=FrozenMap)
    preserve_constraint_refs: tuple[Ref, ...] = ()
    overshoot_constraint_refs: tuple[Ref, ...] = ()
    engagement_ref: Ref | None = None
    schema_version: Ref = "yf_arc3_v5.reasoning_context_frame.v1"


class ReasoningContextStack(LineagedRecord):
    """Durable active contexts, independent of the short ACT lease."""

    record_kind: Literal["reasoning_context_stack"] = "reasoning_context_stack"
    game_ref: Ref
    level_ref: Ref
    session_ref: Ref
    frames: tuple[ReasoningContextFrame, ...] = Field(min_length=1)
    owner_workflow_instance_ref: Ref
    retained_parent_goal_ref: Ref | None = None
    active_execution_context_ref: Ref | None = None
    active_execution_intent_refs: tuple[Ref, ...] = ()
    local_execution_intent_refs: tuple[Ref, ...] = ()
    transition_ref: Ref
    returned_context_ref: Ref | None = None
    native_return_checkpoint_ref: Ref | None = None
    native_return_alternative_refs: tuple[Ref, ...] = ()
    native_return_disposition_ref: Ref | None = None
    return_evidence_ref: Ref | None = None
    completed_child_goal_ref: Ref | None = None
    completed_child_effect_claim_refs: tuple[Ref, ...] = ()
    parent_resume_context_ref: Ref | None = None
    schema_version: Ref = "yf_arc3_v5.reasoning_context_stack.v2"

    @model_validator(mode="after")
    def validate_context_path(self) -> "ReasoningContextStack":
        refs = tuple(frame.context_ref for frame in self.frames)
        require_unique(refs, "reasoning context path")
        for index, frame in enumerate(self.frames):
            expected_parent = self.frames[index - 1].context_ref if index else None
            if frame.parent_context_ref != expected_parent:
                raise ValueError("reasoning context path has a broken parent link")
        if self.active_execution_context_ref is not None:
            if self.active_execution_context_ref != refs[-1] or not self.active_execution_intent_refs:
                raise ValueError("local execution must belong to the top context")
        elif self.active_execution_intent_refs:
            raise ValueError("local execution intents lack an active context")
        if self.completed_child_goal_ref is not None:
            if (not self.completed_child_effect_claim_refs or self.return_evidence_ref is None
                    or self.parent_resume_context_ref != refs[-1]
                    or self.completed_child_goal_ref == self.frames[-1].goal_ref):
                raise ValueError("completed child return lacks effect evidence or its resumed parent")
            require_unique(self.completed_child_effect_claim_refs, "completed child effect evidence")
        elif self.completed_child_effect_claim_refs or self.parent_resume_context_ref is not None:
            raise ValueError("child effect evidence lacks its completed child")
        return self


class ConcentrationLease(LineagedRecord):
    """One bounded operational focus; never a second reasoning graph.

    Every semantic field is copied from the already selected DRM/SRC action
    contract.  The record grants no authority by itself: only a VALIDATED lease
    attached to an ActionReleasePermit can cross the ACT boundary.
    """

    record_kind: Literal["concentration_lease"] = "concentration_lease"
    game_ref: Ref
    level_ref: Ref
    session_ref: Ref
    frame_revision: NonNegativeRevision
    contract_revision: NonNegativeRevision
    active_objective_ref: Ref | None = None
    # Terminal ownership survives dependent child leases and cursor closure.
    parent_goal_ref: Ref | None = None
    parent_goal_why_contract: ParentGoalWhyContract | None = None
    # Parent fields above remain historical transport projections. The durable
    # reasoning context owns the parent; this lease only binds local ACT.
    reasoning_context_ref: Ref | None = None
    reasoning_context_stack_ref: Ref | None = None
    # Exact DRM qualification copied by SRC, including a qualified null parent.
    parent_continuity_class_ref: Ref | None = None
    information_step_ref: Ref | None = None
    committed_path_ref: Ref | None = None
    remaining_action_bound: NonNegativeRevision | None = None
    drm_decision_ref: Ref
    src_decision_ref: Ref
    allowed_action_ref: Ref
    action_intent_id: Ref
    premise_claim_refs: tuple[Ref, ...] = Field(min_length=1)
    generic_principle_ref: Ref
    expected_effect_ref: Ref
    falsifier_refs: tuple[Ref, ...] = Field(min_length=1)
    preserve_constraint_refs: tuple[Ref, ...] = ()
    overshoot_constraint_refs: tuple[Ref, ...] = ()
    state: ConcentrationLeaseState
    acquisition_reason_ref: Ref
    release_or_invalidation_reason_ref: Ref | None = None
    expires_after_state_revision: NonNegativeRevision
    extension_intent_ids: tuple[Ref, ...] = ()
    requires_post_action_full_revalidation: bool = False
    schema_version: Ref = "yf_arc3_v5.concentration_lease.v1"

    @model_serializer(mode="wrap")
    def serialize_original_optional_context_shape(self, handler):
        """Preserve historical journal bytes when these fields were absent.

        Newly bound local leases provide both references. Null context defaults
        carry no binding and must not alter an older verified event hash.
        """
        data = handler(self)
        for field in ("reasoning_context_ref", "reasoning_context_stack_ref"):
            if getattr(self, field) is None:
                data.pop(field, None)
        return data

    def canonical_field_names(self):
        return tuple(field for field in self.__class__.model_fields
                     if field not in ("reasoning_context_ref", "reasoning_context_stack_ref")
                     or getattr(self, field) is not None)

    @model_validator(mode="after")
    def validate_focus_contract(self) -> "ConcentrationLease":
        if (self.parent_goal_why_contract is not None
                and self.parent_goal_why_contract.parent_goal_ref != self.parent_goal_ref):
            raise ValueError("parent WHY must describe the retained parent goal")
        if not self.active_objective_ref and not self.information_step_ref:
            raise ValueError(
                "concentration lease requires an active objective or information step"
            )
        if self.contract_revision != self.state_revision:
            raise ValueError("concentration lease contract revision must be current")
        if self.expires_after_state_revision < self.contract_revision:
            raise ValueError("concentration lease is expired at creation")
        require_unique(self.premise_claim_refs, "concentration lease premises")
        require_unique(self.falsifier_refs, "concentration lease falsifiers")
        require_unique(self.preserve_constraint_refs, "concentration lease preserves")
        require_unique(self.overshoot_constraint_refs, "concentration lease overshoots")
        require_unique(self.extension_intent_ids, "concentration lease extensions")
        if self.action_intent_id not in self.extension_intent_ids:
            raise ValueError("concentration lease extensions must include its first intent")
        if (
            self.requires_post_action_full_revalidation
            and len(self.extension_intent_ids) > 1
        ):
            raise ValueError(
                "full post-action revalidation forbids a multi-action lease extension"
            )
        if self.state not in {
            ConcentrationLeaseState.ACQUIRED,
            ConcentrationLeaseState.VALIDATED,
        }:
            raise ValueError("a new concentration lease must be acquired or validated")
        return self


class ConcentrationLeaseTransition(LineagedRecord):
    """Append-only lifecycle evidence for one concentration lease."""

    record_kind: Literal["concentration_lease_transition"] = (
        "concentration_lease_transition"
    )
    concentration_lease_id: Ref
    from_state: ConcentrationLeaseState
    to_state: ConcentrationLeaseState
    reason_ref: Ref
    action_intent_id: Ref
    schema_version: Ref = "yf_arc3_v5.concentration_lease_transition.v1"


def project_concentration_operation(
    *,
    lease: ConcentrationLease,
    lineage: LineagedRecord,
    operation: ConcentrationOperation,
    reason_ref: Ref,
) -> ConcentrationGovernanceRecord:
    """Copy one SRC-selected phase into the canonical focus vocabulary."""

    return ConcentrationGovernanceRecord(
        id=f"{lineage.id}:focus:{operation.value}",
        source_unit=lineage.source_unit,
        source_hash=lineage.source_hash,
        state_revision=lineage.state_revision,
        workflow_definition_id=lineage.workflow_definition_id,
        workflow_instance_id=lineage.workflow_instance_id,
        workflow_step_id=lineage.workflow_step_id,
        timeline_id=lineage.timeline_id,
        frame_id=lineage.frame_id,
        provenance=(lease.id, lineage.id) if lease.id != lineage.id else (lease.id,),
        concentration_lease_id=lease.id,
        why_contract_ref=lease.id,
        reason_ref=reason_ref,
        operation=operation,
        invariant_refs=(
            ConcentrationInvariant.UNIQUE_AUTHORITY,
            ConcentrationInvariant.WHY_PRESERVED,
            ConcentrationInvariant.OBLIGATIONS_PRESERVED,
        ),
        carried_obligation_refs=tuple(dict.fromkeys(
            (*lease.preserve_constraint_refs, *lease.overshoot_constraint_refs)
        )),
        committed_path_ref=lease.committed_path_ref,
        inherited_action_budget=lease.remaining_action_bound,
    )


class ActionReleasePermit(LineagedRecord):
    record_kind: Literal["action_release_permit"] = "action_release_permit"
    action_intent_id: Ref
    viability_assessment_id: Ref
    commitment_decision_id: Ref
    available_action_ref: Ref
    pre_action_snapshot_digest: Ref
    valid_through_state_revision: NonNegativeRevision
    # When present, this permit authorizes exactly the listed predeclared
    # intents in order.  Ordinary one-action permits leave these fields empty.
    declared_series_ref: Ref | None = None
    declared_series_intent_ids: tuple[Ref, ...] = ()
    declared_series_action_refs: tuple[Ref, ...] = ()
    declared_series_target_workflow_instance_id: Ref | None = None
    # SRC may prepare a shadow permit without owning focus. Its first ACT
    # acquires, validates and engages the lease in one journal transaction.
    concentration_acquisition_deferred: bool = False
    # Optional only so historical journals remain readable.  ACT is fail-closed
    # and rejects every permit that does not carry the validated current lease.
    concentration_lease: ConcentrationLease | None = None
    schema_version: Ref = "yf_arc3_v5.action_release_permit.v1"

    @model_validator(mode="after")
    def validate_revision_window(self) -> "ActionReleasePermit":
        if self.valid_through_state_revision < self.state_revision:
            raise ValueError("release permit is stale at creation")
        if self.concentration_lease is not None:
            lease = self.concentration_lease
            if lease.state not in {
                ConcentrationLeaseState.ACQUIRED,
                ConcentrationLeaseState.VALIDATED,
            }:
                raise ValueError("release permit requires an acquired concentration lease")
            if lease.action_intent_id != self.action_intent_id:
                raise ValueError("release permit and concentration lease intent mismatch")
            if lease.timeline_id != self.timeline_id:
                raise ValueError("release permit and concentration lease timeline mismatch")
            if lease.contract_revision != self.state_revision:
                raise ValueError("release permit and concentration lease revision mismatch")
        return self


class EnvironmentActionDispatchedRecord(LineagedRecord):
    """Durable proof that the sole environment boundary dispatched one intent."""

    record_kind: Literal["environment_action_dispatched"] = (
        "environment_action_dispatched"
    )
    dispatch_id: Ref
    environment_adapter_ref: Ref
    action_intent_id: Ref
    action_release_permit_id: Ref
    action_ref: Ref
    request_digest: Ref
    response_digest: Ref
    raw_input_ref: Ref
    schema_version: Ref = "yf_arc3_v5.environment_action_dispatched.v1"


class OperationalConsciousnessDispatchRefusalRecord(LineagedRecord):
    """Current authorization was rejected before a transport attempt existed."""

    record_kind: Literal['operational_consciousness_dispatch_refusal'] = 'operational_consciousness_dispatch_refusal'
    operational_consciousness_context: OperationalConsciousnessReasoningContext
    checkpoint_ref: Ref
    dispatch_id: Ref
    action_intent_id: Ref
    action_release_permit_id: Ref
    request_digest: Ref
    refusal_reason_ref: Ref
    refusal_reason: str = Field(min_length=1)
    transport_attempted: Literal[False] = False
    response_recorded: Literal[False] = False
    release_requalification_required: Literal[True] = True
    grants_action: Literal[False] = False
    schema_version: Literal['operational_consciousness_dispatch_refusal.v1'] = 'operational_consciousness_dispatch_refusal.v1'


class OperationalConsciousnessDispatchPrefix(FrozenModel):
    """Exact already-observed prefix of an interrupted declared series."""

    checkpoint_ref: Ref
    intent_refs: tuple[Ref, ...] = Field(min_length=1, max_length=256)
    observed_action_refs: tuple[Ref, ...] = Field(min_length=1, max_length=256)
    frame_refs: tuple[Ref, ...] = Field(min_length=2, max_length=257)

    @model_validator(mode='after')
    def exact_prefix_dimensions(self):
        if len(self.intent_refs) != len(self.observed_action_refs) or len(self.frame_refs) != len(self.intent_refs) + 1:
            raise ValueError('observed dispatch prefix lost its exact causal dimensions')
        require_unique(self.intent_refs, 'observed prefix intents')
        require_unique(self.observed_action_refs, 'observed prefix returns')
        return self


class OperationalConsciousnessDispatchRetirementRecord(LineagedRecord):
    """Consumption of a never-sent refusal, leaving the parent's goal open."""

    record_kind: Literal['operational_consciousness_dispatch_retirement'] = 'operational_consciousness_dispatch_retirement'
    operational_consciousness_context: OperationalConsciousnessReasoningContext
    refusal_ref: Ref
    selection_ref: Ref
    retired_checkpoint_ref: Ref
    concentration_lease_ref: Ref
    lease_transition_ref: Ref
    recipient_context_ref: Ref
    executed_prefix: OperationalConsciousnessDispatchPrefix | None = None
    transport_attempted: Literal[False] = False
    parent_requalification_required: Literal[True] = True
    grants_action: Literal[False] = False
    schema_version: Literal['operational_consciousness_dispatch_retirement.v1'] = 'operational_consciousness_dispatch_retirement.v1'

    @model_serializer(mode='wrap')
    def preserve_empty_prefix_history(self, handler):
        data = handler(self)
        if self.executed_prefix is None:
            data.pop('executed_prefix', None)
        return data


class OperationalConsciousnessResponseReconciliationRecord(LineagedRecord):
    """Current Source admits a physical response without resuming stale code."""

    record_kind: Literal['operational_consciousness_response_reconciliation'] = 'operational_consciousness_response_reconciliation'
    operational_consciousness_context: OperationalConsciousnessReasoningContext
    refusal_ref: Ref
    selection_ref: Ref
    retired_checkpoint_ref: Ref
    concentration_lease_ref: Ref
    lease_transition_ref: Ref
    observation_ref: Ref
    observed_action_ref: Ref
    executed_prefix: OperationalConsciousnessDispatchPrefix
    recipient_context_ref: Ref
    parent_requalification_required: Literal[True] = True
    grants_action: Literal[False] = False
    schema_version: Literal['operational_consciousness_response_reconciliation.v1'] = 'operational_consciousness_response_reconciliation.v1'


class OperationalConsciousnessResumeRefusalRecord(LineagedRecord):
    """A received environment response could not resume its responsible branch.

    This is neither an observed return nor a consumption receipt. The suspended
    responsibility and its dispatched action remain outstanding.
    """

    record_kind: Literal['operational_consciousness_resume_refusal'] = 'operational_consciousness_resume_refusal'
    operational_consciousness_context: OperationalConsciousnessReasoningContext
    checkpoint_ref: Ref
    dispatch_id: Ref
    action_intent_id: Ref
    action_release_permit_id: Ref
    environment_action_event_ref: Ref
    response_frame_ref: Ref
    raw_input_ref: Ref
    resume_request_digest: Ref
    refusal_type_ref: Ref
    refusal_reason: str = Field(min_length=1)
    response_recorded: Literal[True] = True
    reconciliation_required: Literal[True] = True
    redelivery_permitted: Literal[False] = False
    grants_action: Literal[False] = False
    schema_version: Literal['operational_consciousness_resume_refusal.v1'] = 'operational_consciousness_resume_refusal.v1'


class EnvironmentActionAttemptRecord(LineagedRecord):
    """Durable pre-transport fact that never claims the effect was sent."""

    record_kind: Literal["environment_action_attempt"] = (
        "environment_action_attempt"
    )
    dispatch_id: Ref
    environment_adapter_ref: Ref
    action_intent_id: Ref
    action_release_permit_id: Ref
    action_ref: Ref
    request_digest: Ref
    unconfirmed_outcome: Literal["unknown"] = "unknown"
    redelivery_policy: Literal["forbid_without_reconciliation"] = (
        "forbid_without_reconciliation"
    )
    schema_version: Ref = "yf_arc3_v5.environment_action_attempt.v1"


class AppliedPrincipleRecord(LineagedRecord):
    record_kind: Literal["applied_principle"] = "applied_principle"
    statement: Ref
    scope: FrozenMap = Field(default_factory=FrozenMap)
    conditions: tuple[Ref, ...] = ()
    source_claims: tuple[Ref, ...] = Field(min_length=1)
    supporting_evidence: tuple[Ref, ...] = ()
    contradicting_evidence: tuple[Ref, ...] = ()
    successful_predictions: tuple[Ref, ...] = ()
    failed_predictions: tuple[Ref, ...] = ()
    known_falsifiers: tuple[Ref, ...] = ()
    originating_workflows: tuple[Ref, ...] = ()
    status: AppliedPrincipleStatus = AppliedPrincipleStatus.PROPOSED
    human_review_required: bool = True
    schema_version: Ref = "yf_arc3_v5.applied_principle.v1"

    @model_validator(mode="after")
    def prevent_automatic_promotion(self) -> "AppliedPrincipleRecord":
        if not self.human_review_required:
            raise ValueError("applied principles require human review before promotion")
        return self


class ObservationAcquiredRecord(LineagedRecord):
    """Immutable provenance for one acquired world input."""

    record_kind: Literal["observation_acquired"] = "observation_acquired"
    acquisition_model_ref: Ref
    raw_input_ref: Ref
    observation_ref: Ref
    schema_version: Ref = "yf_arc3_v5.observation_acquired.v1"


class WorkflowLifecycleRecord(LineagedRecord):
    """A typed workflow step, suspension, or resume transition."""

    record_kind: Literal["workflow_lifecycle"] = "workflow_lifecycle"
    transition: WorkflowLifecycleKind
    from_step_id: Ref | None = None
    to_step_id: Ref | None = None
    from_status: WorkflowStatus
    to_status: WorkflowStatus
    cause_ref: Ref
    schema_version: Ref = "yf_arc3_v5.workflow_lifecycle.v1"

    @model_validator(mode="after")
    def validate_transition(self) -> "WorkflowLifecycleRecord":
        expected = {
            WorkflowLifecycleKind.STARTED: (
                WorkflowStatus.READY,
                WorkflowStatus.ACTIVE,
            ),
            WorkflowLifecycleKind.STEP_CHANGED: (
                WorkflowStatus.ACTIVE,
                WorkflowStatus.ACTIVE,
            ),
            WorkflowLifecycleKind.SUSPENDED: (
                WorkflowStatus.ACTIVE,
                WorkflowStatus.SUSPENDED,
            ),
            WorkflowLifecycleKind.RESUMED: (
                WorkflowStatus.SUSPENDED,
                WorkflowStatus.ACTIVE,
            ),
            WorkflowLifecycleKind.COMPLETED: (
                WorkflowStatus.ACTIVE,
                WorkflowStatus.COMPLETED,
            ),
            WorkflowLifecycleKind.DEFERRED: (
                WorkflowStatus.ACTIVE,
                WorkflowStatus.DEFERRED,
            ),
            WorkflowLifecycleKind.BLOCKED: (
                WorkflowStatus.ACTIVE,
                WorkflowStatus.BLOCKED,
            ),
            WorkflowLifecycleKind.FAILED: (
                WorkflowStatus.ACTIVE,
                WorkflowStatus.FAILED,
            ),
        }[self.transition]
        if (self.from_status, self.to_status) != expected:
            raise ValueError(
                f"invalid {self.transition.value} lifecycle transition: "
                f"{self.from_status.value}->{self.to_status.value}"
            )
        return self


class StateChangeCommittedRecord(LineagedRecord):
    """Audit identity for a reducer-accepted state-change proposal."""

    record_kind: Literal["state_change_committed"] = "state_change_committed"
    proposal_id: Ref
    commitment_decision_id: Ref | None = None
    transaction_id: Ref
    state_revision_before: NonNegativeRevision
    state_revision_after: NonNegativeRevision
    affected_refs: tuple[Ref, ...] = Field(min_length=1)
    schema_version: Ref = "yf_arc3_v5.state_change_committed.v1"

    @model_validator(mode="after")
    def validate_committed_revision(self) -> "StateChangeCommittedRecord":
        if self.state_revision_after != self.state_revision_before + 1:
            raise ValueError("a committed state change advances exactly one revision")
        if self.state_revision != self.state_revision_after:
            raise ValueError(
                "record state revision must equal committed after-revision"
            )
        require_unique(self.affected_refs, "affected_refs")
        return self


class ActionObservedRecord(LineagedRecord):
    """Causal link between a released action and its later observation."""

    record_kind: Literal["action_observed"] = "action_observed"
    operational_consciousness_return: OperationalObservedReturn
    action_intent_id: Ref
    action_release_permit_id: Ref
    environment_action_event_ref: Ref
    observation_record_id: Ref
    schema_version: Ref = "yf_arc3_v5.action_observed.v2"

    @model_validator(mode="after")
    def preserve_responsible_return(self):
        if (self.operational_consciousness_return.intent_ref != self.action_intent_id
                or self.operational_consciousness_return.observation_ref != self.observation_record_id):
            raise ValueError("observed action lost its operational return lineage")
        return self
