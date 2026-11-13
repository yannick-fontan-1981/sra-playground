"""Observed coupled controls and support questions through the common caller."""
from common_alternating_graph import AlternatingGraphConstraint,CombinedGraphMemory
from auxiliary_support_access import AuxiliarySupportAccess
from agents.yf_arc3_v6.morphology_policy.src_runtime import plain
from common_multiscale_constraints import rows_digest
from terminal_composition import identity

class CombinedCoupledMemory(AuxiliarySupportAccess,CombinedGraphMemory):
    pass

class CoupledSupportConstraint(AlternatingGraphConstraint):
    def __init__(self):super().__init__();self.memory=CombinedCoupledMemory()
    def coupled_propose(self,obs,rows,inputs,remaining,config):
        if remaining<1:return None
        if self.level_deadline is None:raise ValueError('Coupled experiment requires current level deadline')
        p=self.memory.propose_graph(obs,rows,inputs,min(16,remaining),{**plain(config),'remaining_level_actions':remaining})
        if p.get('block_unrelated_probe'):return p
        if p.get('status')!='proposed' or not any(k in p for k in ('pair_access_plan','support_preparation_plan')):return None
        p['field_subquestion']='coupled_support_composition'
        for action,step in zip(p['actions'],p['steps']):
            step['expected_before']={k:obs[k]for k in ('level_epoch','frame_hash','levels_completed','state')}
            if action['action_ref']=='ACTION6':
                x,y=action['data']['x'],action['data']['y'];value=rows[y][x]
                step['point_support']={'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref'],'frame_hash':obs['frame_hash'],'point':[x,y],'palette_value':value,'projection_bbox':[x,y,x,y],'projected_rows_digest':rows_digest([[value]]),'entity_ref':'current-selected-support:'+identity([obs['observation_ref'],x,y]),'signature':identity([obs['frame_hash'],x,y,value]),'scope':'Current visible point only; role/control effect remains a question until physical response. Geometry guards bind the whole current composition independently.'}
        return p
    def bind(self,p,domain):
        if not any(k in p for k in ('pair_access_plan','support_preparation_plan')):return super().bind(p,domain)
        for action,step in zip(p['actions'],p['steps']):
            if action['action_ref']=='ACTION6':
                support=step['point_support']
                if support['point']!=[action['data']['x'],action['data']['y']]:raise ValueError('Current point changed')
                step['point_binding']=dict(support)
            elif action.get('data'):raise ValueError('Unexpected discrete control payload')
    def restore(self,state):
        memory=CombinedCoupledMemory()
        for event in state['events']:memory.apply_event(event)
        if memory.retained_digest()!=state['digest']:raise ValueError('Coupled evidence changed on recall')
        self.memory=memory;self.events=list(state['events'])
