"""Sparse C adapter of current observed composition methods; no game dispatch."""
from common_coupled_support import CoupledSupportConstraint,CombinedCoupledMemory
from reference_population_access import ReferencePopulationAccess,input_candidates
from agents.yf_arc3_v6.morphology_policy.src_runtime import plain
from common_multiscale_constraints import rows_digest
from terminal_composition import identity

PLAN_KEYS=('exposed_reception_plan','chamber_relation_plan','panel_service_plan','rooted_line_plan','reception_service_plan','reference_population_plan')
class CombinedObservedCompositionMemory(ReferencePopulationAccess,CombinedCoupledMemory):
    pass
class ObservedCompositionConstraint(CoupledSupportConstraint):
    def __init__(self):super().__init__();self.memory=CombinedObservedCompositionMemory()
    def observed_composition_propose(self,obs,rows,inputs,remaining,config):
        if remaining<1:return None
        if self.level_deadline is None:raise ValueError('Observed composition requires current level deadline')
        p=self.memory.propose_graph(obs,rows,inputs+input_candidates(rows,obs['available_action_refs']),min(16,remaining),{**plain(config),'remaining_level_actions':remaining,'level_deadline':self.level_deadline})
        if p.get('block_unrelated_probe'):return p
        if p.get('status')!='proposed'or not any(k in p for k in PLAN_KEYS):return None
        p['field_subquestion']='observed_composition_services'
        for index,(action,step)in enumerate(zip(p['actions'],p['steps'])):
            step['expected_before']={k:obs[k]for k in ('level_epoch','frame_hash','levels_completed','state')}
            if action['action_ref']=='ACTION6':
                x,y=action['data']['x'],action['data']['y'];value=rows[y][x]
                step['point_support']={'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref'],'frame_hash':obs['frame_hash'],'point':[x,y],'palette_value':value,'projection_bbox':[x,y,x,y],'projected_rows_digest':rows_digest([[value]]),'entity_ref':'observed-composition-control:'+identity([obs['observation_ref'],x,y]),'signature':identity([obs['frame_hash'],x,y,value]),'scope':'Measured control point, independently rechecked before dispatch; family geometry and predicted-state guards additionally apply.'}
        return p
    def bind(self,p,domain):
        if not any(k in p for k in PLAN_KEYS):return super().bind(p,domain)
        for action,step in zip(p['actions'],p['steps']):
            if action['action_ref']=='ACTION6':
                support=step['point_support']
                if support['point']!=[action['data']['x'],action['data']['y']]:raise ValueError('Current point changed')
                step['point_binding']=dict(support)
            elif action.get('data'):raise ValueError('Unexpected nonpoint payload')
    def restore(self,state):
        memory=CombinedObservedCompositionMemory()
        for e in state['events']:memory.apply_event(e)
        if memory.retained_digest()!=state['digest']:raise ValueError('Observed composition memory changed on restore')
        self.memory=memory;self.events=list(state['events'])
