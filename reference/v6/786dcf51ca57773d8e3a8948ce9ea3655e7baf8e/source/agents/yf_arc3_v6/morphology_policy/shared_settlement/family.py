"""Current caller contract for the retained, conditional shared-settlement method."""
import copy,time
from .mechanism import SettledGroupAccess

class SharedSettlement:
    def __init__(self):
        self.engine=SettledGroupAccess()
        self.level_deadline=None
        self.remaining_level_actions=None
        self.requested_stop_reason=None
    def state(self):return {'events':copy.deepcopy(self.engine.settle_events)}
    def restore(self,state):
        restored=SettledGroupAccess()
        for event in state['events']:
            if event.get('kind')!='observed_shared_settlement':raise ValueError('Unexpected settlement event')
            restored.apply_event(copy.deepcopy(event))
        self.engine=restored
    def propose(self,obs,rows,inputs,remaining,config):
        self.requested_stop_reason=None
        if self.level_deadline is None or time.perf_counter()>=self.level_deadline or remaining<1:return None
        if self.remaining_level_actions is None:raise ValueError('Missing current level action budget')
        cfg={'shared_settlement_question':config,'level_deadline':self.level_deadline,'remaining_level_actions':self.remaining_level_actions}
        proposal=self.engine.propose_graph(obs,rows,inputs,min(remaining,16),cfg)
        if proposal.get('block_unrelated_probe'):
            self.requested_stop_reason=proposal['reason'];return None
        return proposal if proposal.get('status')=='proposed' else None
    def bind(self,proposal,domain):
        plan=proposal['shared_settlement_plan']
        if proposal['actions']!=plan['commands'] or proposal['actions']!=proposal['bundle_template']['actions'] or proposal['actions']!=[step.get('action')for step in proposal['steps']]:
            raise ValueError('Settlement action set differs from committed plan')
        if any(action.get('data') for action in proposal['actions']):raise ValueError('Settlement requires acquired primitive controls, not point payloads')
    def before(self,proposal,index,public,obs):
        try:self.bind(proposal,None)
        except (KeyError,ValueError):return {'admitted':False,'reason':'settlement_plan_binding_changed'}
        if self.level_deadline is None or time.perf_counter()>=self.level_deadline:return {'admitted':False,'reason':'level_deadline'}
        return self.engine.before(proposal,index,public.frame_rows,epoch=obs['level_epoch'],score=obs['levels_completed'],available=obs['available_action_refs'],observation_ref=obs['observation_ref'])
    def after(self,proposal,index,before,after,first,second):
        return self.engine.after(proposal,index,first,second,epoch=after['level_epoch'],score=after['levels_completed'],state=after['state'])
    def record(self,before,after,command,first,second,proposal=None,index=0,frames=None):
        events=self.engine.record(before,command,after,first,second,proposal,index)
        return {'events':events,'scope':'Canonical public response only; intermediate microstep timing remains unknown.'} if events else None
