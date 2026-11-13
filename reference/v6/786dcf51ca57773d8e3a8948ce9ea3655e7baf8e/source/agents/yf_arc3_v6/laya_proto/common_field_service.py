"""Current public field-control experiments through the existing C point provider."""
import copy
from common_radial_ports import RadialPortConstraint
from service_transfer_access import ServiceTransferAccess
from common_multiscale_constraints import projection,rows_digest
from agents.yf_arc3_v6.morphology_policy.src_runtime import plain
from terminal_composition import identity

class FieldServiceConstraint(RadialPortConstraint):
    def __init__(self):super().__init__();self.memory=ServiceTransferAccess()
    def service_propose(self,obs,rows,inputs,remaining,config):
        if remaining<1 or 'ACTION6'not in obs['available_action_refs']:return None
        p=self.memory.propose([],obs,rows,inputs,min(16,remaining),plain(config))
        if not p or 'nested_control_plan'not in p:return None
        plan=p['nested_control_plan'];p['steps']=copy.deepcopy(p['steps']);p['steps'][0]['expected_before']={k:obs[k]for k in ('level_epoch','frame_hash','levels_completed','state')};box=plan['selected']['bbox']
        for index,(action,step)in enumerate(zip(p['actions'],p['steps'])):
            x,y=plan['selected']['point'];assert action=={'action_ref':'ACTION6','data':{'x':x,'y':y}}
            assert box[0]<=x<=box[2]and box[1]<=y<=box[3]
            step['point_support']={'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref'],'frame_hash':obs['frame_hash'],'point':[x,y],'palette_value':rows[y][x],'projection_bbox':box,'projected_rows_digest':rows_digest(projection(rows,box)),'entity_ref':'measured-field-control:'+identity([box,plan['selected']]),'signature':identity([plan['selected'],index]),'scope':'Current measured control/envelope, exact full-frame and epoch guard. Unknown response seals this one-action experiment; no capacity or terminal law supplied.'}
        return p
    def bind(self,p,domain):
        if 'nested_control_plan'not in p:return super().bind(p,domain)
        first=p['steps'][0]['expected_before'];assert(first['level_epoch'],first['frame_hash'])in domain.bindings
        for action,step in zip(p['actions'],p['steps']):
            support=step['point_support'];assert support['point']==[action['data']['x'],action['data']['y']];step['point_binding']=dict(support)
    def restore(self,state):
        rebuilt=ServiceTransferAccess()
        for event in state['events']:rebuilt.apply_event(event)
        if rebuilt.retained_digest()!=state['digest']:raise ValueError('Public field-service memory changed on recall')
        self.memory=rebuilt;self.events=list(state['events'])
