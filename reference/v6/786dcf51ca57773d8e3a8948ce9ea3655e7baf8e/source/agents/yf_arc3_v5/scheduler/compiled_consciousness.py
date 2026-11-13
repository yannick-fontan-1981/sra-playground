"""Source-qualified consciousness boundary for compiled reasoning, including replay.

The compiler still determines sequence and DRM still determines meaning. This
scope checks declared instructions and retains the operations actually visited.
An entry is canonical before computation; a DRM non-selection returns its cause.
"""
from agents.yf_arc3_v5.logos.operational_reasoning import (
    OperationalConsciousnessSourceOperation, OperationalConsciousnessReasoningReturn,
    OperationalConsciousnessReasoningOutcome,
    bind_reasoning_operation,
)
from agents.yf_arc3_v5.src.ast import StatementKind, ExpressionKind
from contextvars import ContextVar
from functools import wraps
from .registry import PureCallBlocked

_compiled_activities = ContextVar('operational_consciousness_compiled_activities', default=None)


class CompiledDirectCallRefusal(PureCallBlocked):
    """A refusal captured inside one actual invocation, before stack unwinding."""
    def __init__(self, *, operation, refusal):
        super().__init__(refusal.detail)
        self.operation = operation
        self.refusal = refusal


class CompiledReasoningTechnicalFailure(RuntimeError):
    def __init__(self, record_ref, exception_type_ref):
        self.reasoning_outcome_ref = record_ref
        self.exception_type_ref = exception_type_ref
        super().__init__('compiled reasoning failed: ' + exception_type_ref + ' [' + record_ref + ']')


def require_compiled_execution_boundary():
    if _compiled_activities.get() is None:
        raise ValueError('operational consciousness: compiled producer has no publication boundary')


def conscious_compiled_boundary(function=None, *, coordination_argument=None):
    """Require actual publication; preserve exceptions without selecting a repair."""
    if function is None:
        return lambda target: conscious_compiled_boundary(
            target, coordination_argument=coordination_argument)
    @wraps(function)
    def guarded(*args, **kwargs):
        if coordination_argument is not None:
            required = kwargs.get(coordination_argument, False)
            if required is False:
                return function(*args, **kwargs)
            if required is not True:
                raise ValueError('compiled coordination requirement must be an explicit boolean')
        activities = []
        token = _compiled_activities.set(activities)
        try:
            result = function(*args, **kwargs)
            for activity in activities:
                activity.require_published()
            return result
        except Exception as error:
            from .registry import PureCallBlocked, PureCallDeferred
            if isinstance(error, (PureCallBlocked, PureCallDeferred)):
                propagated = error
                try:
                    for activity in reversed(activities):
                        recorded = (activity.return_call_deferral(propagated)
                            if isinstance(propagated, PureCallDeferred) else activity.return_call_refusal(propagated))
                        if recorded is not None:
                            propagated = recorded
                except Exception as publication_error:
                    if hasattr(error, 'add_note'):
                        error.add_note('Compiled refusal publication failed: ' + type(publication_error).__name__)
                else:
                    if propagated is error:
                        raise
                    raise propagated from error
            failures = []
            for activity in reversed(activities):
                try:
                    recorded = activity.return_technical_failure(error)
                    if recorded is not None:
                        failures.append(recorded)
                except Exception as publication_error:
                    if hasattr(error, 'add_note'):
                        error.add_note('Compiled failure publication failed: ' + type(publication_error).__name__)
            if failures:
                record_ref, exception_type = failures[-1]
                raise CompiledReasoningTechnicalFailure(record_ref, exception_type) from error
            raise
        finally:
            _compiled_activities.reset(token)
    return guarded


def declared_conscious_operations(workflow):
    result = []

    def expression_calls(expression):
        if expression is None:
            return
        for item in expression.items:
            yield from expression_calls(item)
        for argument in expression.arguments:
            yield from expression_calls(argument.value)
        if expression.kind is ExpressionKind.CALL:
            yield expression.value

    def visit(step_ref, statements):
        for statement in statements:
            question = (next((clause.value.value for clause in statement.clauses
                             if clause.name == 'FOR'), None)
                if statement.kind in (StatementKind.CALL, StatementKind.SELECT,
                    StatementKind.DERIVE, StatementKind.UPDATE) else None)
            if question is not None and not isinstance(question, str):
                raise ValueError('operational consciousness: compiled question is not an exact SRC reference')
            if statement.kind in (StatementKind.CALL, StatementKind.SELECT,
                                  StatementKind.DERIVE, StatementKind.UPDATE):
                result.append(OperationalConsciousnessSourceOperation(
                    step_ref=step_ref, statement_ref=statement.id,
                    operation_ref=(statement.expression.value if statement.kind is StatementKind.CALL
                                   else statement.kind.value), declared_question_ref=question))
            # A declaration is a permitted Source site, not a claim that the
            # operation ran. Include calls in expressions without duplicates;
            # actual occurrences remain in the returned operation trace.
            roots = [statement.expression, *(clause.value for clause in statement.clauses)]
            if statement.loop_contract is not None:
                roots.extend((statement.loop_contract.progress_witness,
                    statement.loop_contract.stop_condition, statement.loop_contract.limit_result))
            for arm in statement.match_arms:
                roots.extend(arm.labels)
            seen = {statement.expression.value} if statement.kind is StatementKind.CALL else set()
            for expression in roots:
                for operation_ref in expression_calls(expression):
                    if operation_ref in seen:
                        continue
                    seen.add(operation_ref)
                    result.append(OperationalConsciousnessSourceOperation(
                        step_ref=step_ref, statement_ref=statement.id,
                        operation_ref=operation_ref, declared_question_ref=question))
            visit(step_ref, statement.body)
            visit(step_ref, statement.else_body)
            for arm in statement.match_arms:
                visit(step_ref, (arm.transition,))

    for step in workflow.steps:
        visit(step.id, step.statements)
    return tuple(result)


class OperationalConsciousnessCompiledActivity:
    def __init__(self, *, consciousness, entry, replay_return=None, refusal_recorder=None,
                 publication_reader=None, failure_recorder=None, replay_recorder=None,
                 replay_expected_digest=None, call_refusal_recorder=None, call_deferral_recorder=None):
        require_compiled_execution_boundary()
        self._consciousness = consciousness
        self.entry = entry
        self._operations = []
        self._replay_return = replay_return
        self._refusal_recorder = refusal_recorder
        self._sealed = False
        self._prepared_return = None
        self._publication_reader = publication_reader
        self._failure_recorder = failure_recorder
        self._call_refusal_recorder = call_refusal_recorder
        self._call_deferral_recorder = call_deferral_recorder
        self._replay_recorder = replay_recorder
        self._replay_expected_digest = replay_expected_digest
        _compiled_activities.get().append(self)
        if replay_return is not None:
            consciousness.require_compiled_reasoning_replay(replay_return)

    def require_published(self):
        if (self._prepared_return is None or self._publication_reader is None
                or not self._publication_reader(self.entry, self._prepared_return)):
            raise ValueError('operational consciousness: compiled return has no exact canonical receipt')

    def return_technical_failure(self, error):
        # A fresh validation entry owns replay failure; history remains unchanged.
        if (self._prepared_return is not None and self._publication_reader is not None
                and self._publication_reader(self.entry, self._prepared_return)):
            return None
        if self._failure_recorder is None:
            raise ValueError('operational consciousness: compiled error has no canonical recorder')
        exception_type = (error.exception_type_ref if isinstance(error, CompiledReasoningTechnicalFailure)
            else type(error).__module__ + '.' + type(error).__qualname__)
        record_ref = self.entry.id + ':technical-failure'
        attempted = self._prepared_return.outcome.producer_record_ref if self._prepared_return is not None else None
        returned = self._build_return(result_ref=record_ref, status='failed')
        self._failure_recorder(entry=self.entry, returned=returned, exception_type_ref=exception_type,
            attempted_result_ref=attempted)
        self._prepared_return = returned
        self._sealed = True
        self.require_published()
        return record_ref, exception_type

    def return_call_refusal(self, error):
        """Propagate an evidenced rejected child, never infer a repair or a caller."""
        from .registry import PureCallBlocked
        if (self._prepared_return is not None and self._publication_reader is not None
                and self._publication_reader(self.entry, self._prepared_return)):
            return None
        if self._replay_return is not None or self._call_refusal_recorder is None:
            raise ValueError('operational consciousness: no live compiled refusal recorder')
        record_ref = self.entry.id + ':call-refusal'
        returned = self._build_return(result_ref=record_ref, status='blocked')
        self._call_refusal_recorder(entry=self.entry, returned=returned, error=error)
        self._prepared_return = returned
        self._sealed = True
        self.require_published()
        return PureCallBlocked('operational consciousness: refused child entry at ' + record_ref,
            child_reasoning_outcome_ref=record_ref)

    def return_call_deferral(self, error):
        """Publish the child's actual wait without deciding when to retry it."""
        from .registry import PureCallDeferred
        if (self._prepared_return is not None and self._publication_reader is not None
                and self._publication_reader(self.entry, self._prepared_return)):
            return None
        if self._replay_return is not None or self._call_deferral_recorder is None:
            raise ValueError('operational consciousness: no live compiled deferral recorder')
        record_ref = self.entry.id + ':call-deferral'
        returned = self._build_return(result_ref=record_ref, status='deferred')
        self._call_deferral_recorder(entry=self.entry, returned=returned, error=error)
        self._prepared_return = returned
        self._sealed = True
        self.require_published()
        return PureCallDeferred('operational consciousness: deferred child at ' + record_ref,
            child_reasoning_outcome_ref=record_ref)

    def _require_open(self):
        if self._sealed:
            raise ValueError('operational consciousness: compiled activity is already sealed')

    def require_executor(self, workflow_ref, module_source_hash):
        self._require_open()
        if (self.entry.context.source_workflow_ref != workflow_ref
                or self.entry.module_source_hash != module_source_hash):
            raise ValueError('operational consciousness: compiled executor differs from admitted Source')

    def operation(self, step_ref, operation_ref, *, occurrence=0, question_ref=None):
        self._require_open()
        candidates = tuple(item for item in self.entry.declared_operations
                           if item.step_ref == step_ref and item.operation_ref == operation_ref
                           and item.declared_question_ref == question_ref)
        if occurrence < 0 or occurrence >= len(candidates):
            raise ValueError('operational consciousness: operation or question is absent from admitted SRC')
        declared = candidates[occurrence]
        context = self.entry.context
        operation = bind_reasoning_operation(context, operation_ref=operation_ref,
            statement_ref=declared.statement_ref, frame_ref=self.entry.frame_id,
            declared_question_ref=question_ref)
        require_operation = (self._consciousness.require_reasoning_operation if self._replay_return is not None
                             else self._consciousness.require_reasoning_execution)
        require_operation(operation,
            run_ref=context.run_ref, timeline_ref=context.timeline_ref, frame_ref=self.entry.frame_id,
            workflow_ref=context.owner_workflow_ref, source_workflow_ref=context.source_workflow_ref,
            source_hash=context.source_hash, operation_ref=operation_ref)
        self._operations.append(operation)
        return operation

    def invoke_capability(self, registry, request, *, step_ref, occurrence=0):
        return self.invoke_call(step_ref, request.capability_id, registry.invoke,
            request, occurrence=occurrence)

    def invoke_call(self, step_ref, operation_ref, function, *args,
                    occurrence=0, question_ref=None, **kwargs):
        """Bind a pure computation's typed refusal to its exact Source operation."""
        from pydantic import ValidationError
        from .evaluator import RuntimeTypeError
        from .call_refusal import source_call_refusal
        operation = self.operation(step_ref, operation_ref,
            occurrence=occurrence, question_ref=question_ref)
        try:
            return function(*args, **kwargs)
        except (PureCallBlocked, ValidationError, RuntimeTypeError) as error:
            if isinstance(error, PureCallBlocked) and (
                    error.child_failure_checkpoint_ref is not None
                    or error.child_reasoning_outcome_ref is not None
                    or error.reasoning_entry_refusal is not None
                    or isinstance(error, CompiledDirectCallRefusal)):
                # An actual child's return keeps its own canonical lineage.
                raise
            refusal = source_call_refusal(error,
                workflow_instance_ref=self.entry.workflow_instance_id,
                statement_ref=operation.statement_ref, callee_ref=operation.operation_ref)
            raise CompiledDirectCallRefusal(operation=operation, refusal=refusal) from error

    def reject_selection(self, *, policy_ref, drm_source_hash, alternative_refs, result):
        self._require_open()
        from agents.yf_arc3_v5.logos.types import immutable_json_data
        from .registry import PureCallBlocked
        if self._replay_return is not None:
            raise ValueError('operational consciousness: pure replay no longer reproduces its completed selection')
        if self._refusal_recorder is None:
            raise ValueError('operational consciousness: compiled refusal has no canonical recorder')
        record_ref = self.entry.id + ':selection-refusal'
        returned = self.finish(result_ref=record_ref, status='blocked')
        self._refusal_recorder(entry=self.entry, returned=returned, policy_ref=policy_ref,
            drm_source_hash=drm_source_hash, alternative_refs=alternative_refs,
            selection_result=immutable_json_data(result))
        return PureCallBlocked('operational consciousness: unresolved DRM selection at ' + record_ref,
                               child_reasoning_outcome_ref=record_ref)

    def finish(self, *, result_ref, status='completed', replay_result_digest=None):
        self._require_open()
        if self._replay_return is not None:
            historical = self._replay_return
            reproduced = tuple(bind_reasoning_operation(historical.context,
                operation_ref=op.operation_ref, statement_ref=op.statement_ref,
                frame_ref=op.current_frame_ref, declared_question_ref=op.declared_question_ref)
                for op in self._operations)
            if (status != 'completed' or result_ref != historical.outcome.producer_record_ref
                    or reproduced != historical.operations or self._replay_expected_digest is None
                    or replay_result_digest != self._replay_expected_digest or self._replay_recorder is None):
                raise ValueError('operational consciousness: replay changed its path, historical owner or actual result')
            result_ref = self.entry.id + ':replay-validated'
        returned = self._build_return(result_ref=result_ref, status=status)
        self._prepared_return = returned
        self._sealed = True
        if self._replay_return is not None:
            self._replay_recorder(entry=self.entry, returned=returned,
                actual_result_digest=replay_result_digest)
        return returned

    def _build_return(self, *, result_ref, status):
        origin = self.entry.initiating_operation
        recipient = origin.context.context_ref if origin is not None else self.entry.context.context_ref
        returned = OperationalConsciousnessReasoningReturn(entry_ref=self.entry.id,
            context=self.entry.context, operations=tuple(self._operations),
            outcome=OperationalConsciousnessReasoningOutcome(producer_record_ref=result_ref,
                context=self.entry.context, recipient_context_ref=recipient,
                current_frame_ref=self.entry.frame_id, boundary_kind='compiled_return', status=status,
                evidence_refs=(self.entry.id,)))
        self._consciousness.require_reasoning_return(returned)
        return returned
