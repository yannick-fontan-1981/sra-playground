"""Current caller adapter for measured masks and conditional selected controls."""
import copy,time
from .mechanism import SelectedRigidAccess

class SelectedRigid:
    def __init__(self):
        self.engine=SelectedRigidAccess();self.level_deadline=None;self.remaining_level_actions=None;self.requested_stop_reason=None
    def state(self):return {'format':'selected_rigid_events.v1','events':copy.deepcopy(self.engine.rigid_events)}
    def restore(self,state):
        if set(state)!={'format','events'} or state['format']!='selected_rigid_events.v1':raise ValueError('Incomplete selected rigid state')
        restored=SelectedRigidAccess()
        for event in state['events']:
            if event.get('kind')!='observed_selected_rigid':raise ValueError('Unexpected selected rigid event')
            restored.apply_event(copy.deepcopy(event))
        self.engine=restored
    def propose(self,obs,rows,inputs,remaining,config):
        self.requested_stop_reason=None
        if self.level_deadline is None or time.perf_counter()>=self.level_deadline or remaining<1:return None
        if self.remaining_level_actions is None:raise ValueError('Missing current level action budget')
        result=self.engine.propose_graph(obs,rows,inputs,min(remaining,16),{'selected_rigid_question':config,'level_deadline':self.level_deadline,'remaining_level_actions':self.remaining_level_actions})
        if result.get('block_unrelated_probe'):
            self.requested_stop_reason=result['reason'];return None
        if result.get('status')!='proposed':return None
        if any(a['action_ref']not in obs['available_action_refs']for a in result['actions']):return None
        for action,step in zip(result['actions'],result['steps']):
            if action['action_ref']=='ACTION6':
                x,y=action['data']['x'],action['data']['y']
                members=[e for e in obs['entities']if [x-e['bbox'][0],y-e['bbox'][1]]in[list(q)for q in e['mask']]]
                if len(members)!=1:return None
                e=members[0];step['point_binding']={'entity_ref':e['id'],'signature':e['signature'],'bbox':e['bbox'],'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash'],'point':[x,y],'palette_value':rows[y][x],'source':'current_observed_occupied_mask_point'}
        return result
    def bind(self,p,domain):
        if not p.get('actions')or len(p['actions'])>16 or p['actions']!=p['selected_rigid_plan']['commands'] or p['actions']!=p['bundle_template']['actions']or p['actions']!=[s.get('action')for s in p['steps']]:raise ValueError('Selected rigid exact action binding differs')
    def before(self,p,index,public,obs):
        try:self.bind(p,None)
        except(KeyError,ValueError):return {'admitted':False,'reason':'selected_rigid_exact_binding_changed'}
        if self.level_deadline is None or time.perf_counter()>=self.level_deadline:return {'admitted':False,'reason':'level_deadline'}
        return self.engine.before(p,index,public.frame_rows,epoch=obs['level_epoch'],score=obs['levels_completed'],available=obs['available_action_refs'],observation_ref=obs['observation_ref'])
    def after(self,p,index,before,after,first,second):return self.engine.after(p,index,first,second,epoch=after['level_epoch'],score=after['levels_completed'],state=after['state'])
    def record(self,before,after,command,first,second,proposal=None,index=0,frames=None):
        if not proposal or 'selected_rigid_plan'not in proposal:return None
        events=self.engine.record(before,command,after,first,second,proposal,index)
        return {'events':events,'scope':'Canonical public transition; receiver remains hypothetical until discriminating displacement.'}if events else None
