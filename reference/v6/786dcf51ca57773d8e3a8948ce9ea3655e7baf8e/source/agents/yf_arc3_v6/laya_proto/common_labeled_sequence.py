"""Current labeled-query submission through the common point/evidence caller."""
from common_product_panel import ProductPanelConstraint,CombinedProductMemory
from labeled_sequence_access import LabeledSequenceAccess
from agents.yf_arc3_v6.morphology_policy.src_runtime import plain
from common_multiscale_constraints import rows_digest,projection
from terminal_composition import identity

class CombinedLabeledMemory(LabeledSequenceAccess,CombinedProductMemory):
    pass

class LabeledSequenceConstraint(ProductPanelConstraint):
    def __init__(self):super().__init__();self.memory=CombinedLabeledMemory()
    def labeled_propose(self,obs,rows,inputs,remaining,config):
        if remaining<1:return None
        if self.level_deadline is None:raise ValueError('Labeled query requires current level deadline')
        p=self.memory.propose([],obs,rows,inputs,min(16,remaining),{**plain(config),'level_deadline':self.level_deadline,'remaining_level_actions':remaining})
        if not p or 'labeled_sequence_plan'not in p:return None
        plan=p['labeled_sequence_plan'];button=plan['button'];x,y=button['point'];step=p['steps'][0]
        step['expected_before']={k:obs[k]for k in ('level_epoch','frame_hash','levels_completed','state')}
        step['point_support']={'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref'],'frame_hash':obs['frame_hash'],'point':[x,y],'palette_value':rows[y][x],'projection_bbox':button['bbox'],'projected_rows_digest':rows_digest(projection(rows,button['bbox'])),'entity_ref':'measured-label-control:'+identity([button['bbox'],button['label']]),'signature':identity([plan['scene']['context_ref'],button]),'scope':'Current complete uniform control support, revalidated from retained envelope when needed. The current query and finite predicate agreement are separately bound; no future query or stale point authority.'}
        return p
    def bind(self,p,domain):
        if 'labeled_sequence_plan'not in p:return super().bind(p,domain)
        s=p['steps'][0]['point_support'];action=p['actions'][0];assert s['point']==[action['data']['x'],action['data']['y']];p['steps'][0]['point_binding']=dict(s)
    def restore(self,state):
        memory=CombinedLabeledMemory()
        for event in state['events']:memory.apply_event(event)
        if memory.retained_digest()!=state['digest']:raise ValueError('Labeled evidence changed on recall')
        self.memory=memory;self.events=list(state['events'])
