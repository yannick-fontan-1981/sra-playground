"""Public factor experiments with per-step point evidence through the common caller."""
from common_queued_field import QueuedFieldConstraint,CombinedQueueMemory
from product_panel_access import ProductPanelAccess
from agents.yf_arc3_v6.morphology_policy.src_runtime import plain
from common_multiscale_constraints import rows_digest
from terminal_composition import identity

class CombinedProductMemory(ProductPanelAccess,CombinedQueueMemory):
    pass

class ProductPanelConstraint(QueuedFieldConstraint):
    def __init__(self):super().__init__();self.memory=CombinedProductMemory()
    def product_propose(self,obs,rows,inputs,remaining,config):
        if remaining<1:return None
        if self.level_deadline is None:raise ValueError('Product experiment requires current level deadline')
        p=self.memory.propose([],obs,rows,inputs,min(16,remaining),{**plain(config),'level_deadline':self.level_deadline,'remaining_level_actions':remaining})
        if not p or 'product_panel_plan'not in p:return None
        plan=p['product_panel_plan'];scene=plan['scene']
        for step in p['steps']:
            i=step['factor'];control=scene['controls'][i];x,y=control['point'];value=step['before_values'][i]
            step['expected_before']={k:obs[k]for k in ('level_epoch','frame_hash','levels_completed','state')}
            step['point_support']={'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref'],'frame_hash':obs['frame_hash'],'point':[x,y],'palette_value':value,'projection_bbox':[x,y,x,y],'projected_rows_digest':rows_digest([[value]]),'entity_ref':'measured-control-envelope:'+identity(control['bbox']),'signature':identity([control['bbox'],control['values']]),'scope':'Current measured control locus. Later value is a frozen conditional predecessor prediction, revalidated at dispatch; no stale-coordinate or component-identity authority.'}
        return p
    def bind(self,p,domain):
        if 'product_panel_plan'not in p:return super().bind(p,domain)
        for action,step in zip(p['actions'],p['steps']):
            s=step['point_support'];assert s['point']==[action['data']['x'],action['data']['y']];step['point_binding']=dict(s)
    def restore(self,state):
        memory=CombinedProductMemory()
        for event in state['events']:memory.apply_event(event)
        if memory.retained_digest()!=state['digest']:raise ValueError('Product evidence changed on recall')
        self.memory=memory;self.events=list(state['events'])
