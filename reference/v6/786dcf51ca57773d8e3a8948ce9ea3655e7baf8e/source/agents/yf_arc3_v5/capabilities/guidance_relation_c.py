"""Explicit relational clauses explain observed next designations, not wins."""
from .guidance_relation_contracts_c import (GuidanceRelationInputC, GuidanceRelationFactsC,
    GuidanceExampleExplanationC, GuidanceDecisionInputC, GuidanceDecisionC)
from .mechanical_common_contracts_c import MechanicalPredicateC
from .mechanical_event_composition_c import predicate_value
from agents.yf_arc3_v5.logos.types import FrozenMap


def _operand(example, operand):
    if operand.namespace == "CONSTANT":
        return True, operand.constant
    roots = {"SOURCE_DESIGNATION": example.source_designation, "ACTION": example.action,
        "OBSERVED_EFFECT": example.observed_effect,
        "OBSERVED_OUTCOME": example.observed_outcome,
        "NEXT_DESIGNATION": example.next_designation if example.next_designation_observed else None}
    current = roots[operand.namespace]
    if current is None:
        return False, None
    for part in operand.path:
        if isinstance(current, FrozenMap) and isinstance(part, str) and part in current:
            current = current[part]
        elif isinstance(current, tuple) and type(part) is int and 0 <= part < len(current):
            current = current[part]
        else:
            return False, None
    return True, current


def _clause(example, clause):
    left_known, left = _operand(example, clause.left)
    right_known, right = _operand(example, clause.right)
    if not left_known or not right_known:
        return None
    if clause.additive_offset is not None:
        offset_known, offset = _operand(example, clause.additive_offset)
        if not offset_known:
            return None
        if type(right) in (int, float) and type(offset) in (int, float):
            right = right+offset
        elif (isinstance(right, tuple) and isinstance(offset, tuple) and len(right) == len(offset)
                and all(type(value) in (int, float) for value in (*right, *offset))):
            right = tuple(value+delta for value, delta in zip(right, offset))
        else:
            return None
    return predicate_value(MechanicalPredicateC(predicate_ref=clause.clause_ref,
        field_ref="value", comparison=clause.comparison, expected=right), FrozenMap({"value": left}))


def _explained_next_paths(method):
    # An explanation relates the next designation to an actual source/action/
    # effect field. NEXT=NEXT or a bare absolute constant is not that relation.
    rules = []
    for clause in method.clauses:
        if clause.comparison not in ("EQ", "SET_EQ"):
            continue
        for target, other in ((clause.left, clause.right), (clause.right, clause.left)):
            if target.namespace != "NEXT_DESIGNATION":
                continue
            dependencies = (other, *((clause.additive_offset,) if clause.additive_offset is not None else ()))
            next_paths = {operand.path for operand in dependencies if operand.namespace == "NEXT_DESIGNATION"}
            grounded = any(operand.namespace in ("SOURCE_DESIGNATION", "ACTION", "OBSERVED_EFFECT", "OBSERVED_OUTCOME")
                for operand in dependencies)
            rules.append((target.path, next_paths, grounded))
    paths = set()
    # Finite dependency closure supports chained relations while rejecting
    # ungrounded cycles such as NEXT.x = NEXT.x + zero.
    changed = True
    while changed:
        changed = False
        for target, dependencies, grounded in rules:
            if target not in paths and dependencies.issubset(paths) and (grounded or dependencies):
                paths.add(target)
                changed = True
    return paths


def _needs_next(clause):
    return clause.left.namespace == "NEXT_DESIGNATION" or clause.right.namespace == "NEXT_DESIGNATION" or (
        clause.additive_offset is not None and clause.additive_offset.namespace == "NEXT_DESIGNATION")


def measure_guidance_relations(value: GuidanceRelationInputC) -> GuidanceRelationFactsC:
    current = (value.epoch == value.support_epoch and value.revision_ref == value.support_revision_ref
        and value.scope_ref == value.support_scope_ref and bool(value.invitation_evidence_refs))
    admitted = tuple(example for example in value.examples if example.episode_ref == value.episode_ref
        and example.learned_task_ref == value.learned_task_ref and example.actual_sealed_observation
        and (example.epoch < value.epoch or (example.epoch == value.epoch
            and example.sealed_sequence <= value.current_sealed_sequence)) and bool(example.evidence_refs))
    unqualified = tuple(example.example_ref for example in value.examples if example not in admitted)
    examples_unique = len({example.example_ref for example in value.examples}) == len(value.examples)
    methods_unique = len({method.method_ref for method in value.relation_candidates}) == len(value.relation_candidates)
    consistent, unresolved, falsified, explanations = [], [], [], []
    evaluations, bounded = 0, False
    for method in value.relation_candidates:
        method_false, method_unknown, observed_next_count = False, False, 0
        for example in admitted:
            values = []
            known_next = example.next_designation_observed and example.next_designation is not None
            nonnext_unknown = False
            for clause in method.clauses:
                if evaluations >= value.max_clause_evaluations:
                    bounded, method_unknown = True, True
                    break
                evaluations += 1
                answer = _clause(example, clause)
                values.append(answer)
                if answer is None and not _needs_next(clause):
                    nonnext_unknown = True
            if False in values:
                answer = False
                method_false = True
            elif len(values) != len(method.clauses) or None in values:
                answer = None
                method_unknown = method_unknown or known_next or nonnext_unknown or len(values) != len(method.clauses)
            else:
                answer = True
            if known_next:
                observed_next_count += 1
            explanations.append(GuidanceExampleExplanationC(example_ref=example.example_ref,
                method_ref=method.method_ref, clause_values=tuple(values), explains_observed_next=answer))
        method_supported = (bool(method.premise_refs) and bool(method.falsifier_refs)
            and set(value.required_next_field_paths).issubset(_explained_next_paths(method)))
        if method_false:
            falsified.append(method.method_ref)
        elif method_unknown or not method_supported or observed_next_count == 0:
            unresolved.append(method.method_ref)
        else:
            consistent.append(method.method_ref)
    return GuidanceRelationFactsC(explanations=tuple(explanations), consistent_method_refs=tuple(consistent),
        unresolved_method_refs=tuple(unresolved), falsified_method_refs=tuple(falsified),
        unqualified_example_refs=unqualified, actual_clause_evaluations=evaluations,
        facts=FrozenMap({"scope_current": current, "example_refs_unique": examples_unique,
            "method_refs_unique": methods_unique, "budget_reached": bounded,
            "observed_examples_present": bool(admitted), "consistent_relations_present": bool(consistent),
            "bounded_invitation_contract_present": value.bounded_experiment_contract_ref is not None
                and value.actual_primitive_bound > 0,
            "invitation_currently_visible": value.invitation_currently_visible}))


def assemble_guidance_decision(value: GuidanceDecisionInputC) -> GuidanceDecisionC:
    return GuidanceDecisionC(source_disposition_ref=value.source_disposition_ref,
        source_policy_ref=value.source_policy_ref, frozen_request=value.request, frozen_measurement=value.measured,
        preserved_parent_goal_ref=value.request.parent_goal_ref, preserved_learned_task_ref=value.request.learned_task_ref,
        retained_examples=value.request.examples,
        supported_relation_candidates=tuple(method for method in value.request.relation_candidates
            if method.method_ref in value.measured.consistent_method_refs))
