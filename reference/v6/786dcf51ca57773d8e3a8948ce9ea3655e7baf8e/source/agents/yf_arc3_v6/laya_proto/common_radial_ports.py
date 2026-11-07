"""Constrained port composition through current C point and memory guards."""
import copy
from common_typed_material_flow import TypedMaterialConstraint
from radial_ports_access import RadialPortsAccess
from common_multiscale_constraints import projection,rows_digest
from agents.yf_arc3_v6.morphology_policy.src_runtime import plain
from terminal_composition import identity
class RadialPortConstraint(TypedMaterialConstraint):
    def __init__(self):super().__init__();self.memory=RadialPortsAccess()
    def radial_propose(self,obs,rows,inputs,remaining,config):
        if remaining<1 or 'ACTION6'not in obs['available_action_refs']:return None
        cfg=plain(config);assert cfg['use_prior_method']is False
        p=self.memory.propose([],obs,rows,inputs,min(16,remaining),{'radial_port_composition':cfg})
        if not p or 'radial_port_plan'not in p:return None
        plan=p['radial_port_plan'];p['steps']=copy.deepcopy(p['steps']);p['steps'][0]['expected_before']={k:obs[k]for k in ('level_epoch','frame_hash','levels_completed','state')}
        for index,(action,step)in enumerate(zip(p['actions'],p['steps'])):
            cell=plan['scene']['cells'][step['cell']];x,y=cell['point'];assert action=={'action_ref':'ACTION6','data':{'x':x,'y':y}}
            box=[x,y,x,y];step['point_support']={'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref'],'frame_hash':obs['frame_hash'],'point':[x,y],'palette_value':rows[y][x],'projection_bbox':box,'projected_rows_digest':rows_digest(projection(rows,box)),'entity_ref':'measured-radial-support:'+identity([plan['scene']['geometry_ref'],cell['grid']]),'signature':identity([cell,index]),'scope':'Measured current center pixel plus library full-frame initial guard and per-step fixed-support/port geometry guard. Unexpected distant changes seal the prefix.'}
        return p
    def bind(self,p,domain):
        if 'radial_port_plan'not in p:return super().bind(p,domain)
        first=p['steps'][0]['expected_before'];assert(first['level_epoch'],first['frame_hash'])in domain.bindings
        for action,step in zip(p['actions'],p['steps']):
            support=step['point_support'];assert support['point']==[action['data']['x'],action['data']['y']];step['point_binding']=dict(support)
    def restore(self,state):
        rebuilt=RadialPortsAccess()
        for event in state['events']:rebuilt.apply_event(event)
        if rebuilt.retained_digest()!=state['digest']:raise ValueError('Constrained port memory changed on recall')
        self.memory=rebuilt;self.events=list(state['events'])
