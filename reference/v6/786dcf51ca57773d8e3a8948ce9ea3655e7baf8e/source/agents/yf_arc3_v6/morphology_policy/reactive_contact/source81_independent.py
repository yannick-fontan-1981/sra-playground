"""Current parked-member domain after a returned inverse experiment.

This adds no assembly.  Stationarity/independence remain conditional until a
separate movement response is reconciled by stationary_return.record_independent.
"""
from copy import deepcopy
from .stationary_return import current_binding
from .source81_projection import current_independent_inventory


def bind_independent_member(projection, prepared, observation):
    """Return a current Source81 inventory, or an explicit non-release refusal."""
    refused={'status':'unknown','release_authorized':False,
             'inventory':{'enumeration_complete':False,'rows':[],'geometry':{}},
             'parent_inventory':{'enumeration_complete':False,'rows':[]}}
    def no(reason):return {**refused,'reason':reason}
    if not prepared or prepared.get('phase')not in('independent_probe_required','independent_access'):
        return no('returned_inverse_preparation_missing')
    binding=projection.get('binding',{});domain=projection.get('domain',{})
    ref=observation.get('observation_ref');epoch=observation.get('level_epoch')
    if (binding.get('observation_ref')!=ref or domain.get('frame_ref')!=ref
        or binding.get('epoch')!=epoch or prepared.get('epoch')!=epoch):
        return no('current_domain_or_preparation_scope_mismatch')
    if binding.get('part_ref')is not None:
        return no('independent_domain_must_not_assert_bound_pair')
    question=binding.get('parent_question',{})
    if not binding.get('binding_claim_refs')or question.get('id')!=prepared.get('parent_ref'):
        return no('current_parent_or_claim_binding_missing')
    inverse=prepared.get('inverse_observation',{});refs=prepared.get('inverse_reply_refs',())
    if (len(refs)!=2 or refs[0]==refs[1] or not prepared.get('operator_action_ref')
        or not prepared.get('operator_observation_refs') or not prepared.get('ref')
        or inverse.get('body_pose_preserved')is not True
        or inverse.get('part_unique_same_geometry')is not True):
        return no('actual_inverse_receipt_or_current_geometry_missing')
    if prepared['phase']=='independent_probe_required':
        if refs[-1]!=ref:return no('inverse_receipt_not_current')
    else:
        response=prepared.get('last_independent_reply',{})
        if (response.get('independence_observed')is not True
            or response.get('evidence',[None])[-1]!=ref
            or prepared.get('part_stationary_independence_observed')is not True):
            return no('independent_movement_receipt_not_current')
    try:roles=current_binding(prepared,observation)
    except (KeyError,TypeError,ValueError):return no('current_role_binding_incomplete')
    if roles.get('admitted')is not True:return no('current_roles_not_unique')
    if len({roles[k]['id']for k in('body','peer','part')})!=3:
        return no('current_roles_not_distinct')
    mapping=projection.get('component_entity_bindings',{})
    components={}
    for role in('body','peer','part'):
        ids=[c for c,entities in mapping.items()if entities==[roles[role]['id']]]
        if len(ids)!=1 or ids[0]not in domain.get('component_cells',{}):
            return no('current_entity_component_correspondence_not_unique')
        components[role]=ids[0]
    if (components['body']!=binding.get('actor_ref')or components['peer']!=binding.get('peer_ref')
        or roles['peer']['id']!=question.get('peer_entity_ref')):
        return no('current_parent_roles_changed')
    out=deepcopy(projection);bbox=roles['body']['bbox']
    out['binding']={**out['binding'],'part_ref':components['part'],
                    'origin_bbox':[bbox[1],bbox[0],bbox[3],bbox[2]],
                    'prepared_constraint_ref':prepared['ref'],
                    'inverse_reply_refs':list(refs)}
    inventory=current_independent_inventory(out,components['body'],components['peer'],components['part'],
                                            out['binding']['origin_bbox'],prepared['ref'])
    if not inventory:return no('no_independent_geometry_inventory')
    out['inventory']=inventory
    parent_rows=[r for r in inventory.get('rows',[])if r.get('peer_component_ref')==components['peer']]
    out['parent_inventory']={'enumeration_complete':inventory.get('enumeration_complete',False),'rows':parent_rows}
    out['parent_applicability']='current_parent_rows'if parent_rows else'no_current_parent_access'
    out['status']='measured_source81_independent_conditional'
    out['release_authorized']=False
    out['independence']={'status':'observed_locally'if prepared['phase']=='independent_access'else'conditional_until_motion_reply',
                         'detachment_proved':False,'inverse_reply_refs':list(refs),
                         'prepared_constraint_ref':prepared['ref'],
                         'falsifiers':['part_moves_with_body','body_arrival_differs','current_identity_or_scope_changes']}
    out['calculation_refs']=[*out.get('calculation_refs',[]),'Source81.peer_constraint_geometry.independent_inventory']
    return out
