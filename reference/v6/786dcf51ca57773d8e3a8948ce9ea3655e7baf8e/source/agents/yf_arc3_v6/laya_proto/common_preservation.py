"""Carry acquired observable obligations across proposal providers.

The existing composition contract owns release through preserve_refs and
preservation_evidence. These functions bind the witnesses and check their
public pixel conditions between physical commands.
"""
import copy
from src_bridge import plain


def condition_measure(obligation, rows, observation=None):
    predicate = obligation.get('entity_predicate')
    if predicate:
        if observation is None or 'entities' not in observation:
            return {'matched': False, 'visible': 0, 'occluded': 0, 'reason': 'entity_projection_required'}
        matching = []
        for entity in observation['entities']:
            left, top, right, bottom = entity['bbox']
            excluded = any(box[0] <= left and box[1] <= top and right <= box[2] and bottom <= box[3]
                           for box in predicate.get('exclude_boxes', []))
            if (entity['palette_value'] == predicate['palette_value'] and entity.get('rectangular')
                    and right - left == bottom - top and not excluded):
                matching.append(entity)
        return {'matched': len(matching) >= predicate['minimum_count'], 'visible': len(matching), 'occluded': 0,
                'minimum_count': predicate['minimum_count'], 'scope': 'visible_typed_occurrence_count'}
    covered = set()
    pattern = obligation.get('occluder_mask')
    if pattern and observation:
        for entity in observation.get('entities', []):
            if entity['mask'] == pattern:
                left, top = entity['position']
                covered.update((left + x, top + y) for x, y in pattern)
    visible = [(x, y, value) for x, y, value in obligation['pixels'] if (x, y) not in covered]
    return {'matched': all(rows[y][x] == value for x, y, value in visible),
            'visible': len(visible), 'occluded': len(obligation['pixels']) - len(visible)}


def authorized_revision(proposal, obligation, observation):
    revision = proposal.get('preservation_changes', {}).get(obligation['id'])
    if not revision:
        return False
    commands = proposal['actions']
    declared = revision.get('actions')
    bound_actions = (plain(declared) == plain(commands) and all(command['action_ref'] == revision['action_ref'] for command in commands)
                     if declared is not None else len(commands) == 1 and commands[0]['action_ref'] == revision.get('action_ref'))
    return (revision.get('observation_ref') == observation['observation_ref']
            and revision.get('why') and revision.get('expected_reestablishment')
            and (not obligation.get('revision_inputs') or revision.get('action_ref') in obligation['revision_inputs'])
            and bound_actions)


def bind(proposal, obligations, observation, rows):
    if not obligations or proposal.get('status') != 'proposed':
        return proposal, []
    rejected = []
    for obligation in obligations:
        if not condition_measure(obligation, rows, observation)['matched']:
            return {**proposal, 'status': 'acquired_preservation_condition_changed', 'actions': []}, []
        revised = authorized_revision(proposal, obligation, observation)
        if not revised:
            rejected.extend(command for command in proposal['actions'] if command['action_ref'] in obligation.get('revision_inputs', []))
    if rejected:
        return proposal, rejected
    result = copy.deepcopy(proposal)
    template = result['bundle_template']
    template.setdefault('preservation_evidence', {})
    template.setdefault('preserve_refs', [])
    for obligation in obligations:
        reference = obligation['id']
        if reference not in template['preserve_refs']:
            template['preserve_refs'].append(reference)
        template['preservation_evidence'][reference] = {
            'observation_ref': observation['observation_ref'], 'witness_refs': obligation['evidence'],
            'current_condition_measure': condition_measure(obligation, rows, observation),
            'declared_revision': plain(result.get('preservation_changes', {}).get(reference))}
        result['compositions'].append({'id': reference, 'role': 'preserved_condition', 'observed': True,
                                       'properties': {'condition': obligation['meaning'], 'scope': 'current_epoch'},
                                       'relations': ['contributes_to:G_official_completion']})
    result['preservation'] = {'obligations': copy.deepcopy(obligations), 'level_epoch': observation['level_epoch'],
                              'observation_ref': observation['observation_ref'],
                              'revised_refs': [obligation['id'] for obligation in obligations if authorized_revision(result, obligation, observation)]}
    return result, []


def check(proposal, rows, epoch, *, after=False, boundary=False, observation=None):
    bound = proposal.get('preservation')
    if not bound:
        return {'admitted': True, 'reason': 'no_acquired_preservation_obligation'}
    if after and boundary:
        return {'admitted': True, 'seal_prefix': True, 'reason': 'official_boundary_reconciles_preservation'}
    if epoch != bound['level_epoch']:
        return {'admitted': False, 'seal_prefix': True, 'reason': 'preservation_epoch_changed'}
    changed = []
    unknown = []
    for obligation in bound['obligations']:
        revision = proposal.get('preservation_changes', {}).get(obligation['id'], {})
        if after and obligation['id'] in bound.get('revised_refs', []) and revision.get('revise_condition', True):
            continue
        measured = condition_measure(obligation, rows, observation)
        if not measured['matched']:
            changed.append(obligation['id'])
        if not measured['visible'] and measured.get('occluded'):
            unknown.append(obligation['id'])
    return {'admitted': not changed, 'seal_prefix': bool(changed or unknown),
            'reason': 'acquired_conditions_matched' if not changed else 'acquired_condition_diverged',
            'changed_refs': changed, 'occluded_unknown_refs': unknown}
