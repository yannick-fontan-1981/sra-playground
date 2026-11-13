"""Current-view equal-window experiment through C's common point contract."""
import copy
from common_rooted_quota import RootedQuotaConstraint
from framed_window_access import FramedWindowAccess,measure
from common_multiscale_constraints import projection,rows_digest
from agents.yf_arc3_v6.morphology_policy.src_runtime import plain
from terminal_composition import identity
class FramedWindowConstraint(RootedQuotaConstraint):
    def __init__(self):super().__init__();self.memory=FramedWindowAccess()
    def window_propose(self,obs,rows,inputs,remaining,config):
        if remaining<1 or'ACTION6'not in obs['available_action_refs']or measure(rows)is None:return None
        if self.level_deadline is None:raise ValueError('Window comparison requires current level deadline')
        p=self.memory.propose([],obs,rows,inputs,min(16,remaining),{**plain(config),'level_deadline':self.level_deadline,'remaining_level_actions':remaining})
        if not p or'framed_window_plan'not in p:return None
        plan=p['framed_window_plan'];p['steps']=copy.deepcopy(p['steps']);step=p['steps'][0];step['expected_before']={k:obs[k]for k in('level_epoch','frame_hash','levels_completed','state')};x,y=plan['point'];box=plan['image_box']
        step['point_support']={'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref'],'frame_hash':obs['frame_hash'],'point':[x,y],'palette_value':rows[y][x],'projection_bbox':box,'projected_rows_digest':rows_digest(projection(rows,box)),'entity_ref':'measured-current-window:'+identity([box,plan['window'],plan['reference_digest']]),'signature':identity([plan['window'],plan['reference_digest']]),'scope':'Current acquired image support and pixel-equal window, bound to full current frame; reference and pointing utility remain hypotheses.'}
        return p
    def bind(self,p,domain):
        if'framed_window_plan'not in p:return super().bind(p,domain)
        first=p['steps'][0]['expected_before'];assert(first['level_epoch'],first['frame_hash'])in domain.bindings
        for action,step in zip(p['actions'],p['steps']):
            s=step['point_support'];assert s['point']==[action['data']['x'],action['data']['y']];step['point_binding']=dict(s)
    def restore(self,state):
        m=FramedWindowAccess()
        for e in state['events']:m.apply_event(e)
        if m.retained_digest()!=state['digest']:raise ValueError('Framed-window method memory changed on recall')
        self.memory=m;self.events=list(state['events'])
