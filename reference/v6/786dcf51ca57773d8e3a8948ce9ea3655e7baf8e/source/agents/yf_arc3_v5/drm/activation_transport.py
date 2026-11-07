"""Exact field conservation for the declared operational goal activation."""
from collections.abc import Mapping

from agents.yf_arc3_v5.capabilities.contracts import DynamicGoalFrontierActivation
from agents.yf_arc3_v5.logos.types import immutable_json_data

ACTIVATION_RULE_REF = 'rule.dynamic_goal_frontier_activation_meaning'


def activation_field_contract(configuration):
    contract = configuration.get('activation_transport')
    if not isinstance(contract, Mapping):
        raise ValueError('activation transport requires its declared field contract')
    groups = []
    for key in ('identity_field_refs', 'provenance_field_refs', 'semantic_field_refs'):
        refs = contract.get(key)
        if not isinstance(refs, (tuple, list)) or any(not isinstance(ref, str) for ref in refs):
            raise ValueError('activation transport requires explicit field dispositions')
        groups.extend(refs)
    if (len(set(groups)) != len(groups) or set(groups) != set(DynamicGoalFrontierActivation.model_fields)
            or tuple(contract['identity_field_refs']) != ('activation_ref',)
            or tuple(contract['provenance_field_refs']) != ('scene_support_claim_refs',)):
        raise ValueError('activation transport field contract is incomplete or ambiguous')
    return contract


def require_activation_payload_conservation(configuration, facts, terms, conclusions):
    """Compare actual emitted content; never select a goal or repair missing meaning."""
    activation_field_contract(configuration)
    expected = {key: immutable_json_data(facts[key])
        for key in DynamicGoalFrontierActivation.model_fields if key in facts}
    events = tuple(term for term in terms
        if term.attributes.get('event_kind') == 'dynamic_goal_frontier_activation')
    claims = tuple(claim for claim in conclusions if claim.predicate == 'dynamic_goal_frontier_activation')
    if len(events) != 1 or len(claims) != 1:
        raise ValueError('activation transport requires one actual event and one origin conclusion')
    for record, excluded in ((events[0], {'activation_ref'}), (claims[0], set())):
        lost = tuple(key for key, value in sorted(expected.items()) if key not in excluded
            and (key not in record.attributes or immutable_json_data(record.attributes[key]) != value))
        if lost:
            raise ValueError('activation transport lost or changed declared fields: ' + ','.join(lost))
