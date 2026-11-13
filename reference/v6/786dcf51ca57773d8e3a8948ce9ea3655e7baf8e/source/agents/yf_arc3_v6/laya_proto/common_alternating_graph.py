"""Common graph-change questions through the current C caller and SRC."""
from common_cell_placement import CellPlacementConstraint,CombinedCellPlacementMemory
from alternating_graph_access import AlternatingGraphAccess
from agents.yf_arc3_v6.morphology_policy.src_runtime import plain

class CombinedGraphMemory(AlternatingGraphAccess,CombinedCellPlacementMemory):
    pass

class AlternatingGraphConstraint(CellPlacementConstraint):
    def __init__(self):super().__init__();self.memory=CombinedGraphMemory()
    def graph_propose(self,obs,rows,inputs,remaining,config):
        if remaining<1:return None
        if self.level_deadline is None:raise ValueError('Graph composition requires the current level deadline')
        p=self.memory.propose_graph(obs,rows,inputs,min(16,remaining),{**plain(config),'remaining_level_actions':remaining})
        if p.get('block_unrelated_probe'):return p
        if p.get('status')!='proposed':return None
        p['field_subquestion']='alternating_graph_composition'
        return p
    def bind(self,p,domain):
        if 'graph_access_plan'not in p:return super().bind(p,domain)
        if any(a.get('data')for a in p['actions']):raise ValueError('Graph input payload changed')
    def restore(self,state):
        memory=CombinedGraphMemory()
        for event in state['events']:memory.apply_event(event)
        if memory.retained_digest()!=state['digest']:raise ValueError('Graph evidence changed on recall')
        self.memory=memory;self.events=list(state['events'])
