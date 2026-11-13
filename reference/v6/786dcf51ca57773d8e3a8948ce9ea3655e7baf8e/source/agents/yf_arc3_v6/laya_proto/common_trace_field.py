"""Finite trace experiment through current point support and the common SRC caller."""
from common_labeled_sequence import LabeledSequenceConstraint,CombinedLabeledMemory
from trace_field_access import TraceFieldAccess
from trace_field_observation import center
from agents.yf_arc3_v6.morphology_policy.src_runtime import plain
from common_multiscale_constraints import rows_digest
from terminal_composition import identity

class CombinedTraceMemory(TraceFieldAccess,CombinedLabeledMemory):
    pass

class TraceFieldConstraint(LabeledSequenceConstraint):
    def __init__(self):super().__init__();self.memory=CombinedTraceMemory()
    def trace_propose(self,obs,rows,inputs,remaining,config):
        if remaining<1:return None
        if self.level_deadline is None:raise ValueError('Trace experiment requires current level deadline')
        p=self.memory.propose([],obs,rows,inputs,min(16,remaining),{**plain(config),'level_deadline':self.level_deadline,'remaining_level_actions':remaining})
        if not p or'trace_field_plan'not in p:return None
        plan=p['trace_field_plan'];scene=plan['scene']
        for step in p['steps']:
            x,y=center(scene['geometry'],step['target']);value=rows[y][x]
            step['expected_before']={k:obs[k]for k in ('level_epoch','frame_hash','levels_completed','state')}
            step['point_support']={'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref'],'frame_hash':obs['frame_hash'],'point':[x,y],'palette_value':value,'projection_bbox':[x,y,x,y],'projected_rows_digest':rows_digest([[value]]),'entity_ref':'measured-cell:'+identity([scene['geometry_ref'],step['target']]),'signature':identity([scene['geometry_ref'],step['target'],value]),'scope':'Current measured cell center. Future unvisited cells are conditionally unchanged until approached, each point revalidated at dispatch. No old-epoch coordinate authority or acquired terminal role.'}
        return p
    def bind(self,p,domain):
        if'trace_field_plan'not in p:return super().bind(p,domain)
        for action,step in zip(p['actions'],p['steps']):
            s=step['point_support'];assert s['point']==[action['data']['x'],action['data']['y']];step['point_binding']=dict(s)
    def restore(self,state):
        memory=CombinedTraceMemory()
        for event in state['events']:memory.apply_event(event)
        if memory.retained_digest()!=state['digest']:raise ValueError('Trace evidence changed on recall')
        self.memory=memory;self.events=list(state['events'])
