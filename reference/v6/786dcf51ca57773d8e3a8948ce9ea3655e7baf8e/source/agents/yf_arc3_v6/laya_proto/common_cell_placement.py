"""Current cell-patch experiments through common point evidence and SRC."""
from common_linked_packet import LinkedPacketConstraint,CombinedLinkedPacketMemory
from cell_placement_access import CellPlacementAccess
from agents.yf_arc3_v6.morphology_policy.src_runtime import plain
from common_multiscale_constraints import rows_digest
from terminal_composition import identity

class CombinedCellPlacementMemory(CellPlacementAccess,CombinedLinkedPacketMemory):
    pass

class CellPlacementConstraint(LinkedPacketConstraint):
    def __init__(self):super().__init__();self.memory=CombinedCellPlacementMemory()
    def cell_propose(self,obs,rows,inputs,remaining,config):
        if remaining<1:return None
        if self.level_deadline is None:raise ValueError('Cell experiment requires current level deadline')
        p=self.memory.propose([],obs,rows,inputs,min(16,remaining),{**plain(config),'level_deadline':self.level_deadline,'remaining_level_actions':remaining})
        if not p or'cell_placement_plan'not in p:return None
        plan=p['cell_placement_plan'];x,y=plan['pixel'];value=rows[y][x]
        for step in p['steps']:
            step['expected_before']={k:obs[k]for k in ('level_epoch','frame_hash','levels_completed','state')}
            step['point_support']={'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref'],'frame_hash':obs['frame_hash'],'point':[x,y],'palette_value':value,'projection_bbox':[x,y,x,y],'projected_rows_digest':rows_digest([[value]]),'entity_ref':'measured-cell:'+identity([plan['field']['ref'],plan['point']]),'signature':identity([plan['field']['ref'],plan['point'],value]),'scope':'Current cell point and actual center pixel, distinct from predicted patch identity. No old-epoch point authority or acquired terminal role.'}
        return p
    def bind(self,p,domain):
        if'cell_placement_plan'not in p:return super().bind(p,domain)
        for action,step in zip(p['actions'],p['steps']):
            support=step['point_support'];assert support['point']==[action['data']['x'],action['data']['y']];step['point_binding']=dict(support)
    def restore(self,state):
        memory=CombinedCellPlacementMemory()
        for event in state['events']:memory.apply_event(event)
        if memory.retained_digest()!=state['digest']:raise ValueError('Cell patch evidence changed on recall')
        self.memory=memory;self.events=list(state['events'])
