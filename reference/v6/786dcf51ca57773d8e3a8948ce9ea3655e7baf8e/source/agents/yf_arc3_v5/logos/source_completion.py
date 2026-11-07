"""Immutable Source return references, independent of world representation."""
from typing import Any, Literal

from pydantic import Field, model_validator, model_serializer

from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel, Ref, NonNegativeRevision
from agents.yf_arc3_v5.logos.operational_reasoning import OperationalConsciousnessReasoningEntryRefusal


class SourceTerminalBinding(FrozenModel):
    """One durable terminal value, independent of the checkpoint's local deltas."""

    kind: Literal["stop", "block", "defer", "fail", "call_refusal", "call_deferral", "technical_failure"]
    binding_ref: Ref
    value_ref: Ref
    value_digest: Ref = Field(pattern="^[0-9a-f]{64}$")


class SourceRuntimeTypeMismatch(FrozenModel):
    """Contract metadata only; never retain the rejected runtime payload."""

    location: str
    expected_type: str
    observed_type: str


class SourceTechnicalFailure(FrozenModel):
    """A technical interruption, distinct from a Source-declared FAIL or refusal."""

    schema_version: Literal['yf_arc3_v5.source_technical_failure.v1'] = 'yf_arc3_v5.source_technical_failure.v1'
    workflow_instance_ref: Ref
    statement_ref: Ref
    exception_type_ref: Ref
    child_failure_checkpoint_ref: Ref | None = None
    child_reasoning_outcome_ref: Ref | None = None
    pending_action_intent_ref: Ref | None = None
    action_effect_requires_reconciliation: bool
    automatic_retry_authorized: Literal[False] = False

    @model_validator(mode='after')
    def preserve_uncertain_action(self):
        if self.child_failure_checkpoint_ref is not None and self.child_reasoning_outcome_ref is not None:
            raise ValueError('technical failure cannot name two alternative child origins')
        if self.action_effect_requires_reconciliation != (self.pending_action_intent_ref is not None):
            raise ValueError('technical failure lost its unresolved action obligation')
        return self


class OperationalConsciousnessSourceQualificationIssue(FrozenModel):
    """Exact source mismatch, independent of the meaning of a returned fact."""
    source_workflow_ref: Ref
    expected_source_hash: Ref
    current_source_hash: Ref | None
    reasoning_outcome_refs: tuple[Ref, ...] = ()
    reason_ref: Literal['source_missing', 'source_changed']

    @model_validator(mode='after')
    def actual_source_difference(self):
        if (self.current_source_hash == self.expected_source_hash
                or (self.current_source_hash is None) != (self.reason_ref == 'source_missing')):
            raise ValueError('source qualification issue requires an actual source difference')
        return self


class OperationalConsciousnessConsumptionSourceRefusal(FrozenModel):
    """A consumed result needs requalification; historical evidence stays intact."""
    consumption_ref: Ref
    issues: tuple[OperationalConsciousnessSourceQualificationIssue, ...] = Field(min_length=1)
    grants_action: Literal[False] = False
    schema_version: Literal['operational_consciousness_consumption_source_refusal.v1'] = 'operational_consciousness_consumption_source_refusal.v1'


class SourceCallRefusal(FrozenModel):
    """A rejected call's exact boundary; this is not a repair or ACT decision."""

    schema_version: Literal["yf_arc3_v5.source_call_refusal.v2"] = "yf_arc3_v5.source_call_refusal.v2"
    workflow_instance_ref: Ref
    statement_ref: Ref
    callee_ref: Ref
    failure_kind: Literal["blocked_call", "invalid_typed_payload", "invalid_runtime_type"]
    detail: str = Field(max_length=2048)
    validation_errors: tuple[FrozenMap, ...] = Field(default=(), max_length=32)
    validation_error_count: int = Field(default=0, ge=0)
    validation_errors_complete: bool = True
    child_failure_checkpoint_ref: Ref | None = None
    child_reasoning_outcome_ref: Ref | None = None
    runtime_type_mismatch: SourceRuntimeTypeMismatch | None = None
    reasoning_entry_refusal: OperationalConsciousnessReasoningEntryRefusal | None = None
    consumption_source_refusal: OperationalConsciousnessConsumptionSourceRefusal | None = None

    @model_serializer(mode='wrap')
    def preserve_reference_only_history(self, handler):
        data = handler(self)
        if self.reasoning_entry_refusal is None:
            data.pop('reasoning_entry_refusal', None)
        if self.consumption_source_refusal is None:
            data.pop('consumption_source_refusal', None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if name not in ('reasoning_entry_refusal', 'consumption_source_refusal') or getattr(self, name) is not None)

    def cause_reason_refs(self):
        if self.reasoning_entry_refusal is not None:
            return self.reasoning_entry_refusal.failed_guard_refs
        if self.consumption_source_refusal is not None:
            return tuple(sorted({issue.reason_ref for issue in self.consumption_source_refusal.issues}))
        return (self.failure_kind,)

    @model_validator(mode="after")
    def validate_child_failure(self):
        if self.consumption_source_refusal is not None and (
                self.failure_kind != 'blocked_call' or self.child_failure_checkpoint_ref is not None
                or self.child_reasoning_outcome_ref is not None or self.reasoning_entry_refusal is not None):
            raise ValueError('consumption source refusal belongs to its direct call, not a child or entry')
        if self.reasoning_entry_refusal is not None:
            origin = self.reasoning_entry_refusal.initiating_operation
            if (self.failure_kind != 'blocked_call' or self.child_failure_checkpoint_ref is not None
                    or self.child_reasoning_outcome_ref is not None):
                raise ValueError('a refused entry is not an executed child failure')
            if (origin.context.owner_workflow_ref != self.workflow_instance_ref
                    or origin.statement_ref != self.statement_ref or origin.operation_ref != self.callee_ref):
                raise ValueError('reasoning entry refusal belongs to another initiating call')
        if (self.child_failure_checkpoint_ref is not None or self.child_reasoning_outcome_ref is not None) and self.failure_kind != "blocked_call":
            raise ValueError("only a blocked child call can name its failure checkpoint")
        if self.child_failure_checkpoint_ref is not None and self.child_reasoning_outcome_ref is not None:
            raise ValueError('a refusal has one immediate child boundary, not two competing causes')
        if (self.failure_kind == "invalid_runtime_type") != (self.runtime_type_mismatch is not None):
            raise ValueError("a runtime type refusal requires its exact contract mismatch")
        return self


class SourceCallDeferral(FrozenModel):
    """An unresolved CALL and its actual child, without a guessed retry rule."""

    schema_version: Literal["yf_arc3_v5.source_call_deferral.v1"] = "yf_arc3_v5.source_call_deferral.v1"
    workflow_instance_ref: Ref
    statement_ref: Ref
    callee_ref: Ref
    detail: str = Field(max_length=2048)
    child_deferred_checkpoint_ref: Ref | None = None
    child_reasoning_outcome_ref: Ref | None = None

    @model_serializer(mode='wrap')
    def preserve_historical_shape(self, handler):
        data = handler(self)
        if 'child_reasoning_outcome_ref' not in self.model_fields_set:
            data.pop('child_reasoning_outcome_ref', None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if name != 'child_reasoning_outcome_ref' or name in self.model_fields_set)

    @model_validator(mode='after')
    def single_child_cause(self):
        if self.child_deferred_checkpoint_ref is not None and self.child_reasoning_outcome_ref is not None:
            raise ValueError('a deferred call cannot name two competing child outcomes')
        return self


class SourceDeferralEvidence(FrozenModel):
    """Canonical wait lineage; inspecting it does not authorize resumption."""

    schema_version: Literal["yf_arc3_v5.source_deferral_evidence.v1"] = "yf_arc3_v5.source_deferral_evidence.v1"
    root_checkpoint_ref: Ref
    checkpoint_refs: tuple[Ref, ...]
    reasoning_outcome_refs: tuple[Ref, ...] = ()
    cause_kind: Literal["source_terminal", "call_deferral", "unresolved"]
    cause_ref: Ref | None = None
    statement_ref: Ref | None = None
    declared_terminal_value: Any = None
    missing_refs: tuple[Ref, ...] = ()

    @model_serializer(mode='wrap')
    def preserve_historical_shape(self, handler):
        data = handler(self)
        if 'reasoning_outcome_refs' not in self.model_fields_set:
            data.pop('reasoning_outcome_refs', None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if name != 'reasoning_outcome_refs' or name in self.model_fields_set)

    @model_validator(mode="after")
    def validate_cause(self):
        if self.cause_kind == "unresolved":
            if not self.missing_refs:
                raise ValueError("an unresolved wait requires explicit missing evidence")
        elif self.cause_ref is None or self.missing_refs:
            raise ValueError("a resolved wait requires its canonical cause")
        if self.cause_kind != "source_terminal" and self.declared_terminal_value is not None:
            raise ValueError("only an explicit DEFER owns a declared terminal value")
        return self


class SourceFailureEvidence(FrozenModel):
    """Canonical failure links, without interpreting them as a repair plan."""

    schema_version: Literal["yf_arc3_v5.source_failure_evidence.v1"] = "yf_arc3_v5.source_failure_evidence.v1"
    root_checkpoint_ref: Ref
    checkpoint_refs: tuple[Ref, ...]
    reasoning_outcome_refs: tuple[Ref, ...] = ()
    causal_evidence_refs: tuple[Ref, ...] = ()
    cause_kind: Literal["operator_result", "call_refusal", "source_terminal", "technical_failure", "dispatch_refusal", "causal_resume_refusal", "unresolved"]
    cause_ref: Ref | None = None
    cause_status: Literal["blocked", "failed"] | None = None
    cause_operator_ref: Ref | None = None
    statement_ref: Ref | None = None
    reason_refs: tuple[Ref, ...] = ()
    missing_refs: tuple[Ref, ...] = ()
    declared_terminal_kind: Literal["block", "fail"] | None = None
    declared_terminal_value: Any = None
    technical_failure: SourceTechnicalFailure | None = None
    call_refusal: SourceCallRefusal | None = None
    selection_refusal: FrozenMap | None = None

    @model_serializer(mode='wrap')
    def preserve_reference_only_failure_history(self, handler):
        data = handler(self)
        for name in ('call_refusal', 'selection_refusal'):
            if getattr(self, name) is None:
                data.pop(name, None)
        if not self.causal_evidence_refs:
            data.pop('causal_evidence_refs', None)
        return data

    def canonical_field_names(self):
        return tuple(name for name in self.__class__.model_fields
            if (name not in ('call_refusal', 'selection_refusal') or getattr(self, name) is not None)
            and (name != 'causal_evidence_refs' or self.causal_evidence_refs))

    @model_validator(mode="after")
    def validate_cause(self):
        if self.causal_evidence_refs and (
                self.cause_kind not in ('dispatch_refusal', 'causal_resume_refusal')
                or len(set(self.causal_evidence_refs)) != len(self.causal_evidence_refs)
                or set(self.causal_evidence_refs).intersection((*self.checkpoint_refs, *self.reasoning_outcome_refs))):
            raise ValueError('causal evidence must remain distinct from returned reasoning outcomes')
        if self.call_refusal is not None:
            refusal = self.call_refusal
            if (self.cause_kind != 'call_refusal' or self.cause_status != 'blocked'
                    or self.statement_ref != refusal.statement_ref
                    or refusal.child_failure_checkpoint_ref is not None
                    or refusal.child_reasoning_outcome_ref is not None
                    or self.selection_refusal is not None):
                raise ValueError('failure inspection must carry the actual leaf call refusal')
        if self.selection_refusal is not None:
            from agents.yf_arc3_v5.operators.contracts import SelectionResult
            selection = SelectionResult.model_validate(self.selection_refusal)
            if (self.cause_kind not in ('call_refusal', 'operator_result')
                    or self.cause_status != 'blocked' or self.cause_operator_ref != 'SELECT'
                    or selection.selected_ref is not None):
                raise ValueError('failure inspection must carry an actual unresolved selection')
        if (self.cause_kind == 'technical_failure') != (self.technical_failure is not None):
            raise ValueError('technical failure evidence requires its exact typed cause')
        if self.technical_failure is not None and (self.cause_status != 'failed'
                or self.statement_ref != self.technical_failure.statement_ref):
            raise ValueError('technical failure evidence lost its failed execution boundary')
        if self.cause_kind == "unresolved":
            if not self.missing_refs:
                raise ValueError("an unresolved Source cause requires explicit missing evidence")
        elif self.missing_refs or self.cause_ref is None or self.cause_status is None:
            raise ValueError("a resolved Source cause requires its canonical reference")
        if self.cause_kind == "source_terminal":
            expected = {"block": "blocked", "fail": "failed"}.get(self.declared_terminal_kind)
            if expected is None or self.cause_status != expected:
                raise ValueError("declared Source failure differs from its terminal kind")
        elif self.declared_terminal_kind is not None or self.declared_terminal_value is not None:
            raise ValueError("only an explicit Source terminal owns a declared terminal value")
        if self.cause_operator_ref is not None and self.cause_kind != "operator_result":
            raise ValueError("only an operator result owns a failure operator reference")
        return self


class SourceCheckpointReceipt(FrozenModel):
    """Reference the exact retained STOP binding, without copying its payload."""

    schema_version: Literal["yf_arc3_v5.source_checkpoint_receipt.v1"] = "yf_arc3_v5.source_checkpoint_receipt.v1"
    checkpoint_ref: Ref
    workflow_definition_ref: Ref
    workflow_instance_ref: Ref
    source_hash: Ref = Field(pattern="^[0-9a-f]{64}$")
    timeline_ref: Ref
    frame_ref: Ref | None
    state_revision: NonNegativeRevision
    status: Literal["completed", "blocked", "failed", "deferred"]
    statement_ref: Ref | None
    return_binding_ref: Ref | None = None
    call_refusal: SourceCallRefusal | None = None
    call_deferral: SourceCallDeferral | None = None
    declared_terminal_kind: Literal["stop", "block", "defer", "fail"] | None = None
    declared_value_binding_ref: Ref | None = None
    terminal_cause_ref: Ref | None = None

    @model_validator(mode="after")
    def validate_disposition(self):
        if (self.status == "completed") != (self.return_binding_ref is not None):
            raise ValueError("only a completed Source receipt names a STOP binding")
        if self.call_refusal is not None and (
            self.status != "blocked"
            or self.call_refusal.workflow_instance_ref != self.workflow_instance_ref
            or self.call_refusal.statement_ref != self.statement_ref
        ):
            raise ValueError("call refusal differs from its Source receipt boundary")
        if self.call_deferral is not None and (
            self.status != "deferred"
            or self.call_deferral.workflow_instance_ref != self.workflow_instance_ref
            or self.call_deferral.statement_ref != self.statement_ref
        ):
            raise ValueError("call deferral differs from its Source receipt boundary")
        if (self.declared_terminal_kind is None) != (self.declared_value_binding_ref is None):
            raise ValueError("declared terminal receipt requires its value binding")
        if self.declared_terminal_kind is not None:
            expected = {"stop": "completed", "block": "blocked", "defer": "deferred", "fail": "failed"}
            if (self.status != expected[self.declared_terminal_kind]
                    or self.call_refusal is not None or self.call_deferral is not None
                    or self.status == "completed" and self.return_binding_ref != self.declared_value_binding_ref):
                raise ValueError("declared terminal receipt has incompatible provenance")
        return self


class ParentRevalidationReturn(FrozenModel):
    """Source explicitly returns these qualified parent facts to its caller."""

    schema_version: Literal["yf_arc3_v5.parent_revalidation_return.v1"] = "yf_arc3_v5.parent_revalidation_return.v1"
    outcome_ref: Literal["outcome.parent_goal_revalidation_required"] = "outcome.parent_goal_revalidation_required"
    facts: FrozenMap

    @model_validator(mode="after")
    def validate_parent_facts(self):
        if self.facts.get("outcome_ref") != self.outcome_ref:
            raise ValueError("parent return facts differ from their declared outcome")
        for field in ("parent_continuity_allows_candidate", "parent_continuity_requires_revalidation"):
            if not isinstance(self.facts.get(field), bool):
                raise ValueError("parent return requires explicit continuity Booleans")
        for field in ("workflow_definition_ref", "workflow_instance_ref", "source_hash",
                      "game_ref", "level_ref", "session_ref", "frame_ref"):
            if not isinstance(self.facts.get(field), str) or not self.facts[field]:
                raise ValueError(f"parent return lacks canonical {field}")
        if not self.facts.get("provenance"):
            raise ValueError("parent return lacks causal provenance")
        return self


class SourceBindingPathRead(FrozenModel):
    """A single named value at an exact historical checkpoint, including absence."""

    checkpoint_ref: Ref
    path: tuple[Ref, ...] = Field(min_length=1)
    value_present: bool
    value: Any = None
    provenance: tuple[Ref, ...]


class CompositionParentContext(FrozenModel):
    """Exact parent checkpoint captured before child start; no semantic authority."""

    schema_version: Literal["yf_arc3_v5.composition_parent_context.v1"] = "yf_arc3_v5.composition_parent_context.v1"
    parent_checkpoint_ref: Ref
    parent_workflow_instance_ref: Ref
    parent_workflow_definition_ref: Ref
    parent_source_hash: Ref = Field(pattern="^[0-9a-f]{64}$")
    parent_state_revision: NonNegativeRevision
    parent_frame_ref: Ref | None
    timeline_ref: Ref
    run_ref: Ref
    child_workflow_instance_ref: Ref
    child_opened_frame_ref: Ref | None
    composition_edge_ref: Ref
    captured_at_revision: NonNegativeRevision

    @model_validator(mode="after")
    def validate_capture(self):
        if self.parent_state_revision > self.captured_at_revision:
            raise ValueError("composition context precedes its parent checkpoint")
        if self.parent_workflow_instance_ref == self.child_workflow_instance_ref:
            raise ValueError("composition context cannot designate its child as parent")
        return self


class UnqualifiedChildReturn(FrozenModel):
    """Keep an actual child return whose parent qualification is unavailable."""

    schema_version: Literal["yf_arc3_v5.unqualified_child_return.v1"] = "yf_arc3_v5.unqualified_child_return.v1"
    root_execution_record_ref: Ref
    parent_workflow_instance_ref: Ref | None
    composition_edge_ref: Ref | None
    source_receipt: SourceCheckpointReceipt
    parent_context: CompositionParentContext | None = None
    missing_binding_refs: tuple[Ref, ...] = Field(min_length=1)
