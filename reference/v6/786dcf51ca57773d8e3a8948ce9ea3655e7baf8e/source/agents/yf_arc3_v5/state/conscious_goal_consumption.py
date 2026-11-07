"""Revalidate named consumption dependencies without perception or goal selection."""
from agents.yf_arc3_v5.capabilities.goal_frontier_review import measure_current_goal_dependencies
from agents.yf_arc3_v5.logos.operations import OperationalConsciousnessReevaluationRecord


def require_current_goal_consumption_evidence(store, uses, *, timeline_ref, frame_ref):
    """A current receipt does not make its mutable evidence current forever.

    The original Source goal declarations delimit the read. Canonical terms,
    claims, expiry, referenced goal definitions, engagements and returned
    observations are measured now by the same kernel used during consumption.
    This does not reinterpret pixels, choose a goal, or grant a new action.
    """
    for use in uses:
        store.operational_consciousness.require_goal_consumption_use(use,
            timeline_ref=timeline_ref, execution_scope=use.execution_scope)
        record = store.artifact(use.consumption_ref)
        if (not isinstance(record, OperationalConsciousnessReevaluationRecord)
                or record.dependency_goal_facts is None or record.projection_input_facts is None):
            raise ValueError('operational consciousness: consumed goal needs a qualified dependency basis')
        demand = record.demand
        measured = measure_current_goal_dependencies(goal_ref=use.goal_ref,
            facts=record.projection_input_facts[use.goal_ref], goal_facts=record.dependency_goal_facts,
            store=store, timeline_ref=timeline_ref, frame_ref=frame_ref,
            execution_scope=use.execution_scope)
        if (measured.bindings != demand.dependency_versions
                or measured.unresolved_refs != demand.semantic_inputs['unresolved_refs']):
            raise ValueError('operational consciousness: consumed goal dependencies changed before action')
    return uses
