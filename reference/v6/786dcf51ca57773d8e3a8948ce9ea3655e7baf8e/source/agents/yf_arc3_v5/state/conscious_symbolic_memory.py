"""Reference index of Source-consumed state edges; no inferred transition law."""
from agents.yf_arc3_v5.logos.operations import OperationalConsciousnessReevaluationRecord, ControlEvidenceSignature
from agents.yf_arc3_v5.logos.types import FrozenMap, stable_digest


def symbolic_edge_signature(fields, transition):
    # Keep identity ambiguity in the key: a later clear identity must not erase
    # an earlier uncertain association just because its visible values match.
    states = tuple(FrozenMap({ref: tuple(FrozenMap({
        'state': FrozenMap({field: pose[field] for field in fields if field in pose}),
        'possible_predecessor_entity_refs': pose.get('possible_predecessor_entity_refs', ())})
        for pose in variants) for ref, variants in sorted(transition[side].items())}) for side in ('before', 'after'))
    bindings = tuple(sorted(set(tuple(refs) for _, refs in sorted(transition['historical_bindings'].items()))))
    control = transition['control_signature']
    recall_key = ControlEvidenceSignature.model_validate(control).response_recall_key() if control is not None else None
    return stable_digest((tuple(fields), states, bindings, transition['action_ref'],
        transition['action_data'], recall_key))


def index_consumed_symbolic_edges(index, artifact, *, field_name='symbolic_observation_fields'):
    if (not isinstance(artifact, OperationalConsciousnessReevaluationRecord)
            or artifact.status != 'consumed' or artifact.consumption_ref != artifact.id
            or artifact.demand.kind != 'native_means_review' or artifact.projection_facts is None):
        return
    demand = artifact.demand
    scope = tuple(demand.execution_scope.get(name) for name in ('game_ref', 'level_ref', 'session_ref'))
    for application in artifact.projection_facts.get('application_reviews', ()):
        domain = application['domain']
        fields = domain.get(field_name, ())
        observed = domain.get('observed_return_context') or FrozenMap()
        transition = observed.get('participant_transition')
        if not fields or transition is None or observed.get('observed_binding_missing_refs'):
            continue
        key = (artifact.timeline_id, *scope, domain['goal_ref'], domain['mechanism_ref'])
        signature = symbolic_edge_signature(fields, transition)
        bucket = index.setdefault(key, {})
        previous = bucket.get(signature)
        # Re-consuming the same observation must not invalidate itself forever.
        if previous is not None and previous['goal_review_ref'] == observed['goal_review_ref']:
            continue
        bucket[signature] = FrozenMap({'edge_signature': signature,
            'source_review_ref': artifact.id, 'goal_review_ref': observed['goal_review_ref']})
