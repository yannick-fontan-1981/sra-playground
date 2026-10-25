"""Exact context-path projection and immutable Source-selected stack reduction.

The canonical goal graph owns dependencies. These frames only carry the
declared active path and its native returns; they never grant ACT.
"""
from collections.abc import Mapping

from agents.yf_arc3_v5.logos.operations import (
    ActionIntent, ReasoningContextFrame, ReasoningContextStack,
)
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


def measure_context_path(*, previous, event, maximum_depth):
    scope = event.get("scope", {})
    scope_refs = tuple(scope.get(key) for key in ("game_ref", "level_ref", "session_ref"))
    previous_scope = (previous.game_ref, previous.level_ref, previous.session_ref) if previous else None
    scope_matches = previous is not None and previous_scope == scope_refs
    frames = previous.frames if scope_matches else ()
    raw_intent = event.get("intent")
    intent = ActionIntent.model_validate(raw_intent) if raw_intent is not None else None
    qualification = event.get("parent_qualification", {})
    root_ref = qualification.get("retained_parent_goal_ref")
    path = ()
    entered = ()
    if intent is not None:
        leaf_ref = intent.subgoal_ref or intent.active_goal_ref
        path = tuple(dict.fromkeys(ref for ref in (
            root_ref, *intent.goal_dependency_chain_refs, leaf_ref,
        ) if ref is not None))
        local_why = FrozenMap({key: getattr(intent, key) for key in (
            "active_goal_ref", "active_terminal_goal_ref", "subgoal_ref",
            "premise_claim_refs", "selection_principle_ref", "falsifier_refs",
            "expected_configuration_or_goal_delta_ref", "reconciliation_checkpoint_ref",
            "goal_dependency_chain_refs", "committed_plan_ref", "discriminating_experiment_ref",
        )})
        parent_ref = None
        prepared = []
        for index, goal_ref in enumerate(path):
            context_ref = "context:" + stable_digest((scope_refs, path[:index + 1]))[:24]
            frame = ReasoningContextFrame(
                context_ref=context_ref, goal_ref=goal_ref, parent_context_ref=parent_ref,
                parent_goal_why_contract=qualification.get("retained_parent_goal_why_contract") if index == 0 else None,
                local_why_contract=local_why if goal_ref == leaf_ref else FrozenMap(),
                preserve_constraint_refs=tuple(event.get("preserve_constraint_refs", ())),
                overshoot_constraint_refs=tuple(event.get("overshoot_constraint_refs", ())),
                engagement_ref=intent.committed_plan_ref or intent.discriminating_experiment_ref,
            )
            if index == 0 and frames and frames[0].goal_ref == goal_ref:
                frame = frames[0]
            prepared.append(frame)
            parent_ref = frame.context_ref
        entered = tuple(prepared)
    native = event.get("native_return", {})
    intent_refs = tuple(event.get("execution_intent_refs", ()))
    return_intent = event.get("returned_intent_ref")
    return_context = event.get("returned_context_ref")
    execution_matches = bool(scope_matches and frames
        and previous.active_execution_context_ref == return_context
        and return_context == frames[-1].context_ref
        and return_intent in previous.active_execution_intent_refs)
    native_parent_matches = bool(scope_matches and frames
        and native.get("parent_goal_ref") == previous.retained_parent_goal_ref)
    returned = frames[:-1] if len(frames) > 1 else frames
    return FrozenMap({
        "event_ref": event.get("event_ref"),
        "scope_complete": all(isinstance(ref, str) and bool(ref) for ref in scope_refs),
        "scope_matches": scope_matches,
        "intent_present": intent is not None,
        "parent_qualification_allows_candidate": qualification.get("parent_continuity_allows_candidate"),
        "entered_path_nonempty": bool(entered),
        "entered_path_within_bound": bool(entered) and len(entered) <= maximum_depth,
        "entered_frames": tuple(frame.model_dump(mode="python") for frame in entered),
        "entered_parent_goal_ref": root_ref,
        "entered_context_ref": entered[-1].context_ref if entered else None,
        "entered_intent_refs": intent_refs,
        "entered_intent_refs_present": bool(intent_refs),
        "execution_return_matches": execution_matches,
        "returned_frames": tuple(frame.model_dump(mode="python") for frame in returned),
        "returned_context_ref": return_context,
        "native_parent_matches": native_parent_matches,
        "native_question_source_matches": native.get("native_question_source_matches"),
        "native_return_parent_domain_qualified": bool(native.get("native_question_domain_count", 0) > 0
            and native.get("native_question_current_parent_match_count") == native.get("native_question_domain_count")
            and native.get("native_question_parent_ref_count") == 1),
        "native_return_checkpoint_ref": native.get("native_question_checkpoint_ref"),
        "native_return_alternative_refs": tuple(native.get("native_question_alternative_refs", ())),
        "native_return_disposition_ref": native.get("parent_return_disposition_ref"),
        "preserved_frames": tuple(frame.model_dump(mode="python") for frame in frames),
        "preserved_parent_goal_ref": previous.retained_parent_goal_ref if scope_matches else None,
        "preserved_execution_context_ref": previous.active_execution_context_ref if scope_matches else None,
        "preserved_execution_intent_refs": previous.active_execution_intent_refs if scope_matches else (),
        "preserved_local_execution_intent_refs": previous.local_execution_intent_refs if scope_matches else (),
    })


def record_from_declared_facts(*, previous, facts: Mapping, event, lineage):
    """Copy the exact frame list and bindings already selected by DRM/SRC."""
    scope = event["scope"]
    return ReasoningContextStack(
        **lineage,
        game_ref=scope["game_ref"], level_ref=scope["level_ref"], session_ref=scope["session_ref"],
        owner_workflow_instance_ref=event["owner_workflow_instance_ref"],
        retained_parent_goal_ref=facts.get("result_parent_goal_ref"),
        frames=facts["result_frames"],
        active_execution_context_ref=facts.get("result_execution_context_ref"),
        active_execution_intent_refs=tuple(facts.get("result_execution_intent_refs", ())),
        local_execution_intent_refs=tuple(facts.get("result_local_execution_intent_refs", ())),
        transition_ref=facts["stack_transition_ref"],
        returned_context_ref=facts.get("returned_context_ref"),
        native_return_checkpoint_ref=facts.get("native_return_checkpoint_ref") or (previous.native_return_checkpoint_ref if previous else None),
        native_return_alternative_refs=tuple(facts.get("native_return_alternative_refs", ())) or (previous.native_return_alternative_refs if previous else ()),
        native_return_disposition_ref=facts.get("native_return_disposition_ref") or (previous.native_return_disposition_ref if previous else None),
        return_evidence_ref=event.get("return_evidence_ref"),
        completed_child_goal_ref=facts.get("completed_child_goal_ref"),
        completed_child_effect_claim_refs=tuple(facts.get("completed_child_effect_claim_refs", ())),
        parent_resume_context_ref=facts.get("parent_resume_context_ref"),
    )
