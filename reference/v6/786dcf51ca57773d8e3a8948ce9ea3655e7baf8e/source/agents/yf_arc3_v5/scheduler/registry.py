"""Typed pure-call and operator-request builder registries for the scheduler."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from types import MappingProxyType

from agents.yf_arc3_v5.logos.types import EffectClass, OperatorName
from agents.yf_arc3_v5.logos.operational_reasoning import OperationalConsciousnessReasoningEntryRefusal
from agents.yf_arc3_v5.logos.source_completion import OperationalConsciousnessConsumptionSourceRefusal
from agents.yf_arc3_v5.operators.contracts import AnyOperatorRequest
from agents.yf_arc3_v5.scheduler.contracts import (
    FunctionCallContext,
    OperatorBuildContext,
)
from agents.yf_arc3_v5.src.compiler import AuthorityAttestation
from agents.yf_arc3_v5.src.ast import ExpressionKind
from agents.yf_arc3_v5.src.symbols import SymbolDefinition, SymbolKind


class SchedulerRegistrationError(ValueError):
    """A runtime helper does not match its compiled static authority."""


class SchedulerResolutionError(LookupError):
    """A compiled statement has no exact runtime helper."""


class PureCallBlocked(RuntimeError):
    """A source-controlled pure call produced an explicit blocked outcome."""

    def __init__(self, message: str, *, child_failure_checkpoint_ref: str | None = None,
                 child_reasoning_outcome_ref: str | None = None,
                 reasoning_entry_refusal: OperationalConsciousnessReasoningEntryRefusal | None = None,
                 consumption_source_refusal: OperationalConsciousnessConsumptionSourceRefusal | None = None):
        super().__init__(message)
        self.child_failure_checkpoint_ref = child_failure_checkpoint_ref
        self.child_reasoning_outcome_ref = child_reasoning_outcome_ref
        self.reasoning_entry_refusal = reasoning_entry_refusal
        self.consumption_source_refusal = consumption_source_refusal


class PureCallDeferred(RuntimeError):
    """A source-controlled pure call preserved an unresolved outcome."""

    def __init__(self, message: str, *, child_deferred_checkpoint_ref: str | None = None,
                 child_reasoning_outcome_ref: str | None = None):
        super().__init__(message)
        self.child_deferred_checkpoint_ref = child_deferred_checkpoint_ref
        self.child_reasoning_outcome_ref = child_reasoning_outcome_ref


PureCallImplementation = Callable[[FunctionCallContext], object]
OperatorRequestBuilder = Callable[[OperatorBuildContext], AnyOperatorRequest]


@dataclass(frozen=True)
class RegisteredPureCall:
    definition: SymbolDefinition
    implementation: PureCallImplementation


class SchedulerRuntimeRegistry:
    def __init__(self) -> None:
        self._calls: dict[str, RegisteredPureCall] | MappingProxyType[str, RegisteredPureCall] = {}
        self._operator_builders: dict[OperatorName, OperatorRequestBuilder] | MappingProxyType[OperatorName, OperatorRequestBuilder] = {}
        self._registration_generation = 0
        self._qualified_generation: int | None = None
        self._qualified_workflow_refs: tuple[str, ...] = ()
        self._registration_closed = False

    @property
    def registration_closed(self) -> bool:
        return (self._registration_closed and isinstance(self._calls, MappingProxyType)
                and isinstance(self._operator_builders, MappingProxyType))

    @property
    def qualified_workflow_refs(self) -> tuple[str, ...]:
        return self._qualified_workflow_refs

    def seal_qualified(self) -> None:
        """Freeze the qualified implementation domain; rebuild to change it.

        Copy before wrapping so a retained pre-seal mapping cannot mutate the
        production domain. This seals registration, not the execution state of
        bound helpers, and does not claim behavioral or activation coverage.
        """
        if self._qualified_generation is None or self._qualified_generation != self._registration_generation:
            raise SchedulerRegistrationError('scheduler registration changed or lacks a successful Source qualification')
        if self.registration_closed:
            return
        self._calls = MappingProxyType(dict(self._calls))
        self._operator_builders = MappingProxyType(dict(self._operator_builders))
        self._registration_closed = True

    @property
    def call_definitions(self) -> tuple[SymbolDefinition, ...]:
        """Expose immutable authority metadata for read-only architecture audits."""

        return tuple(self._calls[call_id].definition for call_id in sorted(self._calls))

    def validate_compiled_calls(self, modules, *, active_workflow_refs) -> int:
        """Qualify every callable boundary before a production workflow can start."""
        generation = self._registration_generation
        active_workflow_refs = frozenset(active_workflow_refs)
        self._qualified_generation = None
        self._qualified_workflow_refs = ()
        failures = []
        checked = 0
        for module in modules:
            authorities = {item.authority_id: item for item in module.authority_attestations}
            for workflow in module.workflows:
                if workflow.id not in active_workflow_refs:
                    continue
                expressions = [(workflow.id, binding.default)
                               for binding in (*workflow.inputs, *workflow.outputs, *workflow.state)
                               if binding.default is not None]
                pending = [statement for step in workflow.steps for statement in step.statements]
                while pending:
                    statement = pending.pop()
                    pending.extend((*statement.body, *statement.else_body))
                    pending.extend(arm.transition for arm in statement.match_arms)
                    if statement.expression is not None:
                        expressions.append((statement.id, statement.expression))
                    expressions.extend((statement.id, clause.value) for clause in statement.clauses)
                    expressions.extend((statement.id, label)
                                       for arm in statement.match_arms for label in arm.labels)
                    if statement.loop_contract is not None:
                        expressions.extend((statement.id, item) for item in (
                            statement.loop_contract.progress_witness,
                            statement.loop_contract.stop_condition,
                            statement.loop_contract.limit_result))
                while expressions:
                    location, expression = expressions.pop()
                    expressions.extend((location, item) for item in expression.items)
                    expressions.extend((location, arg.value) for arg in expression.arguments)
                    if expression.kind is not ExpressionKind.CALL:
                        continue
                    callee = expression.value
                    checked += 1
                    authority = authorities.get(callee)
                    if authority is None:
                        failures.append(f"{workflow.id}:{location}: missing authority for {callee}")
                        continue
                    try:
                        self.resolve_call(callee, attestation=authority)
                    except SchedulerResolutionError as error:
                        failures.append(f"{workflow.id}:{location}: {error}")
        if failures:
            raise SchedulerRegistrationError(
                f"production CALL bindings failed ({len(failures)}): " + "; ".join(failures[:12]))
        if generation != self._registration_generation:
            raise SchedulerRegistrationError('scheduler registration changed during Source qualification')
        self._qualified_generation = generation
        self._qualified_workflow_refs = tuple(sorted(active_workflow_refs))
        return checked

    @property
    def operator_names(self) -> tuple[OperatorName, ...]:
        """Expose registered primitive names without exposing their implementations."""

        return tuple(sorted(self._operator_builders, key=lambda item: item.value))

    def register_call(
        self,
        definition: SymbolDefinition,
        implementation: PureCallImplementation,
    ) -> None:
        if definition.kind not in {
            SymbolKind.CAPABILITY,
            SymbolKind.WORKFLOW,
            SymbolKind.WISDOM_WORKFLOW,
            SymbolKind.ACTION_RELEASE_WORKFLOW,
            SymbolKind.PREDICATE,
        }:
            raise SchedulerRegistrationError(
                f"scheduler call cannot execute {definition.kind.value}"
            )
        if definition.effect_class is not EffectClass.PURE:
            raise SchedulerRegistrationError("scheduler calls must be pure")
        existing = self._calls.get(definition.id)
        registered = RegisteredPureCall(definition, implementation)
        if existing is not None and existing != registered:
            raise SchedulerRegistrationError(
                f"scheduler call already registered: {definition.id}"
            )
        if existing is not None:
            return
        if self._registration_closed or not isinstance(self._calls, dict):
            raise SchedulerRegistrationError('qualified scheduler registration is closed; rebuild and requalify to add ' + definition.id)
        self._calls[definition.id] = registered
        self._registration_generation += 1

    def register_operator_builder(
        self,
        operator: OperatorName,
        builder: OperatorRequestBuilder,
    ) -> None:
        existing = self._operator_builders.get(operator)
        if existing is not None and existing != builder:
            raise SchedulerRegistrationError(
                f"operator builder already registered: {operator.value}"
            )
        if existing is not None:
            return
        if self._registration_closed or not isinstance(self._operator_builders, dict):
            raise SchedulerRegistrationError('qualified operator registration is closed; rebuild and requalify to add ' + operator.value)
        self._operator_builders[operator] = builder
        self._registration_generation += 1

    def resolve_call(
        self,
        callee_ref: str,
        *,
        attestation: AuthorityAttestation,
    ) -> RegisteredPureCall:
        registered = self._calls.get(callee_ref)
        if registered is None:
            raise SchedulerResolutionError(f"unregistered scheduler call: {callee_ref}")
        definition = registered.definition
        mismatches: list[str] = []
        if definition.id != attestation.authority_id:
            mismatches.append("identity")
        if definition.kind is not attestation.kind:
            mismatches.append("kind")
        if definition.effect_class is not attestation.effect_class:
            mismatches.append("effect")
        if definition.source_unit != attestation.source_unit:
            mismatches.append("source_unit")
        if definition.source_hash != attestation.source_hash:
            mismatches.append("source_hash")
        if mismatches:
            raise SchedulerResolutionError(
                f"scheduler call attestation mismatch for {callee_ref}: {mismatches}"
            )
        return registered

    def build_operator(self, context: OperatorBuildContext) -> AnyOperatorRequest:
        builder = self._operator_builders.get(context.operator)
        if builder is None:
            raise SchedulerResolutionError(
                f"unregistered operator request builder: {context.operator.value}"
            )
        return builder(context)
