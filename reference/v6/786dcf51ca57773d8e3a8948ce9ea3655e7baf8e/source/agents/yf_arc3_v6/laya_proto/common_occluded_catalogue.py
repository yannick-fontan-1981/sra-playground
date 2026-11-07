"""Measured catalogue controls through C's shared point provider and evidence binding."""
import copy
from common_framed_window import FramedWindowConstraint
from catalogue_view_memory import CatalogueViewMemory as OccludedCatalogueAccess
from occluded_catalogue_observation import measure
from common_multiscale_constraints import projection,rows_digest
from agents.yf_arc3_v6.morphology_policy.src_runtime import plain
from terminal_composition import identity
class OccludedCatalogueConstraint(FramedWindowConstraint):
    def __init__(self):super().__init__();self.memory=OccludedCatalogueAccess()
    def catalogue_propose(self,obs,rows,inputs,remaining,config):
        if remaining<1 or'ACTION6'not in obs['available_action_refs']or measure(rows)is None:return None
        if self.level_deadline is None:raise ValueError('Catalogue projection requires current level deadline')
        p=self.memory.propose([],obs,rows,inputs,min(16,remaining),{**plain(config),'level_deadline':self.level_deadline,'remaining_level_actions':remaining})
        if not p or'occluded_catalogue_plan'not in p:return None
        if p['occluded_catalogue_plan'].get('mode')=='view':return None
        plan=p['occluded_catalogue_plan'];scene=plan['scene'];p['steps']=copy.deepcopy(p['steps']);step=p['steps'][0];step['expected_before']={k:obs[k]for k in('level_epoch','frame_hash','levels_completed','state')};x,y=plan['point']
        if plan['mode']=='answer':box=scene['cards'][plan['evidence']['candidate']]['bbox']
        else:box=next(c['bbox']for c in scene['controls']if c['palette']==plan['target_palette']and c['point']==plan['point'])
        step['point_support']={'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref'],'frame_hash':obs['frame_hash'],'point':[x,y],'palette_value':rows[y][x],'projection_bbox':box,'projected_rows_digest':rows_digest(projection(rows,box)),'entity_ref':'measured-catalogue-control:'+identity([plan['mode'],box,plan['target_palette']]),'signature':identity([scene['geometry_ref'],plan['mode'],plan['target_palette']]),'scope':'Current measured catalogue member or same-palette selector; response correctness remains unknown until official global progress.'}
        return p
    def catalogue_view_propose(self,obs,rows,inputs,remaining,config):
        if remaining<1 or self.level_deadline is None:return None
        p=self.memory.propose([],obs,rows,inputs,min(16,remaining),{**plain(config),'level_deadline':self.level_deadline,'remaining_level_actions':remaining})
        return p if p and p.get('occluded_catalogue_plan',{}).get('mode')=='view' else None
    def bind(self,p,domain):
        if p.get('occluded_catalogue_plan',{}).get('mode')=='view':
            assert not any(a.get('data') for a in p['actions']);return
        if'occluded_catalogue_plan'not in p:return super().bind(p,domain)
        first=p['steps'][0]['expected_before'];assert(first['level_epoch'],first['frame_hash'])in domain.bindings
        for action,step in zip(p['actions'],p['steps']):
            s=step['point_support'];assert s['point']==[action['data']['x'],action['data']['y']];step['point_binding']=dict(s)
    def restore(self,state):
        m=OccludedCatalogueAccess()
        for e in state['events']:m.apply_event(e)
        if m.retained_digest()!=state['digest']:raise ValueError('Catalogue evidence changed on recall')
        self.memory=m;self.events=list(state['events'])
