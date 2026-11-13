"""Exact transport of the value selected by SRC STOP, without meaning inference."""
from __future__ import annotations
from collections.abc import Mapping

from agents.yf_arc3_v5.logos.operations import WorkflowInstanceRecord, WorkflowStatus, ActionPreparationRefusal, WorkflowBindingValueRecord, OperatorResult, OperationStatus
from agents.yf_arc3_v5.logos.source_completion import SourceCallRefusal, SourceCallDeferral, SourceDeferralEvidence, SourceCheckpointReceipt, ParentRevalidationReturn, SourceFailureEvidence
from agents.yf_arc3_v5.scheduler.contracts import SRC_TERMINAL_BINDING_REF, SRC_TERMINAL_KIND_BINDING, SRC_CALL_REFUSAL_BINDING_REF, SRC_CALL_DEFERRAL_BINDING_REF
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest, immutable_json_data
from agents.yf_arc3_v5.logos.source_completion import SourceTechnicalFailure
from agents.yf_arc3_v5.scheduler.contracts import SRC_TECHNICAL_FAILURE_BINDING_REF


def _canonical_checkpoint(checkpoint, store):
    canonical = store.artifact(checkpoint.id)
    if (not isinstance(canonical, WorkflowInstanceRecord)
            or any(getattr(canonical, field) != getattr(checkpoint, field) for field in (
                "workflow_instance_id", "workflow_definition_id", "source_hash", "module_source_hash",
                "timeline_id", "frame_id", "state_revision", "status", "current_statement_id",
                "checkpoint_sequence", "provenance", "operational_consciousness_context",
                "operational_consciousness_outcome"))
            or (checkpoint.source_terminal_binding is not None
                and checkpoint.source_terminal_binding != canonical.source_terminal_binding)):
        raise SourceReturnContractError("Source view differs from its canonical checkpoint")
    if canonical.operational_consciousness_outcome is not None:
        try:
            store.operational_consciousness.require_reasoning_outcome(canonical.operational_consciousness_outcome)
        except ValueError as error:
            raise SourceReturnContractError(str(error)) from error
    return canonical


def _read_terminal_binding(checkpoint, store, kind):
    binding = checkpoint.source_terminal_binding
    if binding is None or binding.kind != kind:
        raise SourceReturnContractError("checkpoint lacks its typed durable terminal binding")
    canonical = store.artifact(checkpoint.id)
    if (not isinstance(canonical, WorkflowInstanceRecord) or canonical.source_terminal_binding != binding
            or any(getattr(canonical, field) != getattr(checkpoint, field) for field in (
                'workflow_instance_id', 'workflow_definition_id', 'source_hash', 'module_source_hash',
                'timeline_id', 'frame_id', 'state_revision', 'status'))):
        raise SourceReturnContractError("terminal binding differs from its canonical checkpoint")
    value = store.artifact(binding.value_ref)
    if (not isinstance(value, WorkflowBindingValueRecord) or value.value_digest != binding.value_digest
            or value.id != 'binding-value:' + binding.value_digest
            or stable_digest(value.payload['value']) != binding.value_digest):
        raise SourceReturnContractError("terminal binding lacks its exact canonical value")
    return value.payload['value']


def read_source_refusal(checkpoint: WorkflowInstanceRecord, *, store=None) -> SourceCallRefusal | None:
    """Read an explicit rejected CALL without parsing its display message."""
    if store is not None:
        checkpoint = _canonical_checkpoint(checkpoint, store)
    terminal = checkpoint.source_terminal_binding
    if store is not None and terminal is not None and terminal.kind == 'call_refusal':
        if terminal.binding_ref != SRC_CALL_REFUSAL_BINDING_REF:
            raise SourceReturnContractError("durable refusal differs from its Source binding")
        raw = _read_terminal_binding(checkpoint, store, 'call_refusal')
    else:
        raw = checkpoint.local_bindings.get(SRC_CALL_REFUSAL_BINDING_REF)
    if raw is None:
        return None
    refusal = SourceCallRefusal.model_validate(raw)
    if (checkpoint.status is not WorkflowStatus.BLOCKED
            or refusal.workflow_instance_ref != checkpoint.workflow_instance_id
            or refusal.statement_ref != checkpoint.current_statement_id):
        raise SourceReturnContractError("call refusal differs from its blocked source owner")
    return refusal


def read_source_technical_failure(checkpoint: WorkflowInstanceRecord, *, store=None) -> SourceTechnicalFailure | None:
    """Read a durable technical cause without interpreting it as a repair instruction."""
    if store is not None:
        checkpoint = _canonical_checkpoint(checkpoint, store)
    terminal = checkpoint.source_terminal_binding
    if store is not None and terminal is not None and terminal.kind == 'technical_failure':
        if terminal.binding_ref != SRC_TECHNICAL_FAILURE_BINDING_REF:
            raise SourceReturnContractError('technical failure differs from its durable binding')
        raw = _read_terminal_binding(checkpoint, store, 'technical_failure')
    else:
        raw = checkpoint.local_bindings.get(SRC_TECHNICAL_FAILURE_BINDING_REF)
    if raw is None:
        return None
    failure = SourceTechnicalFailure.model_validate(raw)
    if (checkpoint.status is not WorkflowStatus.FAILED
            or failure.workflow_instance_ref != checkpoint.workflow_instance_id
            or failure.statement_ref != checkpoint.current_statement_id):
        raise SourceReturnContractError('technical failure differs from its failed source owner')
    return failure


def read_source_deferral(checkpoint: WorkflowInstanceRecord, *, store=None) -> SourceCallDeferral | None:
    """Read a CALL wait from its exact durable binding, never its message."""
    if store is not None:
        checkpoint = _canonical_checkpoint(checkpoint, store)
    terminal = checkpoint.source_terminal_binding
    if store is not None and terminal is not None and terminal.kind == "call_deferral":
        if terminal.binding_ref != SRC_CALL_DEFERRAL_BINDING_REF:
            raise SourceReturnContractError("durable deferral differs from its Source binding")
        raw = _read_terminal_binding(checkpoint, store, "call_deferral")
    else:
        raw = checkpoint.local_bindings.get(SRC_CALL_DEFERRAL_BINDING_REF)
    if raw is None:
        return None
    deferral = SourceCallDeferral.model_validate(raw)
    if (checkpoint.status is not WorkflowStatus.DEFERRED
            or deferral.workflow_instance_ref != checkpoint.workflow_instance_id
            or deferral.statement_ref != checkpoint.current_statement_id):
        raise SourceReturnContractError("call deferral differs from its Source owner")
    return deferral


def read_source_deferral_evidence(checkpoint: WorkflowInstanceRecord, *, store) -> SourceDeferralEvidence:
    """Follow mixed interpreted/compiled waits without inventing readiness."""
    from agents.yf_arc3_v5.logos.operations import OperationalConsciousnessReasoningCallDeferralRecord
    current, visited, refs, outcomes = checkpoint, set(), [], []
    missing = "source_deferral.checkpoint_missing"

    def evidence(**fields):
        return SourceDeferralEvidence(root_checkpoint_ref=checkpoint.id, checkpoint_refs=tuple(refs),
            **({'reasoning_outcome_refs': tuple(outcomes)} if outcomes else {}), **fields)

    while isinstance(current, (WorkflowInstanceRecord, OperationalConsciousnessReasoningCallDeferralRecord)):
        if current.id in visited:
            missing = "source_deferral.cyclic_checkpoint_link"
            break
        visited.add(current.id)
        try:
            if current.timeline_id != checkpoint.timeline_id or current.frame_id != checkpoint.frame_id:
                missing = "source_deferral.child_boundary_differs"
                break
            if isinstance(current, WorkflowInstanceRecord):
                current = _canonical_checkpoint(current, store)
                if current.status is not WorkflowStatus.DEFERRED:
                    missing = 'source_deferral.child_not_deferred'
                    break
                refs.append(current.id)
                context = current.operational_consciousness_context
                deferral = read_source_deferral(current, store=store)
            else:
                if store.artifact(current.id) != current:
                    raise ValueError('compiled deferral is not canonical')
                returned = current.operational_consciousness
                store.operational_consciousness.require_reasoning_return(returned)
                store.operational_consciousness.require_reasoning_outcome(returned.outcome)
                outcomes.append(current.id)
                context, deferral = returned.context, current.call_deferral
            if deferral is not None:
                child_ref = deferral.child_reasoning_outcome_ref or deferral.child_deferred_checkpoint_ref
                if child_ref is None:
                    return evidence(cause_kind="call_deferral", cause_ref=current.id,
                        statement_ref=deferral.statement_ref)
                child = store.artifact(child_ref)
                expected = (OperationalConsciousnessReasoningCallDeferralRecord
                    if deferral.child_reasoning_outcome_ref is not None else WorkflowInstanceRecord)
                if not isinstance(child, expected) or child.state_revision > current.state_revision:
                    missing = "source_deferral.child_checkpoint_missing_or_newer"
                    break
                if isinstance(child, OperationalConsciousnessReasoningCallDeferralRecord):
                    entry = store.operational_consciousness.compiled_entry(child.operational_consciousness.entry_ref)
                    origin = entry.initiating_operation if entry is not None else None
                    linked = (origin is not None and origin.context == context
                        and origin.statement_ref == deferral.statement_ref and origin.operation_ref == deferral.callee_ref)
                else:
                    child_context = child.operational_consciousness_context
                    linked = (context is not None and child_context is not None
                        and child_context.parent_context_ref == context.context_ref
                        and child_context.composition_edge_ref == deferral.statement_ref)
                if not linked:
                    missing = 'source_deferral.child_has_another_recipient'
                    break
                current = child
                continue
            if current.source_terminal_binding is not None and current.source_terminal_binding.kind == "defer":
                value = read_source_terminal_value(current, store=store)
                return evidence(cause_kind="source_terminal", cause_ref=current.id, statement_ref=current.current_statement_id,
                    declared_terminal_value=value)
            missing = "source_deferral.terminal_cause_unresolved"
            break
        except ValueError:
            missing = "source_deferral.canonical_evidence_invalid"
            break
    return evidence(cause_kind="unresolved", missing_refs=(missing,))


class SourceReturnContractError(ValueError):
    """The producer did not supply a consumable Source return binding."""


def _canonical_refused_child(caller, refusal, store):
    """Resolve one exact CALL edge; executor type does not change its lineage."""
    from agents.yf_arc3_v5.logos.operations import (
        OperationalConsciousnessReasoningRefusalRecord,
        OperationalConsciousnessReasoningCallRefusalRecord,
    )
    context = (caller.operational_consciousness_context if isinstance(caller, WorkflowInstanceRecord)
        else caller.operational_consciousness.context)
    child_ref = refusal.child_reasoning_outcome_ref or refusal.child_failure_checkpoint_ref
    if child_ref is None:
        raise ValueError('source_failure.child_cause_not_retained')
    child = store.artifact(child_ref)
    expected = ((OperationalConsciousnessReasoningRefusalRecord, OperationalConsciousnessReasoningCallRefusalRecord)
        if refusal.child_reasoning_outcome_ref is not None else (WorkflowInstanceRecord,))
    if (not isinstance(child, expected) or child.state_revision > caller.state_revision
            or child.timeline_id != caller.timeline_id or child.frame_id != caller.frame_id):
        raise ValueError('source_failure.child_missing_newer_or_out_of_scope')
    if refusal.child_reasoning_outcome_ref is not None:
        entry = store.operational_consciousness.compiled_entry(child.operational_consciousness.entry_ref)
        origin = entry.initiating_operation if entry is not None else None
        if (origin is None or origin.context != context
                or origin.statement_ref != refusal.statement_ref or origin.operation_ref != refusal.callee_ref):
            raise ValueError('source_failure.compiled_outcome_has_another_recipient')
    else:
        child_context = child.operational_consciousness_context
        if (context is None or child_context is None
                or child_context.parent_context_ref != context.context_ref
                or child_context.composition_edge_ref != refusal.statement_ref):
            raise ValueError('source_failure.child_checkpoint_has_another_recipient')
    return child


def read_source_failure_evidence(checkpoint: WorkflowInstanceRecord, *, store) -> SourceFailureEvidence:
    """Follow exact durable failure links; unknown or cyclic links stay explicit."""
    from agents.yf_arc3_v5.logos.operations import (
        OperationalConsciousnessReasoningRefusalRecord, OperationalConsciousnessReasoningCallRefusalRecord,
    )
    current, visited, refs, outcomes = checkpoint, set(), [], []
    missing = "source_failure.checkpoint_missing"

    def evidence(**fields):
        extra = fields.pop('reasoning_outcome_refs', ())
        return SourceFailureEvidence(root_checkpoint_ref=checkpoint.id, checkpoint_refs=tuple(refs),
            reasoning_outcome_refs=(*outcomes, *extra), **fields)

    while isinstance(current, (WorkflowInstanceRecord, OperationalConsciousnessReasoningRefusalRecord,
                               OperationalConsciousnessReasoningCallRefusalRecord)):
        if current.id in visited:
            missing = "source_failure.cyclic_checkpoint_link"
            break
        visited.add(current.id)
        canonical = store.artifact(current.id) if store is not None else None
        if not isinstance(current, WorkflowInstanceRecord):
            if (canonical != current or current.timeline_id != checkpoint.timeline_id
                    or current.frame_id != checkpoint.frame_id):
                missing = 'source_failure.compiled_outcome_missing_or_out_of_scope'
                break
            returned = current.operational_consciousness
            try:
                store.operational_consciousness.require_reasoning_return(returned)
                store.operational_consciousness.require_reasoning_outcome(returned.outcome)
            except ValueError:
                missing = 'source_failure.compiled_outcome_not_canonical'
                break
            outcomes.append(current.id)
            if isinstance(current, OperationalConsciousnessReasoningRefusalRecord):
                return evidence(cause_kind='call_refusal', cause_ref=current.id, cause_status='blocked',
                    statement_ref=returned.operations[-1].statement_ref, cause_operator_ref='SELECT',
                    reason_refs=tuple(current.selection_result['reason_refs']),
                    selection_refusal=current.selection_result)
            refusal = current.call_refusal
            if current.direct_call_operation is not None:
                return evidence(cause_kind='call_refusal', cause_ref=current.id, cause_status='blocked',
                    statement_ref=refusal.statement_ref, reason_refs=refusal.cause_reason_refs(), call_refusal=refusal)
            if refusal.reasoning_entry_refusal is not None:
                return evidence(cause_kind='call_refusal', cause_ref=current.id, cause_status='blocked',
                    statement_ref=refusal.statement_ref, reason_refs=refusal.cause_reason_refs(),
                    call_refusal=refusal)
            try:
                current = _canonical_refused_child(current, refusal, store)
            except ValueError as error:
                missing = str(error)
                break
            continue
        if not isinstance(canonical, WorkflowInstanceRecord) or any(
            getattr(canonical, field) != getattr(current, field) for field in (
                "workflow_instance_id", "workflow_definition_id", "source_hash",
                "timeline_id", "frame_id", "state_revision", "status", "current_statement_id")
        ):
            missing = "source_failure.canonical_checkpoint_differs"
            break
        if (canonical.status not in (WorkflowStatus.BLOCKED, WorkflowStatus.FAILED)
                or canonical.timeline_id != checkpoint.timeline_id
                or canonical.frame_id != checkpoint.frame_id):
            missing = "source_failure.child_boundary_differs"
            break
        refs.append(canonical.id)
        from agents.yf_arc3_v5.state.conscious_response_reconciliation import (
            response_reconciliation_for_checkpoint, require_reconciled_response_checkpoint,
        )
        response_receipt = response_reconciliation_for_checkpoint(canonical, store=store)
        if response_receipt is not None:
            causal_refusal = store.artifact(response_receipt.refusal_ref)
            try:
                require_reconciled_response_checkpoint(canonical, store.artifact(causal_refusal.checkpoint_ref),
                    consciousness=store.operational_consciousness, store=store)
            except ValueError:
                missing = 'source_failure.response_reconciliation_invalid'
                break
            return evidence(
                cause_kind='causal_resume_refusal', cause_ref=causal_refusal.id, cause_status='blocked',
                statement_ref=canonical.current_statement_id, reason_refs=(causal_refusal.refusal_type_ref,),
                causal_evidence_refs=(response_receipt.id, response_receipt.observed_action_ref))
        from agents.yf_arc3_v5.logos.operations import OperationalConsciousnessDispatchRetirementRecord
        from agents.yf_arc3_v5.state.conscious_dispatch_refusal import dispatch_retirement_for_checkpoint
        retirement = dispatch_retirement_for_checkpoint(canonical, store=store)
        if isinstance(retirement, OperationalConsciousnessDispatchRetirementRecord):
            from agents.yf_arc3_v5.state.conscious_dispatch_refusal import require_retired_dispatch_checkpoint
            refusal = store.artifact(retirement.refusal_ref)
            prior = store.artifact(refusal.checkpoint_ref)
            try:
                require_retired_dispatch_checkpoint(canonical, prior,
                    consciousness=store.operational_consciousness, store=store)
            except ValueError:
                missing = 'source_failure.dispatch_retirement_invalid'
                break
            return evidence(
                cause_kind='dispatch_refusal', cause_ref=refusal.id, cause_status='blocked',
                statement_ref=canonical.current_statement_id, reason_refs=(refusal.refusal_reason_ref,),
                causal_evidence_refs=(retirement.id,))
        try:
            technical = read_source_technical_failure(canonical, store=store)
        except ValueError:
            missing = 'source_failure.canonical_technical_failure_invalid'
            break
        if technical is not None:
            if technical.child_reasoning_outcome_ref is not None:
                from agents.yf_arc3_v5.logos.operations import OperationalConsciousnessReasoningFailureRecord
                child = store.artifact(technical.child_reasoning_outcome_ref)
                if (not isinstance(child, OperationalConsciousnessReasoningFailureRecord)
                        or child.state_revision > canonical.state_revision
                        or child.exception_type_ref != technical.exception_type_ref
                        or child.timeline_id != canonical.timeline_id or child.frame_id != canonical.frame_id):
                    missing = 'source_failure.compiled_technical_origin_missing_or_out_of_scope'
                    break
                returned = child.operational_consciousness
                entry = store.operational_consciousness.compiled_entry(returned.entry_ref)
                origin = entry.initiating_operation if entry is not None else None
                if (origin is None or origin.context != canonical.operational_consciousness_context
                        or origin.statement_ref != technical.statement_ref):
                    missing = 'source_failure.compiled_technical_origin_has_another_recipient'
                    break
                try:
                    store.operational_consciousness.require_reasoning_return(returned)
                    store.operational_consciousness.require_reasoning_outcome(returned.outcome)
                except ValueError:
                    missing = 'source_failure.compiled_technical_origin_not_canonical'
                    break
                return evidence(
                    reasoning_outcome_refs=(child.id,), cause_kind='technical_failure', cause_ref=child.id,
                    cause_status='failed', statement_ref=technical.statement_ref,
                    reason_refs=(child.exception_type_ref,), technical_failure=technical)
            if technical.child_failure_checkpoint_ref is not None:
                child = store.artifact(technical.child_failure_checkpoint_ref)
                if (not isinstance(child, WorkflowInstanceRecord)
                        or child.state_revision > canonical.state_revision
                        or child.operational_consciousness_context is None
                        or canonical.operational_consciousness_context is None
                        or child.operational_consciousness_context.parent_context_ref
                            != canonical.operational_consciousness_context.context_ref):
                    missing = 'source_failure.technical_child_has_another_recipient'
                    break
                current = child
                continue
            return evidence(
                cause_kind='technical_failure', cause_ref=canonical.id, cause_status='failed',
                statement_ref=technical.statement_ref, reason_refs=(technical.exception_type_ref,),
                technical_failure=technical)
        try:
            refusal = read_source_refusal(canonical, store=store)
        except ValueError:
            missing = "source_failure.canonical_refusal_invalid"
            break
        if refusal is not None:
            if refusal.child_reasoning_outcome_ref is not None or refusal.child_failure_checkpoint_ref is not None:
                try:
                    current = _canonical_refused_child(canonical, refusal, store)
                except ValueError as error:
                    missing = str(error)
                    break
                continue
            return evidence(
                cause_kind="call_refusal", cause_ref=canonical.id, cause_status="blocked",
                statement_ref=refusal.statement_ref, call_refusal=refusal,
                reason_refs=refusal.cause_reason_refs())
        terminal = canonical.source_terminal_binding
        if terminal is not None and terminal.kind in {"block", "fail"}:
            try:
                value = read_source_terminal_value(canonical, store=store)
            except SourceReturnContractError:
                missing = "source_failure.canonical_terminal_invalid"
                break
            return evidence(
                cause_kind="source_terminal", cause_ref=canonical.id, cause_status=canonical.status.value,
                statement_ref=canonical.current_statement_id, reason_refs=(f"source_terminal:{terminal.kind}",),
                declared_terminal_kind=terminal.kind, declared_terminal_value=value)
        cause_ref = canonical.provenance[-1] if canonical.provenance else None
        cause = store.artifact(cause_ref) if cause_ref is not None else None
        if (isinstance(cause, OperatorResult)
                and cause.status in (OperationStatus.BLOCKED, OperationStatus.FAILED)
                and cause.workflow_instance_id == canonical.workflow_instance_id
                and cause.timeline_id == canonical.timeline_id
                and cause.frame_id == canonical.frame_id
                and cause.state_revision <= canonical.state_revision):
            selection = (cause.attributes.get('selection_refusal')
                if cause.operator.value == 'SELECT' and cause.status is OperationStatus.BLOCKED else None)
            if selection is not None and not isinstance(selection, Mapping):
                missing = 'source_failure.invalid_selection_refusal'
                break
            try:
                return evidence(
                    cause_kind="operator_result", cause_ref=cause.id, cause_status=cause.status.value,
                    statement_ref=canonical.current_statement_id, reason_refs=cause.reason_refs,
                    cause_operator_ref=cause.operator.value,
                    selection_refusal=FrozenMap(selection) if isinstance(selection, Mapping) else None)
            except ValueError:
                missing = 'source_failure.invalid_selection_refusal'
                break
        missing = "source_failure.terminal_cause_unresolved"
        break
    return evidence(cause_kind="unresolved", missing_refs=(missing,))


def read_source_terminal_value(checkpoint: WorkflowInstanceRecord, *, store=None) -> object:
    """Read the exact value of an explicit STOP/BLOCK/DEFER/FAIL command.

    A scheduler fault or rejected CALL is not a declared terminal command.
    With a store, the immutable canonical checkpoint is required even when the
    caller holds a materialized view whose durable binding is not projected.
    """
    if store is not None:
        checkpoint = _canonical_checkpoint(checkpoint, store)
    terminal = checkpoint.source_terminal_binding
    kind = terminal.kind if terminal is not None else checkpoint.local_bindings.get(SRC_TERMINAL_KIND_BINDING)
    # Preserve in-memory legacy STOP support during sealing. Durable callers
    # never reconstruct missing terminal evidence from a diagnostic string.
    if store is None and kind is None and checkpoint.status is WorkflowStatus.COMPLETED:
        kind = "stop"
    expected_status = {"stop": WorkflowStatus.COMPLETED, "block": WorkflowStatus.BLOCKED,
                       "defer": WorkflowStatus.DEFERRED, "fail": WorkflowStatus.FAILED}.get(kind)
    if expected_status is None or checkpoint.status is not expected_status:
        raise SourceReturnContractError("checkpoint has no matching declared terminal command")
    if store is not None:
        if terminal is None or terminal.binding_ref == SRC_TERMINAL_BINDING_REF:
            raise SourceReturnContractError("terminal binding lacks its exact durable selector")
        return _read_terminal_binding(checkpoint, store, kind)
    binding = checkpoint.local_bindings.get(SRC_TERMINAL_BINDING_REF)
    if not isinstance(binding, str) or not binding:
        raise SourceReturnContractError("source return binding was not declared by STOP")
    if binding == SRC_TERMINAL_BINDING_REF or binding not in checkpoint.local_bindings:
        raise SourceReturnContractError("source return binding does not name a retained value")
    return checkpoint.local_bindings[binding]


def read_source_return(checkpoint: WorkflowInstanceRecord, *, store=None) -> object:
    """A successful return remains strictly STOP; refusals never become success."""
    if checkpoint.status is not WorkflowStatus.COMPLETED:
        raise SourceReturnContractError("source return requires a completed workflow")
    return read_source_terminal_value(checkpoint, store=store)


class SourceReasoningTechnicalFailure(RuntimeError):
    """An interpreted technical interruption with its exact retained cause."""

    def __init__(self, checkpoint_ref: str, exception_type_ref: str):
        self.child_failure_checkpoint_ref = checkpoint_ref
        self.exception_type_ref = exception_type_ref
        super().__init__(f'Source reasoning failed: {exception_type_ref} [{checkpoint_ref}]')


def require_source_completion(checkpoint: WorkflowInstanceRecord, *, store):
    """Keep the actual Source outcome at an interpreted controller boundary."""
    from agents.yf_arc3_v5.scheduler.registry import PureCallBlocked, PureCallDeferred
    canonical = _canonical_checkpoint(checkpoint, store)
    if canonical.status is WorkflowStatus.COMPLETED:
        # Completion alone does not attest a retained, readable STOP value.
        read_source_return(canonical, store=store)
        return canonical
    store.operational_consciousness.require_reasoning_outcome(canonical.operational_consciousness_outcome)
    technical = read_source_technical_failure(canonical, store=store)
    if technical is not None:
        raise SourceReasoningTechnicalFailure(canonical.id, technical.exception_type_ref)
    if canonical.status is WorkflowStatus.DEFERRED:
        raise PureCallDeferred('operational consciousness: Source returned a wait',
            child_deferred_checkpoint_ref=canonical.id)
    if canonical.status in (WorkflowStatus.BLOCKED, WorkflowStatus.FAILED):
        raise PureCallBlocked('operational consciousness: Source returned an unsuccessful outcome',
            child_failure_checkpoint_ref=canonical.id)
    raise SourceReturnContractError('Source computation has not returned a terminal outcome')


def measure_source_return_value(checkpoint, *, expected_value, expected_native_digest=None,
                                native_projection=None, expected_refusal=None, store=None):
    """Compare a consumed packet with its actual terminal Source checkpoint.

    Direct returns must be identical. An explicit native adapter preserves every
    native field and seals the original value separately from added context.
    A blocked call has a refusal receipt, never an invented STOP value.
    """
    failures, actual_digest, failure_evidence = [], None, None
    if checkpoint is None:
        failures.append('source_return.producer_checkpoint_missing')
    elif expected_refusal is not None:
        try:
            actual_refusal = read_source_refusal(checkpoint, store=store)
        except ValueError:
            actual_refusal = None
        if (actual_refusal is None or stable_digest(actual_refusal) != stable_digest(expected_refusal)
                or expected_native_digest is not None):
            failures.append('source_return.canonical_call_refusal_differs')
        if actual_refusal is not None:
            failure_evidence = read_source_failure_evidence(checkpoint, store=store)
            failures.extend(failure_evidence.missing_refs)
    else:
        try:
            actual = read_source_return(checkpoint, store=store)
        except SourceReturnContractError:
            failures.append('source_return.completed_stop_binding_required')
        else:
            actual_digest = stable_digest(actual)
            if native_projection is None:
                if actual_digest != stable_digest(expected_value):
                    failures.append('source_return.consumed_value_differs_from_stop')
            else:
                if expected_native_digest is None or actual_digest != expected_native_digest:
                    failures.append('source_return.adapted_native_digest_differs')
                if isinstance(actual, Mapping):
                    if any(key not in native_projection
                           or stable_digest(native_projection[key]) != stable_digest(value)
                           for key, value in sorted(actual.items())):
                        failures.append('source_return.adapter_changes_native_fields')
                elif actual is not None:
                    failures.append('source_return.adapter_requires_native_mapping_or_null')
    return FrozenMap({
        'source_terminal_matches': not failures,
        'source_failure_evidence': (FrozenMap(immutable_json_data(failure_evidence))
                                    if failure_evidence is not None else None),
        'source_checkpoint_ref': checkpoint.id if checkpoint is not None else None,
        'source_status_ref': checkpoint.status.value if checkpoint is not None else None,
        'source_return_value_digest': actual_digest,
        'source_return_missing_refs': tuple(failures),
    })


def source_checkpoint_receipt(checkpoint: WorkflowInstanceRecord, *, store=None) -> SourceCheckpointReceipt | None:
    """Capture terminal lineage and the exact return location, never its display text."""
    if store is not None:
        checkpoint = _canonical_checkpoint(checkpoint, store)
    if checkpoint.status not in {WorkflowStatus.COMPLETED, WorkflowStatus.BLOCKED, WorkflowStatus.FAILED, WorkflowStatus.DEFERRED}:
        return None
    terminal = checkpoint.source_terminal_binding
    kind = terminal.kind if terminal is not None else checkpoint.local_bindings.get(SRC_TERMINAL_KIND_BINDING)
    declared_kind = kind if kind in {"stop", "block", "defer", "fail"} else None
    declared_binding = None
    if declared_kind is not None:
        read_source_terminal_value(checkpoint, store=store)
        declared_binding = terminal.binding_ref if terminal is not None else checkpoint.local_bindings[SRC_TERMINAL_BINDING_REF]
    binding = None
    if checkpoint.status is WorkflowStatus.COMPLETED:
        read_source_return(checkpoint, store=store)
        binding = (checkpoint.source_terminal_binding.binding_ref
                   if store is not None and checkpoint.source_terminal_binding is not None
                   else checkpoint.local_bindings[SRC_TERMINAL_BINDING_REF])
    return SourceCheckpointReceipt(
        checkpoint_ref=checkpoint.id,
        workflow_definition_ref=checkpoint.workflow_definition_id,
        workflow_instance_ref=checkpoint.workflow_instance_id,
        source_hash=checkpoint.source_hash, timeline_ref=checkpoint.timeline_id,
        frame_ref=checkpoint.frame_id, state_revision=checkpoint.state_revision,
        status=checkpoint.status.value, statement_ref=checkpoint.current_statement_id,
        return_binding_ref=binding, call_refusal=read_source_refusal(checkpoint, store=store),
        call_deferral=read_source_deferral(checkpoint, store=store),
        declared_terminal_kind=declared_kind, declared_value_binding_ref=declared_binding,
        terminal_cause_ref=checkpoint.provenance[-1] if checkpoint.provenance else None,
    )


def resolve_source_checkpoint_receipt(receipt: SourceCheckpointReceipt, checkpoint: WorkflowInstanceRecord, *, store=None) -> object:
    """Consume the retained value only after checking all canonical receipt fields."""
    if source_checkpoint_receipt(checkpoint, store=store) != receipt:
        raise SourceReturnContractError("Source receipt differs from its canonical checkpoint")
    return read_source_return(checkpoint, store=store) if receipt.status == "completed" else None


def read_source_checkpoint_binding_path(checkpoint, path, *, store):
    """Resolve one binding through canonical deltas and references, never all locals."""
    from agents.yf_arc3_v5.logos.source_completion import SourceBindingPathRead
    if not isinstance(path, (tuple, list)) or not path or not all(isinstance(key, str) and key for key in path):
        raise SourceReturnContractError("binding read requires an explicit nonempty Source path")
    canonical = store.artifact(checkpoint.id)
    if (not isinstance(canonical, WorkflowInstanceRecord)
            or canonical.id != f"{checkpoint.workflow_instance_id}:checkpoint:{checkpoint.checkpoint_sequence:08d}"
            or any(getattr(canonical, field) != getattr(checkpoint, field) for field in (
                "state_revision", "frame_id", "status", "workflow_definition_id", "source_hash", "module_source_hash", "timeline_id"))):
        raise SourceReturnContractError("binding read differs from its requested canonical checkpoint")
    provenance = []
    def result(present, value=None):
        return SourceBindingPathRead(checkpoint_ref=checkpoint.id, path=tuple(path),
            value_present=present, value=value, provenance=tuple(provenance))
    def dereference(value):
        references = set()
        while isinstance(value, Mapping) and set(value) == {"$binding_value_ref"}:
            ref = value["$binding_value_ref"]
            if ref in references:
                raise SourceReturnContractError("cyclic canonical binding reference")
            references.add(ref)
            record = store.artifact(ref)
            if (not isinstance(record, WorkflowBindingValueRecord)
                    or record.id != "binding-value:" + record.value_digest
                    or stable_digest(record.payload["value"]) != record.value_digest):
                raise SourceReturnContractError("binding path lost its canonical value")
            provenance.append(ref)
            value = record.payload["value"]
        return value
    for sequence in range(checkpoint.checkpoint_sequence, 0, -1):
        ref = f"{checkpoint.workflow_instance_id}:checkpoint:{sequence:08d}"
        current = store.artifact(ref)
        if (not isinstance(current, WorkflowInstanceRecord) or current.checkpoint_sequence != sequence
                or current.state_revision > checkpoint.state_revision
                or any(getattr(current, field) != getattr(checkpoint, field) for field in (
                    "workflow_instance_id", "workflow_definition_id", "source_hash", "module_source_hash", "timeline_id"))):
            raise SourceReturnContractError("binding path lost its canonical checkpoint lineage")
        provenance.append(ref)
        if path[0] in current.local_binding_removals:
            return result(False)
        bindings = current.local_bindings if current.local_bindings_complete else current.local_binding_updates
        if path[0] not in bindings:
            if current.local_bindings_complete:
                return result(False)
            continue
        value = dereference(bindings[path[0]])
        for key in path[1:]:
            if not isinstance(value, Mapping) or key not in value:
                return result(False)
            value = dereference(value[key])
        return result(True, value)
    raise SourceReturnContractError("binding path has no complete Source checkpoint")


def resolve_composition_parent_context(execution, *, store) -> WorkflowInstanceRecord | None:
    """Resolve the pre-child parent, without treating its old facts as current."""
    from agents.yf_arc3_v5.dynamic_workflow.runtime import RootColdExecutionRecord
    if not isinstance(execution, RootColdExecutionRecord):
        raise SourceReturnContractError("composition context requires its canonical execution record")
    context = execution.parent_context
    if context is None:
        # Historical records remain unqualified; never manufacture their context.
        return None
    parent = store.artifact(context.parent_checkpoint_ref)
    if (not isinstance(parent, WorkflowInstanceRecord)
            or context.run_ref != store.run_id
            or context.parent_workflow_instance_ref != execution.parent_workflow_instance_id
            or context.child_workflow_instance_ref != execution.workflow_instance_id
            or context.composition_edge_ref != execution.declared_composition_edge_ref
            or context.timeline_ref != execution.timeline_id
            or context.captured_at_revision > execution.state_revision):
        raise SourceReturnContractError("composition context differs from its canonical scope")
    for field, expected in (
        ("workflow_instance_id", context.parent_workflow_instance_ref),
        ("workflow_definition_id", context.parent_workflow_definition_ref),
        ("source_hash", context.parent_source_hash),
        ("state_revision", context.parent_state_revision),
        ("frame_id", context.parent_frame_ref),
        ("timeline_id", context.timeline_ref),
    ):
        if getattr(parent, field) != expected:
            raise SourceReturnContractError("composition context differs from its canonical parent checkpoint")
    return parent


def read_parent_revalidation_return(checkpoint: WorkflowInstanceRecord, *, store=None) -> ParentRevalidationReturn | None:
    """Recognize an explicit typed return; a same-named local is not a return."""
    if checkpoint.status is not WorkflowStatus.COMPLETED:
        return None
    returned = read_source_return(checkpoint, store=store)
    schema = returned.get("schema_version") if isinstance(returned, Mapping) else getattr(returned, "schema_version", None)
    if schema != "yf_arc3_v5.parent_revalidation_return.v1":
        return None
    result = ParentRevalidationReturn.model_validate(returned)
    for field, expected in (
        ("workflow_definition_ref", checkpoint.workflow_definition_id),
        ("workflow_instance_ref", checkpoint.workflow_instance_id),
        ("source_hash", checkpoint.source_hash), ("frame_ref", checkpoint.frame_id),
    ):
        if result.facts.get(field) != expected:
            raise SourceReturnContractError("parent return differs from its actual Source checkpoint")
    return result


def read_canonical_preparation_refusal(checkpoint, store) -> ActionPreparationRefusal | None:
    """Resolve only a real STOP refusal; intermediate candidates have no authority."""
    if checkpoint.status is not WorkflowStatus.COMPLETED:
        return None
    result = read_source_return(checkpoint, store=store)
    kind = result.get("record_kind") if isinstance(result, Mapping) else getattr(result, "record_kind", None)
    if kind != "action_preparation_refusal":
        return None
    refusal = ActionPreparationRefusal.model_validate(result)
    if (store.artifact(refusal.id) != refusal
            or refusal.workflow_instance_id != checkpoint.workflow_instance_id
            or refusal.source_hash != checkpoint.source_hash
            or refusal.timeline_id != checkpoint.timeline_id
            or refusal.frame_id != checkpoint.frame_id
            or refusal.state_revision > checkpoint.state_revision):
        raise SourceReturnContractError("preparation refusal differs from its canonical Source return")
    return refusal
