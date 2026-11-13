"""Scoped exact-window question on the current public view, with no transport law."""
import time
from collections import defaultdict
from geometric_observer import components
from terminal_composition import identity
from rooted_quota_access import RootedQuotaAccess,input_candidates
from rooted_quota_methods import plain
from agents.yf_arc3_v5.capabilities.temporal_fragment_match import TemporalFragmentRequest,measure_temporal_fragment_match

def measure(rows):
    """Two disjoint same-style rectangular outlines; small-reference is a hypothesis."""
    frames=[]
    for part in components(rows):
        l,t,r,b=part['bbox'];w,h=r-l+1,b-t+1
        if min(w,h)<3 or l==0 or t==0 or r==len(rows[0])-1 or b==len(rows)-1:continue
        perimeter={(x,y)for y in range(h)for x in range(w)if x in(0,w-1)or y in(0,h-1)}
        if not perimeter.issubset(set(map(tuple,part['mask']))):continue
        frames.append({'bbox':[l,t,r,b],'palette':part['color'],'area':(w-2)*(h-2)})
    pairs=[]
    for small in frames:
        for large in frames:
            if small['area']>=large['area']or small['palette']!=large['palette']:continue
            l,t,r,b=small['bbox'];x,y,z,v=large['bbox']
            if not(r<x or z<l or b<y or v<t):continue
            if r-l>z-x or b-t>v-y:continue
            pairs.append((small,large))
    def interior(frame):
        l,t,r,b=frame['bbox'];return [row[l+1:r]for row in rows[t+1:b]]
    compatible=[];total=0
    for small,large in pairs:
        reference=interior(small);image=interior(large)
        if len({v for row in reference for v in row})<2:continue
        h,w=len(reference),len(reference[0]);matches=[];examined=0
        for y in range(len(image)-h+1):
            for x in range(len(image[0])-w+1):
                examined+=1
                if all(image[y+j][x:x+w]==reference[j]for j in range(h)):matches.append([x,y])
        total+=examined
        if matches:compatible.append({'reference':reference,'image':image,'reference_box':small['bbox'],'image_box':large['bbox'],'matches':matches,'examined_windows':examined,'hypothesis':'smaller_disjoint_same_border_frame_as_reference_larger_as_search_domain'})
    if len(compatible)!=1 or len(compatible[0]['matches'])!=1:return None
    return {**compatible[0],'frame_pair_candidates':len(pairs),'all_pair_windows_examined':total}

def certify(scene,obs,deadline):
    """Existing readonly kernel certifies prefiltered candidates; no game acceptance law."""
    revision=obs['observation_ref'];model={'model_ref':'M_exact_current_window','photo_count':1,'equality_law_ref':'exact_palette_value'}
    scope={'request_ref':'window_request:'+identity([revision,scene]),'caller_ref':'public_framed_window_question','parent_consumer_ref':'SRC_composition','parent_goal_ref':'G_official_completion','parent_contribution_ref':'test_current_exact_window','caller_next_item_ref':revision,'epoch':obs['level_epoch'],'evidence_revision_ref':revision,'model_revision_ref':identity(model),'model_status_ref':'descriptive_pixel_equality_with_conditional_reference_role','event_owner_ref':'SRC','input_domain_complete':True,'assumption_refs':[scene['hypothesis'],'pointing_at_equal_window_may_contribute_to_official_progress']}
    photo={'photo_ref':'P_current','scene_ref':f"scene:{obs['level_epoch']}",'film_revision_ref':revision,'photo_index':0,'frame':{'rows':scene['image']},'evidence_ref':revision,'content_support_ref':'measured_large_frame_interior','content_kind_ref':'acquired_photo_content'}
    windows=[{'window_ref':f'W_{x}_{y}','photo_ref':'P_current','left':x,'top':y}for x,y in scene['matches']]
    request=TemporalFragmentRequest(scope=scope,operation_ref='mechanics.temporal_fragment_match.exact_candidates',mode_ref='MATCH',requested_result_type='DMechanicalResult',node_bound=100000,depth_bound=4096,domain_bound=4096,time_bound_ms=max(1,min(300000,int((deadline-time.perf_counter())*1000))),models=[model],reference={'rows':scene['reference']},reference_revision_ref=revision,photos=[photo],windows=windows)
    return plain(measure_temporal_fragment_match(request).model_dump())

class FramedWindowAccess(RootedQuotaAccess):
    def __init__(self):super().__init__();self.window_events=[];self.window_blocked=[]
    def apply_event(self,event):
        if event['kind']!='framed_window_response':return super().apply_event(event)
        self.window_events.append(event)
        if not event['official_progress']:self.window_blocked.append(event['trial_key'])
    def retained_digest(self):return identity([super().retained_digest(),self.window_events,self.window_blocked])
    def propose(self,episode,obs,rows,inputs,max_prefix,config):
        cfg=config.get('framed_window_question')
        if cfg and max_prefix and 'ACTION6'in obs['available_action_refs']:
            scene=measure(rows)
            if scene and len(scene['matches'])==1:
                key=identity([obs['level_epoch'],rows,scene['matches']])
                if key not in self.window_blocked:
                    receipt=certify(scene,obs,config['level_deadline'])
                    if receipt['status']=='COMPLETE' and receipt['domain_complete']:return self.window_proposal(obs,rows,scene,receipt,key,cfg)
        return super().propose(episode,obs,rows,inputs,max_prefix,config)
    def window_proposal(self,obs,rows,scene,receipt,key,cfg):
        x,y=scene['matches'][0];l,t,_,_=scene['image_box'];point=[l+1+x+len(scene['reference'][0])//2,t+1+y+len(scene['reference'])//2];action={'action_ref':'ACTION6','data':dict(zip(('x','y'),point))}
        plan={'epoch':obs['level_epoch'],'score':obs['levels_completed'],'observation_ref':obs['observation_ref'],'frame_digest':identity(rows),'trial_key':key,'reference_box':scene['reference_box'],'image_box':scene['image_box'],'window':scene['matches'][0],'point':point,'reference_digest':identity(scene['reference']),'examined_windows':scene['examined_windows'],'method_receipt':receipt,'action':action,'scope':'Exact equality is descriptive. Reference role and usefulness of pointing remain hypotheses; no old coordinates or transport law are inherited.'}
        ref='C_window_'+identity(plan)[:20];facts={'unique_current_exact_window':True,'reference_outside_search_domain':True,'point_inside_current_window':True};why=cfg['question']
        return {'status':'proposed','kind':'framed_window_experiment','proposal_id':ref,'framed_window_plan':plan,'actions':[action],'steps':[{'action':action,'expected_after':None}],'facts':facts,'compositions':[{'id':ref,'observed':False,'open_question':why,'properties':{'roles':cfg['roles']},'relations':['contributes_to:G_official_completion']}],'question':{'reason':'test_current_exact_window_under_reference_role_hypothesis','hypothesis_refs':[scene['hypothesis']]},'route_refs':[obs['observation_ref']],'binding':{'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':[action],'purpose':why,'preconditions':facts,'evidence':[obs['observation_ref']],'outcome_guard':{'path':['value'],'contains':ref}}}
    def before(self,p,index,rows,**meta):
        plan=p.get('framed_window_plan')
        if not plan:return super().before(p,index,rows,**meta)
        expected={'action_ref':'ACTION6','data':dict(zip(('x','y'),plan['point']))}
        ok=index==0 and(meta['epoch'],meta['score'],meta['observation_ref'])==(plan['epoch'],plan['score'],plan['observation_ref'])and identity(rows)==plan['frame_digest']and'ACTION6'in meta['available']and p['actions']==[expected]and p['bundle_template']['actions']==[expected]
        return {'admitted':ok,'reason':'current_window_and_point_bound'if ok else'window_context_or_payload_changed'}
    def after(self,p,index,rows,later,**meta):
        plan=p.get('framed_window_plan')
        if not plan:return super().after(p,index,rows,later,**meta)
        return {'matched':None,'seal_prefix':True,'reason':'window_point_effect_requires_public_reconciliation','official_progress':meta['score']>plan['score']}
    def record(self,before,command,after,rows,later,proposal,index):
        events=super().record(before,command,after,rows,later,proposal,index);plan=proposal.get('framed_window_plan')
        if not plan:return events
        event={'kind':'framed_window_response','trial_key':plan['trial_key'],'epoch':before['level_epoch'],'after_epoch':after['level_epoch'],'evidence':[before['observation_ref'],after['observation_ref']],'reference_box':plan['reference_box'],'window':plan['window'],'point':plan['point'],'command':command,'official_progress':after['levels_completed']>before['levels_completed'],'canonical_changed':identity(rows)!=identity(later),'scope':'One actual point outcome; no universal reference, transport, or acceptance law inferred.'};self.apply_event(event);events.append(event);return events
