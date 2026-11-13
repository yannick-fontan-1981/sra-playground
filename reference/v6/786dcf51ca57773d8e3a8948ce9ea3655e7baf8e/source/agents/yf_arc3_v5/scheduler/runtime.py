"""Deterministic durable interpreter for compiled SRC workflow graphs."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from pydantic import TypeAdapter, ValidationError
from agents.yf_arc3_v5.logos.operational_reasoning import (create_reasoning_context, bind_reasoning_operation,
    bind_checkpoint_reasoning_outcome, OperationalConsciousnessAdmissionError,
    OperationalConsciousnessReasoningEntryRefusal)

from agents.yf_arc3_v5.logos.operations import (
    ActionIntent,
    ActionObservedRecord,
    ActionReleasePermit,
    ConcentrationLeaseState,
    ConcentrationLeaseTransition,
    ConcentrationOperation,
    project_concentration_operation,
    CompiledInteractionEffectRecord,
    CompiledSceneAssimilationRecord,
    OperationalConsciousnessReasoningEntryRecord,
    OperationalConsciousnessReasoningRefusalRecord,
    OperationalConsciousnessReasoningCallRefusalRecord,
    OperationalConsciousnessReasoningCallDeferralRecord,
    OperationalConsciousnessReasoningFailureRecord, ConsciousCompiledRecord,
    OperationalConsciousnessReplayValidationRecord,
    CompiledSelectionDecisionRecord,
    CompiledCalculationFailureRecord,
    CompiledTemporalTrackingRecord,
    OperationStatus,
    OperatorInvocation,
    OperatorResult,
    PropagationReport,
    WorkflowBindingValueRecord,
    WorkflowBlockKind,
    WorkflowControlFrame,
    WorkflowInstanceRecord,
    WorkflowLifecycleKind,
    WorkflowLifecycleRecord,
    WorkflowStatus,
)
from agents.yf_arc3_v5.logos.types import (
    FrozenMap,
    OperatorName,
    Ref,
    stable_digest,
)
from agents.yf_arc3_v5.state.shared_binding_digest import shared_row_binding_digest
from agents.yf_arc3_v5.operators.contracts import (
    ActOutput,
    ActRequest,
    AnyOperatorRequest,
    OperatorOutput,
)
from agents.yf_arc3_v5.operators.runtime import OperatorRuntime
from agents.yf_arc3_v5.scheduler.contracts import (
    CausalFrameResumeRequest,
    FunctionCallContext,
    OperatorBuildContext,
    SchedulerRunResult,
    WorkflowStartRequest,
)
from agents.yf_arc3_v5.scheduler.evaluator import (
    RuntimeTypeError,
    evaluate_expression,
    runtime_value,
    validate_runtime_type,
)
from agents.yf_arc3_v5.observability.decision_capture import expression_observer
from agents.yf_arc3_v5.scheduler.dynamic_workflow_shadow import (
    DynamicWorkflowShadowObserver,
)
from agents.yf_arc3_v5.scheduler.dynamic_workflow_runtime import (
    DynamicWorkflowRuntimeGate,
)
from agents.yf_arc3_v5.dynamic_workflow.shadow import DynamicWorkflowShadowRecord
from agents.yf_arc3_v5.dynamic_workflow.runtime import RootColdExecutionRecord
from agents.yf_arc3_v5.scheduler.registry import (
    PureCallBlocked,
    PureCallDeferred,
    SchedulerRuntimeRegistry,
)
from agents.yf_arc3_v5.src.ast import OPERATOR_STATEMENT_KINDS, StatementKind, ExpressionKind
from agents.yf_arc3_v5.scheduler.contracts import SRC_TERMINAL_BINDING_REF, SRC_TERMINAL_VALUE_BINDING, SRC_TERMINAL_KIND_BINDING, SRC_CALL_REFUSAL_BINDING_REF, SRC_CALL_DEFERRAL_BINDING_REF
from agents.yf_arc3_v5.scheduler.source_return import SourceCallRefusal, SourceCallDeferral, read_source_terminal_value, read_source_refusal, read_source_deferral
from agents.yf_arc3_v5.logos.source_completion import SourceTerminalBinding, SourceTechnicalFailure
from agents.yf_arc3_v5.scheduler.compiled_consciousness import CompiledReasoningTechnicalFailure, CompiledDirectCallRefusal
from agents.yf_arc3_v5.scheduler.call_refusal import source_call_refusal
from agents.yf_arc3_v5.scheduler.contracts import SRC_TECHNICAL_FAILURE_BINDING_REF
from agents.yf_arc3_v5.src.compiler import (
    CompiledModule,
    IrExpression,
    IrStatement,
    IrStep,
    IrWorkflow,
)
from agents.yf_arc3_v5.src.registry import (
    RegistryEntry,
    RegistryResolutionError,
    WorkflowRegistry,
)
from agents.yf_arc3_v5.src.symbols import SymbolDefinition
from agents.yf_arc3_v5.state import EventStore, RecordArtifact
from agents.yf_arc3_v5.state.events import CognitiveArtifact
from agents.yf_arc3_v5.state.transactions import TransactionRequest

_OUTPUT_ADAPTER: TypeAdapter[OperatorOutput] = TypeAdapter(OperatorOutput)
_OPERATOR_BY_STATEMENT = {
    StatementKind.OBSERVE: OperatorName.OBSERVE,
    StatementKind.ACT: OperatorName.ACT,
    StatementKind.DISTINGUISH: OperatorName.DISTINGUISH,
    StatementKind.RELATE: OperatorName.RELATE,
    StatementKind.PROPOSE: OperatorName.PROPOSE,
    StatementKind.DERIVE: OperatorName.DERIVE,
    StatementKind.COMPARE: OperatorName.COMPARE,
    StatementKind.UPDATE: OperatorName.UPDATE,
    StatementKind.SELECT: OperatorName.SELECT,
}
_TERMINAL_STATUS = {
    StatementKind.STOP: WorkflowStatus.COMPLETED,
    StatementKind.BLOCK: WorkflowStatus.BLOCKED,
    StatementKind.DEFER: WorkflowStatus.DEFERRED,
    StatementKind.FAIL: WorkflowStatus.FAILED,
}
_TERMINAL_LIFECYCLE = {
    WorkflowStatus.COMPLETED: WorkflowLifecycleKind.COMPLETED,
    WorkflowStatus.DEFERRED: WorkflowLifecycleKind.DEFERRED,
    WorkflowStatus.BLOCKED: WorkflowLifecycleKind.BLOCKED,
    WorkflowStatus.FAILED: WorkflowLifecycleKind.FAILED,
}


def _iterative_control_suffix(
    control_stack: Sequence[WorkflowControlFrame],
) -> str:
    """Give repeated operator occurrences a stable control-path identity."""

    iteration_path = tuple(
        (frame.block_kind.value, frame.owner_id, frame.iteration_index)
        for frame in control_stack
        if frame.block_kind in {WorkflowBlockKind.FOR_EACH, WorkflowBlockKind.WHILE}
    )
    if not iteration_path:
        return ""
    return f":iteration:{stable_digest(iteration_path)[:16]}"


def _is_large_binding_value(value: object, *, limit: int = 96) -> bool:
    """Bounded structural check that never serializes or copies the value."""

    pending = [value]
    visited = 0
    while pending:
        current = pending.pop()
        visited += 1
        if visited > limit:
            return True
        if isinstance(current, FrozenMap):
            if len(current) + len(pending) > limit - visited:
                return True
            pending.extend(current.values())
        elif isinstance(current, tuple):
            if len(current) + len(pending) > limit - visited:
                return True
            pending.extend(current)
    return False


class WorkflowSchedulerError(ValueError):
    """Compiled workflow execution violated a durable runtime contract."""


class WorkflowTechnicalFailure(RuntimeError):
    """Preserve the original exception and the canonical failed reasoning boundary."""

    def __init__(self, checkpoint, exception_type_ref):
        self.checkpoint_ref = checkpoint.id
        self.exception_type_ref = exception_type_ref
        super().__init__('technical workflow failure: ' + exception_type_ref + ' [' + checkpoint.id + ']')


class WorkflowInstanceNotFound(LookupError):
    """No checkpoint exists for the requested workflow instance."""


class WorkflowDispatchRejected(WorkflowSchedulerError):
    """A suspended authorization is no longer current before any transport attempt."""

    def __init__(self, reason_ref: str, detail: str) -> None:
        self.reason_ref = reason_ref
        super().__init__(detail)


class WorkflowResumeRejected(WorkflowSchedulerError):
    """A frame cannot resume the exact suspended continuation."""


class DuplicateObservationRejected(WorkflowResumeRejected):
    """The causal observation was already consumed; no event was appended."""


class _SourceInvocationOutcome(RuntimeError):
    """Carry an exact call refusal/deferral to the owning Source instruction.

    This is internal control transport, never a retry or an action authority.
    """

    def __init__(self, outcome: SourceCallRefusal | SourceCallDeferral):
        self.outcome = outcome
        super().__init__(outcome.detail)


@dataclass
class _WorkingState:
    status: WorkflowStatus
    frame_id: Ref | None
    bindings: dict[str, object]
    stack: list[WorkflowControlFrame]
    pending_expectations: tuple[Ref, ...]
    awaiting_frame_binding: Ref | None
    pending_action_intent_id: Ref | None
    pending_action_release_permit_id: Ref | None
    pending_environment_adapter_ref: Ref | None
    pending_world_context: FrozenMap | None
    pre_action_snapshot_digest: Ref | None
    suspension_frame_id: Ref | None
    consumed_observation_refs: tuple[Ref, ...]
    terminal_result: Ref | None

    @classmethod
    def from_checkpoint(cls, value: WorkflowInstanceRecord) -> "_WorkingState":
        return cls(
            status=value.status,
            frame_id=value.frame_id,
            bindings=value.local_bindings.to_shallow_dict(),
            stack=list(value.control_stack),
            pending_expectations=value.pending_expectation_refs,
            awaiting_frame_binding=value.awaiting_frame_binding,
            pending_action_intent_id=value.pending_action_intent_id,
            pending_action_release_permit_id=value.pending_action_release_permit_id,
            pending_environment_adapter_ref=value.pending_environment_adapter_ref,
            pending_world_context=value.pending_world_context,
            pre_action_snapshot_digest=value.pre_action_snapshot_digest,
            suspension_frame_id=value.suspension_frame_id,
            consumed_observation_refs=value.consumed_observation_refs,
            terminal_result=value.terminal_result,
        )


class WorkflowScheduler:
    """Run the exact compiled IR and journal durable workflow boundaries."""

    def __init__(
        self,
        *,
        workflow_registry: WorkflowRegistry,
        runtime_registry: SchedulerRuntimeRegistry,
        operator_runtime: OperatorRuntime,
        dynamic_workflow_shadow: DynamicWorkflowShadowObserver | None = None,
        dynamic_workflow_runtime: DynamicWorkflowRuntimeGate | None = None,
        max_collection_items: int = 1024,
    ) -> None:
        if max_collection_items < 1:
            raise ValueError("max_collection_items must be positive")
        self._workflow_registry = workflow_registry
        self._conscious_source_operation_catalogues = {}
        self._conscious_source_catalogue_preparations = 0
        self._conscious_source_catalogue_reuses = 0
        self._runtime_registry = runtime_registry
        self._operators = operator_runtime
        self._dynamic_workflow_shadow = dynamic_workflow_shadow
        self._dynamic_workflow_runtime = dynamic_workflow_runtime
        self._store = operator_runtime.event_store
        self._max_collection_items = max_collection_items
        self._current_checkpoints: dict[str, WorkflowInstanceRecord] = {}
        self._workflow_instance_order: list[str] = []
        self._current_workflow_tuple_cache: tuple[
            WorkflowInstanceRecord, ...
        ] | None = ()
        self._workflow_index_loaded = self._store.snapshot.event_count == 0
        self._binding_values: dict[str, object] = {}
        self._binding_object_refs: dict[int, str] = {}
        self._binding_values_loaded = False
        # Compiled IR is immutable. Retain only the current definition for each
        # workflow identity; a replaced definition must rebuild its exact index.
        self._statement_indexes: dict[
            Ref, tuple[IrWorkflow, dict[Ref, IrStatement]]
        ] = {}
        # Immutable definition indexes, scoped to this runtime. Never cache a
        # permission/result: resolve_call and current execution guards still run.
        self._module_attestation_indexes = {}
        self._call_parameter_shapes = {}
        self._durable_boundaries_only = False
        # Ephemeral mechanical state for the action-only continuation kernel.
        # It is keyed by the exact durable checkpoint sequence and discarded
        # on any mismatch, so restored runs still reconstruct from the journal.
        self._durable_working_state_cache: dict[
            str, tuple[int, _WorkingState]
        ] = {}

    def composition_budget_facts(self, parent_instance_ref: str | None, edge_ref: str) -> FrozenMap:
        if self._dynamic_workflow_runtime is None:
            return FrozenMap({"parent_composition_budget_qualified": False,
                              "parent_composition_remaining_occurrences": None})
        return self._dynamic_workflow_runtime.composition_budget_facts(parent_instance_ref, edge_ref)

    @property
    def event_store(self) -> EventStore:
        return self._store

    @property
    def operator_runtime(self) -> OperatorRuntime:
        """Expose the canonical operator runtime to source-attested executors."""

        return self._operators

    def current(self, workflow_instance_id: Ref) -> WorkflowInstanceRecord:
        cached = self._current_checkpoints.get(workflow_instance_id)
        if cached is not None:
            return cached
        if not self._workflow_index_loaded:
            self._rebuild_workflow_index()
        cached = self._current_checkpoints.get(workflow_instance_id)
        if cached is None:
            raise WorkflowInstanceNotFound(workflow_instance_id)
        return cached

    def current_workflows(self) -> tuple[WorkflowInstanceRecord, ...]:
        """Return the latest materialized checkpoint with one journal pass at most."""

        if not self._workflow_index_loaded:
            self._rebuild_workflow_index()
        cached = self._current_workflow_tuple_cache
        if cached is None:
            cached = tuple(
                self._current_checkpoints[workflow_id]
                for workflow_id in self._workflow_instance_order
            )
            self._current_workflow_tuple_cache = cached
        return cached

    def _current_reasoning_parent(self, operation, *, timeline_ref, frame_ref,
                                  requested_workflow_ref, requested_source_hash):
        """Bind an actual active caller, interpreted or compiled, to its record."""
        origin = operation.context
        consciousness = self._store.operational_consciousness
        try:
            consciousness.require_reasoning_execution(operation, run_ref=self._store.run_id,
                timeline_ref=timeline_ref, frame_ref=frame_ref, workflow_ref=origin.owner_workflow_ref,
                source_workflow_ref=origin.source_workflow_ref, source_hash=origin.source_hash,
                operation_ref=operation.operation_ref)
            self._workflow_registry.resolve_workflow(origin.source_workflow_ref,
                expected_transitive_source_hash=origin.source_hash)
            branch = consciousness.branch_state(origin.context_ref)
            if branch is None or self._store.artifact(branch.current_record_ref) is None:
                raise OperationalConsciousnessAdmissionError('reasoning_admission.canonical_parent_record',
                    'operational consciousness: initiating parent has no canonical record')
        except (OperationalConsciousnessAdmissionError, RegistryResolutionError) as error:
            refusal = OperationalConsciousnessReasoningEntryRefusal(
                initiating_operation=operation, requested_workflow_ref=requested_workflow_ref,
                requested_source_hash=requested_source_hash, run_ref=self._store.run_id,
                timeline_ref=timeline_ref, frame_ref=frame_ref,
                failed_guard_refs=(error.guard_ref if isinstance(error, OperationalConsciousnessAdmissionError)
                    else 'reasoning_admission.current_parent_source',), detail=str(error)[:2048])
            raise PureCallBlocked(refusal.detail, reasoning_entry_refusal=refusal) from error
        return origin, branch.current_record_ref

    def begin_conscious_compiled_reasoning(self, *, workflow_ref, module_source_hash, source_hash,
                                           workflow_instance_id, timeline_id, frame_id,
                                           replay_record=None, initiating_operation=None):
        from .compiled_consciousness import declared_conscious_operations, OperationalConsciousnessCompiledActivity, require_compiled_execution_boundary
        require_compiled_execution_boundary()
        entry, module, workflow = self._workflow_registry.resolve_workflow(
            workflow_ref, expected_transitive_source_hash=source_hash)
        if module.source_hash != module_source_hash:
            raise WorkflowSchedulerError('operational consciousness: compiled entry Source changed')
        catalogue_key = (workflow_ref, module_source_hash, source_hash)
        declarations = self._conscious_source_operation_catalogues.get(catalogue_key)
        if declarations is None:
            declarations = declared_conscious_operations(workflow)
            self._conscious_source_operation_catalogues[catalogue_key] = declarations
            self._conscious_source_catalogue_preparations += 1
        else:
            self._conscious_source_catalogue_reuses += 1
        consciousness = self._store.operational_consciousness
        historical_return = None
        historical_digest = None
        parent_context, parent_record_ref = (self._current_reasoning_parent(initiating_operation,
            timeline_ref=timeline_id, frame_ref=frame_id, requested_workflow_ref=workflow_ref,
            requested_source_hash=source_hash) if initiating_operation is not None else (None, None))
        if replay_record is not None:
            returned = replay_record.operational_consciousness
            if returned is None:
                raise WorkflowSchedulerError('direct calculation is not a coordinated replay subject')
            record = consciousness.compiled_entry(returned.entry_ref)
            if (record is None or record.declared_operations != declarations
                    or self._store.artifact(replay_record.id) != replay_record
                    or record.source_hash != entry.transitive_source_hash
                    or record.workflow_instance_id != workflow_instance_id
                    or record.timeline_id != timeline_id or record.frame_id != frame_id
                    or record.context.run_ref != self._store.run_id
                    or record.module_source_hash != module_source_hash):
                raise WorkflowSchedulerError('operational consciousness: restored compiled entry is not qualified')
            consciousness.require_reasoning_return(returned)
            consciousness.require_compiled_reasoning_replay(returned)
            historical_return = returned
            historical_digest = self._compiled_replay_result_digest(replay_record)
            # Artifact-only validations leave the knowledge revision unchanged.
            # Bind each qualified replay entry to its next journal position;
            # repeated reads must not reuse an already committed transaction.
            workflow_instance_id = (
                f'{workflow_instance_id}:replay-validation:{self._store.snapshot.revision:08d}'
                f':event:{len(self._store.event_view) + 1:08d}'
            )
        context = create_reasoning_context(run_ref=self._store.run_id, timeline_ref=timeline_id,
            owner_workflow_ref=workflow_instance_id, source_workflow_ref=workflow_ref,
            source_hash=entry.transitive_source_hash, origin_frame_ref=frame_id,
            parent_context=parent_context, parent_record_ref=parent_record_ref,
            composition_edge_ref=initiating_operation.statement_ref if initiating_operation is not None else None,
            entry_kind=(('compiled_replay_child' if replay_record is not None else 'compiled_source_child')
                if initiating_operation is not None else
                ('compiled_replay_validation' if replay_record is not None else 'compiled_source_workflow')))
        record = OperationalConsciousnessReasoningEntryRecord(
            id=f'{workflow_instance_id}:operational-consciousness:entry', context=context,
            source_unit=module.module_id, source_hash=entry.transitive_source_hash,
            state_revision=self._store.snapshot.revision, workflow_definition_id=workflow_ref,
            workflow_instance_id=workflow_instance_id, workflow_step_id=workflow.entry_step_id,
            timeline_id=timeline_id, frame_id=frame_id, module_source_hash=module.source_hash,
            declared_operations=declarations, initiating_operation=initiating_operation,
            replay_of_record_ref=replay_record.id if replay_record is not None else None)
        self._store.commit(TransactionRequest(transaction_id=f'{record.id}:commit',
            run_id=self._store.run_id, timeline_id=timeline_id, frame_id=frame_id,
            source_hash=record.source_hash, expected_revision=self._store.snapshot.revision,
            mutations=(RecordArtifact(artifact=record),)))
        return OperationalConsciousnessCompiledActivity(consciousness=consciousness, entry=record,
            replay_return=historical_return, replay_expected_digest=historical_digest,
            replay_recorder=self.record_conscious_compiled_replay,
            refusal_recorder=self.record_conscious_compiled_refusal,
            publication_reader=self.conscious_compiled_return_published,
            failure_recorder=self.record_conscious_compiled_failure,
            call_refusal_recorder=self.record_conscious_compiled_call_refusal,
            call_deferral_recorder=self.record_conscious_compiled_call_deferral)

    @staticmethod
    def _compiled_replay_result_digest(record):
        if isinstance(record, CompiledSceneAssimilationRecord):
            return record.scene_digest
        if isinstance(record, CompiledTemporalTrackingRecord):
            return record.tracking_digest
        raise WorkflowSchedulerError('operational consciousness: compiled record has no qualified replay result contract')

    def record_conscious_compiled_replay(self, *, entry, returned, actual_result_digest):
        consciousness = self._store.operational_consciousness
        consciousness.require_reasoning_return(returned)
        historical = self._store.artifact(entry.replay_of_record_ref or '')
        if (consciousness.compiled_entry(entry.id) != entry
                or not isinstance(historical, ConsciousCompiledRecord)
                or historical.source_hash != entry.source_hash
                or historical.frame_id != entry.frame_id or historical.timeline_id != entry.timeline_id):
            raise WorkflowSchedulerError('operational consciousness: replay publication lost its historical subject')
        old_return = historical.operational_consciousness
        consciousness.require_compiled_reasoning_replay(old_return)
        reproduced = tuple(bind_reasoning_operation(old_return.context, operation_ref=op.operation_ref,
            statement_ref=op.statement_ref, frame_ref=op.current_frame_ref,
            declared_question_ref=op.declared_question_ref) for op in returned.operations)
        if reproduced != old_return.operations:
            raise WorkflowSchedulerError('operational consciousness: replay publication changed its historical path')
        record = OperationalConsciousnessReplayValidationRecord(id=returned.outcome.producer_record_ref,
            operational_consciousness=returned, historical_record_ref=historical.id,
            historical_result_digest=self._compiled_replay_result_digest(historical),
            replayed_result_digest=actual_result_digest,
            source_unit=entry.source_unit, source_hash=entry.source_hash,
            state_revision=self._store.snapshot.revision, workflow_definition_id=entry.workflow_definition_id,
            workflow_instance_id=entry.workflow_instance_id, workflow_step_id=entry.workflow_step_id,
            timeline_id=entry.timeline_id, frame_id=entry.frame_id, provenance=(entry.id, historical.id))
        self._store.commit(TransactionRequest(transaction_id=record.id + ':commit',
            run_id=self._store.run_id, timeline_id=entry.timeline_id, frame_id=entry.frame_id,
            source_hash=record.source_hash, expected_revision=self._store.snapshot.revision,
            mutations=(RecordArtifact(artifact=record),)))

    def conscious_compiled_return_published(self, entry, returned):
        record = self._store.artifact(returned.outcome.producer_record_ref)
        if record is None:
            return False
        if (not isinstance(record, ConsciousCompiledRecord)
                or record.operational_consciousness != returned
                or self._store.operational_consciousness.compiled_entry(entry.id) != entry):
            raise WorkflowSchedulerError('operational consciousness: compiled publication differs from its prepared return')
        self._store.operational_consciousness.require_reasoning_outcome(returned.outcome)
        return True

    def record_conscious_compiled_failure(self, *, entry, returned, exception_type_ref, attempted_result_ref):
        consciousness = self._store.operational_consciousness
        consciousness.require_reasoning_return(returned)
        if consciousness.compiled_entry(entry.id) != entry:
            raise WorkflowSchedulerError('operational consciousness: failure entry is not canonical')
        _, module, workflow = self._workflow_registry.resolve_workflow(entry.workflow_definition_id,
            expected_transitive_source_hash=entry.source_hash)
        if module.source_hash != entry.module_source_hash:
            raise WorkflowSchedulerError('operational consciousness: failed compiled source changed')
        step_ref = workflow.entry_step_id
        if returned.operations:
            last = returned.operations[-1]
            step_ref = next(item.step_ref for item in entry.declared_operations if item.statement_ref == last.statement_ref)
        record = OperationalConsciousnessReasoningFailureRecord(id=returned.outcome.producer_record_ref,
            operational_consciousness=returned, exception_type_ref=exception_type_ref,
            attempted_result_ref=attempted_result_ref, source_unit=entry.source_unit, source_hash=entry.source_hash,
            state_revision=self._store.snapshot.revision, workflow_definition_id=entry.workflow_definition_id,
            workflow_instance_id=entry.workflow_instance_id, workflow_step_id=step_ref,
            timeline_id=entry.timeline_id, frame_id=entry.frame_id, provenance=(entry.id,))
        self._store.commit(TransactionRequest(transaction_id=record.id + ':commit',
            run_id=self._store.run_id, timeline_id=entry.timeline_id, frame_id=entry.frame_id,
            source_hash=record.source_hash, expected_revision=self._store.snapshot.revision,
            mutations=(RecordArtifact(artifact=record),)))

    def _canonical_compiled_call_origin(self, *, entry, returned, checkpoint_ref,
                                        outcome_ref, entry_refusal=None, direct_operation=None):
        """One lineage check for refused and deferred children of either executor."""
        consciousness = self._store.operational_consciousness
        consciousness.require_reasoning_return(returned)
        if consciousness.compiled_entry(entry.id) != entry:
            raise WorkflowSchedulerError('operational consciousness: caller entry is not canonical')
        _, module, _ = self._workflow_registry.resolve_workflow(entry.workflow_definition_id,
            expected_transitive_source_hash=entry.source_hash)
        if module.source_hash != entry.module_source_hash:
            raise WorkflowSchedulerError('operational consciousness: caller source changed')
        if sum(value is not None for value in (checkpoint_ref, outcome_ref, entry_refusal, direct_operation)) != 1:
            raise WorkflowSchedulerError('operational consciousness: call outcome needs one actual cause')
        if direct_operation is not None:
            if direct_operation.context != entry.context or direct_operation not in returned.operations:
                raise WorkflowSchedulerError('operational consciousness: direct refusal belongs to another caller')
            consciousness.require_reasoning_operation(direct_operation,
                run_ref=entry.context.run_ref, timeline_ref=entry.timeline_id, frame_ref=entry.frame_id,
                workflow_ref=entry.context.owner_workflow_ref,
                source_workflow_ref=entry.context.source_workflow_ref,
                source_hash=entry.context.source_hash, operation_ref=direct_operation.operation_ref)
            return direct_operation, None
        if entry_refusal is not None:
            origin = entry_refusal.initiating_operation
            if origin.context != entry.context or origin not in returned.operations:
                raise WorkflowSchedulerError('operational consciousness: refused entry belongs to another caller')
            return origin, None
        child_ref = outcome_ref or checkpoint_ref
        child = self._store.artifact(child_ref) if child_ref is not None else None
        if (not isinstance(child, (WorkflowInstanceRecord, ConsciousCompiledRecord))
                or child.timeline_id != entry.timeline_id or child.frame_id != entry.frame_id):
            raise WorkflowSchedulerError('operational consciousness: child has no current canonical outcome')
        if outcome_ref is not None:
            if (not isinstance(child, ConsciousCompiledRecord)
                    or child.operational_consciousness is None
                    or child.operational_consciousness.outcome.status != returned.outcome.status):
                raise WorkflowSchedulerError('operational consciousness: compiled child has another outcome kind')
            consciousness.require_reasoning_return(child.operational_consciousness)
            consciousness.require_reasoning_outcome(child.operational_consciousness.outcome)
            child_entry = consciousness.compiled_entry(child.operational_consciousness.entry_ref)
            origin = child_entry.initiating_operation if child_entry is not None else None
        else:
            statuses = (('deferred',) if returned.outcome.status == 'deferred' else ('blocked', 'failed'))
            if not isinstance(child, WorkflowInstanceRecord) or child.status.value not in statuses:
                raise WorkflowSchedulerError('operational consciousness: child checkpoint has another outcome kind')
            child_context = child.operational_consciousness_context
            if (child_context is None or child_context.parent_context_ref != entry.context.context_ref
                    or child_context.parent_checkpoint_ref != entry.id):
                raise WorkflowSchedulerError('operational consciousness: child checkpoint names another parent')
            consciousness.require_reasoning_outcome(child.operational_consciousness_outcome)
            origins = tuple(operation for operation in returned.operations
                if operation.statement_ref == child_context.composition_edge_ref)
            origin = origins[0] if origins and all(item == origins[0] for item in origins) else None
        if origin is None or origin.context != entry.context or origin not in returned.operations:
            raise WorkflowSchedulerError('operational consciousness: child has no unique requesting instruction')
        return origin, child_ref

    def record_conscious_compiled_call_deferral(self, *, entry, returned, error):
        """Return an actual interpreted or compiled child wait to its caller."""
        origin, child_ref = self._canonical_compiled_call_origin(entry=entry, returned=returned,
            checkpoint_ref=error.child_deferred_checkpoint_ref, outcome_ref=error.child_reasoning_outcome_ref)
        deferral = SourceCallDeferral(workflow_instance_ref=entry.workflow_instance_id,
            statement_ref=origin.statement_ref, callee_ref=origin.operation_ref, detail=str(error)[:2048],
            child_deferred_checkpoint_ref=error.child_deferred_checkpoint_ref,
            child_reasoning_outcome_ref=error.child_reasoning_outcome_ref)
        step_ref = next(item.step_ref for item in entry.declared_operations if item.statement_ref == origin.statement_ref)
        record = OperationalConsciousnessReasoningCallDeferralRecord(
            id=returned.outcome.producer_record_ref, operational_consciousness=returned,
            call_deferral=deferral, source_unit=entry.source_unit, source_hash=entry.source_hash,
            state_revision=self._store.snapshot.revision, workflow_definition_id=entry.workflow_definition_id,
            workflow_instance_id=entry.workflow_instance_id, workflow_step_id=step_ref,
            timeline_id=entry.timeline_id, frame_id=entry.frame_id, provenance=(entry.id, child_ref))
        self._store.commit(TransactionRequest(transaction_id=record.id + ':commit',
            run_id=self._store.run_id, timeline_id=entry.timeline_id, frame_id=entry.frame_id,
            source_hash=record.source_hash, expected_revision=self._store.snapshot.revision,
            mutations=(RecordArtifact(artifact=record),)))
        return record

    def record_conscious_compiled_call_refusal(self, *, entry, returned, error):
        """Seal only a refusal whose requesting instruction is canonically known."""
        direct = error if isinstance(error, CompiledDirectCallRefusal) else None
        origin, child_ref = self._canonical_compiled_call_origin(entry=entry, returned=returned,
            checkpoint_ref=error.child_failure_checkpoint_ref, outcome_ref=error.child_reasoning_outcome_ref,
            entry_refusal=error.reasoning_entry_refusal,
            direct_operation=direct.operation if direct is not None else None)
        refusal = direct.refusal if direct is not None else source_call_refusal(error,
            workflow_instance_ref=entry.workflow_instance_id,
            statement_ref=origin.statement_ref, callee_ref=origin.operation_ref)
        step_ref = next(item.step_ref for item in entry.declared_operations if item.statement_ref == origin.statement_ref)
        record = OperationalConsciousnessReasoningCallRefusalRecord(
            id=returned.outcome.producer_record_ref, operational_consciousness=returned,
            call_refusal=refusal, direct_call_operation=direct.operation if direct is not None else None,
            source_unit=entry.source_unit, source_hash=entry.source_hash,
            state_revision=self._store.snapshot.revision, workflow_definition_id=entry.workflow_definition_id,
            workflow_instance_id=entry.workflow_instance_id, workflow_step_id=step_ref,
            timeline_id=entry.timeline_id, frame_id=entry.frame_id,
            provenance=(entry.id, child_ref) if child_ref is not None else (entry.id,))
        self._store.commit(TransactionRequest(transaction_id=record.id + ':commit',
            run_id=self._store.run_id, timeline_id=entry.timeline_id, frame_id=entry.frame_id,
            source_hash=record.source_hash, expected_revision=self._store.snapshot.revision,
            mutations=(RecordArtifact(artifact=record),)))

    def record_conscious_compiled_refusal(self, *, entry, returned, policy_ref,
                                         drm_source_hash, alternative_refs, selection_result):
        """Seal a non-selection before propagating its typed cause to the caller."""
        consciousness = self._store.operational_consciousness
        consciousness.require_reasoning_return(returned)
        if consciousness.compiled_entry(entry.id) != entry:
            raise WorkflowSchedulerError('operational consciousness: refusal entry is not canonical')
        _, module, _ = self._workflow_registry.resolve_workflow(entry.workflow_definition_id,
            expected_transitive_source_hash=entry.source_hash)
        if module.source_hash != entry.module_source_hash:
            raise WorkflowSchedulerError('operational consciousness: refusal source changed')
        last = returned.operations[-1]
        declared = next(item for item in entry.declared_operations if item.statement_ref == last.statement_ref)
        record = OperationalConsciousnessReasoningRefusalRecord(
            id=returned.outcome.producer_record_ref, operational_consciousness=returned,
            source_unit=entry.source_unit, source_hash=entry.source_hash,
            state_revision=self._store.snapshot.revision,
            workflow_definition_id=entry.workflow_definition_id, workflow_instance_id=entry.workflow_instance_id,
            workflow_step_id=declared.step_ref, timeline_id=entry.timeline_id, frame_id=entry.frame_id,
            provenance=(entry.id,), policy_ref=policy_ref, drm_source_hash=drm_source_hash,
            alternative_refs=alternative_refs, selection_result=selection_result)
        self._store.commit(TransactionRequest(transaction_id=record.id + ':commit',
            run_id=self._store.run_id, timeline_id=entry.timeline_id, frame_id=entry.frame_id,
            source_hash=record.source_hash, expected_revision=self._store.snapshot.revision,
            mutations=(RecordArtifact(artifact=record),)))

    def record_compiled_selection(
        self, record: CompiledSelectionDecisionRecord
    ) -> None:
        """Journal a completed source-attested selection without interpreter frames."""

        if record.operational_consciousness is not None:
            self._store.operational_consciousness.require_reasoning_return(record.operational_consciousness)

        entry, module, workflow = self._workflow_registry.resolve_workflow(
            record.workflow_definition_id,
            expected_transitive_source_hash=record.source_hash,
        )
        if (
            record.source_unit != module.module_id
            or record.module_source_hash != module.source_hash
            or record.source_hash != entry.transitive_source_hash
            or record.state_revision != self._store.snapshot.revision
            or record.execution_run_ref != self._store.run_id
        ):
            raise WorkflowSchedulerError("compiled selection source or revision mismatch")
        step_ids = {step.id for step in workflow.steps}
        if any(step_id not in step_ids for step_id, _ in record.path):
            raise WorkflowSchedulerError("compiled selection path leaves the source workflow")
        self._store.commit(TransactionRequest(
            transaction_id=f"{record.id}:commit",
            run_id=self._store.run_id,
            timeline_id=record.timeline_id or "",
            frame_id=record.frame_id,
            source_hash=record.source_hash,
            expected_revision=self._store.snapshot.revision,
            mutations=(RecordArtifact(artifact=record),),
        ))

    def record_compiled_calculation_failure(self, record: CompiledCalculationFailureRecord) -> None:
        """Keep an actual direct failure without opening a responsibility tree."""
        entry, module, workflow = self._workflow_registry.resolve_workflow(
            record.workflow_definition_id, expected_transitive_source_hash=record.source_hash)
        if (record.run_ref != self._store.run_id
                or record.source_unit != module.module_id
                or record.module_source_hash != module.source_hash
                or record.source_hash != entry.transitive_source_hash
                or record.state_revision != self._store.snapshot.revision
                or record.workflow_step_id not in {step.id for step in workflow.steps}):
            raise WorkflowSchedulerError('compiled failure source, scope or revision mismatch')
        self._store.commit(TransactionRequest(
            transaction_id=record.id + ':commit', run_id=self._store.run_id,
            timeline_id=record.timeline_id, frame_id=record.frame_id,
            source_hash=record.source_hash, expected_revision=self._store.snapshot.revision,
            mutations=(RecordArtifact(artifact=record),)))

    def record_compiled_scene_assimilation(
        self, record: CompiledSceneAssimilationRecord
    ) -> None:
        """Journal only the source and digest of an already measured scene."""

        self._store.operational_consciousness.require_reasoning_return(record.operational_consciousness)

        entry, module, workflow = self._workflow_registry.resolve_workflow(
            record.workflow_definition_id,
            expected_transitive_source_hash=record.source_hash,
        )
        if (
            record.source_unit != module.module_id
            or record.module_source_hash != module.source_hash
            or record.source_hash != entry.transitive_source_hash
            or record.state_revision != self._store.snapshot.revision
        ):
            raise WorkflowSchedulerError("compiled scene source or revision mismatch")
        step_ids = {step.id for step in workflow.steps}
        if any(step_id not in step_ids for step_id in record.path):
            raise WorkflowSchedulerError("compiled scene path leaves the source workflow")
        self._store.commit(TransactionRequest(
            transaction_id=f"{record.id}:commit",
            run_id=self._store.run_id,
            timeline_id=record.timeline_id or "",
            frame_id=record.frame_id,
            source_hash=record.source_hash,
            expected_revision=self._store.snapshot.revision,
            mutations=(RecordArtifact(artifact=record),),
        ))

    def record_compiled_temporal_tracking(
        self, record: CompiledTemporalTrackingRecord
    ) -> None:
        """Journal one source-attested tracking digest without copying the scene."""

        self._store.operational_consciousness.require_reasoning_return(record.operational_consciousness)

        entry, module, workflow = self._workflow_registry.resolve_workflow(
            record.workflow_definition_id,
            expected_transitive_source_hash=record.source_hash,
        )
        if (
            record.source_unit != module.module_id
            or record.module_source_hash != module.source_hash
            or record.source_hash != entry.transitive_source_hash
            or record.state_revision != self._store.snapshot.revision
            or record.workflow_step_id not in {step.id for step in workflow.steps}
        ):
            raise WorkflowSchedulerError("compiled tracking source or revision mismatch")
        self._store.commit(TransactionRequest(
            transaction_id=f"{record.id}:commit",
            run_id=self._store.run_id,
            timeline_id=record.timeline_id or "",
            frame_id=record.frame_id,
            source_hash=record.source_hash,
            expected_revision=self._store.snapshot.revision,
            mutations=(RecordArtifact(artifact=record),),
        ))

    def record_compiled_interaction_effect(
        self, record: CompiledInteractionEffectRecord
    ) -> None:
        """Journal a completed classification without workflow frame payloads."""

        self._store.operational_consciousness.require_reasoning_return(record.operational_consciousness)

        entry, module, workflow = self._workflow_registry.resolve_workflow(
            record.workflow_definition_id,
            expected_transitive_source_hash=record.source_hash,
        )
        claim_refs = (*record.contextual_claim_refs, *record.transient_claim_refs)
        if (
            record.source_unit != module.module_id
            or record.module_source_hash != module.source_hash
            or record.source_hash != entry.transitive_source_hash
            or record.state_revision != self._store.snapshot.revision
            or any(self._store.snapshot.claim(ref) is None for ref in claim_refs)
        ):
            raise WorkflowSchedulerError(
                "compiled interaction effect source, revision, or claim mismatch"
            )
        step_ids = {step.id for step in workflow.steps}
        if any(step_id not in step_ids for step_id in record.path):
            raise WorkflowSchedulerError(
                "compiled interaction effect path leaves the source workflow"
            )
        self._store.commit(TransactionRequest(
            transaction_id=f"{record.id}:commit",
            run_id=self._store.run_id,
            timeline_id=record.timeline_id or "",
            frame_id=record.frame_id,
            source_hash=record.source_hash,
            expected_revision=self._store.snapshot.revision,
            mutations=(RecordArtifact(artifact=record),),
        ))

    def _rebuild_workflow_index(self) -> None:
        """Materialize every restored workflow incrementally in one bounded pass."""

        bindings_by_workflow: dict[str, dict[str, object]] = {}
        latest_by_workflow: dict[str, WorkflowInstanceRecord] = {}
        source_identity_by_workflow: dict[str, tuple[str, str, str]] = {}
        checkpoint_count_by_workflow: dict[str, int] = {}
        order: list[str] = []
        load_binding_values = not self._binding_values_loaded
        for artifact in self._artifacts():
            if isinstance(artifact, RootColdExecutionRecord):
                if self._dynamic_workflow_runtime is not None:
                    self._dynamic_workflow_runtime.restore(artifact)
                continue
            if isinstance(artifact, DynamicWorkflowShadowRecord):
                if self._dynamic_workflow_shadow is not None:
                    self._dynamic_workflow_shadow.restore(artifact)
                continue
            if load_binding_values and isinstance(
                artifact, WorkflowBindingValueRecord
            ):
                value = artifact.payload["value"]
                self._binding_values[artifact.id] = value
                self._binding_object_refs[id(value)] = artifact.id
                continue
            if not isinstance(artifact, WorkflowInstanceRecord):
                continue
            workflow_id = artifact.workflow_instance_id or ""
            if workflow_id not in bindings_by_workflow:
                bindings_by_workflow[workflow_id] = {}
                checkpoint_count_by_workflow[workflow_id] = 0
                order.append(workflow_id)
            expected_sequence = checkpoint_count_by_workflow[workflow_id] + 1
            if artifact.checkpoint_sequence != expected_sequence:
                raise WorkflowSchedulerError(
                    f"non-contiguous checkpoint sequence for {workflow_id}"
                )
            checkpoint_count_by_workflow[workflow_id] = expected_sequence
            source_identity = (
                artifact.workflow_definition_id,
                artifact.source_hash,
                artifact.module_source_hash,
            )
            prior_identity = source_identity_by_workflow.setdefault(
                workflow_id, source_identity
            )
            if prior_identity != source_identity:
                raise WorkflowSchedulerError(
                    "workflow source identity changed across checkpoints"
                )
            bindings = bindings_by_workflow[workflow_id]
            if artifact.local_bindings_complete:
                bindings.clear()
                bindings.update(
                    self._materialize_binding_map(artifact.local_bindings)
                )
            else:
                for name in artifact.local_binding_removals:
                    bindings.pop(name, None)
                bindings.update(
                    self._materialize_binding_map(artifact.local_binding_updates)
                )
            latest_by_workflow[workflow_id] = artifact
        self._binding_values_loaded = True
        self._workflow_instance_order = order
        self._current_checkpoints = {
            workflow_id: latest_by_workflow[workflow_id].model_copy(
                update={
                    "local_bindings": FrozenMap(bindings_by_workflow[workflow_id]),
                    "local_binding_updates": FrozenMap(),
                    "local_binding_removals": (),
                    "local_bindings_complete": True,
                }
            )
            for workflow_id in order
        }
        self._current_workflow_tuple_cache = None
        self._workflow_index_loaded = True

    def start(self, request: WorkflowStartRequest) -> WorkflowInstanceRecord:
        if request.run_id != self._store.run_id:
            raise WorkflowSchedulerError("workflow run identity mismatch")
        try:
            self.current(request.workflow_instance_id)
        except WorkflowInstanceNotFound:
            pass
        else:
            raise WorkflowSchedulerError(
                f"workflow instance already exists: {request.workflow_instance_id}"
            )
        entry, module, workflow = self._workflow_registry.resolve_workflow(
            request.workflow_definition_id,
            expected_transitive_source_hash=request.expected_transitive_source_hash,
        )
        bindings = self._initial_bindings(workflow, request.inputs)
        parent_context, parent_record_ref = (self._current_reasoning_parent(request.initiating_operation,
            timeline_ref=request.timeline_id, frame_ref=request.frame_id,
            requested_workflow_ref=request.workflow_definition_id,
            requested_source_hash=request.expected_transitive_source_hash)
            if request.initiating_operation is not None else (None, None))
        stack = [
            WorkflowControlFrame(
                block_kind=WorkflowBlockKind.STEP,
                owner_id=workflow.entry_step_id,
            )
        ]
        checkpoint = WorkflowInstanceRecord(
            operational_consciousness_context=create_reasoning_context(
                run_ref=self._store.run_id, timeline_ref=request.timeline_id,
                owner_workflow_ref=request.workflow_instance_id, source_workflow_ref=workflow.id,
                source_hash=entry.transitive_source_hash, origin_frame_ref=request.frame_id,
                parent=(self.current(request.parent_workflow_instance_id)
                        if request.parent_workflow_instance_id is not None else None),
                parent_context=parent_context, parent_record_ref=parent_record_ref,
                composition_edge_ref=request.declared_composition_edge_ref),
            id=f"{request.workflow_instance_id}:checkpoint:00000001",
            source_unit=module.module_id,
            source_hash=entry.transitive_source_hash,
            state_revision=self._store.snapshot.revision,
            workflow_definition_id=workflow.id,
            workflow_instance_id=request.workflow_instance_id,
            workflow_step_id=workflow.entry_step_id,
            timeline_id=request.timeline_id,
            frame_id=request.frame_id,
            provenance=(),
            checkpoint_sequence=1,
            status=WorkflowStatus.ACTIVE,
            current_step_id=workflow.entry_step_id,
            current_statement_id=self._current_statement_id(stack, workflow),
            control_stack=tuple(stack),
            local_bindings=FrozenMap(bindings),
            module_source_hash=module.source_hash,
        )
        lifecycle = WorkflowLifecycleRecord(
            id=f"{request.workflow_instance_id}:lifecycle:00000001",
            source_unit=module.module_id,
            source_hash=entry.transitive_source_hash,
            state_revision=self._store.snapshot.revision,
            workflow_definition_id=workflow.id,
            workflow_instance_id=request.workflow_instance_id,
            workflow_step_id=workflow.entry_step_id,
            timeline_id=request.timeline_id,
            frame_id=request.frame_id,
            provenance=(),
            transition=WorkflowLifecycleKind.STARTED,
            from_step_id=None,
            to_step_id=workflow.entry_step_id,
            from_status=WorkflowStatus.READY,
            to_status=WorkflowStatus.ACTIVE,
            cause_ref=workflow.id,
        )
        try:
            if self._dynamic_workflow_shadow is not None:
                self._dynamic_workflow_shadow.begin(
                    request,
                    source_revision=self._store.snapshot.revision,
                )
            if self._dynamic_workflow_runtime is not None:
                self._dynamic_workflow_runtime.begin(
                    request,
                    source_revision=self._store.snapshot.revision,
                    parent_checkpoint=(self.current(request.parent_workflow_instance_id)
                        if request.parent_workflow_instance_id is not None else None),
                    reasoning_context=(checkpoint.operational_consciousness_context
                        if request.initiating_operation is not None else None),
                )
            self._commit_scheduler_artifacts(
                checkpoint,
                artifacts=(lifecycle, checkpoint),
            )
        except Exception:
            if self._dynamic_workflow_shadow is not None:
                self._dynamic_workflow_shadow.abort(request.workflow_instance_id)
            if self._dynamic_workflow_runtime is not None:
                self._dynamic_workflow_runtime.abort(request.workflow_instance_id)
            raise
        return checkpoint

    def advance(
        self,
        workflow_instance_id: Ref,
        *,
        max_instructions: int = 1000,
        durable_boundaries_only: bool = False,
    ) -> SchedulerRunResult:
        if max_instructions < 1:
            raise ValueError("max_instructions must be positive")
        checkpoint = self.current(workflow_instance_id)
        if checkpoint.status is not WorkflowStatus.ACTIVE:
            return SchedulerRunResult(checkpoint=checkpoint)
        entry, module, workflow = self._resolve_checkpoint(checkpoint)
        if (
            checkpoint.state_revision != self._store.snapshot.revision
            and not self._operator_recovery_revision_matches(checkpoint, workflow)
        ):
            raise WorkflowSchedulerError(
                "active workflow checkpoint has a stale semantic state revision"
            )
        executed: list[Ref] = []
        prior_boundary_mode = self._durable_boundaries_only
        cached_working_state = (
            self._durable_working_state_cache.get(workflow_instance_id)
            if durable_boundaries_only
            else None
        )
        working_state = (
            cached_working_state[1]
            if cached_working_state is not None
            and cached_working_state[0] == checkpoint.checkpoint_sequence
            else (_WorkingState.from_checkpoint(checkpoint) if durable_boundaries_only else None)
        )
        if durable_boundaries_only and cached_working_state is not None and (
            cached_working_state[0] != checkpoint.checkpoint_sequence
        ):
            self._durable_working_state_cache.pop(workflow_instance_id, None)
        self._durable_boundaries_only = bool(durable_boundaries_only)
        prior_select_receipt_mode = self._operators.set_durable_boundary_mode(
            bool(durable_boundaries_only)
        )
        state = None
        attempted_statement_ref = workflow.id
        try:
            while len(executed) < max_instructions:
                if checkpoint.status is not WorkflowStatus.ACTIVE:
                    break
                state = (
                    working_state
                    if working_state is not None
                    else _WorkingState.from_checkpoint(checkpoint)
                )
                if not state.stack:
                    checkpoint = self._terminal_checkpoint(
                        checkpoint,
                        state,
                        workflow,
                        cause_ref=workflow.id,
                        status=WorkflowStatus.FAILED,
                        result="failed:empty_control_stack",
                    )
                    break
                frame = state.stack[-1]
                statements = self._frame_statements(frame, workflow)
                try:
                    if frame.next_statement_index >= len(statements):
                        attempted_statement_ref = frame.owner_id
                        checkpoint = self._complete_frame(
                            checkpoint,
                            state,
                            workflow,
                            module,
                            entry,
                        )
                        executed.append(frame.owner_id)
                        continue
                    statement = statements[frame.next_statement_index]
                    attempted_statement_ref = statement.id
                    checkpoint = self._execute_statement(
                        checkpoint,
                        state,
                        workflow,
                        module,
                        entry,
                        statement,
                    )
                    executed.append(statement.id)
                except _SourceInvocationOutcome as transfer:
                    outcome = transfer.outcome
                    if outcome.workflow_instance_ref != checkpoint.workflow_instance_id:
                        raise WorkflowSchedulerError('call outcome belongs to another workflow instance')
                    refused = isinstance(outcome, SourceCallRefusal)
                    checkpoint = self._terminal_checkpoint(
                        checkpoint, state, workflow, cause_ref=outcome.statement_ref,
                        status=WorkflowStatus.BLOCKED if refused else WorkflowStatus.DEFERRED,
                        call_refusal=outcome if refused else None,
                        call_deferral=None if refused else outcome,
                        result=('blocked:call:' if refused else 'deferred:call:')
                            + outcome.callee_ref + ':' + outcome.detail)
                    executed.append(outcome.statement_ref)
        except Exception as error:
            # No recovery/action decision is made here. Durable state, including
            # uncertain ACT ownership, is returned before the error propagates.
            try:
                latest = self.current(workflow_instance_id)
                if latest.status is not WorkflowStatus.ACTIVE:
                    raise error
                safe_state = _WorkingState.from_checkpoint(latest)
                statement_ref = attempted_statement_ref
                pending_intent = (getattr(state, 'pending_action_intent_id', None)
                    or safe_state.pending_action_intent_id)
                exception_type = (error.exception_type_ref if isinstance(error, (WorkflowTechnicalFailure, CompiledReasoningTechnicalFailure))
                    else type(error).__module__ + '.' + type(error).__qualname__)
                failure = SourceTechnicalFailure(workflow_instance_ref=workflow_instance_id,
                    statement_ref=statement_ref, exception_type_ref=exception_type,
                    child_failure_checkpoint_ref=(error.checkpoint_ref if isinstance(error, WorkflowTechnicalFailure) else None),
                    child_reasoning_outcome_ref=(error.reasoning_outcome_ref if isinstance(error, CompiledReasoningTechnicalFailure) else None),
                    pending_action_intent_ref=pending_intent,
                    action_effect_requires_reconciliation=pending_intent is not None)
                failed = self._terminal_checkpoint(latest, safe_state, workflow,
                    cause_ref=statement_ref, status=WorkflowStatus.FAILED,
                    result='failed:technical:' + exception_type, technical_failure=failure)
            except Exception as persistence_error:
                if persistence_error is not error and hasattr(error, 'add_note'):
                    error.add_note('Canonical failure publication failed: ' + type(persistence_error).__name__)
                raise error
            self._durable_working_state_cache.pop(workflow_instance_id, None)
            raise WorkflowTechnicalFailure(failed, exception_type) from error
        finally:
            self._durable_boundaries_only = prior_boundary_mode
            self._operators.set_durable_boundary_mode(prior_select_receipt_mode)
        if (
            durable_boundaries_only
            and working_state is not None
            and checkpoint.status is WorkflowStatus.ACTIVE
            and len(executed) >= max_instructions
        ):
            # A technical yield is also a durable boundary: preserve the exact
            # stack, bindings and revision before returning to the dispatcher.
            # Otherwise current() still exposes the pre-loop checkpoint while
            # Source UPDATEs have already advanced the canonical revision.
            boundary_mode = self._durable_boundaries_only
            self._durable_boundaries_only = False
            try:
                checkpoint = self._commit_state(
                    checkpoint, working_state, workflow, cause_ref=workflow.id,
                )
            finally:
                self._durable_boundaries_only = boundary_mode
        if durable_boundaries_only and working_state is not None:
            if checkpoint.status in {
                WorkflowStatus.SUSPENDED,
                WorkflowStatus.ACTIVE,
            }:
                self._durable_working_state_cache[workflow_instance_id] = (
                    checkpoint.checkpoint_sequence,
                    working_state,
                )
            else:
                self._durable_working_state_cache.pop(workflow_instance_id, None)
        return SchedulerRunResult(
            checkpoint=checkpoint,
            executed_statement_ids=tuple(executed),
            instruction_limit_reached=(
                len(executed) >= max_instructions
                and checkpoint.status is WorkflowStatus.ACTIVE
            ),
        )

    def advance_bounded(
        self,
        workflow_instance_id: Ref,
        *,
        instruction_quantum: int,
        maximum_instructions: int,
        durable_boundaries_only: bool = False,
    ) -> SchedulerRunResult:
        """Resume the exact committed instance across bounded instruction slices.

        Bounds are supplied by its SRC contract. A semantic block, suspension or
        terminal state is never retried. Only an active instruction-limit yield
        resumes, without restarting the workflow or retaining prior trace slices.
        """
        if not 1 <= instruction_quantum <= maximum_instructions <= 8192:
            raise ValueError("invalid bounded workflow execution contract")
        remaining = maximum_instructions
        while remaining:
            result = self.advance(
                workflow_instance_id,
                max_instructions=min(instruction_quantum, remaining),
                durable_boundaries_only=durable_boundaries_only,
            )
            remaining -= len(result.executed_statement_ids)
            if (
                result.checkpoint.status is not WorkflowStatus.ACTIVE
                or not result.instruction_limit_reached
            ):
                return result
        return result

    def require_current_dispatch(self, checkpoint, intent, permit):
        """Revalidate frozen authorization only; no observation, planning or ACT replay."""
        if (self.current(checkpoint.workflow_instance_id).id != checkpoint.id
                or checkpoint.status is not WorkflowStatus.SUSPENDED):
            raise WorkflowDispatchRejected('dispatch.current_suspended_checkpoint_required',
                'dispatch no longer owns the current suspended checkpoint')
        try:
            self._workflow_registry.resolve_workflow(checkpoint.workflow_definition_id or '',
                expected_transitive_source_hash=checkpoint.source_hash)
        except RegistryResolutionError as error:
            raise WorkflowDispatchRejected('dispatch.current_source_required',
                'workflow source changed before transport') from error
        current = self._store.snapshot
        if (checkpoint.state_revision != current.revision
                or permit.valid_through_state_revision < current.revision):
            raise WorkflowDispatchRejected('dispatch.current_semantic_revision_required',
                'semantic state or release permit changed before transport')
        world = checkpoint.pending_world_context
        series = bool(checkpoint.workflow_definition_id == 'arc3.continue_declared_action.continue_declared_action'
            and world is not None and world.get('continue_series') is True)
        if (world is None or checkpoint.pre_action_snapshot_digest != permit.pre_action_snapshot_digest
                or (not series and current.state_hash != checkpoint.pre_action_snapshot_digest)):
            raise WorkflowDispatchRejected('dispatch.current_frozen_world_required',
                'dispatch lost its frozen pre-action world')
        if (checkpoint.pending_action_intent_id != intent.id
                or checkpoint.pending_action_release_permit_id != permit.id
                or intent.timeline_id != checkpoint.timeline_id or permit.timeline_id != checkpoint.timeline_id):
            raise WorkflowDispatchRejected('dispatch.exact_intent_and_permit_required',
                'dispatch changed its suspended action or permit')
        try:
            self._store.operational_consciousness.require_continuity_before_action(intent, world)
            responsibility = intent.operational_consciousness.responsibility
            origin = self._store.operational_consciousness.reasoning_context(responsibility.reasoning_context_ref)
            self._workflow_registry.resolve_workflow(origin.source_workflow_ref,
                expected_transitive_source_hash=origin.source_hash)
        except (ValueError, RegistryResolutionError) as error:
            raise WorkflowDispatchRejected('dispatch.current_responsibility_required',
                'dispatch responsibility is detached, superseded or source-stale') from error
        try:
            for use in intent.operational_goal_consumptions:
                self._workflow_registry.resolve_workflow(use.source_workflow_ref,
                    expected_transitive_source_hash=use.source_hash)
            from agents.yf_arc3_v5.state.conscious_goal_consumption import require_current_goal_consumption_evidence
            require_current_goal_consumption_evidence(self._store, intent.operational_goal_consumptions,
                timeline_ref=intent.timeline_id, frame_ref=intent.frame_id)
        except (ValueError, RegistryResolutionError) as error:
            raise WorkflowDispatchRejected('dispatch.current_goal_consumption_dependencies_required',
                'dispatch lost the current source or named evidence of its consumed goal') from error
        lease = permit.concentration_lease
        if (lease is None or self._store.concentration_state(lease.id) is not ConcentrationLeaseState.RELEASED):
            raise WorkflowDispatchRejected('dispatch.released_local_lease_required',
                'dispatch no longer has its released local execution lease')

    def resume(self, request: CausalFrameResumeRequest) -> WorkflowInstanceRecord:
        consumed_record_ids, consumed_action_events = self._consumed_observations()
        if (
            request.observation_record.id in consumed_record_ids
            or request.environment_action_event_ref in consumed_action_events
        ):
            raise DuplicateObservationRejected(request.observation_record.id)
        checkpoint = self.current(request.workflow_instance_id)
        if checkpoint.status is not WorkflowStatus.SUSPENDED:
            raise WorkflowResumeRejected(
                f"workflow is not suspended: {checkpoint.status.value}"
            )
        try:
            self._workflow_registry.resolve_workflow(
                checkpoint.workflow_definition_id or "",
                expected_transitive_source_hash=request.expected_transitive_source_hash,
            )
        except RegistryResolutionError as error:
            raise WorkflowResumeRejected(
                "compiled workflow source is unavailable or stale"
            ) from error
        if request.expected_transitive_source_hash != checkpoint.source_hash:
            raise WorkflowResumeRejected("workflow source changed while suspended")
        if checkpoint.timeline_id != request.timeline_id:
            raise WorkflowResumeRejected("resume timeline does not match suspension")
        if checkpoint.state_revision != self._store.snapshot.revision:
            raise WorkflowResumeRejected("semantic state changed while suspended")
        if checkpoint.pre_action_snapshot_digest is None:
            raise WorkflowResumeRejected("suspension has no pre-action snapshot")
        if checkpoint.pre_action_snapshot_digest != request.pre_action_snapshot_digest:
            raise WorkflowResumeRejected("pre-action snapshot lineage mismatch")
        continue_series = bool(
            checkpoint.workflow_definition_id
            == "arc3.continue_declared_action.continue_declared_action"
            and checkpoint.pending_world_context is not None
            and checkpoint.pending_world_context.get("continue_series") is True
        )
        if (
            not continue_series
            and self._store.snapshot.state_hash
            != checkpoint.pre_action_snapshot_digest
        ):
            raise WorkflowResumeRejected(
                "current semantic snapshot is not the pre-action snapshot"
            )
        if checkpoint.pending_action_intent_id != request.caused_by_action_intent_id:
            raise WorkflowResumeRejected(
                "frame is unrelated to the pending action intent"
            )
        if (
            checkpoint.pending_action_release_permit_id
            != request.action_release_permit_id
        ):
            raise WorkflowResumeRejected(
                "frame is unrelated to the action release permit"
            )
        if checkpoint.frame_id == request.frame_id:
            raise WorkflowResumeRejected(
                "resume requires a new causally associated frame"
            )
        observation = request.observation_record
        if observation.state_revision != self._store.snapshot.revision:
            raise WorkflowResumeRejected(
                "observation was acquired from a stale state revision"
            )
        if observation.workflow_instance_id not in {
            None,
            checkpoint.workflow_instance_id,
        }:
            raise WorkflowResumeRejected("observation belongs to another workflow")
        responsible_intent = self._store.artifact(request.caused_by_action_intent_id)
        if not isinstance(responsible_intent, ActionIntent):
            raise WorkflowResumeRejected("observed return has no canonical responsible intent")
        try:
            operational_return = self._store.operational_consciousness.bind_observed_consequence(
                responsible_intent, observation.id)
        except ValueError as error:
            raise WorkflowResumeRejected(str(error)) from error
        cached_working_state = (
            self._durable_working_state_cache.pop(checkpoint.workflow_instance_id or "", None)
            if continue_series
            else None
        )
        state = (
            cached_working_state[1]
            if cached_working_state is not None
            and cached_working_state[0] == checkpoint.checkpoint_sequence
            else _WorkingState.from_checkpoint(checkpoint)
        )
        assert state.awaiting_frame_binding is not None
        state.bindings[state.awaiting_frame_binding] = observation.raw_input_ref
        state.status = WorkflowStatus.ACTIVE
        state.frame_id = request.frame_id
        state.consumed_observation_refs = tuple(
            sorted((*state.consumed_observation_refs, observation.id))
        )
        state.awaiting_frame_binding = None
        state.pending_expectations = ()
        state.pending_action_intent_id = None
        state.pending_action_release_permit_id = None
        state.pending_environment_adapter_ref = None
        state.pending_world_context = None
        state.pre_action_snapshot_digest = None
        state.suspension_frame_id = None
        next_sequence = checkpoint.checkpoint_sequence + 1
        resumed = self._build_checkpoint(
            checkpoint,
            state,
            self._resolve_checkpoint(checkpoint)[2],
            sequence=next_sequence,
            provenance=(
                checkpoint.id,
                observation.id,
                request.environment_action_event_ref,
            ),
        )
        lifecycle = self._lifecycle(
            checkpoint,
            resumed,
            WorkflowLifecycleKind.RESUMED,
            cause_ref=observation.id,
        )
        action_observed = ActionObservedRecord(
            operational_consciousness_return=operational_return,
            id=f"{request.workflow_instance_id}:action-observed:{next_sequence:08d}",
            source_unit=checkpoint.source_unit,
            source_hash=checkpoint.source_hash,
            state_revision=self._store.snapshot.revision,
            workflow_definition_id=checkpoint.workflow_definition_id,
            workflow_instance_id=checkpoint.workflow_instance_id,
            workflow_step_id=checkpoint.current_step_id,
            timeline_id=checkpoint.timeline_id,
            frame_id=request.frame_id,
            provenance=(
                request.caused_by_action_intent_id,
                request.action_release_permit_id,
                observation.id,
            ),
            action_intent_id=request.caused_by_action_intent_id,
            action_release_permit_id=request.action_release_permit_id,
            environment_action_event_ref=request.environment_action_event_ref,
            observation_record_id=observation.id,
        )
        permit = self._store.artifact(request.action_release_permit_id)
        lease_transition = None
        if (
            isinstance(permit, ActionReleasePermit)
            and permit.concentration_lease is not None
        ):
            lease = permit.concentration_lease
            lease_transition = ConcentrationLeaseTransition(
                id=(
                    f"{lease.id}:observed:"
                    f"{request.caused_by_action_intent_id}"
                ),
                source_unit=checkpoint.source_unit,
                source_hash=checkpoint.source_hash,
                state_revision=self._store.snapshot.revision,
                workflow_definition_id=checkpoint.workflow_definition_id,
                workflow_instance_id=checkpoint.workflow_instance_id,
                workflow_step_id=checkpoint.current_step_id,
                timeline_id=checkpoint.timeline_id,
                frame_id=request.frame_id,
                provenance=(lease.id, action_observed.id),
                concentration_lease_id=lease.id,
                from_state=ConcentrationLeaseState.RELEASED,
                to_state=ConcentrationLeaseState.OBSERVED,
                reason_ref=observation.id,
                action_intent_id=request.caused_by_action_intent_id,
            )
        resume_artifacts = (
            (observation, action_observed, lifecycle, resumed)
            if lease_transition is None
            else (
                observation,
                action_observed,
                lease_transition,
                project_concentration_operation(
                    lease=lease,
                    lineage=lease_transition,
                    operation=ConcentrationOperation.MAINTAIN,
                    reason_ref=observation.id,
                ),
                lifecycle,
                resumed,
            )
        )
        self._commit_scheduler_artifacts(
            resumed,
            artifacts=resume_artifacts,
        )
        return resumed

    def _resolve_checkpoint(
        self,
        checkpoint: WorkflowInstanceRecord,
    ) -> tuple[RegistryEntry, CompiledModule, IrWorkflow]:
        if checkpoint.workflow_definition_id is None:
            raise WorkflowSchedulerError("checkpoint has no workflow definition")
        entry, module, workflow = self._workflow_registry.resolve_workflow(
            checkpoint.workflow_definition_id,
            expected_transitive_source_hash=checkpoint.source_hash,
        )
        if module.source_hash != checkpoint.module_source_hash:
            raise WorkflowSchedulerError("checkpoint module source hash is stale")
        return entry, module, workflow

    def _initial_bindings(
        self,
        workflow: IrWorkflow,
        inputs: FrozenMap,
    ) -> dict[str, object]:
        declared_inputs = {item.name: item for item in workflow.inputs}
        missing = sorted(
            name
            for name, binding in sorted(declared_inputs.items())
            if name not in inputs and not binding.type_spec.optional
        )
        extra = sorted(set(inputs) - set(declared_inputs))
        if missing or extra:
            raise WorkflowSchedulerError(
                f"workflow input mismatch; missing={missing}, extra={extra}"
            )
        bindings: dict[str, object] = {}
        for name, binding in sorted(declared_inputs.items()):
            value = inputs.get(name)
            validate_runtime_type(value, binding.type_spec, f"workflow input {name}")
            bindings[name] = runtime_value(value)
        for binding in (*workflow.outputs, *workflow.state):
            if binding.default is None:
                bindings[binding.name] = None
            else:
                value = evaluate_expression(binding.default, bindings)
                validate_runtime_type(
                    value, binding.type_spec, f"binding {binding.name}"
                )
                bindings[binding.name] = runtime_value(value)
        return bindings

    def _execute_statement(
        self,
        checkpoint: WorkflowInstanceRecord,
        state: _WorkingState,
        workflow: IrWorkflow,
        module: CompiledModule,
        entry: RegistryEntry,
        statement: IrStatement,
    ) -> WorkflowInstanceRecord:
        kind = statement.kind
        if kind is StatementKind.LET:
            assert statement.target and statement.expression
            value = self._evaluate(
                statement.expression,
                checkpoint,
                state,
                module,
                statement.id,
            )
            if statement.type_annotation:
                validate_runtime_type(
                    value, statement.type_annotation, statement.target
                )
            state.bindings[statement.target] = runtime_value(value)
            self._increment_top(state)
            return self._commit_state(
                checkpoint, state, workflow, cause_ref=statement.id
            )
        if kind is StatementKind.CALL:
            assert statement.expression
            value, definition = self._invoke_expression_call(
                statement.expression,
                checkpoint,
                state,
                module,
                statement.id,
            )
            if statement.result_binding:
                validate_runtime_type(
                    value,
                    definition.output_type,
                    f"CALL result {statement.result_binding}",
                )
                state.bindings[statement.result_binding] = runtime_value(value)
            self._increment_top(state)
            return self._commit_state(
                checkpoint, state, workflow, cause_ref=statement.id
            )
        if kind in OPERATOR_STATEMENT_KINDS:
            return self._execute_operator(
                checkpoint,
                state,
                workflow,
                module,
                entry,
                statement,
            )
        if kind is StatementKind.REQUIRE:
            assert statement.expression
            condition = self._evaluate(
                statement.expression,
                checkpoint,
                state,
                module,
                statement.id,
            )
            if condition is not True:
                return self._terminal_checkpoint(
                    checkpoint,
                    state,
                    workflow,
                    cause_ref=statement.id,
                    status=WorkflowStatus.BLOCKED,
                    result=f"blocked:requirement:{statement.id}",
                )
            self._increment_top(state)
            return self._commit_state(
                checkpoint, state, workflow, cause_ref=statement.id
            )
        if kind is StatementKind.IF:
            assert statement.expression
            condition = self._evaluate(
                statement.expression,
                checkpoint,
                state,
                module,
                statement.id,
            )
            if not isinstance(condition, bool):
                raise WorkflowSchedulerError("IF condition did not return Boolean")
            self._increment_top(state)
            selected = statement.body if condition else statement.else_body
            if selected:
                state.stack.append(
                    WorkflowControlFrame(
                        block_kind=(
                            WorkflowBlockKind.BODY
                            if condition
                            else WorkflowBlockKind.ELSE
                        ),
                        owner_id=statement.id,
                    )
                )
            return self._commit_state(
                checkpoint, state, workflow, cause_ref=statement.id
            )
        if kind is StatementKind.MATCH:
            assert statement.expression
            subject = self._evaluate(
                statement.expression,
                checkpoint,
                state,
                module,
                statement.id,
            )
            selected_index = None
            for index, arm in enumerate(statement.match_arms):
                labels = tuple(
                    self._evaluate(label, checkpoint, state, module, statement.id)
                    for label in arm.labels
                )
                if subject in labels:
                    selected_index = index
                    break
            if selected_index is None:
                return self._terminal_checkpoint(
                    checkpoint,
                    state,
                    workflow,
                    cause_ref=statement.id,
                    status=WorkflowStatus.FAILED,
                    result=f"failed:unmatched:{statement.id}",
                )
            self._increment_top(state)
            state.stack.append(
                WorkflowControlFrame(
                    block_kind=WorkflowBlockKind.MATCH_ARM,
                    owner_id=statement.id,
                    control_data=FrozenMap({"arm_index": selected_index}),
                )
            )
            return self._commit_state(
                checkpoint, state, workflow, cause_ref=statement.id
            )
        if kind is StatementKind.FOR_EACH:
            assert statement.expression and statement.iterator
            raw_collection = self._evaluate(
                statement.expression,
                checkpoint,
                state,
                module,
                statement.id,
            )
            if not isinstance(raw_collection, (list, tuple)):
                raise WorkflowSchedulerError("FOR EACH collection is not finite")
            collection = tuple(runtime_value(item) for item in raw_collection)
            if len(collection) > self._max_collection_items:
                return self._terminal_checkpoint(
                    checkpoint,
                    state,
                    workflow,
                    cause_ref=statement.id,
                    status=WorkflowStatus.DEFERRED,
                    result=f"unresolved:collection_limit:{statement.id}",
                )
            self._increment_top(state)
            if collection:
                prior_present = statement.iterator in state.bindings
                prior_value = state.bindings.get(statement.iterator)
                state.bindings[statement.iterator] = collection[0]
                state.stack.append(
                    WorkflowControlFrame(
                        block_kind=WorkflowBlockKind.FOR_EACH,
                        owner_id=statement.id,
                        control_data=FrozenMap(
                            {
                                "collection": collection,
                                "iterator": statement.iterator,
                                "prior_present": prior_present,
                                "prior_value": prior_value,
                            }
                        ),
                    )
                )
            return self._commit_state(
                checkpoint, state, workflow, cause_ref=statement.id
            )
        if kind is StatementKind.WHILE:
            assert statement.expression and statement.loop_contract
            stop = self._evaluate(
                statement.loop_contract.stop_condition,
                checkpoint,
                state,
                module,
                statement.id,
            )
            condition = self._evaluate(
                statement.expression,
                checkpoint,
                state,
                module,
                statement.id,
            )
            if not isinstance(stop, bool) or not isinstance(condition, bool):
                raise WorkflowSchedulerError("WHILE condition/stop must be Boolean")
            self._increment_top(state)
            if condition and not stop:
                witness = self._evaluate(
                    statement.loop_contract.progress_witness,
                    checkpoint,
                    state,
                    module,
                    statement.id,
                )
                state.stack.append(
                    WorkflowControlFrame(
                        block_kind=WorkflowBlockKind.WHILE,
                        owner_id=statement.id,
                        control_data=FrozenMap(
                            {"progress_digest": stable_digest(witness)}
                        ),
                    )
                )
            return self._commit_state(
                checkpoint, state, workflow, cause_ref=statement.id
            )
        if kind is StatementKind.TRANSACTION:
            update_count = self._count_kind(statement.body, StatementKind.UPDATE)
            if update_count != 1:
                return self._terminal_checkpoint(
                    checkpoint,
                    state,
                    workflow,
                    cause_ref=statement.id,
                    status=WorkflowStatus.FAILED,
                    result=f"failed:transaction_requires_one_atomic_update:{statement.id}",
                )
            self._increment_top(state)
            state.stack.append(
                WorkflowControlFrame(
                    block_kind=WorkflowBlockKind.TRANSACTION,
                    owner_id=statement.id,
                )
            )
            return self._commit_state(
                checkpoint, state, workflow, cause_ref=statement.id
            )
        if kind is StatementKind.AWAIT_FRAME:
            if not all(
                (
                    state.pending_action_intent_id,
                    state.pending_action_release_permit_id,
                    state.pending_environment_adapter_ref,
                    state.pre_action_snapshot_digest,
                )
            ):
                return self._terminal_checkpoint(
                    checkpoint,
                    state,
                    workflow,
                    cause_ref=statement.id,
                    status=WorkflowStatus.FAILED,
                    result=f"failed:await_without_action:{statement.id}",
                )
            if state.frame_id is None:
                return self._terminal_checkpoint(
                    checkpoint,
                    state,
                    workflow,
                    cause_ref=statement.id,
                    status=WorkflowStatus.FAILED,
                    result=f"failed:await_without_pre_action_frame:{statement.id}",
                )
            assert statement.expression
            state.awaiting_frame_binding = str(statement.expression.value)
            state.suspension_frame_id = state.frame_id
            state.status = WorkflowStatus.SUSPENDED
            self._increment_top(state)
            return self._commit_state(
                checkpoint,
                state,
                workflow,
                cause_ref=statement.id,
                lifecycle_kind=WorkflowLifecycleKind.SUSPENDED,
            )
        if kind is StatementKind.NEXT:
            assert statement.expression
            target = str(statement.expression.value)
            target_step = self._step_by_short_name(workflow, target)
            from_step = checkpoint.current_step_id
            state.stack = [
                WorkflowControlFrame(
                    block_kind=WorkflowBlockKind.STEP,
                    owner_id=target_step.id,
                )
            ]
            next_checkpoint = self._commit_state(
                checkpoint,
                state,
                workflow,
                cause_ref=statement.id,
                lifecycle_kind=WorkflowLifecycleKind.STEP_CHANGED,
                lifecycle_from_step=from_step,
            )
            return next_checkpoint
        if kind in _TERMINAL_STATUS:
            assert statement.expression
            result = self._evaluate(
                statement.expression,
                checkpoint,
                state,
                module,
                statement.id,
            )
            # Every explicit terminal command owns its exact evaluated value.
            # Internal failures and rejected CALLs use their separate evidence.
            if (statement.expression.kind is ExpressionKind.REFERENCE
                    and isinstance(statement.expression.value, str)
                    and statement.expression.value in state.bindings):
                state.bindings[SRC_TERMINAL_BINDING_REF] = statement.expression.value
            else:
                state.bindings[SRC_TERMINAL_VALUE_BINDING] = runtime_value(result)
                state.bindings[SRC_TERMINAL_BINDING_REF] = SRC_TERMINAL_VALUE_BINDING
            if isinstance(result, str):
                terminal_result = result or "source.return.empty_string"
            else:
                known_reference = self._binding_object_refs.get(id(result))
                value_digest = (known_reference.removeprefix("binding-value:")
                    if known_reference is not None else
                    shared_row_binding_digest(result, "alternative_facts")
                    if isinstance(result, FrozenMap) and "alternative_facts" in result else
                    stable_digest(result))
                # The complete value remains in its canonical Source binding.
                # Qualify this technical label by occurrence and exact value;
                # never retain a recursively expanded repr as a second payload.
                terminal_result = "source.return.value:" + stable_digest((
                    checkpoint.workflow_instance_id, statement.id,
                    state.bindings[SRC_TERMINAL_BINDING_REF], value_digest))[:40]
            return self._terminal_checkpoint(
                checkpoint,
                state,
                workflow,
                cause_ref=statement.id,
                status=_TERMINAL_STATUS[kind],
                result=terminal_result,
                declared_terminal_kind=kind,
            )
        return self._terminal_checkpoint(
            checkpoint,
            state,
            workflow,
            cause_ref=statement.id,
            status=WorkflowStatus.FAILED,
            result=f"failed:unexpanded_statement:{kind.value}",
        )

    def _execute_operator(
        self,
        checkpoint: WorkflowInstanceRecord,
        state: _WorkingState,
        workflow: IrWorkflow,
        module: CompiledModule,
        entry: RegistryEntry,
        statement: IrStatement,
    ) -> WorkflowInstanceRecord:
        operator = _OPERATOR_BY_STATEMENT[statement.kind]
        clauses = FrozenMap.from_frozen_items(
            {
                clause.name: self._evaluate(
                    clause.value,
                    checkpoint,
                    state,
                    module,
                    statement.id,
                )
                for clause in statement.clauses
            }
        )
        assert statement.target
        request_id = (
            f"{checkpoint.workflow_instance_id}:operator:"
            f"{checkpoint.checkpoint_sequence:08d}:{statement.id}"
            f"{_iterative_control_suffix(state.stack)}"
        )
        # The compiler, expression evaluator and explicit runtime-type checks
        # above already validate this internal call envelope.  Avoid recursively
        # validating the entire stable binding graph again for every operator.
        context = OperatorBuildContext.model_construct(
            operational_consciousness=bind_reasoning_operation(
                checkpoint.operational_consciousness_context,
                operation_ref=operator.value, statement_ref=statement.id, frame_ref=state.frame_id,
                declared_question_ref=clauses.get('FOR')),
            request_id=request_id,
            operator=operator,
            statement_kind=statement.kind,
            statement_id=statement.id,
            target_binding=statement.target,
            run_id=self._store.run_id,
            timeline_id=checkpoint.timeline_id or "",
            frame_id=state.frame_id,
            expected_state_revision=self._store.snapshot.revision,
            source_unit=module.module_id,
            source_hash=entry.transitive_source_hash,
            workflow_definition_id=workflow.id,
            workflow_instance_id=checkpoint.workflow_instance_id or "",
            workflow_step_id=checkpoint.current_step_id,
            clauses=clauses,
            local_bindings=FrozenMap.from_frozen_items(state.bindings),
            schema_version="yf_arc3_v5.operator_build_context.v2",
        )
        request = self._runtime_registry.build_operator(context)
        self._validate_built_request(request, context)
        if isinstance(request, ActRequest):
            from agents.yf_arc3_v5.state.invalidation import declared_action_invalidation_sources
            invalidation_sources = declared_action_invalidation_sources(
                self._store, request.intent, request.release_permit)
            defeated = tuple(sorted(invalidation_sources))
            if defeated:
                return self._terminal_checkpoint(
                    checkpoint,
                    state,
                    workflow,
                    cause_ref=invalidation_sources[defeated[0]],
                    status=WorkflowStatus.BLOCKED,
                    result=f"blocked:defeated_action_lineage:{defeated[0]}",
                )
        existing_result = self._operator_result(f"{request_id}:result")
        if existing_result is None:
            dangling = self._operator_invocation(f"{request_id}:invocation")
            if dangling is not None:
                return self._terminal_checkpoint(
                    checkpoint,
                    state,
                    workflow,
                    cause_ref=dangling.id,
                    status=WorkflowStatus.FAILED,
                    result=f"failed:incomplete_operator:{statement.id}",
                )
            execution = self._operators.execute(request)
            result = execution.result
            output = execution.output
        else:
            result = existing_result
            raw_output = result.attributes.get("output")
            if result.attributes.get("output_recovery") == "recompute_pure":
                output = self._operators.replay_pure_output(request, result)
            else:
                output = (
                    None
                    if raw_output is None
                    else _OUTPUT_ADAPTER.validate_python(raw_output)
                )
        if result.status is not OperationStatus.COMPLETED or output is None:
            terminal = (
                WorkflowStatus.BLOCKED
                if result.status is OperationStatus.BLOCKED
                else WorkflowStatus.FAILED
            )
            return self._terminal_checkpoint(
                checkpoint,
                state,
                workflow,
                cause_ref=result.id,
                status=terminal,
                result=f"{terminal.value}:operator:{statement.kind.value}",
            )
        state.bindings[statement.target] = runtime_value(output)
        if isinstance(request, ActRequest):
            if not isinstance(output, ActOutput):
                raise WorkflowSchedulerError("ACT returned a non-action output")
            state.pending_action_intent_id = request.intent.id
            state.pending_action_release_permit_id = request.release_permit.id
            state.pending_environment_adapter_ref = str(clauses["USING"])
            state.pending_world_context = request.world_context
            state.pre_action_snapshot_digest = (
                request.release_permit.pre_action_snapshot_digest
            )
            raw_expectations = clauses.get("EXPECT", ())
            if isinstance(raw_expectations, str):
                state.pending_expectations = (raw_expectations,)
            elif isinstance(raw_expectations, (list, tuple)):
                state.pending_expectations = tuple(
                    sorted(str(item) for item in raw_expectations)
                )
        self._increment_top(state)
        return self._commit_state(
            checkpoint,
            state,
            workflow,
            cause_ref=result.id,
        )

    def _complete_frame(
        self,
        checkpoint: WorkflowInstanceRecord,
        state: _WorkingState,
        workflow: IrWorkflow,
        module: CompiledModule,
        entry: RegistryEntry,
    ) -> WorkflowInstanceRecord:
        frame = state.stack[-1]
        if frame.block_kind is WorkflowBlockKind.STEP:
            return self._terminal_checkpoint(
                checkpoint,
                state,
                workflow,
                cause_ref=frame.owner_id,
                status=WorkflowStatus.FAILED,
                result=f"failed:step_without_transfer:{frame.owner_id}",
            )
        if frame.block_kind in {
            WorkflowBlockKind.BODY,
            WorkflowBlockKind.ELSE,
            WorkflowBlockKind.MATCH_ARM,
            WorkflowBlockKind.TRANSACTION,
        }:
            state.stack.pop()
            return self._commit_state(
                checkpoint,
                state,
                workflow,
                cause_ref=frame.owner_id,
            )
        statement = self._statement_index(workflow)[frame.owner_id]
        if frame.block_kind is WorkflowBlockKind.FOR_EACH:
            collection = tuple(frame.control_data["collection"])
            iterator = str(frame.control_data["iterator"])
            next_iteration = frame.iteration_index + 1
            if next_iteration < len(collection):
                state.bindings[iterator] = collection[next_iteration]
                state.stack[-1] = frame.model_copy(
                    update={
                        "next_statement_index": 0,
                        "iteration_index": next_iteration,
                    }
                )
            else:
                state.stack.pop()
                if frame.control_data["prior_present"]:
                    state.bindings[iterator] = frame.control_data["prior_value"]
                else:
                    state.bindings.pop(iterator, None)
            return self._commit_state(
                checkpoint,
                state,
                workflow,
                cause_ref=frame.owner_id,
            )
        if frame.block_kind is WorkflowBlockKind.WHILE:
            assert statement.loop_contract and statement.expression
            stop = self._evaluate(
                statement.loop_contract.stop_condition,
                checkpoint,
                state,
                module,
                statement.id,
            )
            witness = self._evaluate(
                statement.loop_contract.progress_witness,
                checkpoint,
                state,
                module,
                statement.id,
            )
            if stop is True:
                state.stack.pop()
                return self._commit_state(
                    checkpoint,
                    state,
                    workflow,
                    cause_ref=frame.owner_id,
                )
            witness_digest = stable_digest(witness)
            if witness_digest == frame.control_data["progress_digest"]:
                return self._terminal_checkpoint(
                    checkpoint,
                    state,
                    workflow,
                    cause_ref=frame.owner_id,
                    status=WorkflowStatus.DEFERRED,
                    result=f"unresolved:no_progress:{frame.owner_id}",
                )
            next_iteration = frame.iteration_index + 1
            if next_iteration >= statement.loop_contract.maximum_symbolic_depth:
                limit = self._evaluate(
                    statement.loop_contract.limit_result,
                    checkpoint,
                    state,
                    module,
                    statement.id,
                )
                return self._terminal_checkpoint(
                    checkpoint,
                    state,
                    workflow,
                    cause_ref=frame.owner_id,
                    status=WorkflowStatus.DEFERRED,
                    result=str(limit),
                )
            condition = self._evaluate(
                statement.expression,
                checkpoint,
                state,
                module,
                statement.id,
            )
            if condition is not True:
                state.stack.pop()
            else:
                state.stack[-1] = frame.model_copy(
                    update={
                        "next_statement_index": 0,
                        "iteration_index": next_iteration,
                        "control_data": FrozenMap({"progress_digest": witness_digest}),
                    }
                )
            return self._commit_state(
                checkpoint,
                state,
                workflow,
                cause_ref=frame.owner_id,
            )
        raise WorkflowSchedulerError(
            f"unsupported control frame: {frame.block_kind.value}"
        )

    def _evaluate(
        self,
        expression: IrExpression,
        checkpoint: WorkflowInstanceRecord,
        state: _WorkingState,
        module: CompiledModule,
        statement_id: Ref,
    ) -> object:
        observer = expression_observer()
        complete = (observer(module, checkpoint, statement_id, expression, state.bindings)
                    if observer is not None else None)
        observed_calls: list[object] | None = [] if complete is not None else None

        def call(
            callee: str,
            positional: tuple[object, ...],
            named: FrozenMap,
        ) -> object:
            result = self._invoke_function(
                callee,
                positional,
                named,
                checkpoint,
                state,
                module,
                statement_id,
            )[0]
            if observed_calls is not None:
                observed_calls.append((callee, positional, named, result))
            return result

        try:
            result = evaluate_expression(expression, state.bindings, call=call)
        except Exception as error:
            if complete is not None:
                complete(None, tuple(observed_calls or ()), type(error).__name__)
            raise
        if complete is not None:
            complete(result, tuple(observed_calls or ()), None)
        return result

    def _invoke_expression_call(
        self,
        expression: IrExpression,
        checkpoint: WorkflowInstanceRecord,
        state: _WorkingState,
        module: CompiledModule,
        statement_id: Ref,
    ) -> tuple[object, SymbolDefinition]:
        positional: list[object] = []
        named: dict[str, object] = {}
        for argument in expression.arguments:
            value = self._evaluate(
                argument.value,
                checkpoint,
                state,
                module,
                statement_id,
            )
            if argument.name is None:
                positional.append(value)
            else:
                named[argument.name] = value
        return self._invoke_function(
            str(expression.value),
            tuple(positional),
            FrozenMap(named),
            checkpoint,
            state,
            module,
            statement_id,
        )

    def _invoke_function(
        self,
        callee: str,
        positional: tuple[object, ...],
        named: FrozenMap,
        checkpoint: WorkflowInstanceRecord,
        state: _WorkingState,
        module: CompiledModule,
        statement_id: Ref,
    ) -> tuple[object, SymbolDefinition]:
        # All syntactic call locations share one typed refusal boundary, including
        # argument expressions and loop conditions evaluated during frame return.
        try:
            return self._invoke_function_checked(
                callee, positional, named, checkpoint, state, module, statement_id)
        except (PureCallBlocked, ValidationError, RuntimeTypeError) as error:
            refusal = source_call_refusal(error,
                workflow_instance_ref=checkpoint.workflow_instance_id,
                statement_ref=statement_id, callee_ref=callee,
            )
            raise _SourceInvocationOutcome(refusal) from error
        except PureCallDeferred as error:
            deferral = SourceCallDeferral(
                workflow_instance_ref=checkpoint.workflow_instance_id,
                statement_ref=statement_id, callee_ref=callee,
                detail=str(error)[:2048], child_deferred_checkpoint_ref=error.child_deferred_checkpoint_ref,
                **({'child_reasoning_outcome_ref': error.child_reasoning_outcome_ref}
                   if error.child_reasoning_outcome_ref is not None else {}),
            )
            raise _SourceInvocationOutcome(deferral) from error

    def _invoke_function_checked(
        self,
        callee: str,
        positional: tuple[object, ...],
        named: FrozenMap,
        checkpoint: WorkflowInstanceRecord,
        state: _WorkingState,
        module: CompiledModule,
        statement_id: Ref,
    ) -> tuple[object, SymbolDefinition]:
        cached_attestations = self._module_attestation_indexes.get(module.module_id)
        if cached_attestations is None or cached_attestations[0] is not module:
            cached_attestations = (module, {
                item.authority_id: item for item in module.authority_attestations
            })
            self._module_attestation_indexes[module.module_id] = cached_attestations
        attestations = cached_attestations[1]
        attestation = attestations.get(callee)
        if attestation is None:
            raise WorkflowSchedulerError(f"missing compiled attestation for {callee}")
        registered = self._runtime_registry.resolve_call(
            callee,
            attestation=attestation,
        )
        parameters = registered.definition.parameters
        if len(positional) > len(parameters):
            raise WorkflowSchedulerError(f"too many positional arguments for {callee}")
        arguments = {
            parameter.name: positional[index]
            for index, parameter in enumerate(parameters[: len(positional)])
        }
        for name, value in sorted(named.items()):
            if name in arguments:
                raise WorkflowSchedulerError(f"duplicate runtime argument {name}")
            arguments[name] = value
        definition = registered.definition
        shape = self._call_parameter_shapes.get(definition.id)
        if shape is None or shape[0] is not definition:
            shape = (definition, frozenset(parameter.name for parameter in parameters),
                     frozenset(parameter.name for parameter in parameters if parameter.required))
            self._call_parameter_shapes[definition.id] = shape
        _, expected_names, required_names = shape
        if not required_names.issubset(arguments) or not set(arguments).issubset(
            expected_names
        ):
            raise WorkflowSchedulerError(
                f"runtime call argument mismatch for {callee}: "
                f"required={sorted(required_names)}, "
                f"allowed={sorted(expected_names)}, got={sorted(arguments)}"
            )
        for parameter in parameters:
            if parameter.name not in arguments:
                continue
            validate_runtime_type(
                arguments[parameter.name],
                parameter.type_spec,
                f"argument {parameter.name} for {callee}",
            )
        # This is an in-process scheduler envelope assembled from validated IR
        # and checked arguments.  Full Pydantic reconstruction here made each
        # CALL pay for all unchanged bindings and caused history-shaped latency.
        context = FunctionCallContext.model_construct(
            operational_consciousness=bind_reasoning_operation(
                checkpoint.operational_consciousness_context,
                operation_ref=callee, statement_ref=statement_id, frame_ref=state.frame_id),
            call_id=(
                f"{checkpoint.workflow_instance_id}:call:"
                f"{checkpoint.checkpoint_sequence:08d}:{self._store.snapshot.revision}:{statement_id}:{callee}"
            ),
            callee_ref=callee,
            workflow_definition_id=checkpoint.workflow_definition_id or "",
            workflow_instance_id=checkpoint.workflow_instance_id or "",
            workflow_step_id=checkpoint.current_step_id,
            statement_id=statement_id,
            timeline_id=checkpoint.timeline_id or "",
            frame_id=state.frame_id,
            state_revision=self._store.snapshot.revision,
            arguments=FrozenMap.from_frozen_items(arguments),
            local_bindings=FrozenMap.from_frozen_items(state.bindings),
            schema_version="yf_arc3_v5.function_call_context.v2",
        )
        self._store.operational_consciousness.require_reasoning_execution(
            context.operational_consciousness, run_ref=self._store.run_id,
            timeline_ref=context.timeline_id, frame_ref=context.frame_id,
            workflow_ref=context.workflow_instance_id, source_workflow_ref=context.workflow_definition_id,
            source_hash=checkpoint.source_hash, operation_ref=callee)
        output = runtime_value(registered.implementation(context))
        validate_runtime_type(
            output,
            registered.definition.output_type,
            f"output of {callee}",
        )
        return output, registered.definition

    def _validate_built_request(
        self,
        request: AnyOperatorRequest,
        context: OperatorBuildContext,
    ) -> None:
        expected = {
            "request_id": context.request_id,
            "operational_consciousness": context.operational_consciousness,
            "operator": context.operator,
            "run_id": context.run_id,
            "timeline_id": context.timeline_id,
            "frame_id": context.frame_id,
            "expected_state_revision": context.expected_state_revision,
            "source_unit": context.source_unit,
            "source_hash": context.source_hash,
            "workflow_definition_id": context.workflow_definition_id,
            "workflow_instance_id": context.workflow_instance_id,
            "workflow_step_id": context.workflow_step_id,
        }
        mismatches = [
            name for name, value in sorted(expected.items()) if getattr(request, name) != value
        ]
        if mismatches:
            raise WorkflowSchedulerError(
                f"operator builder changed scheduler lineage: {mismatches}"
            )

    def _commit_state(
        self,
        checkpoint: WorkflowInstanceRecord,
        state: _WorkingState,
        workflow: IrWorkflow,
        *,
        cause_ref: Ref,
        lifecycle_kind: WorkflowLifecycleKind | None = None,
        lifecycle_from_step: Ref | None = None,
        terminal_statement_ref: Ref | None = None,
    ) -> WorkflowInstanceRecord:
        durable_boundary = state.status in {
            WorkflowStatus.SUSPENDED,
            WorkflowStatus.DEFERRED,
            WorkflowStatus.BLOCKED,
            WorkflowStatus.COMPLETED,
            WorkflowStatus.FAILED,
        }
        defer_commit = self._durable_boundaries_only and not durable_boundary
        if defer_commit:
            # The mutable working state already carries the complete in-flight
            # control stack and bindings.  Keep only the lineage fields needed
            # by subsequent local calls; materialize and journal the complete
            # immutable checkpoint once a durable boundary is reached.
            current_step = (
                state.stack[0].owner_id if state.stack else checkpoint.current_step_id
            )
            return checkpoint.model_copy(
                update={
                    "state_revision": self._store.snapshot.revision,
                    "workflow_step_id": current_step,
                    "current_step_id": current_step,
                    "current_statement_id": self._current_statement_id(
                        state.stack, workflow
                    ),
                    "frame_id": state.frame_id,
                }
            )
        sequence = checkpoint.checkpoint_sequence + (0 if defer_commit else 1)
        next_checkpoint = self._build_checkpoint(
            checkpoint,
            state,
            workflow,
            sequence=sequence,
            provenance=(checkpoint.id, cause_ref),
            terminal_statement_ref=terminal_statement_ref,
            materialize_bindings=not defer_commit,
        )
        artifacts: tuple[CognitiveArtifact, ...]
        if lifecycle_kind is None:
            artifacts = (next_checkpoint,)
        else:
            lifecycle = self._lifecycle(
                checkpoint,
                next_checkpoint,
                lifecycle_kind,
                cause_ref=cause_ref,
                from_step_id=lifecycle_from_step,
            )
            artifacts = (lifecycle, next_checkpoint)
        if not defer_commit:
            self._commit_scheduler_artifacts(next_checkpoint, artifacts=artifacts)
        return next_checkpoint

    def _terminal_checkpoint(
        self,
        checkpoint: WorkflowInstanceRecord,
        state: _WorkingState,
        workflow: IrWorkflow,
        *,
        cause_ref: Ref,
        status: WorkflowStatus,
        result: Ref,
        call_refusal: SourceCallRefusal | None = None,
        call_deferral: SourceCallDeferral | None = None,
        technical_failure: SourceTechnicalFailure | None = None,
        declared_terminal_kind: StatementKind | None = None,
    ) -> WorkflowInstanceRecord:
        state.bindings.pop(SRC_CALL_REFUSAL_BINDING_REF, None)
        state.bindings.pop(SRC_CALL_DEFERRAL_BINDING_REF, None)
        state.bindings.pop(SRC_TECHNICAL_FAILURE_BINDING_REF, None)
        if technical_failure is not None:
            if (status is not WorkflowStatus.FAILED or call_refusal is not None
                    or call_deferral is not None or declared_terminal_kind is not None):
                raise ValueError('technical failure requires its distinct failed checkpoint')
            state.bindings[SRC_TECHNICAL_FAILURE_BINDING_REF] = runtime_value(technical_failure)
        if call_deferral is not None:
            if status is not WorkflowStatus.DEFERRED or call_refusal is not None or declared_terminal_kind is not None:
                raise ValueError("a deferred CALL requires its distinct deferred checkpoint")
            state.bindings[SRC_CALL_DEFERRAL_BINDING_REF] = runtime_value(call_deferral)
        state.bindings.pop(SRC_TERMINAL_KIND_BINDING, None)
        if declared_terminal_kind is not None:
            if _TERMINAL_STATUS.get(declared_terminal_kind) is not status:
                raise ValueError("declared terminal kind differs from its checkpoint status")
            state.bindings[SRC_TERMINAL_KIND_BINDING] = declared_terminal_kind.value.lower()
            binding_ref = state.bindings.get(SRC_TERMINAL_BINDING_REF)
            terminal_value = state.bindings.get(binding_ref) if isinstance(binding_ref, str) else None
            if isinstance(terminal_value, (FrozenMap, tuple)):
                # This is the same content-addressed reference sealed below
                # in SourceTerminalBinding. Readers consume that exact value;
                # terminal_result is only its compact diagnostic reference.
                result = f"binding-value:{stable_digest(terminal_value)}"
        else:
            state.bindings.pop(SRC_TERMINAL_BINDING_REF, None)
            state.bindings.pop(SRC_TERMINAL_VALUE_BINDING, None)
        if call_refusal is not None:
            if status is not WorkflowStatus.BLOCKED:
                raise ValueError("a call refusal requires a blocked checkpoint")
            state.bindings[SRC_CALL_REFUSAL_BINDING_REF] = runtime_value(call_refusal)
        terminal_statement_ref = (technical_failure.statement_ref if technical_failure is not None
            else self._current_statement_id(state.stack, workflow))
        state.status = status
        state.stack = []
        state.awaiting_frame_binding = None
        state.pending_expectations = ()
        state.pending_action_intent_id = None
        state.pending_action_release_permit_id = None
        state.pending_environment_adapter_ref = None
        state.pending_world_context = None
        state.pre_action_snapshot_digest = None
        state.suspension_frame_id = None
        state.terminal_result = result
        return self._commit_state(
            checkpoint,
            state,
            workflow,
            cause_ref=cause_ref,
            lifecycle_kind=_TERMINAL_LIFECYCLE[status],
            terminal_statement_ref=terminal_statement_ref,
        )

    def _build_checkpoint(
        self,
        prior: WorkflowInstanceRecord,
        state: _WorkingState,
        workflow: IrWorkflow,
        *,
        sequence: int,
        provenance: tuple[Ref, ...],
        materialize_bindings: bool = True,
        terminal_statement_ref: Ref | None = None,
    ) -> WorkflowInstanceRecord:
        current_step = state.stack[0].owner_id if state.stack else prior.current_step_id
        # Every value below comes from the already validated compiled workflow,
        # the validated prior checkpoint, and the scheduler-owned working state.
        # Re-running the complete Pydantic graph validation after every SRC
        # statement made a continuous cursor progressively pay for large stable
        # bindings.  Imported/persisted records still use normal validation;
        # this hot path only materializes the next immutable delta envelope.
        return WorkflowInstanceRecord.model_construct(
            record_kind="workflow_instance",
            operational_consciousness_context=prior.operational_consciousness_context,
            operational_consciousness_outcome=bind_checkpoint_reasoning_outcome(
                context=prior.operational_consciousness_context,
                record_ref=f"{prior.workflow_instance_id}:checkpoint:{sequence:08d}",
                status=state.status.value, frame_ref=state.frame_id, evidence_refs=provenance),
            id=f"{prior.workflow_instance_id}:checkpoint:{sequence:08d}",
            source_unit=prior.source_unit,
            source_hash=prior.source_hash,
            state_revision=self._store.snapshot.revision,
            workflow_definition_id=prior.workflow_definition_id,
            workflow_instance_id=prior.workflow_instance_id,
            workflow_step_id=current_step,
            timeline_id=prior.timeline_id,
            frame_id=state.frame_id,
            provenance=provenance,
            checkpoint_sequence=sequence,
            status=state.status,
            current_step_id=current_step,
            current_statement_id=self._current_statement_id(state.stack, workflow) or terminal_statement_ref,
            control_stack=tuple(state.stack),
            local_bindings=(
                FrozenMap.from_frozen_items(state.bindings)
                if materialize_bindings
                else prior.local_bindings
            ),
            pending_expectation_refs=state.pending_expectations,
            module_source_hash=prior.module_source_hash,
            awaiting_frame_binding=state.awaiting_frame_binding,
            pending_action_intent_id=state.pending_action_intent_id,
            pending_action_release_permit_id=state.pending_action_release_permit_id,
            pending_environment_adapter_ref=state.pending_environment_adapter_ref,
            pending_world_context=state.pending_world_context,
            pre_action_snapshot_digest=state.pre_action_snapshot_digest,
            suspension_frame_id=state.suspension_frame_id,
            consumed_observation_refs=state.consumed_observation_refs,
            terminal_result=state.terminal_result,
            local_binding_updates=FrozenMap(),
            local_binding_removals=(),
            local_bindings_complete=True,
            schema_version="yf_arc3_v5.workflow_instance.v3",
        )

    def _lifecycle(
        self,
        prior: WorkflowInstanceRecord,
        current: WorkflowInstanceRecord,
        kind: WorkflowLifecycleKind,
        *,
        cause_ref: Ref,
        from_step_id: Ref | None = None,
    ) -> WorkflowLifecycleRecord:
        return WorkflowLifecycleRecord(
            id=(
                f"{current.workflow_instance_id}:lifecycle:"
                f"{current.checkpoint_sequence:08d}"
            ),
            source_unit=current.source_unit,
            source_hash=current.source_hash,
            state_revision=self._store.snapshot.revision,
            workflow_definition_id=current.workflow_definition_id,
            workflow_instance_id=current.workflow_instance_id,
            workflow_step_id=current.current_step_id,
            timeline_id=current.timeline_id,
            frame_id=current.frame_id,
            provenance=(prior.id, cause_ref),
            transition=kind,
            from_step_id=from_step_id or prior.current_step_id,
            to_step_id=current.current_step_id,
            from_status=prior.status,
            to_status=current.status,
            cause_ref=cause_ref,
        )

    def _commit_scheduler_artifacts(
        self,
        checkpoint: WorkflowInstanceRecord,
        *,
        artifacts: tuple[CognitiveArtifact, ...],
    ) -> None:
        journal_items: list[CognitiveArtifact] = []
        pending_binding_values: dict[str, object] = {}
        for item in artifacts:
            if isinstance(item, WorkflowLifecycleRecord):
                # The canonical checkpoint already records status, step and
                # lineage. No runtime consumer reads this duplicate audit row.
                continue
            if not isinstance(item, WorkflowInstanceRecord):
                journal_items.append(item)
                continue
            compact = self._checkpoint_delta(item)
            externalized, value_records = self._externalize_checkpoint_bindings(
                compact,
                pending_binding_values=pending_binding_values,
                terminal_checkpoint=item,
            )
            journal_items.extend(value_records)
            journal_items.append(externalized)
        if self._dynamic_workflow_shadow is not None:
            journal_items.append(self._dynamic_workflow_shadow.observe(checkpoint))
        if self._dynamic_workflow_runtime is not None:
            dynamic_record = self._dynamic_workflow_runtime.observe(checkpoint)
            if dynamic_record is not None:
                journal_items.append(dynamic_record)
        journal_artifacts = tuple(journal_items)
        self._store.commit(
            TransactionRequest(
                transaction_id=(
                    f"{checkpoint.workflow_instance_id}:scheduler:"
                    f"{checkpoint.checkpoint_sequence:08d}"
                ),
                run_id=self._store.run_id,
                timeline_id=checkpoint.timeline_id or "",
                frame_id=checkpoint.frame_id,
                source_hash=checkpoint.source_hash,
                expected_revision=self._store.snapshot.revision,
                mutations=tuple(
                    RecordArtifact(artifact=item) for item in journal_artifacts
                ),
            )
        )
        if checkpoint.workflow_instance_id:
            if checkpoint.workflow_instance_id not in self._current_checkpoints:
                self._workflow_instance_order.append(checkpoint.workflow_instance_id)
            self._current_checkpoints[checkpoint.workflow_instance_id] = checkpoint
            self._current_workflow_tuple_cache = None
        for reference, value in sorted(pending_binding_values.items()):
            self._binding_values[reference] = value
            self._binding_object_refs[id(value)] = reference

    def _checkpoint_delta(
        self,
        checkpoint: WorkflowInstanceRecord,
    ) -> WorkflowInstanceRecord:
        """Journal only changed bindings after the first durable checkpoint."""

        try:
            prior = self.current(checkpoint.workflow_instance_id or "")
        except WorkflowInstanceNotFound:
            return checkpoint
        prior_bindings = prior.local_bindings
        current_bindings = checkpoint.local_bindings
        updates = {
            name: value
            for name, value in sorted(current_bindings.items())
            if name not in prior_bindings
            or (
                prior_bindings[name] is not value
                and prior_bindings[name] != value
            )
        }
        removals = tuple(
            sorted(name for name in prior_bindings if name not in current_bindings)
        )
        return checkpoint.model_copy(
            update={
                "local_bindings": FrozenMap(),
                "local_binding_updates": FrozenMap(updates),
                "local_binding_removals": removals,
                "local_bindings_complete": False,
            }
        )

    def _ensure_binding_values(self) -> None:
        if self._binding_values_loaded:
            return
        for artifact in self._store.artifacts_of_type(WorkflowBindingValueRecord):
            assert isinstance(artifact, WorkflowBindingValueRecord)
            value = artifact.payload["value"]
            self._binding_values[artifact.id] = value
            self._binding_object_refs[id(value)] = artifact.id
        self._binding_values_loaded = True

    def _materialize_binding_map(self, values: FrozenMap) -> dict[str, object]:
        return {
            name: self._materialize_binding_value(value)
            for name, value in sorted(values.items())
        }

    def _materialize_binding_value(self, value: object) -> object:
        if (
            isinstance(value, FrozenMap)
            and set(value) == {"$binding_value_ref"}
        ):
            reference = str(value["$binding_value_ref"])
            try:
                return self._binding_values[reference]
            except KeyError as error:
                raise WorkflowSchedulerError(
                    f"missing content-addressed binding value: {reference}"
                ) from error
        return value

    def _externalize_checkpoint_bindings(
        self,
        checkpoint: WorkflowInstanceRecord,
        *,
        pending_binding_values: dict[str, object],
        terminal_checkpoint: WorkflowInstanceRecord | None = None,
    ) -> tuple[WorkflowInstanceRecord, tuple[WorkflowBindingValueRecord, ...]]:
        records: list[WorkflowBindingValueRecord] = []
        local_object_refs: dict[int, str] = {}

        def externalize(value: object, *, force_reference: bool = False) -> object:
            object_id = id(value)
            known_reference = self._binding_object_refs.get(
                object_id
            ) or local_object_refs.get(object_id)
            if known_reference is not None:
                return FrozenMap({"$binding_value_ref": known_reference})
            if not force_reference and not _is_large_binding_value(value):
                return value
            digest = (shared_row_binding_digest(value, "alternative_facts")
                      if isinstance(value, FrozenMap) and "alternative_facts" in value
                      else stable_digest(value))
            reference = f"binding-value:{digest}"
            local_object_refs[object_id] = reference
            if reference not in self._binding_values and reference not in pending_binding_values:
                # The value digest was computed from this exact immutable
                # object immediately above.  Construct the hot-path envelope
                # directly; imported journals still perform full validation.
                record = WorkflowBindingValueRecord.model_construct(
                    id=reference,
                    source_unit=checkpoint.source_unit,
                    source_hash=checkpoint.source_hash,
                    state_revision=checkpoint.state_revision,
                    workflow_definition_id=checkpoint.workflow_definition_id,
                    workflow_instance_id=checkpoint.workflow_instance_id,
                    workflow_step_id=checkpoint.workflow_step_id,
                    timeline_id=checkpoint.timeline_id,
                    frame_id=checkpoint.frame_id,
                    provenance=(checkpoint.id,),
                    value_digest=digest,
                    payload=FrozenMap({"value": value}),
                )
                records.append(record)
                pending_binding_values[reference] = value
            return FrozenMap({"$binding_value_ref": reference})

        terminal_binding = None
        if terminal_checkpoint is not None:
            kind, binding_name, value = None, None, None
            declared_kind = terminal_checkpoint.local_bindings.get(SRC_TERMINAL_KIND_BINDING)
            if declared_kind is not None:
                kind = declared_kind
                binding_name = terminal_checkpoint.local_bindings[SRC_TERMINAL_BINDING_REF]
                value = read_source_terminal_value(terminal_checkpoint)
            elif terminal_checkpoint.status is WorkflowStatus.BLOCKED:
                refusal = read_source_refusal(terminal_checkpoint)
                if refusal is not None:
                    kind, binding_name = "call_refusal", SRC_CALL_REFUSAL_BINDING_REF
                    value = terminal_checkpoint.local_bindings[binding_name]
            elif terminal_checkpoint.status is WorkflowStatus.DEFERRED:
                deferral = read_source_deferral(terminal_checkpoint)
                if deferral is not None:
                    kind, binding_name = "call_deferral", SRC_CALL_DEFERRAL_BINDING_REF
                    value = terminal_checkpoint.local_bindings[binding_name]
            elif terminal_checkpoint.status is WorkflowStatus.FAILED:
                value = terminal_checkpoint.local_bindings.get(SRC_TECHNICAL_FAILURE_BINDING_REF)
                if value is not None:
                    kind, binding_name = 'technical_failure', SRC_TECHNICAL_FAILURE_BINDING_REF
            if kind is not None:
                reference = externalize(value, force_reference=True)["$binding_value_ref"]
                terminal_binding = SourceTerminalBinding(kind=kind, binding_ref=binding_name,
                    value_ref=reference, value_digest=reference.removeprefix("binding-value:"))

        complete = FrozenMap(
            {name: externalize(value) for name, value in sorted(checkpoint.local_bindings.items())}
        )
        updates = FrozenMap(
            {
                name: externalize(value)
                for name, value in sorted(checkpoint.local_binding_updates.items())
            }
        )
        return (
            checkpoint.model_copy(
                update={
                    "local_bindings": complete,
                    "local_binding_updates": updates,
                    "source_terminal_binding": terminal_binding,
                }
            ),
            tuple(records),
        )

    def _frame_statements(
        self,
        frame: WorkflowControlFrame,
        workflow: IrWorkflow,
    ) -> tuple[IrStatement, ...]:
        if frame.block_kind is WorkflowBlockKind.STEP:
            return self._step_index(workflow)[frame.owner_id].statements
        owner = self._statement_index(workflow)[frame.owner_id]
        if frame.block_kind in {
            WorkflowBlockKind.BODY,
            WorkflowBlockKind.FOR_EACH,
            WorkflowBlockKind.WHILE,
            WorkflowBlockKind.TRANSACTION,
        }:
            return owner.body
        if frame.block_kind is WorkflowBlockKind.ELSE:
            return owner.else_body
        if frame.block_kind is WorkflowBlockKind.MATCH_ARM:
            arm_index = int(frame.control_data["arm_index"])
            return (owner.match_arms[arm_index].transition,)
        raise WorkflowSchedulerError(f"unknown block kind: {frame.block_kind.value}")

    def _current_statement_id(
        self,
        stack: list[WorkflowControlFrame] | tuple[WorkflowControlFrame, ...],
        workflow: IrWorkflow,
    ) -> Ref | None:
        if not stack:
            return None
        frame = stack[-1]
        statements = self._frame_statements(frame, workflow)
        if frame.next_statement_index >= len(statements):
            return None
        return statements[frame.next_statement_index].id

    def _step_index(self, workflow: IrWorkflow) -> dict[Ref, IrStep]:
        return {step.id: step for step in workflow.steps}

    def _statement_index(self, workflow: IrWorkflow) -> dict[Ref, IrStatement]:
        cached = self._statement_indexes.get(workflow.id)
        if cached is not None and cached[0] is workflow:
            return cached[1]
        result: dict[Ref, IrStatement] = {}

        def add(statement: IrStatement) -> None:
            result[statement.id] = statement
            for arm in statement.match_arms:
                add(arm.transition)
            for nested in (*statement.body, *statement.else_body):
                add(nested)

        for step in workflow.steps:
            for statement in step.statements:
                add(statement)
        self._statement_indexes[workflow.id] = (workflow, result)
        return result

    def _step_by_short_name(self, workflow: IrWorkflow, short_name: str) -> IrStep:
        expected = f"{workflow.id}.{short_name}"
        step = self._step_index(workflow).get(expected)
        if step is None:
            raise WorkflowSchedulerError(f"unknown NEXT step: {short_name}")
        return step

    def _increment_top(self, state: _WorkingState) -> None:
        frame = state.stack[-1]
        state.stack[-1] = frame.model_copy(
            update={"next_statement_index": frame.next_statement_index + 1}
        )

    def _count_kind(
        self,
        statements: tuple[IrStatement, ...],
        kind: StatementKind,
    ) -> int:
        count = 0
        for statement in statements:
            count += int(statement.kind is kind)
            count += self._count_kind(
                (*statement.body, *statement.else_body),
                kind,
            )
            count += sum(
                self._count_kind((arm.transition,), kind)
                for arm in statement.match_arms
            )
        return count

    def _artifacts(self) -> Sequence[CognitiveArtifact]:
        return self._store.artifacts

    def _operator_result(self, result_id: Ref) -> OperatorResult | None:
        artifact = self._store.artifact(result_id)
        return artifact if isinstance(artifact, OperatorResult) else None

    def _operator_invocation(self, invocation_id: Ref) -> OperatorInvocation | None:
        artifact = self._store.artifact(invocation_id)
        return artifact if isinstance(artifact, OperatorInvocation) else None

    def _operator_recovery_revision_matches(
        self,
        checkpoint: WorkflowInstanceRecord,
        workflow: IrWorkflow,
    ) -> bool:
        if not checkpoint.control_stack:
            return False
        statement_id = self._current_statement_id(checkpoint.control_stack, workflow)
        if statement_id is None:
            return False
        statement = self._statement_index(workflow)[statement_id]
        if statement.kind is not StatementKind.UPDATE:
            return False
        request_id = (
            f"{checkpoint.workflow_instance_id}:operator:"
            f"{checkpoint.checkpoint_sequence:08d}:{statement.id}"
            f"{_iterative_control_suffix(checkpoint.control_stack)}"
        )
        invocation = self._operator_invocation(f"{request_id}:invocation")
        result = self._operator_result(f"{request_id}:result")
        return bool(
            invocation
            and result
            and invocation.operator is OperatorName.UPDATE
            and result.operator is OperatorName.UPDATE
            and invocation.source_hash == checkpoint.source_hash
            and result.source_hash == checkpoint.source_hash
            and result.state_revision == self._store.snapshot.revision
        )

    def _consumed_observations(self) -> tuple[set[Ref], set[Ref]]:
        artifacts = self._store.artifacts_of_type(ActionObservedRecord)
        records = {
            artifact.observation_record_id
            for artifact in artifacts
            if isinstance(artifact, ActionObservedRecord)
        }
        action_events = {
            artifact.environment_action_event_ref
            for artifact in artifacts
            if isinstance(artifact, ActionObservedRecord)
        }
        return records, action_events

    def _invalidation_sources(self) -> dict[Ref, Ref]:
        return self._store.source_invalidation_sources()
