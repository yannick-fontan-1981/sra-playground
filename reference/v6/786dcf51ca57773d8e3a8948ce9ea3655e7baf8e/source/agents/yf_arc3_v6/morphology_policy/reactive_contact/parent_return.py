"""Measured means returned to their retained parent; no action authority.

Geometry is delegated to the V5-backed escape-domain projection. This adapter
transports candidates, current bindings and observations; DRM chooses and SRC
releases. A geometric restriction of exits is not a capture or a flee law.
"""
from copy import deepcopy
import hashlib
import json


def _digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def _box_shift(box, delta):
    return [v + delta[i % 2] for i, v in enumerate(box)]


def _members(scene):
    # The current discovery filter may omit an acquired recoloured member.
    # This union is used only with its exact retained relation, not to discover
    # arbitrary new manipulable objects. Duplicate representations count once.
    result = []
    for e in [*scene['stones'], *scene.get('current_entities', ())]:
        if not any(e.get('id') == old.get('id') and e.get('signature') == old.get('signature')
                   and e['bbox'] == old['bbox'] for old in result):
            result.append(e)
    return result


def _binding(scene, question, recipe, epoch):
    if not scene or not question or not question.get('id') or not question.get('evidence'):
        return None, 'durable_parent_or_current_scene_missing'
    if question.get('status') in ('satisfied', 'closed', 'refuted'):
        return None, 'parent_not_open'
    if not recipe or recipe.get('status') != 'observed_nonpushing_common_translation':
        return None, 'common_translation_not_observed'
    if recipe.get('scope') != epoch or not recipe.get('evidence'):
        return None, 'recipe_scope_or_evidence_missing'
    body = scene['body']
    matches = [s for s in _members(scene)
               if list(s['bbox']) == list(recipe['subject_box'])
               and s['palette_value'] == recipe['subject_value']]
    if len(matches) != 1:
        return None, 'current_member_not_unique'
    subject = matches[0]
    if list(subject['bbox']) in (list(body['bbox']), list(scene['peer']['bbox'])):
        return None, 'service_member_is_control_or_pursued_peer'
    offset = [subject['bbox'][i] - body['bbox'][i] for i in (0, 1)]
    if offset != list(recipe['offset']):
        return None, 'current_member_relation_contradicts_recipe'
    return subject, None


def offers(scene, question, recipe, directions, remaining, observation_ref, epoch):
    """Return (candidate offers, diagnostic), without selecting any candidate.

    Full conditional access is retained, up to the existing 16-action release
    limit. Each step requires unchanged peer and rigid relation; any reaction
    seals the suffix and the current parent is reconsidered with that evidence.
    """
    subject, refusal = _binding(scene, question, recipe, epoch)
    if refusal:
        return [], {'status': 'abstain', 'reason': refusal}
    from .escape_domain import project
    projection = project(scene, recipe, observation_ref, epoch)
    evidence = list(dict.fromkeys([observation_ref, *question['evidence'], *recipe['evidence']]))
    rows = []
    for placement in projection.get('placements', ()):
        geometry = placement.get('geometry', {})
        # A changed geometric domain is an informative candidate, not a capture.
        if not geometry.get('removed_peer_destinations'):
            continue
        keys = list(placement.get('route_keys', ()))
        if keys and keys[0] == scene['bodykey']:
            keys = keys[1:]
        previous = scene['bodykey']; actions = []; expected = []; parts = []
        valid = bool(keys)
        for key in keys:
            a, b = scene['tiles'][previous]['box'], scene['tiles'][key]['box']
            delta = [b[0]-a[0], b[1]-a[1]]
            candidates = [name for name, vector in directions.items()
                          if [v*scene['pitch'] for v in vector] == delta]
            if len(candidates) != 1:
                valid = False; break
            actions.append({'action_ref': candidates[0]})
            expected.append(_box_shift(expected[-1] if expected else scene['body']['bbox'], delta))
            parts.append(_box_shift(parts[-1] if parts else subject['bbox'], delta))
            previous = key
        if not valid or len(actions) > remaining:
            continue
        prefix = min(16, len(actions))
        context = _digest([epoch, scene['grid'], scene['body']['bbox'],
                           subject['bbox'], scene['peer']['bbox'], recipe['evidence'],
                           placement['subject_box']])
        prior = question.get('parent_experiments', {}).get(context)
        if prior and prior.get('status') in ('contradicted', 'observed_no_domain_change'):
            continue
        rows.append({
            'kind': 'parent_escape_configuration_access', 'subject': deepcopy(subject),
            'actions': actions[:prefix], 'expected': expected[:prefix],
            'expected_subjects': parts[:prefix], 'expected_subject': parts[prefix-1],
            'expected_peer': list(scene['peer']['bbox']), 'cost': prefix,
            'peer_distance': geometry.get('peer_degree_after', 0),
            'route': keys[:prefix], 'full_access_cost': len(actions),
            'access_complete_in_prefix': prefix == len(actions),
            'body': deepcopy(scene['body']), 'parent': deepcopy(question),
            'context': context, 'evidence': evidence,
            'recipe_binding': deepcopy(recipe), 'epoch': epoch,
            'preserved_subjects': [{'bbox': list(s['bbox']), 'value': s['palette_value']}
                                   for s in scene['stones'] if s['bbox'] != subject['bbox']],
            'facts': {'current_control_bound': True, 'counteracted_approach_observed': True,
                      'subject_current_unique': True, 'retreat_exists': True,
                      # Public available-action domain belongs to the caller.
                      'current_scope_and_input': False,
                      'parent_dependency_satisfied': True,
                      'geometric_exit_change_predicted': True},
            'calculation': {
                'consumer': question['id'], 'dependency': 'observed_common_translation',
                'projection': deepcopy(geometry), 'domain_binding': projection.get('binding'),
                'target_configuration': {'body_box': placement['body_box'],
                                         'subject_box': placement['subject_box']},
                'conditional_model': ['rigid_translation_retains_offset',
                                      'peer_stays_at_current_pose_during_access'],
                'conditional_return_access': list(reversed([scene['bodykey'], *keys[:prefix]])),
                'falsifiers': ['body_or_part_arrival_differs', 'peer_response',
                               'other_subject_changed', 'scope_changed'],
                'unknown': ['flee_policy', 'response_order', 'detach_effect', 'capture_law'],
                'alternatives': deepcopy(question.get('alternatives', [])),
                'capture_or_complete_escape_closure_proved': False,
                'prefix_cut_reason': 'release_limit' if prefix < len(actions) else 'access_then_reobserve_peer'
            }})
    return rows, {'status': 'candidates' if rows else 'abstain',
                  'reason': 'current_parent_configuration_question' if rows else 'no_current_reachable_exit_change',
                  'projection_status': projection.get('status'),
                  'unknowns': projection.get('unknowns', []),
                  'absence_is_not_impossibility': True}


def validate_current(scene, offer, index, epoch):
    """Mechanical per-step current binding; family still checks input/Source."""
    if not scene or epoch != offer['epoch'] or not 0 <= index < len(offer['actions']):
        return {'admitted': False, 'reason': 'scope_or_step_mismatch'}
    body = offer['body']['bbox'] if index == 0 else offer['expected'][index-1]
    part = offer['subject']['bbox'] if index == 0 else offer['expected_subjects'][index-1]
    members = [s for s in _members(scene) if list(s['bbox']) == list(part)
               and s['palette_value'] == offer['subject']['palette_value']
               and s['signature'] == offer['subject']['signature']]
    preserved = all(any(list(s['bbox']) == list(p['bbox']) and s['palette_value'] == p['value']
                        for s in scene['stones']) for p in offer['preserved_subjects'])
    admitted = (list(scene['body']['bbox']) == list(body)
                and scene['body']['signature'] == offer['body']['signature'] and len(members) == 1
                and list(scene['peer']['bbox']) == offer['expected_peer'] and preserved)
    if admitted:
        from .escape_domain import _mask
        from agents.yf_arc3_v5.capabilities.rigid_grasp_geometry import translated_mask, support_collisions
        terrain = {(x, y): ('SUPPORTED', offer['evidence'][0])
                   for k in scene['admitted']
                   for x in range(scene['tiles'][k]['box'][0], scene['tiles'][k]['box'][2]+1)
                   for y in range(scene['tiles'][k]['box'][1], scene['tiles'][k]['box'][3]+1)}
        # Same explicitly conditional vacated-support premise as escape_domain.
        terrain.update({p: ('SUPPORTED', offer['evidence'][0]) for p in _mask(members[0])})
        target = offer['expected'][index]
        delta = [target[i]-scene['body']['bbox'][i] for i in (0, 1)]
        obstacles = [p for s in scene['stones'] if list(s['bbox']) != list(part) for p in _mask(s)]
        blocked, unknown = support_collisions(translated_mask(_mask(scene['body']), delta),
                                              translated_mask(_mask(members[0]), delta),
                                              terrain, [*obstacles, *_mask(scene['peer'])])
        admitted = not blocked and not unknown
    return {'admitted': admitted, 'reason': 'current_parent_rigid_members_peer_and_preservations',
            'parent_ref': offer['parent']['id'], 'method_evidence': offer['recipe_binding']['evidence']}


def reconcile(question, recipe, offer, index, scene, observation_ref, epoch):
    """Return durable updates: current child binding and actual parent receipt.

    A moved peer invalidates the static continuation, but does not erase an
    independently observed common translation or mark the capture parent done.
    """
    q, r = deepcopy(question), deepcopy(recipe)
    prior = q.get('last_parent_consumption', {})
    if (prior.get('offer_context') == offer['context']
            and prior.get('executed_index') == index
            and prior.get('observation_ref') == observation_ref):
        return {'question': q, 'recipe': r, 'receipt': deepcopy(prior)}
    expected_body, expected_part = offer['expected'][index], offer['expected_subjects'][index]
    matched = bool(scene and epoch == offer['epoch']
                   and list(scene['body']['bbox']) == expected_body
                   and scene['body']['signature'] == offer['body']['signature']
                   and sum(list(s['bbox']) == expected_part and s['palette_value'] == r['subject_value']
                           and s['signature'] == offer['subject']['signature']
                           for s in _members(scene)) == 1)
    peer_same = bool(scene and list(scene['peer']['bbox']) == offer['expected_peer'])
    if matched:
        r['subject_box'] = list(expected_part)
        r['evidence'] = list(dict.fromkeys([*r['evidence'], observation_ref]))
    receipt = {'status': 'conditional_access_step_observed' if matched else 'contradicted',
               'parent_ref': q['id'], 'offer_context': offer['context'],
               'observation_ref': observation_ref, 'executed_index': index,
               'rigid_translation_matched': matched, 'peer_stationary_matched': peer_same,
               'parent_goal_satisfied': False,
               'seal_prefix': not matched or not peer_same or index+1 == len(offer['actions'])}
    q['status'] = 'active_with_observed_rigid_transport_method' if matched else 'active_needs_binding_revalidation'
    q['last_parent_consumption'] = receipt
    q.setdefault('parent_experiments', {})[offer['context']] = deepcopy(receipt)
    q['available_method'] = deepcopy(r)
    return {'question': q, 'recipe': r, 'receipt': receipt}
