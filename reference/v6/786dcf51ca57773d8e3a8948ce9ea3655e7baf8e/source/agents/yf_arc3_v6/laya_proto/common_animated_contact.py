"""Current-scope binding and durable evidence for measured transient contact."""
import copy,json
from pathlib import Path
from animated_contact_access import AnimatedContactAccess
from terminal_composition import identity
from observed_input_domain import ObservedInputDomain
from src_bridge import plain

def authorization(p):
    return identity({k:p[k]for k in ('proposal_id','animated_contact_plan','actions','facts','binding','question')})

class AnimatedContact:
    def __init__(self):
        self.mechanism=AnimatedContactAccess();self.authorized={}
        self.policy=json.loads(Path(__file__).with_name('common_frontier_policy.drm.json').read_text())['animated_contact_question']
    def state(self):return plain({'format':'animated_contact.v1','events':self.mechanism.arc_events,'authorized':self.authorized})
    def restore(self,state):
        if set(state)!={'format','events','authorized'}or state['format']!='animated_contact.v1':raise ValueError('Incomplete animation memory')
        self.mechanism.arc_events=copy.deepcopy(state['events']);self.mechanism.arc_pending=None;self.authorized=copy.deepcopy(state['authorized'])
    def propose(self,obs,rows,inputs,remaining):
        if remaining<1:return None
        p=self.mechanism.propose_graph(obs,rows,inputs,min(remaining,16),{'animated_contact_question':self.policy})
        if not p or p.get('status')!='proposed':return p
        p['support_plan']={'animated_contact':True};p['binding']['levels_completed']=obs['levels_completed'];p['binding']['frame_hash']=obs['frame_hash']
        command=p['actions'][0]
        if command.get('data'):
            point=(command['data']['x'],command['data']['y'])
            p['steps'][0]['locus_witness']=ObservedInputDomain.make_locus_witness(obs,rows,point,reason=p['question']['reason'],evidence=p['route_refs'])
        self.authorized={p['proposal_id']:authorization(p)}
        return p
    def before(self,p,index,public,obs):
        if not p.get('support_plan',{}).get('animated_contact') or self.authorized.get(p.get('proposal_id'))!=authorization(p):return {'admitted':False,'reason':'animation_authorized_question_changed'}
        if public.frame_hash!=p['binding']['frame_hash']or obs['frame_hash']!=p['binding']['frame_hash']:return {'admitted':False,'reason':'animation_frame_changed'}
        if len(p['steps'])!=1 or p['steps'][0]['action']!=p['actions'][0]:return {'admitted':False,'reason':'animation_step_payload_changed'}
        return self.mechanism.before(p,index,public.frame_rows,epoch=public.level,score=public.levels_completed,observation_ref=obs['observation_ref'],available=public.available_action_refs)
    def after(self,p,index,before,after,first,second):
        return self.mechanism.after(p,index,first,second)
    def record(self,before,after,command,first,second,proposal=None,index=None,frames=None):
        if not proposal or not proposal.get('support_plan',{}).get('animated_contact'):return {'events':[]}
        if index!=0 or command!=proposal['actions'][0]:raise ValueError('Animation response has another command')
        self.mechanism.record(before,command,after,first,second,proposal,index)
        events=self.mechanism.record_packet(before,command,after,first,frames or [second],None)
        self.authorized={}
        return {'events':events}
