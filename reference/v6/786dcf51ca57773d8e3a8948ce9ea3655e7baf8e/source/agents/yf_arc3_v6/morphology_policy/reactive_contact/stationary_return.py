"""Source81 preparation → inverse → independent access → sealed contact.

This module only carries a selected geometric contrast and reconciles public
responses. Selection/release stay in DRM/SRC. The inverse is never presumed.
"""
from copy import deepcopy
import hashlib,json


def _digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()


def _shape(entity):
    mask=entity.get('mask')
    return (entity.get('area'),tuple(sorted(tuple(p)for p in mask))) if mask is not None else None


def _same_current(obs, prior):
    rows=[e for e in obs.get('entities',()) if e.get('signature')==prior['signature']]
    return rows[0]if len(rows)==1 else None


def _part_at_pose(obs, prior, *, causal_operator_recolor=False):
    rows=[e for e in obs.get('entities',()) if list(e['bbox'])==list(prior['bbox'])
          and _shape(e)==_shape(prior) and _shape(prior)is not None
          and (causal_operator_recolor or e.get('signature')==prior['signature'])]
    return rows[0]if len(rows)==1 else None


def retain_selected(scene, question, recipe, row, subject, observation_ref, epoch, selection_ref, prior=None, *, binding=None):
    """Keep a DRM-selected current stationary contrast, not a route from oracle."""
    if not selection_ref or not question.get('id') or not row.get('candidate_ref'):
        raise ValueError('Selected parent and geometric contrast references required')
    if (not binding or binding.get('observation_ref')!=observation_ref or binding.get('epoch')!=epoch
            or row.get('actor_component_ref')!=binding.get('actor_ref')
            or row.get('peer_component_ref')!=binding.get('peer_ref')):
        raise ValueError('Selected geometry is not bound to the current parent actor and pursued peer')
    # Component references belong to the V5 geometric inventory; entity IDs
    # belong to the current neutral observation.  The caller must supply the
    # explicit projection join, never compare names across these spaces.
    if row.get('part_entity_ref')is not None:
        if (not binding.get('part_entity_ref')
                or row['part_entity_ref']!=binding['part_entity_ref']
                or subject.get('id')!=binding['part_entity_ref']):
            raise ValueError('Selected geometry has no current part entity correspondence')
    if (row.get('part_component_ref')is not None
            and row['part_component_ref']!=binding.get('part_ref')):
        raise ValueError('Selected geometry changed the acquired part component')
    if not isinstance(row.get('access_distance'),int) or row['access_distance']<0:
        raise ValueError('Selected preparation has no measured access distance')
    required=('independent_terminal','stationary_part_neighbor_loss',
              'joint_terminal_reachable','peer_exit_count_after_independent_actor','future_part_cells')
    has_stationary_contrast=all(k in row for k in required)
    if any(k not in row for k in('grip_root','peer_cell','part_cells')):
        raise ValueError('Incomplete selected preparation geometry')
    if recipe.get('scope')!=epoch or not recipe.get('evidence'):
        raise ValueError('Current acquired coupling evidence missing')
    operator=recipe.get('operator_action_ref');refs=recipe.get('operator_observation_refs',())
    if not operator or not refs:raise ValueError('Actual acquisition operator was not retained')
    if list(subject['bbox'])!=list(recipe['subject_box']):raise ValueError('Current prepared part mismatch')
    offset=[subject['bbox'][i]-scene['body']['bbox'][i]for i in(0,1)]
    if offset!=list(recipe['offset']):raise ValueError('Current coupling relation mismatch')
    ref='prepared-constraint:'+_digest([epoch,question['id'],row['candidate_ref'],observation_ref])
    same_target=bool(prior and prior['epoch']==epoch and prior['parent_ref']==question['id']
                     and list(prior['geometry_row']['grip_root'])==list(row['grip_root'])
                     and prior.get('grid')==scene['grid'])
    contract=row.get('prepared_constraint_contract')
    if contract is not None:
        proposed=row.get('prepared_constraint_ref')
        if not proposed or contract.get('ref')!=proposed or contract.get('status')!='PROPOSED' or contract.get('parent')!=question['id']or contract.get('scope')!=epoch or contract.get('source_frame_ref')!=observation_ref or contract.get('coupling_claim_refs')!=recipe.get('method_claim_refs'):
            raise ValueError('Prepared proposal reference is not bound to its current parent, scope and acquired coupling')
        ref=proposed;same_target=bool(same_target and prior['ref']==proposed)
    elif same_target:ref=prior['ref']
    return {'ref':ref,'parent_ref':question['id'],'epoch':epoch,
            'phase':('inverse_question_pending'if has_stationary_contrast else'preparation_geometry_question')if row['access_distance']==0 else'loaded_preparation_access',
            'epistemic_status':'proposed','selection_ref':selection_ref,'geometry_row':deepcopy(row),
            'grid':deepcopy(scene['grid']),'target_retained':same_target,
            'role_binding':deepcopy(binding),
            'stationary_contrast_available':has_stationary_contrast,
            'supersedes_prepared_ref':prior.get('ref')if prior and not same_target else None,
            'body':deepcopy(scene['body']),'peer':deepcopy(scene['peer']),'part':deepcopy(subject),
            'operator_action_ref':operator,'operator_observation_refs':list(refs),
            'coupling_evidence':list(recipe['evidence']),'evidence':[observation_ref],
            'part_stationary_independence_observed':False,'capture_law_proved':False,
            'falsifiers':['stationary_part_or_independent_access_not_preserved',
                          'current_scope_or_identity_unresolved','official_contact_does_not_complete_parent']}


def record_loaded(prepared, before, after, command, expected_body_box, expected_part_box, *, at_target=False):
    """A useful approach step returns to the same retained preparation target."""
    p=deepcopy(prepared)
    if p['phase']not in('loaded_preparation_access','loaded_preparation_revalidation_required'):
        raise ValueError('No selected preparation access is active')
    prior=current_binding(p,before)
    if not prior['admitted'] or list(prior['body']['bbox'])!=list(p['body']['bbox']):
        raise ValueError('Loaded approach did not start at its actual bound composition')
    refs=[before['observation_ref'],after['observation_ref']]
    if refs[0]==refs[1]:raise ValueError('Loaded approach lacks a new actual response')
    if after['levels_completed']>before['levels_completed']:
        p['phase']='official_completion';p['official_completion_evidence']=refs;return p
    if after['level_epoch']!=p['epoch']:
        p['phase']='current_binding_unresolved';p['scope_change_refs']=refs;return p
    body=_same_current(after,p['body']);wanted=deepcopy(p['part']);wanted['bbox']=list(expected_part_box)
    part=_part_at_pose(after,wanted);peer=_same_current(after,p['peer'])
    body_ok=bool(body and list(body['bbox'])==list(expected_body_box));part_ok=part is not None
    peer_same=bool(peer and list(peer['bbox'])==list(p['peer']['bbox']))
    p['last_loaded_reply']={'evidence':refs,'command':deepcopy(command),'body_arrival_matched':body_ok,
                           'part_arrival_matched':part_ok,'peer_premise_preserved':peer_same,
                           'target_ref':p['ref'],'target_reached_geometrically':bool(at_target and body_ok and part_ok),
                           'capture_or_constraint_proved':False}
    p['evidence']=list(dict.fromkeys([*p['evidence'],*refs]))
    if body_ok and part_ok:
        p['body']=deepcopy(body);p['part']=deepcopy(part)
        p['phase']=('preparation_pose_reached_requires_current_geometry'if at_target and peer_same else
                    'loaded_preparation_access'if peer_same else'loaded_preparation_revalidation_required')
    else:p['phase']='current_binding_unresolved'
    p['current_peer_revalidated']=peer is not None
    if peer:p['peer']=deepcopy(peer)
    return p


def facts(prepared, row=None):
    """Current facts for the three existing Source81 DRM branches."""
    p=prepared or {};row=row or {};phase=p.get('phase')
    return {'prepared_constraint_experiment':bool(p.get('ref')),
            'current_parent_peer_bound':bool(p.get('role_binding')),
            'candidate_is_prepared_inverse_operator':phase=='inverse_question_pending',
            'prospective_grasp_prepared_constraint_ref':p.get('ref'),
            'prospective_grasp_prepared_constraint_claim_refs':[p['ref']]if p.get('ref')else[],
            'prospective_grasp_coupling_claim_refs':p.get('coupling_evidence',[]),
            'prospective_grasp_operator_observation_refs':p.get('inverse_reply_refs',[]),
            'prospective_grasp_independent_motion':row.get('independent_motion_present')is True,
            'prospective_grasp_conditional_peer_contact':row.get('conditional_peer_contact')is True,
            'prospective_grasp_independence_observed':p.get('part_stationary_independence_observed')is True,
            'prospective_grasp_peer_exit_count_after_independent_actor':row.get('peer_exit_count_after_independent_actor'),
            'prospective_grasp_stationary_part_neighbor_loss':row.get('stationary_part_neighbor_loss')}


def current_binding(prepared, observation):
    if observation['level_epoch']!=prepared['epoch']:
        return {'admitted':False,'reason':'prepared_constraint_scope_changed'}
    body=_same_current(observation,prepared['body']);peer=_same_current(observation,prepared['peer'])
    part=_part_at_pose(observation,prepared['part'])
    return {'admitted':bool(body and peer and part),'reason':'current_distinct_body_peer_and_stationary_part',
            'body':body,'peer':peer,'part':part,'prepared_constraint_ref':prepared['ref']}


def record_inverse(prepared, before, after, command):
    p=deepcopy(prepared)
    if p['phase']!='inverse_question_pending' or command!={'action_ref':p['operator_action_ref']}:
        raise ValueError('Inverse reply is not the selected acquired operator')
    if before['level_epoch']!=p['epoch'] or before['observation_ref']==after['observation_ref']:
        raise ValueError('Inverse reply scope or actual response missing')
    prior=current_binding(p,before)
    if not prior['admitted'] or list(prior['body']['bbox'])!=list(p['body']['bbox']):
        raise ValueError('Inverse did not start at its currently bound preparation')
    refs=[before['observation_ref'],after['observation_ref']]
    if after['levels_completed']>before['levels_completed']:
        p['phase']='official_completion';p['official_completion_evidence']=refs;return p
    if after['level_epoch']!=p['epoch']:
        p['phase']='current_binding_unresolved';p['scope_change_refs']=refs;return p
    body=_same_current(after,p['body'])
    # Palette may change at the actual bound operator. Geometry/unique causal
    # occurrence must persist; a recolor alone is explicitly not detachment.
    part=_part_at_pose(after,p['part'],causal_operator_recolor=True)
    same_pose=bool(body and list(body['bbox'])==list(p['body']['bbox'])and part)
    p['inverse_reply_refs']=refs;p['evidence']=list(dict.fromkeys([*p['evidence'],*refs]))
    p['inverse_observation']={'body_pose_preserved':same_pose,
                             'part_unique_same_geometry':part is not None,
                             'appearance_changed':bool(part and part.get('signature')!=p['part']['signature']),
                             'detachment_proved':False}
    if same_pose:p['part']=deepcopy(part);p['body']=deepcopy(body)
    p['phase']='independent_probe_required'if same_pose else'current_binding_unresolved'
    return p


def record_independent(prepared, before, after, command, expected_body_box):
    p=deepcopy(prepared)
    if p['phase']not in('independent_probe_required','independent_access'):
        raise ValueError('No returned inverse awaiting independent access')
    refs=[before['observation_ref'],after['observation_ref']]
    if before['level_epoch']!=p['epoch'] or before['observation_ref']==after['observation_ref']:
        raise ValueError('Independent reply lacks its scoped actual response')
    prior=current_binding(p,before)
    if not prior['admitted'] or list(prior['body']['bbox'])!=list(p['body']['bbox']):
        raise ValueError('Independent access did not start at its current bound body and part')
    if after['levels_completed']>before['levels_completed']:
        p['phase']='official_completion';p['official_completion_evidence']=refs;return p
    if after['level_epoch']!=p['epoch']:
        p['phase']='current_binding_unresolved';p['scope_change_refs']=refs;return p
    body=_same_current(after,p['body']);part=_part_at_pose(after,p['part'])
    moved=bool(body and list(body['bbox'])==list(expected_body_box)
               and list(body['bbox'])!=list(p['body']['bbox']))
    independent=bool(moved and part)
    p['last_independent_reply']={'evidence':refs,'command':deepcopy(command),
        'body_arrival_matched':moved,'part_stationary_currently_matched':part is not None,
        'independence_observed':independent,'capture_proved':False}
    p['evidence']=list(dict.fromkeys([*p['evidence'],*refs]))
    if independent:
        p['body']=deepcopy(body);p['part']=deepcopy(part)
        p['part_stationary_independence_observed']=True;p['phase']='independent_access'
    else:p['phase']='independence_unresolved_or_contradicted'
    # Peer motion is a reason to recompute independent_inventory, not to erase
    # the separately observed stationary part and moving controlled body.
    peer=_same_current(after,p['peer'])
    p['current_peer_revalidated']=peer is not None
    if peer:p['peer']=deepcopy(peer)
    return p
