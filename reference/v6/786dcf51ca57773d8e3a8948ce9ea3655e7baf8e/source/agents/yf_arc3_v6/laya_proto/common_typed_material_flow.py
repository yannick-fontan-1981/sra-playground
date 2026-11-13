"""Common material/pose questions through the existing public point provider."""
from common_occurrence_recall import OccurrenceRecallConstraint
from typed_pose_access import TypedPoseAccess
from common_multiscale_constraints import projection,rows_digest
from agents.yf_arc3_v6.morphology_policy.src_runtime import plain
from terminal_composition import identity
FLAGS=('typed_carrier_plan','material_flow_plan','material_pose_plan')
class TypedMaterialConstraint(OccurrenceRecallConstraint):
    def __init__(self):super().__init__();self.memory=TypedPoseAccess()
    def material_propose(self,obs,rows,inputs,remaining,config):
        if remaining<1 or 'ACTION6'not in obs['available_action_refs']:return None
        self.memory.pose_limit=min(16,remaining);p=self.memory.carrier_question(obs,rows,plain(config))
        if not p:return None
        plan=next(p[k]for k in FLAGS if k in p);p['steps'][0]['expected_before']={k:obs[k]for k in ('level_epoch','frame_hash','levels_completed','state')}
        selected=(plan['child']if plan['mode']=='select'else plan['control'])if 'material_pose_plan'in p else plan['selected'];box=selected['bbox']
        for index,(action,step)in enumerate(zip(p['actions'],p['steps'])):
            x,y=action['data']['x'],action['data']['y'];assert box[0]<=x<=box[2]and box[1]<=y<=box[3]
            step['point_support']={'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref'],'frame_hash':obs['frame_hash'],'point':[x,y],'palette_value':rows[y][x],'projection_bbox':box,'projected_rows_digest':rows_digest(projection(rows,box)),'entity_ref':'measured-material-support:'+identity([box,[x,y],selected]),'signature':identity([selected,index]),'scope':'Observed carrier/request/control support plus the library full-frame or conditional typed-pose/exterior guard. No private role or game-specific coordinate.'}
        return p
    def bind(self,p,domain):
        if not any(k in p for k in FLAGS):return super().bind(p,domain)
        first=p['steps'][0]['expected_before'];assert (first['level_epoch'],first['frame_hash'])in domain.bindings
        for action,step in zip(p['actions'],p['steps']):
            support=step['point_support'];assert support['point']==[action['data']['x'],action['data']['y']];step['point_binding']=dict(support)
    def restore(self,state):
        rebuilt=TypedPoseAccess()
        for event in state['events']:rebuilt.apply_event(event)
        if rebuilt.retained_digest()!=state['digest']:raise ValueError('Material/pose memory changed during recall')
        self.memory=rebuilt;self.events=list(state['events'])
