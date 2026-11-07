"""Scoped port of the source-qualified preview partition provider.

The donated geometry and conditional calculus remain unchanged. This adapter
owns current caller signatures and JSON memory transport, not a new game law.
"""
from pathlib import Path
from copy import deepcopy
from agents.yf_arc3_v5.drm.loader import load_drm_document
from src_bridge import plain
from .donor import PreviewPackingAccess

class PreviewPacking:
    def __init__(self):
        self.core=PreviewPackingAccess()
        self.policy=load_drm_document(Path(__file__).with_name('preview.drm'))
        self.config=self.policy.document.declarations[0].configuration
    def state(self):
        return plain({k:getattr(self.core,k) for k in ('packing_events','packing_model','packing_controls','_packing_scene_cache')})
    def restore(self,state):
        core=PreviewPackingAccess()
        for k in ('packing_events','packing_model','packing_controls','_packing_scene_cache'):
            if k in state:setattr(core,k,deepcopy(state[k]))
        core._packing_scene_cache={int(k):v for k,v in core._packing_scene_cache.items()}
        self.core=core
    def propose(self,obs,rows,inputs,remaining):
        if remaining<1:return None
        result=self.core.propose_graph(obs,rows,inputs,min(16,remaining),self.config)
        if result.get('status')!='proposed':return result if result.get('block_unrelated_probe') else None
        if any(a['action_ref'] not in obs['available_action_refs'] for a in result['actions']):return None
        for action,step in zip(result['actions'],result['steps']):
            if action['action_ref']=='ACTION6':
                x,y=action['data']['x'],action['data']['y']
                members=[e for e in obs['entities'] if [x-e['bbox'][0],y-e['bbox'][1]] in [list(q) for q in e['mask']]]
                if len(members)!=1:return None
                e=members[0]
                step['point_binding']={'entity_ref':e['id'],'signature':e['signature'],'bbox':e['bbox'],'observation_ref':obs['observation_ref'],'level_epoch':obs['level_epoch'],'frame_hash':obs['frame_hash'],'point':[x,y],'palette_value':rows[y][x],'source':'current_observed_piece_hit_point'}
        result['preview_policy_ref']=self.policy.document.declarations[0].id
        result['preview_policy_hash']=self.policy.source_hash
        return result
    def bind(self,p,domain):
        v=p.get('preview_packing_plan',{})
        if not p.get('actions') or len(p['actions'])>16 or p['actions']!=[s.get('action') for s in p['steps']] or p['actions']!=v.get('commands') or p['actions']!=p['bundle_template']['actions']:
            raise ValueError('preview exact action binding mismatch')
        if p.get('preview_policy_hash')!=self.policy.source_hash:raise ValueError('preview policy mismatch')
    def before(self,p,index,public,obs):
        try:self.bind(p,None)
        except (KeyError,ValueError):return {'admitted':False,'reason':'preview_exact_binding_mismatch'}
        return self.core.before(p,index,public.frame_rows,epoch=obs['level_epoch'],score=obs['levels_completed'],available=obs['available_action_refs'],observation_ref=obs['observation_ref'])
    def after(self,p,index,before,after,rows,later):
        return self.core.after(p,index,rows,later,epoch=after['level_epoch'],score=after['levels_completed'],state=after['state'])
    def record(self,before,after,command,rows,later,proposal=None,index=0,frames=None):
        if not proposal or 'preview_packing_plan' not in proposal:return None
        events=self.core.record(before,command,after,rows,later,proposal,index)
        return {'kind':'preview_packing_return','events':events,'boundary':before['level_epoch']!=after['level_epoch'],'evidence':[before['observation_ref'],after['observation_ref']]}
