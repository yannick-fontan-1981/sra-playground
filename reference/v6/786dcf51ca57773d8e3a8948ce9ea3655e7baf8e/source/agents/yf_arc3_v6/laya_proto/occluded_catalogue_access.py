"""Experimental catalogue identification under measured partial-view constraints."""
from framed_window_access import FramedWindowAccess,input_candidates
from occluded_catalogue_observation import measure,fit,exposed_values
from occluded_catalogue_methods import certify
from terminal_composition import identity

class OccludedCatalogueAccess(FramedWindowAccess):
    def __init__(self):super().__init__();self.catalogue_events=[];self.catalogue_backgrounds={};self.catalogue_candidates={};self.catalogue_answered={};self.catalogue_blocked=[]
    def retained_digest(self):return identity([super().retained_digest(),self.catalogue_events,self.catalogue_backgrounds,self.catalogue_candidates,self.catalogue_answered,self.catalogue_blocked])
    def apply_event(self,e):
        if e['kind']=='catalogue_observation':
            self.catalogue_events.append(e);self.catalogue_backgrounds[e['field_key']]=e['backgrounds'];self.catalogue_candidates[e['catalogue_key']]=e['candidate_ids'];return
        if e['kind']=='catalogue_response':
            self.catalogue_events.append(e)
            if e['mode']=='answer':self.catalogue_answered.setdefault(e['field_key'],[]).append(e['palette'])
            elif not e['selection_matched']:self.catalogue_blocked.append(e['trial_key'])
            return
        super().apply_event(e)
    def keys(self,obs,scene):
        field=identity([obs['level_epoch'],scene['field']]);catalogue=identity([field,scene['palette'],[(p['mask'],p['extent'])for p in scene['cards']]])
        return field,catalogue
    def propose(self,episode,obs,rows,inputs,max_prefix,config):
        cfg=config.get('occluded_catalogue_question')
        if cfg and max_prefix and'ACTION6'in obs['available_action_refs']:
            scene=measure(rows)
            if scene:
                field,key=self.keys(obs,scene);bg=self.catalogue_backgrounds.get(field,[]);answered=self.catalogue_answered.get(field,[])
                if scene['palette']in answered:
                    alternatives=[p for p in scene['controls']if p['palette']not in answered]
                    if alternatives:
                        target=alternatives[0];trial=identity([obs['level_epoch'],rows,target['point']])
                        if trial not in self.catalogue_blocked:return self.proposal(obs,rows,scene,target['point'],'select',target['palette'],None,field,key,cfg)
                    else:self.requested_stop_reason='catalogue_combination_has_no_official_confirmation'
                elif bg:
                    fits=fit(rows,scene,bg);prior=self.catalogue_candidates.get(key)
                    if prior is not None:fits=[f for f in fits if f['candidate']in prior]
                    ids=sorted({f['candidate']for f in fits})
                    if len(ids)==1:
                        result=certify(scene,rows,obs,bg,fits,config['level_deadline'])
                        if result and result['status']=='COMPLETE'and result['values']['consistent_model_refs']:
                            evidence={'receipt':result,'pose_alternatives':fits,'prior_candidate_ids':prior,'backgrounds':bg,'candidate':ids[0]}
                            return self.proposal(obs,rows,scene,scene['cards'][ids[0]]['point'],'answer',scene['palette'],evidence,field,key,cfg)
        return super().propose(episode,obs,rows,inputs,max_prefix,config)
    def proposal(self,obs,rows,scene,point,mode,target,evidence,field,key,cfg):
        supporting=[e for e in self.catalogue_events if e.get('field_key')==field]
        evidence={**(evidence or {}),'supporting_event_digests':[identity(e)for e in supporting],'supporting_observation_refs':sorted({ref for e in supporting for ref in e['evidence']})}
        action={'action_ref':'ACTION6','data':dict(zip(('x','y'),point))};plan={'epoch':obs['level_epoch'],'score':obs['levels_completed'],'observation_ref':obs['observation_ref'],'frame_digest':identity(rows),'field_key':field,'catalogue_key':key,'trial_key':identity([obs['level_epoch'],rows,point]),'scene':scene,'point':point,'mode':mode,'target_palette':target,'evidence':evidence,'scope':'Reference/selection/response roles and shape invariance are hypotheses. Known reciprocal replacement supports a conditional substrate reading; all other field values remain unknown. Individual response is not correctness feedback.'};ref='C_catalogue_'+identity(plan)[:20];why=cfg['select_question']if mode=='select'else cfg['answer_question'];facts={'current_catalogue_and_control_geometry':True,'current_point_bound':True,'finite_comparison_or_control_experiment':True}
        return {'status':'proposed','kind':'occluded_catalogue_experiment','proposal_id':ref,'occluded_catalogue_plan':plan,'actions':[action],'steps':[{'action':action,'expected_after':None}],'facts':facts,'compositions':[{'id':ref,'observed':False,'open_question':why,'properties':{'roles':cfg['roles']},'relations':['contributes_to:G_official_completion']}],'question':{'reason':'test_catalogue_selection'if mode=='select'else'test_uniquely_compatible_partial_projection','hypothesis_refs':[]},'route_refs':[obs['observation_ref']],'binding':{'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':[action],'purpose':why,'preconditions':facts,'evidence':[obs['observation_ref']],'outcome_guard':{'path':['value'],'contains':ref}}}
    def before(self,p,index,rows,**meta):
        plan=p.get('occluded_catalogue_plan')
        if not plan:return super().before(p,index,rows,**meta)
        expected={'action_ref':'ACTION6','data':dict(zip(('x','y'),plan['point']))};ok=index==0 and(meta['epoch'],meta['score'],meta['observation_ref'])==(plan['epoch'],plan['score'],plan['observation_ref'])and identity(rows)==plan['frame_digest']and'ACTION6'in meta['available']and p['actions']==[expected]and p['bundle_template']['actions']==[expected]
        return {'admitted':ok,'reason':'current_catalogue_point_bound'if ok else'catalogue_context_or_payload_changed'}
    def after(self,p,index,rows,later,**meta):
        plan=p.get('occluded_catalogue_plan')
        if not plan:return super().after(p,index,rows,later,**meta)
        progressed=meta['score']>plan['score'];scene=measure(later)if not progressed else None;matched=scene is not None and scene['palette']==plan['target_palette']if plan['mode']=='select'else None
        return {'matched':matched,'seal_prefix':True,'reason':'catalogue_selector_response'if plan['mode']=='select'else'catalogue_submission_without_local_correctness_claim','official_progress':progressed}
    def record(self,before,command,after,rows,later,proposal,index):
        events=super().record(before,command,after,rows,later,proposal,index);plan=proposal.get('occluded_catalogue_plan');scene=measure(rows);current=measure(later)if after['level_epoch']==before['level_epoch']else None
        if scene and current and scene['field']==current['field']:
            field,key=self.keys(after,current);bg=self.catalogue_backgrounds.get(field,[])
            if scene['palette']==current['palette']and[(p['mask'],p['extent'])for p in scene['cards']]==[(p['mask'],p['extent'])for p in current['cards']]:bg=sorted(set(bg)|set(exposed_values(rows,later,scene)))
            if bg:
                fits=fit(later,current,bg);ids=sorted({f['candidate']for f in fits});previous=self.catalogue_candidates.get(key)
                if previous is not None:ids=sorted(set(ids)&set(previous))
                e={'kind':'catalogue_observation','field_key':field,'catalogue_key':key,'epoch':after['level_epoch'],'palette':current['palette'],'backgrounds':bg,'candidate_ids':ids,'current_pose_alternatives':[f for f in fits if f['candidate']in ids],'evidence':[before['observation_ref'],after['observation_ref']],'command':command,'scope':'Conditional catalogue identity and reciprocal exposed-value substrate; other palettes remain unobserved. Empty set is contradiction, not permission to guess.'};self.apply_event(e);events.append(e)
        if plan:
            e={'kind':'catalogue_response','field_key':plan['field_key'],'palette':plan['scene']['palette'],'mode':plan['mode'],'trial_key':plan['trial_key'],'selection_matched':current is not None and current['palette']==plan['target_palette'],'official_progress':after['levels_completed']>before['levels_completed'],'evidence':[before['observation_ref'],after['observation_ref']],'command':command,'scope':'Submission recorded, correctness remains global/unknown until official progress.'};self.apply_event(e);events.append(e)
        return events
