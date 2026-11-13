"""Describe current receiving and quota evidence; Source retains revisable questions."""
from agents.yf_arc3_v5.logos.types import FrozenMap
from .structural_supposition_c import _scope_current
from .goal_supposition_c import _all_goal_values
from .goal_supposition_contracts_c import GoalSuppositionFactsC
from .b_extension_supposition_contracts_c import (
    GuardedTransportSuppositionInputC, QueuedCascadeSuppositionInputC,
    BExtensionSuppositionDecisionInputC, BExtensionSuppositionDecisionC)


def _current_observation(scope, observation):
    return (_scope_current(scope) and observation.sealed and bool(observation.evidence_refs)
        and observation.episode_ref == scope.episode_ref
        and observation.epoch == scope.epoch and observation.revision_ref == scope.revision_ref
        and observation.scope_ref == scope.scope_ref)


def measure_guarded_transport_supposition(value: GuardedTransportSuppositionInputC) -> GoalSuppositionFactsC:
    current = _scope_current(value.scope)
    required = (value.required_carrier_ref, *value.required_beneficiary_refs)
    unique_required = len(set(required)) == len(required)
    unique_positions = len({item.entity_ref for item in value.positions}) == len(value.positions)
    population = (current and unique_required and unique_positions and value.required_population_complete
        and bool(value.required_population_evidence_refs))
    receiving = value.receiving_side_ref if current and value.receiving_side_evidence_refs else None
    checkpoint = current and value.acceptance_checkpoint_ref is not None and bool(value.acceptance_checkpoint_evidence_refs)
    rows, conditions = [], []
    for ref in required:
        matches = tuple(item for item in value.positions if item.entity_ref == ref)
        qualified = population and receiving is not None and checkpoint and len(matches) == 1
        item = matches[0] if len(matches) == 1 else None
        qualified = qualified and _current_observation(value.scope, item)
        at_receiving = item.side_ref == receiving if qualified and item.side_ref is not None and item.side_evidence_refs else None
        released = not item.carried if qualified and type(item.carried) is bool and item.carried_evidence_refs else None
        conditions.append(at_receiving)
        if ref != value.required_carrier_ref:
            conditions.append(released)
        rows.append(FrozenMap({"entity_ref": ref, "current_observation": qualified,
            "at_receiving_side": at_receiving, "no_longer_carried": released}))
    return GoalSuppositionFactsC(measurements=tuple(rows), facts=FrozenMap({
        "scope_current": current,
        "receiving_side_question_supported": current and all((value.paired_region_evidence_refs,
            value.crossing_support_evidence_refs, value.independent_carrier_control_evidence_refs,
            value.cargo_body_evidence_refs, value.compatible_receiving_frame_evidence_refs)),
        "required_carrier_beneficiaries_at_receiving_and_none_carried": _all_goal_values(tuple(conditions)),
        "complete_required_population": population, "checkpoint_bound": checkpoint,
        "receiving_law_or_roles_confirmed": False}))


def measure_queued_cascade_supposition(value: QueuedCascadeSuppositionInputC) -> GoalSuppositionFactsC:
    current = _scope_current(value.scope)
    observed = value.observation
    qualified = observed is not None and _current_observation(value.scope, observed)
    complete = observed.lock_and_cascade_complete if qualified and observed.completion_evidence_refs else None
    credit = observed.credit_after if qualified and observed.credit_evidence_refs else None
    quota = value.required_quota if current and value.quota_requirement_evidence_refs else None
    quota_met = credit >= quota if credit is not None and quota is not None else None
    checkpoint = (observed.before_terminal_checkpoint if qualified and observed.terminal_checkpoint_ref is not None
        and observed.checkpoint_evidence_refs else None)
    return GoalSuppositionFactsC(measurements=(FrozenMap({"transaction_ref": observed.transaction_ref if observed else None,
        "current_observation": qualified, "whole_lock_cascade_complete": complete,
        "credit_after": credit, "required_quota": quota, "quota_met": quota_met,
        "before_terminal_checkpoint": checkpoint}),), facts=FrozenMap({"scope_current": current,
        "whole_cascade_quota_question_supported": current and all((value.active_ordered_bundle_evidence_refs,
            value.homologous_queued_miniature_evidence_refs, value.near_equal_line_evidence_refs,
            value.removal_effect_evidence_refs, value.changing_credit_display_evidence_refs)),
        "quota_after_complete_cascade_before_terminal_checkpoint": _all_goal_values((complete, quota_met, checkpoint)),
        "cascade_credit_or_terminal_law_confirmed": False}))


def assemble_b_extension_supposition(value: BExtensionSuppositionDecisionInputC) -> BExtensionSuppositionDecisionC:
    return BExtensionSuppositionDecisionC(frozen_request=value.request, frozen_measurement=value.measured,
        source_disposition_ref=value.source_disposition_ref, source_policy_ref=value.source_policy_ref,
        source_reason_ref=value.source_reason_ref,
        source_registration_admissible=value.source_registration_admissible)
