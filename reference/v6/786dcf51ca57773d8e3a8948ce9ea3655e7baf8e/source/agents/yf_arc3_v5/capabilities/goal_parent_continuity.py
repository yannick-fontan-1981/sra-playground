"""Pure comparison of dispatched parent lineage and a prepared candidate.

No goal is selected, closed, suspended or invented here. Scope equality,
canonical parent edges and exact declared WHY references are measured only.
"""
from __future__ import annotations

from agents.yf_arc3_v5.capabilities.contracts import (
    GoalParentContinuityInput,
    GoalParentContinuityMeasurements,
    GoalGraphNode,
)
from agents.yf_arc3_v5.logos.types import GoalNodeKind, Ref, stable_digest
from agents.yf_arc3_v5.logos.operations import ConcentrationLeaseState, ParentGoalWhyContract


def _declared_parent_why(
    request: GoalParentContinuityInput, goal_ref: Ref | None,
    nodes: dict[Ref, GoalGraphNode],
    *, source_activation_ref: Ref | None = None,
) -> ParentGoalWhyContract | None:
    if goal_ref is None:
        return None
    declaration = request.declared_why_measurement
    minimum = declaration.get("definition_goal_falsifier_min_count")
    equality_fields = tuple(declaration.get("equivalence_fields") or ())
    union_fields = tuple(declaration.get("coalesced_reference_fields") or ())
    # The Source declaration must account for every typed WHY field. A stale
    # or incomplete projection cannot silently erase a newly added obligation.
    if (not isinstance(minimum, int) or minimum < 0
            or len(set(equality_fields + union_fields)) != len(equality_fields + union_fields)
            or set(equality_fields + union_fields) != set(ParentGoalWhyContract.model_fields)):
        return None
    node = nodes.get(goal_ref)
    activations = tuple(activation for activation in request.goal_frontier_activations
                        if (goal_ref in activation.terminal_goal_refs
                            or goal_ref == activation.active_goal_ref)
                        and (source_activation_ref is None
                             or activation.activation_ref == source_activation_ref)
                        and sum(subject == goal_ref for subject, _falsifier
                                in activation.goal_falsifier_refs) >= minimum)
    contracts = tuple(contract for activation in activations
                      if (contract := _activation_why(request, goal_ref, node, activation)) is not None)
    if not contracts:
        return None
    keys = {tuple(getattr(contract, field) for field in equality_fields) for contract in contracts}
    if len(keys) != 1:
        return None
    merged = {}
    for field in union_fields:
        values = tuple(getattr(contract, field) for contract in contracts)
        if any(not isinstance(value, tuple) for value in values):
            return None
        merged[field] = tuple(sorted({ref for value in values for ref in value}))
    return contracts[0].model_copy(update=merged)


def _activation_why(request, goal_ref, node, activation) -> ParentGoalWhyContract | None:
    """Copy one scoped declaration and its canonical node; invent no meaning."""
    origins = tuple(sorted({claim_ref for activation_ref, claim_ref
                            in request.goal_frontier_activation_support_refs
                            if activation_ref == activation.activation_ref}))
    scope_proofs = tuple(sorted({proof_ref for activation_ref, proof_ref
                                in request.goal_frontier_activation_scope_proof_refs
                                if activation_ref == activation.activation_ref}))
    if not origins or not scope_proofs:
        return None
    # A node projection may predate the current activation. Preserve both
    # declared domains so an empty/older node cannot erase the new hypothesis.
    declared_variants_by_digest = {stable_digest(row): row for row in (
        *(node.operational_goal_hypotheses if node is not None else ()),
        *(row for row in activation.operational_goal_hypotheses if row.goal_ref == goal_ref))}
    return ParentGoalWhyContract(
        parent_goal_ref=goal_ref,
        source_activation_ref=activation.activation_ref,
        canonical_origin_refs=origins,
        canonical_scope_proof_refs=scope_proofs,
        guiding_principle_ref=activation.guiding_principle_ref,
        premise_claim_refs=activation.scene_support_claim_refs,
        support_claim_refs=node.support_claim_refs if node is not None else origins,
        activation_reason_refs=(node.activation_reason_refs if node is not None
                                else activation.activation_reason_refs),
        falsifier_refs=(node.falsifier_refs if node is not None else tuple(
            falsifier for subject, falsifier in activation.goal_falsifier_refs
            if subject == goal_ref)),
        access_condition_refs=node.access_condition_refs if node is not None else (),
        expected_goal_delta_refs=node.expected_goal_delta_refs if node is not None else (),
        expected_effect_signature_refs=node.expected_effect_signature_refs if node is not None else (),
        parent_goal_refs=node.parent_goal_refs if node is not None else (),
        prerequisite_goal_refs=node.prerequisite_goal_refs if node is not None else (),
        declared_parent_goal_pairs=activation.instrumental_parent_goal_refs,
        declared_goal_falsifier_pairs=activation.goal_falsifier_refs,
        operational_goal_hypotheses=tuple(declared_variants_by_digest[key] for key in sorted(declared_variants_by_digest)),
    )


def measure_goal_parent_continuity(
    request: GoalParentContinuityInput,
) -> GoalParentContinuityMeasurements:
    prior = request.prior_intent
    lease = request.prior_lease
    context_stack = request.prior_reasoning_context_stack
    candidate = request.candidate_intent
    nodes = {node.goal_ref: node for node in request.goal_nodes}
    prior_seed_refs = set()
    if prior is not None:
        prior_seed_refs.update(ref for ref in (prior.active_goal_ref, prior.subgoal_ref)
                               if ref is not None)
        prior_seed_refs.update(prior.goal_dependency_chain_refs)
        prior_seed_refs.update(prior.declared_dependency_chain_refs)
    prior_ancestors = set()
    prior_visited = set()
    prior_frontier = list(prior_seed_refs)
    prior_terminal_refs = set()
    while prior_frontier:
        ref = prior_frontier.pop()
        if ref in prior_visited:
            continue
        prior_visited.add(ref)
        node = nodes.get(ref)
        if node is not None:
            if node.active_terminal_goal_ref is not None:
                prior_terminal_refs.add(node.active_terminal_goal_ref)
            for parent_edge in node.parent_goal_refs:
                prior_ancestors.add(parent_edge)
                if parent_edge not in prior_visited:
                    prior_frontier.append(parent_edge)
    if not prior_terminal_refs:
        prior_terminal_refs.update(ref for ref in prior_ancestors
                                   if ref in nodes and nodes[ref].node_kind
                                   == GoalNodeKind.WORLD_ACHIEVEMENT)
    parent_ref = (prior.active_terminal_goal_ref or prior.declared_terminal_goal_ref
                  if prior is not None else None)
    lease_matches_intent = (prior.id in lease.extension_intent_ids
                            if lease is not None and prior is not None else None)
    scope_matches = (
        (lease.game_ref, lease.level_ref, lease.session_ref)
        == (request.current_game_ref, request.current_level_ref, request.current_session_ref)
        if lease is not None else None
    )
    qualified_binding = bool(
        lease is not None and lease_matches_intent is True and scope_matches is True
        and lease.parent_continuity_class_ref is not None
        and (lease.parent_goal_ref is not None or (
            lease.parent_goal_why_contract is None
            and request.prior_lease_canonical_state == ConcentrationLeaseState.RECONCILED
        ))
    )
    context_binding_present = bool(lease is not None and lease.reasoning_context_stack_ref is not None)
    context_binding_matches = bool(context_binding_present and context_stack is not None
        and lease_matches_intent is True and scope_matches is True
        and context_stack.owner_workflow_instance_ref == lease.workflow_instance_id
        and prior.id in context_stack.local_execution_intent_refs
        and (context_stack.game_ref, context_stack.level_ref, context_stack.session_ref)
        == (request.current_game_ref, request.current_level_ref, request.current_session_ref)
        and context_stack.retained_parent_goal_ref == lease.parent_goal_ref)
    if context_binding_present and not context_binding_matches:
        qualified_binding = False
    if lease_matches_intent is True and scope_matches is True and (
        lease.parent_goal_ref is not None or qualified_binding
    ):
        # This is the parent already retained by SRC in the same canonical
        # lease. A qualified null must not be replaced by an action annotation.
        # A dispatched dependent child cannot acquire its root's place.
        parent_ref = lease.parent_goal_ref
    if context_binding_matches:
        # This exact owner path was declared by SRC; the lease is only its
        # compatibility projection. Prepared sibling paths are not consulted.
        parent_ref = context_stack.retained_parent_goal_ref
    if parent_ref is None and len(prior_terminal_refs) == 1 and not qualified_binding:
        # Recover only the exact unique canonical terminal. Multiple parents
        # remain an unresolved measurement; no graph branch is selected here.
        parent_ref = next(iter(prior_terminal_refs))
    parent = nodes.get(parent_ref)
    candidate_terminal = (
        candidate.active_terminal_goal_ref or candidate.declared_terminal_goal_ref
        if candidate is not None else None
    )
    candidate_refs = set()
    if candidate is not None:
        candidate_refs.update(ref for ref in (
            candidate.active_goal_ref, candidate_terminal, candidate.subgoal_ref
        ) if ref is not None)
        candidate_refs.update(candidate.goal_dependency_chain_refs)
        candidate_refs.update(candidate.declared_dependency_chain_refs)

    # Finite graph closure; cycles cannot create a new reference or loop.
    ancestors = set()
    frontier = list(candidate_refs)
    visited = set()
    while frontier:
        ref = frontier.pop()
        if ref in visited:
            continue
        visited.add(ref)
        node = nodes.get(ref)
        if node is not None:
            for parent_edge in node.parent_goal_refs:
                ancestors.add(parent_edge)
                if parent_edge not in visited:
                    frontier.append(parent_edge)

    history = parent.status_history_refs if parent is not None else ()
    support = parent.support_claim_refs if parent is not None else ()
    achieved = parent.achieved_claim_refs if parent is not None else ()
    disable = parent.disable_reason_refs if parent is not None else ()
    enabled = parent.enabled_goal_refs if parent is not None else ()
    alternatives = parent.alternative_goal_refs if parent is not None else ()
    chain = (
        candidate.goal_dependency_chain_refs + candidate.declared_dependency_chain_refs
        if candidate is not None else ()
    )
    premises = candidate.premise_claim_refs if candidate is not None else ()
    prior_why = lease.parent_goal_why_contract if lease is not None else None
    if context_binding_matches:
        prior_why = context_stack.frames[0].parent_goal_why_contract
    why_reused = (prior_why is not None and lease_matches_intent is True
                  and scope_matches is True and prior_why.parent_goal_ref == parent_ref)
    parent_why = (prior_why if why_reused
                  else _declared_parent_why(request, parent_ref, nodes))
    candidate_why = (parent_why if candidate_terminal == parent_ref
                     else _declared_parent_why(request, candidate_terminal, nodes,
                         source_activation_ref=request.candidate_goal_frontier_activation_ref))
    return GoalParentContinuityMeasurements(
        parent_goal_why_contract=parent_why,
        candidate_goal_why_contract=candidate_why,
        parent_goal_why_provenance_present=bool(parent_why and parent_why.canonical_origin_refs),
        parent_goal_why_reused=why_reused,
        prior_lease_canonical_state=request.prior_lease_canonical_state,
        prior_information_step_ref=lease.information_step_ref if lease is not None else None,
        prior_parent_continuity_class_ref=lease.parent_continuity_class_ref if lease is not None else None,
        prior_parent_binding_authoritative=qualified_binding,
        prior_context_binding_present=context_binding_present,
        prior_context_binding_matches=context_binding_matches,
        prior_intent_present=prior is not None,
        prior_intent_ref=prior.id if prior is not None else None,
        prior_lease_ref=lease.id if lease is not None else None,
        prior_lease_intent_matches=lease_matches_intent,
        parent_scope_matches=scope_matches,
        prior_action_ref=prior.action_ref if prior is not None else None,
        prior_premise_claim_refs=prior.premise_claim_refs if prior is not None else (),
        prior_expected_effect_class_ref=prior.expected_effect_class if prior is not None else None,
        prior_falsifier_refs=prior.falsifier_refs if prior is not None else (),
        prior_selection_principle_ref=prior.selection_principle_ref if prior is not None else None,
        prior_lease_premise_claim_refs=lease.premise_claim_refs if lease is not None else (),
        prior_lease_expected_effect_ref=lease.expected_effect_ref if lease is not None else None,
        prior_lease_falsifier_refs=lease.falsifier_refs if lease is not None else (),
        prior_lease_generic_principle_ref=lease.generic_principle_ref if lease is not None else None,
        parent_goal_ref=parent_ref,
        # Raw ancestry remains available below, but the already-reconciled
        # source-qualified absence of ownership cannot acquire a parent from
        # a reused generic subgoal. Unqualified or ambiguous ancestry is still
        # reported and must be resolved by SRC rather than erased here.
        parent_graph_relation_present=bool(
            (prior_ancestors or prior_terminal_refs)
            and not (qualified_binding and parent_ref is None)
        ),
        prior_canonical_terminal_refs=tuple(sorted(prior_terminal_refs)),
        parent_goal_node_present=parent is not None,
        parent_lifecycle_status=parent.lifecycle_status if parent is not None else None,
        parent_epistemic_status=parent.epistemic_status if parent is not None else None,
        parent_falsifier_refs=parent.falsifier_refs if parent is not None else (),
        parent_expected_goal_delta_refs=parent.expected_goal_delta_refs if parent is not None else (),
        parent_expected_effect_signature_refs=(parent.expected_effect_signature_refs
                                               if parent is not None else ()),
        parent_concrete_target_ref=parent.concrete_target_ref if parent is not None else None,
        parent_status_history_refs=history,
        parent_status_history_count=len(history),
        parent_support_claim_refs=support,
        parent_support_claim_count=len(support),
        parent_achieved_claim_refs=achieved,
        parent_achieved_claim_count=len(achieved),
        parent_disable_reason_refs=disable,
        parent_disable_reason_count=len(disable),
        parent_enabled_goal_refs=enabled,
        parent_alternative_goal_refs=alternatives,
        candidate_intent_present=candidate is not None,
        candidate_intent_ref=candidate.id if candidate is not None else None,
        candidate_goal_ref=candidate.active_goal_ref if candidate is not None else None,
        candidate_terminal_goal_ref=candidate_terminal,
        candidate_subgoal_ref=candidate.subgoal_ref if candidate is not None else None,
        candidate_terminal_equals_parent=(parent_ref is not None and candidate_terminal == parent_ref),
        candidate_goal_equals_parent=(parent_ref is not None and candidate is not None
                                      and candidate.active_goal_ref == parent_ref),
        candidate_dependency_chain_contains_parent=(parent_ref is not None and parent_ref in chain),
        candidate_ancestor_refs=tuple(sorted(ancestors)),
        candidate_ancestry_contains_parent=(parent_ref is not None and parent_ref in ancestors),
        candidate_discriminating_experiment_ref=(candidate.discriminating_experiment_ref
                                                 if candidate is not None else None),
        candidate_premise_refs=premises,
        candidate_premise_count=len(premises),
        candidate_is_parent_declared_successor=bool(candidate_refs.intersection(enabled + alternatives)),
    )
