"""Current evidence bindings for Source81 calculations; no action authority."""
from copy import deepcopy


def current_entry(policy, scene, control, peer_signature, question, floor, observation):
    if scene is None or control is None or question is None:
        return None
    body_matches = [e for e in observation['entities'] if e['signature'] == control['signature']]
    peer_matches = [e for e in observation['entities'] if e['signature'] == peer_signature]
    facts = {
        'current_control_binding': len(body_matches) == 1
            and body_matches[0]['bbox'] == scene['body']['bbox']
            and control.get('binding', {}).get('status') == 'conditional_control_bound'
            and control.get('workflow', {}).get('src_status') == 'completed',
        'retained_parent_question': bool(question.get('id') and question.get('evidence'))
            and len(peer_matches) == 1 and peer_matches[0]['bbox'] == scene['peer']['bbox'],
        'current_observed_support': floor is not None and bool(control.get('support_evidence')),
        'current_geometry_binding': bool(scene.get('grid') and scene.get('bodykey') in scene.get('tiles', {})),
    }
    receipt = {
        'epoch': observation['level_epoch'], 'observation_ref': observation['observation_ref'],
        'body_signature': control['signature'], 'peer_signature': peer_signature,
        'body_box': list(scene['body']['bbox']), 'peer_box': list(scene['peer']['bbox']),
        'parent_ref': question['id'], 'control_binding': deepcopy(control.get('binding')),
        'control_workflow': deepcopy(control.get('workflow')),
        'control_evidence': list(control.get('evidence', [])),
        'support_values': [] if floor is None else [floor],
        'support_evidence': list(control.get('support_evidence', [])),
        'current_grid': deepcopy(scene['grid']),
    }
    result, workflow = policy.source81_entry({'facts': facts, 'receipt': receipt,
                                            'available_action_refs': observation['available_action_refs']})
    if result['status'] != 'current_prospective_entry':
        return None
    parent = deepcopy(question)
    parent['peer_entity_ref'] = peer_matches[0]['id']
    parent['peer_binding'] = {'signature': peer_signature,
                              'observation_ref': observation['observation_ref'],
                              'epoch': observation['level_epoch'],
                              'claim_ref': result['claim']['ref']}
    return {'result': result, 'workflow': workflow, 'parent_question': parent,
            'binding_claim_refs': [result['claim']['ref']],
            'explicit_operator_candidates': result['explicit_operator_candidates']}
