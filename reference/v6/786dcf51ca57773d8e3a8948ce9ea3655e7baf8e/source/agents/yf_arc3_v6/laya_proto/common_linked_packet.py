"""Dated packet questions through current point/scalar support and common SRC."""
from common_trace_field import TraceFieldConstraint,CombinedTraceMemory
from linked_packet_access import LinkedPacketAccess
from agents.yf_arc3_v6.morphology_policy.src_runtime import plain
from common_multiscale_constraints import rows_digest
from terminal_composition import identity

class CombinedLinkedPacketMemory(LinkedPacketAccess,CombinedTraceMemory):
    pass

class LinkedPacketConstraint(TraceFieldConstraint):
    def __init__(self):super().__init__();self.memory=CombinedLinkedPacketMemory()
    def linked_propose(self,obs,rows,inputs,remaining,config):
        if remaining<1:return None
        if self.level_deadline is None:raise ValueError('Dated packet experiment requires current level deadline')
        p=self.memory.propose([],obs,rows,inputs,min(16,remaining),{**plain(config),'level_deadline':self.level_deadline,'remaining_level_actions':remaining})
        if not p or'linked_packet_plan'not in p:return None
        for action,step in zip(p['actions'],p['steps']):
            step['expected_before']={k:obs[k]for k in ('level_epoch','frame_hash','levels_completed','state')}
            if action['action_ref']!='ACTION6':continue
            control=p['linked_packet_plan']['control'];x,y=control['point'];value=rows[y][x]
            step['point_support']={'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref'],'frame_hash':obs['frame_hash'],'point':[x,y],'palette_value':value,'projection_bbox':[x,y,x,y],'projected_rows_digest':rows_digest([[value]]),'entity_ref':control['ref'],'signature':identity([control,value]),'scope':'Current measured exterior motif center under an explicit selection question; no inherited point or terminal authority.'}
        return p
    def bind(self,p,domain):
        if'linked_packet_plan'not in p:return super().bind(p,domain)
        for action,step in zip(p['actions'],p['steps']):
            if action['action_ref']!='ACTION6':continue
            support=step['point_support'];assert support['point']==[action['data']['x'],action['data']['y']];step['point_binding']=dict(support)
    def restore(self,state):
        memory=CombinedLinkedPacketMemory()
        for event in state['events']:memory.apply_event(event)
        if memory.retained_digest()!=state['digest']:raise ValueError('Dated packet evidence changed on recall')
        self.memory=memory;self.events=list(state['events'])
