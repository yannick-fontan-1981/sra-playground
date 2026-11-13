"""Bind an untested local transition after an observed approach-child return."""
from terminal_composition import identity
from .geometry import footprint

def contour(rows,point,size,exclude=None):
 x,y=point;w,h=size
 cells={(i,j) for i in (x-1,x+w) for j in range(y,y+h)}
 cells.update((i,j) for j in (y-1,y+h) for i in range(x,x+w))
 return [[i,j,rows[j][i]] for i,j in sorted(cells) if 0<=j<len(rows) and 0<=i<len(rows[0])
         and not (exclude and exclude[0]<=i<exclude[0]+w and exclude[1]<=j<exclude[1]+h)]

def resume(pending,current,observation,facts,remaining,available,forecast):
 if not pending or remaining<2 or not forecast or forecast['steps_before_empty']<2:return None
 plan=pending['plan'];step=plan['steps'][0];size=plan['size'];refs=plan['role_refs']
 if ((pending['after'],plan['level_epoch'],plan['score'],plan['facts_pair'])!=
     (current.ref,current.epoch,current.score,facts.get('pair_ref'))):return None
 if current.ref!=observation['observation_ref'] or facts.get('alignment_refuted'):return None
 if not all(ref in current.roles for ref in refs):return None
 origin=[min(current.roles[ref][i] for ref in refs) for i in (0,1)]
 if origin!=step['from'] or step['action_ref'] not in available:return None
 if identity(footprint(current.rows,origin,size))!=plan['footprint_sha']:return None
 if identity(footprint(current.rows,step['to'],size))!=step['surface_sha']:return None
 if contour(current.rows,step['to'],size,step['from'])!=plan['untested_contour']:return None
 exit_=plan['exit_candidate']
 if identity(footprint(current.rows,exit_['to'],size))!=exit_['surface_sha']:return None
 if exit_['action_ref'] not in available:return None
 key='entry_probe';actions=[{'action_ref':step['action_ref']}]
 proof=[pending['before'],pending['after'],*plan['evidence']]
 facts.update(entry_probe_bound=True,controlled_xy=origin,entry_probe_xy=step['to'],entry_access_return=pending['return_ref'])
 facts['routes'][key]={'start_xy':origin,'end_xy':step['to'],'actions':actions,'observation_ref':current.ref,
                      'level_epoch':current.epoch,'contact_in_prefix':True,'full_access_length':1}
 return {**plan,'route_key':key,'observation_ref':current.ref,'trial':identity([current.ref,key,actions]),
         'evidence':proof,'last_effect_unknown':True,'contact_in_prefix':True,'access_phase':'discriminant',
         'goal_xy':step['to'],'full_access_length':1,'information_cost':1,'reserve_after_probe':forecast['steps_before_empty']-1,
         'risks':['untested_contour_may_cause_nonlocal_motion','control_or_resource_loss','reverse_is_not_yet_observed_in_this_epoch'],
         'alternatives':['test_another_control_axis','return_over_previously_traversed_surface'],
         'predictions':{'local_translation':step['to'],'different_effect':'stop_and_measure_current_position_and_composition'},
         'parent_return_ref':pending['return_ref']}
