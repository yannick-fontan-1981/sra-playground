"""Bind finite labeled-predicate agreement to one current visible submission."""
import copy
from product_panel_access import ProductPanelAccess,input_candidates
from labeled_sequence_observation import measure
from labeled_sequence_methods import infer
from terminal_composition import identity

class LabeledSequenceAccess(ProductPanelAccess):
    def __init__(self):super().__init__();self.labeled_cache=None;self.labeled_events=[]
    def retained_digest(self):return identity([super().retained_digest(),self.labeled_cache,self.labeled_events])
    def apply_event(self,event):
        if event['kind']=='labeled_sequence_submission':self.labeled_cache=event['cache'];self.labeled_events.append(event);return
        super().apply_event(event)
    def propose(self,episode,obs,rows,inputs,max_prefix,config):
        cfg=config.get('labeled_sequence_question');prior=self.labeled_cache.get('controls')if self.labeled_cache and self.labeled_cache['epoch']==obs['level_epoch']else None;scene=measure(rows,prior)if cfg else None
        if not scene or not max_prefix or'ACTION6'not in obs['available_action_refs']:return super().propose(episode,obs,rows,inputs,max_prefix,config)
        result=infer(scene,obs,config['level_deadline'],cfg,self.labeled_cache)
        if not result or not result['induction']['values'].get('robust_answer_and_submission_agreement'):return {'status':'abstained','reason':'labeled_predicate_domain_has_no_unique_current_answer'}
        labels={p['predicted_label_ref']for p in result['induction']['values']['label_predictions']};assert len(labels)==1;label=int(next(iter(labels)));button=next(b for b in scene['buttons']if b['label']==label);action={'action_ref':'ACTION6','data':dict(zip(('x','y'),button['point']))}
        if any(e['epoch']==obs['level_epoch']and e['before_frame']==obs['frame_hash']and e['command']==action for e in self.labeled_events):return {'status':'abstained','reason':'identical_labeled_submission_context_already_observed'}
        plan={'epoch':obs['level_epoch'],'score':obs['levels_completed'],'observation_ref':obs['observation_ref'],'frame_digest':identity(rows),'scene':scene,'inference':result,'label':label,'button':button,'commands':[copy.deepcopy(action)],'scope':'Agreement within declared atomic/complement grammar on observed examples; labels/control correspondence remains geometric hypothesis. Next question and physical receipt unknown.'};ref='C_labeled_'+identity(plan)[:20];why=cfg['question'];facts={'measured_labeled_panel_and_scaled_query':True,'finite_declared_predicate_agreement':True,'current_button_bound_to_predicted_label':True}
        return {'status':'proposed','kind':'labeled_sequence_experiment','labeled_sequence_plan':plan,'proposal_id':ref,'actions':[action],'steps':[{'action':action,'expected_after':None}],'facts':facts,'compositions':[{'id':ref,'observed':False,'open_question':why,'properties':{'roles':cfg['roles']},'relations':['contributes_to:G_official_completion']}],'question':{'reason':why,'hypothesis_refs':[x['predicate_ref']for x in result['induction']['values']['observation_compatible_version_space']]},'route_refs':[obs['observation_ref']],'binding':{'level_epoch':obs['level_epoch'],'observation_ref':obs['observation_ref']},'bundle_template':{'operation_key':'OP18','composition_ref':ref,'objective_ref':'G_official_completion','preserve_refs':[],'actions':[action],'purpose':why,'preconditions':facts,'evidence':[obs['observation_ref'],scene['context_ref']],'outcome_guard':{'path':['value'],'contains':ref}}}
    def before(self,p,index,rows,**meta):
        plan=p.get('labeled_sequence_plan')
        if not plan:return super().before(p,index,rows,**meta)
        ok=index==0 and (meta['epoch'],meta['score'],meta['observation_ref'])==(plan['epoch'],plan['score'],plan['observation_ref'])and p['actions']==plan['commands']and p['bundle_template']['actions']==plan['commands']and'ACTION6'in meta['available']and identity(rows)==plan['frame_digest']
        return {'admitted':bool(ok),'reason':'current_labeled_query_and_button_bound'if ok else'labeled_context_or_payload_changed'}
    def after(self,p,index,rows,later,**meta):
        plan=p.get('labeled_sequence_plan')
        if not plan:return super().after(p,index,rows,later,**meta)
        return {'matched':None,'seal_prefix':True,'official_progress':meta['score']>plan['score'],'reason':'classification_response_and_next_query_require_reconciliation'}
    def record(self,before,command,after,rows,later,proposal,index):
        events=super().record(before,command,after,rows,later,proposal,index);plan=proposal.get('labeled_sequence_plan')
        if not plan:return events
        event={'kind':'labeled_sequence_submission','epoch':before['level_epoch'],'before_frame':before['frame_hash'],'after_frame':after['frame_hash'],'command':command,'before_ref':before['observation_ref'],'after_ref':after['observation_ref'],'official_progress':after['levels_completed']>before['levels_completed'],'label':plan['label'],'query':plan['scene']['query']['words'][0]['values'],'cache':plan['inference']['training_cache'],'physical_receipt_status':'official_boundary'if after['levels_completed']>before['levels_completed']else'changed_public_context'if before['frame_hash']!=after['frame_hash']else'unchanged_public_context','law_uniqueness_claimed':False};self.apply_event(event);events.append(event);return events
