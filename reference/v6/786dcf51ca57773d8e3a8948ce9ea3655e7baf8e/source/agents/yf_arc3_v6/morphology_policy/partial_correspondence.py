"""Retain a previously observed framed object through a bound border occlusion.

Only a border may be hidden here: every interior pixel and every corner must
still agree. This does not reconstruct unknown shape, color or orientation.
"""
from terminal_composition import identity,registered

def retain(history,current,parts,contacts):
    from .geometry import pairs,rigid_role,footprint,pair_key,intersects
    control=rigid_role(history,current,parts)
    if control is None:return None
    refs,motions,position,size=control;origin=position(current)
    if origin is None:return None
    body=(*origin,origin[0]+size[0]-1,origin[1]+size[1]-1)
    for before,command,after in reversed(history):
        if before.epoch!=current.epoch or before.score!=current.score:continue
        candidates,_=pairs(before.rows)
        if len(candidates)!=1:continue
        # The most recent complete comparison is authoritative for this local
        # retention; do not search older evidence after a contrary appearance.
        pair=candidates[0];key=pair_key(pair);contact=contacts.get((current.epoch,key))
        if not contact or not registered(before,current) or position(before) is None:return None
        peer=tuple(contact['peer'])
        if peer not in map(tuple,pair['sites']):return None
        if footprint(current.rows,origin,size)!=footprint(before.rows,position(before),size):return None
        overlap=[tuple(site) for site in pair['sites'] if intersects(body,site)]
        if overlap!=[peer]:return None
        visible=[];hidden=[];changes=[]
        for site in pair['sites']:
            l,t,r,b=site
            for y in range(t,b+1):
                for x in range(l,r+1):
                    masked=body[0]<=x<=body[2] and body[1]<=y<=body[3]
                    if masked:
                        # Corners and symbolic interior are never imputed.
                        if (x in (l,r) and y in (t,b)) or (l<x<r and t<y<b):return None
                        hidden.append([x,y])
                        if before.rows[y][x]!=current.rows[y][x]:changes.append([x,y])
                    else:
                        if before.rows[y][x]!=current.rows[y][x]:return None
                        visible.append([x,y,current.rows[y][x]])
        if not hidden or not changes:return None
        return pair,control,{'status':'border_occluded_interior_observed','before':before.ref,'after':current.ref,
           'epoch':current.epoch,'pair_ref':identity([current.epoch,key]),'peer':list(peer),'body':list(body),
           'visible_pixels':visible,'hidden_pixels':hidden,'changed_pixels':changes,
           'falsifiers':['visible_anchor_or_interior_changes','body_identity_or_pose_changes','epoch_changes','another_overlap_explanation'],
           'inference':'the same framed carrier persists behind the currently observed participant; its concealed border is unknown'}
    return None

def interior_probe(current,pair,control,support,facts,available,remaining,forecast):
    from .geometry import footprint,enclosed
    refs,motions,position,size=control;origin=position(current);peer=support['peer'];choices=[]
    if remaining is not None and remaining<1:return {}
    if forecast is not None and forecast['steps_before_empty']<1:return {}
    for action,(dx,dy) in motions.items():
        if action not in available:continue
        dest=origin[0]+dx,origin[1]+dy;box=(*dest,dest[0]+size[0]-1,dest[1]+size[1]-1)
        surface=footprint(current.rows,dest,size)
        if surface is not None and enclosed(box,peer):choices.append((action,dest,surface))
    if len(choices)!=1:return {}
    action,dest,surface=choices[0];actions=[{'action_ref':action}];key='peer'
    step={'from':list(origin),'to':list(dest),'action_ref':action,'surface_sha':identity(surface)}
    facts.update(peer_xy=list(dest),partial_correspondence=True,correspondence_visibility=support,
                 final_capacity_step=bool(forecast and forecast['steps_before_empty']==1))
    facts['routes'][key]={'start_xy':list(origin),'end_xy':list(dest),'actions':actions,'observation_ref':current.ref,
                         'level_epoch':current.epoch,'contact_in_prefix':True,'full_access_length':1,'goal_xy':list(dest)}
    return {key:{'route_key':key,'steps':[step],'size':list(size),'footprint_sha':identity(footprint(current.rows,origin,size)),
       'role_refs':refs,'pair':pair,'trial':identity([current.ref,'partially_occluded_contact',dest]),'score':current.score,
       'level_epoch':current.epoch,'observation_ref':current.ref,'access_phase':'contact','contact_in_prefix':True,
       'full_access_length':1,'goal_xy':list(dest),'last_effect_unknown':True,'partial_correspondence':support,
       'evidence':[support['before'],support['after']],
       'predicted_position_if_local':list(dest),'expected_terminal':False,
       'risks':['contact_may_be_blocked_or_nonterminal','depletion_order_unverified' if facts['final_capacity_step'] else 'unknown_contact_effect']}}
