"""Current measured chain cells through C's shared point provider and memory."""
import copy
from common_field_service import FieldServiceConstraint
from rooted_quota_access import RootedQuotaAccess
from common_multiscale_constraints import projection,rows_digest
from agents.yf_arc3_v6.morphology_policy.src_runtime import plain
from terminal_composition import identity
class RootedQuotaConstraint(FieldServiceConstraint):
    def __init__(self):super().__init__();self.memory=RootedQuotaAccess()
    def rooted_propose(self,obs,rows,inputs,remaining,config):
        if remaining<1 or'ACTION6'not in obs['available_action_refs']:return None
        if self.level_deadline is None:raise ValueError('Rooted calculation requires current level deadline')
        cfg=plain(config);p=self.memory.propose([],obs,rows,inputs,min(16,remaining),{**cfg,'level_deadline':self.level_deadline,'remaining_level_actions':remaining})
        if not p or'rooted_quota_plan'not in p:return None
        plan=p['rooted_quota_plan'];scene=plan['scene'];p['steps']=copy.deepcopy(p['steps']);p['steps'][0]['expected_before']={k:obs[k]for k in('level_epoch','frame_hash','levels_completed','state')}
        for index,(action,st)in enumerate(zip(p['actions'],p['steps'])):
            ch=scene['chains'][st['chain']];cx,cy=ch['cells'][st['rank']];x,y=ch['points'][st['rank']];assert action=={'action_ref':'ACTION6','data':{'x':x,'y':y}};box=[scene['x_lines'][cx]+1,scene['y_lines'][cy]+1,scene['x_lines'][cx+1]-1,scene['y_lines'][cy+1]-1]
            st['point_support']={'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref'],'frame_hash':obs['frame_hash'],'point':[x,y],'palette_value':rows[y][x],'projection_bbox':box,'projected_rows_digest':rows_digest(projection(rows,box)),'entity_ref':'measured-rooted-cell:'+identity([scene['geometry_ref'],cx,cy]),'signature':identity([ch,st['rank']]),'scope':'Current measured cell support; initial full-frame guard and conditional prefix-state checks for released continuation. Root/mark semantics remain hypotheses and official boundary stops suffix.'}
        return p
    def bind(self,p,domain):
        if'rooted_quota_plan'not in p:return super().bind(p,domain)
        first=p['steps'][0]['expected_before'];assert(first['level_epoch'],first['frame_hash'])in domain.bindings
        for action,st in zip(p['actions'],p['steps']):
            s=st['point_support'];assert s['point']==[action['data']['x'],action['data']['y']];st['point_binding']=dict(s)
    def restore(self,state):
        m=RootedQuotaAccess()
        for e in state['events']:m.apply_event(e)
        if m.retained_digest()!=state['digest']:raise ValueError('Rooted method memory changed on recall')
        self.memory=m;self.events=list(state['events'])
