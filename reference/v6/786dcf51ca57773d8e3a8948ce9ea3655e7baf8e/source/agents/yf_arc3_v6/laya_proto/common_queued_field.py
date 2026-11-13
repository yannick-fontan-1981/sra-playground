"""Current public queued compositions; retain catalogue view acquisition by MRO."""
from common_occluded_catalogue import OccludedCatalogueConstraint
from catalogue_view_memory import CatalogueViewMemory
from queued_field_access import QueuedFieldAccess
from agents.yf_arc3_v6.morphology_policy.src_runtime import plain

class CombinedQueueMemory(QueuedFieldAccess,CatalogueViewMemory):
    pass

class QueuedFieldConstraint(OccludedCatalogueConstraint):
    def __init__(self):
        super().__init__();self.memory=CombinedQueueMemory()
    def queue_propose(self,obs,rows,inputs,remaining,config):
        if remaining<1:return None
        if self.level_deadline is None:raise ValueError('Queue preparation requires current level deadline')
        p=self.memory.propose([],obs,rows,inputs,min(16,remaining),{**plain(config),'level_deadline':self.level_deadline,'remaining_level_actions':remaining})
        if not p or 'queued_field_plan' not in p:return None
        p['steps'][0]['expected_before']={k:obs[k]for k in ('level_epoch','frame_hash','levels_completed','state')}
        return p
    def bind(self,p,domain):
        if 'queued_field_plan' not in p:return super().bind(p,domain)
        # Coordinate-free commands have no sampled point table. Epoch/frame and
        # exact command are guarded by QueuedFieldAccess.before at dispatch.
        assert all(not action.get('data') for action in p['actions'])
    def restore(self,state):
        memory=CombinedQueueMemory()
        for event in state['events']:memory.apply_event(event)
        if memory.retained_digest()!=state['digest']:raise ValueError('Queued evidence changed on recall')
        self.memory=memory;self.events=list(state['events'])
