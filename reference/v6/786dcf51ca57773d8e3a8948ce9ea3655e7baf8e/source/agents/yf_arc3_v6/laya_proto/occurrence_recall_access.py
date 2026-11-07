"""Public occurrence recall as a scoped experiment, with explicit rival relations."""
from program_respondent_access import ProgramRespondentAccess,input_candidates
from occurrence_scene import measure,candidates,context_scope
from terminal_composition import identity

class OccurrenceRecallAccess(ProgramRespondentAccess):
    def __init__(self):
        super().__init__();self.recall_calibration=None;self.recall_context=None;self.recall_epoch=None;self.recall_history={};self.recall_seen=[];self.recall_models={};self.recall_blocked=[];self.recall_events=[]
    def apply_event(self,e):
        if e['kind']!='occurrence_recall_transition':return super().apply_event(e)
        self.recall_events.append(e);self.recall_calibration=e['calibration'];self.recall_models=e['models'];self.recall_epoch=e['after_epoch']
        if e['mode']=='boundary':self.recall_context=None;self.recall_history={};self.recall_seen=[];self.recall_blocked=[]
        elif e['mode']=='forward':
            self.recall_history[e['before_scene']['key']]=e['before_context'];self.recall_context={'previous':e['before_scene'],'chosen':e['chosen'],'evidence_ref':e['before_scene']['source_ref']};self.recall_seen.extend(e['before_scene']['occurrences'])
        elif e['mode']=='restored':self.recall_context=e['restored_context']
        else:self.recall_blocked.append([e['before_scene']['key'],e['command']])
    def retained_digest(self):return identity([super().retained_digest(),self.recall_calibration,self.recall_context,self.recall_epoch,self.recall_history,self.recall_seen,self.recall_models,self.recall_blocked,self.recall_events])
    def propose(self,episode,obs,rows,inputs,max_prefix,config):
        cfg=config.get('occurrence_recall')
        if cfg and max_prefix:
            p=self.recall_question(obs,rows,cfg)
            if p:return p
        return super().propose(episode,obs,rows,inputs,max_prefix,config)
    def recall_question(self,obs,rows,cfg):
        if 'ACTION6' not in obs['available_action_refs']:return None
        scene=measure(rows,obs,self.recall_calibration)
        if not scene or not scene['occurrences']:return None
        context=self.recall_context if self.recall_epoch==obs['level_epoch'] else None;marked=[o for o in scene['occurrences'] if o['marked']];predictions=[];support=[];selected=None;reason=None
        if len(marked)==1:selected=marked[0];reason='test_observed_enclosing_emphasis'
        elif context is None and len(scene['occurrences'])==1:selected=scene['occurrences'][0];reason='test_unique_measured_occurrence'
        if context:
            scope=context_scope(context)
            for relation in cfg['reference_families']:
                for comparison in cfg['comparison_families']:
                    key=scope+':'+relation+':'+comparison;predicted=candidates(scene,context,self.recall_seen,relation,comparison);model=self.recall_models.get(key,{'unique_support':0,'counterexamples':[]});predictions.append({'model':key,'candidates':predicted,'unique_support':model['unique_support'],'counterexamples':len(model['counterexamples'])})
                    if len(predicted)==1 and model['unique_support']>=cfg['minimum_unique_observations'][scope] and not model['counterexamples']:support.append((key,predicted[0]))
            if selected is None and support and len({p[1] for p in support})==1:selected=next(o for o in scene['occurrences'] if o['id']==support[0][1]);reason='test_retained_occurrence_correspondence'
        if selected is None:return None
        action={'action_ref':'ACTION6','data':{'x':selected['point'][0],'y':selected['point'][1]}}
        if [scene['key'],action] in self.recall_blocked:return None
        plan={'epoch':obs['level_epoch'],'score':obs['levels_completed'],'observation_ref':obs['observation_ref'],'frame_digest':identity(rows),'scene':scene,'context':context,'selected':selected,'action':action,'predictions':predictions,'configuration':cfg,'selection_reason':reason,'supporting_models':[key for key,value in support if value==selected['id']],'scope':'Current occurrence is measured. Emphasis and retained relations authorize an experiment only; scene progression, restoration and official score remain separate observations.'};ref='C_occurrence_recall_'+identity(plan)[:20];facts={'current_occurrence_measured':True,'one_experimental_choice_bound':True};why=cfg['question']+' Selection: '+reason+'. Preserve competing relations and the exact current point; no scene from an animation becomes a new antecedent.';evidence=[obs['observation_ref']]+([context['evidence_ref']] if context else [])
        return {'status':'proposed','kind':'public_occurrence_recall','proposal_id':ref,'occurrence_recall_plan':plan,'actions':[action],'steps':[{'action':action,'expected_after':{'public_progression':'hypothesis','same_scene_or_restoration':'falsifier_or_unknown','official_score_required':True}}],'facts':facts,'compositions':[{'id':ref,'observed':False,'open_question':why,'properties':{'roles':cfg['roles'],'selected_occurrence':selected['id']},'relations':['contributes_to:G_official_completion']}],'question':{'reason':reason,'hypothesis_refs':[p['model'] for p in predictions]},'route_refs':evidence,'binding':{'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':[action],'purpose':why,'preconditions':facts,'evidence':evidence,'outcome_guard':{'path':['value'],'contains':ref}}}
    def before(self,p,index,rows,**meta):
        plan=p.get('occurrence_recall_plan')
        if not plan:return super().before(p,index,rows,**meta)
        ok=index==0 and (meta['epoch'],meta['score'],meta['observation_ref'])==(plan['epoch'],plan['score'],plan['observation_ref']) and identity(rows)==plan['frame_digest'] and plan['action']['action_ref'] in meta['available'] and p['actions'][0]==plan['action'] and [plan['action']['data']['x'],plan['action']['data']['y']]==plan['selected']['point']
        return {'admitted':ok,'reason':'public_occurrence_bound' if ok else 'occurrence_context_or_payload_changed'}
    def after(self,p,index,rows,later,**meta):
        if not p.get('occurrence_recall_plan'):return super().after(p,index,rows,later,**meta)
        return {'matched':None,'seal_prefix':True,'reason':'canonical_scene_reconciliation_required','official_progress':meta['score']>p['occurrence_recall_plan']['score']}
    def record(self,before,command,after,rows,later,proposal,index):
        events=super().record(before,command,after,rows,later,proposal,index);plan=proposal.get('occurrence_recall_plan')
        if not plan:return events
        scene=plan['scene'];next_scene=measure(later,after,scene['calibration']);boundary=after['level_epoch']!=before['level_epoch'] or after['levels_completed']>before['levels_completed'];restored=None
        if boundary:mode='boundary'
        elif next_scene and next_scene['key'] in self.recall_history:mode='restored';restored=self.recall_history[next_scene['key']]
        elif next_scene and next_scene['key']!=scene['key'] and len(next_scene['indicators'])==len(scene['indicators']) and sum(a!=b for a,b in zip(next_scene['indicators'],scene['indicators']))==1:mode='forward'
        else:mode='unknown_or_no_effect'
        models={k:{**v,'evidence':list(v['evidence']),'counterexamples':list(v['counterexamples'])} for k,v in self.recall_models.items()}
        if mode in ('forward','boundary') and plan['context']:
            for prediction in plan['predictions']:
                key=prediction['model'];m=models.setdefault(key,{'unique_support':0,'evidence':[],'counterexamples':[]});evidence=[before['observation_ref'],after['observation_ref']]
                if plan['selected']['id'] not in prediction['candidates']:m['counterexamples'].append(evidence)
                elif len(prediction['candidates'])==1:m['unique_support']+=1;m['evidence'].append(evidence)
        elif mode=='restored':
            for key in plan['supporting_models']:
                if key in models:models[key]['counterexamples'].append([before['observation_ref'],after['observation_ref']])
        event={'kind':'occurrence_recall_transition','before_scene':scene,'before_context':plan['context'],'chosen':plan['selected']['id'],'command':command,'mode':mode,'restored_context':restored,'after_scene_key':next_scene['key'] if next_scene else None,'after_epoch':after['level_epoch'],'calibration':scene['calibration'],'models':models,'evidence':[before['observation_ref'],after['observation_ref']],'scope':'One canonical scene per external command. Meter-direction interpretation remains conditional until official progression; exact masks and occurrence choice are retained.'};self.apply_event(event);events.append(event);return events
