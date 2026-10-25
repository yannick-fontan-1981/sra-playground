"""Fail-closed executor for SRC-declared, DRM-owned selection tree nodes.

This compiles only the narrow CALL projection -> SELECT -> MATCH/NEXT/STOP
form. It does not invent a branch, meaning, or action. Every terminal
assessment is the one named by SRC on the visited path.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import partial
from typing import Callable, Mapping

from agents.yf_arc3_v5.drm.meaning import project_declared_alternatives, _template_fields
from agents.yf_arc3_v5.drm.registry import DrmRegistry
from agents.yf_arc3_v5.drm.runtime import _implementation
from agents.yf_arc3_v5.logos.types import FrozenMap, FrozenModel
from agents.yf_arc3_v5.operators.contracts import SelectionInput, SelectionResult, SelectOutput
from agents.yf_arc3_v5.operators.selection_projection import project_selection_output
from agents.yf_arc3_v5.src.ast import ExpressionKind, StatementKind
from agents.yf_arc3_v5.src.compiler import CompiledModule, IrExpression, IrStep
from agents.yf_arc3_v5.src.registry import RegistryEntry
from agents.yf_arc3_v5.scheduler.registry import PureCallBlocked, PureCallDeferred


class CompiledSelectionUnresolved(PureCallBlocked):
    """An actual DRM non-selection, without an invented coordination activity."""
    def __init__(self, *, policy_ref, drm_source_hash, alternative_refs, result):
        from agents.yf_arc3_v5.logos.types import immutable_json_data
        self.selection_refusal = FrozenMap({
            'policy_ref': policy_ref, 'drm_source_hash': drm_source_hash,
            'alternative_refs': alternative_refs, 'result': immutable_json_data(result),
        })
        super().__init__('unresolved compiled DRM selection: ' + policy_ref)


class CompiledSelectionCalculationError(RuntimeError):
    """Exact failed calculation and cause; no repair or action is selected here."""
    def __init__(self, step_ref, error):
        self.step_ref = step_ref
        self.exception_type_ref = type(error).__module__ + '.' + type(error).__qualname__
        self.status = ('deferred' if isinstance(error, PureCallDeferred) else
                       'blocked' if isinstance(error, PureCallBlocked) else 'failed')
        self.selection_refusal = getattr(error, 'selection_refusal', None)
        super().__init__(str(error)[:2048])


def _literal(expression: IrExpression) -> str:
    if expression.kind not in {ExpressionKind.STRING, ExpressionKind.REFERENCE}:
        raise ValueError("selection tree expects a source literal or reference")
    return str(expression.value)


def _list_literals(expression: IrExpression) -> tuple[str, ...]:
    if expression.kind is not ExpressionKind.LIST:
        raise ValueError("selection tree expects a source list")
    return tuple(_literal(item) for item in expression.items)


@dataclass(frozen=True, slots=True)
class CompiledSelectionStep:
    step_id: str
    policy_ref: str
    drm_source_hash: str
    goal_ref: str
    requirement_refs: tuple[str, ...]
    projection_binding: str
    assessment_binding: str
    branches: tuple[tuple[str, str | None], ...]
    terminal: bool
    terminal_binding: str | None
    evaluate_drm: Callable[[FrozenModel], FrozenModel]

    def assess(
        self, drm: DrmRegistry, facts: Mapping[str, object], *, consciousness=None
    ) -> tuple[SelectOutput, FrozenMap]:
        policy, _loaded = drm.resolve(self.policy_ref)
        shared = (consciousness is None and isinstance(facts, FrozenMap)
                  and not (set(facts) == set(policy.declared_alternative_refs)
                           and all(isinstance(facts.get(ref), Mapping)
                                   for ref in policy.declared_alternative_refs)))
        if shared:
            from agents.yf_arc3_v5.drm.meaning import project_declared_shared_alternative_deltas
            projected = project_declared_shared_alternative_deltas(
                drm=drm, selection_policy_ref=self.policy_ref, descriptive_facts=facts)
        else:
            projection = partial(project_declared_alternatives,
                drm=drm,
                selection_policy_ref=self.policy_ref,
                alternative_refs=(),
                descriptive_facts=facts,
            )
            projected = (projection() if consciousness is None else consciousness.invoke_call(
                self.step_id, 'control.project_declared_alternatives', projection))
        canonical_refs = tuple(sorted(projected.alternative_refs))
        selection = partial(self.evaluate_drm, SelectionInput(
            goal_ref=self.goal_ref,
            alternative_refs=canonical_refs,
            requirement_refs=tuple(sorted(self.requirement_refs)),
            preserve_refs=canonical_refs,
            alternative_facts=projected.alternative_facts,
            context_facts=facts if shared else FrozenMap(),
        ))
        result = (selection() if consciousness is None else consciousness.invoke_call(
            self.step_id, 'SELECT', selection, question_ref=self.goal_ref))
        if not isinstance(result, SelectionResult):
            raise RuntimeError('declared tree node returned an invalid selection type')
        if result.selected_ref is None:
            refusal = (CompiledSelectionUnresolved if consciousness is None
                       else consciousness.reject_selection)
            raise refusal(policy_ref=self.policy_ref,
                drm_source_hash=self.drm_source_hash, alternative_refs=canonical_refs, result=result)
        try:
            output = project_selection_output(canonical_refs, result)
        except ValueError as exc:
            raise RuntimeError(str(exc)) from exc
        projected_facts = projected.alternative_facts.get(output.alternatives.selected)
        if not isinstance(projected_facts, FrozenMap):
            raise RuntimeError("declared tree selection lacks projected facts")
        if shared:
            projected_facts = FrozenMap.overlay(projected_facts, facts)
        return output, projected_facts


@dataclass(frozen=True, slots=True)
class CompiledTreeDecision:
    branch_ref: str
    branch_facts: FrozenMap
    perception_ref: str
    perception_facts: FrozenMap
    terminal_ref: str
    terminal_facts: FrozenMap
    terminal_assessment: SelectOutput
    path: tuple[tuple[str, str], ...]
    path_facts: tuple[FrozenMap, ...]
    src_source_hash: str
    drm_source_hashes: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class CompiledSelectionTree:
    workflow_ref: str
    src_source_hash: str
    steps: tuple[CompiledSelectionStep, ...]
    drm: DrmRegistry
    structured_field_refs: frozenset[str]

    def compact_evidence(self, facts: FrozenMap) -> FrozenMap:
        """Keep scalar evidence and every structured binding named by DRM.

        Large coordination returns remain with their Source owners. They do
        not become inputs of a pure selector merely by sharing its envelope.
        The literal set deliberately over-approximates the declared reads;
        templates, conditions, sequences and contracts all contribute to it.
        """
        alternatives = {ref for step in self.steps for ref, _ in step.branches}
        if facts and set(facts).issubset(alternatives):
            return facts  # Preserve the supported keyed-alternative input ABI.
        # Source's exact-attempt contract must also ignore a field before it
        # can leave this receipt. Unrecognized structured inputs stay intact.
        ignored = frozenset(facts.get('reserve_signature_ignored_field_refs', ()))
        if not ignored:
            return facts
        return FrozenMap.from_frozen_items({key: value for key, value in facts.canonical_items()
            if key not in ignored or key in self.structured_field_refs or not isinstance(value, (Mapping, FrozenModel, tuple))
            or (isinstance(value, tuple) and all(not isinstance(item, (Mapping, FrozenModel, tuple))
                                               for item in value))})

    def run(self, facts: Mapping[str, object], *, source_entry: RegistryEntry | None = None,
            consciousness=None) -> CompiledTreeDecision:
        # Direct calculation needs explicit Source authority. A missing activity
        # never supplies authority, eligibility or an ACT permit.
        if consciousness is not None:
            consciousness.require_executor(self.workflow_ref, self.src_source_hash)
        elif (not isinstance(source_entry, RegistryEntry)
              or self.workflow_ref not in source_entry.workflow_ids
              or source_entry.source_hash != self.src_source_hash):
            raise ValueError('compiled selection requires its exact Source registry entry')
        by_id = {step.step_id: step for step in self.steps}
        current = self.steps[0].step_id
        path: list[tuple[str, str]] = []
        path_facts: list[FrozenMap] = []
        projected_by_binding: dict[str, tuple[str, FrozenMap, SelectOutput]] = {}
        for _ in range(len(self.steps)):
            step = by_id[current]
            try:
                result, projected_facts = step.assess(self.drm, facts, consciousness=consciousness)
            except Exception as error:
                if consciousness is not None:
                    raise
                raise CompiledSelectionCalculationError(step.step_id, error) from error
            ref = result.alternatives.selected or ""
            path.append((step.step_id, ref))
            path_facts.append(projected_facts)
            projected_by_binding[step.assessment_binding] = (ref, projected_facts, result)
            if step.terminal:
                return self._decision(path, path_facts, projected_by_binding, step.terminal_binding)
            branch_map = dict(step.branches)
            if ref not in branch_map:
                raise RuntimeError("source tree omits a DRM-declared branch")
            next_step = branch_map[ref]
            if next_step is None:
                return self._decision(path, path_facts, projected_by_binding, step.assessment_binding)
            current = next_step
        raise RuntimeError("source tree exceeded its declared step bound")

    def _decision(
        self,
        path: list[tuple[str, str]],
        path_facts: list[FrozenMap],
        projected_by_binding: dict[str, tuple[str, FrozenMap, SelectOutput]],
        terminal_binding: str | None,
    ) -> CompiledTreeDecision:
        if terminal_binding not in projected_by_binding:
            raise RuntimeError("SRC terminal assessment was not visited")
        terminal_ref, terminal_facts, terminal_assessment = projected_by_binding[
            terminal_binding
        ]
        first_ref = path[0][1]
        second_ref = path[1][1] if len(path) > 1 else ""
        return CompiledTreeDecision(
            branch_ref=first_ref,
            branch_facts=path_facts[0],
            perception_ref=second_ref,
            perception_facts=path_facts[1] if len(path) > 1 else FrozenMap(),
            terminal_ref=terminal_ref,
            terminal_facts=terminal_facts,
            terminal_assessment=terminal_assessment,
            path=tuple(path),
            path_facts=tuple(path_facts),
            src_source_hash=self.src_source_hash,
            drm_source_hashes=tuple(item.drm_source_hash for item in self.steps),
        )


def _compile_step(
    step: IrStep,
    *,
    workflow_ref: str,
    input_name: str,
    drm: DrmRegistry,
) -> CompiledSelectionStep:
    statements = step.statements
    if len(statements) != 3 or tuple(item.kind for item in statements[:2]) != (
        StatementKind.CALL, StatementKind.SELECT,
    ):
        raise ValueError("unsupported selection tree step shape")
    call, assessment, exit_statement = statements
    if call.expression is None or call.expression.value != "control.project_declared_alternatives":
        raise ValueError("selection tree call must project declared alternatives")
    call_args = {item.name: item.value for item in call.expression.arguments}
    if set(call_args) != {
        "selection_policy_ref", "alternative_refs", "descriptive_facts",
    } or _list_literals(call_args["alternative_refs"]):
        raise ValueError("selection tree projection must use policy alternatives")
    if _literal(call_args["descriptive_facts"]) != input_name:
        raise ValueError("selection tree must use its declared input")
    policy_ref = _literal(call_args["selection_policy_ref"])
    clauses = {item.name: item.value for item in assessment.clauses}
    if set(clauses) != {"FACTS", "FOR", "FROM", "PRESERVE", "REQUIRE", "UNDER"}:
        raise ValueError("selection tree has unsupported SELECT clauses")
    projection_binding = str(call.result_binding or "")
    if (
        not projection_binding
        or _literal(clauses["FACTS"]) != f"{projection_binding}.alternative_facts"
        or _literal(clauses["FROM"]) != f"{projection_binding}.alternative_refs"
        or _literal(clauses["PRESERVE"]) != f"{projection_binding}.alternative_refs"
        or _literal(clauses["UNDER"]) != policy_ref
    ):
        raise ValueError("selection tree projection and SELECT source disagree")
    policy, loaded = drm.resolve(policy_ref)
    # Fan-out follows the finite DRM declaration, not an arbitrary three-way
    # ceiling. MATCH coverage, unique labels, reachability and cycle checks below
    # still reject malformed trees; selection eligibility remains DRM-owned.
    branches: list[tuple[str, str | None]] = []
    terminal = exit_statement.kind is StatementKind.STOP
    terminal_binding: str | None = None
    if terminal:
        terminal_binding = _literal(exit_statement.expression)
    elif exit_statement.kind is StatementKind.MATCH:
        if _literal(exit_statement.expression) != f"{assessment.target}.alternatives.selected":
            raise ValueError("selection tree MATCH must inspect its assessment")
        for arm in exit_statement.match_arms:
            transition = arm.transition
            if transition.kind not in {StatementKind.NEXT, StatementKind.STOP}:
                raise ValueError("selection tree MATCH has unsupported transition")
            target = (
                f"{workflow_ref}.{_literal(transition.expression)}"
                if transition.kind is StatementKind.NEXT else None
            )
            if transition.kind is StatementKind.STOP and _literal(transition.expression) != str(assessment.target):
                raise ValueError("selection tree MATCH STOP must return its assessment")
            branches.extend((_literal(label), target) for label in arm.labels)
        if (
            len(branches) != len(set(label for label, _ in branches))
            or set(dict(branches)) != set(policy.declared_alternative_refs)
        ):
            raise ValueError("source MATCH does not cover every DRM alternative")
    else:
        raise ValueError("selection tree step must MATCH or STOP")
    return CompiledSelectionStep(
        step_id=step.id,
        policy_ref=policy_ref,
        drm_source_hash=loaded.source_hash,
        goal_ref=_literal(clauses["FOR"]),
        requirement_refs=_list_literals(clauses["REQUIRE"]),
        projection_binding=projection_binding,
        assessment_binding=str(assessment.target),
        branches=tuple(branches),
        terminal=terminal,
        terminal_binding=terminal_binding,
        evaluate_drm=_implementation(
            policy, source_unit=loaded.source_unit, source_hash=loaded.source_hash
        ),
    )


def compile_selection_tree(
    module: CompiledModule,
    workflow_ref: str,
    drm: DrmRegistry,
) -> CompiledSelectionTree:
    workflow = next((item for item in module.workflows if item.id == workflow_ref), None)
    if workflow is None or len(workflow.inputs) != 1 or not 1 <= len(workflow.steps) <= 8:
        raise ValueError("source workflow is not a bounded one-input selection tree")
    steps = tuple(
        _compile_step(
            step, workflow_ref=workflow_ref,
            input_name=workflow.inputs[0].name, drm=drm,
        )
        for step in workflow.steps
    )
    step_ids = {step.step_id for step in steps}
    if any(target not in step_ids for step in steps for _, target in step.branches if target):
        raise ValueError("source tree branch leaves the compiled workflow")
    reachable: set[str] = set()
    by_id = {step.step_id: step for step in steps}

    def verify_path(step_id: str, bindings: frozenset[str], visiting: frozenset[str]) -> None:
        if step_id in visiting:
            raise ValueError("source selection tree contains a cycle")
        step = by_id[step_id]
        reachable.add(step_id)
        active_bindings = bindings | {step.assessment_binding}
        if step.terminal:
            if step.terminal_binding not in active_bindings:
                raise ValueError("source tree STOP returns an unvisited assessment")
            return
        for _, target in step.branches:
            if target is not None:
                verify_path(target, active_bindings, visiting | {step_id})

    verify_path(steps[0].step_id, frozenset(), frozenset())
    if reachable != step_ids:
        raise ValueError("source selection tree contains unreachable steps")
    structured_fields: set[str] = set()

    def collect_literals(value):
        if isinstance(value, str):
            structured_fields.add(value)
            structured_fields.update(_template_fields(value))
        elif isinstance(value, FrozenModel):
            for name in sorted(type(value).model_fields):
                collect_literals(getattr(value, name))
        elif isinstance(value, Mapping):
            for key, item in sorted(value.items()):
                collect_literals(key)
                collect_literals(item)
        elif isinstance(value, tuple):
            for item in value:
                collect_literals(item)

    for step in steps:
        declaration, _ = drm.resolve(step.policy_ref)
        collect_literals(declaration)
    return CompiledSelectionTree(
        workflow_ref=workflow_ref,
        src_source_hash=module.source_hash,
        steps=steps,
        drm=drm,
        structured_field_refs=frozenset(structured_fields),
    )
